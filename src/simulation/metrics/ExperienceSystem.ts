import type { UnitManager } from '../units/UnitManager';
import { eventBus } from '../../core/EventBus';
import {
  UnitState,
  EXP_KILL_THRESHOLD,
  EXP_PER_KILL_BATCH,
  EXP_HOLD_UNDER_BOMBARDMENT,
  EXP_HOLD_BOMBARDMENT_TICKS,
} from '../../constants';

export class ExperienceSystem {
  /** Run experience updates for all alive units. Call once per sim tick. */
  tick(unitManager: UnitManager): void {
    for (const unit of unitManager.getAll()) {
      if (unit.state === UnitState.DEAD) continue;

      // Kill-based exp: every EXP_KILL_THRESHOLD kills = +1 exp
      const killCount = unit.killCount ?? 0;
      if (killCount >= EXP_KILL_THRESHOLD) {
        const batches = Math.floor(killCount / EXP_KILL_THRESHOLD);
        const gain = batches * EXP_PER_KILL_BATCH;
        unit.experience = Math.min(100, unit.experience + gain);
        unit.killCount = killCount - batches * EXP_KILL_THRESHOLD;
        if (gain > 0) {
          eventBus.emit('experience:gained', {
            unitId: unit.id, amount: gain, source: 'kills',
          });
        }
      }

      // Hold under bombardment: +2 exp per 20 ticks
      const bombardTicks = unit.holdUnderBombardmentTicks ?? 0;
      if (bombardTicks >= EXP_HOLD_BOMBARDMENT_TICKS) {
        const batches = Math.floor(bombardTicks / EXP_HOLD_BOMBARDMENT_TICKS);
        const gain = batches * EXP_HOLD_UNDER_BOMBARDMENT;
        unit.experience = Math.min(100, unit.experience + gain);
        unit.holdUnderBombardmentTicks = bombardTicks - batches * EXP_HOLD_BOMBARDMENT_TICKS;
        if (gain > 0) {
          eventBus.emit('experience:gained', {
            unitId: unit.id, amount: gain, source: 'bombardment',
          });
        }
      }
    }
  }
}
