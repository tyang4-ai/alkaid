import { eventBus } from '../../core/EventBus';
import type { UnitManager } from '../units/UnitManager';
import type { SupplySystem } from '../metrics/SupplySystem';
import type { Serializable } from '../persistence/Serializable';
import type { SurrenderSnapshot } from '../persistence/SaveTypes';
import {
  UnitState,
  TILE_SIZE,
  SURRENDER_CHECK_INTERVAL_TICKS,
  SURRENDER_PRESSURE_THRESHOLD,
  SURRENDER_CONSECUTIVE_CHECKS,
  SURRENDER_WEIGHT_MORALE,
  SURRENDER_WEIGHT_CASUALTY,
  SURRENDER_WEIGHT_SUPPLY,
  SURRENDER_WEIGHT_ENCIRCLEMENT,
  SURRENDER_WEIGHT_LEADERSHIP,
  ENCIRCLEMENT_CHECK_RADIUS,
  ENCIRCLEMENT_ENEMY_THRESHOLD,
  VictoryType,
} from '../../constants';

interface SurrenderState {
  consecutiveHighPressureChecks: number;
  lastPressure: number;
  surrendered: boolean;
  startingSoldiers: number;
}

export interface SurrenderFactors {
  morale: number;
  casualty: number;
  supply: number;
  encirclement: number;
  leadership: number;
}

export class SurrenderSystem implements Serializable<SurrenderSnapshot> {
  private teamStates = new Map<number, SurrenderState>();

  constructor() {}

  /** Snapshot starting soldiers per team. Call on battle start. */
  initBattle(unitManager: UnitManager): void {
    this.teamStates.clear();
    const teamSoldiers = new Map<number, number>();
    for (const unit of unitManager.getAll()) {
      if (unit.state === UnitState.DEAD) continue;
      teamSoldiers.set(unit.team, (teamSoldiers.get(unit.team) ?? 0) + unit.size);
    }
    for (const [team, soldiers] of teamSoldiers) {
      this.teamStates.set(team, {
        consecutiveHighPressureChecks: 0,
        lastPressure: 0,
        surrendered: false,
        startingSoldiers: soldiers,
      });
    }
  }

  tick(
    currentTick: number,
    unitManager: UnitManager,
    supplySystem: SupplySystem,
  ): void {
    if (currentTick % SURRENDER_CHECK_INTERVAL_TICKS !== 0) return;

    for (const [team, state] of this.teamStates) {
      if (state.surrendered) continue;

      const factors = this.computeFactors(team, unitManager, supplySystem, state);
      const pressure =
        factors.morale * SURRENDER_WEIGHT_MORALE +
        factors.casualty * SURRENDER_WEIGHT_CASUALTY +
        factors.supply * SURRENDER_WEIGHT_SUPPLY +
        factors.encirclement * SURRENDER_WEIGHT_ENCIRCLEMENT +
        factors.leadership * SURRENDER_WEIGHT_LEADERSHIP;

      state.lastPressure = pressure;

      if (pressure >= SURRENDER_PRESSURE_THRESHOLD) {
        state.consecutiveHighPressureChecks++;
      } else {
        state.consecutiveHighPressureChecks = 0;
      }

      if (state.consecutiveHighPressureChecks >= SURRENDER_CONSECUTIVE_CHECKS) {
        state.surrendered = true;
        // Determine winner (other team)
        const winnerTeam = team === 0 ? 1 : 0;
        eventBus.emit('battle:surrender', {
          team,
          pressure,
          victoryType: VictoryType.SURRENDER,
          factors,
        });
        eventBus.emit('battle:ended', {
          winnerTeam,
          victoryType: VictoryType.SURRENDER,
        });
      }
    }
  }

