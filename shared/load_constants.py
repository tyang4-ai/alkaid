"""Load shared constants from constants.json for the Python training environment."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_CONSTANTS_PATH = Path(__file__).parent / "constants.json"
_cache: dict[str, Any] | None = None


def load_constants() -> dict[str, Any]:
    """Load and cache the shared constants JSON."""
    global _cache
    if _cache is None:
        with open(_CONSTANTS_PATH, "r", encoding="utf-8") as f:
            _cache = json.load(f)
    return _cache


def get(section: str, key: str | None = None) -> Any:
    """Get a constant value. If key is None, returns the entire section."""
    c = load_constants()
    section_data = c[section]
    if key is None:
        return section_data
    return section_data[key]


# Convenience accessors
def sim() -> dict[str, Any]:
    return load_constants()["simulation"]


def sim_cfg() -> dict[str, Any]:
    return load_constants()["simulation"]


def map_cfg() -> dict[str, Any]:
    return load_constants()["map"]


def enums() -> dict[str, Any]:
    return load_constants()["enums"]


def terrain_stats() -> dict[str, Any]:
    return load_constants()["terrainStats"]


def unit_configs() -> dict[str, Any]:
    return load_constants()["unitTypeConfigs"]


def type_matchup_table() -> list[list[float]]:
    return load_constants()["typeMatchupTable"]


def unit_terrain_overrides() -> dict[str, Any]:
    return load_constants()["unitTerrainCostOverrides"]


def combat_cfg() -> dict[str, Any]:
    return load_constants()["combat"]


def command_cfg() -> dict[str, Any]:
    return load_constants()["command"]


def supply_cfg() -> dict[str, Any]:
    return load_constants()["supply"]


def fatigue_cfg() -> dict[str, Any]:
    return load_constants()["fatigue"]


def experience_cfg() -> dict[str, Any]:
    return load_constants()["experience"]


def morale_cfg() -> dict[str, Any]:
    return load_constants()["morale"]


def surrender_cfg() -> dict[str, Any]:
    return load_constants()["surrender"]


def weather_cfg() -> dict[str, Any]:
    return load_constants()["weather"]


def weather_modifiers() -> dict[str, Any]:
    return load_constants()["weatherModifiers"]


def time_of_day_modifiers() -> dict[str, Any]:
    return load_constants()["timeOfDayModifiers"]


def time_of_day_cfg() -> dict[str, Any]:
    return load_constants()["timeOfDay"]


def training_cfg() -> dict[str, Any]:
    return load_constants()["training"]


def pathfinding_cfg() -> dict[str, Any]:
    return load_constants()["pathfinding"]


def terrain_gen_cfg() -> dict[str, Any]:
    return load_constants()["terrainGen"]


def fog_of_war_cfg() -> dict[str, Any]:
    return load_constants()["fogOfWar"]
