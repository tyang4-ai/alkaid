import type { Unit } from '../units/Unit';
import type { UnitManager } from '../units/UnitManager';
import type { OrderManager } from '../OrderManager';
import { TerrainGrid } from '../terrain/TerrainGrid';
import {
  UnitState, UnitType, OrderType, TILE_SIZE,
  AI_CHARGE_RANGE_TILES, AI_FLANKER_OFFSET_TILES,
  AI_RESERVE_DISTANCE, AI_SCOUT_RETREAT_RANGE, AI_SUPPLY_RAID_TARGET_COL_FRAC,
} from '../../constants';
import { TacticalRole, AIPhase } from './AITypes';
import type { PersonalityWeights, BattlefieldAssessment, UnitRoleAssignment, AIDecision } from './AITypes';
import type { SeededRandom } from '../../utils/Random';

export class AIDecisionMaker {
  team: number;
  mapWidth: number;
  mapHeight: number;

  constructor(team: number, mapWidth: number, mapHeight: number) {
    this.team = team;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  decide(
    assignments: UnitRoleAssignment[],
    assessment: BattlefieldAssessment,
    unitManager: UnitManager,
    orderManager: OrderManager,
    phase: AIPhase,
    weights: PersonalityWeights,
    terrainGrid: TerrainGrid,
    rng: SeededRandom,
  ): AIDecision[] {
    const decisions: AIDecision[] = [];
    const visibleEnemies = this.getVisibleEnemyUnits(assessment, unitManager);

    for (const assignment of assignments) {
      const unit = unitManager.get(assignment.unitId);
      if (!unit || unit.state === UnitState.DEAD || unit.state === UnitState.ROUTING) continue;

      const decision = this.decideForRole(
        unit, assignment, assessment, visibleEnemies,
        unitManager, orderManager, phase, weights, terrainGrid, rng,
      );
      if (decision) decisions.push(decision);
    }

    return decisions;
  }

  private decideForRole(
    unit: Unit,
    assignment: UnitRoleAssignment,
    assessment: BattlefieldAssessment,
    visibleEnemies: Unit[],
    unitManager: UnitManager,
    orderManager: OrderManager,
    phase: AIPhase,
    weights: PersonalityWeights,
    terrainGrid: TerrainGrid,
    rng: SeededRandom,
  ): AIDecision | null {
    switch (assignment.role) {
      case TacticalRole.ATTACKER:
        return this.decideAttacker(unit, assessment, visibleEnemies, orderManager, weights, rng);
      case TacticalRole.DEFENDER:
        return this.decideDefender(unit, assessment, visibleEnemies, orderManager, phase, terrainGrid);
      case TacticalRole.FLANKER:
        return this.decideFlanker(unit, assessment, visibleEnemies, orderManager, weights, rng);
      case TacticalRole.RESERVE:
        return this.decideReserve(unit, assessment, unitManager, orderManager, phase);
      case TacticalRole.SCOUT:
        return this.decideScout(unit, assessment, orderManager);
      case TacticalRole.SUPPLY_RAIDER:
        return this.decideSupplyRaider(unit, assessment, visibleEnemies, orderManager);
      case TacticalRole.GUARD:
        return this.decideGuard(unit, assessment, visibleEnemies, unitManager, orderManager, weights);
      default:
        return null;
    }
  }

  // --- ATTACKER ---
  private decideAttacker(
    unit: Unit,
    assessment: BattlefieldAssessment,
    visibleEnemies: Unit[],
    orderManager: OrderManager,
    weights: PersonalityWeights,
    rng: SeededRandom,
  ): AIDecision | null {
    if (visibleEnemies.length === 0) {
      // Advance toward enemy side of map (staged to avoid pathfinding failure on large maps)
      const advanceX = this.stagedAdvanceX(unit, this.getEnemySideX());
      return this.moveIfNotAlready(unit, orderManager, OrderType.MOVE, advanceX, unit.y);
    }

    // Prefer weak targets, then nearest
    const target = this.findPreferredTarget(unit, visibleEnemies, assessment);
    if (!target) return null;

    const dist = this.distance(unit, target);
    const chargeDist = AI_CHARGE_RANGE_TILES * TILE_SIZE;

    // CHARGE if close enough and personality favors it
    if (dist <= chargeDist && rng.next() < weights.chargePreference) {
      return this.attackIfNotAlready(unit, orderManager, OrderType.CHARGE, target);
    }

    return this.attackIfNotAlready(unit, orderManager, OrderType.ATTACK, target);
  }

  // --- DEFENDER ---
  private decideDefender(
    unit: Unit,
    assessment: BattlefieldAssessment,
    visibleEnemies: Unit[],
    orderManager: OrderManager,
    phase: AIPhase,
    terrainGrid: TerrainGrid,
  ): AIDecision | null {
    // In RETREATING phase, retreat toward own side
    if (phase === AIPhase.RETREATING || phase === AIPhase.DESPERATE) {
      const retreatX = this.getOwnSideX();
      return this.moveIfNotAlready(unit, orderManager, OrderType.RETREAT, retreatX, unit.y);
    }

    // If engaged in combat, fight back
    if (this.isEngaged(unit)) {
      return null; // Already fighting, don't issue redundant orders
    }

    // Seek defensive terrain (hills/forest)
    const defTile = this.findDefensiveTerrain(unit, terrainGrid, assessment);
    if (defTile) {
      const worldX = defTile.tileX * TILE_SIZE + TILE_SIZE / 2;
      const worldY = defTile.tileY * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.sqrt((unit.x - worldX) ** 2 + (unit.y - worldY) ** 2);
      // Only move if not already close to a defensive position
      if (dist > TILE_SIZE * 2) {
        return this.moveIfNotAlready(unit, orderManager, OrderType.MOVE, worldX, worldY);
      }
    }

    // If on defensive terrain or no terrain available, hold position
    // But attack if enemy comes close
    if (visibleEnemies.length > 0) {
      const nearest = this.findNearest(unit, visibleEnemies);
      if (nearest && this.distance(unit, nearest) < TILE_SIZE * 5) {
        return this.attackIfNotAlready(unit, orderManager, OrderType.HOLD, nearest);
      }
    }

    return this.issueIfNotAlready(unit, orderManager, OrderType.FORM_UP, unit.x, unit.y);
  }

  // --- FLANKER ---
  private decideFlanker(
    unit: Unit,
    assessment: BattlefieldAssessment,
    visibleEnemies: Unit[],
    orderManager: OrderManager,
    weights: PersonalityWeights,
    rng: SeededRandom,
  ): AIDecision | null {
    // If already past enemy front and have targets, attack ranged/siege
    if (visibleEnemies.length > 0) {
      const rangedTargets = visibleEnemies.filter(e =>
        e.type === UnitType.NU_CROSSBOWMEN ||
        e.type === UnitType.GONG_ARCHERS ||
        e.type === UnitType.HORSE_ARCHERS ||
        e.type === UnitType.SIEGE_ENGINEERS
      );

      // Check if we've flanked past enemy front
      const pastFront = this.isPastEnemyFront(unit, assessment);
      if (pastFront && rangedTargets.length > 0) {
        const target = this.findNearest(unit, rangedTargets);
        if (target) {
          // Cunning flankers charge through forest for ambush bonus
          if (weights.ambushTendency > 0.5 && rng.next() < weights.ambushTendency) {
            return this.attackIfNotAlready(unit, orderManager, OrderType.CHARGE, target);
          }
          return this.attackIfNotAlready(unit, orderManager, OrderType.ATTACK, target);
        }
      }
    }

    // Calculate flanking waypoint: perpendicular offset from approach line
    const wp = this.computeFlankWaypoint(
      assessment.ownCenter, assessment.enemyCenter,
      AI_FLANKER_OFFSET_TILES * TILE_SIZE,
      unit.id % 2 === 0 ? 1 : -1, // Alternate sides based on unit ID
    );

    return this.moveIfNotAlready(unit, orderManager, OrderType.FLANK, wp.x, wp.y);
  }

  // --- RESERVE ---
  private decideReserve(
    unit: Unit,
    assessment: BattlefieldAssessment,
    _unitManager: UnitManager,
    orderManager: OrderManager,
    phase: AIPhase,
  ): AIDecision | null {
    // In PRESSING phase, reserves commit as attackers
    if (phase === AIPhase.PRESSING) {
      const advanceX = this.stagedAdvanceX(unit, this.getEnemySideX());
      return this.moveIfNotAlready(unit, orderManager, OrderType.MOVE, advanceX, unit.y);
    }

    // Hold behind front line
    const reserveX = this.team === 1
      ? assessment.ownCenter.x + AI_RESERVE_DISTANCE * TILE_SIZE
      : assessment.ownCenter.x - AI_RESERVE_DISTANCE * TILE_SIZE;

    return this.moveIfNotAlready(unit, orderManager, OrderType.FORM_UP, reserveX, assessment.ownCenter.y);
  }

  // --- SCOUT ---
  private decideScout(
    unit: Unit,
    assessment: BattlefieldAssessment,
    orderManager: OrderManager,
  ): AIDecision | null {
    // If engaged, retreat immediately
    if (this.isEngaged(unit)) {
      const retreatX = this.getOwnSideX();
      return { unitId: unit.id, orderType: OrderType.RETREAT, targetX: retreatX, targetY: unit.y };
    }

    // Check if any enemy is dangerously close
    if (assessment.visibleEnemyIds.size > 0) {
      const dx = unit.x - assessment.enemyCenter.x;
      const dy = unit.y - assessment.enemyCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < AI_SCOUT_RETREAT_RANGE * TILE_SIZE) {
        const retreatX = this.getOwnSideX();
        return { unitId: unit.id, orderType: OrderType.RETREAT, targetX: retreatX, targetY: unit.y };
      }
    }

    // Advance toward unexplored areas (enemy side) in stages
    const scoutTarget = this.stagedAdvanceX(unit, this.getEnemySideX());
    const minX = Math.floor(this.mapWidth * 0.05) * TILE_SIZE;
    const maxX = Math.floor(this.mapWidth * 0.95) * TILE_SIZE;
    const scoutX = Math.max(minX, Math.min(maxX, scoutTarget));

    return this.moveIfNotAlready(unit, orderManager, OrderType.MOVE, scoutX, unit.y);
  }

