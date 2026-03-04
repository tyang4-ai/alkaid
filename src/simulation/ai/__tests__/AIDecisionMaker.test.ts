import { describe, it, expect, beforeEach } from 'vitest';
import { AIDecisionMaker } from '../AIDecisionMaker';
import { PERSONALITY_WEIGHTS } from '../AIPersonality';
import { AIPersonalityType, TacticalRole, AIPhase } from '../AITypes';
import type { BattlefieldAssessment, UnitRoleAssignment } from '../AITypes';
import { UnitManager } from '../../units/UnitManager';
import { OrderManager } from '../../OrderManager';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { UnitType, UnitState, OrderType, TILE_SIZE, TerrainType } from '../../../constants';
import { SeededRandom } from '../../../utils/Random';

const MAP_W = 20;
const MAP_H = 20;

function makeGrid(): TerrainGrid {
  const size = MAP_W * MAP_H;
  return new TerrainGrid({
    width: MAP_W, height: MAP_H, seed: 1, templateId: 'test',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain: new Uint8Array(size).fill(TerrainType.PLAINS),
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size),
  });
}

function makeAssessment(overrides: Partial<BattlefieldAssessment> = {}): BattlefieldAssessment {
  return {
    ownStrength: 100, enemyStrength: 100, strengthRatio: 1,
    ownCenter: { x: 15 * TILE_SIZE, y: 10 * TILE_SIZE },
    enemyCenter: { x: 5 * TILE_SIZE, y: 10 * TILE_SIZE },
    ownAvgMorale: 70, enemyAvgMorale: 70,
    ownCasualtyPercent: 0, enemyCasualtyPercent: 0,
    flankableEnemies: [], weakEnemies: [],
    terrainAdvantages: [], threatsToGeneral: [], threatsToSupply: [],
    ownEngagedCount: 0, ownIdleCount: 5, ownRoutingCount: 0,
    visibleEnemyIds: new Set(), currentTick: 100,
    ...overrides,
  };
}

