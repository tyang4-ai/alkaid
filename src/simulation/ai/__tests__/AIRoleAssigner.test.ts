import { describe, it, expect } from 'vitest';
import { AIRoleAssigner } from '../AIRoleAssigner';
import { PERSONALITY_WEIGHTS } from '../AIPersonality';
import { AIPersonalityType, TacticalRole, AIPhase } from '../AITypes';
import type { BattlefieldAssessment } from '../AITypes';
import type { Unit } from '../../units/Unit';
import { UnitType, UnitState } from '../../../constants';
import { SeededRandom } from '../../../utils/Random';

function makeUnit(overrides: Partial<Unit> & { id: number }): Unit {
  return {
    type: UnitType.JI_HALBERDIERS,
    team: 1, x: 100, y: 100, prevX: 100, prevY: 100,
    size: 100, maxSize: 100, hp: 5000, morale: 70, fatigue: 0,
    supply: 100, experience: 0, state: UnitState.IDLE, facing: 0,
    path: null, pathIndex: 0, targetX: 0, targetY: 0,
    isGeneral: false, pendingOrderType: null, pendingOrderTick: 0,
    attackCooldown: 0, lastAttackTick: 0, hasCharged: false,
    combatTargetId: -1, combatTicks: 0, siegeSetupTicks: 0,
    formUpTicks: 0, disengageTicks: 0, orderModifier: null,
    routTicks: 0, killCount: 0, holdUnderBombardmentTicks: 0, desertionFrac: 0,
    ...overrides,
  };
}

function makeAssessment(overrides: Partial<BattlefieldAssessment> = {}): BattlefieldAssessment {
  return {
    ownStrength: 100, enemyStrength: 100, strengthRatio: 1,
    ownCenter: { x: 200, y: 100 }, enemyCenter: { x: 100, y: 100 },
    ownAvgMorale: 70, enemyAvgMorale: 70,
    ownCasualtyPercent: 0, enemyCasualtyPercent: 0,
    flankableEnemies: [], weakEnemies: [],
    terrainAdvantages: [], threatsToGeneral: [], threatsToSupply: [],
    ownEngagedCount: 0, ownIdleCount: 5, ownRoutingCount: 0,
    visibleEnemyIds: new Set(), currentTick: 100,
    ...overrides,
  };
}

describe('AIRoleAssigner', () => {
  const assigner = new AIRoleAssigner();
  const rng = new SeededRandom(42);

  it('general always gets GUARD', () => {
    const units = [
      makeUnit({ id: 1, isGeneral: true, type: UnitType.GENERAL }),
      makeUnit({ id: 2 }),
    ];
    const result = assigner.assign(units, makeAssessment(), AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], rng);
    const generalAssign = result.find(a => a.unitId === 1);
    expect(generalAssign?.role).toBe(TacticalRole.GUARD);
  });

  it('scouts always get SCOUT', () => {
    const units = [
      makeUnit({ id: 1, type: UnitType.SCOUTS }),
      makeUnit({ id: 2 }),
    ];
    const result = assigner.assign(units, makeAssessment(), AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], rng);
    const scoutAssign = result.find(a => a.unitId === 1);
    expect(scoutAssign?.role).toBe(TacticalRole.SCOUT);
  });

  it('aggressive allocates more ATTACKERs', () => {
    const units = Array.from({ length: 10 }, (_, i) => makeUnit({ id: i + 1 }));
    const result = assigner.assign(units, makeAssessment(), AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.AGGRESSIVE], rng);
    const attackerCount = result.filter(a => a.role === TacticalRole.ATTACKER).length;
    const defenderCount = result.filter(a => a.role === TacticalRole.DEFENDER).length;
    expect(attackerCount).toBeGreaterThan(defenderCount);
  });

  it('defensive allocates more DEFENDERs', () => {
    const units = Array.from({ length: 10 }, (_, i) => makeUnit({ id: i + 1 }));
    const result = assigner.assign(units, makeAssessment(), AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.DEFENSIVE], rng);
    const defenderCount = result.filter(a => a.role === TacticalRole.DEFENDER).length;
    const attackerCount = result.filter(a => a.role === TacticalRole.ATTACKER).length;
    expect(defenderCount).toBeGreaterThan(attackerCount);
  });

  it('cunning allocates more FLANKERs', () => {
    // Give cunning personality some cavalry to boost flanker scores
    const units = Array.from({ length: 10 }, (_, i) =>
      makeUnit({ id: i + 1, type: i < 3 ? UnitType.LIGHT_CAVALRY : UnitType.JI_HALBERDIERS })
    );
    const result = assigner.assign(units, makeAssessment(), AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.CUNNING], rng);
    const flankerCount = result.filter(a => a.role === TacticalRole.FLANKER).length;
    expect(flankerCount).toBeGreaterThanOrEqual(1);
  });

  it('cavalry biased toward FLANKER', () => {
    const units = [
      makeUnit({ id: 1, type: UnitType.LIGHT_CAVALRY }),
      makeUnit({ id: 2, type: UnitType.HEAVY_CAVALRY }),
      makeUnit({ id: 3, type: UnitType.JI_HALBERDIERS }),
    ];
    const result = assigner.assign(units, makeAssessment(), AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], rng);
    const cavFlankers = result.filter(a =>
      a.role === TacticalRole.FLANKER && [1, 2].includes(a.unitId)
    );
    // At least one cavalry should be flanker with balanced personality
    expect(cavFlankers.length).toBeGreaterThanOrEqual(1);
  });

  it('RETREATING phase → all become defenders', () => {
    const units = Array.from({ length: 5 }, (_, i) => makeUnit({ id: i + 1 }));
    const result = assigner.assign(units, makeAssessment(), AIPhase.RETREATING, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], rng);
    for (const a of result) {
      expect(a.role).toBe(TacticalRole.DEFENDER);
    }
  });

  it('reserve commitment when many routing', () => {
    const units = Array.from({ length: 6 }, (_, i) => makeUnit({ id: i + 1 }));
    const assessment = makeAssessment({
      ownEngagedCount: 3,
      ownRoutingCount: 3, // 50% routing > 30% threshold
    });
    const result = assigner.assign(units, assessment, AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], rng);
    // Reserves should have been committed to ATTACKER
    const reserveCount = result.filter(a => a.role === TacticalRole.RESERVE).length;
    expect(reserveCount).toBe(0);
  });

  it('supply raider assigned for cunning personality', () => {
    const units = [
      makeUnit({ id: 1, type: UnitType.LIGHT_CAVALRY }),
      makeUnit({ id: 2, type: UnitType.LIGHT_CAVALRY }),
      makeUnit({ id: 3 }),
    ];
    const result = assigner.assign(units, makeAssessment(), AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.CUNNING], rng);
    const raiders = result.filter(a => a.role === TacticalRole.SUPPLY_RAIDER);
    expect(raiders.length).toBeGreaterThanOrEqual(1);
  });

  it('all alive non-special units get a role', () => {
    const units = [
      makeUnit({ id: 1 }),
      makeUnit({ id: 2 }),
      makeUnit({ id: 3, state: UnitState.DEAD }),
    ];
    const result = assigner.assign(units, makeAssessment(), AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], rng);
    // Only alive units (id 1, 2) should have roles
    expect(result.length).toBe(2);
    expect(result.every(a => a.role !== undefined)).toBe(true);
  });
});