  // --- SUPPLY_RAIDER ---
  private decideSupplyRaider(
    unit: Unit,
    assessment: BattlefieldAssessment,
    visibleEnemies: Unit[],
    orderManager: OrderManager,
  ): AIDecision | null {
    // If engaged, disengage
    if (this.isEngaged(unit)) {
      return { unitId: unit.id, orderType: OrderType.DISENGAGE, targetX: this.getOwnSideX(), targetY: unit.y };
    }

    // Target enemy rear (supply column area)
    const enemyRearX = this.team === 1
      ? this.mapWidth * TILE_SIZE * AI_SUPPLY_RAID_TARGET_COL_FRAC
      : this.mapWidth * TILE_SIZE * (1 - AI_SUPPLY_RAID_TARGET_COL_FRAC);

    // If near enemy rear, look for soft targets
    const distToRear = Math.abs(unit.x - enemyRearX);
    if (distToRear < TILE_SIZE * 5 && visibleEnemies.length > 0) {
      // Attack weakest nearby target
      const weak = this.findWeakest(visibleEnemies);
      if (weak) return this.attackIfNotAlready(unit, orderManager, OrderType.ATTACK, weak);
    }

    // Move to enemy rear (staged)
    const stagedRearX = this.stagedAdvanceX(unit, enemyRearX);
    return this.moveIfNotAlready(unit, orderManager, OrderType.MOVE, stagedRearX, assessment.enemyCenter.y);
  }