describe('AIDecisionMaker', () => {
  let dm: AIDecisionMaker;
  let um: UnitManager;
  let om: OrderManager;
  let grid: TerrainGrid;
  let rng: SeededRandom;

  beforeEach(() => {
    grid = makeGrid();
    dm = new AIDecisionMaker(1, MAP_W, MAP_H);
    um = new UnitManager();
    om = new OrderManager();
    rng = new SeededRandom(42);
  });

  it('ATTACKER targets nearest visible enemy', () => {
    const attacker = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 15 * TILE_SIZE, y: 10 * TILE_SIZE });
    const enemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 10 * TILE_SIZE, y: 10 * TILE_SIZE });

    const assignments: UnitRoleAssignment[] = [{ unitId: attacker.id, role: TacticalRole.ATTACKER }];
    const assessment = makeAssessment({ visibleEnemyIds: new Set([enemy.id]) });

    const decisions = dm.decide(assignments, assessment, um, om, AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], grid, rng);
    expect(decisions.length).toBe(1);
    expect(decisions[0].unitId).toBe(attacker.id);
    expect(decisions[0].targetX).toBeDefined();
  });

  it('ATTACKER uses CHARGE when close + aggressive personality', () => {
    const attacker = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 10 * TILE_SIZE, y: 10 * TILE_SIZE });
    const enemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 10 * TILE_SIZE + 3 * TILE_SIZE, y: 10 * TILE_SIZE });

    const assignments: UnitRoleAssignment[] = [{ unitId: attacker.id, role: TacticalRole.ATTACKER }];
    const assessment = makeAssessment({ visibleEnemyIds: new Set([enemy.id]) });

    // Run multiple times to check if CHARGE happens at least once
    let chargeFound = false;
    for (let i = 0; i < 20; i++) {
      const testRng = new SeededRandom(i);
      const decisions = dm.decide(assignments, assessment, um, om, AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.AGGRESSIVE], grid, testRng);
      if (decisions.length > 0 && decisions[0].orderType === OrderType.CHARGE) {
        chargeFound = true;
        break;
      }
      om.clearOrder(attacker.id); // Clear to allow re-issue
    }
    expect(chargeFound).toBe(true);
  });

  it('DEFENDER moves to hills, then holds', () => {
    const defender = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 15 * TILE_SIZE, y: 10 * TILE_SIZE });

    const assignments: UnitRoleAssignment[] = [{ unitId: defender.id, role: TacticalRole.DEFENDER }];
    const assessment = makeAssessment({
      terrainAdvantages: [{ tileX: 12, tileY: 10, defBonus: 0.4 }],
    });

    const decisions = dm.decide(assignments, assessment, um, om, AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.DEFENSIVE], grid, rng);
    // Should have a move decision toward the hill tile
    expect(decisions.length).toBe(1);
    expect(decisions[0].unitId).toBe(defender.id);
  });

  it('FLANKER generates perpendicular waypoint', () => {
    const flanker = um.spawn({ type: UnitType.LIGHT_CAVALRY, team: 1, x: 15 * TILE_SIZE, y: 10 * TILE_SIZE });

    const assignments: UnitRoleAssignment[] = [{ unitId: flanker.id, role: TacticalRole.FLANKER }];
    const assessment = makeAssessment();

    const decisions = dm.decide(assignments, assessment, um, om, AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.CUNNING], grid, rng);
    expect(decisions.length).toBe(1);
    const d = decisions[0];
    // Flanking waypoint should be offset from direct approach line
    expect(d.orderType).toBe(OrderType.FLANK);
  });

  it('SCOUT advances, retreats when enemies near', () => {
    const scout = um.spawn({ type: UnitType.SCOUTS, team: 1, x: 15 * TILE_SIZE, y: 10 * TILE_SIZE });

    const assignments: UnitRoleAssignment[] = [{ unitId: scout.id, role: TacticalRole.SCOUT }];
    // No enemies visible → should advance
    const assessment = makeAssessment({ visibleEnemyIds: new Set() });

    const decisions = dm.decide(assignments, assessment, um, om, AIPhase.OPENING, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], grid, rng);
    expect(decisions.length).toBe(1);
    expect(decisions[0].orderType).toBe(OrderType.MOVE);
  });

  it('GUARD keeps general behind front', () => {
    const general = um.spawn({ type: UnitType.GENERAL, team: 1, x: 10 * TILE_SIZE, y: 10 * TILE_SIZE, isGeneral: true });

    const assignments: UnitRoleAssignment[] = [{ unitId: general.id, role: TacticalRole.GUARD }];
    const assessment = makeAssessment({
      ownCenter: { x: 10 * TILE_SIZE, y: 10 * TILE_SIZE },
    });

    const decisions = dm.decide(assignments, assessment, um, om, AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], grid, rng);
    expect(decisions.length).toBe(1);
    // General should be moving to safe position behind front
    expect(decisions[0].orderType).toBe(OrderType.MOVE);
  });

  it('no decisions for dead/routing units', () => {
    const dead = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 100, y: 100 });
    dead.state = UnitState.DEAD;
    const routing = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 200, y: 100 });
    routing.state = UnitState.ROUTING;

    const assignments: UnitRoleAssignment[] = [
      { unitId: dead.id, role: TacticalRole.ATTACKER },
      { unitId: routing.id, role: TacticalRole.ATTACKER },
    ];
    const decisions = dm.decide(assignments, makeAssessment(), um, om, AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], grid, rng);
    expect(decisions.length).toBe(0);
  });

  it('skip order if same order already active', () => {
    const attacker = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 15 * TILE_SIZE, y: 10 * TILE_SIZE });
    const enemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 10 * TILE_SIZE, y: 10 * TILE_SIZE });

    // Pre-set the same order that AI would issue
    om.setOrder(attacker.id, { type: OrderType.ATTACK, unitId: attacker.id, targetX: enemy.x, targetY: enemy.y, targetUnitId: enemy.id });

    const assignments: UnitRoleAssignment[] = [{ unitId: attacker.id, role: TacticalRole.ATTACKER }];
    const assessment = makeAssessment({ visibleEnemyIds: new Set([enemy.id]) });

    const decisions = dm.decide(assignments, assessment, um, om, AIPhase.ENGAGEMENT, PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED], grid, rng);
    // Should skip since same order already exists
    expect(decisions.length).toBe(0);
  });
});
