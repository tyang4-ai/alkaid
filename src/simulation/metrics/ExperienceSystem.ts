import type { UnitManager } from '../units/UnitManager';
import { eventBus } from '../../core/EventBus';
import {
  UnitState, TILE_SIZE,
  EXP_KILL_THRESHOLD,
  EXP_PER_KILL_BATCH,
  EXP_HOLD_UNDER_BOMBARDMENT,
  EXP_HOLD_BOMBARDMENT_TICKS,
  EXP_ROUTE_ENEMY,
  EXP_ROUTE_RADIUS_TILES,
} from '../../constants';

const TIER_NAMES = ['Recruit', 'Trained', 'Regular', 'Veteran', 'Elite'];

export class ExperienceSystem {
  private pendingKills: { attackerId: number; killed: number }[] = [];
  private pendingRouts: { unitId: number }[] = [];

  /** Return tier index (0-4) from experience value. */
  static getTier(experience: number): number {
    if (experience >= 80) return 4;
    if (experience >= 60) return 3;
    if (experience >= 40) return 2;
    if (experience >= 20) return 1;
    return 0;
  }

  /** Return tier display name from experience value. */
  static getTierName(experience: number): string {
    return TIER_NAMES[ExperienceSystem.getTier(experience)];
  }

  constructor() {
    eventBus.on('combat:damage', (e) => {
      if (e.killed > 0) {
        this.pendingKills.push({ attackerId: e.attackerId, killed: e.killed });
      }
    });

    eventBus.on('unit:routed', (e) => {
      this.pendingRouts.push({ unitId: e.unitId });
    });
  }

  /** Run experience updates for all alive units. Call once per sim tick. */
  tick(unitManager: UnitManager): void {
    // Process pending kill events
    for (const pk of this.pendingKills) {
      const unit = unitManager.get(pk.attackerId);
      if (unit && unit.state !== UnitState.DEAD) {
        unit.killCount = (unit.killCount ?? 0) + pk.killed;
      }
    }
    this.pendingKills.length = 0;

    // Process pending rout events (rout bonus to opposite team within radius)
    for (const pr of this.pendingRouts) {
      const routed = unitManager.get(pr.unitId);
      if (!routed) continue;
      const radiusPx = EXP_ROUTE_RADIUS_TILES * TILE_SIZE;
      const radiusSq = radiusPx * radiusPx;
      for (const unit of unitManager.getAll()) {
        if (unit.state === UnitState.DEAD) continue;
        if (unit.team === routed.team) continue;
        const dx = unit.x - routed.x;
        const dy = unit.y - routed.y;
        if (dx * dx + dy * dy <= radiusSq) {
          const oldTier = ExperienceSystem.getTier(unit.experience);
          unit.experience = Math.min(100, unit.experience + EXP_ROUTE_ENEMY);
          const newTier = ExperienceSystem.getTier(unit.experience);
          if (newTier > oldTier) {
            eventBus.emit('experience:tierUp', { unitId: unit.id, newTier });
          }
        }
      }
    }
    this.pendingRouts.length = 0;

    // Per-unit experience processing
    for (const unit of unitManager.getAll()) {
      if (unit.state === UnitState.DEAD) continue;

      const oldTier = ExperienceSystem.getTier(unit.experience);

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

      // Check for tier-up after all exp gains this tick
      const newTier = ExperienceSystem.getTier(unit.experience);
      if (newTier > oldTier) {
        eventBus.emit('experience:tierUp', { unitId: unit.id, newTier });
      }
    }
  }
}
