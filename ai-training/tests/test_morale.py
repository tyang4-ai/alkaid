"""Test MoraleSystem."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.types import Unit, UnitType, UnitState, OrderType, UNIT_TYPE_CONFIGS
from env.morale import MoraleSystem, get_rout_threshold


def _make_unit(uid: int, utype: int, team: int, **kwargs) -> Unit:
    cfg = UNIT_TYPE_CONFIGS[utype]
    u = Unit(
        id=uid, type=utype, team=team, x=kwargs.get("x", 100),
        y=kwargs.get("y", 100),
        size=cfg.max_size, max_size=cfg.max_size,
        hp=cfg.max_size * cfg.hp_per_soldier,
        morale=kwargs.get("morale", 70),
        experience=kwargs.get("experience", 0),
    )
    for k, v in kwargs.items():
        if k not in ("x", "y", "morale", "experience"):
            setattr(u, k, v)
    return u


def test_rout_threshold_by_experience():
    assert get_rout_threshold(0, UnitType.JI_HALBERDIERS) == 25  # Conscript
    assert get_rout_threshold(20, UnitType.JI_HALBERDIERS) == 15  # Regular
    assert get_rout_threshold(60, UnitType.JI_HALBERDIERS) == 10  # Veteran
    assert get_rout_threshold(80, UnitType.JI_HALBERDIERS) == 5   # Elite
    assert get_rout_threshold(0, UnitType.ELITE_GUARD) == 5       # Always elite threshold


def test_unit_routes_at_threshold():
    """Unit should rout when morale drops to threshold."""
    ms = MoraleSystem()
    # Conscript threshold is 25. Passive recovery adds +0.5 for idle,
    # so set morale below threshold even after recovery.
    unit = _make_unit(1, UnitType.JI_HALBERDIERS, 0, morale=20, experience=0)
    events = ms.tick([unit], {})
    assert unit.state == UnitState.ROUTING


def test_unit_does_not_rout_above_threshold():
    """Unit should not rout above threshold."""
    ms = MoraleSystem()
    unit = _make_unit(1, UnitType.JI_HALBERDIERS, 0, morale=30, experience=0)
    events = ms.tick([unit], {})
    assert unit.state != UnitState.ROUTING


def test_casualty_morale_loss():
    """apply_casualty_morale reduces morale proportionally."""
    ms = MoraleSystem()
    unit = _make_unit(1, UnitType.JI_HALBERDIERS, 0, morale=70)
    ms.apply_casualty_morale(unit, 10)  # 10% lost
    # -2 per percent = -20
    assert unit.morale == 50


def test_general_killed_morale_hit():
    """All units on team lose 30 morale when general killed."""
    ms = MoraleSystem()
    u1 = _make_unit(1, UnitType.JI_HALBERDIERS, 0, morale=70)
    u2 = _make_unit(2, UnitType.DAO_SWORDSMEN, 0, morale=70)
    u3 = _make_unit(3, UnitType.JI_HALBERDIERS, 1, morale=70)
    ms.apply_general_killed(0, [u1, u2, u3])
    assert u1.morale == 40
    assert u2.morale == 40
    assert u3.morale == 70  # Other team unaffected


def test_passive_recovery_when_idle():
    """Idle units not in combat get +0.5 morale/tick."""
    ms = MoraleSystem()
    unit = _make_unit(1, UnitType.JI_HALBERDIERS, 0, morale=50)
    unit.state = UnitState.IDLE
    unit.combat_target_id = -1
    ms.tick([unit], {})
    assert unit.morale > 50


def test_rout_cascade():
    """Routing unit reduces morale of nearby friendlies."""
    ms = MoraleSystem()
    # Unit about to rout
    u1 = _make_unit(1, UnitType.JI_HALBERDIERS, 0, morale=20, experience=0, x=100, y=100)
    # Nearby friendly
    u2 = _make_unit(2, UnitType.JI_HALBERDIERS, 0, morale=70, x=120, y=100)
    # Far away friendly
    u3 = _make_unit(3, UnitType.JI_HALBERDIERS, 0, morale=70, x=5000, y=5000)

    ms.tick([u1, u2, u3], {})
    assert u1.state == UnitState.ROUTING
    # u2 should have lost morale from cascade (-10)
    assert u2.morale < 70
    # u3 is too far for cascade
    # (note: u3 morale may still change from other modifiers like passive recovery)
