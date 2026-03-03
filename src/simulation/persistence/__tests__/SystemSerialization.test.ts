import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../GameState';
import { UnitManager } from '../../units/UnitManager';
import { OrderManager } from '../../OrderManager';
import { SupplySystem } from '../../metrics/SupplySystem';
import { SurrenderSystem } from '../../combat/SurrenderSystem';
import { CommandSystem } from '../../command/CommandSystem';
import { UnitType, OrderType, UnitState } from '../../../constants';
import type { GameStateSnapshot, OrderSnapshot, SupplySnapshot, SurrenderSnapshot, CommandSnapshot } from '../SaveTypes';
import type { UnitSnapshot } from '../SaveTypes';
import { TerrainGrid } from '../../terrain/TerrainGrid';

// --- GameState serialization ---
describe('GameState serialization', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = new GameState();
  });

  it('round-trips all fields', () => {
    // Set non-default values
    gs.tick(0); gs.tick(0); gs.tick(0); // tickNumber=3, battleTimeTicks=3
    gs.setPaused(true);
    gs.setSpeedMultiplier(2.5);

    const snapshot: GameStateSnapshot = gs.serialize();
    expect(snapshot.tickNumber).toBe(3);
    expect(snapshot.paused).toBe(true);
    expect(snapshot.speedMultiplier).toBe(2.5);
    expect(snapshot.battleTimeTicks).toBe(3);

    // Restore into fresh instance
    const gs2 = new GameState();
    gs2.deserialize(snapshot);
    const s = gs2.getState();
    expect(s.tickNumber).toBe(3);
    expect(s.paused).toBe(true);
    expect(s.speedMultiplier).toBe(2.5);
    expect(s.battleTimeTicks).toBe(3);
  });
});

// --- UnitManager serialization ---
describe('UnitManager serialization', () => {
  let um: UnitManager;

  beforeEach(() => {
    um = new UnitManager();
  });

  it('round-trips multiple units with varied state', () => {
    // Spawn 3 units with different states
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 200 });
    const u2 = um.spawn({ type: UnitType.DAO_SWORDSMEN, team: 1, x: 300, y: 400, size: 50 });
    const u3 = um.spawn({ type: UnitType.GENERAL, team: 0, x: 500, y: 600, isGeneral: true });

    // Modify states
    u1.state = UnitState.MOVING;
    u1.path = [{ x: 150, y: 250 }, { x: 200, y: 300 }];
    u1.pathIndex = 1;
    u1.morale = 45;
    u1.fatigue = 30;

    u2.state = UnitState.DEAD;
    u2.size = 0;
    u2.hp = 0;
    u2.killCount = 15;

    u3.combatTargetId = u2.id;
    u3.combatTicks = 10;
    u3.experience = 50;

    const snapshot = um.serialize();
    expect(snapshot.units).toHaveLength(3);
    expect(snapshot.nextId).toBe(4); // after spawning 3 units

    // Restore into fresh instance
    const um2 = new UnitManager();
    um2.deserialize(snapshot);
    expect(um2.count).toBe(3);

    const r1 = um2.get(u1.id)!;
    expect(r1.type).toBe(UnitType.JI_HALBERDIERS);
    expect(r1.state).toBe(UnitState.MOVING);
    expect(r1.path).toEqual([{ x: 150, y: 250 }, { x: 200, y: 300 }]);
    expect(r1.pathIndex).toBe(1);
    expect(r1.morale).toBe(45);
    expect(r1.fatigue).toBe(30);

    const r2 = um2.get(u2.id)!;
    expect(r2.state).toBe(UnitState.DEAD);
    expect(r2.size).toBe(0);
    expect(r2.killCount).toBe(15);

    const r3 = um2.get(u3.id)!;
    expect(r3.combatTargetId).toBe(u2.id);
    expect(r3.combatTicks).toBe(10);
    expect(r3.experience).toBe(50);
    expect(r3.isGeneral).toBe(true);
  });

  it('preserves nextId so new spawns don\'t collide', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 0, y: 0 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 0, y: 0 });

    const snapshot = um.serialize();
    const um2 = new UnitManager();
    um2.deserialize(snapshot);

    const newUnit = um2.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 0, y: 0 });
    expect(newUnit.id).toBe(3); // nextId was 3 after 2 spawns
  });
});

