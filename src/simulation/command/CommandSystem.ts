import type { Messenger } from './Messenger';
import type { Order, OrderManager } from '../OrderManager';
import type { UnitManager } from '../units/UnitManager';
import type { PathManager } from '../pathfinding/PathManager';
import { eventBus } from '../../core/EventBus';
import type { Serializable } from '../persistence/Serializable';
import type { CommandSnapshot } from '../persistence/SaveTypes';
import {
  OrderType, TILE_SIZE, SIM_TICK_RATE,
  COMMAND_RADIUS_FRACTION, DEFAULT_MAP_WIDTH,
  MESSENGER_SPEED, MESSENGER_SPEED_IN_RADIUS,
  MESSENGER_RETREAT_SPEED_BONUS,
  MESSENGER_RALLY_DELAY_MULTIPLIER,
  GENERAL_DEAD_MESSENGER_SPEED_MULT,
  GENERAL_DEAD_MISINTERPRET_CHANCE,
  RALLY_MORALE_THRESHOLD_OFFSET,
  MESSENGER_TRAIL_INTERVAL_TICKS,
} from '../../constants';

interface QueuedOrder {
  order: Order;
}

// Misinterpretation mapping when general is dead
const MISINTERPRET_MAP: Partial<Record<OrderType, OrderType>> = {
  [OrderType.MOVE]: OrderType.CHARGE,
  [OrderType.RETREAT]: OrderType.HOLD,
  [OrderType.CHARGE]: OrderType.MOVE,
  [OrderType.HOLD]: OrderType.RETREAT,
  [OrderType.ATTACK]: OrderType.MOVE,
  [OrderType.FLANK]: OrderType.ATTACK,
  [OrderType.FORM_UP]: OrderType.MOVE,
  [OrderType.DISENGAGE]: OrderType.HOLD,
  [OrderType.RALLY]: OrderType.HOLD,
};

export class CommandSystem implements Serializable<CommandSnapshot> {
  private messengers: Messenger[] = [];
  private nextMessengerId = 1;
  private queue: QueuedOrder[] = [];
  private commandRadiusPixels: number;

  constructor() {
    this.commandRadiusPixels = DEFAULT_MAP_WIDTH * TILE_SIZE * COMMAND_RADIUS_FRACTION;
  }

  get commandRadius(): number {
    return this.commandRadiusPixels;
  }

  /** Issue an order — dispatches messenger or queues if paused. */
  issueOrder(
    order: Order,
    unitManager: UnitManager,
    isPaused: boolean,
  ): void {
    if (isPaused) {
      this.queue.push({ order });
      return;
    }

    const general = unitManager.getGeneral(
      unitManager.get(order.unitId)?.team ?? 0,
    );
    const generalAlive = !!general;
    const generalX = general?.x ?? 0;
    const generalY = general?.y ?? 0;

    this.dispatchMessenger(order, generalX, generalY, generalAlive, 0);
  }

  /** On unpause, dispatch all queued orders. */
  flushQueue(unitManager: UnitManager, currentTick: number): void {
    for (const queued of this.queue) {
      const team = unitManager.get(queued.order.unitId)?.team ?? 0;
      const general = unitManager.getGeneral(team);
      const generalAlive = !!general;
      const gx = general?.x ?? 0;
      const gy = general?.y ?? 0;
      this.dispatchMessenger(queued.order, gx, gy, generalAlive, currentTick);
    }
    this.queue = [];
  }

  /** Advance all messengers, deliver orders on arrival. */
  tick(
    currentTick: number,
    unitManager: UnitManager,
    orderManager: OrderManager,
    pathManager: PathManager,
  ): void {
    for (let i = this.messengers.length - 1; i >= 0; i--) {
      const m = this.messengers[i];
      if (m.delivered) continue;

      // Update target position to track moving unit
      const target = unitManager.get(m.targetUnitId);
      if (target) {
        m.targetX = target.x;
        m.targetY = target.y;
      }

      // Move messenger toward target
      const dx = m.targetX - m.currentX;
      const dy = m.targetY - m.currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const speedPixelsPerTick = (m.speed * TILE_SIZE) / SIM_TICK_RATE;

      if (dist <= speedPixelsPerTick) {
        // Arrived — deliver order
        m.currentX = m.targetX;
        m.currentY = m.targetY;
        m.delivered = true;
        this.deliverOrder(m, unitManager, orderManager, pathManager);
        this.messengers.splice(i, 1);
      } else {
        // Move toward target
        m.currentX += (dx / dist) * speedPixelsPerTick;
        m.currentY += (dy / dist) * speedPixelsPerTick;

        // Record trail
        if ((currentTick - m.spawnTick) % MESSENGER_TRAIL_INTERVAL_TICKS === 0) {
          m.trail.push({ x: m.currentX, y: m.currentY, tick: currentTick });
        }
      }
    }
  }

  getActiveMessengers(): readonly Messenger[] {
    return this.messengers;
  }

