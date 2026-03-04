import { describe, it, expect, beforeEach } from 'vitest';
import { OrderManager } from '../OrderManager';
import { OrderType, ORDER_QUEUE_MAX_LENGTH } from '../../constants';

describe('OrderManager queue extension', () => {
  let mgr: OrderManager;

  beforeEach(() => {
    mgr = new OrderManager();
  });

  it('appendOrder adds to empty queue', () => {
    mgr.appendOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 100, targetY: 200 });
    const order = mgr.getOrder(1);
    expect(order).toBeDefined();
    expect(order!.type).toBe(OrderType.MOVE);
    expect(mgr.peekQueue(1)).toHaveLength(1);
  });

  it('appendOrder adds to existing queue', () => {
    mgr.setOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 100, targetY: 100 });
    mgr.appendOrder(1, { type: OrderType.ATTACK, unitId: 1, targetX: 200, targetY: 200 });
    expect(mgr.peekQueue(1)).toHaveLength(2);
    expect(mgr.getOrder(1)!.type).toBe(OrderType.MOVE); // First in queue
  });

  it('setOrder clears queue and sets single order', () => {
    mgr.appendOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 100, targetY: 100 });
    mgr.appendOrder(1, { type: OrderType.ATTACK, unitId: 1, targetX: 200, targetY: 200 });
    expect(mgr.peekQueue(1)).toHaveLength(2);

    mgr.setOrder(1, { type: OrderType.HOLD, unitId: 1 });
    expect(mgr.peekQueue(1)).toHaveLength(1);
    expect(mgr.getOrder(1)!.type).toBe(OrderType.HOLD);
  });

  it('getOrder returns first element', () => {
    mgr.appendOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 50, targetY: 50 });
    mgr.appendOrder(1, { type: OrderType.HOLD, unitId: 1 });
    mgr.appendOrder(1, { type: OrderType.ATTACK, unitId: 1, targetUnitId: 5 });

    expect(mgr.getOrder(1)!.type).toBe(OrderType.MOVE);
  });

  it('advanceOrder shifts queue and returns new current', () => {
    mgr.appendOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 50, targetY: 50 });
    mgr.appendOrder(1, { type: OrderType.HOLD, unitId: 1 });

    const next = mgr.advanceOrder(1);
    expect(next).toBeDefined();
    expect(next!.type).toBe(OrderType.HOLD);
    expect(mgr.peekQueue(1)).toHaveLength(1);
  });

  it('advanceOrder returns undefined and clears when queue empty', () => {
    mgr.setOrder(1, { type: OrderType.MOVE, unitId: 1 });
    const next = mgr.advanceOrder(1);
    expect(next).toBeUndefined();
    expect(mgr.getOrder(1)).toBeUndefined();
  });

  it('queue max length enforced', () => {
    for (let i = 0; i < ORDER_QUEUE_MAX_LENGTH + 5; i++) {
      mgr.appendOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: i * 10, targetY: 0 });
    }
    expect(mgr.peekQueue(1)).toHaveLength(ORDER_QUEUE_MAX_LENGTH);
  });

  it('serialize/deserialize preserves queue order', () => {
    mgr.appendOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 10, targetY: 20 });
    mgr.appendOrder(1, { type: OrderType.HOLD, unitId: 1 });
    mgr.appendOrder(2, { type: OrderType.ATTACK, unitId: 2, targetUnitId: 5 });

    const serialized = mgr.serialize();
    const mgr2 = new OrderManager();
    mgr2.deserialize(serialized);

    expect(mgr2.peekQueue(1)).toHaveLength(2);
    expect(mgr2.getOrder(1)!.type).toBe(OrderType.MOVE);
    expect(mgr2.peekQueue(1)[1].type).toBe(OrderType.HOLD);
    expect(mgr2.getOrder(2)!.type).toBe(OrderType.ATTACK);
  });
});
