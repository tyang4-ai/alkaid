import { describe, it, expect, beforeEach } from 'vitest';
import { OrderManager } from '../OrderManager';
import { OrderType } from '../../constants';

describe('OrderManager', () => {
  let mgr: OrderManager;
  beforeEach(() => { mgr = new OrderManager(); });

  it('stores and retrieves an order', () => {
    mgr.setOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 100, targetY: 200 });
    const order = mgr.getOrder(1);
    expect(order).toBeDefined();
    expect(order!.type).toBe(OrderType.MOVE);
    expect(order!.targetX).toBe(100);
  });

  it('replaces existing order', () => {
    mgr.setOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 100, targetY: 200 });
    mgr.setOrder(1, { type: OrderType.HOLD, unitId: 1 });
    expect(mgr.getOrder(1)!.type).toBe(OrderType.HOLD);
  });

  it('returns undefined for missing unit', () => {
    expect(mgr.getOrder(999)).toBeUndefined();
  });

  it('clearOrder removes and returns true', () => {
    mgr.setOrder(1, { type: OrderType.ATTACK, unitId: 1, targetUnitId: 5 });
    expect(mgr.clearOrder(1)).toBe(true);
    expect(mgr.getOrder(1)).toBeUndefined();
  });

  it('clearOrder returns false for missing', () => {
    expect(mgr.clearOrder(999)).toBe(false);
  });

  it('clear removes all orders', () => {
    mgr.setOrder(1, { type: OrderType.MOVE, unitId: 1 });
    mgr.setOrder(2, { type: OrderType.HOLD, unitId: 2 });
    mgr.clear();
    expect(mgr.getOrder(1)).toBeUndefined();
    expect(mgr.getOrder(2)).toBeUndefined();
  });
});
