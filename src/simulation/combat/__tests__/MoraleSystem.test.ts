import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoraleSystem, getRoutThreshold } from '../MoraleSystem';
import { UnitManager } from '../../units/UnitManager';
import { OrderManager } from '../../OrderManager';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { UnitType, UnitState, OrderType, TerrainType } from '../../../constants';
import { eventBus } from '../../../core/EventBus';

function makeGrid(terrain: TerrainType = TerrainType.PLAINS, w = 200, h = 150): TerrainGrid {
  const size = w * h;
  return new TerrainGrid({
    width: w, height: h, seed: 1, templateId: 'test',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain: new Uint8Array(size).fill(terrain),
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size).fill(0),
  });
}

describe('getRoutThreshold', () => {
  it('returns 25 for conscripts (exp 0-19)', () => {
    expect(getRoutThreshold(0, UnitType.JI_HALBERDIERS)).toBe(25);
    expect(getRoutThreshold(19, UnitType.JI_HALBERDIERS)).toBe(25);
  });

  it('returns 15 for regulars (exp 20-59)', () => {
    expect(getRoutThreshold(20, UnitType.JI_HALBERDIERS)).toBe(15);
    expect(getRoutThreshold(59, UnitType.JI_HALBERDIERS)).toBe(15);
  });

  it('returns 10 for veterans (exp 60-79)', () => {
    expect(getRoutThreshold(60, UnitType.JI_HALBERDIERS)).toBe(10);
    expect(getRoutThreshold(79, UnitType.JI_HALBERDIERS)).toBe(10);
  });

  it('returns 5 for elite (exp 80+)', () => {
    expect(getRoutThreshold(80, UnitType.JI_HALBERDIERS)).toBe(5);
    expect(getRoutThreshold(100, UnitType.JI_HALBERDIERS)).toBe(5);
  });

  it('returns 5 for Elite Guard regardless of experience', () => {
    expect(getRoutThreshold(0, UnitType.ELITE_GUARD)).toBe(5);
    expect(getRoutThreshold(50, UnitType.ELITE_GUARD)).toBe(5);
  });
});

describe('MoraleSystem', () => {
  let ms: MoraleSystem;
  let um: UnitManager;
  let om: OrderManager;

  beforeEach(() => {
    ms = new MoraleSystem();
    um = new UnitManager();
    om = new OrderManager();
  });

  it('general nearby boosts morale', () => {
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 120, y: 100, morale: 50 });

    ms.tick(um, om);
    expect(unit.morale).toBeGreaterThan(50);
  });

  it('passive recovery when idle and not in combat', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50 });

    ms.tick(um, om);
    expect(unit.morale).toBeGreaterThan(50);
  });

  it('morale capped at 100', () => {
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 120, y: 100, morale: 99.5 });

    ms.tick(um, om);
    expect(unit.morale).toBeLessThanOrEqual(100);
  });

  it('unit routs when morale drops below threshold', () => {
    const unit = um.spawn({
      type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100,
      morale: 24, experience: 0, // Conscript: threshold 25, 24+0.5 passive = 24.5 ≤ 25
    });

    ms.tick(um, om);
    expect(unit.state).toBe(UnitState.ROUTING);
  });

  it('routing unit can be rallied with Rally order when morale recovers', () => {
    const unit = um.spawn({
      type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100,
      morale: 50, experience: 0, // threshold=25, needs >40 to rally
    });
    unit.state = UnitState.ROUTING;
    unit.routTicks = 0; // Can receive orders

    om.setOrder(unit.id, { type: OrderType.RALLY, unitId: unit.id });
    ms.tick(um, om);

    expect(unit.state).toBe(UnitState.IDLE);
  });

  it('rally fails when morale too low', () => {
    const unit = um.spawn({
      type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100,
      morale: 30, experience: 0, // threshold=25, needs >40 to rally, only at 30
    });
    unit.state = UnitState.ROUTING;
    unit.routTicks = 0;

    om.setOrder(unit.id, { type: OrderType.RALLY, unitId: unit.id });
    ms.tick(um, om);

    // Should still be routing
    expect(unit.state).toBe(UnitState.ROUTING);
  });

  it('rout cascade reduces morale of nearby friendlies', () => {
    const unit1 = um.spawn({
      type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100,
      morale: 24, experience: 0, // Will rout (24+0.5=24.5 ≤ 25)
    });
    const unit2 = um.spawn({
      type: UnitType.JI_HALBERDIERS, team: 0, x: 130, y: 100, // Within 5 tiles
      morale: 60,
    });

    ms.tick(um, om);

    expect(unit1.state).toBe(UnitState.ROUTING);
    expect(unit2.morale).toBeLessThan(60); // Hit by cascade
  });

  it('rout cascade does not affect enemies', () => {
    um.spawn({
      type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100,
      morale: 24, experience: 0, // Will rout (24+0.5=24.5 ≤ 25)
    });
    const enemy = um.spawn({
      type: UnitType.JI_HALBERDIERS, team: 1, x: 130, y: 100,
      morale: 60,
    });

    ms.tick(um, om);
    expect(enemy.morale).toBeGreaterThanOrEqual(60); // Not affected
  });

  it('applyCasualtyMorale reduces morale proportionally', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 70 });

    ms.applyCasualtyMorale(unit, 5); // 5% lost → -10 morale
    expect(unit.morale).toBe(60);
  });

  it('morale floor is 0', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 5 });

    ms.applyCasualtyMorale(unit, 50); // -100 morale
    expect(unit.morale).toBe(0);
  });

  it('routing unit cannot receive orders during routTicks', () => {
    const unit = um.spawn({
      type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100,
      morale: 24, experience: 0,
    });

    ms.tick(um, om);
    expect(unit.state).toBe(UnitState.ROUTING);
    expect(unit.routTicks).toBe(30); // ROUT_NO_ORDERS_TICKS

    // Rally should fail because routTicks > 0
    om.setOrder(unit.id, { type: OrderType.RALLY, unitId: unit.id });
    unit.morale = 80; // High enough to rally
    ms.tick(um, om);

    // routTicks still > 0 so unit stays routing (routTicks decremented by UnitManager, not MoraleSystem)
    expect(unit.state).toBe(UnitState.ROUTING);
  });
});

