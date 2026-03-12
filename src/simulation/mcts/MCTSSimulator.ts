/**
 * Lightweight forward simulator for MCTS rollouts.
 * Simplified physics: direct vector movement (no pathfinding),
 * basic combat (damage + type matchup), morale (rout + cascade),
 * and simplified surrender check.
 *
 * NOT meant to be 100% accurate — it's a heuristic for look-ahead.
 * The NN value head does most of the heavy lifting for position evaluation.
 */

import type { LightweightSnapshot, LightweightUnit } from './LightweightSnapshot';
import {
  TILE_SIZE,
  UNIT_TYPE_CONFIGS,
  TYPE_MATCHUP_TABLE,
  ROUT_CASCADE_RADIUS_TILES,
  ROUT_CASCADE_MORALE_HIT,
  ROUT_SPEED_MULTIPLIER,
  RL_MAX_UNITS,
  RL_TARGET_X_BINS,
  RL_TARGET_Y_BINS,
  DEFAULT_MAP_WIDTH,
  DEFAULT_MAP_HEIGHT,
} from '../../constants';

const UNIT_STATE_IDLE = 0;
const UNIT_STATE_MOVING = 1;
const UNIT_STATE_ATTACKING = 2;
const UNIT_STATE_ROUTING = 4;
const UNIT_STATE_DEAD = 5;

const ROUT_THRESHOLD = 20;
const ROUT_CASCADE_RADIUS_PX = ROUT_CASCADE_RADIUS_TILES * TILE_SIZE;
const MAP_W_PX = DEFAULT_MAP_WIDTH * TILE_SIZE;
const MAP_H_PX = DEFAULT_MAP_HEIGHT * TILE_SIZE;

/** Pixels per tick for a given speed (tiles/sec). Tick rate = 20Hz. */
function speedToPixelsPerTick(speedTilesPerSec: number): number {
  return (speedTilesPerSec * TILE_SIZE) / 20;
}

export class MCTSSimulator {
  /**
   * Simulate N ticks forward on a lightweight snapshot (mutates in place).
   */
  simulateForward(snapshot: LightweightSnapshot, ticks: number): void {
    for (let t = 0; t < ticks; t++) {
      this.moveUnits(snapshot);
      this.resolveCombat(snapshot);
      this.updateMorale(snapshot);
      this.checkSurrender(snapshot);
      snapshot.tick++;
    }
  }

  /**
   * Evaluate position from a team's perspective.
   * Returns value in [-1, 1] where 1 = winning, -1 = losing.
   */
  evaluatePosition(snapshot: LightweightSnapshot, team: number): number {
    const enemyTeam = 1 - team;
    let ownUnits = 0, enemyUnits = 0;
    let ownHp = 0, enemyHp = 0;
    let ownMorale = 0, enemyMorale = 0;
    let ownGeneralAlive = false, enemyGeneralAlive = false;
    let ownTotalMaxHp = 0, enemyTotalMaxHp = 0;

    for (const u of snapshot.units) {
      if (u.state === UNIT_STATE_DEAD) continue;
      const cfg = UNIT_TYPE_CONFIGS[u.type as keyof typeof UNIT_TYPE_CONFIGS];
      if (!cfg) continue;
      const maxHp = cfg.maxSize * cfg.hpPerSoldier;

      if (u.team === team) {
        ownUnits++;
        ownHp += u.hp;
        ownTotalMaxHp += maxHp;
        ownMorale += u.morale;
        if (u.isGeneral) ownGeneralAlive = true;
      } else if (u.team === enemyTeam) {
        enemyUnits++;
        enemyHp += u.hp;
        enemyTotalMaxHp += maxHp;
        enemyMorale += u.morale;
        if (u.isGeneral) enemyGeneralAlive = true;
      }
    }

    // Annihilation check
    if (ownUnits === 0 && enemyUnits === 0) return 0;
    if (ownUnits === 0) return -1;
    if (enemyUnits === 0) return 1;

    // HP ratio (most important)
    const ownHpRatio = ownTotalMaxHp > 0 ? ownHp / ownTotalMaxHp : 0;
    const enemyHpRatio = enemyTotalMaxHp > 0 ? enemyHp / enemyTotalMaxHp : 0;
    const hpScore = ownHpRatio - enemyHpRatio; // [-1, 1]

    // Morale ratio
    const ownAvgMorale = ownMorale / ownUnits / 100; // [0, 1]
    const enemyAvgMorale = enemyMorale / enemyUnits / 100;
    const moraleScore = ownAvgMorale - enemyAvgMorale; // [-1, 1]

    // General bonus
    const generalScore = (ownGeneralAlive ? 0.1 : 0) - (enemyGeneralAlive ? 0.1 : 0);

    // Surrender pressure
    const ownPressure = snapshot.surrenderPressure.find(s => s.team === team)?.pressure ?? 0;
    const enemyPressure = snapshot.surrenderPressure.find(s => s.team === enemyTeam)?.pressure ?? 0;
    const pressureScore = (enemyPressure - ownPressure) / 100; // [-1, 1]

    // Weighted combination
    const raw = hpScore * 0.50 + moraleScore * 0.25 + generalScore + pressureScore * 0.15;

    // Clamp to [-1, 1]
    return Math.max(-1, Math.min(1, raw));
  }

