"""AlkaidEnv — Gymnasium environment for RL training.

Action space: MultiDiscrete([10, 20, 15] * 32) = 96 sub-actions
  Per unit slot: [order_type, target_x_bin, target_y_bin]
  Dead/routing units forced to NO_OP via action masking.

Observation space: Box(shape=(2582,), float32)
  [own_units(32*40), enemy_units(32*40), global(22)]

Agent decides every DECISION_INTERVAL_TICKS (20) ticks.
Max episode: MAX_EPISODE_STEPS (300) steps.
"""
from __future__ import annotations

from typing import Any

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from shared.load_constants import training_cfg, map_cfg
from env.types import Unit, UnitType, UnitState, OrderType, Order, UNIT_TYPE_CONFIGS
from env.game import Game, ArmyConfig
from env.obs_builder import build_observation, OBS_SIZE
from env.reward import compute_reward, RewardState

_tc = training_cfg()
_map = map_cfg()

MAX_UNITS = _tc["MAX_UNITS_PER_TEAM"]
DECISION_INTERVAL = _tc["DECISION_INTERVAL_TICKS"]
MAX_STEPS = _tc["MAX_EPISODE_STEPS"]
NUM_ORDER_TYPES = _tc["NUM_ORDER_TYPES"]  # 10 (9 orders + NO_OP)
TARGET_X_BINS = _tc["TARGET_X_BINS"]
TARGET_Y_BINS = _tc["TARGET_Y_BINS"]

_TILE_SIZE = _map["TILE_SIZE"]
_MAP_W = _map["DEFAULT_MAP_WIDTH"]
_MAP_H = int(_MAP_W * 0.75)
_MAP_W_PX = _MAP_W * _TILE_SIZE
_MAP_H_PX = _MAP_H * _TILE_SIZE

# NO_OP is order index 9
NO_OP = 9


def _default_army_config(team: int, rng_seed: int = 42) -> list[dict]:
    """Generate a default balanced army for training."""
    import random
    rng = random.Random(rng_seed + team)

    # Standard 8-unit army: 2 halberds, 1 sword, 2 crossbow, 1 light cav, 1 heavy cav, 1 general
    base_x = 400 if team == 0 else _MAP_W_PX - 400
    y_start = _MAP_H_PX * 0.2
    y_step = _MAP_H_PX * 0.08

    units = []
    unit_types = [
        UnitType.JI_HALBERDIERS, UnitType.JI_HALBERDIERS,
        UnitType.DAO_SWORDSMEN,
        UnitType.NU_CROSSBOWMEN, UnitType.NU_CROSSBOWMEN,
        UnitType.LIGHT_CAVALRY,
        UnitType.HEAVY_CAVALRY,
        UnitType.GENERAL,
    ]

    for i, utype in enumerate(unit_types):
        x = base_x + rng.randint(-100, 100)
        y = y_start + i * y_step + rng.randint(-20, 20)
        units.append({
            "type": utype,
            "x": x,
            "y": y,
        })

    return units