  // --- GUARD ---
  private decideGuard(
    unit: Unit,
    assessment: BattlefieldAssessment,
    visibleEnemies: Unit[],
    unitManager: UnitManager,
    orderManager: OrderManager,
    weights: PersonalityWeights,
  ): AIDecision | null {
    // General: stay behind front line at safe distance
    if (unit.isGeneral) {
      const safeX = this.team === 1
        ? assessment.ownCenter.x + weights.generalSafeDistance * TILE_SIZE
        : assessment.ownCenter.x - weights.generalSafeDistance * TILE_SIZE;

      // Move further back if enemy cavalry approaches
      const cavThreats = visibleEnemies.filter(e =>
        e.type === UnitType.LIGHT_CAVALRY || e.type === UnitType.HEAVY_CAVALRY
      );
      let targetX = safeX;
      if (cavThreats.length > 0) {
        const nearestCav = this.findNearest(unit, cavThreats);
        if (nearestCav && this.distance(unit, nearestCav) < weights.generalSafeDistance * TILE_SIZE * 1.5) {
          targetX = this.team === 1
            ? targetX + 10 * TILE_SIZE
            : targetX - 10 * TILE_SIZE;
        }
      }

      // Clamp to map bounds
      targetX = Math.max(TILE_SIZE, Math.min(targetX, (this.mapWidth - 1) * TILE_SIZE));

      return this.moveIfNotAlready(unit, orderManager, OrderType.MOVE, targetX, assessment.ownCenter.y);
    }

    // Elite Guard: stay within 5 tiles of general
    const general = unitManager.getGeneral(this.team);
    if (general) {
      const dx = unit.x - general.x;
      const dy = unit.y - general.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5 * TILE_SIZE) {
        return this.moveIfNotAlready(unit, orderManager, OrderType.MOVE, general.x, general.y);
      }

      // If enemies threaten general, intercept
      if (assessment.threatsToGeneral.length > 0) {
        const threatId = assessment.threatsToGeneral[0];
        const threat = unitManager.get(threatId);
        if (threat && threat.state !== UnitState.DEAD) {
          return this.attackIfNotAlready(unit, orderManager, OrderType.ATTACK, threat);
        }
      }
    }