  /**
   * Apply decoded actions to snapshot units (for a specific team).
   * Actions format: Int32Array of length 96 = 32 units * 3 (orderType, xBin, yBin).
   * Here we just set target positions for movement.
   */
  applyActions(snapshot: LightweightSnapshot, actions: number[], team: number): void {
    const teamUnits = snapshot.units
      .filter(u => u.team === team && u.state !== UNIT_STATE_DEAD)
      .sort((a, b) => a.id - b.id);

    for (let i = 0; i < RL_MAX_UNITS && i < teamUnits.length; i++) {
      const unit = teamUnits[i];
      if (unit.state === UNIT_STATE_ROUTING) continue;

      const base = i * 3;
      const orderType = actions[base];
      const xBin = actions[base + 1];
      const yBin = actions[base + 2];

      // Skip NO_OP (order type 9)
      if (orderType >= 9) continue;

      // Convert bins to world coordinates
      const targetX = (xBin + 0.5) / RL_TARGET_X_BINS * MAP_W_PX;
      const targetY = (yBin + 0.5) / RL_TARGET_Y_BINS * MAP_H_PX;

      // For MCTS simulation, we store the target in facing direction
      // and set state to moving toward target
      const dx = targetX - unit.x;
      const dy = targetY - unit.y;
      unit.facing = Math.atan2(dy, dx);

      if (orderType === 3) {
        // Retreat: move away from target (flee toward own edge)
        unit.facing = Math.atan2(-dy, -dx);
      }

      if (unit.state === UNIT_STATE_IDLE || unit.state === UNIT_STATE_MOVING) {
        unit.state = UNIT_STATE_MOVING;
      }
    }
  }

  /** Direct vector movement toward facing direction. No A* pathfinding. */
  private moveUnits(snapshot: LightweightSnapshot): void {
    for (const unit of snapshot.units) {
      if (unit.state === UNIT_STATE_DEAD) continue;
      if (unit.state !== UNIT_STATE_MOVING && unit.state !== UNIT_STATE_ROUTING) continue;

      const cfg = UNIT_TYPE_CONFIGS[unit.type as keyof typeof UNIT_TYPE_CONFIGS];
      if (!cfg) continue;

      let speed = speedToPixelsPerTick(cfg.speed);
      if (unit.state === UNIT_STATE_ROUTING) {
        speed *= ROUT_SPEED_MULTIPLIER;
      }

      unit.x += Math.cos(unit.facing) * speed;
      unit.y += Math.sin(unit.facing) * speed;

      // Clamp to map bounds
      unit.x = Math.max(0, Math.min(MAP_W_PX, unit.x));
      unit.y = Math.max(0, Math.min(MAP_H_PX, unit.y));
    }
  }

