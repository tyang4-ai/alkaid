"""Test SupplySystem."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.types import Unit, UnitType, UnitState, UNIT_TYPE_CONFIGS
from env.terrain import generate_terrain
from env.supply import SupplySystem


def _make_unit(uid: int, utype: int, team: int, **kwargs) -> Unit:
    cfg = UNIT_TYPE_CONFIGS[utype]
    size = kwargs.get("size", cfg.max_size)
    return Unit(
        id=uid, type=utype, team=team,
        x=kwargs.get("x", 500), y=kwargs.get("y", 500),
        size=size, max_size=cfg.max_size,
        hp=size * cfg.hp_per_soldier,
    )


def test_init_army():
    terrain = generate_terrain(42, "open_plains", 50, 40)
    ss = SupplySystem(terrain)
    ss.init_army(0)
    assert ss.get_food_percent(0) == 100.0


def test_consumption_reduces_food():
    terrain = generate_terrain(42, "open_plains", 50, 40)
    ss = SupplySystem(terrain)
    ss.init_army(0, starting_food=100, max_food=100)
    unit = _make_unit(1, UnitType.JI_HALBERDIERS, 0, size=120)
    ss.tick([unit])
    assert ss.get_food_percent(0) < 100


def test_starvation_causes_desertion():
    terrain = generate_terrain(42, "open_plains", 50, 40)
    ss = SupplySystem(terrain)
    ss.init_army(0, starting_food=0, max_food=100)
    unit = _make_unit(1, UnitType.JI_HALBERDIERS, 0, size=120)
    original_size = unit.size
    # Run several ticks to accumulate desertion
    for _ in range(20):
        ss.tick([unit])
    assert unit.size < original_size


def test_speed_multiplier():
    assert SupplySystem.get_speed_multiplier(100) == 1.0
    assert SupplySystem.get_speed_multiplier(60) == 1.0   # Above 50% = normal
    assert SupplySystem.get_speed_multiplier(40) == 0.9   # Low rations (25-50%)
    assert SupplySystem.get_speed_multiplier(20) == 0.8   # Hunger (0-25%)
    assert SupplySystem.get_speed_multiplier(0) == 0.7    # Starvation


def test_combat_multiplier():
    assert SupplySystem.get_combat_multiplier(100) == 1.0
    assert SupplySystem.get_combat_multiplier(20) == 0.8
    assert SupplySystem.get_combat_multiplier(0) == 0.6
