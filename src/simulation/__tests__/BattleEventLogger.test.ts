import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BattleEventLogger } from '../BattleEventLogger';
import { EventBus, eventBus } from '../../core/EventBus';
import { UnitState } from '../../constants';

function createMockUnitManager(teams: Map<number, Array<{ size: number; maxSize: number; morale: number; state: number }>>): any {
  return {
    getByTeam(team: number) {
      return (teams.get(team) ?? []).map((u, i) => ({ id: i, team, ...u }));
    },
  };
}

function createMockSupply(pcts: Map<number, number>): any {
  return {
    getFoodPercent(team: number) { return pcts.get(team) ?? 1.0; },
  };
}

describe('BattleEventLogger', () => {
  let logger: BattleEventLogger;

  beforeEach(() => {
    eventBus.clear();
    logger = new BattleEventLogger(eventBus);
  });

  it('logs events from eventBus', () => {
    logger.startLogging(0);

    eventBus.emit('weather:changed', { oldWeather: 0, newWeather: 1, tick: 5 });

    const metrics = logger.getMetrics();
    expect(metrics.events.length).toBe(1);
    expect(metrics.events[0].message).toContain('Rain');

    logger.stopLogging(10);
  });

  it('samples morale/supply at interval', () => {
    logger.startLogging(0);

    const um = createMockUnitManager(new Map([
      [0, [{ size: 80, maxSize: 100, morale: 70, state: UnitState.IDLE }]],
      [1, [{ size: 60, maxSize: 100, morale: 50, state: UnitState.IDLE }]],
    ]));
    const supply = createMockSupply(new Map([[0, 0.8], [1, 0.6]]));

    // Sample at tick 0 (offset from start)
    logger.sample(0, um, supply);
    // Sample at tick 10
    logger.sample(10, um, supply);

    const metrics = logger.getMetrics();
    expect(metrics.moraleHistory.get(0)!.length).toBe(2);
    expect(metrics.supplyHistory.get(1)!.length).toBe(2);
    expect(metrics.casualtyHistory.get(0)!.length).toBe(2);

    logger.stopLogging(20);
  });

  it('start/stop logging', () => {
    logger.startLogging(100);
    logger.stopLogging(200);

    const metrics = logger.getMetrics();
    expect(metrics.startTick).toBe(100);
    expect(metrics.endTick).toBe(200);
  });

  it('getMetrics returns correct data', () => {
    logger.startLogging(50);

    const um = createMockUnitManager(new Map([
      [0, [{ size: 90, maxSize: 100, morale: 80, state: UnitState.IDLE }]],
      [1, [{ size: 70, maxSize: 100, morale: 60, state: UnitState.IDLE }]],
    ]));
    const supply = createMockSupply(new Map([[0, 1.0], [1, 0.5]]));

    logger.sample(50, um, supply);
    logger.stopLogging(150);

    const metrics = logger.getMetrics();
    expect(metrics.sampleInterval).toBe(10);
    expect(metrics.moraleHistory.get(0)![0]).toBeCloseTo(80);
    expect(metrics.supplyHistory.get(1)![0]).toBeCloseTo(0.5);
    expect(metrics.casualtyHistory.get(0)![0]).toBe(10); // 100 - 90
  });

  it('unsubscribes after stopLogging', () => {
    logger.startLogging(0);
    logger.stopLogging(10);

    // Emit event after stopping — should NOT log
    eventBus.emit('weather:changed', { oldWeather: 0, newWeather: 2, tick: 15 });

    const metrics = logger.getMetrics();
    expect(metrics.events.length).toBe(0);
  });
});
