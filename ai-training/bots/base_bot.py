"""Base class for scripted opponent bots."""
from __future__ import annotations

from abc import ABC, abstractmethod
from env.types import Order
from env.game import Game


class BaseBot(ABC):
    """Base class for scripted bots that decide orders each step."""

    @abstractmethod
    def decide(self, game: Game, team: int) -> list[Order]:
        """Return a list of orders for the given team."""
        ...
