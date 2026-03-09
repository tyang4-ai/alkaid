import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../../core/EventBus';
import { PlayerTendencyTracker } from '../PlayerTendencyTracker';
import { OrderType, UnitType, UnitCategory, TENDENCY_FEATURE_COUNT, TENDENCY_HISTORY_MAX } from '../../../constants';

describe('PlayerTendencyTracker', () => {
  let eventBus: EventBus;
  let tracker: PlayerTendencyTracker;
  const mockLookup = (unitId: number) => {
    // Default: team 0 infantry at center
    return { type: UnitType.JI_HALBERDIERS, team: 0, x: 1600, y: 1200 };
  };

  beforeEach(() => {
    eventBus = new EventBus();
    tracker = new PlayerTendencyTracker(eventBus, mockLookup);
  });

  it('returns 14 features', () => {
    const f = tracker.getFeatures();
    expect(f.length).toBe(TENDENCY_FEATURE_COUNT);
  });

  it('defaults to neutral values with no data', () => {
    const f = tracker.getFeatures();
    // flank distribution defaults ~0.33 each
    expect(f[0]).toBeCloseTo(0.33, 1);
    expect(f[1]).toBeCloseTo(0.34, 1);
    expect(f[2]).toBeCloseTo(0.33, 1);
    // aggression defaults 0.5
    expect(f[3]).toBeCloseTo(0.5, 1);
  });

  it('tracks order flank distribution', () => {
    // Unit at x=100 (left side, map width = 200*16 = 3200)
    const leftLookup = () => ({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 1200 });
    const t = new PlayerTendencyTracker(eventBus, leftLookup);

    eventBus.emit('order:issued', { unitId: 1, type: OrderType.ATTACK });
    eventBus.emit('order:issued', { unitId: 1, type: OrderType.ATTACK });

    const f = t.getFeatures();
    expect(f[0]).toBeGreaterThan(0.5); // Left flank dominant
    t.destroy();
  });

  it('tracks aggression', () => {
    eventBus.emit('order:issued', { unitId: 1, type: OrderType.CHARGE });
    eventBus.emit('order:issued', { unitId: 1, type: OrderType.ATTACK });

    const f = tracker.getFeatures();
    expect(f[3]).toBe(1.0); // All aggressive orders
  });

  it('ignores enemy team orders', () => {
    const enemyLookup = () => ({ type: UnitType.JI_HALBERDIERS, team: 1, x: 1600, y: 1200 });
    const t = new PlayerTendencyTracker(eventBus, enemyLookup);

    eventBus.emit('order:issued', { unitId: 1, type: OrderType.ATTACK });
    const f = t.getFeatures();
    expect(f[3]).toBeCloseTo(0.5, 1); // Still default (no player orders tracked)
    t.destroy();
  });

  it('records battle history and caps at max', () => {
    for (let i = 0; i < TENDENCY_HISTORY_MAX + 3; i++) {
      tracker.recordBattleEnd();
    }
    expect(tracker.getHistory().length).toBe(TENDENCY_HISTORY_MAX);
  });

  it('reset clears per-battle counters but not history', () => {
    eventBus.emit('order:issued', { unitId: 1, type: OrderType.ATTACK });
    tracker.recordBattleEnd();
    tracker.reset();

    const f = tracker.getFeatures();
    expect(f[3]).toBeCloseTo(0.5, 1); // Reset to default
    expect(tracker.getHistory().length).toBe(1); // History preserved
  });

  it('serializes and deserializes', () => {
    eventBus.emit('order:issued', { unitId: 1, type: OrderType.CHARGE });
    tracker.recordBattleEnd();

    const data = tracker.serialize();
    expect(data.history.length).toBe(1);
    expect(data.history[0].length).toBe(TENDENCY_FEATURE_COUNT);

    const eventBus2 = new EventBus();
    const t2 = new PlayerTendencyTracker(eventBus2, mockLookup);
    t2.deserialize(data);
    expect(t2.getHistory().length).toBe(1);
    t2.destroy();
  });

  it('tracks deployment positions', () => {
    const rangedLookup = (id: number) => ({
      type: UnitType.GONG_ARCHERS,
      team: 0,
      x: 800,
      y: 600,
    });
    const t = new PlayerTendencyTracker(eventBus, rangedLookup);

    eventBus.emit('deployment:unitPlaced', { rosterId: 0, unitId: 1, x: 800, y: 600 });

    const f = t.getFeatures();
    // Ranged deployment x = 800 / (200*16) = 800/3200 = 0.25
    expect(f[7]).toBeCloseTo(0.25, 1);
    t.destroy();
  });

  it('tracks cavalry usage', () => {
    const cavLookup = () => ({ type: UnitType.LIGHT_CAVALRY, team: 0, x: 1600, y: 1200 });
    const t = new PlayerTendencyTracker(eventBus, cavLookup);

    eventBus.emit('deployment:unitPlaced', { rosterId: 0, unitId: 1, x: 1600, y: 1200 });
    eventBus.emit('deployment:unitPlaced', { rosterId: 1, unitId: 2, x: 1600, y: 1200 });

    const f = t.getFeatures();
    expect(f[4]).toBe(1.0); // 100% cavalry
    t.destroy();
  });

  it('emits tendency:updated on recordBattleEnd', () => {
    let emitted = false;
    eventBus.on('tendency:updated', () => { emitted = true; });
    tracker.recordBattleEnd();
    expect(emitted).toBe(true);
  });
});
