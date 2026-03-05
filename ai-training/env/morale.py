"""MoraleSystem — port of MoraleSystem.ts (12 modifiers, rout cascade)."""
from __future__ import annotations

import math

from shared.load_constants import (
    combat_cfg, morale_cfg, supply_cfg, fatigue_cfg, map_cfg, time_of_day_cfg,
)
from env.types import (
    Unit, UnitType, UnitState, OrderType, TimeOfDay, EnvironmentState,
    TERRAIN_STATS, UNIT_TYPE_CONFIGS,
)
from env.terrain import TerrainGrid

_cc = combat_cfg()
_mc = morale_cfg()
_sc = supply_cfg()
_fc = fatigue_cfg()
_map = map_cfg()
_tod = time_of_day_cfg()
_TILE_SIZE = _map["TILE_SIZE"]

_COMMAND_RADIUS_PX = _map["DEFAULT_MAP_WIDTH"] * _TILE_SIZE * _cc.get("COMMAND_RADIUS_FRACTION", 0.30)


def get_rout_threshold(experience: float, unit_type: int) -> int:
    """Get rout threshold based on experience tier and unit type."""
    if unit_type == UnitType.ELITE_GUARD:
        return 5
    if experience >= 80:
        return 5
    if experience >= 60:
        return 10
    if experience >= 20:
        return 15
    return 25


