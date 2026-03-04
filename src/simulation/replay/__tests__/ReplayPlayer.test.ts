import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayPlayer } from '../ReplayPlayer';
import { OrderType, REPLAY_VERSION } from '../../../constants';
import type { ReplaySnapshot } from '../../persistence/SaveTypes';

function makeReplaySnapshot(overrides: Partial<ReplaySnapshot> = {}): ReplaySnapshot {
  return {
    version: REPLAY_VERSION,
    terrainSeed: 42,
    templateId: 'test-map',
    initialUnits: [],
    frames: [
      {
        tick: 5,
        orders: [{ unitId: 1, orderType: OrderType.MOVE, targetX: 100, targetY: 200, team: 0 }],
      },
      {
        tick: 10,
        orders: [{ unitId: 2, orderType: OrderType.ATTACK, targetX: 150, targetY: 250, targetUnitId: 3, team: 1 }],
      },
      {
        tick: 15,
        orders: [
          { unitId: 1, orderType: OrderType.HOLD, targetX: 100, targetY: 200, team: 0 },
          { unitId: 3, orderType: OrderType.RETREAT, targetX: 50, targetY: 50, team: 0 },
        ],
      },
    ],
    totalTicks: 100,
    environmentInit: { weather: 0, timeOfDay: 1, windDirection: 0, visibility: 1 },
    aiPersonality: 1,
    aiSeed: 123,
    ...overrides,
  };
}

describe('ReplayPlayer', () => {
  let player: ReplayPlayer;

  beforeEach(() => {
    player = new ReplayPlayer(makeReplaySnapshot());
  });

  it('starts in replay mode', () => {
    expect(player.isReplayMode()).toBe(true);
    expect(player.getCurrentTick()).toBe(0);
    expect(player.getTotalTicks()).toBe(100);
  });

  it('replays orders at correct ticks', () => {
    // Before tick 5: no orders
    expect(player.getOrdersForTick(3)).toHaveLength(0);
    expect(player.getOrdersForTick(4)).toHaveLength(0);

    // Tick 5: one order
    const ordersAt5 = player.getOrdersForTick(5);
    expect(ordersAt5).toHaveLength(1);
    expect(ordersAt5[0].unitId).toBe(1);
    expect(ordersAt5[0].orderType).toBe(OrderType.MOVE);

    // Tick 6-9: no orders
    expect(player.getOrdersForTick(6)).toHaveLength(0);

    // Tick 10: one order
    const ordersAt10 = player.getOrdersForTick(10);
    expect(ordersAt10).toHaveLength(1);
    expect(ordersAt10[0].unitId).toBe(2);
  });

  it('replays multiple orders at same tick', () => {
    // Need to advance through ticks 5 and 10 first
    player.getOrdersForTick(5);
    player.getOrdersForTick(10);
    const orders = player.getOrdersForTick(15);
    expect(orders).toHaveLength(2);
  });

  it('scrub resets frame index', () => {
    // Advance past tick 5
    player.getOrdersForTick(5);
    player.getOrdersForTick(10);

    // Scrub back to before tick 5
    player.scrubTo(3);
    expect(player.getCurrentTick()).toBe(3);

    // Should be able to replay from tick 5 again
    const orders = player.getOrdersForTick(5);
    expect(orders).toHaveLength(1);
  });

  it('getAllOrdersUpTo returns all orders before tick', () => {
    const allUpTo12 = player.getAllOrdersUpTo(12);
    expect(allUpTo12).toHaveLength(2); // Frames at tick 5 and 10
    expect(allUpTo12[0].tick).toBe(5);
    expect(allUpTo12[1].tick).toBe(10);
  });

  it('speed can be set', () => {
    player.speed = 4;
    expect(player.speed).toBe(4);
  });

  it('stop ends replay mode', () => {
    player.stop();
    expect(player.isReplayMode()).toBe(false);
  });
});
