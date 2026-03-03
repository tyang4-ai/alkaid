import { eventBus } from '../../core/EventBus';
import type { EnvironmentState } from './EnvironmentState';
import {
  TimeOfDay,
  TIME_PHASE_DURATION_TICKS,
} from '../../constants';
import type { Serializable } from '../persistence/Serializable';
import type { TimeOfDaySnapshot } from '../persistence/SaveTypes';

export class TimeOfDaySystem implements Serializable<TimeOfDaySnapshot> {
  private startTime: number;
  private lastPhaseChangeTick = 0;

  constructor(startTime: number = TimeOfDay.DAWN) {
    this.startTime = startTime;
  }

  tick(env: EnvironmentState): void {
    const ticksSinceLastChange = env.currentTick - this.lastPhaseChangeTick;
    if (ticksSinceLastChange < TIME_PHASE_DURATION_TICKS) return;

    const oldPhase = env.timeOfDay;
    const phaseCount = 6; // DAWN through NIGHT
    const newPhase = (oldPhase + 1) % phaseCount;
    env.timeOfDay = newPhase;
    this.lastPhaseChangeTick = env.currentTick;

    eventBus.emit('time:phaseChanged', {
      oldPhase,
      newPhase,
      tick: env.currentTick,
    });
  }

  /** Get the start time this system was initialized with. */
  getStartTime(): number {
    return this.startTime;
  }

  serialize(): TimeOfDaySnapshot {
    return {
      startTime: this.startTime,
      lastPhaseChangeTick: this.lastPhaseChangeTick,
    };
  }

  deserialize(data: TimeOfDaySnapshot): void {
    this.startTime = data.startTime;
    this.lastPhaseChangeTick = data.lastPhaseChangeTick;
  }

  static getTimeName(phase: number): string {
    const names = ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Dusk', 'Night'];
    return names[phase] ?? 'Unknown';
  }

  static getTimeNameChinese(phase: number): string {
    const names = ['\u5BC5\u65F6', '\u8FB0\u65F6', '\u5348\u65F6', '\u7533\u65F6', '\u620C\u65F6', '\u5B50\u65F6'];
    return names[phase] ?? '?';
  }
}