class MoraleSystem:
    """Morale updates with 12 modifiers, rout, rally, and cascade."""

    def tick(
        self,
        units: list[Unit],
        orders: dict[int, int],  # unit_id -> OrderType
        army_food_percents: dict[int, float] | None = None,
        terrain_grid: TerrainGrid | None = None,
        env: EnvironmentState | None = None,
    ) -> list[dict]:
        """Run morale updates for all units. Returns events."""
        events: list[dict] = []
        unit_map = {u.id: u for u in units}

        # --- Army rout cascade check (30%/50% routing) ---
        team_counts: dict[int, tuple[int, int]] = {}  # team -> (total, routing)
        for unit in units:
            if unit.state == UnitState.DEAD:
                continue
            total, routing = team_counts.get(unit.team, (0, 0))
            total += 1
            if unit.state == UnitState.ROUTING:
                routing += 1
            team_counts[unit.team] = (total, routing)

        for team, (total, routing) in team_counts.items():
            if total == 0:
                continue
            rout_pct = routing / total
            morale_hit = 0
            if rout_pct >= 0.5:
                morale_hit = _mc["MORALE_ARMY_ROUT_50_PERCENT"]
            elif rout_pct >= 0.3:
                morale_hit = _mc["MORALE_ARMY_ROUT_30_PERCENT"]
            if morale_hit < 0:
                for unit in units:
                    if unit.team != team or unit.state in (UnitState.DEAD, UnitState.ROUTING):
                        continue
                    unit.morale = max(0, unit.morale + morale_hit)

        # --- Per-unit modifiers ---
        for unit in units:
            if unit.state == UnitState.DEAD:
                continue

            # 1. General nearby bonus
            general = self._find_general(units, unit.team)
            if general and not unit.is_general:
                dx = general.x - unit.x
                dy = general.y - unit.y
                if dx * dx + dy * dy <= _COMMAND_RADIUS_PX * _COMMAND_RADIUS_PX:
                    unit.morale = min(100, unit.morale + _cc["GENERAL_NEARBY_MORALE_PER_TICK"])

            # 2. Passive recovery when idle and not in combat
            if unit.state == UnitState.IDLE and unit.combat_target_id == -1:
                unit.morale = min(100, unit.morale + 0.5)

            # 3. Elite Guard aura
            if unit.type != UnitType.ELITE_GUARD:
                aura_radius_px = _mc["MORALE_ELITE_GUARD_AURA_RADIUS_TILES"] * _TILE_SIZE
                aura_radius_sq = aura_radius_px * aura_radius_px
                for other in units:
                    if other.type != UnitType.ELITE_GUARD:
                        continue
                    if other.team != unit.team or other.state == UnitState.DEAD:
                        continue
                    dx = unit.x - other.x
                    dy = unit.y - other.y
                    if dx * dx + dy * dy <= aura_radius_sq:
                        unit.morale = min(100, unit.morale + _mc["MORALE_ELITE_GUARD_AURA"])
                        break

            # 4. Supply-based morale
            if army_food_percents:
                food = army_food_percents.get(unit.team, 100)
                if food > _sc["SUPPLY_LOW_RATIONS_THRESHOLD"] * 100:
                    unit.morale = min(100, unit.morale + _sc["SUPPLY_WELL_FED_MORALE_PER_TICK"])
                elif food > _sc["SUPPLY_HUNGER_THRESHOLD"] * 100:
                    unit.morale = max(0, unit.morale + _sc["SUPPLY_LOW_RATIONS_MORALE_PER_TICK"])
                elif food > 0:
                    unit.morale = max(0, unit.morale + _sc["SUPPLY_HUNGER_MORALE_PER_TICK"])
                else:
                    unit.morale = max(0, unit.morale + _sc["SUPPLY_STARVATION_MORALE_PER_TICK"])

            # 5. Fatigue morale penalty
            if unit.fatigue >= _fc["FATIGUE_MORALE_THRESHOLD"]:
                unit.morale = max(0, unit.morale + _fc["FATIGUE_MORALE_PENALTY_PER_TICK"])

            # 6. Extended combat penalty
            if unit.combat_target_id != -1 and unit.combat_ticks > _mc["MORALE_EXTENDED_COMBAT_THRESHOLD_TICKS"]:
                unit.morale = max(0, unit.morale + _mc["MORALE_EXTENDED_COMBAT_PER_TICK"])

            # 7. Favorable terrain bonus
            if terrain_grid and unit.state == UnitState.DEFENDING and unit.combat_target_id != -1:
                tx = int(math.floor(unit.x / _TILE_SIZE))
                ty = int(math.floor(unit.y / _TILE_SIZE))
                terrain = terrain_grid.get_terrain(tx, ty)
                stats = TERRAIN_STATS.get(terrain)
                if stats and stats.def_bonus > 0:
                    unit.morale = min(100, unit.morale + _mc["MORALE_FAVORABLE_TERRAIN_BONUS"])

            # 8. Outnumbered penalty
            if unit.combat_target_id != -1:
                check_radius = 5 * _TILE_SIZE
                check_radius_sq = check_radius * check_radius
                friendly_soldiers = 0
                enemy_soldiers = 0
                for other in units:
                    if other.state == UnitState.DEAD:
                        continue
                    dx = other.x - unit.x
                    dy = other.y - unit.y
                    if dx * dx + dy * dy > check_radius_sq:
                        continue
                    if other.team == unit.team:
                        friendly_soldiers += other.size
                    else:
                        enemy_soldiers += other.size
                if friendly_soldiers > 0 and enemy_soldiers >= friendly_soldiers * 2:
                    unit.morale = max(0, unit.morale + _mc["MORALE_OUTNUMBERED_PER_TICK"])

            # 9. Night combat penalty
            if env and env.time_of_day == TimeOfDay.NIGHT and unit.combat_target_id != -1:
                if unit.experience < _tod["NIGHT_VETERAN_EXP_THRESHOLD"]:
                    unit.morale = max(0, unit.morale - 3)

            # Check for rout
            if unit.state != UnitState.ROUTING:
                threshold = get_rout_threshold(unit.experience, unit.type)
                if unit.morale <= threshold:
                    self._rout_unit(unit, units, orders, events)

            # Check rally
            if unit.state == UnitState.ROUTING and unit.rout_ticks == 0:
                order_type = orders.get(unit.id)
                if order_type == OrderType.RALLY:
                    threshold = get_rout_threshold(unit.experience, unit.type)
                    from shared.load_constants import command_cfg
                    rally_offset = command_cfg()["RALLY_MORALE_THRESHOLD_OFFSET"]
                    if unit.morale > threshold + rally_offset:
                        self._rally_unit(unit, orders, events)

        return events

    def apply_casualty_morale(self, unit: Unit, percent_lost: float) -> None:
        """Apply morale loss from casualties."""
        unit.morale += _cc["MORALE_LOSS_PER_CASUALTY_PERCENT"] * percent_lost
        unit.morale = max(0, unit.morale)

    def apply_general_killed(self, team: int, units: list[Unit]) -> list[dict]:
        """One-time -30 morale army-wide when general is killed."""
        events: list[dict] = []
        for unit in units:
            if unit.team != team or unit.state == UnitState.DEAD:
                continue
            unit.morale = max(0, unit.morale + _mc["MORALE_GENERAL_KILLED_HIT"])
        events.append({"type": "morale:generalKilled", "team": team})
        return events

    def apply_winning_engagement(self, units: list[Unit], routed_unit: Unit) -> None:
        """Bonus morale to enemies of routed unit in radius."""
        radius_px = _mc["MORALE_WINNING_ENGAGEMENT_RADIUS_TILES"] * _TILE_SIZE
        radius_sq = radius_px * radius_px
        for unit in units:
            if unit.state == UnitState.DEAD or unit.team == routed_unit.team:
                continue
            dx = unit.x - routed_unit.x
            dy = unit.y - routed_unit.y
            if dx * dx + dy * dy <= radius_sq:
                unit.morale = min(100, unit.morale + _mc["MORALE_WINNING_ENGAGEMENT_BONUS"])

    def _find_general(self, units: list[Unit], team: int) -> Unit | None:
        for u in units:
            if u.is_general and u.team == team and u.state != UnitState.DEAD:
                return u
        return None

    def _rout_unit(
        self,
        unit: Unit,
        all_units: list[Unit],
        orders: dict[int, int],
        events: list[dict],
    ) -> None:
        unit.state = UnitState.ROUTING
        unit.rout_ticks = _cc["ROUT_NO_ORDERS_TICKS"]
        unit.combat_target_id = -1
        unit.combat_ticks = 0
        orders.pop(unit.id, None)

        # Flee toward nearest edge
        map_w = _map["DEFAULT_MAP_WIDTH"] * _TILE_SIZE
        map_h = int(map_w * 0.75)
        edges = [
            (math.pi, unit.x),
            (0, map_w - unit.x),
            (-math.pi / 2, unit.y),
            (math.pi / 2, map_h - unit.y),
        ]
        edges.sort(key=lambda e: e[1])
        unit.facing = edges[0][0]

        events.append({"type": "unit:routed", "unit_id": unit.id})

        # Rout cascade
        cascade_radius_px = _cc["ROUT_CASCADE_RADIUS_TILES"] * _TILE_SIZE
        cascade_radius_sq = cascade_radius_px * cascade_radius_px
        for other in all_units:
            if other.id == unit.id or other.team != unit.team:
                continue
            if other.state in (UnitState.DEAD, UnitState.ROUTING):
                continue
            dx = other.x - unit.x
            dy = other.y - unit.y
            if dx * dx + dy * dy <= cascade_radius_sq:
                other.morale = max(0, other.morale + _cc["ROUT_CASCADE_MORALE_HIT"])

    def _rally_unit(self, unit: Unit, orders: dict[int, int], events: list[dict]) -> None:
        unit.state = UnitState.IDLE
        unit.rout_ticks = 0
        orders.pop(unit.id, None)
        events.append({"type": "unit:rallied", "unit_id": unit.id})
