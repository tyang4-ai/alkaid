"""Core Game class — headless simulation tick loop for training.

Wires all systems in exact tick order matching main.ts:890-980.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from shared.load_constants import sim_cfg, map_cfg, load_constants, training_cfg
from env.types import (
    Unit, UnitType, UnitState, OrderType, Order,
    EnvironmentState, BattleResult, VictoryType,
    UNIT_TYPE_CONFIGS,
)
from env.terrain import TerrainGrid, generate_terrain
from env.random import SeededRandom
from env.spatial_hash import SpatialHash
from env.pathfinding import find_path, get_movement_vector
from env.combat import CombatSystem
from env.morale import MoraleSystem
from env.supply import SupplySystem
from env.fatigue import FatigueSystem
from env.experience import ExperienceSystem
from env.surrender import SurrenderSystem
from env.command import CommandSystem
from env.environment import WeatherSystem, TimeOfDaySystem

_sim = sim_cfg()
_map = map_cfg()
_TILE_SIZE = _map["TILE_SIZE"]
_SIM_TICK_RATE = _sim["SIM_TICK_RATE"]
_c = load_constants()
_tc = training_cfg()
_MAX_TICKS = _tc["MAX_TICKS"]

# Order effects constants
_oe = _c["orderEffects"]
_ROUT_SPEED_MULT = _c["combat"]["ROUT_SPEED_MULTIPLIER"]
_CHARGE_SPEED_MULT = _oe["CHARGE_SPEED_MULT"]
_FORM_UP_SPEED_PENALTY = _oe["FORM_UP_SPEED_PENALTY"]
_DISENGAGE_SPEED_PENALTY = _oe["DISENGAGE_SPEED_PENALTY"]
_DISENGAGE_PENALTY_TICKS = _oe["DISENGAGE_PENALTY_TICKS"]
_FORM_UP_COMPLETION_TICKS = _oe["FORM_UP_COMPLETION_TICKS"]


@dataclass
class ArmyConfig:
    """Configuration for one team's army."""
    team: int
    units: list[dict]  # list of {type, x, y, is_general?, size?}


