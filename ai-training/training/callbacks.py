"""Training callbacks — winrate tracking, checkpointing, curriculum advancement, self-play."""
from __future__ import annotations

import os
from collections import deque
from typing import TYPE_CHECKING

from stable_baselines3.common.callbacks import BaseCallback

from training.curriculum import CurriculumManager

if TYPE_CHECKING:
    from training.config import TrainingConfig
    from training.self_play import SelfPlayManager


class WinrateCallback(BaseCallback):
    """Track winrate and manage curriculum advancement."""

    def __init__(
        self,
        curriculum: CurriculumManager,
        window_size: int = 100,
        save_dir: str = "checkpoints",
        verbose: int = 1,
    ) -> None:
        super().__init__(verbose)
        self.curriculum = curriculum
        self.window_size = window_size
        self.save_dir = save_dir
        self._recent_results: deque[bool] = deque(maxlen=window_size)

    def _on_step(self) -> bool:
        # Check for episode completion in infos
        infos = self.locals.get("infos", [])
        for info in infos:
            if "episode" in info:
                # Standard SB3 episode info
                won = info.get("winner") == 0  # team 0 is agent
                self._recent_results.append(won)
                advanced = self.curriculum.record_result(won)

                if advanced and self.verbose:
                    print(
                        f"[Curriculum] Advanced to stage: {self.curriculum.stage_name} "
                        f"(winrate: {self.curriculum.winrate:.1%})"
                    )
                    self._save_checkpoint(f"stage_{self.curriculum.current_stage_idx}")

            elif info.get("battle_ended", False):
                won = info.get("winner") == 0
                self._recent_results.append(won)
                self.curriculum.record_result(won)

        return True

    def _save_checkpoint(self, name: str) -> None:
        os.makedirs(self.save_dir, exist_ok=True)
        path = os.path.join(self.save_dir, name)
        self.model.save(path)
        if self.verbose:
            print(f"[Checkpoint] Saved: {path}")

    @property
    def rolling_winrate(self) -> float:
        if not self._recent_results:
            return 0.0
        return sum(self._recent_results) / len(self._recent_results)


class PeriodicSaveCallback(BaseCallback):
    """Save model at regular intervals."""

    def __init__(self, save_freq: int, save_dir: str, verbose: int = 1) -> None:
        super().__init__(verbose)
        self.save_freq = save_freq
        self.save_dir = save_dir

    def _on_step(self) -> bool:
        if self.n_calls % self.save_freq == 0:
            os.makedirs(self.save_dir, exist_ok=True)
            path = os.path.join(self.save_dir, f"model_{self.num_timesteps}")
            self.model.save(path)
            if self.verbose:
                print(f"[Save] {path} ({self.num_timesteps} timesteps)")
        return True


class SelfPlayCallback(BaseCallback):
    """Save checkpoints to self-play pool and manage bot->self-play phase transition.

    Two-phase training:
      Phase 1 (bot curriculum): Train against CurriculumManager bots for
          ``bot_phase_steps``. Waits until curriculum is fully completed before
          switching to phase 2.
      Phase 2 (self-play): Save checkpoints to the pool every
          ``save_interval`` steps, sample a new opponent from the pool, and
          recreate the vectorized environment with the new opponent.
    """

    def __init__(
        self,
        config: TrainingConfig,
        curriculum: CurriculumManager,
        self_play_manager: SelfPlayManager,
        make_env_fn,
        save_dir: str = "checkpoints",
        verbose: int = 1,
    ) -> None:
        super().__init__(verbose)
        self.config = config
        self.curriculum = curriculum
        self.self_play_manager = self_play_manager
        self.make_env_fn = make_env_fn
        self.save_dir = save_dir

        self._in_self_play = False
        self._last_save_step = 0
        self._bot_phase_steps = config.self_play_bot_phase_steps
        self._save_interval = config.self_play_save_interval

    @property
    def in_self_play(self) -> bool:
        return self._in_self_play

    def _on_step(self) -> bool:
        if not self.config.self_play_enabled:
            return True

        if not self._in_self_play:
            # Phase 1: bot curriculum — check for transition
            curriculum_done = (
                self.curriculum.current_stage_idx
                >= len(self.curriculum.stages) - 1
            )
            past_bot_phase = self.num_timesteps >= self._bot_phase_steps

            if curriculum_done and past_bot_phase:
                self._switch_to_self_play()

        else:
            # Phase 2: self-play — periodically save and swap opponent
            steps_since_save = self.num_timesteps - self._last_save_step
            if steps_since_save >= self._save_interval:
                self._save_and_swap()

        return True

    def _switch_to_self_play(self) -> None:
        """Transition from bot curriculum to self-play phase."""
        if self.verbose:
            print(
                f"[SelfPlay] Switching to self-play at step {self.num_timesteps}"
            )

        self._in_self_play = True

        # Save current model as the first self-play checkpoint
        os.makedirs(self.save_dir, exist_ok=True)
        ckpt_path = os.path.join(
            self.save_dir, f"selfplay_{self.num_timesteps}"
        )
        self.model.save(ckpt_path)
        self.self_play_manager.add_checkpoint(ckpt_path)
        self._last_save_step = self.num_timesteps

        if self.verbose:
            print(
                f"[SelfPlay] Seeded pool with checkpoint: {ckpt_path}"
            )

        # Create new env with self-play opponent
        self._recreate_env_with_opponent()

    def _save_and_swap(self) -> None:
        """Save checkpoint to pool and swap to a new opponent."""
        os.makedirs(self.save_dir, exist_ok=True)
        ckpt_path = os.path.join(
            self.save_dir, f"selfplay_{self.num_timesteps}"
        )
        self.model.save(ckpt_path)
        self.self_play_manager.add_checkpoint(ckpt_path)
        self._last_save_step = self.num_timesteps

        if self.verbose:
            pool_size = self.self_play_manager.pool_size
            print(
                f"[SelfPlay] Saved checkpoint (pool size: {pool_size}), "
                f"swapping opponent at step {self.num_timesteps}"
            )

        self._recreate_env_with_opponent()

    def _recreate_env_with_opponent(self) -> None:
        """Close current env and create a new one with a self-play opponent."""
        from training.self_play import SelfPlayOpponent

        # Sample opponent checkpoint from pool
        opponent_path = self.self_play_manager.sample_opponent()
        opponent = SelfPlayOpponent(opponent_path, device="cpu")

        def opponent_fn(game, team):
            return opponent.decide(game, team)

        if self.verbose:
            print(f"[SelfPlay] New opponent: {opponent_path}")

        # Build new vec_env and swap it into the model
        new_env = self.make_env_fn(opponent_fn=opponent_fn)

        old_env = self.model.get_env()
        self.model.set_env(new_env)

        if old_env is not None:
            try:
                old_env.close()
            except Exception:
                pass  # Best-effort cleanup