  private computeFactors(
    team: number,
    unitManager: UnitManager,
    supplySystem: SupplySystem,
    state: SurrenderState,
  ): SurrenderFactors {
    const aliveUnits = unitManager.getByTeam(team)
      .filter(u => u.state !== UnitState.DEAD);

    // 1. Morale factor: 100 - average army morale
    let totalMorale = 0;
    for (const u of aliveUnits) {
      totalMorale += u.morale;
    }
    const avgMorale = aliveUnits.length > 0 ? totalMorale / aliveUnits.length : 0;
    const moraleFactor = Math.max(0, Math.min(100, 100 - avgMorale));

    // 2. Casualty factor: (start - current) / start * 100
    let currentSoldiers = 0;
    for (const u of aliveUnits) {
      currentSoldiers += u.size;
    }
    const casualtyFactor = state.startingSoldiers > 0
      ? Math.max(0, Math.min(100, ((state.startingSoldiers - currentSoldiers) / state.startingSoldiers) * 100))
      : 0;

    // 3. Supply factor: 100 - food percent
    const foodPct = supplySystem.getFoodPercent(team);
    const supplyFactor = Math.max(0, Math.min(100, 100 - foodPct));

    // 4. Encirclement factor (quadrant-based)
    const encirclementFactor = this.computeEncirclement(team, aliveUnits, unitManager);

    // 5. Leadership factor: 0 if general alive, 100 if dead
    const general = unitManager.getGeneral(team);
    const leadershipFactor = (general && general.state !== UnitState.DEAD) ? 0 : 100;

    return {
      morale: moraleFactor,
      casualty: casualtyFactor,
      supply: supplyFactor,
      encirclement: encirclementFactor,
      leadership: leadershipFactor,
    };
  }

  private computeEncirclement(
    team: number,
    aliveUnits: readonly { x: number; y: number }[],
    unitManager: UnitManager,
  ): number {
    if (aliveUnits.length === 0) return 100;

    // Compute army center
    let cx = 0, cy = 0;
    for (const u of aliveUnits) {
      cx += u.x;
      cy += u.y;
    }
    cx /= aliveUnits.length;
    cy /= aliveUnits.length;

    const radiusPx = ENCIRCLEMENT_CHECK_RADIUS * TILE_SIZE;

    // Count enemies in each quadrant
    const quadrantCounts = [0, 0, 0, 0]; // N, E, S, W

    for (const unit of unitManager.getAll()) {
      if (unit.team === team) continue;
      if (unit.state === UnitState.DEAD) continue;

      const dx = unit.x - cx;
      const dy = unit.y - cy;
      if (Math.abs(dx) > radiusPx && Math.abs(dy) > radiusPx) continue;

      // Assign to quadrant(s)
      if (dy < 0) quadrantCounts[0]++; // N (y < center)
      if (dx > 0) quadrantCounts[1]++; // E (x > center)
      if (dy > 0) quadrantCounts[2]++; // S (y > center)
      if (dx < 0) quadrantCounts[3]++; // W (x < center)
    }

    let blockedQuadrants = 0;
    for (const count of quadrantCounts) {
      if (count >= ENCIRCLEMENT_ENEMY_THRESHOLD) {
        blockedQuadrants++;
      }
    }

    const openQuadrants = 4 - blockedQuadrants;
    return Math.max(0, (4 - openQuadrants) * 25); // 0, 25, 50, 75, 100
  }

  /** Get last computed pressure for a team. */
  getPressure(team: number): number {
    return this.teamStates.get(team)?.lastPressure ?? 0;
  }

  /** Get detailed factors for HUD display. */
  getFactors(team: number, unitManager: UnitManager, supplySystem: SupplySystem): SurrenderFactors | null {
    const state = this.teamStates.get(team);
    if (!state) return null;
    return this.computeFactors(team, unitManager, supplySystem, state);
  }

  /** Check if a team has surrendered. */
  hasSurrendered(team: number): boolean {
    return this.teamStates.get(team)?.surrendered ?? false;
  }

  serialize(): SurrenderSnapshot {
    const teamStates: SurrenderSnapshot['teamStates'] = [];
    for (const [team, state] of this.teamStates) {
      teamStates.push({
        team,
        consecutiveHighPressureChecks: state.consecutiveHighPressureChecks,
        lastPressure: state.lastPressure,
        surrendered: state.surrendered,
        startingSoldiers: state.startingSoldiers,
      });
    }
    return { teamStates };
  }

  deserialize(data: SurrenderSnapshot): void {
    this.teamStates.clear();
    for (const s of data.teamStates) {
      this.teamStates.set(s.team, {
        consecutiveHighPressureChecks: s.consecutiveHighPressureChecks,
        lastPressure: s.lastPressure,
        surrendered: s.surrendered,
        startingSoldiers: s.startingSoldiers,
      });
    }
  }
}
