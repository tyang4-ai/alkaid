"""Core data structures and enums for the Alkaid Python simulation."""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from enum import IntEnum
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from shared.load_constants import enums, unit_configs, terrain_stats, load_constants

_e = enums()


# --- Enums ---

class TerrainType(IntEnum):
    WATER = 0
    FORD = 1
    PLAINS = 2
    FOREST = 3
    HILLS = 4
    MOUNTAINS = 5
    RIVER = 6
    MARSH = 7
    ROAD = 8
    CITY = 9


class UnitType(IntEnum):
    JI_HALBERDIERS = 0
    DAO_SWORDSMEN = 1
    NU_CROSSBOWMEN = 2
    GONG_ARCHERS = 3
    LIGHT_CAVALRY = 4
    HEAVY_CAVALRY = 5
    HORSE_ARCHERS = 6
    SIEGE_ENGINEERS = 7
    ELITE_GUARD = 8
    SCOUTS = 9
    MENG_CHONG = 10
    LOU_CHUAN = 11
    FIRE_SHIPS = 12
    GENERAL = 13


class UnitCategory(IntEnum):
    INFANTRY = 0
    RANGED = 1
    CAVALRY = 2
    SIEGE = 3
    NAVAL = 4


class UnitState(IntEnum):
    IDLE = 0
    MOVING = 1
    ATTACKING = 2
    DEFENDING = 3
    ROUTING = 4
    DEAD = 5


class OrderType(IntEnum):
    MOVE = 0
    ATTACK = 1
    HOLD = 2
    RETREAT = 3
    FLANK = 4
    CHARGE = 5
    FORM_UP = 6
    DISENGAGE = 7
    RALLY = 8


class WeatherType(IntEnum):
    CLEAR = 0
    RAIN = 1
    FOG = 2
    WIND = 3
    SNOW = 4


class TimeOfDay(IntEnum):
    DAWN = 0
    MORNING = 1
    MIDDAY = 2
    AFTERNOON = 3
    DUSK = 4
    NIGHT = 5


class VictoryType(IntEnum):
    SURRENDER = 0
    ANNIHILATION = 1
    GENERAL_KILLED = 2
    STARVATION = 3
    RETREAT = 4
    STALEMATE = 5


# --- Data classes ---

@dataclass
class UnitTypeConfig:
    """Static config for a unit type, loaded from shared constants."""
    type_id: int
    category: int
    max_size: int
    hp_per_soldier: int
    damage: int
    attack_speed: float
    range: int
    armor: int
    armor_pen: int
    speed: float
    cost: int


# Build config lookup from shared constants
_unit_cfgs = unit_configs()
UNIT_TYPE_CONFIGS: dict[int, UnitTypeConfig] = {}
for _k, _v in _unit_cfgs.items():
    _tid = int(_k)
    UNIT_TYPE_CONFIGS[_tid] = UnitTypeConfig(
        type_id=_tid,
        category=_v["category"],
        max_size=_v["maxSize"],
        hp_per_soldier=_v["hpPerSoldier"],
        damage=_v["damage"],
        attack_speed=_v["attackSpeed"],
        range=_v["range"],
        armor=_v["armor"],
        armor_pen=_v["armorPen"],
        speed=_v["speed"],
        cost=_v["cost"],
    )


@dataclass
class TerrainStats:
    move_cost: float
    def_bonus: float
    cav_effect: float
    forage_rate: float


_ts = terrain_stats()
TERRAIN_STATS: dict[int, TerrainStats] = {}
for _k, _v in _ts.items():
    TERRAIN_STATS[int(_k)] = TerrainStats(
        move_cost=_v["moveCost"],
        def_bonus=_v["defBonus"],
        cav_effect=_v["cavEffect"],
        forage_rate=_v["forageRate"],
    )


# Type matchup table and helpers
_c = load_constants()
TYPE_MATCHUP_TABLE: list[list[float]] = _c["typeMatchupTable"]
RANGED_UNIT_TYPES: set[int] = set(_c["rangedUnitTypes"])
FIRE_WHILE_MOVING_TYPES: set[int] = set(_c["fireWhileMovingTypes"])

# Unit terrain cost overrides: dict[unit_type, dict[terrain_type, cost]]
UNIT_TERRAIN_COST_OVERRIDES: dict[int, dict[int, float]] = {}
for _uk, _uv in _c["unitTerrainCostOverrides"].items():
    UNIT_TERRAIN_COST_OVERRIDES[int(_uk)] = {int(tk): tv for tk, tv in _uv.items()}


def get_move_cost(unit_type: int, terrain_type: int) -> float:
    """Get effective move cost. Returns -1 if impassable."""
    overrides = UNIT_TERRAIN_COST_OVERRIDES.get(unit_type)
    if overrides is not None and terrain_type in overrides:
        return overrides[terrain_type]
    return TERRAIN_STATS[terrain_type].move_cost


def get_type_matchup(attacker: int, defender: int) -> float:
    """Get type matchup multiplier."""
    if attacker == UnitType.GENERAL:
        return 0.5
    if defender == UnitType.GENERAL:
        return 1.0
    if attacker > 9 or defender > 9:
        return 1.0
    return TYPE_MATCHUP_TABLE[attacker][defender]


def is_ranged_unit(unit_type: int) -> bool:
    return unit_type in RANGED_UNIT_TYPES


def can_fire_while_moving(unit_type: int) -> bool:
    return unit_type in FIRE_WHILE_MOVING_TYPES


@dataclass
class Unit:
    """Mutable unit data — mirrors the TS Unit interface."""
    id: int
    type: int
    team: int

    # Position
    x: float
    y: float
    prev_x: float = 0.0
    prev_y: float = 0.0
    facing: float = 0.0

    # Pathfinding
    path: list[tuple[float, float]] | None = None
    path_index: int = 0
    target_x: float = 0.0
    target_y: float = 0.0

    # Squad
    size: int = 0
    max_size: int = 0
    hp: float = 0.0

    # Stats (0-100)
    morale: float = 70.0
    fatigue: float = 0.0
    supply: float = 100.0
    experience: float = 0.0

    # State
    state: int = 0  # UnitState

    # Command
    is_general: bool = False
    pending_order_type: int | None = None
    pending_order_tick: int = 0

    # Combat
    attack_cooldown: int = 0
    last_attack_tick: int = 0
    has_charged: bool = False
    combat_target_id: int = -1
    combat_ticks: int = 0
    siege_setup_ticks: int = 0

    # Order effects
    form_up_ticks: int = 0
    disengage_ticks: int = 0
    order_modifier: int | None = None
    rout_ticks: int = 0

    # Metrics
    kill_count: int = 0
    hold_under_bombardment_ticks: int = 0
    desertion_frac: float = 0.0


@dataclass
class Order:
    """An order for a unit."""
    type: int  # OrderType
    unit_id: int
    target_x: float | None = None
    target_y: float | None = None


@dataclass
class EnvironmentState:
    """Shared weather/time state."""
    weather: int = 0  # WeatherType
    wind_direction: int = 0  # 0-7
    time_of_day: int = 1  # TimeOfDay (default MORNING)
    current_tick: int = 0
    battle_start_time: int = 1  # TimeOfDay


@dataclass
class BattleResult:
    """Result of a completed battle."""
    winner_team: int
    victory_type: int  # VictoryType
    ticks_elapsed: int = 0
    team0_casualties: int = 0
    team1_casualties: int = 0
