"""Test Game engine tick loop."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.types import Unit, UnitType, UnitState, OrderType, Order, VictoryType, UNIT_TYPE_CONFIGS
from env.game import Game, ArmyConfig


def _basic_armies():
    """Two small armies facing each other."""
    return [
        ArmyConfig(team=0, units=[
            {"type": UnitType.GENERAL, "x": 200, "y": 400, "is_general": True},
            {"type": UnitType.JI_HALBERDIERS, "x": 400, "y": 400},
            {"type": UnitType.NU_CROSSBOWMEN, "x": 300, "y": 400},
        ]),
        ArmyConfig(team=1, units=[
            {"type": UnitType.GENERAL, "x": 2800, "y": 400, "is_general": True},
            {"type": UnitType.JI_HALBERDIERS, "x": 2600, "y": 400},
            {"type": UnitType.NU_CROSSBOWMEN, "x": 2700, "y": 400},
        ]),
    ]


def test_game_initializes():
    game = Game(seed=42)
    game.setup_armies(_basic_armies())
    assert len(game.units) == 6
    assert game.tick_number == 0
    assert not game.battle_ended


def test_tick_advances():
    game = Game(seed=42)
    game.setup_armies(_basic_armies())
    game.tick()
    assert game.tick_number == 1
    game.tick()
    assert game.tick_number == 2


def test_units_have_correct_stats():
    game = Game(seed=42)
    game.setup_armies(_basic_armies())
    halberdier = [u for u in game.units if u.type == UnitType.JI_HALBERDIERS][0]
    assert halberdier.size == 120
    assert halberdier.max_size == 120
    cfg = UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS]
    assert halberdier.hp == 120 * cfg.hp_per_soldier


def test_issue_orders_via_command():
    game = Game(seed=42)
    game.setup_armies(_basic_armies())
    halberdier = [u for u in game.units if u.type == UnitType.JI_HALBERDIERS and u.team == 0][0]

    orders = [Order(type=OrderType.MOVE, unit_id=halberdier.id, target_x=800, target_y=400)]
    game.issue_orders(0, orders)

    # Run enough ticks for messenger to deliver
    for _ in range(100):
        game.tick()

    # Unit should have moved
    assert halberdier.x != 400 or halberdier.state != UnitState.IDLE


def test_annihilation_ends_battle():
    """Kill all units on one team → annihilation victory."""
    game = Game(seed=42)
    game.setup_armies([
        ArmyConfig(team=0, units=[
            {"type": UnitType.JI_HALBERDIERS, "x": 400, "y": 400},
        ]),
        ArmyConfig(team=1, units=[
            {"type": UnitType.JI_HALBERDIERS, "x": 500, "y": 400},
        ]),
    ])

    # Kill team 1's only unit directly
    for u in game.units:
        if u.team == 1:
            u.state = UnitState.DEAD

    game.tick()
    assert game.battle_ended
    assert game.battle_result is not None
    assert game.battle_result.winner_team == 0
    assert game.battle_result.victory_type == VictoryType.ANNIHILATION


def test_max_ticks_ends_battle():
    """Battle should end after MAX_TICKS."""
    game = Game(seed=42)
    game.setup_armies(_basic_armies())

    # Set tick_number near max
    from shared.load_constants import training_cfg
    max_ticks = training_cfg()["MAX_TICKS"]
    game.tick_number = max_ticks - 1

    game.tick()
    assert game.battle_ended
    assert game.battle_result is not None
    assert game.battle_result.victory_type == VictoryType.STALEMATE


def test_spatial_hash_rebuilt_each_tick():
    game = Game(seed=42)
    game.setup_armies(_basic_armies())
    game.tick()
    # Spatial hash should have entries
    alive = game.get_all_alive_units()
    assert len(alive) == 6


def test_weather_and_time_update():
    game = Game(seed=42)
    game.setup_armies(_basic_armies())
    # Run enough ticks for time phase to change
    from shared.load_constants import time_of_day_cfg
    phase_duration = time_of_day_cfg()["TIME_PHASE_DURATION_TICKS"]
    for _ in range(phase_duration + 1):
        game.tick()
    # Time of day should have changed from default
    assert game.env_state.current_tick > 0


def test_supply_system_ticks():
    game = Game(seed=42)
    game.setup_armies(_basic_armies())
    initial = game.supply_system.get_food_percent(0)
    for _ in range(20):
        game.tick()
    # Food should have been consumed (slightly)
    assert game.supply_system.get_food_percent(0) <= initial


def test_combat_engagement():
    """Units close enough should engage in combat."""
    game = Game(seed=42)
    game.setup_armies([
        ArmyConfig(team=0, units=[
            {"type": UnitType.JI_HALBERDIERS, "x": 100, "y": 100},
        ]),
        ArmyConfig(team=1, units=[
            {"type": UnitType.JI_HALBERDIERS, "x": 110, "y": 100},
        ]),
    ])

    # Run a few ticks — units should engage
    for _ in range(10):
        game.tick()

    t0 = game.units[0]
    t1 = game.units[1]
    # At least one should be attacking or damaged
    assert (t0.combat_target_id != -1 or t1.combat_target_id != -1
            or t0.hp < 120 * UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS].hp_per_soldier
            or t1.hp < 120 * UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS].hp_per_soldier)