  private dispatchMessenger(
    order: Order,
    generalX: number,
    generalY: number,
    generalAlive: boolean,
    currentTick: number,
  ): void {
    // Calculate speed based on context
    let speed = MESSENGER_SPEED;

    // Check if target is within command radius
    const tx = order.targetX ?? 0;
    const ty = order.targetY ?? 0;
    const dxToTarget = tx - generalX;
    const dyToTarget = ty - generalY;
    const distToTarget = Math.sqrt(dxToTarget * dxToTarget + dyToTarget * dyToTarget);

    if (distToTarget <= this.commandRadiusPixels) {
      speed = MESSENGER_SPEED_IN_RADIUS;
    }

    // Order-specific speed modifiers
    if (order.type === OrderType.RETREAT) speed *= MESSENGER_RETREAT_SPEED_BONUS;
    if (order.type === OrderType.RALLY) speed /= MESSENGER_RALLY_DELAY_MULTIPLIER;

    // General dead: messengers move slower
    if (!generalAlive) speed *= GENERAL_DEAD_MESSENGER_SPEED_MULT;

    const messenger: Messenger = {
      id: this.nextMessengerId++,
      fromX: generalX,
      fromY: generalY,
      targetUnitId: order.unitId,
      orderType: order.type,
      targetX: tx,
      targetY: ty,
      orderTargetX: tx,
      orderTargetY: ty,
      currentX: generalX,
      currentY: generalY,
      speed,
      spawnTick: currentTick,
      delivered: false,
      trail: [],
    };

    this.messengers.push(messenger);
    eventBus.emit('command:messengerSent', {
      targetUnitId: order.unitId,
      orderType: order.type,
    });
  }

  private deliverOrder(
    messenger: Messenger,
    unitManager: UnitManager,
    orderManager: OrderManager,
    pathManager: PathManager,
  ): void {
    const unit = unitManager.get(messenger.targetUnitId);
    if (!unit) return;

    let orderType = messenger.orderType;

    // General dead: chance of misinterpretation
    const general = unitManager.getGeneral(unit.team);
    if (!general) {
      if (Math.random() < GENERAL_DEAD_MISINTERPRET_CHANCE) {
        const newType = MISINTERPRET_MAP[orderType];
        if (newType !== undefined) {
          eventBus.emit('command:orderMisinterpreted', {
            targetUnitId: messenger.targetUnitId,
            originalType: orderType,
            newType,
          });
          orderType = newType;
        }
      }
    }

    // Rally check: only if morale is above rout threshold + offset
    if (orderType === OrderType.RALLY) {
      const routThreshold = getRoutThreshold(unit.experience, unit.type);
      if (unit.morale <= routThreshold + RALLY_MORALE_THRESHOLD_OFFSET) {
        // Rally fails — morale too low
        return;
      }
    }

    // Apply the order (use original order destination, not messenger's current tracking position)
    const order: Order = {
      type: orderType,
      unitId: messenger.targetUnitId,
      targetX: messenger.orderTargetX,
      targetY: messenger.orderTargetY,
    };
    orderManager.setOrder(messenger.targetUnitId, order);

    // Wire movement orders to pathfinding
    if (
      orderType === OrderType.MOVE
      || orderType === OrderType.ATTACK
      || orderType === OrderType.RETREAT
      || orderType === OrderType.FLANK
      || orderType === OrderType.CHARGE
      || orderType === OrderType.DISENGAGE
    ) {
      unit.targetX = messenger.orderTargetX;
      unit.targetY = messenger.orderTargetY;
      pathManager.requestPath(unit, messenger.orderTargetX, messenger.orderTargetY);
    }

    // Clear pending indicator
    unit.pendingOrderType = null;
    unit.pendingOrderTick = 0;

    eventBus.emit('command:orderDelivered', {
      targetUnitId: messenger.targetUnitId,
      orderType,
    });
  }

  clear(): void {
    this.messengers = [];
    this.queue = [];
    this.nextMessengerId = 1;
  }

  serialize(): CommandSnapshot {
    return {
      messengers: this.messengers.map(m => ({
        id: m.id,
        sourceX: m.fromX,
        sourceY: m.fromY,
        targetUnitId: m.targetUnitId,
        orderType: m.orderType,
        x: m.currentX,
        y: m.currentY,
        delivered: m.delivered,
        trail: m.trail.map(t => ({ x: t.x, y: t.y })),
      })),
      nextMessengerId: this.nextMessengerId,
      queue: this.queue.map(q => ({
        order: {
          unitId: q.order.unitId,
          type: q.order.type,
          targetX: q.order.targetX,
          targetY: q.order.targetY,
          targetUnitId: q.order.targetUnitId,
        },
        sourceX: 0,
        sourceY: 0,
      })),
    };
  }

  deserialize(data: CommandSnapshot): void {
    this.messengers = data.messengers.map(s => ({
      id: s.id,
      fromX: s.sourceX,
      fromY: s.sourceY,
      targetUnitId: s.targetUnitId,
      orderType: s.orderType,
      targetX: s.x,
      targetY: s.y,
      orderTargetX: s.x,
      orderTargetY: s.y,
      currentX: s.x,
      currentY: s.y,
      speed: MESSENGER_SPEED,
      spawnTick: 0,
      delivered: s.delivered,
      trail: s.trail.map(t => ({ x: t.x, y: t.y, tick: 0 })),
    }));
    this.nextMessengerId = data.nextMessengerId;
    this.queue = data.queue.map(q => ({
      order: {
        type: q.order.type,
        unitId: q.order.unitId,
        targetX: q.order.targetX,
        targetY: q.order.targetY,
        targetUnitId: q.order.targetUnitId,
      },
    }));
  }
}

// Helper — duplicated here to avoid circular deps. MoraleSystem has the canonical version.
function getRoutThreshold(experience: number, _type: number): number {
  if (experience >= 80) return 5;
  if (experience >= 60) return 10;
  if (experience >= 20) return 15;
  return 25;
}
