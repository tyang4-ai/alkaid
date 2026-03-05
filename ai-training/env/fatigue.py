"""FatigueSystem — port of FatigueSystem.ts."""
from __future__ import annotations

import math

from shared.load_constants import fatigue_cfg, supply_cfg, map_cfg, weather_cfg, time_of_day_modifiers
from env.types import Unit, UnitType, UnitState, WeatherType, EnvironmentState, TERRAIN_STATS
from env.terrain import TerrainGrid

_fc = fatigue_cfg()
_sc = supply_cfg()
_wc = weather_cfg()
_TILE_SIZE = map_cfg()["TILE_SIZE"]
_SPEED_THRESHOLDS: list[tuple[float, float]] = [tuple(t) for t in _fc["FATIGUE_SPEED_THRESHOLDS"]]


class FatigueSystem:
    """Movement/combat/terrain fatigue gain, recovery, speed thresholds."""

    def __init__(self, terrain_grid: TerrainGrid) -> None:
        self._terrain = terrain_grid

    def tick(
        self,
        units: list[Unit],
        orders: dict[int, int],  # unit_id -> OrderType
        army_food_percents: dict[int, float] | None = None,
        env: EnvironmentState | None = None,
    ) -> None:
        for unit in units:
            if unit.state == UnitState.DEAD:
                continue

            is_moving = unit.state == UnitState.MOVING
            is_fighting = unit.combat_target_id != -1
            is_routing = unit.state == UnitState.ROUTING
            is_stationary = not is_moving and not is_fighting and not is_routing

            fatigue_gain = 0.0

            if is_fighting:
                fatigue_gain += _fc["FATIGUE_FIGHTING_PER_TICK"]

            if is_moving or is_routing:
                fatigue_gain += _fc["FATIGUE_MARCH_PER_TICK"]
                tx = int(math.floor(unit.x / _TILE_SIZE))
                ty = int(math.floor(unit.y / _TILE_SIZE))
                terrain = self._terrain.get_terrain(tx, ty)
                from env.types import TerrainType
                if terrain == TerrainType.FORD:
                    fatigue_gain += _fc["FATIGUE_FORD_PER_TICK"]
                elif terrain == TerrainType.MOUNTAINS:
                    fatigue_gain += _fc["FATIGUE_MOUNTAIN_PER_TICK"]

            if unit.type == UnitType.SIEGE_ENGINEERS and is_moving:
                fatigue_gain += _fc["FATIGUE_SIEGE_CARRY_PER_TICK"]

            # Starvation fatigue
            if army_food_percents:
                food_pct = army_food_percents.get(unit.team, 100)
                if food_pct <= 0:
                    fatigue_gain += _sc["SUPPLY_STARVATION_FATIGUE_PER_TICK"]

            # Recovery
            if is_stationary:
                fatigue_gain += _fc["FATIGUE_RECOVERY_STATIONARY"]
                if army_food_percents:
                    food_pct = army_food_percents.get(unit.team, 100)
                    if food_pct > _sc["SUPPLY_LOW_RATIONS_THRESHOLD"] * 100:
                        fatigue_gain += _fc["FATIGUE_RECOVERY_WELL_FED_BONUS"]

            # Weather/time multiplier
            if env and fatigue_gain > 0:
                fatigue_mult = 1.0
                if env.weather == WeatherType.SNOW:
                    fatigue_mult *= _wc["SNOW_FATIGUE_MULT"]
                _todm = time_of_day_modifiers()
                tm = _todm.get(str(env.time_of_day))
                if tm:
                    fatigue_mult *= tm["fatigueMult"]
                fatigue_gain *= fatigue_mult

            unit.fatigue = max(0, min(100, unit.fatigue + fatigue_gain))

    @staticmethod
    def get_speed_multiplier(fatigue: float) -> float:
        """Get speed multiplier from fatigue threshold table."""
        for threshold, mult in _SPEED_THRESHOLDS:
            if fatigue >= threshold:
                return mult
        return 1.0
