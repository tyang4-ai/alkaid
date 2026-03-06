"""Test scripted bots."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.types import UnitType, UnitState, OrderType, Order
from env.game import Game, ArmyConfig
from bots.rush_bot import RushBot
from bots.defensive_bot import DefensiveBot
from bots.flanker_bot import FlankerBot
from bots.balanced_bot import BalancedBot

from shared.load_constants import map_cfg

_map = map_cfg()
_TILE_SIZE = _map["TILE_SIZE"]
_MAP_W_PX = _map["DEFAULT_MAP_WIDTH"] * _TILE_SIZE
_MAP_H_PX = int(_map["DEFAULT_MAP_WIDTH"] * 0.75) * _TILE_SIZE


def _make_game():
    game = Game(seed=42)
    game.setup_armies([
        ArmyConfig(team=0, units=[
            {"type": UnitType.GENERAL, "x": 200, "y": 400, "is_general": True},
            {"type": UnitType.JI_HALBERDIERS, "x": 400, "y": 300},
            {"type": UnitType.JI_HALBERDIERS, "x": 400, "y": 500},
            {"type": UnitType.NU_CROSSBOWMEN, "x": 300, "y": 400},
            {"type": UnitType.LIGHT_CAVALRY, "x": 350, "y": 250},
        ]),
        ArmyConfig(team=1, units=[
            {"type": UnitType.GENERAL, "x": 2800, "y": 400, "is_general": True},
            {"type": UnitType.JI_HALBERDIERS, "x": 2600, "y": 300},
            {"type": UnitType.JI_HALBERDIERS, "x": 2600, "y": 500},
            {"type": UnitType.NU_CROSSBOWMEN, "x": 2700, "y": 400},
            {"type": UnitType.LIGHT_CAVALRY, "x": 2650, "y": 250},
        ]),
    ])
    return game


def test_rush_bot_issues_orders():
    game = _make_game()
    bot = RushBot()
    orders = bot.decide(game, 1)
    # Should issue attack orders for all non-general units
    assert len(orders) > 0
    assert all(o.type == OrderType.ATTACK for o in orders)
    assert all(o.target_x is not None for o in orders)


def test_rush_bot_only_issues_once():
    game = _make_game()
    bot = RushBot()
    orders1 = bot.decide(game, 1)
    orders2 = bot.decide(game, 1)
    assert len(orders1) > 0
    assert len(orders2) == 0


def test_defensive_bot_issues_hold():
    game = _make_game()
    bot = DefensiveBot()
    orders = bot.decide(game, 1)
    hold_orders = [o for o in orders if o.type == OrderType.HOLD]
    assert len(hold_orders) > 0


def test_flanker_bot_splits_army():
    game = _make_game()
    bot = FlankerBot()
    orders = bot.decide(game, 1)
    assert len(orders) > 0

    # Should have targets at different Y positions
    y_targets = [o.target_y for o in orders]
    assert min(y_targets) < _MAP_H_PX * 0.5
    assert max(y_targets) > _MAP_H_PX * 0.5


def test_balanced_bot_separates_roles():
    game = _make_game()
    bot = BalancedBot()
    orders = bot.decide(game, 1)
    assert len(orders) > 0

    # Ranged units should get HOLD, melee should get ATTACK/CHARGE
    for o in orders:
        unit = game.unit_map.get(o.unit_id)
        if unit:
            from env.types import is_ranged_unit
            if is_ranged_unit(unit.type):
                assert o.type == OrderType.HOLD
            else:
                assert o.type in (OrderType.ATTACK, OrderType.CHARGE)


def test_bot_vs_bot_runs():
    """Two bots should play out a complete game without errors."""
    game = _make_game()
    rush = RushBot()
    balanced = BalancedBot()

    for step in range(50):
        # Each bot decides
        orders0 = rush.decide(game, 0)
        orders1 = balanced.decide(game, 1)

        if orders0:
            game.issue_orders(0, orders0)
        if orders1:
            game.issue_orders(1, orders1)

        # Advance 20 ticks per step
        for _ in range(20):
            game.tick()
            if game.battle_ended:
                break
        if game.battle_ended:
            break

    # Game should have run without errors
    assert game.tick_number > 0