  /** Simplified combat: range check, damage formula, type matchup. */
  private resolveCombat(snapshot: LightweightSnapshot): void {
    const alive = snapshot.units.filter(u => u.state !== UNIT_STATE_DEAD);

    for (const attacker of alive) {
      if (attacker.state === UNIT_STATE_ROUTING) continue;
      if (attacker.state === UNIT_STATE_DEAD) continue;

      const aCfg = UNIT_TYPE_CONFIGS[attacker.type as keyof typeof UNIT_TYPE_CONFIGS];
      if (!aCfg || aCfg.attackSpeed === 0) continue;

      // Find closest enemy in range
      const rangePx = aCfg.range * TILE_SIZE;
      let bestTarget: LightweightUnit | null = null;
      let bestDist = Infinity;

      for (const defender of alive) {
        if (defender.team === attacker.team) continue;
        if (defender.state === UNIT_STATE_DEAD) continue;

        const dx = defender.x - attacker.x;
        const dy = defender.y - attacker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= rangePx && dist < bestDist) {
          bestDist = dist;
          bestTarget = defender;
        }
      }

      if (!bestTarget) continue;

      // Mark both as in combat
      if (attacker.state !== UNIT_STATE_ATTACKING) {
        attacker.state = UNIT_STATE_ATTACKING;
      }

      // Damage calculation (simplified)
      // damage * attackSpeed / tickRate * typeMatchup * (1 - armor/20)
      const dCfg = UNIT_TYPE_CONFIGS[bestTarget.type as keyof typeof UNIT_TYPE_CONFIGS];
      if (!dCfg) continue;

      let matchup = 1.0;
      if (attacker.type <= 9 && bestTarget.type <= 9) {
        matchup = TYPE_MATCHUP_TABLE[attacker.type][bestTarget.type];
      }

      const effectiveArmor = Math.max(0, dCfg.armor - aCfg.armorPen);
      const armorReduction = 1 - effectiveArmor / 20;
      const dmgPerTick = aCfg.damage * (aCfg.attackSpeed / 20) * matchup * Math.max(0.1, armorReduction);
      const totalDmg = dmgPerTick * attacker.size;

      bestTarget.hp -= totalDmg;
      if (bestTarget.hp <= 0) {
        bestTarget.hp = 0;
        bestTarget.state = UNIT_STATE_DEAD;
        bestTarget.size = 0;
        attacker.killCount += dCfg.maxSize; // approximate
      } else {
        // Recalculate size from HP
        const hpPer = dCfg.hpPerSoldier;
        bestTarget.size = Math.max(1, Math.ceil(bestTarget.hp / hpPer));
      }

      // Morale loss on target from taking casualties
      const casualtyPct = 1 - (bestTarget.size / Math.max(1, bestTarget.maxSize));
      bestTarget.morale -= casualtyPct * 0.5; // Simplified morale loss

      attacker.combatTicks++;
    }
  }

  /** Simplified morale: rout threshold + cascade. */
  private updateMorale(snapshot: LightweightSnapshot): void {
    const newlyRouted: LightweightUnit[] = [];

    for (const unit of snapshot.units) {
      if (unit.state === UNIT_STATE_DEAD) continue;
      if (unit.state === UNIT_STATE_ROUTING) {
        unit.routTicks++;
        continue;
      }

      // Rout check
      if (unit.morale <= ROUT_THRESHOLD) {
        unit.state = UNIT_STATE_ROUTING;
        unit.routTicks = 0;
        // Flee toward own edge
        unit.facing = unit.team === 0 ? Math.PI : 0;
        newlyRouted.push(unit);
      }
    }

    // Cascade: nearby friendly units lose morale when a neighbor routs
    for (const routed of newlyRouted) {
      for (const unit of snapshot.units) {
        if (unit.team !== routed.team) continue;
        if (unit.state === UNIT_STATE_DEAD || unit.state === UNIT_STATE_ROUTING) continue;
        if (unit.id === routed.id) continue;

        const dx = unit.x - routed.x;
        const dy = unit.y - routed.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= ROUT_CASCADE_RADIUS_PX) {
          unit.morale += ROUT_CASCADE_MORALE_HIT;
          unit.morale = Math.max(0, unit.morale);
        }
      }
    }
  }

  /** Very simplified surrender: if >80% casualties, mark team as "surrendered" by routing all. */
  private checkSurrender(snapshot: LightweightSnapshot): void {
    const teamStats = new Map<number, { startTotal: number; currentTotal: number }>();

    for (const u of snapshot.units) {
      const cfg = UNIT_TYPE_CONFIGS[u.type as keyof typeof UNIT_TYPE_CONFIGS];
      if (!cfg) continue;

      let stats = teamStats.get(u.team);
      if (!stats) {
        stats = { startTotal: 0, currentTotal: 0 };
        teamStats.set(u.team, stats);
      }
      stats.startTotal += u.maxSize;
      stats.currentTotal += u.state !== UNIT_STATE_DEAD ? u.size : 0;
    }

    for (const [team, stats] of teamStats) {
      if (stats.startTotal === 0) continue;
      const casualtyRatio = 1 - stats.currentTotal / stats.startTotal;

      if (casualtyRatio >= 0.80) {
        // Force all remaining units to rout
        for (const u of snapshot.units) {
          if (u.team === team && u.state !== UNIT_STATE_DEAD && u.state !== UNIT_STATE_ROUTING) {
            u.state = UNIT_STATE_ROUTING;
            u.morale = 0;
          }
        }
      }
    }
  }
}
