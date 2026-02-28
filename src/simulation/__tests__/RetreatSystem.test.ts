import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetreatSystem } from '../RetreatSystem';
import { EventBus, eventBus } from '../../core/EventBus';
import { OrderType, UnitState, RETREAT_EVACUATION_TICKS, STALEMATE_DETECTION_TICKS, STALEMATE_CASUALTY_THRESHOLD } from '../../constants';

function createMockUnitManager(teamUnits: Array<{ id: number; team: number; state: number; size: number; maxSize: number }>): any {
  return {
    getByTeam(team: number) { return teamUnits.filter(u => u.team === team); },
    get(id: number) { return teamUnits.find(u => u.id === id); },
  };
}

function createMockOrderManager(): any {
  return {
    setOrder: vi.fn(),
  };
}

describe('RetreatSystem', () => {
  let system: RetreatSystem;

  beforeEach(() => {
    eventBus.clear();
    system = new RetreatSystem();
  });

  it('retreat issues orders to all alive units', () => {
    const um = createMockUnitManager([
      { id: 1, team: 0, state: UnitState.IDLE, size: 100, maxSize: 100 },
      { id: 2, team: 0, state: UnitState.IDLE, size: 80, maxSize: 100 },
      { id: 3, team: 0, state: UnitState.DEAD, size: 0, maxSize: 100 },
    ]);
    const om = createMockOrderManager();

    const spy = vi.fn();
    eventBus.on('retreat:initiated', spy);

    system.initiateRetreat(0, um, om);

    expect(spy).toHaveBeenCalledWith({ team: 0 });
    expect(om.setOrder).toHaveBeenCalledTimes(2); // 2 alive units
    expect(om.setOrder.mock.calls[0][1].type).toBe(OrderType.RETREAT);
  });

  it('retreat completed when enough ticks elapse', () => {
    const um = createMockUnitManager([
      { id: 1, team: 0, state: UnitState.IDLE, size: 100, maxSize: 100 },
    ]);
    const om = createMockOrderManager();

    system.initiateRetreat(0, um, om);
    expect(system.isRetreating(0)).toBe(true);

    const spy = vi.fn();
    eventBus.on('retreat:completed', spy);

    // Tick until evacuation (start tick is set on first tick call)
    for (let t = 1; t <= RETREAT_EVACUATION_TICKS + 1; t++) {
      system.tick(um, t);
    }

    expect(spy).toHaveBeenCalledWith({ team: 0 });
    expect(system.isRetreating(0)).toBe(false);
  });

  it('stalemate detection threshold', () => {
    const um = createMockUnitManager([
      { id: 1, team: 0, state: UnitState.IDLE, size: 100, maxSize: 100 },
      { id: 2, team: 1, state: UnitState.IDLE, size: 100, maxSize: 100 },
    ]);

    const spy = vi.fn();
    eventBus.on('stalemate:detected', spy);

    // Simulate checks with no casualties over detection window
    for (let t = 0; t <= STALEMATE_DETECTION_TICKS + 40; t += 20) {
      system.checkStalemate(um, t);
    }

    expect(spy).toHaveBeenCalled();
  });

  it('isRetreating flag', () => {
    expect(system.isRetreating(0)).toBe(false);

    const um = createMockUnitManager([
      { id: 1, team: 0, state: UnitState.IDLE, size: 100, maxSize: 100 },
    ]);
    const om = createMockOrderManager();

    system.initiateRetreat(0, um, om);
    expect(system.isRetreating(0)).toBe(true);
  });
});
