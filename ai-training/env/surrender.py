"""SurrenderSystem — port of SurrenderSystem.ts (5-factor pressure)."""
from __future__ import annotations

import math

from shared.load_constants import surrender_cfg, map_cfg
from env.types import Unit, UnitType, UnitState, VictoryType
from env.supply import SupplySystem

_sc = surrender_cfg()
_TILE_SIZE = map_cfg()["TILE_SIZE"]


class SurrenderState:
    __slots__ = ("consecutive_high_pressure_checks", "last_pressure", "surrendered", "starting_soldiers")

    def __init__(self, starting_soldiers: int = 0) -> None:
        self.consecutive_high_pressure_checks = 0
        self.last_pressure = 0.0
        self.surrendered = False
        self.starting_soldiers = starting_soldiers


class SurrenderSystem:
    """5-factor weighted surrender pressure with consecutive check threshold."""

    def __init__(self) -> None:
        self._team_states: dict[int, SurrenderState] = {}

    def init_battle(self, units: list[Unit]) -> None:
        """Snapshot starting soldiers per team."""
        team_soldiers: dict[int, int] = {}
        for u in units:
            if u.state != UnitState.DEAD:
                team_soldiers[u.team] = team_soldiers.get(u.team, 0) + u.size
        for team, soldiers in team_soldiers.items():
            self._team_states[team] = SurrenderState(starting_soldiers=soldiers)

    def get_pressure(self, team: int) -> float:
        state = self._team_states.get(team)
        return state.last_pressure if state else 0

    def tick(
        self,
        current_tick: int,
        units: list[Unit],
        supply_system: SupplySystem,
    ) -> list[dict]:
        events: list[dict] = []

        if current_tick % _sc["SURRENDER_CHECK_INTERVAL_TICKS"] != 0:
            return events

        for team, state in self._team_states.items():
            if state.surrendered:
                continue

            factors = self._compute_factors(team, units, supply_system, state)

            pressure = (
                factors["morale"] * _sc["SURRENDER_WEIGHT_MORALE"]
                + factors["casualty"] * _sc["SURRENDER_WEIGHT_CASUALTY"]
                + factors["supply"] * _sc["SURRENDER_WEIGHT_SUPPLY"]
                + factors["encirclement"] * _sc["SURRENDER_WEIGHT_ENCIRCLEMENT"]
                + factors["leadership"] * _sc["SURRENDER_WEIGHT_LEADERSHIP"]
            )

            state.last_pressure = pressure

            if pressure >= _sc["SURRENDER_PRESSURE_THRESHOLD"]:
                state.consecutive_high_pressure_checks += 1
            else:
                state.consecutive_high_pressure_checks = 0

            if state.consecutive_high_pressure_checks >= _sc["SURRENDER_CONSECUTIVE_CHECKS"]:
                state.surrendered = True
                winner = 1 - team
                events.append({
                    "type": "battle:ended",
                    "winner_team": winner,
                    "victory_type": VictoryType.SURRENDER,
                })

        return events

    def _compute_factors(
        self,
        team: int,
        units: list[Unit],
        supply_system: SupplySystem,
        state: SurrenderState,
    ) -> dict[str, float]:
        alive_units = [u for u in units if u.team == team and u.state != UnitState.DEAD]

        # 1. Morale factor
        if alive_units:
            avg_morale = sum(u.morale for u in alive_units) / len(alive_units)
        else:
            avg_morale = 0
        morale_factor = max(0, min(100, 100 - avg_morale))

        # 2. Casualty factor
        current_soldiers = sum(u.size for u in alive_units)
        if state.starting_soldiers > 0:
            casualty_factor = max(0, min(100,
                ((state.starting_soldiers - current_soldiers) / state.starting_soldiers) * 100
            ))
        else:
            casualty_factor = 100

        # 3. Supply factor
        food_pct = supply_system.get_food_percent(team)
        supply_factor = max(0, min(100, 100 - food_pct))

        # 4. Encirclement factor (quadrant-based)
        if not alive_units:
            encirclement_factor = 100.0
        else:
            cx = sum(u.x for u in alive_units) / len(alive_units)
            cy = sum(u.y for u in alive_units) / len(alive_units)
            radius_px = _sc["ENCIRCLEMENT_CHECK_RADIUS"] * _TILE_SIZE

            quadrants = [0, 0, 0, 0]  # N, E, S, W
            for u in units:
                if u.team == team or u.state == UnitState.DEAD:
                    continue
                dx = u.x - cx
                dy = u.y - cy
                if abs(dx) > radius_px and abs(dy) > radius_px:
                    continue
                if dy < 0:
                    quadrants[0] += 1  # N
                if dx > 0:
                    quadrants[1] += 1  # E
                if dy > 0:
                    quadrants[2] += 1  # S
                if dx < 0:
                    quadrants[3] += 1  # W

            blocked = sum(
                1 for q in quadrants if q >= _sc["ENCIRCLEMENT_ENEMY_THRESHOLD"]
            )
            encirclement_factor = max(0, blocked * 25)

        # 5. Leadership factor
        general = None
        for u in units:
            if u.is_general and u.team == team and u.state != UnitState.DEAD:
                general = u
                break
        leadership_factor = 0.0 if general else 100.0

        return {
            "morale": morale_factor,
            "casualty": casualty_factor,
            "supply": supply_factor,
            "encirclement": encirclement_factor,
            "leadership": leadership_factor,
        }
