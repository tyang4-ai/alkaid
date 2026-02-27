import type { Unit } from '../units/Unit';
import type { UnitManager } from '../units/UnitManager';
import type { SpatialHash } from '../pathfinding/SpatialHash';
import type { TerrainGrid } from '../terrain/TerrainGrid';
import type { MoraleSystem } from './MoraleSystem';
import type { EnvironmentState } from '../environment/EnvironmentState';
import { calculateDamage } from './DamageCalculator';
import { eventBus } from '../../core/EventBus';
import {
  UnitState, UNIT_TYPE_CONFIGS,
  TILE_SIZE, SIM_TICK_RATE,
  COMBAT_DETECT_INTERVAL_TICKS,
  COMBAT_DISENGAGE_RANGE_MULT,
  CAVALRY_CHARGE_MORALE_SHOCK,
  UnitType,
  SIEGE_SETUP_TICKS,
  SIEGE_AREA_RADIUS_TILES,
  HOLD_DEFENSE_BONUS,
  OrderType,
} from '../../constants';

export class CombatSystem {
  private terrainGrid: TerrainGrid;
  private positionMap = new Map<number, { x: number; y: number }>();

  constructor(terrainGrid: TerrainGrid) {
    this.terrainGrid = terrainGrid;
  }

  tick(
    currentTick: number,
    unitManager: UnitManager,
    spatialHash: SpatialHash,
    moraleSystem: MoraleSystem,
    _armyFoodPercents?: Map<number, number>,
    env?: EnvironmentState,
  ): void {
    // Rebuild position map for spatial queries
    this.positionMap.clear();
    for (const unit of unitManager.getAll()) {
      if (unit.state !== UnitState.DEAD) {
        this.positionMap.set(unit.id, { x: unit.x, y: unit.y });
      }
    }

    // Detection phase: every N ticks, find new engagements
    if (currentTick % COMBAT_DETECT_INTERVAL_TICKS === 0) {
      this.detectEngagements(unitManager, spatialHash);
    }

    // Process active combats every tick
    this.processActiveCombats(currentTick, unitManager, moraleSystem, env);
  }

