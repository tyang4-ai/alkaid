import { eventBus } from '../core/EventBus';
import { ORDER_QUEUE_MAX_LENGTH } from '../constants';
import type { OrderType } from '../constants';
import type { Serializable } from './persistence/Serializable';
import type { OrderSnapshot } from './persistence/SaveTypes';

export interface Order {
  type: OrderType;
  unitId: number;
  targetX?: number;
  targetY?: number;
  targetUnitId?: number;
}

export class OrderManager implements Serializable<OrderSnapshot[]> {
  private orders = new Map<number, Order[]>();

  /** Replace the entire queue with a single order (backward compatible). */
  setOrder(unitId: number, order: Order): void {
    this.orders.set(unitId, [order]);
    eventBus.emit('order:issued', { unitId, type: order.type });
  }

  /** Append an order to the end of the queue (shift+right-click). */
  appendOrder(unitId: number, order: Order): void {
    let queue = this.orders.get(unitId);
    if (!queue) {
      queue = [];
      this.orders.set(unitId, queue);
    }
    if (queue.length >= ORDER_QUEUE_MAX_LENGTH) return; // queue full
    queue.push(order);
    eventBus.emit('order:queued', { unitId, type: order.type, queueLength: queue.length });
  }

  /** Get the current (first) order for a unit. */
  getOrder(unitId: number): Order | undefined {
    const queue = this.orders.get(unitId);
    return queue && queue.length > 0 ? queue[0] : undefined;
  }

  /** Get the full order queue for rendering/inspection. */
  peekQueue(unitId: number): Order[] {
    return this.orders.get(unitId) ?? [];
  }

  /** Advance to the next order in the queue. Returns the new current order, or undefined if empty. */
  advanceOrder(unitId: number): Order | undefined {
    const queue = this.orders.get(unitId);
    if (!queue || queue.length === 0) return undefined;
    queue.shift();
    if (queue.length === 0) {
      this.orders.delete(unitId);
      eventBus.emit('order:cleared', { unitId });
      return undefined;
    }
    eventBus.emit('order:issued', { unitId, type: queue[0].type });
    return queue[0];
  }

  clearOrder(unitId: number): boolean {
    const had = this.orders.delete(unitId);
    if (had) eventBus.emit('order:cleared', { unitId });
    return had;
  }

  getAll(): IterableIterator<Order> {
    // Return iterator over current (first) orders for backward compat
    const currentOrders: Order[] = [];
    for (const queue of this.orders.values()) {
      if (queue.length > 0) currentOrders.push(queue[0]);
    }
    return currentOrders.values();
  }

  clear(): void {
    this.orders.clear();
  }

  serialize(): OrderSnapshot[] {
    const result: OrderSnapshot[] = [];
    for (const [unitId, queue] of this.orders) {
      for (const order of queue) {
        result.push({
          unitId,
          type: order.type,
          targetX: order.targetX,
          targetY: order.targetY,
          targetUnitId: order.targetUnitId,
        });
      }
    }
    return result;
  }

  deserialize(data: OrderSnapshot[]): void {
    this.orders.clear();
    for (const s of data) {
      const order: Order = {
        type: s.type,
        unitId: s.unitId,
        targetX: s.targetX,
        targetY: s.targetY,
        targetUnitId: s.targetUnitId,
      };
      let queue = this.orders.get(s.unitId);
      if (!queue) {
        queue = [];
        this.orders.set(s.unitId, queue);
      }
      queue.push(order);
    }
  }
}
