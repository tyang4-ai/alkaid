"""Observation builder — constructs flat float32 observation from game state.

Layout: [own_units(32*40), enemy_units(32*40), global(22)] = 2582 features
All values normalized to [0, 1] range.
"""
from __future__ import annotations

import numpy as np

from shared.load_constants import training_cfg, map_cfg
from env.types import (
    Unit, UnitType, UnitState, OrderType, EnvironmentState,
    UNIT_TYPE_CONFIGS,
)
from env.game import Game

_tc = training_cfg()
_map = map_cfg()

MAX_UNITS = _tc["MAX_UNITS_PER_TEAM"]  # 32
UNIT_FEATURES = _tc["UNIT_FEATURES"]  # 40
GLOBAL_FEATURES = _tc["GLOBAL_FEATURES"]  # 22
OBS_SIZE = MAX_UNITS * UNIT_FEATURES * 2 + GLOBAL_FEATURES  # 2582

_TILE_SIZE = _map["TILE_SIZE"]
_MAP_W = _map["DEFAULT_MAP_WIDTH"]
_MAP_H = int(_MAP_W * 0.75)
_MAP_W_PX = _MAP_W * _TILE_SIZE
_MAP_H_PX = _MAP_H * _TILE_SIZE

# Number of unit types and order types for one-hot
_NUM_UNIT_TYPES = 14
_NUM_STATES = 6
_NUM_ORDERS = 9


def build_observation(game: Game, team: int) -> np.ndarray:
    """Build flat observation array for the given team."""
    obs = np.zeros(OBS_SIZE, dtype=np.float32)

    own_units = [u for u in game.units if u.team == team and u.state != UnitState.DEAD]
    enemy_units = [u for u in game.units if u.team != team and u.state != UnitState.DEAD]

    # Sort by unit id for consistency
    own_units.sort(key=lambda u: u.id)
    enemy_units.sort(key=lambda u: u.id)

    # Fill own units (first 32 slots)
    offset = 0
    for i in range(MAX_UNITS):
        if i < len(own_units):
            _encode_unit(obs, offset, own_units[i], game)
        offset += UNIT_FEATURES

    # Fill enemy units (next 32 slots)
    for i in range(MAX_UNITS):
        if i < len(enemy_units):
            _encode_unit(obs, offset, enemy_units[i], game)
        offset += UNIT_FEATURES

    # Global features (22)
    _encode_global(obs, offset, game, team)

    return obs


def _encode_unit(obs: np.ndarray, offset: int, unit: Unit, game: Game) -> None:
    """Encode a single unit into 40 features at the given offset."""
    idx = 0

    # Position (2)
    obs[offset + idx] = unit.x / _MAP_W_PX
    idx += 1
    obs[offset + idx] = unit.y / _MAP_H_PX
    idx += 1

    # Size ratio (1)
    obs[offset + idx] = unit.size / unit.max_size if unit.max_size > 0 else 0
    idx += 1

    # HP ratio (1)
    max_hp = unit.max_size * UNIT_TYPE_CONFIGS[unit.type].hp_per_soldier
    obs[offset + idx] = unit.hp / max_hp if max_hp > 0 else 0
    idx += 1

    # Morale (1)
    obs[offset + idx] = unit.morale / 100.0
    idx += 1

    # Fatigue (1)
    obs[offset + idx] = unit.fatigue / 100.0
    idx += 1

    # Experience (1)
    obs[offset + idx] = unit.experience / 100.0
    idx += 1

    # Supply (1)
    obs[offset + idx] = unit.supply / 100.0
    idx += 1

    # Unit type one-hot (14)
    if 0 <= unit.type < _NUM_UNIT_TYPES:
        obs[offset + idx + unit.type] = 1.0
    idx += _NUM_UNIT_TYPES

    # State one-hot (6)
    if 0 <= unit.state < _NUM_STATES:
        obs[offset + idx + unit.state] = 1.0
    idx += _NUM_STATES

    # Is general (1)
    obs[offset + idx] = 1.0 if unit.is_general else 0.0
    idx += 1

    # Has charged (1)
    obs[offset + idx] = 1.0 if unit.has_charged else 0.0
    idx += 1

    # Combat target exists (1)
    obs[offset + idx] = 1.0 if unit.combat_target_id != -1 else 0.0
    idx += 1

    # Facing (1) - normalized to [0, 1]
    obs[offset + idx] = (unit.facing + 3.14159) / (2 * 3.14159)
    idx += 1

    # Speed (1) - normalized
    cfg = UNIT_TYPE_CONFIGS[unit.type]
    obs[offset + idx] = cfg.speed / 3.0  # Max speed ~2.5
    idx += 1

    # Range (1) - normalized
    obs[offset + idx] = cfg.range / 10.0  # Max range 10
    idx += 1

    # Current order one-hot (9) - uses order_modifier if set
    order = game.orders.get(unit.id)
    if order is not None and 0 <= order < _NUM_ORDERS:
        obs[offset + idx + order] = 1.0
    idx += _NUM_ORDERS

    # Total: 2+1+1+1+1+1+1+14+6+1+1+1+1+1+1+9 = 43... trim to 40
    # Actually let's count: 2+1+1+1+1+1+1 = 8, +14 = 22, +6 = 28, +1+1+1+1+1+1 = 34, +6 = 40
    # We need exactly 40 features. Let me recount:
    # pos_x, pos_y = 2
    # size_ratio = 1
    # hp_ratio = 1
    # morale = 1
    # fatigue = 1
    # experience = 1
    # supply = 1  -> subtotal 8
    # unit_type_onehot = 14 -> subtotal 22
    # state_onehot = 6 -> subtotal 28
    # is_general = 1 -> 29
    # has_charged = 1 -> 30
    # combat_target = 1 -> 31
    # facing = 1 -> 32
    # speed = 1 -> 33
    # range = 1 -> 34
    # order_onehot = 6 -> 40 (use 6 most important orders instead of 9)
    # Hmm, let's just use what fits. We have 40 features spec'd.
    # 8 + 14 + 6 + 6 + 6 = 40 works if we pack the scalars differently.
    # Let me just use the actual count. If >40, we truncate; if <40, pad.
    # idx is currently at 34 + 9 = 43. That's 3 over.
    # Fix: reduce order one-hot or unit-type one-hot.
    # Better approach: use fewer unit types (top 10 land units) or fewer order types.
    # Simplest fix: 40 is the budget. Let's redefine to fit.


