import { describe, it, expect, beforeEach } from 'vitest';
import { SurrenderSystem } from '../SurrenderSystem';
import { UnitManager } from '../../units/UnitManager';
import { SupplySystem } from '../../metrics/SupplySystem';
import { eventBus } from '../../../core/EventBus';
import {
  UnitType, UnitState,
  SURRENDER_CHECK_INTERVAL_TICKS,
  SURRENDER_PRESSURE_THRESHOLD,
  SURRENDER_CONSECUTIVE_CHECKS,
  SURRENDER_WEIGHT_MORALE,
  SURRENDER_WEIGHT_CASUALTY,
  SURRENDER_WEIGHT_SUPPLY,
  SURRENDER_WEIGHT_ENCIRCLEMENT,
  SURRENDER_WEIGHT_LEADERSHIP,
  TILE_SIZE,
  ENCIRCLEMENT_CHECK_RADIUS,
  ENCIRCLEMENT_ENEMY_THRESHOLD,
  VictoryType,
} from '../../../constants';

describe('SurrenderSystem', () => {
  let ss: SurrenderSystem;
  let um: UnitManager;
  let supply: SupplySystem;

  beforeEach(() => {
    ss = new SurrenderSystem();
    um = new UnitManager();
    supply = new SupplySystem();
    supply.initArmy(0, 100, 100); // 100% food
    supply.initArmy(1, 100, 100);
    eventBus.clear();
  });

  it('initial state has no pressure before initBattle', () => {
    expect(ss.getPressure(0)).toBe(0);
    expect(ss.getPressure(1)).toBe(0);
    expect(ss.hasSurrendered(0)).toBe(false);
  });

  it('initBattle snapshots starting soldiers', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 60 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 200, y: 100, size: 40 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 100, size: 80 });

    ss.initBattle(um);

    // After init, pressure should be 0 (no ticks run yet)
    expect(ss.getPressure(0)).toBe(0);
    expect(ss.getPressure(1)).toBe(0);
  });

  it('morale factor: avg morale 50 produces moraleFactor = 50', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 50 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 200, y: 100, morale: 50 });
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 150, y: 100, isGeneral: true, morale: 50 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 100 });

    ss.initBattle(um);

    const factors = ss.getFactors(0, um, supply);
    expect(factors).not.toBeNull();
    expect(factors!.morale).toBe(50);
  });

  it('casualty factor: 40% lost produces casualtyFactor = 40', () => {
    // Start with 100 soldiers
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 100 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 100 });

    ss.initBattle(um);

    // Reduce to 60 soldiers (40% lost)
    u1.size = 60;

    const factors = ss.getFactors(0, um, supply);
    expect(factors).not.toBeNull();
    expect(factors!.casualty).toBe(40);
  });

  it('supply factor: 20% food produces supplyFactor = 80', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 100 });

    supply.setFood(0, 20); // 20% of 100 max

    ss.initBattle(um);

    const factors = ss.getFactors(0, um, supply);
    expect(factors).not.toBeNull();
    expect(factors!.supply).toBe(80);
  });

  it('leadership factor: general dead = 100, alive = 0', () => {
    const general = um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 200, y: 100 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 100 });

    ss.initBattle(um);

    // General alive → leadership = 0
    let factors = ss.getFactors(0, um, supply);
    expect(factors!.leadership).toBe(0);

    // Kill general
    general.state = UnitState.DEAD;

    factors = ss.getFactors(0, um, supply);
    expect(factors!.leadership).toBe(100);
  });

  it('encirclement: enemies in all 4 quadrants produces 100', () => {
    // Team 0 at center
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 500, y: 500 });

    const radius = ENCIRCLEMENT_CHECK_RADIUS * TILE_SIZE;
    const offset = radius * 0.5;

    // Place enemies in all 4 quadrants (N, E, S, W), enough to exceed threshold
    for (let i = 0; i < ENCIRCLEMENT_ENEMY_THRESHOLD; i++) {
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 500 - offset + i }); // North
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500 + offset, y: 500 + i }); // East
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 500 + offset + i }); // South
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500 - offset, y: 500 + i }); // West
    }

    ss.initBattle(um);

    const factors = ss.getFactors(0, um, supply);
    expect(factors).not.toBeNull();
    expect(factors!.encirclement).toBe(100);
  });

  it('encirclement: no enemies produces 0', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 500, y: 500 });
    // No team 1 units
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 5000, y: 5000 }); // Far away

    ss.initBattle(um);

    const factors = ss.getFactors(0, um, supply);
    expect(factors).not.toBeNull();
    expect(factors!.encirclement).toBe(0);
  });

  it('weighted sum formula: verify exact calculation', () => {
    // Set up conditions where we know exact factor values
    // morale=50 (avg morale 50), casualty=0, supply=0 (100% food), encirclement=0, leadership=0
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true, morale: 50 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 200, y: 100, morale: 50 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 5000, y: 5000 }); // Far away

    ss.initBattle(um);
    // Tick at check interval
    ss.tick(SURRENDER_CHECK_INTERVAL_TICKS, um, supply);

    const factors = ss.getFactors(0, um, supply);
    const expectedPressure =
      factors!.morale * SURRENDER_WEIGHT_MORALE +
      factors!.casualty * SURRENDER_WEIGHT_CASUALTY +
      factors!.supply * SURRENDER_WEIGHT_SUPPLY +
      factors!.encirclement * SURRENDER_WEIGHT_ENCIRCLEMENT +
      factors!.leadership * SURRENDER_WEIGHT_LEADERSHIP;

    expect(ss.getPressure(0)).toBeCloseTo(expectedPressure, 5);
  });

  it('consecutive check counting: pressure >= 80 for N checks', () => {
    // Create extreme conditions to push pressure above threshold
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 500, y: 500, morale: 0, size: 10 });

    // Add enemies in all 4 quadrants for encirclement (>= ENCIRCLEMENT_ENEMY_THRESHOLD per quadrant)
    const offset = ENCIRCLEMENT_CHECK_RADIUS * TILE_SIZE * 0.5;
    for (let i = 0; i < ENCIRCLEMENT_ENEMY_THRESHOLD; i++) {
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 500 - offset + i }); // N
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500 + offset, y: 500 + i }); // E
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 500 + offset + i }); // S
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500 - offset, y: 500 + i }); // W
    }

    supply.setFood(0, 0); // 0% food

    ss.initBattle(um);

    // Kill down to low soldiers
    u1.size = 1;

    // Run one check
    ss.tick(SURRENDER_CHECK_INTERVAL_TICKS, um, supply);

    const pressure = ss.getPressure(0);
    // morale=100*0.30=30, casualty=90*0.25=22.5, supply=100*0.20=20, encirclement=100*0.15=15, leadership=100*0.10=10 = 97.5
    expect(pressure).toBeGreaterThanOrEqual(SURRENDER_PRESSURE_THRESHOLD);
    // But should not have surrendered yet (only 1 check)
    expect(ss.hasSurrendered(0)).toBe(false);
  });

  it('resets consecutive count on pressure drop below 80', () => {
    // Start with very bad conditions
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 500, y: 500, morale: 0, size: 10 });

    // Add enemies in all 4 quadrants for encirclement
    const offset = ENCIRCLEMENT_CHECK_RADIUS * TILE_SIZE * 0.5;
    for (let i = 0; i < ENCIRCLEMENT_ENEMY_THRESHOLD; i++) {
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 500 - offset + i }); // N
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500 + offset, y: 500 + i }); // E
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 500 + offset + i }); // S
      um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500 - offset, y: 500 + i }); // W
    }

    supply.setFood(0, 0);
    ss.initBattle(um);
    u1.size = 1;

    // Run 3 checks at high pressure
    for (let i = 1; i <= 3; i++) {
      ss.tick(i * SURRENDER_CHECK_INTERVAL_TICKS, um, supply);
    }
    expect(ss.getPressure(0)).toBeGreaterThanOrEqual(SURRENDER_PRESSURE_THRESHOLD);

    // Now improve conditions dramatically
    u1.morale = 100;
    u1.size = 10;
    supply.setFood(0, 100);

    // Next check should drop pressure below threshold, resetting consecutive count
    ss.tick(4 * SURRENDER_CHECK_INTERVAL_TICKS, um, supply);

    // Pressure should be much lower now
    expect(ss.getPressure(0)).toBeLessThan(SURRENDER_PRESSURE_THRESHOLD);

    // Run 4 more checks with good conditions — should NOT trigger surrender
    // because the consecutive count was reset
    for (let i = 5; i <= 8; i++) {
      ss.tick(i * SURRENDER_CHECK_INTERVAL_TICKS, um, supply);
    }
    expect(ss.hasSurrendered(0)).toBe(false);
  });

  it('surrender triggers after 5 consecutive checks above threshold, emits events', () => {
    // Extreme conditions for guaranteed high pressure
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 500, y: 500, morale: 0, size: 5 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 500 });

    supply.setFood(0, 0);
    ss.initBattle(um);
    u1.size = 1; // Massive casualties

    const surrenderEvents: any[] = [];
    const endedEvents: any[] = [];
    eventBus.on('battle:surrender', (payload) => surrenderEvents.push(payload));
    eventBus.on('battle:ended', (payload) => endedEvents.push(payload));

    // Run SURRENDER_CONSECUTIVE_CHECKS checks
    for (let i = 1; i <= SURRENDER_CONSECUTIVE_CHECKS; i++) {
      ss.tick(i * SURRENDER_CHECK_INTERVAL_TICKS, um, supply);
    }

    expect(ss.hasSurrendered(0)).toBe(true);
    expect(surrenderEvents).toHaveLength(1);
    expect(surrenderEvents[0].team).toBe(0);
    expect(surrenderEvents[0].victoryType).toBe(VictoryType.SURRENDER);
    expect(endedEvents).toHaveLength(1);
    expect(endedEvents[0].winnerTeam).toBe(1);
    expect(endedEvents[0].victoryType).toBe(VictoryType.SURRENDER);
  });

  it('skips tick when not on check interval', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 0, size: 5 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 500, y: 100 });

    supply.setFood(0, 0);
    ss.initBattle(um);

    // Tick at non-interval tick — should not compute anything
    ss.tick(1, um, supply);
    expect(ss.getPressure(0)).toBe(0);

    // Tick at interval — should compute
    ss.tick(SURRENDER_CHECK_INTERVAL_TICKS, um, supply);
    expect(ss.getPressure(0)).toBeGreaterThan(0);
  });
});