class AlkaidEnv(gym.Env):
    """Gymnasium environment wrapping the Alkaid headless simulation."""

    metadata = {"render_modes": []}

    def __init__(
        self,
        opponent_fn=None,
        team: int = 0,
        army_config_fn=None,
        seed: int | None = None,
    ) -> None:
        super().__init__()

        self.team = team
        self.enemy_team = 1 - team
        self._opponent_fn = opponent_fn
        self._army_config_fn = army_config_fn
        self._seed = seed or 42
        self._episode_seed = self._seed

        # Action space: MultiDiscrete [order, target_x, target_y] * MAX_UNITS
        nvec = np.array(
            [NUM_ORDER_TYPES, TARGET_X_BINS, TARGET_Y_BINS] * MAX_UNITS,
            dtype=np.int64,
        )
        self.action_space = spaces.MultiDiscrete(nvec)

        # Observation space
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(OBS_SIZE,), dtype=np.float32,
        )

        self.game: Game | None = None
        self._reward_state = RewardState()
        self._step_count = 0
        self._own_units_order: list[Unit] = []  # sorted own units for action mapping

    def reset(
        self,
        *,
        seed: int | None = None,
        options: dict | None = None,
    ) -> tuple[np.ndarray, dict]:
        super().reset(seed=seed)

        if seed is not None:
            self._episode_seed = seed
        else:
            self._episode_seed += 1

        self.game = Game(seed=self._episode_seed, map_template="open_plains")

        # Configure armies
        if self._army_config_fn:
            t0_units, t1_units = self._army_config_fn(self._episode_seed)
        else:
            t0_units = _default_army_config(0, self._episode_seed)
            t1_units = _default_army_config(1, self._episode_seed + 1000)

        self.game.setup_armies([
            ArmyConfig(team=0, units=t0_units),
            ArmyConfig(team=1, units=t1_units),
        ])

        self._reward_state = RewardState()
        self._step_count = 0
        self._update_unit_order()

        obs = build_observation(self.game, self.team)
        info = self._build_info()
        return obs, info

    def step(
        self,
        action: np.ndarray,
    ) -> tuple[np.ndarray, float, bool, bool, dict]:
        assert self.game is not None, "Must call reset() before step()"

        # Decode and issue agent's orders
        orders = self._decode_action(action)
        if orders:
            self.game.issue_orders(self.team, orders)

        # Let opponent act
        if self._opponent_fn:
            opponent_orders = self._opponent_fn(self.game, self.enemy_team)
            if opponent_orders:
                self.game.issue_orders(self.enemy_team, opponent_orders)

        # Advance simulation by DECISION_INTERVAL ticks
        for _ in range(DECISION_INTERVAL):
            self.game.tick()
            if self.game.battle_ended:
                break

        self._step_count += 1
        self._update_unit_order()

        # Compute outputs
        obs = build_observation(self.game, self.team)
        reward = compute_reward(self.game, self.team, self._reward_state)
        terminated = self.game.battle_ended
        truncated = self._step_count >= MAX_STEPS and not terminated
        info = self._build_info()

        if truncated and not terminated:
            # Force end on truncation
            reward += compute_reward(self.game, self.team, self._reward_state)

        return obs, reward, terminated, truncated, info

    def action_masks(self) -> np.ndarray:
        """Return action mask for MaskablePPO.

        Shape: (96,) where each group of 3 corresponds to [order, x_bin, y_bin].
        For dead/routing units, only NO_OP is valid.
        """
        mask = np.ones(MAX_UNITS * 3, dtype=np.int8)

        for i in range(MAX_UNITS):
            base = i * 3

            if i >= len(self._own_units_order):
                # Empty slot — only allow NO_OP
                order_mask = np.zeros(NUM_ORDER_TYPES, dtype=np.int8)
                order_mask[NO_OP] = 1
                # All x/y bins valid (ignored for NO_OP)
            else:
                unit = self._own_units_order[i]
                if unit.state in (UnitState.DEAD, UnitState.ROUTING):
                    order_mask = np.zeros(NUM_ORDER_TYPES, dtype=np.int8)
                    order_mask[NO_OP] = 1
                else:
                    order_mask = np.ones(NUM_ORDER_TYPES, dtype=np.int8)

            # Store masks — this is a simplified version.
            # Full per-sub-action masking requires SB3's MaskableMultiDiscrete.
            # For now we store the order validity in info dict.

        return mask

    def get_action_masks(self) -> list[np.ndarray]:
        """Return per-sub-action masks for sb3_contrib MaskablePPO.

        Returns list of 96 boolean arrays, one per sub-action dimension.
        """
        masks = []

        for i in range(MAX_UNITS):
            # Order mask
            order_mask = np.ones(NUM_ORDER_TYPES, dtype=bool)
            if i >= len(self._own_units_order):
                order_mask[:] = False
                order_mask[NO_OP] = True
            else:
                unit = self._own_units_order[i]
                if unit.state in (UnitState.DEAD, UnitState.ROUTING):
                    order_mask[:] = False
                    order_mask[NO_OP] = True
                elif unit.rout_ticks > 0:
                    order_mask[:] = False
                    order_mask[NO_OP] = True

            masks.append(order_mask)

            # X bin mask — always all valid
            masks.append(np.ones(TARGET_X_BINS, dtype=bool))

            # Y bin mask — always all valid
            masks.append(np.ones(TARGET_Y_BINS, dtype=bool))

        return masks

    def _decode_action(self, action: np.ndarray) -> list[Order]:
        """Convert flat action array to list of Order objects."""
        orders = []

        for i in range(MAX_UNITS):
            if i >= len(self._own_units_order):
                continue

            unit = self._own_units_order[i]
            if unit.state in (UnitState.DEAD, UnitState.ROUTING):
                continue

            base = i * 3
            order_type = int(action[base])
            x_bin = int(action[base + 1])
            y_bin = int(action[base + 2])

            if order_type >= 9 or order_type == NO_OP:
                continue  # NO_OP

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

    def _update_unit_order(self) -> None:
        """Update sorted list of own alive units for action mapping."""
        if self.game:
            self._own_units_order = sorted(
                [u for u in self.game.units if u.team == self.team and u.state != UnitState.DEAD],
                key=lambda u: u.id,
            )
        else:
            self._own_units_order = []

    def _build_info(self) -> dict:
        if not self.game:
            return {}
        return {
            "tick": self.game.tick_number,
            "step": self._step_count,
            "battle_ended": self.game.battle_ended,
            "winner": self.game.battle_result.winner_team if self.game.battle_result else None,
            "victory_type": self.game.battle_result.victory_type if self.game.battle_result else None,
        }
