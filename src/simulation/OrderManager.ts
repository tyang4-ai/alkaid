import { eventBus } from '../core/EventBus';
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
  private orders = new Map<number, Order>();

  setOrder(unitId: number, order: Order): void {
    this.orders.set(unitId, order);
    eventBus.emit('order:issued', { unitId, type: order.type });
  }

  getOrder(unitId: number): Order | undefined {
    return this.orders.get(unitId);
  }

  clearOrder(unitId: number): boolean {
    const had = this.orders.delete(unitId);
    if (had) eventBus.emit('order:cleared', { unitId });
    return had;
  }

  getAll(): IterableIterator<Order> {
    return this.orders.values();
  }

  clear(): void {
    this.orders.clear();
  }

  serialize(): OrderSnapshot[] {
    const result: OrderSnapshot[] = [];
    for (const [unitId, order] of this.orders) {
      result.push({
        unitId,
        type: order.type,
        targetX: order.targetX,
        targetY: order.targetY,
        targetUnitId: order.targetUnitId,
      });
    }
    return result;
  }

  deserialize(data: OrderSnapshot[]): void {
    this.orders.clear();
    for (const s of data) {
      this.orders.set(s.unitId, {
        type: s.type,
        unitId: s.unitId,
        targetX: s.targetX,
        targetY: s.targetY,
        targetUnitId: s.targetUnitId,
      });
    }
  }
}
