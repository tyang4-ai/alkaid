"""Tests for self-play training infrastructure."""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np

from env.types import UnitType, UnitState, OrderType, Order
from env.game import Game, ArmyConfig
from training.self_play import SelfPlayManager, SelfPlayOpponent, decode_action

from shared.load_constants import training_cfg, map_cfg

_tc = training_cfg()
_map = map_cfg()

MAX_UNITS = _tc["MAX_UNITS_PER_TEAM"]
NUM_ORDER_TYPES = _tc["NUM_ORDER_TYPES"]
TARGET_X_BINS = _tc["TARGET_X_BINS"]
TARGET_Y_BINS = _tc["TARGET_Y_BINS"]
_TILE_SIZE = _map["TILE_SIZE"]
_MAP_W = _map["DEFAULT_MAP_WIDTH"]
_MAP_H = int(_MAP_W * 0.75)
_MAP_W_PX = _MAP_W * _TILE_SIZE
_MAP_H_PX = _MAP_H * _TILE_SIZE


def _make_game() -> Game:
    """Create a simple game with known unit setup for testing."""
    game = Game(seed=42)
    game.setup_armies([
        ArmyConfig(team=0, units=[
            {"type": UnitType.GENERAL, "x": 200, "y": 400, "is_general": True},
            {"type": UnitType.JI_HALBERDIERS, "x": 400, "y": 300},
            {"type": UnitType.JI_HALBERDIERS, "x": 400, "y": 500},
            {"type": UnitType.NU_CROSSBOWMEN, "x": 300, "y": 400},
        ]),
        ArmyConfig(team=1, units=[
            {"type": UnitType.GENERAL, "x": 2800, "y": 400, "is_general": True},
            {"type": UnitType.JI_HALBERDIERS, "x": 2600, "y": 300},
            {"type": UnitType.NU_CROSSBOWMEN, "x": 2700, "y": 400},
        ]),
    ])
    return game


# ── SelfPlayManager tests ────────────────────────────────────────────


def test_manager_starts_empty():
    mgr = SelfPlayManager()
    assert mgr.pool_size == 0


def test_manager_add_checkpoint():
    mgr = SelfPlayManager()
    mgr.add_checkpoint("/checkpoints/step_50k.zip")
    assert mgr.pool_size == 1
    mgr.add_checkpoint("/checkpoints/step_100k.zip")
    assert mgr.pool_size == 2


def test_manager_pool_size_limit():
    mgr = SelfPlayManager(max_pool_size=20)
    for i in range(25):
        mgr.add_checkpoint(f"/checkpoints/step_{i}.zip")
    assert mgr.pool_size == 20


def test_manager_oldest_dropped():
    mgr = SelfPlayManager(max_pool_size=3)
    mgr.add_checkpoint("a.zip")
    mgr.add_checkpoint("b.zip")
    mgr.add_checkpoint("c.zip")
    mgr.add_checkpoint("d.zip")  # should evict "a.zip"
    assert mgr.pool_size == 3
    # The oldest ("a.zip") should be gone; latest is "d.zip"
    sampled = set()
    for _ in range(200):
        sampled.add(mgr.sample_opponent())
    assert "a.zip" not in sampled
    assert "d.zip" in sampled


def test_manager_sample_empty_raises():
    mgr = SelfPlayManager()
    try:
        mgr.sample_opponent()
        assert False, "Expected IndexError"
    except IndexError:
        pass


def test_manager_sample_single():
    mgr = SelfPlayManager()
    mgr.add_checkpoint("only.zip")
    # With one entry, both latest and random return the same
    assert mgr.sample_opponent() == "only.zip"


def test_manager_sample_distribution():
    """Latest checkpoint should be returned roughly 50% of the time."""
    mgr = SelfPlayManager(max_pool_size=20)
    for i in range(10):
        mgr.add_checkpoint(f"ckpt_{i}.zip")

    latest = "ckpt_9.zip"
    n_trials = 2000
    latest_count = sum(1 for _ in range(n_trials) if mgr.sample_opponent() == latest)

    # Expected: ~50% latest + 10% from random picking latest = ~55%
    # Allow generous range for randomness
    assert latest_count > n_trials * 0.35, f"Latest selected only {latest_count}/{n_trials} times"
    assert latest_count < n_trials * 0.75, f"Latest selected {latest_count}/{n_trials} times (too high)"


