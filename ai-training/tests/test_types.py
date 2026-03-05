"""Test core data structures and type helpers."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.types import (
    TerrainType, UnitType, UnitCategory, UnitState, OrderType,
    WeatherType, TimeOfDay, VictoryType,
    Unit, Order, EnvironmentState, BattleResult,
    UNIT_TYPE_CONFIGS, TERRAIN_STATS, TYPE_MATCHUP_TABLE,
    get_move_cost, get_type_matchup, is_ranged_unit, can_fire_while_moving,
)


def test_terrain_type_enum():
    assert TerrainType.WATER == 0
    assert TerrainType.CITY == 9
    assert len(TerrainType) == 10


def test_unit_type_enum():
    assert UnitType.JI_HALBERDIERS == 0
    assert UnitType.GENERAL == 13
    assert len(UnitType) == 14


def test_unit_state_enum():
    assert UnitState.IDLE == 0
    assert UnitState.DEAD == 5


def test_order_type_enum():
    assert OrderType.MOVE == 0
    assert OrderType.RALLY == 8
    assert len(OrderType) == 9


def test_unit_type_configs_loaded():
    assert len(UNIT_TYPE_CONFIGS) == 14
    ji = UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS]
    assert ji.max_size == 120
    assert ji.hp_per_soldier == 100
    assert ji.damage == 8
    assert ji.speed == 1.0

    gen = UNIT_TYPE_CONFIGS[UnitType.GENERAL]
    assert gen.max_size == 1
    assert gen.hp_per_soldier == 200


def test_terrain_stats_loaded():
    assert len(TERRAIN_STATS) == 10
    plains = TERRAIN_STATS[TerrainType.PLAINS]
    assert plains.move_cost == 1.0
    assert plains.def_bonus == 0.0
    water = TERRAIN_STATS[TerrainType.WATER]
    assert water.move_cost == -1


def test_type_matchup_table():
    assert len(TYPE_MATCHUP_TABLE) == 10
    assert len(TYPE_MATCHUP_TABLE[0]) == 10
    # Halberdier vs Heavy Cavalry = 1.5
    assert TYPE_MATCHUP_TABLE[0][5] == 1.5


def test_get_type_matchup():
    # Normal land units
    assert get_type_matchup(0, 5) == 1.5
    # General attacking = 0.5
    assert get_type_matchup(UnitType.GENERAL, 0) == 0.5
    # General defending = 1.0
    assert get_type_matchup(0, UnitType.GENERAL) == 1.0
    # Naval = default 1.0
    assert get_type_matchup(10, 11) == 1.0


def test_get_move_cost():
    # Default plains
    assert get_move_cost(UnitType.JI_HALBERDIERS, TerrainType.PLAINS) == 1.0
    # Cavalry override: mountains impassable
    assert get_move_cost(UnitType.LIGHT_CAVALRY, TerrainType.MOUNTAINS) == -1
    # Dao Swordsmen: forest = 1.0 (override from default 1.8)
    assert get_move_cost(UnitType.DAO_SWORDSMEN, TerrainType.FOREST) == 1.0
    # Naval on water = 1.0
    assert get_move_cost(UnitType.MENG_CHONG, TerrainType.WATER) == 1.0
    # Naval on plains = -1
    assert get_move_cost(UnitType.MENG_CHONG, TerrainType.PLAINS) == -1


def test_is_ranged_unit():
    assert is_ranged_unit(UnitType.NU_CROSSBOWMEN)
    assert is_ranged_unit(UnitType.GONG_ARCHERS)
    assert is_ranged_unit(UnitType.HORSE_ARCHERS)
    assert is_ranged_unit(UnitType.SIEGE_ENGINEERS)
    assert not is_ranged_unit(UnitType.JI_HALBERDIERS)
    assert not is_ranged_unit(UnitType.LIGHT_CAVALRY)


def test_can_fire_while_moving():
    assert can_fire_while_moving(UnitType.HORSE_ARCHERS)
    assert can_fire_while_moving(UnitType.GONG_ARCHERS)
    assert not can_fire_while_moving(UnitType.NU_CROSSBOWMEN)
    assert not can_fire_while_moving(UnitType.SIEGE_ENGINEERS)


def test_unit_dataclass():
    u = Unit(id=1, type=UnitType.JI_HALBERDIERS, team=0, x=100.0, y=200.0)
    assert u.id == 1
    assert u.morale == 70.0
    assert u.fatigue == 0.0
    assert u.combat_target_id == -1
    assert u.state == UnitState.IDLE


def test_order_dataclass():
    o = Order(type=OrderType.MOVE, unit_id=1, target_x=50.0, target_y=60.0)
    assert o.type == OrderType.MOVE
    assert o.target_x == 50.0


def test_environment_state():
    env = EnvironmentState()
    assert env.weather == WeatherType.CLEAR
    assert env.time_of_day == TimeOfDay.MORNING