// --- OrderManager serialization ---
describe('OrderManager serialization', () => {
  let om: OrderManager;

  beforeEach(() => {
    om = new OrderManager();
  });

  it('round-trips orders', () => {
    om.setOrder(1, { type: OrderType.ATTACK, unitId: 1, targetX: 100, targetY: 200 });
    om.setOrder(2, { type: OrderType.HOLD, unitId: 2 });

    const snapshot: OrderSnapshot[] = om.serialize();
    expect(snapshot).toHaveLength(2);

    const om2 = new OrderManager();
    om2.deserialize(snapshot);

    const o1 = om2.getOrder(1);
    expect(o1).toBeDefined();
    expect(o1!.type).toBe(OrderType.ATTACK);
    expect(o1!.targetX).toBe(100);
    expect(o1!.targetY).toBe(200);

    const o2 = om2.getOrder(2);
    expect(o2).toBeDefined();
    expect(o2!.type).toBe(OrderType.HOLD);
  });

  it('handles empty orders', () => {
    const snapshot = om.serialize();
    expect(snapshot).toHaveLength(0);

    const om2 = new OrderManager();
    om2.deserialize(snapshot);
    expect(om2.getOrder(1)).toBeUndefined();
  });
});

// --- SupplySystem serialization ---
describe('SupplySystem serialization', () => {
  it('round-trips army supply state', () => {
    const grid = new TerrainGrid(10, 10);
    const ss = new SupplySystem(grid);
    ss.initArmy(0, 5000, 6000);
    ss.initArmy(1, 3000, 6000);
    ss.setFood(0, 4500);

    const snapshot: SupplySnapshot = ss.serialize();
    expect(snapshot.armies).toHaveLength(2);

    const ss2 = new SupplySystem(grid);
    ss2.deserialize(snapshot);

    // Verify food levels roundtrip
    expect(ss2.getFoodPercent(0)).toBeCloseTo(75, 0); // 4500/6000 = 75%
    expect(ss2.getFoodPercent(1)).toBeCloseTo(50, 0); // 3000/6000 = 50%
  });
});

// --- SurrenderSystem serialization ---
describe('SurrenderSystem serialization', () => {
  it('round-trips team surrender state', () => {
    const ss = new SurrenderSystem();
    // Manually build state since initBattle needs unitManager
    const snapshot: SurrenderSnapshot = {
      teamStates: [
        { team: 0, consecutiveHighPressureChecks: 3, lastPressure: 85, surrendered: false, startingSoldiers: 1000 },
        { team: 1, consecutiveHighPressureChecks: 0, lastPressure: 20, surrendered: false, startingSoldiers: 800 },
      ],
    };

    ss.deserialize(snapshot);

    // Verify state was restored
    expect(ss.getPressure(0)).toBe(85);
    expect(ss.getPressure(1)).toBe(20);
    expect(ss.hasSurrendered(0)).toBe(false);
    expect(ss.hasSurrendered(1)).toBe(false);

    // Re-serialize and verify round-trip
    const snapshot2 = ss.serialize();
    expect(snapshot2.teamStates).toHaveLength(2);
    expect(snapshot2.teamStates[0].consecutiveHighPressureChecks).toBe(3);
    expect(snapshot2.teamStates[0].startingSoldiers).toBe(1000);
  });
});

// --- CommandSystem serialization ---
describe('CommandSystem serialization', () => {
  it('round-trips messengers and queue', () => {
    const cs = new CommandSystem();

    // Set up state via serialization (since we can't directly push messengers)
    const snapshot: CommandSnapshot = {
      messengers: [
        {
          id: 1,
          sourceX: 100, sourceY: 100,
          targetUnitId: 5,
          orderType: OrderType.ATTACK,
          x: 150, y: 150,
          delivered: false,
          trail: [{ x: 110, y: 110 }, { x: 130, y: 130 }],
        },
        {
          id: 2,
          sourceX: 200, sourceY: 200,
          targetUnitId: 8,
          orderType: OrderType.RETREAT,
          x: 200, y: 200,
          delivered: false,
          trail: [],
        },
      ],
      nextMessengerId: 3,
      queue: [
        {
          order: { unitId: 10, type: OrderType.HOLD },
          sourceX: 50, sourceY: 50,
        },
      ],
    };

    cs.deserialize(snapshot);

    const snapshot2 = cs.serialize();
    expect(snapshot2.messengers).toHaveLength(2);
    expect(snapshot2.messengers[0].x).toBe(150);
    expect(snapshot2.messengers[0].trail).toHaveLength(2);
    expect(snapshot2.messengers[1].orderType).toBe(OrderType.RETREAT);
    expect(snapshot2.nextMessengerId).toBe(3);
    expect(snapshot2.queue).toHaveLength(1);
    expect(snapshot2.queue[0].order.type).toBe(OrderType.HOLD);
  });
});