# ── decode_action tests ──────────────────────────────────────────────


def test_decode_action_basic():
    """Valid orders should produce Order objects with correct coordinates."""
    game = _make_game()
    team = 0
    own_units = sorted(
        [u for u in game.units if u.team == team and u.state != UnitState.DEAD],
        key=lambda u: u.id,
    )
    n_own = len(own_units)
    assert n_own == 4, f"Expected 4 own units, got {n_own}"

    action = np.zeros(MAX_UNITS * 3, dtype=np.int64)
    # Unit slot 0: ATTACK at bin (10, 7)
    action[0] = OrderType.ATTACK  # order_type = 1
    action[1] = 10  # x_bin
    action[2] = 7   # y_bin

    orders = decode_action(action, game, team)

    # Only slot 0 has a real order; slots 1-3 default to order_type=0 (MOVE) at bin (0,0)
    # Wait — slot 1-3 have order_type=0 which is MOVE, which is < 9, so they produce orders too.
    # Slot 0: ATTACK, slots 1-3: MOVE at (0,0)
    assert len(orders) == 4

    # Check slot 0's order specifically
    o0 = [o for o in orders if o.unit_id == own_units[0].id][0]
    assert o0.type == OrderType.ATTACK
    expected_x = (10 + 0.5) / TARGET_X_BINS * _MAP_W_PX
    expected_y = (7 + 0.5) / TARGET_Y_BINS * _MAP_H_PX
    assert abs(o0.target_x - expected_x) < 0.01
    assert abs(o0.target_y - expected_y) < 0.01


def test_decode_action_noop_skipped():
    """Slots with NO_OP (order_type >= 9) should produce no orders."""
    game = _make_game()
    action = np.zeros(MAX_UNITS * 3, dtype=np.int64)
    # Set all slots to NO_OP
    for i in range(MAX_UNITS):
        action[i * 3] = 9
    orders = decode_action(action, game, team=0)
    assert len(orders) == 0


def test_decode_action_empty_slots_skipped():
    """Slots beyond the number of alive units should be ignored."""
    game = _make_game()
    action = np.zeros(MAX_UNITS * 3, dtype=np.int64)
    # Set all 32 slots to ATTACK
    for i in range(MAX_UNITS):
        action[i * 3] = OrderType.ATTACK
        action[i * 3 + 1] = 5
        action[i * 3 + 2] = 5

    orders_t0 = decode_action(action, game, team=0)
    orders_t1 = decode_action(action, game, team=1)

    # Team 0 has 4 alive units, team 1 has 3
    assert len(orders_t0) == 4
    assert len(orders_t1) == 3


def test_decode_action_dead_unit_skipped():
    """Dead units should not receive orders."""
    game = _make_game()
    # Kill the first team-0 unit
    own_units = sorted(
        [u for u in game.units if u.team == 0 and u.state != UnitState.DEAD],
        key=lambda u: u.id,
    )
    own_units[0].state = UnitState.DEAD

    action = np.zeros(MAX_UNITS * 3, dtype=np.int64)
    for i in range(MAX_UNITS):
        action[i * 3] = OrderType.MOVE
        action[i * 3 + 1] = 3
        action[i * 3 + 2] = 3

    orders = decode_action(action, game, team=0)
    # One unit is dead, but decode_action filters alive units first,
    # so the dead unit won't be in the slot list at all.
    # 4 original - 1 dead = 3 alive, and slot 0-2 get MOVE orders.
    assert len(orders) == 3
    dead_ids = {own_units[0].id}
    for o in orders:
        assert o.unit_id not in dead_ids


