"""Flanker bot — splits army and attacks from two sides."""
from __future__ import annotations

from env.types import Unit, UnitType, UnitState, OrderType, Order, UNIT_TYPE_CONFIGS
from env.game import Game
from bots.base_bot import BaseBot

from shared.load_constants import map_cfg

_map = map_cfg()
_TILE_SIZE = _map["TILE_SIZE"]
_MAP_W_PX = _map["DEFAULT_MAP_WIDTH"] * _TILE_SIZE
_MAP_H_PX = int(_map["DEFAULT_MAP_WIDTH"] * 0.75) * _TILE_SIZE


class FlankerBot(BaseBot):
    """Split army into two groups, attack from top and bottom."""

    def __init__(self) -> None:
        self._issued = False

    def decide(self, game: Game, team: int) -> list[Order]:
        if self._issued:
            return []
        self._issued = True

        own_alive = [
            u for u in game.units
            if u.team == team and u.state != UnitState.DEAD and not u.is_general
        ]
        if not own_alive:
            return []

        # Sort by y position to split into top/bottom halves
        own_alive.sort(key=lambda u: u.y)
        mid = len(own_alive) // 2
        top_group = own_alive[:mid]
        bottom_group = own_alive[mid:]

        center_x = _MAP_W_PX / 2

        orders = []

        # Top group attacks upper-center
        for unit in top_group:
            orders.append(Order(
                type=OrderType.ATTACK,
                unit_id=unit.id,
                target_x=center_x,
                target_y=_MAP_H_PX * 0.25,
            ))

        # Bottom group attacks lower-center
        for unit in bottom_group:
            orders.append(Order(
                type=OrderType.ATTACK,
                unit_id=unit.id,
                target_x=center_x,
                target_y=_MAP_H_PX * 0.75,
            ))

        return orders
