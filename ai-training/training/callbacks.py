"""Training callbacks — winrate tracking, checkpointing, curriculum advancement."""
from __future__ import annotations

import os
from collections import deque

from stable_baselines3.common.callbacks import BaseCallback

from training.curriculum import CurriculumManager


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
