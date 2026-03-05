"""Test that shared constants load correctly and contain expected values."""
import sys
from pathlib import Path

# Ensure shared/ is importable
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from shared.load_constants import (
    load_constants,
    sim,
    map_cfg,
    enums,
    terrain_stats,
    unit_configs,
    type_matchup_table,
    combat_cfg,
    supply_cfg,
    fatigue_cfg,
    experience_cfg,
    morale_cfg,
    surrender_cfg,
    weather_cfg,
    weather_modifiers,
    time_of_day_modifiers,
    training_cfg,
    pathfinding_cfg,
)


def test_load_constants_returns_dict():
    c = load_constants()
    assert isinstance(c, dict)
    assert len(c) > 10


def test_simulation_timing():
    s = sim()
    assert s["SIM_TICK_RATE"] == 20
    assert s["SIM_TICK_INTERVAL_MS"] == 50


def test_map_defaults():
    m = map_cfg()
    assert m["DEFAULT_MAP_WIDTH"] == 200
    assert m["DEFAULT_MAP_HEIGHT"] == 150
    assert m["TILE_SIZE"] == 16


def test_enums_complete():
    e = enums()
    # TerrainType: 10 types (0-9)
    assert len(e["TerrainType"]) == 10
    assert e["TerrainType"]["WATER"] == 0
    assert e["TerrainType"]["CITY"] == 9

    # UnitType: 14 types (0-13)
    assert len(e["UnitType"]) == 14
    assert e["UnitType"]["JI_HALBERDIERS"] == 0
    assert e["UnitType"]["GENERAL"] == 13

    # UnitState: 6 states
    assert len(e["UnitState"]) == 6

    # OrderType: 9 orders
    assert len(e["OrderType"]) == 9

    # WeatherType: 5 types
    assert len(e["WeatherType"]) == 5

    # TimeOfDay: 6 phases
    assert len(e["TimeOfDay"]) == 6

    # VictoryType: 6 types
    assert len(e["VictoryType"]) == 6


def test_terrain_stats():
    ts = terrain_stats()
    # 10 terrain types
    assert len(ts) == 10
    # Plains: moveCost 1.0, defBonus 0.0
    plains = ts["2"]
    assert plains["moveCost"] == 1.0
    assert plains["defBonus"] == 0.0
    assert plains["forageRate"] == 1.0
    # Water: impassable
    assert ts["0"]["moveCost"] == -1


def test_unit_type_configs():
    configs = unit_configs()
    # 14 unit types
    assert len(configs) == 14
    # Ji Halberdiers
    ji = configs["0"]
    assert ji["maxSize"] == 120
    assert ji["hpPerSoldier"] == 100
    assert ji["damage"] == 8
    assert ji["speed"] == 1.0
    # General
    gen = configs["13"]
    assert gen["maxSize"] == 1
    assert gen["hpPerSoldier"] == 200


def test_type_matchup_table():
    table = type_matchup_table()
    assert len(table) == 10  # 10x10
    assert len(table[0]) == 10
    # Halberdier vs Heavy Cavalry = 1.5
    assert table[0][5] == 1.5
    # Heavy Cavalry vs Siege = 2.5
    assert table[5][7] == 2.5


def test_combat_constants():
    c = combat_cfg()
    assert c["CAVALRY_CHARGE_BONUS_LIGHT"] == 2.0
    assert c["CAVALRY_CHARGE_BONUS_HEAVY"] == 2.5
    assert c["DAO_SHIELD_ARROW_REDUCTION"] == 0.30
    assert c["ROUT_SPEED_MULTIPLIER"] == 1.5


def test_supply_constants():
    s = supply_cfg()
    assert s["SUPPLY_BASE_CAPACITY"] == 6000
    assert s["SUPPLY_CONSUMPTION_PER_SOLDIER_PER_TICK"] == 0.01
    assert s["SUPPLY_LOW_RATIONS_THRESHOLD"] == 0.50
    assert s["SUPPLY_HUNGER_THRESHOLD"] == 0.25


def test_fatigue_constants():
    f = fatigue_cfg()
    assert f["FATIGUE_FIGHTING_PER_TICK"] == 3
    thresholds = f["FATIGUE_SPEED_THRESHOLDS"]
    assert len(thresholds) == 5
    assert thresholds[0] == [100, 0.30]


def test_experience_constants():
    e = experience_cfg()
    assert e["EXP_KILL_THRESHOLD"] == 10
    assert e["EXP_ROUTE_ENEMY"] == 3


def test_morale_constants():
    m = morale_cfg()
    assert m["MORALE_GENERAL_KILLED_HIT"] == -30
    assert m["MORALE_ARMY_ROUT_50_PERCENT"] == -40


def test_surrender_constants():
    s = surrender_cfg()
    assert s["SURRENDER_PRESSURE_THRESHOLD"] == 80
    assert s["SURRENDER_CONSECUTIVE_CHECKS"] == 5
    # Weights sum to 1.0
    total = (
        s["SURRENDER_WEIGHT_MORALE"]
        + s["SURRENDER_WEIGHT_CASUALTY"]
        + s["SURRENDER_WEIGHT_SUPPLY"]
        + s["SURRENDER_WEIGHT_ENCIRCLEMENT"]
        + s["SURRENDER_WEIGHT_LEADERSHIP"]
    )
    assert abs(total - 1.0) < 1e-9


def test_weather_constants():
    w = weather_cfg()
    assert w["WEATHER_SHIFT_INTERVAL_TICKS"] == 200
    assert w["WEATHER_SHIFT_CHANCE"] == 0.20
    probs = w["WEATHER_PROBABILITIES"]
    assert len(probs) == 5
    assert abs(sum(probs) - 1.0) < 1e-9


def test_weather_modifiers():
    wm = weather_modifiers()
    assert len(wm) == 5
    # Rain reduces ranged
    assert wm["1"]["rangedMult"] == 0.80
    assert wm["1"]["crossbowMult"] == 0.60


def test_time_of_day_modifiers():
    todm = time_of_day_modifiers()
    assert len(todm) == 6
    # Midday fatigue multiplier
    assert todm["2"]["fatigueMult"] == 1.20
    assert todm["2"]["supplyMult"] == 1.30


def test_training_config():
    t = training_cfg()
    assert t["MAX_UNITS_PER_TEAM"] == 32
    assert t["DECISION_INTERVAL_TICKS"] == 20
    assert t["MAX_EPISODE_STEPS"] == 300


def test_pathfinding_constants():
    p = pathfinding_cfg()
    assert p["SPATIAL_HASH_CELL_SIZE"] == 64
    assert p["PATH_ARRIVAL_THRESHOLD"] == 4
