"""SupplySystem — port of SupplySystem.ts."""
from __future__ import annotations

import math

from shared.load_constants import supply_cfg, map_cfg, time_of_day_modifiers
from env.types import Unit, UnitState, EnvironmentState, TERRAIN_STATS
from env.terrain import TerrainGrid

_sc = supply_cfg()
_TILE_SIZE = map_cfg()["TILE_SIZE"]


class ArmySupply:
    __slots__ = ("food", "max_food", "starvation_ticks")

    def __init__(self, food: float = 6000, max_food: float = 6000) -> None:
        self.food = food
        self.max_food = max_food
        self.starvation_ticks = 0


class SupplySystem:
    """Tracks army food, consumption, foraging, starvation, desertion."""

    def __init__(self, terrain_grid: TerrainGrid) -> None:
        self._terrain = terrain_grid
        self._armies: dict[int, ArmySupply] = {}

    def init_army(
        self,
        team: int,
        starting_food: float | None = None,
        max_food: float | None = None,
    ) -> None:
        f = starting_food if starting_food is not None else _sc["SUPPLY_BASE_CAPACITY"]
        m = max_food if max_food is not None else _sc["SUPPLY_BASE_CAPACITY"]
        self._armies[team] = ArmySupply(food=f, max_food=m)

    def get_food_percent(self, team: int) -> float:
        army = self._armies.get(team)
        if not army or army.max_food <= 0:
            return 100
        return (army.food / army.max_food) * 100

    def get_all_food_percents(self) -> dict[int, float]:
        return {t: self.get_food_percent(t) for t in self._armies}

    def tick(
        self,
        units: list[Unit],
        env: EnvironmentState | None = None,
    ) -> list[dict]:
        events: list[dict] = []

        # Group units by team
        team_units: dict[int, list[Unit]] = {}
        for u in units:
            if u.state == UnitState.DEAD:
                continue
            team_units.setdefault(u.team, []).append(u)

        for team, army in self._armies.items():
            team_list = team_units.get(team, [])

            # Consumption
            total_consumption = sum(
                u.size * _sc["SUPPLY_CONSUMPTION_PER_SOLDIER_PER_TICK"]
                for u in team_list
            )
            if env:
                _todm = time_of_day_modifiers()
                tm = _todm.get(str(env.time_of_day))
                if tm:
                    total_consumption *= tm["supplyMult"]

            # Foraging
            total_foraging = 0.0
            for u in team_list:
                tx = int(math.floor(u.x / _TILE_SIZE))
                ty = int(math.floor(u.y / _TILE_SIZE))
                terrain = self._terrain.get_terrain(tx, ty)
                stats = TERRAIN_STATS.get(terrain)
                if stats:
                    total_foraging += stats.forage_rate

            # Update food
            army.food = max(0.0, min(army.max_food, army.food - total_consumption + total_foraging))

            food_pct = (army.food / army.max_food * 100) if army.max_food > 0 else 0

            # Starvation tracking
            if food_pct <= 0:
                army.starvation_ticks += 1
            else:
                army.starvation_ticks = 0

            # Desertion
            for u in team_list:
                if u.state == UnitState.ROUTING:
                    continue
                desertion_rate = 0.0
                if food_pct <= 0:
                    desertion_rate = _sc["SUPPLY_STARVATION_DESERTION_PER_TICK"]
                elif food_pct <= _sc["SUPPLY_HUNGER_THRESHOLD"] * 100:
                    desertion_rate = _sc["SUPPLY_HUNGER_DESERTION_PER_TICK"]

                if desertion_rate > 0:
                    u.desertion_frac += desertion_rate
                    while u.desertion_frac >= 1.0 and u.size > 1:
                        u.size -= 1
                        u.hp = u.size * UNIT_TYPE_CONFIGS_HP.get(u.type, 100)
                        u.desertion_frac -= 1.0
                        events.append({
                            "type": "supply:desertion",
                            "unit_id": u.id,
                            "team": team,
                        })

            # Collapse event
            if army.starvation_ticks >= _sc["SUPPLY_COLLAPSE_TICKS"]:
                events.append({"type": "supply:collapse", "team": team})

            # Sync supply to units
            for u in team_list:
                u.supply = food_pct

        return events

    @staticmethod
    def get_speed_multiplier(food_percent: float) -> float:
        if food_percent <= 0:
            return _sc["SUPPLY_STARVATION_SPEED_MULT"]
        if food_percent <= _sc["SUPPLY_HUNGER_THRESHOLD"] * 100:
            return _sc["SUPPLY_HUNGER_SPEED_MULT"]
        if food_percent <= _sc["SUPPLY_LOW_RATIONS_THRESHOLD"] * 100:
            return _sc["SUPPLY_LOW_RATIONS_SPEED_MULT"]
        return 1.0

    @staticmethod
    def get_combat_multiplier(food_percent: float) -> float:
        if food_percent <= 0:
            return _sc["SUPPLY_STARVATION_COMBAT_MULT"]
        if food_percent <= _sc["SUPPLY_HUNGER_THRESHOLD"] * 100:
            return _sc["SUPPLY_HUNGER_COMBAT_MULT"]
        return 1.0


# Quick HP lookup for desertion
from env.types import UNIT_TYPE_CONFIGS as _UTC
UNIT_TYPE_CONFIGS_HP: dict[int, int] = {k: v.hp_per_soldier for k, v in _UTC.items()}