def test_decode_action_routing_unit_skipped():
    """Routing units should not receive orders."""
    game = _make_game()
    own_units = sorted(
        [u for u in game.units if u.team == 0 and u.state != UnitState.DEAD],
        key=lambda u: u.id,
    )
    # Set one unit to ROUTING
    own_units[1].state = UnitState.ROUTING

    action = np.zeros(MAX_UNITS * 3, dtype=np.int64)
    for i in range(MAX_UNITS):
        action[i * 3] = OrderType.MOVE

    orders = decode_action(action, game, team=0)
    # 4 alive (including routing) in initial list; routing one is still in
    # the slot list but skipped by the ROUTING check inside decode_action.
    assert len(orders) == 3
    routing_ids = {own_units[1].id}
    for o in orders:
        assert o.unit_id not in routing_ids


def test_decode_action_coordinate_conversion():
    """Verify bin-to-world coordinate math for several bins."""
    game = _make_game()
    action = np.zeros(MAX_UNITS * 3, dtype=np.int64)

    # Slot 0: MOVE at bin (0, 0)
    action[0] = OrderType.MOVE
    action[1] = 0
    action[2] = 0

    orders = decode_action(action, game, team=0)
    o = orders[0]
    assert abs(o.target_x - 0.5 / TARGET_X_BINS * _MAP_W_PX) < 0.01
    assert abs(o.target_y - 0.5 / TARGET_Y_BINS * _MAP_H_PX) < 0.01

    # Slot 0: MOVE at max bin
    action[1] = TARGET_X_BINS - 1
    action[2] = TARGET_Y_BINS - 1
    orders2 = decode_action(action, game, team=0)
    o2 = orders2[0]
    expected_x = (TARGET_X_BINS - 1 + 0.5) / TARGET_X_BINS * _MAP_W_PX
    expected_y = (TARGET_Y_BINS - 1 + 0.5) / TARGET_Y_BINS * _MAP_H_PX
    assert abs(o2.target_x - expected_x) < 0.01
    assert abs(o2.target_y - expected_y) < 0.01


# ── SelfPlayOpponent tests ──────────────────────────────────────────


def test_opponent_construction():
    """SelfPlayOpponent should construct without loading the model."""
    opp = SelfPlayOpponent("fake_checkpoint.zip", device="cpu")
    assert opp._model is None
    assert opp._checkpoint_path == "fake_checkpoint.zip"
    assert opp._device == "cpu"


def test_opponent_lazy_loading():
    """Model should not be loaded until decide() is called."""
    opp = SelfPlayOpponent("fake.zip")
    assert opp._model is None

    game = _make_game()

    # Mock MaskablePPO.load to return a mock model
    mock_model = MagicMock()
    # predict returns (action_array, states)
    mock_action = np.zeros(MAX_UNITS * 3, dtype=np.int64)
    for i in range(MAX_UNITS):
        mock_action[i * 3] = 9  # NO_OP so orders are empty
    mock_model.predict.return_value = (mock_action, None)

    with patch("training.self_play.SelfPlayOpponent._load_model") as mock_load:
        # Inject mock model directly
        def _fake_load():
            opp._model = mock_model
        mock_load.side_effect = _fake_load

        orders = opp.decide(game, team=1)

        # _load_model should have been called exactly once
        mock_load.assert_called_once()

    # Second call should not reload
    with patch("training.self_play.SelfPlayOpponent._load_model") as mock_load2:
        orders2 = opp.decide(game, team=1)
        mock_load2.assert_not_called()


def test_opponent_decide_returns_orders():
    """decide() should return Order objects decoded from model output."""
    opp = SelfPlayOpponent("fake.zip")
    game = _make_game()

    mock_model = MagicMock()
    # Create action that issues ATTACK for slot 0 and NO_OP for rest
    mock_action = np.zeros(MAX_UNITS * 3, dtype=np.int64)
    mock_action[0] = OrderType.ATTACK
    mock_action[1] = 10
    mock_action[2] = 7
    for i in range(1, MAX_UNITS):
        mock_action[i * 3] = 9  # NO_OP
    mock_model.predict.return_value = (mock_action, None)

    # Inject mock model
    opp._model = mock_model

    orders = opp.decide(game, team=1)
    assert len(orders) == 1
    assert orders[0].type == OrderType.ATTACK