    return null;
  }

  // --- Helper Methods ---

  private getVisibleEnemyUnits(assessment: BattlefieldAssessment, unitManager: UnitManager): Unit[] {
    const enemies: Unit[] = [];
    for (const eid of assessment.visibleEnemyIds) {
      const u = unitManager.get(eid);
      if (u && u.state !== UnitState.DEAD) enemies.push(u);
    }
    return enemies;
  }

  private findNearest(unit: Unit, targets: Unit[]): Unit | null {
    let best: Unit | null = null;
    let bestDist = Infinity;
    for (const t of targets) {
      const d = this.distance(unit, t);
      if (d < bestDist) { bestDist = d; best = t; }
    }
    return best;
  }

  private findWeakest(targets: Unit[]): Unit | null {
    let best: Unit | null = null;
    let bestRatio = Infinity;
    for (const t of targets) {
      const ratio = t.size / t.maxSize;
      if (ratio < bestRatio) { bestRatio = ratio; best = t; }
    }
    return best;
  }

  private findPreferredTarget(unit: Unit, enemies: Unit[], assessment: BattlefieldAssessment): Unit | null {
    // Prefer weak enemies first, then nearest
    if (assessment.weakEnemies.length > 0) {
      const weakUnits = enemies.filter(e => assessment.weakEnemies.includes(e.id));
      if (weakUnits.length > 0) return this.findNearest(unit, weakUnits);
    }
    return this.findNearest(unit, enemies);
  }

  private computeFlankWaypoint(
    ownCenter: { x: number; y: number },
    enemyCenter: { x: number; y: number },
    offset: number,
    side: number, // +1 or -1
  ): { x: number; y: number } {
    const dx = enemyCenter.x - ownCenter.x;
    const dy = enemyCenter.y - ownCenter.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return { x: enemyCenter.x + offset * side, y: enemyCenter.y };

    // Perpendicular vector
    const perpX = -dy / len * offset * side;
    const perpY = dx / len * offset * side;

    // Waypoint is at enemy center offset perpendicular
    return {
      x: Math.max(TILE_SIZE, Math.min(enemyCenter.x + perpX, (this.mapWidth - 1) * TILE_SIZE)),
      y: Math.max(TILE_SIZE, Math.min(enemyCenter.y + perpY, (this.mapHeight - 1) * TILE_SIZE)),
    };
  }

  private findDefensiveTerrain(
    unit: Unit,
    _terrainGrid: TerrainGrid,
    assessment: BattlefieldAssessment,
  ): { tileX: number; tileY: number; defBonus: number } | null {
    // Use pre-scanned terrain advantages from assessment
    if (assessment.terrainAdvantages.length === 0) return null;

    // Find nearest advantageous tile to this unit
    let best: { tileX: number; tileY: number; defBonus: number } | null = null;
    let bestDist = Infinity;
    for (const t of assessment.terrainAdvantages) {
      const wx = t.tileX * TILE_SIZE + TILE_SIZE / 2;
      const wy = t.tileY * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.sqrt((unit.x - wx) ** 2 + (unit.y - wy) ** 2);
      // Weighted by defense bonus — prefer closer high-bonus tiles
      const score = dist / (1 + t.defBonus);
      if (score < bestDist) {
        bestDist = score;
        best = t;
      }
    }
    return best;
  }

  private isPastEnemyFront(unit: Unit, assessment: BattlefieldAssessment): boolean {
    if (this.team === 1) {
      // Team 1 is on the right. Past enemy front = unit is to the left of enemy center
      return unit.x < assessment.enemyCenter.x;
    }
    return unit.x > assessment.enemyCenter.x;
  }

  private isEngaged(unit: Unit): boolean {
    return unit.combatTargetId !== -1 || unit.state === UnitState.ATTACKING;
  }

  private distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getOwnSideX(): number {
    return this.team === 1
      ? Math.floor(this.mapWidth * 0.80) * TILE_SIZE
      : Math.floor(this.mapWidth * 0.20) * TILE_SIZE;
  }

  private getEnemySideX(): number {
    return this.team === 1
      ? Math.floor(this.mapWidth * 0.20) * TILE_SIZE
      : Math.floor(this.mapWidth * 0.80) * TILE_SIZE;
  }

  /** Advance toward a target in stages of ~25 tiles to avoid pathfinding failures on large maps with obstacles. */
  private stagedAdvanceX(unit: Unit, targetX: number): number {
    const maxStepPx = 25 * TILE_SIZE;
    const dx = targetX - unit.x;
    if (Math.abs(dx) <= maxStepPx) return targetX;
    return unit.x + Math.sign(dx) * maxStepPx;
  }

  // --- Order deduplication helpers ---

  private shouldSkipOrder(unit: Unit, orderManager: OrderManager, orderType: OrderType, targetX?: number, targetY?: number, targetUnitId?: number): boolean {
    const current = orderManager.getOrder(unit.id);
    if (!current) return false;
    if (current.type !== orderType) return false;

    // Same order type — check if target is similar
    if (targetUnitId !== undefined && current.targetUnitId === targetUnitId) return true;
    if (targetX !== undefined && targetY !== undefined && current.targetX !== undefined && current.targetY !== undefined) {
      const dx = (current.targetX - targetX);
      const dy = (current.targetY - targetY);
      if (dx * dx + dy * dy < (TILE_SIZE * 3) ** 2) return true; // Within 3 tiles = same order
    }
    return false;
  }

  private moveIfNotAlready(unit: Unit, orderManager: OrderManager, orderType: OrderType, x: number, y: number): AIDecision | null {
    if (this.shouldSkipOrder(unit, orderManager, orderType, x, y)) return null;
    return { unitId: unit.id, orderType, targetX: x, targetY: y };
  }

  private attackIfNotAlready(unit: Unit, orderManager: OrderManager, orderType: OrderType, target: Unit): AIDecision | null {
    if (this.shouldSkipOrder(unit, orderManager, orderType, target.x, target.y, target.id)) return null;
    return { unitId: unit.id, orderType, targetX: target.x, targetY: target.y, targetUnitId: target.id };
  }

  private issueIfNotAlready(unit: Unit, orderManager: OrderManager, orderType: OrderType, x: number, y: number): AIDecision | null {
    if (this.shouldSkipOrder(unit, orderManager, orderType, x, y)) return null;
    return { unitId: unit.id, orderType, targetX: x, targetY: y };
  }
}
