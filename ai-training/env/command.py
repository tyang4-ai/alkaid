"""CommandSystem — port of CommandSystem.ts (messenger dispatch/delivery)."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from shared.load_constants import command_cfg, map_cfg, sim_cfg
from env.types import Unit, UnitType, UnitState, OrderType, Order
from env.morale import get_rout_threshold
from env.pathfinding import find_path
from env.terrain import TerrainGrid

_cmd = command_cfg()
_map = map_cfg()
_SIM_TICK_RATE = sim_cfg()["SIM_TICK_RATE"]
_TILE_SIZE = _map["TILE_SIZE"]
_COMMAND_RADIUS_PX = _map["DEFAULT_MAP_WIDTH"] * _TILE_SIZE * _cmd["COMMAND_RADIUS_FRACTION"]

# Misinterpretation mapping when general is dead
MISINTERPRET_MAP: dict[int, int] = {
    OrderType.MOVE: OrderType.CHARGE,
    OrderType.RETREAT: OrderType.HOLD,
    OrderType.CHARGE: OrderType.MOVE,
    OrderType.HOLD: OrderType.RETREAT,
    OrderType.ATTACK: OrderType.MOVE,
    OrderType.FLANK: OrderType.ATTACK,
    OrderType.FORM_UP: OrderType.MOVE,
    OrderType.DISENGAGE: OrderType.HOLD,
    OrderType.RALLY: OrderType.HOLD,
}

MOVEMENT_ORDER_TYPES = frozenset({
    OrderType.MOVE, OrderType.ATTACK, OrderType.RETREAT,
    OrderType.FLANK, OrderType.CHARGE, OrderType.DISENGAGE,
})


@dataclass
class Messenger:
    id: int
    from_x: float
    from_y: float
    target_unit_id: int
    order_type: int
    target_x: float
    target_y: float
    order_target_x: float
    order_target_y: float
    current_x: float
    current_y: float
    speed: float
    spawn_tick: int
    delivered: bool = False


class CommandSystem:
    """Messenger-based command delay system."""

    def __init__(self, terrain: TerrainGrid, rng=None) -> None:
        self._terrain = terrain
        self._rng = rng
        self._messengers: list[Messenger] = []
        self._next_id = 1

    def issue_order(
        self,
        order: Order,
        units: list[Unit],
        unit_map: dict[int, Unit],
    ) -> None:
        """Dispatch a messenger to deliver an order."""
        target_unit = unit_map.get(order.unit_id)
        if not target_unit:
            return

        general = self._find_general(units, target_unit.team)
        general_alive = general is not None
        gx = general.x if general else 0.0
        gy = general.y if general else 0.0

        self._dispatch_messenger(order, gx, gy, general_alive, 0)

    def tick(
        self,
        current_tick: int,
        units: list[Unit],
        unit_map: dict[int, Unit],
        orders: dict[int, int],
    ) -> list[dict]:
        """Advance all messengers, deliver on arrival. Returns events."""
        events: list[dict] = []

        i = len(self._messengers) - 1
        while i >= 0:
            m = self._messengers[i]
            if m.delivered:
                i -= 1
                continue

            # Track moving target
            target = unit_map.get(m.target_unit_id)
            if target:
                m.target_x = target.x
                m.target_y = target.y

            dx = m.target_x - m.current_x
            dy = m.target_y - m.current_y
            dist = math.sqrt(dx * dx + dy * dy)
            speed_px = (m.speed * _TILE_SIZE) / _SIM_TICK_RATE

            if dist <= speed_px:
                m.current_x = m.target_x
                m.current_y = m.target_y
                m.delivered = True
                self._deliver_order(m, units, unit_map, orders, events)
                self._messengers.pop(i)
            else:
                m.current_x += (dx / dist) * speed_px
                m.current_y += (dy / dist) * speed_px

            i -= 1

        return events

    def clear(self) -> None:
        self._messengers.clear()
        self._next_id = 1

    def _find_general(self, units: list[Unit], team: int) -> Unit | None:
        for u in units:
            if u.is_general and u.team == team and u.state != UnitState.DEAD:
                return u
        return None

    def _dispatch_messenger(
        self,
        order: Order,
        general_x: float,
        general_y: float,
        general_alive: bool,
        current_tick: int,
    ) -> None:
        speed = _cmd["MESSENGER_SPEED"]

        tx = order.target_x or 0.0
        ty = order.target_y or 0.0
        dx = tx - general_x
        dy = ty - general_y
        dist = math.sqrt(dx * dx + dy * dy)

        if dist <= _COMMAND_RADIUS_PX:
            speed = _cmd["MESSENGER_SPEED_IN_RADIUS"]

        if order.type == OrderType.RETREAT:
            speed *= _cmd["MESSENGER_RETREAT_SPEED_BONUS"]
        if order.type == OrderType.RALLY:
            speed /= _cmd["MESSENGER_RALLY_DELAY_MULTIPLIER"]

        if not general_alive:
            speed *= _cmd["GENERAL_DEAD_MESSENGER_SPEED_MULT"]

        m = Messenger(
            id=self._next_id,
            from_x=general_x,
            from_y=general_y,
            target_unit_id=order.unit_id,
            order_type=order.type,
            target_x=tx,
            target_y=ty,
            order_target_x=tx,
            order_target_y=ty,
            current_x=general_x,
            current_y=general_y,
            speed=speed,
            spawn_tick=current_tick,
        )
        self._next_id += 1
        self._messengers.append(m)

    def _deliver_order(
        self,
        messenger: Messenger,
        units: list[Unit],
        unit_map: dict[int, Unit],
        orders: dict[int, int],
        events: list[dict],
    ) -> None:
        unit = unit_map.get(messenger.target_unit_id)
        if not unit:
            return

        order_type = messenger.order_type

        # Misinterpretation when general is dead
        general = self._find_general(units, unit.team)
        if not general:
            rng_val = self._rng.next() if self._rng else 0.5
            if rng_val < _cmd["GENERAL_DEAD_MISINTERPRET_CHANCE"]:
                new_type = MISINTERPRET_MAP.get(order_type)
                if new_type is not None:
                    events.append({
                        "type": "command:misinterpreted",
                        "unit_id": messenger.target_unit_id,
                        "original": order_type,
                        "new": new_type,
                    })
                    order_type = new_type

        # Rally validation
        if order_type == OrderType.RALLY:
            threshold = get_rout_threshold(unit.experience, unit.type)
            if unit.morale <= threshold + _cmd["RALLY_MORALE_THRESHOLD_OFFSET"]:
                return

        # Apply the order
        orders[messenger.target_unit_id] = order_type

        # Set up pathfinding for movement orders
        if order_type in MOVEMENT_ORDER_TYPES:
            unit.target_x = messenger.order_target_x
            unit.target_y = messenger.order_target_y
            path = find_path(
                self._terrain, unit.type,
                unit.x, unit.y,
                messenger.order_target_x, messenger.order_target_y,
            )
            if path:
                unit.path = path
                unit.path_index = 0
                unit.state = UnitState.MOVING

        # Apply order modifier
        unit.order_modifier = order_type
        unit.pending_order_type = None
        unit.pending_order_tick = 0

        events.append({
            "type": "command:delivered",
            "unit_id": messenger.target_unit_id,
            "order_type": order_type,
        })
