"""Parity tests — verify Python simulation matches TS within epsilon.

These tests set up identical scenarios and verify key state values match.
Run with: pytest parity/test_parity.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.types import UnitType, UnitState, OrderType, UNIT_TYPE_CONFIGS
from env.game import Game, ArmyConfig
from env.combat import calculate_damage
from env.morale import get_rout_threshold


def test_parity_empty_battlefield():
    """Empty battle (no contact) — supply depletes, time advances, no combat."""
    game = Game(seed=42)
    game.setup_armies([
        ArmyConfig(team=0, units=[
            {"type": UnitType.JI_HALBERDIERS, "x": 100, "y": 100},
        ]),
        ArmyConfig(team=1, units=[
            {"type": UnitType.JI_HALBERDIERS, "x": 3000, "y": 1600},
        ]),
    ])

    for _ in range(100):
        game.tick()

    assert game.tick_number == 100
    assert not game.battle_ended

    # Both units still alive and at full size
    for u in game.units:
        assert u.state != UnitState.DEAD
        assert u.size == UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS].max_size

    # Supply should have decreased (slightly)
    assert game.supply_system.get_food_percent(0) < 100
    assert game.supply_system.get_food_percent(1) < 100


def test_parity_stationary_combat():
    """Two halberdier units right next to each other — combat should happen."""
    game = Game(seed=42)
    game.setup_armies([
        ArmyConfig(team=0, units=[
            {"type": UnitType.JI_HALBERDIERS, "x": 100, "y": 100},
        ]),
        ArmyConfig(team=1, units=[
            {"type": UnitType.JI_HALBERDIERS, "x": 112, "y": 100},
        ]),
    ])

    for _ in range(100):
        game.tick()
        if game.battle_ended:
            break

    # At least one unit should have taken damage
    t0 = game.units[0]
    t1 = game.units[1]
    initial_hp = UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS].max_size * UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS].hp_per_soldier
    assert t0.hp < initial_hp or t1.hp < initial_hp


def test_parity_ranged_engagement():
    """Crossbowmen shooting at stationary target — ranged damage applies."""
    game = Game(seed=42)
    game.setup_armies([
        ArmyConfig(team=0, units=[
            {"type": UnitType.NU_CROSSBOWMEN, "x": 100, "y": 100},
        ]),
        ArmyConfig(team=1, units=[
            {"type": UnitType.JI_HALBERDIERS, "x": 200, "y": 100},
        ]),
    ])

    for _ in range(100):
        game.tick()
        if game.battle_ended:
            break

    # Halberdier should have taken ranged damage
    halberdier = game.units[1]
    initial_hp = UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS].max_size * UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS].hp_per_soldier
    assert halberdier.hp < initial_hp


def test_parity_damage_formula_values():
    """Verify specific damage formula outputs match expected values."""
    from env.types import Unit, TerrainType

    # Full-strength halberdier vs halberdier on plains
    attacker = Unit(
        id=1, type=UnitType.JI_HALBERDIERS, team=0,
        x=100, y=100, size=120, max_size=120,
        hp=120 * 100, morale=70, fatigue=0, experience=50,
    )
    defender = Unit(
        id=2, type=UnitType.JI_HALBERDIERS, team=1,
        x=116, y=100, size=120, max_size=120,
        hp=120 * 100, morale=70, fatigue=0, experience=50,
    )

    result = calculate_damage(attacker, defender, TerrainType.PLAINS, False)

    # Base damage = 8 * (120/120) = 8
    # Type matchup = 1.0
    # Terrain = 1.0 / (1 + 0) = 1.0
    # Armor = 1 - 6/20 = 0.7
    # Fatigue = 1 - 0/200 = 1.0
    # Experience = 1 + (50-50)*0.003 = 1.0
    # Expected: 8 * 1.0 * 1.0 * 0.7 * 1.0 * 1.0 = 5.6
    assert abs(result.final_damage - 5.6) < 0.1
    assert not result.is_ranged
    assert not result.was_charge


def test_parity_rout_thresholds():
    """Verify rout thresholds match the TS implementation."""
    assert get_rout_threshold(0, UnitType.JI_HALBERDIERS) == 25
    assert get_rout_threshold(20, UnitType.JI_HALBERDIERS) == 15
    assert get_rout_threshold(60, UnitType.JI_HALBERDIERS) == 10
    assert get_rout_threshold(80, UnitType.JI_HALBERDIERS) == 5
    assert get_rout_threshold(0, UnitType.ELITE_GUARD) == 5
