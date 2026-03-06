"""Curriculum learning — staged opponent difficulty.

5 stages with winrate-based auto-advancement:
  1a. Rush bot only
  1b. Defensive bot only
  2.  Flanker bot only
  3.  Balanced bot only
  4.  Random mix of all bots
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Callable

from bots.base_bot import BaseBot
from bots.rush_bot import RushBot
from bots.defensive_bot import DefensiveBot
from bots.flanker_bot import FlankerBot
from bots.balanced_bot import BalancedBot
from env.game import Game
from env.types import Order


@dataclass
class CurriculumStage:
    name: str
    bot_factory: Callable[[], BaseBot]
    winrate_threshold: float = 0.60
    min_episodes: int = 100


def _mix_bot_factory() -> BaseBot:
    """Return a random bot from the pool."""
    cls = random.choice([RushBot, DefensiveBot, FlankerBot, BalancedBot])
    return cls()


STAGES: list[CurriculumStage] = [
    CurriculumStage("rush", RushBot, winrate_threshold=0.60),
    CurriculumStage("defensive", DefensiveBot, winrate_threshold=0.60),
    CurriculumStage("flanker", FlankerBot, winrate_threshold=0.60),
    CurriculumStage("balanced", BalancedBot, winrate_threshold=0.60),
    CurriculumStage("mix", _mix_bot_factory, winrate_threshold=0.55),
]


class CurriculumManager:
    """Manages curriculum stage progression based on winrate."""

    def __init__(self, stages: list[CurriculumStage] | None = None) -> None:
        self.stages = stages or STAGES
        self.current_stage_idx = 0
        self.stage_wins = 0
        self.stage_episodes = 0

    @property
    def current_stage(self) -> CurriculumStage:
        return self.stages[self.current_stage_idx]

    @property
    def stage_name(self) -> str:
        return self.current_stage.name

    @property
    def winrate(self) -> float:
        if self.stage_episodes == 0:
            return 0.0
        return self.stage_wins / self.stage_episodes

    def get_opponent(self) -> BaseBot:
        """Get a bot for the current curriculum stage."""
        return self.current_stage.bot_factory()

    def make_opponent_fn(self) -> Callable[[Game, int], list[Order]]:
        """Create an opponent function for the env."""
        bot = self.get_opponent()

        def opponent_fn(game: Game, team: int) -> list[Order]:
            return bot.decide(game, team)

        return opponent_fn

    def record_result(self, won: bool) -> bool:
        """Record a game result. Returns True if stage advanced."""
        self.stage_episodes += 1
        if won:
            self.stage_wins += 1

        # Check advancement
        if (self.stage_episodes >= self.current_stage.min_episodes
                and self.winrate >= self.current_stage.winrate_threshold):
            return self._advance()

        return False

    def _advance(self) -> bool:
        if self.current_stage_idx >= len(self.stages) - 1:
            return False
        self.current_stage_idx += 1
        self.stage_wins = 0
        self.stage_episodes = 0
        return True
