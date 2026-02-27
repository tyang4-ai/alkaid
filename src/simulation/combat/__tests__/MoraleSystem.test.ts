import { describe, it, expect, beforeEach } from 'vitest';
import { MoraleSystem, getRoutThreshold } from '../MoraleSystem';
import { UnitManager } from '../../units/UnitManager';
import { OrderManager } from '../../OrderManager';
import { UnitType, UnitState, OrderType } from '../../../constants';

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
