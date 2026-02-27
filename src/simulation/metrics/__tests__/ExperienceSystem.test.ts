import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExperienceSystem } from '../ExperienceSystem';
import { UnitManager } from '../../units/UnitManager';
import { UnitType, UnitState } from '../../../constants';
import { eventBus } from '../../../core/EventBus';

describe('ExperienceSystem.getTier', () => {
  it('returns 0 (Recruit) for exp 0-19', () => {
    expect(ExperienceSystem.getTier(0)).toBe(0);
    expect(ExperienceSystem.getTier(19)).toBe(0);
  });

  it('returns 1 (Trained) for exp 20-39', () => {
    expect(ExperienceSystem.getTier(20)).toBe(1);
    expect(ExperienceSystem.getTier(39)).toBe(1);
  });

  it('returns 2 (Regular) for exp 40-59', () => {
    expect(ExperienceSystem.getTier(40)).toBe(2);
    expect(ExperienceSystem.getTier(59)).toBe(2);
  });

  it('returns 3 (Veteran) for exp 60-79', () => {
    expect(ExperienceSystem.getTier(60)).toBe(3);
    expect(ExperienceSystem.getTier(79)).toBe(3);
  });

  it('returns 4 (Elite) for exp 80+', () => {
    expect(ExperienceSystem.getTier(80)).toBe(4);
    expect(ExperienceSystem.getTier(100)).toBe(4);
  });
});

describe('ExperienceSystem', () => {
  let es: ExperienceSystem;
  let um: UnitManager;

  beforeEach(() => {
    eventBus.clear();
    um = new UnitManager();
    es = new ExperienceSystem();
  });

  it('awards exp after kill threshold (10 kills = +1 exp)', () => {
    const attacker = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });

    // Simulate 10 kills via event
    eventBus.emit('combat:damage', {
      attackerId: attacker.id, defenderId: 999, damage: 100, killed: 10,
    });

    es.tick(um);
    expect(attacker.experience).toBe(1);
    expect(attacker.killCount).toBe(0); // remainder after threshold
  });

  it('accumulates kills across multiple events before threshold', () => {
    const attacker = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });

    eventBus.emit('combat:damage', {
      attackerId: attacker.id, defenderId: 999, damage: 50, killed: 5,
    });
    eventBus.emit('combat:damage', {
      attackerId: attacker.id, defenderId: 999, damage: 50, killed: 3,
    });

    es.tick(um);
    expect(attacker.experience).toBe(0); // only 8 kills, threshold is 10
    expect(attacker.killCount).toBe(8);
  });

  it('experience capped at 100', () => {
    const attacker = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, experience: 99 });

    eventBus.emit('combat:damage', {
      attackerId: attacker.id, defenderId: 999, damage: 100, killed: 10,
    });

    es.tick(um);
    expect(attacker.experience).toBe(100);
  });

  it('rout bonus awards +3 exp to opposite team within radius', () => {
    const friend = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    const enemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 120, y: 100 });
    enemy.state = UnitState.ROUTING;

    // Emit rout event for enemy
    eventBus.emit('unit:routed', { unitId: enemy.id, morale: 10 });

    es.tick(um);
    expect(friend.experience).toBe(3); // EXP_ROUTE_ENEMY
  });

  it('rout bonus does not affect same team', () => {
    const friendly = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 120, y: 100 });
    const enemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 130, y: 100 });
    enemy.state = UnitState.ROUTING;

    eventBus.emit('unit:routed', { unitId: enemy.id, morale: 10 });

    es.tick(um);
    expect(friendly.experience).toBe(0); // same team, no bonus
  });

  it('rout bonus respects radius limit', () => {
    const farUnit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 5000, y: 5000 });
    const enemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 100, y: 100 });
    enemy.state = UnitState.ROUTING;

    eventBus.emit('unit:routed', { unitId: enemy.id, morale: 10 });

    es.tick(um);
    expect(farUnit.experience).toBe(0); // too far
  });

  it('hold under bombardment awards +2 exp after 20 ticks', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    unit.holdUnderBombardmentTicks = 20;

    es.tick(um);
    expect(unit.experience).toBe(2); // EXP_HOLD_UNDER_BOMBARDMENT
    expect(unit.holdUnderBombardmentTicks).toBe(0); // reset
  });

  it('hold under bombardment does not fire before threshold', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    unit.holdUnderBombardmentTicks = 19;

    es.tick(um);
    expect(unit.experience).toBe(0);
    expect(unit.holdUnderBombardmentTicks).toBe(19); // unchanged
  });

  it('emits experience:tierUp event on tier change', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, experience: 19 });
    unit.holdUnderBombardmentTicks = 20; // +2 exp -> 21 -> tier 1

    const tierUp = vi.fn();
    eventBus.on('experience:tierUp', tierUp);

    es.tick(um);
    expect(tierUp).toHaveBeenCalledWith({ unitId: unit.id, newTier: 1 });
  });
});