def _encode_unit_v2(obs: np.ndarray, offset: int, unit: Unit, game: Game) -> None:
    """Encode unit into exactly 40 features."""
    i = offset

    # Continuous features (10)
    obs[i] = unit.x / _MAP_W_PX; i += 1
    obs[i] = unit.y / _MAP_H_PX; i += 1
    obs[i] = unit.size / unit.max_size if unit.max_size > 0 else 0; i += 1
    max_hp = unit.max_size * UNIT_TYPE_CONFIGS[unit.type].hp_per_soldier
    obs[i] = unit.hp / max_hp if max_hp > 0 else 0; i += 1
    obs[i] = unit.morale / 100.0; i += 1
    obs[i] = unit.fatigue / 100.0; i += 1
    obs[i] = unit.experience / 100.0; i += 1
    obs[i] = unit.supply / 100.0; i += 1
    obs[i] = (unit.facing + 3.14159) / (2 * 3.14159); i += 1
    obs[i] = UNIT_TYPE_CONFIGS[unit.type].speed / 3.0; i += 1

    # Unit type one-hot (14)
    if 0 <= unit.type < 14:
        obs[i + unit.type] = 1.0
    i += 14

    # State one-hot (6)
    if 0 <= unit.state < 6:
        obs[i + unit.state] = 1.0
    i += 6

    # Binary flags (3)
    obs[i] = 1.0 if unit.is_general else 0.0; i += 1
    obs[i] = 1.0 if unit.has_charged else 0.0; i += 1
    obs[i] = 1.0 if unit.combat_target_id != -1 else 0.0; i += 1

    # Order type (embedded as single normalized value instead of one-hot to save space) (1)
    order = game.orders.get(unit.id)
    obs[i] = (order / 8.0) if order is not None else 0.0; i += 1

    # Remaining: 10+14+6+3+1 = 34. Need 6 more.
    # Additional useful features:
    obs[i] = UNIT_TYPE_CONFIGS[unit.type].range / 10.0; i += 1  # 35
    obs[i] = UNIT_TYPE_CONFIGS[unit.type].armor / 10.0; i += 1  # 36
    obs[i] = UNIT_TYPE_CONFIGS[unit.type].damage / 25.0; i += 1  # 37
    obs[i] = unit.combat_ticks / 100.0; i += 1  # 38
    obs[i] = unit.kill_count / 50.0; i += 1  # 39
    obs[i] = unit.rout_ticks / 30.0; i += 1  # 40


# Replace _encode_unit with _encode_unit_v2
_encode_unit = _encode_unit_v2  # type: ignore


def _encode_global(obs: np.ndarray, offset: int, game: Game, team: int) -> None:
    """Encode 22 global features."""
    i = offset
    enemy_team = 1 - team

    # General alive (2)
    own_general = any(u.is_general and u.team == team and u.state != UnitState.DEAD for u in game.units)
    enemy_general = any(u.is_general and u.team == enemy_team and u.state != UnitState.DEAD for u in game.units)
    obs[i] = 1.0 if own_general else 0.0; i += 1
    obs[i] = 1.0 if enemy_general else 0.0; i += 1

    # Supply percentages (2)
    obs[i] = game.supply_system.get_food_percent(team) / 100.0; i += 1
    obs[i] = game.supply_system.get_food_percent(enemy_team) / 100.0; i += 1

    # Weather one-hot (5)
    w = game.env_state.weather
    if 0 <= w < 5:
        obs[i + w] = 1.0
    i += 5

    # Time of day one-hot (6)
    tod = game.env_state.time_of_day
    if 0 <= tod < 6:
        obs[i + tod] = 1.0
    i += 6

    # Casualties (2)
    own_cas = game.team_casualties.get(team, 0)
    enemy_cas = game.team_casualties.get(enemy_team, 0)
    # Normalize by starting army size (rough estimate)
    total_start = sum(u.max_size for u in game.units if u.team == team)
    enemy_start = sum(u.max_size for u in game.units if u.team == enemy_team)
    obs[i] = own_cas / max(total_start, 1); i += 1
    obs[i] = enemy_cas / max(enemy_start, 1); i += 1

    # Squads routed (2)
    own_total = max(1, len([u for u in game.units if u.team == team]))
    enemy_total = max(1, len([u for u in game.units if u.team == enemy_team]))
    obs[i] = game.team_squads_routed.get(team, 0) / own_total; i += 1
    obs[i] = game.team_squads_routed.get(enemy_team, 0) / enemy_total; i += 1

    # Surrender pressure (2)
    obs[i] = game.surrender_system.get_pressure(team) / 100.0; i += 1
    obs[i] = game.surrender_system.get_pressure(enemy_team) / 100.0; i += 1

    # Tick progress (1)
    obs[i] = game.tick_number / _tc["MAX_TICKS"]; i += 1

    # Total: 2+2+5+6+2+2+2+1 = 22
