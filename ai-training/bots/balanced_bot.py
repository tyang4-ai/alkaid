"""Balanced bot — front line advances, ranged units hold back."""
from __future__ import annotations

from env.types import Unit, UnitType, UnitState, OrderType, Order, UNIT_TYPE_CONFIGS
from env.game import Game
from bots.base_bot import BaseBot

from shared.load_constants import map_cfg
from env.types import is_ranged_unit, UnitCategory

_map = map_cfg()
_TILE_SIZE = _map["TILE_SIZE"]
_MAP_W_PX = _map["DEFAULT_MAP_WIDTH"] * _TILE_SIZE
_MAP_H_PX = int(_map["DEFAULT_MAP_WIDTH"] * 0.75) * _TILE_SIZE


class BalancedBot(BaseBot):
    """Melee/cavalry advance to engage, ranged units hold and fire."""

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

        # Find enemy centroid as target
        enemies = [u for u in game.units if u.team != team and u.state != UnitState.DEAD]
        if enemies:
            cx = sum(e.x for e in enemies) / len(enemies)
            cy = sum(e.y for e in enemies) / len(enemies)
        else:
            cx = _MAP_W_PX / 2
            cy = _MAP_H_PX / 2

        orders = []

        for unit in own_alive:
            cfg = UNIT_TYPE_CONFIGS[unit.type]

            if is_ranged_unit(unit.type):
                # Ranged: hold position
                orders.append(Order(
                    type=OrderType.HOLD,
                    unit_id=unit.id,
                    target_x=unit.x,
                    target_y=unit.y,
                ))
            elif cfg.category == UnitCategory.CAVALRY:
                # Cavalry: charge toward enemies
                orders.append(Order(
                    type=OrderType.CHARGE,
                    unit_id=unit.id,
                    target_x=cx,
                    target_y=cy,
                ))
            else:
                # Infantry: attack-move toward enemies
                orders.append(Order(
                    type=OrderType.ATTACK,
                    unit_id=unit.id,
                    target_x=cx,
                    target_y=cy,
                ))

        return orders
