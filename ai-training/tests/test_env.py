"""Test AlkaidEnv Gymnasium wrapper."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
from env.alkaid_env import AlkaidEnv, OBS_SIZE, MAX_UNITS, NUM_ORDER_TYPES, TARGET_X_BINS, TARGET_Y_BINS


def test_env_reset():
    env = AlkaidEnv()
    obs, info = env.reset(seed=42)
    assert obs.shape == (OBS_SIZE,)
    assert obs.dtype == np.float32
    assert info["tick"] == 0


def test_env_step_random():
    env = AlkaidEnv()
    obs, info = env.reset(seed=42)

    # Random action
    action = env.action_space.sample()
    obs2, reward, terminated, truncated, info2 = env.step(action)

    assert obs2.shape == (OBS_SIZE,)
    assert isinstance(reward, float)
    assert isinstance(terminated, bool)
    assert isinstance(truncated, bool)
    assert info2["tick"] > 0


def test_env_action_masks():
    env = AlkaidEnv()
    env.reset(seed=42)
    masks = env.get_action_masks()
    # 32 units * 3 sub-actions = 96 mask arrays
    assert len(masks) == MAX_UNITS * 3

    # Each mask should have correct size
    for i in range(MAX_UNITS):
        assert len(masks[i * 3]) == NUM_ORDER_TYPES
        assert len(masks[i * 3 + 1]) == TARGET_X_BINS
        assert len(masks[i * 3 + 2]) == TARGET_Y_BINS


def test_env_completes_episode():
    """Random agent should complete an episode (or truncate)."""
    env = AlkaidEnv()
    obs, info = env.reset(seed=42)
    done = False
    steps = 0
    max_test_steps = 50  # Don't run full 300 steps in test

    while not done and steps < max_test_steps:
        action = env.action_space.sample()
        obs, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated
        steps += 1

    assert steps > 0
    assert obs.shape == (OBS_SIZE,)


def test_env_with_opponent():
    """Test environment with a simple opponent function."""
    from bots.rush_bot import RushBot
    bot = RushBot()

    def opponent_fn(game, team):
        return bot.decide(game, team)

    env = AlkaidEnv(opponent_fn=opponent_fn)
    obs, info = env.reset(seed=42)

    for _ in range(5):
        action = env.action_space.sample()
        obs, reward, terminated, truncated, info = env.step(action)
        if terminated or truncated:
            break


def test_obs_values_in_range():
    """All observation values should be roughly in [0, 1]."""
    env = AlkaidEnv()
    obs, _ = env.reset(seed=42)
    # Allow small floating point overshoot
    assert np.all(obs >= -0.1), f"Min obs: {obs.min()}"
    assert np.all(obs <= 1.5), f"Max obs: {obs.max()}"


def test_env_no_op_action():
    """All NO_OPs should not crash."""
    env = AlkaidEnv()
    obs, _ = env.reset(seed=42)

    # All NO_OP
    action = np.zeros(MAX_UNITS * 3, dtype=np.int64)
    for i in range(MAX_UNITS):
        action[i * 3] = 9  # NO_OP
    obs, reward, terminated, truncated, info = env.step(action)
    assert obs.shape == (OBS_SIZE,)
