import { eventBus } from '../core/EventBus';
import type { UnitManager } from './units/UnitManager';
import type { OrderManager } from './OrderManager';
import { OrderType, UnitState, RETREAT_EVACUATION_TICKS, STALEMATE_DETECTION_TICKS, STALEMATE_CASUALTY_THRESHOLD } from '../constants';
import type { Serializable } from './persistence/Serializable';
import type { RetreatSnapshot } from './persistence/SaveTypes';

export class RetreatSystem implements Serializable<RetreatSnapshot> {
  private retreatingTeams = new Set<number>();
  private retreatStartTick = new Map<number, number>();

  // Stalemate tracking
  private casualtySnapshots = new Map<number, Map<number, number>>(); // tick → team → casualties
  private lastStalemateCheck = 0;

  initiateRetreat(team: number, unitManager: UnitManager, orderManager: OrderManager): void {
    if (this.retreatingTeams.has(team)) return;
    this.retreatingTeams.add(team);
    this.retreatStartTick.set(team, 0); // will be set properly on next tick

    // Issue RETREAT to all alive non-routing units
    for (const unit of unitManager.getByTeam(team)) {
      if (unit.state !== UnitState.DEAD && unit.state !== UnitState.ROUTING) {
        orderManager.setOrder(unit.id, {
          type: OrderType.RETREAT,
          unitId: unit.id,
          targetX: 0, // Retreat towards left edge for team 0
          targetY: unit.y,
        });
      }
    }

    eventBus.emit('retreat:initiated', { team });
  }

  tick(_unitManager: UnitManager, currentTick: number): void {
    for (const team of this.retreatingTeams) {
      if (!this.retreatStartTick.has(team) || this.retreatStartTick.get(team) === 0) {
        this.retreatStartTick.set(team, currentTick);
      }

      const startTick = this.retreatStartTick.get(team)!;
      const elapsed = currentTick - startTick;

      if (elapsed >= RETREAT_EVACUATION_TICKS) {
        // Retreat complete
        this.retreatingTeams.delete(team);
        this.retreatStartTick.delete(team);
        eventBus.emit('retreat:completed', { team });
      }
    }
  }

  checkStalemate(unitManager: UnitManager, currentTick: number): void {
    if (currentTick - this.lastStalemateCheck < 20) return; // Check every second
    this.lastStalemateCheck = currentTick;

    // Count current casualties per team
    const currentCasualties = new Map<number, number>();
    for (const team of [0, 1]) {
      let dead = 0;
      for (const unit of unitManager.getByTeam(team)) {
        dead += unit.maxSize - unit.size;
      }
      currentCasualties.set(team, dead);
    }

    this.casualtySnapshots.set(currentTick, currentCasualties);

    // Remove old snapshots
    for (const [tick] of this.casualtySnapshots) {
      if (currentTick - tick > STALEMATE_DETECTION_TICKS) {
        this.casualtySnapshots.delete(tick);
      }
    }

    // Check if we have enough history
    const ticks = [...this.casualtySnapshots.keys()].sort((a, b) => a - b);
    if (ticks.length < 2) return;

    const oldest = ticks[0];
    const newest = ticks[ticks.length - 1];
    if (newest - oldest < STALEMATE_DETECTION_TICKS) return;

    const oldSnap = this.casualtySnapshots.get(oldest)!;
    const newSnap = this.casualtySnapshots.get(newest)!;

    let totalNewCasualties = 0;
    for (const team of [0, 1]) {
      totalNewCasualties += (newSnap.get(team) ?? 0) - (oldSnap.get(team) ?? 0);
    }

    if (totalNewCasualties < STALEMATE_CASUALTY_THRESHOLD) {
      eventBus.emit('stalemate:detected', undefined);
    }
  }

  isRetreating(team: number): boolean {
    return this.retreatingTeams.has(team);
  }

  reset(): void {
    this.retreatingTeams.clear();
    this.retreatStartTick.clear();
    this.casualtySnapshots.clear();
    this.lastStalemateCheck = 0;
  }

  serialize(): RetreatSnapshot {
    return {
      retreatingTeams: [...this.retreatingTeams],
      retreatStartTick: [...this.retreatStartTick].map(([team, tick]) => ({ team, tick })),
      lastStalemateCheck: this.lastStalemateCheck,
    };
  }

  deserialize(data: RetreatSnapshot): void {
    this.retreatingTeams = new Set(data.retreatingTeams);
    this.retreatStartTick = new Map(data.retreatStartTick.map(e => [e.team, e.tick]));
    this.lastStalemateCheck = data.lastStalemateCheck;
    this.casualtySnapshots.clear();
  }
}
