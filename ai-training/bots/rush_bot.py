"""Rush bot — all units attack-move toward map center."""
from __future__ import annotations

from env.types import Unit, UnitState, OrderType, Order
from env.game import Game
from bots.base_bot import BaseBot

from shared.load_constants import map_cfg

_map = map_cfg()
_TILE_SIZE = _map["TILE_SIZE"]
_MAP_W_PX = _map["DEFAULT_MAP_WIDTH"] * _TILE_SIZE
_MAP_H_PX = int(_map["DEFAULT_MAP_WIDTH"] * 0.75) * _TILE_SIZE


class RushBot(BaseBot):
    """Attack-move all units toward map center."""

    def __init__(self) -> None:
        self._issued = False

    def decide(self, game: Game, team: int) -> list[Order]:
        # Only issue orders once (on first decision)
        if self._issued:
            return []
        self._issued = True

        center_x = _MAP_W_PX / 2
        center_y = _MAP_H_PX / 2

        orders = []
        for unit in game.units:
            if unit.team != team or unit.state in (UnitState.DEAD, UnitState.ROUTING):
                continue
            if unit.is_general:
                continue
            orders.append(Order(
                type=OrderType.ATTACK,
                unit_id=unit.id,
                target_x=center_x,
                target_y=center_y,
            ))
        return orders