  private detectEngagements(unitManager: UnitManager, spatialHash: SpatialHash): void {
    for (const unit of unitManager.getAll()) {
      if (unit.state === UnitState.DEAD || unit.state === UnitState.ROUTING) continue;
      if (unit.combatTargetId !== -1) continue; // Already engaged
      if (unit.isGeneral) continue; // Generals don't auto-engage

      const cfg = UNIT_TYPE_CONFIGS[unit.type];
      const rangePx = cfg.range * TILE_SIZE;

      // Use wide query for ranged units, near query for melee
      const candidates = rangePx > TILE_SIZE * 2
        ? spatialHash.queryRadiusWide(unit.x, unit.y, rangePx, this.positionMap)
        : spatialHash.queryNear(unit.x, unit.y);

      let bestTarget: Unit | undefined;
      let bestDist = Infinity;

      for (const candidateId of candidates) {
        if (candidateId === unit.id) continue;
        const candidate = unitManager.get(candidateId);
        if (!candidate) continue;
        if (candidate.team === unit.team) continue;
        if (candidate.state === UnitState.DEAD) continue;

        const dx = candidate.x - unit.x;
        const dy = candidate.y - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= rangePx && dist < bestDist) {
          bestDist = dist;
          bestTarget = candidate;
        }
      }

      if (bestTarget) {
        unit.combatTargetId = bestTarget.id;
        unit.state = UnitState.ATTACKING;
        unit.combatTicks = 0;

        eventBus.emit('combat:engaged', {
          attackerId: unit.id,
          defenderId: bestTarget.id,
        });
      }
    }
  }

  private processActiveCombats(
    currentTick: number,
    unitManager: UnitManager,
    moraleSystem: MoraleSystem,
    env?: EnvironmentState,
  ): void {
    for (const unit of unitManager.getAll()) {
      if (unit.state === UnitState.DEAD) continue;
      if (unit.combatTargetId === -1) continue;

      const target = unitManager.get(unit.combatTargetId);

      // Target gone or dead — disengage
      if (!target || target.state === UnitState.DEAD) {
        unit.combatTargetId = -1;
        unit.combatTicks = 0;
        if (unit.state === UnitState.ATTACKING) {
          unit.state = UnitState.IDLE;
        }
        continue;
      }

      // Check range — disengage if target moved out of range
      const cfg = UNIT_TYPE_CONFIGS[unit.type];
      const rangePx = cfg.range * TILE_SIZE * COMBAT_DISENGAGE_RANGE_MULT;
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > rangePx) {
        unit.combatTargetId = -1;
        unit.combatTicks = 0;
        if (unit.state === UnitState.ATTACKING) {
          unit.state = UnitState.IDLE;
        }
        continue;
      }

      // Check attack cooldown
      if (unit.attackCooldown > 0) {
        unit.attackCooldown--;
        unit.combatTicks++;
        continue;
      }

      // Siege setup requirement
      if (unit.type === UnitType.SIEGE_ENGINEERS) {
        if (unit.siegeSetupTicks < SIEGE_SETUP_TICKS) {
          unit.siegeSetupTicks++;
          continue;
        }
      }

      // Ranged units can't fire while moving check
      const isMoving = unit.state === UnitState.MOVING;

      // Face the target
      unit.facing = Math.atan2(dy, dx);

      // Calculate damage
      const defTileX = Math.floor(target.x / TILE_SIZE);
      const defTileY = Math.floor(target.y / TILE_SIZE);
      const defTerrain = this.terrainGrid.getTerrain(
        Math.min(defTileX, this.terrainGrid.width - 1),
        Math.min(defTileY, this.terrainGrid.height - 1),
      );

      const result = calculateDamage(unit, target, defTerrain, isMoving, 1.0, env);

      if (result.finalDamage <= 0) continue;

      // Apply hold defense bonus
      if (target.orderModifier === OrderType.HOLD) {
        result.finalDamage *= (1 - HOLD_DEFENSE_BONUS);
      }

      // Apply damage to HP pool, then derive casualties
      target.hp -= result.finalDamage;
      if (target.hp < 0) target.hp = 0;

      const hpPerSoldier = UNIT_TYPE_CONFIGS[target.type].hpPerSoldier;
      const expectedSize = Math.ceil(target.hp / hpPerSoldier);
      const prevSize = target.size;
      let killed = prevSize - expectedSize;
      if (killed < 0) killed = 0;
      if (killed > target.size) killed = target.size;
      target.size -= killed;

      // Set cooldown based on attack speed
      const ticksPerAttack = Math.round(SIM_TICK_RATE / cfg.attackSpeed);
      unit.attackCooldown = ticksPerAttack;
      unit.lastAttackTick = currentTick;

      // Cavalry charge: mark as used
      if (result.wasCharge) {
        unit.hasCharged = true;

        eventBus.emit('combat:chargeImpact', {
          unitId: unit.id,
          targetId: target.id,
          damage: result.finalDamage,
        });

        // Heavy cav morale shock
        if (unit.type === UnitType.HEAVY_CAVALRY) {
          target.morale += CAVALRY_CHARGE_MORALE_SHOCK;
          target.morale = Math.max(0, target.morale);
        }
      }

      // Emit damage event
      if (killed > 0) {
        eventBus.emit('combat:damage', {
          attackerId: unit.id,
          defenderId: target.id,
          damage: result.finalDamage,
          killed,
        });

        // Morale loss from casualties
        const percentLost = (killed / prevSize) * 100;
        moraleSystem.applyCasualtyMorale(target, percentLost);
      }

      // Increment combat ticks (after first attack so charge check works on combatTicks===0)
      unit.combatTicks++;

      // Siege area damage
      if (unit.type === UnitType.SIEGE_ENGINEERS && killed > 0) {
        this.applySiegeSplash(unit, target, unitManager, moraleSystem, currentTick);
      }

      // Death check
      if (target.size <= 0) {
        target.state = UnitState.DEAD;
        eventBus.emit('combat:unitDestroyed', {
          unitId: target.id,
          killedBy: unit.id,
        });

        unit.combatTargetId = -1;
        unit.combatTicks = 0;
        if (unit.state === UnitState.ATTACKING) {
          unit.state = UnitState.IDLE;
        }
      }
    }
  }

  private applySiegeSplash(
    siege: Unit,
    primaryTarget: Unit,
    unitManager: UnitManager,
    moraleSystem: MoraleSystem,
    _currentTick: number,
  ): void {
    const splashRadiusPx = SIEGE_AREA_RADIUS_TILES * TILE_SIZE;
    const splashDamageMult = 0.5;

    for (const other of unitManager.getAll()) {
      if (other.id === primaryTarget.id) continue;
      if (other.team === siege.team) continue;
      if (other.state === UnitState.DEAD) continue;

      const dx = other.x - primaryTarget.x;
      const dy = other.y - primaryTarget.y;
      if (dx * dx + dy * dy <= splashRadiusPx * splashRadiusPx) {
        const splashDamage = UNIT_TYPE_CONFIGS[siege.type].damage * splashDamageMult;
        const splashKilled = Math.floor(splashDamage / UNIT_TYPE_CONFIGS[other.type].hpPerSoldier);
        const actualKilled = Math.min(splashKilled, other.size);

        if (actualKilled > 0) {
          const prevSize = other.size;
          other.size -= actualKilled;
          other.hp = other.size * UNIT_TYPE_CONFIGS[other.type].hpPerSoldier;

          const percentLost = (actualKilled / prevSize) * 100;
          moraleSystem.applyCasualtyMorale(other, percentLost);

          if (other.size <= 0) {
            other.state = UnitState.DEAD;
            eventBus.emit('combat:unitDestroyed', {
              unitId: other.id,
              killedBy: siege.id,
            });
          }
        }
      }
    }
  }

  /** Get all active combat pairs (for rendering attack lines). */
  getEngagedPairs(unitManager: UnitManager): Array<{ attacker: Unit; defender: Unit }> {
    const pairs: Array<{ attacker: Unit; defender: Unit }> = [];
    const seen = new Set<string>();

    for (const unit of unitManager.getAll()) {
      if (unit.combatTargetId === -1 || unit.state === UnitState.DEAD) continue;
      const target = unitManager.get(unit.combatTargetId);
      if (!target || target.state === UnitState.DEAD) continue;

      // Deduplicate: use sorted ID pair
      const key = unit.id < target.id ? `${unit.id}-${target.id}` : `${target.id}-${unit.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      pairs.push({ attacker: unit, defender: target });
    }
    return pairs;
  }
}
