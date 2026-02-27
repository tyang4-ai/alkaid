import { eventBus } from '../core/EventBus';
import type { OrderType } from '../constants';

export interface Order {
  type: OrderType;
  unitId: number;
  targetX?: number;
  targetY?: number;
  targetUnitId?: number;
}

export class OrderManager {
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
}
