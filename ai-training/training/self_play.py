"""Self-play training infrastructure — checkpoint pool and opponent loading.

Two-phase training:
  Phase 1 (bot curriculum, ~5M steps): CurriculumManager with rule-based bots
  Phase 2 (self-play, ~45M steps): SelfPlayManager with past checkpoints as opponents

Every 50K steps, save a new checkpoint to the pool. Sample an opponent (50% latest,
50% random) and create a new SubprocVecEnv with that opponent driving the enemy team.
"""
from __future__ import annotations

import random
from collections import deque
from typing import TYPE_CHECKING

import numpy as np

from shared.load_constants import training_cfg, map_cfg
from env.types import Unit, UnitState, OrderType, Order
from env.obs_builder import build_observation_with_tendency

if TYPE_CHECKING:
    from env.game import Game

_tc = training_cfg()
_map = map_cfg()

MAX_UNITS = _tc["MAX_UNITS_PER_TEAM"]  # 32
NUM_ORDER_TYPES = _tc["NUM_ORDER_TYPES"]  # 10
TARGET_X_BINS = _tc["TARGET_X_BINS"]  # 20
TARGET_Y_BINS = _tc["TARGET_Y_BINS"]  # 15
NO_OP = 9

_TILE_SIZE = _map["TILE_SIZE"]
_MAP_W = _map["DEFAULT_MAP_WIDTH"]
_MAP_H = int(_MAP_W * 0.75)
_MAP_W_PX = _MAP_W * _TILE_SIZE
_MAP_H_PX = _MAP_H * _TILE_SIZE


def decode_action(action: np.ndarray, game: Game, team: int) -> list[Order]:
    """Convert a flat action array (96 elements) to a list of Order objects.

    Standalone version of AlkaidEnv._decode_action so it can be reused by
    SelfPlayOpponent and other callers.

    Args:
        action: Flat int array of shape (96,) = 32 units * 3 sub-actions
                [order_type, x_bin, y_bin] per unit slot.
        game: Current game state (used to look up alive own units).
        team: Team index (0 or 1).

    Returns:
        List of Order objects for alive, non-routing units with valid orders.
    """
    # Get sorted alive units for this team (same ordering as AlkaidEnv)
    own_units = sorted(
        [u for u in game.units if u.team == team and u.state != UnitState.DEAD],
        key=lambda u: u.id,
    )

    orders: list[Order] = []
    for i in range(MAX_UNITS):
        if i >= len(own_units):
            continue

        unit = own_units[i]
        if unit.state in (UnitState.DEAD, UnitState.ROUTING):
            continue

        base = i * 3
        order_type = int(action[base])
        x_bin = int(action[base + 1])
        y_bin = int(action[base + 2])

        if order_type >= 9 or order_type == NO_OP:
            continue  # NO_OP — skip

        # Convert bins to world coordinates
        target_x = (x_bin + 0.5) / TARGET_X_BINS * _MAP_W_PX
        target_y = (y_bin + 0.5) / TARGET_Y_BINS * _MAP_H_PX

        orders.append(Order(
            type=order_type,
            unit_id=unit.id,
            target_x=target_x,
            target_y=target_y,
        ))

    return orders


class SelfPlayManager:
    """Manages a pool of saved checkpoints for self-play training.

    Keeps up to ``max_pool_size`` checkpoint paths. When sampling an opponent,
    returns the latest checkpoint 50% of the time and a uniformly random one
    the other 50%.
    """

    def __init__(self, max_pool_size: int = 20) -> None:
        self._max_pool_size = max_pool_size
        self._pool: deque[str] = deque(maxlen=max_pool_size)

    @property
    def pool_size(self) -> int:
        return len(self._pool)

    def add_checkpoint(self, path: str) -> None:
        """Add a checkpoint path to the pool.

        If the pool exceeds ``max_pool_size``, the oldest entry is dropped
        automatically (deque with maxlen handles this).
        """
        self._pool.append(path)

    def sample_opponent(self) -> str:
        """Sample a checkpoint path from the pool.

        50% chance of returning the latest checkpoint, 50% chance of
        returning a uniformly random one from the entire pool.

        Raises:
            IndexError: If the pool is empty.
        """
        if len(self._pool) == 0:
            raise IndexError("Cannot sample from an empty checkpoint pool")

        if random.random() < 0.5:
            # Latest checkpoint
            return self._pool[-1]
        else:
            # Random from pool
            return random.choice(self._pool)


class SelfPlayOpponent:
    """Loads a MaskablePPO checkpoint and acts as an opponent bot.

    The model is loaded lazily on the first ``decide()`` call to avoid
    expensive checkpoint loading at construction time.
    """

    def __init__(self, checkpoint_path: str, device: str = "cpu") -> None:
        self._checkpoint_path = checkpoint_path
        self._device = device
        self._model = None  # Lazy-loaded

    def _load_model(self) -> None:
        """Load the MaskablePPO checkpoint (called once on first decide)."""
        from sb3_contrib import MaskablePPO
        self._model = MaskablePPO.load(self._checkpoint_path, device=self._device)

    def decide(self, game: Game, team: int) -> list[Order]:
        """Build an observation, run the model, and return decoded orders.

        Args:
            game: Current game state.
            team: Team index this opponent controls.

        Returns:
            List of Order objects produced by the loaded policy.
        """
        if self._model is None:
            self._load_model()

        # Build observation with zero tendencies (self-play opponent has no
        # player tendency signal — it plays its default trained behaviour).
        obs = build_observation_with_tendency(
            game, team, tendencies=np.zeros(14, dtype=np.float32),
        )

        action, _states = self._model.predict(obs, deterministic=False)
        return decode_action(action, game, team)
