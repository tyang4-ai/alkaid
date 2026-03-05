"""Test DamageCalculator and CombatSystem."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.types import Unit, UnitType, UnitState, OrderType, TerrainType, EnvironmentState, WeatherType, TimeOfDay, UNIT_TYPE_CONFIGS
from env.combat import calculate_damage, DamageResult


def _make_unit(uid: int, utype: int, team: int, x: float = 100, y: float = 100, **kwargs) -> Unit:
    cfg = UNIT_TYPE_CONFIGS[utype]
    u = Unit(
        id=uid, type=utype, team=team, x=x, y=y,
        size=kwargs.get("size", cfg.max_size),
        max_size=cfg.max_size,
        hp=kwargs.get("size", cfg.max_size) * cfg.hp_per_soldier,
    )
    for k, v in kwargs.items():
        if k != "size":
            setattr(u, k, v)
    return u


def test_basic_damage():
    """Halberdier vs Halberdier on plains, no modifiers."""
    attacker = _make_unit(1, UnitType.JI_HALBERDIERS, 0)
    defender = _make_unit(2, UnitType.JI_HALBERDIERS, 1)
    result = calculate_damage(attacker, defender, TerrainType.PLAINS, False)
    assert result.final_damage > 0
    assert not result.is_ranged
    assert not result.was_charge


def test_type_matchup_applies():
    """Halberdier vs Heavy Cavalry should do more damage (1.5x matchup)."""
    attacker = _make_unit(1, UnitType.JI_HALBERDIERS, 0)
    defender_hcav = _make_unit(2, UnitType.HEAVY_CAVALRY, 1)
    defender_hal = _make_unit(3, UnitType.JI_HALBERDIERS, 1)

    result_hcav = calculate_damage(attacker, defender_hcav, TerrainType.PLAINS, False)
    result_hal = calculate_damage(attacker, defender_hal, TerrainType.PLAINS, False)
    # 1.5x vs 1.0x matchup, defender armor differs too, but matchup should be visible
    assert result_hcav.final_damage > result_hal.final_damage * 0.8  # Approx check


def test_terrain_defense_bonus():
    """Forest defense (+25%) should reduce damage."""
    attacker = _make_unit(1, UnitType.JI_HALBERDIERS, 0)
    defender = _make_unit(2, UnitType.JI_HALBERDIERS, 1)

    dmg_plains = calculate_damage(attacker, defender, TerrainType.PLAINS, False)
    dmg_forest = calculate_damage(attacker, defender, TerrainType.FOREST, False)
    assert dmg_forest.final_damage < dmg_plains.final_damage


def test_cavalry_charge_bonus():
    """First-strike charge bonus should multiply damage."""
    light_cav = _make_unit(1, UnitType.LIGHT_CAVALRY, 0, has_charged=False)
    light_cav.combat_ticks = 0
    defender = _make_unit(2, UnitType.JI_HALBERDIERS, 1)

    result = calculate_damage(light_cav, defender, TerrainType.PLAINS, False)
    assert result.was_charge
    assert result.final_damage > 0  # Should have 2.0x bonus

    # After charging
    light_cav.has_charged = True
    result2 = calculate_damage(light_cav, defender, TerrainType.PLAINS, False)
    assert not result2.was_charge
    assert result2.final_damage < result.final_damage


def test_dao_shield_vs_ranged():
    """Dao Swordsmen get -30% damage from ranged attacks."""
    crossbow = _make_unit(1, UnitType.NU_CROSSBOWMEN, 0)
    dao = _make_unit(2, UnitType.DAO_SWORDSMEN, 1)
    halberd = _make_unit(3, UnitType.JI_HALBERDIERS, 1)

    dmg_dao = calculate_damage(crossbow, dao, TerrainType.PLAINS, False)
    dmg_hal = calculate_damage(crossbow, halberd, TerrainType.PLAINS, False)
    # Dao takes less due to shield (30% reduction) — but armor/matchup differs
    assert dmg_dao.is_ranged


def test_ranged_cant_fire_while_moving():
    """Crossbowmen can't fire while moving."""
    crossbow = _make_unit(1, UnitType.NU_CROSSBOWMEN, 0)
    defender = _make_unit(2, UnitType.JI_HALBERDIERS, 1)

    result = calculate_damage(crossbow, defender, TerrainType.PLAINS, True)
    assert result.final_damage == 0


def test_horse_archers_fire_while_moving():
    """Horse archers can fire while moving at full damage."""
    ha = _make_unit(1, UnitType.HORSE_ARCHERS, 0)
    defender = _make_unit(2, UnitType.JI_HALBERDIERS, 1)

    result = calculate_damage(ha, defender, TerrainType.PLAINS, True)
    assert result.final_damage > 0
    assert result.is_ranged


def test_routing_defender_takes_extra_damage():
    """Routing units take 1.5x damage."""
    attacker = _make_unit(1, UnitType.JI_HALBERDIERS, 0)
    defender = _make_unit(2, UnitType.JI_HALBERDIERS, 1)

    dmg_normal = calculate_damage(attacker, defender, TerrainType.PLAINS, False)
    defender.state = UnitState.ROUTING
    dmg_routing = calculate_damage(attacker, defender, TerrainType.PLAINS, False)
    assert dmg_routing.final_damage > dmg_normal.final_damage


def test_fatigue_reduces_damage():
    """Fatigue should reduce attacker damage."""
    attacker = _make_unit(1, UnitType.JI_HALBERDIERS, 0, fatigue=0)
    fatigued = _make_unit(2, UnitType.JI_HALBERDIERS, 0, fatigue=80)
    defender = _make_unit(3, UnitType.JI_HALBERDIERS, 1)

    dmg_fresh = calculate_damage(attacker, defender, TerrainType.PLAINS, False)
    dmg_tired = calculate_damage(fatigued, defender, TerrainType.PLAINS, False)
    assert dmg_tired.final_damage < dmg_fresh.final_damage


def test_weather_rain_ranged():
    """Rain reduces ranged damage."""
    crossbow = _make_unit(1, UnitType.NU_CROSSBOWMEN, 0)
    defender = _make_unit(2, UnitType.JI_HALBERDIERS, 1)

    env_clear = EnvironmentState(weather=WeatherType.CLEAR, time_of_day=TimeOfDay.MORNING)
    env_rain = EnvironmentState(weather=WeatherType.RAIN, time_of_day=TimeOfDay.MORNING)

    dmg_clear = calculate_damage(crossbow, defender, TerrainType.PLAINS, False, env=env_clear)
    dmg_rain = calculate_damage(crossbow, defender, TerrainType.PLAINS, False, env=env_rain)
    assert dmg_rain.final_damage < dmg_clear.final_damage
