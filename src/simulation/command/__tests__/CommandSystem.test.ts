import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandSystem } from '../CommandSystem';
import { UnitManager } from '../../units/UnitManager';
import { OrderManager } from '../../OrderManager';
import { PathManager } from '../../pathfinding/PathManager';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import {
  UnitType, OrderType, UnitState, TILE_SIZE, SIM_TICK_RATE,
  MESSENGER_SPEED, MESSENGER_SPEED_IN_RADIUS,
} from '../../../constants';

function makeGrid(w = 50, h = 50): TerrainGrid {
  const terrain = new Uint8Array(w * h).fill(2); // PLAINS
  return new TerrainGrid({
    width: w, height: h, seed: 0, templateId: 'test',
    elevation: new Float32Array(w * h),
    moisture: new Float32Array(w * h),
    terrain,
    riverFlow: new Int8Array(w * h).fill(-1),
    tileBitmask: new Uint8Array(w * h),
  });
}

describe('CommandSystem', () => {
  let cs: CommandSystem;
  let um: UnitManager;
  let om: OrderManager;
  let pm: PathManager;

  beforeEach(() => {
    cs = new CommandSystem();
    um = new UnitManager();
    om = new OrderManager();
    pm = new PathManager(makeGrid());
  });

  it('dispatches messenger when not paused', () => {
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 200, y: 200 });

    cs.issueOrder(
      { type: OrderType.MOVE, unitId: unit.id, targetX: 300, targetY: 300 },
      um, false,
    );

    expect(cs.getActiveMessengers().length).toBe(1);
    expect(cs.getActiveMessengers()[0].orderType).toBe(OrderType.MOVE);
  });

  it('queues orders when paused and flushes on unpause', () => {
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 200, y: 200 });

    cs.issueOrder(
      { type: OrderType.MOVE, unitId: unit.id, targetX: 300, targetY: 300 },
      um, true, // paused
    );

    expect(cs.getActiveMessengers().length).toBe(0);

    cs.flushQueue(um, 10);
    expect(cs.getActiveMessengers().length).toBe(1);
  });

  it('messenger travels and delivers order', () => {
    const general = um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 116, y: 100 }); // 1 tile away

    cs.issueOrder(
      { type: OrderType.HOLD, unitId: unit.id, targetX: 116, targetY: 100 },
      um, false,
    );

    // Tick many times to ensure delivery
    for (let t = 0; t < 200; t++) {
      cs.tick(t, um, om, pm);
      if (cs.getActiveMessengers().length === 0) break;
    }

    expect(cs.getActiveMessengers().length).toBe(0);
    expect(om.getOrder(unit.id)?.type).toBe(OrderType.HOLD);
  });

  it('messenger speed varies with command radius', () => {
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });

    // Close unit (within command radius)
    const close = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 150, y: 100 });
    cs.issueOrder(
      { type: OrderType.MOVE, unitId: close.id, targetX: 150, targetY: 100 },
      um, false,
    );

    // Far unit (outside command radius)
    const far = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 3000, y: 100 });
    cs.issueOrder(
      { type: OrderType.MOVE, unitId: far.id, targetX: 3000, targetY: 100 },
      um, false,
    );

    const messengers = cs.getActiveMessengers();
    expect(messengers.length).toBe(2);

    const closeM = messengers.find(m => m.targetUnitId === close.id)!;
    const farM = messengers.find(m => m.targetUnitId === far.id)!;
    expect(closeM.speed).toBeGreaterThan(farM.speed);
  });

  it('retreat orders get speed bonus', () => {
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 3000, y: 100 });

    cs.issueOrder(
      { type: OrderType.RETREAT, unitId: unit.id, targetX: 3000, targetY: 100 },
      um, false,
    );

    const unit2 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 3000, y: 200 });
    cs.issueOrder(
      { type: OrderType.MOVE, unitId: unit2.id, targetX: 3000, targetY: 200 },
      um, false,
    );

    const messengers = cs.getActiveMessengers();
    const retreatM = messengers.find(m => m.targetUnitId === unit.id)!;
    const moveM = messengers.find(m => m.targetUnitId === unit2.id)!;
    expect(retreatM.speed).toBeGreaterThan(moveM.speed);
  });

  it('rally orders are slower (2x delay)', () => {
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 3000, y: 100 });

    cs.issueOrder(
      { type: OrderType.RALLY, unitId: unit.id, targetX: 3000, targetY: 100 },
      um, false,
    );

    const unit2 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 3000, y: 200 });
    cs.issueOrder(
      { type: OrderType.MOVE, unitId: unit2.id, targetX: 3000, targetY: 200 },
      um, false,
    );

    const messengers = cs.getActiveMessengers();
    const rallyM = messengers.find(m => m.targetUnitId === unit.id)!;
    const moveM = messengers.find(m => m.targetUnitId === unit2.id)!;
    expect(rallyM.speed).toBeLessThan(moveM.speed);
  });

  it('messenger speed halved when general is dead', () => {
    // No general alive for team 0 — general fallback position is (0,0)
    // Place unit far from origin so it's outside command radius (960px)
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 2000, y: 2000 });

    cs.issueOrder(
      { type: OrderType.MOVE, unitId: unit.id, targetX: 2000, targetY: 2000 },
      um, false,
    );

    const m = cs.getActiveMessengers()[0];
    // Without general, speed is base * 0.5 = 4.0 * 0.5 = 2.0
    expect(m.speed).toBeLessThanOrEqual(MESSENGER_SPEED * 0.5 + 0.01);
  });

  it('messenger records trail positions', () => {
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 500, y: 100 });

    cs.issueOrder(
      { type: OrderType.MOVE, unitId: unit.id, targetX: 500, targetY: 100 },
      um, false,
    );

    // Tick several times to accumulate trail
    for (let t = 0; t < 20; t++) {
      cs.tick(t, um, om, pm);
    }

    const messengers = cs.getActiveMessengers();
    if (messengers.length > 0) {
      expect(messengers[0].trail.length).toBeGreaterThan(0);
    }
  });

  it('clear resets all state', () => {
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 200, y: 200 });

    cs.issueOrder(
      { type: OrderType.MOVE, unitId: unit.id, targetX: 300, targetY: 300 },
      um, false,
    );

    cs.clear();
    expect(cs.getActiveMessengers().length).toBe(0);
  });

  it('movement orders wire to pathfinding on delivery', () => {
    const general = um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 116, y: 100 });

    cs.issueOrder(
      { type: OrderType.MOVE, unitId: unit.id, targetX: 300, targetY: 300 },
      um, false,
    );

    // Tick until delivery
    for (let t = 0; t < 200; t++) {
      cs.tick(t, um, om, pm);
    }

    expect(unit.targetX).toBe(300);
    expect(unit.targetY).toBe(300);
  });
});
