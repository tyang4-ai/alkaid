"""Simulation runner — wraps the Python game engine for batch simulations."""

import random
from typing import Optional

from env.game import Game
from env.types import UnitType, OrderType, UNIT_TYPE_CONFIGS

# Map string names to UnitType enum values
UNIT_NAME_MAP = {
    "halberdiers": UnitType.JI_HALBERDIERS,
    "ji_halberdiers": UnitType.JI_HALBERDIERS,
    "swordsmen": UnitType.DAO_SWORDSMEN,
    "dao_swordsmen": UnitType.DAO_SWORDSMEN,
    "crossbowmen": UnitType.NU_CROSSBOWMEN,
    "nu_crossbowmen": UnitType.NU_CROSSBOWMEN,
    "archers": UnitType.GONG_ARCHERS,
    "gong_archers": UnitType.GONG_ARCHERS,
    "light_cavalry": UnitType.LIGHT_CAVALRY,
    "heavy_cavalry": UnitType.HEAVY_CAVALRY,
    "horse_archers": UnitType.HORSE_ARCHERS,
    "siege_engineers": UnitType.SIEGE_ENGINEERS,
    "elite_guard": UnitType.ELITE_GUARD,
    "scouts": UnitType.SCOUTS,
}


def _parse_army(army_spec: list[dict]) -> list[int]:
    """Convert army spec [{type: "halberdiers", count: 3}, ...] to list of UnitType ints."""
    units = []
    for entry in army_spec:
        utype = entry.get("type", 0)
        if isinstance(utype, str):
            utype = UNIT_NAME_MAP.get(utype.lower(), UnitType.JI_HALBERDIERS)
        count = entry.get("count", 1)
        units.extend([utype] * count)
    return units


def run_batch_simulation(
    army_a: list[dict],
    army_b: list[dict],
    terrain_template: str = "open_plains",
    iterations: int = 10,
    seed: Optional[int] = None,
) -> dict:
    """Run multiple headless battles and return aggregate results."""
    parsed_a = _parse_army(army_a)
    parsed_b = _parse_army(army_b)

    results = {
        "iterations": iterations,
        "team_a_wins": 0,
        "team_b_wins": 0,
        "draws": 0,
        "avg_ticks": 0,
        "avg_casualties_a": 0.0,
        "avg_casualties_b": 0.0,
        "victory_types": {},
    }

    total_ticks = 0
    total_cas_a = 0.0
    total_cas_b = 0.0

    base_seed = seed if seed is not None else random.randint(0, 2**31)

    for i in range(iterations):
        game = Game(seed=base_seed + i, terrain_template=terrain_template)
        game.setup_armies(parsed_a, parsed_b)

        # Run until battle ends (max 6000 ticks)
        while not game.battle_ended and game.tick_number < 6000:
            game.tick()

        total_ticks += game.tick_number

        # Count casualties
        start_a = sum(u.max_size for u in game.units if u.team == 0)
        start_b = sum(u.max_size for u in game.units if u.team == 1)
        current_a = sum(u.size for u in game.units if u.team == 0 and u.state != 5)
        current_b = sum(u.size for u in game.units if u.team == 1 and u.state != 5)

        if start_a > 0:
            total_cas_a += (start_a - current_a) / start_a * 100
        if start_b > 0:
            total_cas_b += (start_b - current_b) / start_b * 100

        # Determine winner
        if game.battle_result:
            winner = game.battle_result.winner_team
            if winner == 0:
                results["team_a_wins"] += 1
            elif winner == 1:
                results["team_b_wins"] += 1
            else:
                results["draws"] += 1

            vtype = str(game.battle_result.victory_type)
            results["victory_types"][vtype] = results["victory_types"].get(vtype, 0) + 1
        else:
            results["draws"] += 1

    results["avg_ticks"] = total_ticks / max(1, iterations)
    results["avg_casualties_a"] = round(total_cas_a / max(1, iterations), 1)
    results["avg_casualties_b"] = round(total_cas_b / max(1, iterations), 1)
    results["team_a_winrate"] = round(results["team_a_wins"] / max(1, iterations) * 100, 1)
    results["team_b_winrate"] = round(results["team_b_wins"] / max(1, iterations) * 100, 1)

    return results
