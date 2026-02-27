import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeOfDaySystem } from '../TimeOfDaySystem';
import type { EnvironmentState } from '../EnvironmentState';
import {
  TimeOfDay,
  TIME_PHASE_DURATION_TICKS,
} from '../../../constants';
import { eventBus } from '../../../core/EventBus';

function makeEnv(overrides?: Partial<EnvironmentState>): EnvironmentState {
  return {
    weather: 0,
    windDirection: 0,
    timeOfDay: TimeOfDay.DAWN,
    currentTick: 0,
    battleStartTime: TimeOfDay.DAWN,
    ...overrides,
  };
}

describe('TimeOfDaySystem', () => {
  let tod: TimeOfDaySystem;

  beforeEach(() => {
    tod = new TimeOfDaySystem(TimeOfDay.DAWN);
    eventBus.clear();
  });

  it('should advance phase every TIME_PHASE_DURATION_TICKS', () => {
    const env = makeEnv({ timeOfDay: TimeOfDay.DAWN });
    // At tick 0, no advance (ticksSinceLastChange = 0)
    tod.tick(env);
    expect(env.timeOfDay).toBe(TimeOfDay.DAWN);

    // At tick 200 (= TIME_PHASE_DURATION_TICKS), should advance
    env.currentTick = TIME_PHASE_DURATION_TICKS;
    tod.tick(env);
    expect(env.timeOfDay).toBe(TimeOfDay.MORNING);
  });

  it('should wrap from NIGHT back to DAWN', () => {
    const env = makeEnv({ timeOfDay: TimeOfDay.NIGHT });
    env.currentTick = TIME_PHASE_DURATION_TICKS;
    tod.tick(env);
    expect(env.timeOfDay).toBe(TimeOfDay.DAWN);
  });

  it('should emit time:phaseChanged event on transition', () => {
    const handler = vi.fn();
    eventBus.on('time:phaseChanged', handler);

    const env = makeEnv({ timeOfDay: TimeOfDay.DAWN });
    env.currentTick = TIME_PHASE_DURATION_TICKS;
    tod.tick(env);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      oldPhase: TimeOfDay.DAWN,
      newPhase: TimeOfDay.MORNING,
      tick: TIME_PHASE_DURATION_TICKS,
    });
  });

  it('should not advance before interval elapses', () => {
    const env = makeEnv({ timeOfDay: TimeOfDay.DAWN });
    env.currentTick = TIME_PHASE_DURATION_TICKS - 1;
    tod.tick(env);
    expect(env.timeOfDay).toBe(TimeOfDay.DAWN);
  });

  it('should return correct English time names', () => {
    expect(TimeOfDaySystem.getTimeName(TimeOfDay.DAWN)).toBe('Dawn');
    expect(TimeOfDaySystem.getTimeName(TimeOfDay.MORNING)).toBe('Morning');
    expect(TimeOfDaySystem.getTimeName(TimeOfDay.MIDDAY)).toBe('Midday');
    expect(TimeOfDaySystem.getTimeName(TimeOfDay.AFTERNOON)).toBe('Afternoon');
    expect(TimeOfDaySystem.getTimeName(TimeOfDay.DUSK)).toBe('Dusk');
    expect(TimeOfDaySystem.getTimeName(TimeOfDay.NIGHT)).toBe('Night');
    expect(TimeOfDaySystem.getTimeName(99)).toBe('Unknown');
  });

  it('should return correct Chinese time names', () => {
    expect(TimeOfDaySystem.getTimeNameChinese(TimeOfDay.DAWN)).toBe('\u5BC5\u65F6');
    expect(TimeOfDaySystem.getTimeNameChinese(TimeOfDay.MORNING)).toBe('\u8FB0\u65F6');
    expect(TimeOfDaySystem.getTimeNameChinese(TimeOfDay.MIDDAY)).toBe('\u5348\u65F6');
    expect(TimeOfDaySystem.getTimeNameChinese(TimeOfDay.AFTERNOON)).toBe('\u7533\u65F6');
    expect(TimeOfDaySystem.getTimeNameChinese(TimeOfDay.DUSK)).toBe('\u620C\u65F6');
    expect(TimeOfDaySystem.getTimeNameChinese(TimeOfDay.NIGHT)).toBe('\u5B50\u65F6');
    expect(TimeOfDaySystem.getTimeNameChinese(99)).toBe('?');
  });
});