class Game:
    """Headless game simulation for training."""

    def __init__(
        self,
        seed: int = 42,
        map_template: str = "open_plains",
        map_width: int | None = None,
        map_height: int | None = None,
    ) -> None:
        self.rng = SeededRandom(seed)

        w = map_width or _map["DEFAULT_MAP_WIDTH"]
        h = map_height or int(w * 0.75)

        self.terrain = generate_terrain(seed, map_template, w, h)
        self.map_width_px = w * _TILE_SIZE
        self.map_height_px = h * _TILE_SIZE

        # Systems
        self.spatial_hash = SpatialHash()
        self.combat_system = CombatSystem(self.terrain)
        self.morale_system = MoraleSystem()
        self.supply_system = SupplySystem(self.terrain)
        self.fatigue_system = FatigueSystem(self.terrain)
        self.experience_system = ExperienceSystem()
        self.surrender_system = SurrenderSystem()
        self.command_system = CommandSystem(self.terrain, self.rng)
        self.weather_system = WeatherSystem(self.rng)
        self.time_system = TimeOfDaySystem()

        # State
        self.tick_number = 0
        self.env_state = EnvironmentState()
        self.units: list[Unit] = []
        self.unit_map: dict[int, Unit] = {}
        self.orders: dict[int, int] = {}  # unit_id -> OrderType
        self.next_unit_id = 1
        self.battle_ended = False
        self.battle_result: BattleResult | None = None
        self.events: list[dict] = []

        # Metrics for reward
        self.team_casualties: dict[int, int] = {0: 0, 1: 0}
        self.team_squads_routed: dict[int, int] = {0: 0, 1: 0}
        self.team_general_killed: dict[int, bool] = {0: False, 1: False}

    def setup_armies(self, configs: list[ArmyConfig]) -> None:
        """Spawn units from army configs and initialize all systems."""
        for cfg in configs:
            for unit_def in cfg.units:
                self._spawn_unit(cfg.team, unit_def)

        # Init supply for each team
        self.supply_system.init_army(0)
        self.supply_system.init_army(1)

        # Init surrender tracking
        self.surrender_system.init_battle(self.units)

        # Build spatial hash
        self.spatial_hash.rebuild(self.units)

    def _spawn_unit(self, team: int, unit_def: dict) -> Unit:
        utype = unit_def["type"]
        cfg = UNIT_TYPE_CONFIGS[utype]
        size = unit_def.get("size", cfg.max_size)
        is_general = unit_def.get("is_general", utype == UnitType.GENERAL)

        unit = Unit(
            id=self.next_unit_id,
            type=utype,
            team=team,
            x=float(unit_def["x"]),
            y=float(unit_def["y"]),
            size=size,
            max_size=cfg.max_size,
            hp=size * cfg.hp_per_soldier,
            is_general=is_general,
        )
        self.next_unit_id += 1
        self.units.append(unit)
        self.unit_map[unit.id] = unit
        return unit

    def tick(self) -> list[dict]:
        """Advance simulation by one tick. Returns events from this tick."""
        if self.battle_ended:
            return []

        self.tick_number += 1
        self.env_state.current_tick = self.tick_number
        self.events = []

        # 1. Spatial hash rebuild
        self.spatial_hash.rebuild(self.units)

        # 2. Command system (advance messengers)
        cmd_events = self.command_system.tick(
            self.tick_number, self.units, self.unit_map, self.orders,
        )
        self.events.extend(cmd_events)

        # 3. Weather
        self.weather_system.tick(self.env_state)

        # 4. Time of day
        self.time_system.tick(self.env_state)

        # 5. Supply
        supply_events = self.supply_system.tick(self.units, self.env_state)
        self.events.extend(supply_events)

        # 6. Fatigue
        food_percents = self.supply_system.get_all_food_percents()
        self.fatigue_system.tick(self.units, self.orders, food_percents, self.env_state)

        # 7. Combat
        combat_events = self.combat_system.tick(
            self.tick_number, self.units, self.spatial_hash,
            self.morale_system, food_percents, self.env_state,
        )
        self.events.extend(combat_events)
        self._process_combat_events(combat_events)

        # 8. Experience
        exp_events = self.experience_system.tick(self.units)
        self.events.extend(exp_events)

        # 9. Morale
        morale_events = self.morale_system.tick(
            self.units, self.orders, food_percents, self.terrain, self.env_state,
        )
        self.events.extend(morale_events)
        self._process_morale_events(morale_events)

        # 10. Surrender
        if not self.battle_ended:
            surr_events = self.surrender_system.tick(
                self.tick_number, self.units, self.supply_system,
            )
            self.events.extend(surr_events)
            for ev in surr_events:
                if ev.get("type") == "battle:ended":
                    self._end_battle(ev["winner_team"], ev["victory_type"])

        # 11. Unit movement + order effects
        self._tick_units()

        # 12. Battle end checks
        if not self.battle_ended:
            self._check_annihilation()
            self._check_general_killed()
            if self.tick_number >= _MAX_TICKS:
                self._end_battle_stalemate()

        return self.events

    def issue_orders(self, team: int, order_list: list[Order]) -> None:
        """Issue orders for a team through the command system."""
        for order in order_list:
            self.command_system.issue_order(order, self.units, self.unit_map)

    def get_alive_units(self, team: int) -> list[Unit]:
        return [u for u in self.units if u.team == team and u.state != UnitState.DEAD]

    def get_all_alive_units(self) -> list[Unit]:
        return [u for u in self.units if u.state != UnitState.DEAD]

    def _process_combat_events(self, events: list[dict]) -> None:
        for ev in events:
            if ev.get("type") == "combat:damage":
                target = self.unit_map.get(ev["target_id"])
                if target:
                    self.team_casualties[target.team] = (
                        self.team_casualties.get(target.team, 0) + ev["killed"]
                    )
                    self.experience_system.record_kills(ev["attacker_id"], ev["killed"])

            elif ev.get("type") == "combat:unitDestroyed":
                unit = self.unit_map.get(ev["unit_id"])
                if unit and unit.is_general:
                    self.team_general_killed[unit.team] = True
                    general_events = self.morale_system.apply_general_killed(
                        unit.team, self.units,
                    )
                    self.events.extend(general_events)

    def _process_morale_events(self, events: list[dict]) -> None:
        for ev in events:
            if ev.get("type") == "unit:routed":
                uid = ev["unit_id"]
                unit = self.unit_map.get(uid)
                if unit:
                    self.team_squads_routed[unit.team] = (
                        self.team_squads_routed.get(unit.team, 0) + 1
                    )
                    self.experience_system.record_rout(uid)
                    self.morale_system.apply_winning_engagement(self.units, unit)

    def _tick_units(self) -> None:
        """Process unit movement, rout movement, order effects."""
        dt = 1.0 / _SIM_TICK_RATE

        for unit in self.units:
            if unit.state == UnitState.DEAD:
                continue

            # Rout tick countdown
            if unit.rout_ticks > 0:
                unit.rout_ticks -= 1

            # Rout movement
            if unit.state == UnitState.ROUTING:
                cfg = UNIT_TYPE_CONFIGS[unit.type]
                speed = cfg.speed * _TILE_SIZE * _ROUT_SPEED_MULT
                speed_per_tick = speed / _SIM_TICK_RATE

                unit.prev_x = unit.x
                unit.prev_y = unit.y
                unit.x += math.cos(unit.facing) * speed_per_tick
                unit.y += math.sin(unit.facing) * speed_per_tick

                # Clamp to map
                unit.x = max(0, min(self.map_width_px, unit.x))
                unit.y = max(0, min(self.map_height_px, unit.y))

                # Kill if off map edge
                if (unit.x <= 0 or unit.x >= self.map_width_px
                        or unit.y <= 0 or unit.y >= self.map_height_px):
                    unit.state = UnitState.DEAD
                continue

            # Normal movement along path
            if unit.state == UnitState.MOVING and unit.path:
                cfg = UNIT_TYPE_CONFIGS[unit.type]
                speed = cfg.speed * _TILE_SIZE
                speed_per_tick = speed / _SIM_TICK_RATE

                # Speed modifiers
                speed_per_tick *= FatigueSystem.get_speed_multiplier(unit.fatigue)
                food_pct = self.supply_system.get_food_percent(unit.team)
                speed_per_tick *= SupplySystem.get_speed_multiplier(food_pct)

                # Order-specific speed mods
                order = self.orders.get(unit.id)
                if order == OrderType.CHARGE:
                    speed_per_tick *= _CHARGE_SPEED_MULT
                elif order == OrderType.FORM_UP and unit.form_up_ticks < _FORM_UP_COMPLETION_TICKS:
                    speed_per_tick *= (1 - _FORM_UP_SPEED_PENALTY)
                elif order == OrderType.DISENGAGE and unit.disengage_ticks < _DISENGAGE_PENALTY_TICKS:
                    speed_per_tick *= (1 - _DISENGAGE_SPEED_PENALTY)

                result = get_movement_vector(unit.x, unit.y, unit.path, unit.path_index)
                if result:
                    dx, dy, new_idx = result
                    unit.path_index = new_idx
                    unit.prev_x = unit.x
                    unit.prev_y = unit.y
                    unit.x += dx * speed_per_tick
                    unit.y += dy * speed_per_tick
                    unit.facing = math.atan2(dy, dx)
                else:
                    # Path exhausted
                    unit.path = None
                    unit.path_index = 0
                    if unit.state == UnitState.MOVING:
                        unit.state = UnitState.IDLE

            # Order effect tick counters
            order = self.orders.get(unit.id)
            if order == OrderType.FORM_UP:
                unit.form_up_ticks += 1
            if order == OrderType.DISENGAGE:
                unit.disengage_ticks += 1

    def _check_annihilation(self) -> None:
        for check_team in (0, 1):
            alive = any(
                u.team == check_team and u.state != UnitState.DEAD
                for u in self.units
            )
            if not alive:
                winner = 1 - check_team
                self._end_battle(winner, VictoryType.ANNIHILATION)
                return

    def _check_general_killed(self) -> None:
        for team in (0, 1):
            if self.team_general_killed.get(team, False):
                # Check if all units of that team are routing or dead
                alive_non_routing = [
                    u for u in self.units
                    if u.team == team
                    and u.state not in (UnitState.DEAD, UnitState.ROUTING)
                    and not u.is_general
                ]
                if not alive_non_routing:
                    winner = 1 - team
                    self._end_battle(winner, VictoryType.GENERAL_KILLED)
                    return

    def _end_battle_stalemate(self) -> None:
        # Compare remaining soldiers
        t0 = sum(u.size for u in self.units if u.team == 0 and u.state != UnitState.DEAD)
        t1 = sum(u.size for u in self.units if u.team == 1 and u.state != UnitState.DEAD)
        if t0 > t1:
            self._end_battle(0, VictoryType.STALEMATE)
        elif t1 > t0:
            self._end_battle(1, VictoryType.STALEMATE)
        else:
            self._end_battle(0, VictoryType.STALEMATE)  # Team 0 wins ties

    def _end_battle(self, winner: int, victory_type: int) -> None:
        if self.battle_ended:
            return
        self.battle_ended = True
        self.battle_result = BattleResult(
            winner_team=winner,
            victory_type=victory_type,
            ticks_elapsed=self.tick_number,
            team0_casualties=self.team_casualties.get(0, 0),
            team1_casualties=self.team_casualties.get(1, 0),
        )
        self.events.append({
            "type": "battle:ended",
            "winner_team": winner,
            "victory_type": victory_type,
        })