describe('MoraleSystem — Step 9a expansion', () => {
  let ms: MoraleSystem;
  let um: UnitManager;
  let om: OrderManager;

  beforeEach(() => {
    eventBus.clear();
    ms = new MoraleSystem();
    um = new UnitManager();
    om = new OrderManager();
  });

  it('Elite Guard aura boosts nearby same-team morale', () => {
    um.spawn({ type: UnitType.ELITE_GUARD, team: 0, x: 100, y: 100, morale: 80 });
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 120, y: 100, morale: 50 });

    ms.tick(um, om, new Map([[0, 100]]));
    // Should gain +3.0 from Elite Guard aura + 0.5 passive + 0.5 well-fed
    expect(unit.morale).toBeGreaterThanOrEqual(54);
  });

  it('Elite Guard aura does not affect units beyond radius', () => {
    um.spawn({ type: UnitType.ELITE_GUARD, team: 0, x: 100, y: 100, morale: 80 });
    const farUnit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 5000, y: 5000, morale: 50 });

    ms.tick(um, om, new Map([[0, 100]]));
    // Only passive +0.5 + well-fed +0.5, no aura
    expect(farUnit.morale).toBeCloseTo(51, 0);
  });

  it('low rations supply penalty (-1/tick)', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50 });
    unit.combatTargetId = 999; // in combat, no passive recovery

    ms.tick(um, om, new Map([[0, 40]])); // 40% = low rations (25-50)
    // -1 from low rations
    expect(unit.morale).toBeLessThan(50);
  });

  it('hunger supply penalty (-3/tick)', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50 });
    unit.combatTargetId = 999;

    ms.tick(um, om, new Map([[0, 10]])); // 10% = hunger (1-25)
    expect(unit.morale).toBeLessThanOrEqual(47); // 50 - 3 = 47
  });

  it('starvation supply penalty (-5/tick)', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50 });
    unit.combatTargetId = 999;

    ms.tick(um, om, new Map([[0, 0]])); // 0% = starvation
    expect(unit.morale).toBeLessThanOrEqual(45);
  });

  it('well-fed supply bonus (+0.5/tick)', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50 });
    unit.combatTargetId = 999; // no passive recovery

    ms.tick(um, om, new Map([[0, 100]])); // 100% = well-fed
    expect(unit.morale).toBeCloseTo(50.5, 1);
  });

  it('high fatigue penalty (-1 morale/tick when fatigue > 80)', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50 });
    unit.fatigue = 90;
    unit.combatTargetId = 999; // no passive recovery

    ms.tick(um, om, new Map([[0, 100]]));
    // +0.5 well-fed -1 fatigue = -0.5 net
    expect(unit.morale).toBeCloseTo(49.5, 1);
  });

  it('extended combat penalty (-0.5/tick after 30 combatTicks)', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50 });
    unit.combatTicks = 35;
    unit.combatTargetId = 999;

    ms.tick(um, om, new Map([[0, 100]]));
    // +0.5 well-fed -0.5 extended combat = 0 net
    expect(unit.morale).toBeCloseTo(50, 0);
  });

  it('applyGeneralKilled applies -30 army-wide', () => {
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 70 });
    const u2 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 200, y: 200, morale: 60 });
    const enemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 500, morale: 70 });

    ms.applyGeneralKilled(0, um);

    expect(u1.morale).toBe(40);
    expect(u2.morale).toBe(30);
    expect(enemy.morale).toBe(70); // unaffected
  });

  it('applyWinningEngagement gives +5 to opposite team within radius', () => {
    const friend = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50 });
    const routedEnemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 120, y: 100, morale: 10 });
    routedEnemy.state = UnitState.ROUTING;

    ms.applyWinningEngagement(um, routedEnemy);
    expect(friend.morale).toBe(55);
  });

  it('army rout cascade at 30% routing', () => {
    // Create 10 units, 3 routing = 30%
    const aliveUnits: ReturnType<typeof um.spawn>[] = [];
    for (let i = 0; i < 10; i++) {
      aliveUnits.push(um.spawn({
        type: UnitType.JI_HALBERDIERS, team: 0,
        x: 100 + i * 20, y: 100, morale: 70,
      }));
    }
    aliveUnits[0].state = UnitState.ROUTING;
    aliveUnits[1].state = UnitState.ROUTING;
    aliveUnits[2].state = UnitState.ROUTING;

    const cascadeFn = vi.fn();
    eventBus.on('morale:armyRoutCascade', cascadeFn);

    ms.tick(um, om, new Map([[0, 100]]));

    expect(cascadeFn).toHaveBeenCalledWith(
      expect.objectContaining({ team: 0, moraleHit: -20 }),
    );
    // Non-routing units should have lost 20 morale
    expect(aliveUnits[3].morale).toBeLessThanOrEqual(52); // 70 - 20 + bonuses
  });

  it('army rout cascade at 50% routing', () => {
    const aliveUnits: ReturnType<typeof um.spawn>[] = [];
    for (let i = 0; i < 10; i++) {
      aliveUnits.push(um.spawn({
        type: UnitType.JI_HALBERDIERS, team: 0,
        x: 100 + i * 20, y: 100, morale: 70,
      }));
    }
    // 5 routing = 50%
    for (let i = 0; i < 5; i++) aliveUnits[i].state = UnitState.ROUTING;

    ms.tick(um, om, new Map([[0, 100]]));

    // Should get the -40 hit (50% threshold)
    expect(aliveUnits[5].morale).toBeLessThanOrEqual(32); // 70 - 40 + bonuses
  });

  it('favorable terrain bonus when defending on hills', () => {
    const grid = makeGrid(TerrainType.HILLS);
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32, morale: 50 });
    unit.state = UnitState.DEFENDING;
    unit.combatTargetId = 999; // no passive recovery

    ms.tick(um, om, new Map([[0, 100]]), grid);
    // +0.5 well-fed + 2.0 favorable terrain = +2.5
    expect(unit.morale).toBeCloseTo(52.5, 1);
  });

  it('outnumbered penalty when enemies outnumber friendlies 2:1', () => {
    // 1 friendly with 50 soldiers vs 2 enemies with 60 soldiers each = 120 vs 50
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50, size: 50 });
    unit.combatTargetId = 999;
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 110, y: 100, morale: 70, size: 60 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 120, y: 100, morale: 70, size: 60 });

    ms.tick(um, om, new Map([[0, 100], [1, 100]]));
    // Should have outnumbered penalty (120 enemy vs 50 friendly, ratio 2:1)
    expect(unit.morale).toBeLessThan(50.5); // less than just well-fed bonus
  });
});
