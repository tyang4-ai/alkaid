import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayRecorder } from '../ReplayRecorder';
import { OrderType, UnitType, UnitState, REPLAY_VERSION } from '../../../constants';
import type { Unit } from '../../units/Unit';
import type { EnvironmentStateSnapshot } from '../../persistence/SaveTypes';

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1, type: UnitType.JI_HALBERDIERS, team: 0,
    x: 100, y: 100, prevX: 100, prevY: 100,
    size: 100, maxSize: 120, hp: 100,
    morale: 80, fatigue: 0, supply: 100,
    experience: 0, state: UnitState.IDLE, facing: 0,
    path: null, pathIndex: 0,
    targetX: 0, targetY: 0,
    isGeneral: false,
    pendingOrderType: null, pendingOrderTick: 0,
    attackCooldown: 0, lastAttackTick: 0,
    hasCharged: false, combatTargetId: -1, combatTicks: 0,
    siegeSetupTicks: 0, formUpTicks: 0, disengageTicks: 0,
    orderModifier: null, routTicks: 0,
    killCount: 0, holdUnderBombardmentTicks: 0, desertionFrac: 0,
    ...overrides,
  } as Unit;
}

const ENV_STATE: EnvironmentStateSnapshot = {
  weather: 0, timeOfDay: 1, windDirection: 0, visibility: 1,
};

describe('ReplayRecorder', () => {
  let recorder: ReplayRecorder;

  beforeEach(() => {
    recorder = new ReplayRecorder();
  });

  it('starts recording with correct state', () => {
    const unit = makeUnit();
    recorder.startRecording(42, 'test-map', [unit], ENV_STATE, 1, 123);
    expect(recorder.isRecording).toBe(true);
    expect(recorder.frameCount).toBe(0);
  });

  it('records orders at correct ticks', () => {
    const unit = makeUnit();
    recorder.startRecording(42, 'test-map', [unit], ENV_STATE, 1, 123);

    recorder.recordOrder(5, 1, OrderType.MOVE, 200, 300, undefined, 0);
    recorder.recordOrder(5, 2, OrderType.ATTACK, 150, 250, 3, 1);
    recorder.recordOrder(10, 1, OrderType.HOLD, 200, 300, undefined, 0);

    const snapshot = recorder.stopRecording(100);
    expect(snapshot.frames).toHaveLength(2); // Two unique ticks
    expect(snapshot.frames[0].tick).toBe(5);
    expect(snapshot.frames[0].orders).toHaveLength(2);
    expect(snapshot.frames[1].tick).toBe(10);
    expect(snapshot.frames[1].orders).toHaveLength(1);
  });

  it('captures initial state correctly', () => {
    const unit1 = makeUnit({ id: 1, x: 100, y: 200 });
    const unit2 = makeUnit({ id: 2, x: 300, y: 400, team: 1 });
    recorder.startRecording(99, 'map-1', [unit1, unit2], ENV_STATE, 2, 456);

    const snapshot = recorder.stopRecording(50);
    expect(snapshot.version).toBe(REPLAY_VERSION);
    expect(snapshot.terrainSeed).toBe(99);
    expect(snapshot.templateId).toBe('map-1');
    expect(snapshot.initialUnits).toHaveLength(2);
    expect(snapshot.initialUnits[0].x).toBe(100);
    expect(snapshot.initialUnits[1].team).toBe(1);
    expect(snapshot.aiPersonality).toBe(2);
    expect(snapshot.aiSeed).toBe(456);
  });

  it('serializes to valid snapshot', () => {
    const unit = makeUnit();
    recorder.startRecording(42, 'test', [unit], ENV_STATE, 0, 0);
    recorder.recordOrder(1, 1, OrderType.MOVE, 50, 50, undefined, 0);
    const snapshot = recorder.stopRecording(20);

    expect(snapshot.totalTicks).toBe(20);
    expect(snapshot.environmentInit).toEqual(ENV_STATE);
    expect(snapshot.frames[0].orders[0].orderType).toBe(OrderType.MOVE);
  });

  it('stops recording prevents further orders', () => {
    const unit = makeUnit();
    recorder.startRecording(1, 'x', [unit], ENV_STATE, 0, 0);
    recorder.stopRecording(10);
    recorder.recordOrder(15, 1, OrderType.MOVE, 0, 0, undefined, 0);
    expect(recorder.frameCount).toBe(0); // No new frames recorded
  });

  it('groups same-tick orders into single frame', () => {
    const unit = makeUnit();
    recorder.startRecording(1, 'x', [unit], ENV_STATE, 0, 0);
    recorder.recordOrder(5, 1, OrderType.MOVE, 100, 100, undefined, 0);
    recorder.recordOrder(5, 2, OrderType.MOVE, 200, 200, undefined, 0);
    recorder.recordOrder(5, 3, OrderType.ATTACK, 150, 150, 4, 1);

    const snapshot = recorder.stopRecording(10);
    expect(snapshot.frames).toHaveLength(1);
    expect(snapshot.frames[0].orders).toHaveLength(3);
  });
});
