"""Defensive bot — hold position, engage nearby enemies."""
from __future__ import annotations

import math

from env.types import Unit, UnitState, OrderType, Order
from env.game import Game
from bots.base_bot import BaseBot

from shared.load_constants import map_cfg

_map = map_cfg()
_TILE_SIZE = _map["TILE_SIZE"]
_MAP_W_PX = _map["DEFAULT_MAP_WIDTH"] * _TILE_SIZE
_ENGAGE_RADIUS = 8 * _TILE_SIZE  # Engage enemies within 8 tiles


class DefensiveBot(BaseBot):
    """Hold position, attack enemies that come within engagement radius."""

    def __init__(self) -> None:
        self._hold_issued = False

    def decide(self, game: Game, team: int) -> list[Order]:
        orders = []

        own_alive = [u for u in game.units if u.team == team and u.state != UnitState.DEAD and not u.is_general]
        enemies = [u for u in game.units if u.team != team and u.state != UnitState.DEAD]

        # Issue hold orders once
        if not self._hold_issued:
            self._hold_issued = True
            for unit in own_alive:
                orders.append(Order(
                    type=OrderType.HOLD,
                    unit_id=unit.id,
                    target_x=unit.x,
                    target_y=unit.y,
                ))

        # Engage nearby enemies
        for unit in own_alive:
            if unit.state == UnitState.ROUTING or unit.combat_target_id != -1:
                continue

            # Find closest enemy
            best_enemy = None
            best_dist = float("inf")
            for e in enemies:
                dx = e.x - unit.x
                dy = e.y - unit.y
                dist = math.sqrt(dx * dx + dy * dy)
                if dist < best_dist:
                    best_enemy = e
                    best_dist = dist

            if best_enemy and best_dist <= _ENGAGE_RADIUS:
                orders.append(Order(
                    type=OrderType.ATTACK,
                    unit_id=unit.id,
                    target_x=best_enemy.x,
                    target_y=best_enemy.y,
                ))

        return orders
