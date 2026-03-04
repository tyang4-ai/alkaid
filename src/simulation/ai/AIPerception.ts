import type { Unit } from '../units/Unit';
import type { UnitManager } from '../units/UnitManager';
import type { SupplySystem } from '../metrics/SupplySystem';
import type { EnvironmentState } from '../environment/EnvironmentState';
import { FogOfWarSystem } from '../FogOfWarSystem';
import { TerrainGrid } from '../terrain/TerrainGrid';
import {
  UnitState, TILE_SIZE, UNIT_TYPE_CONFIGS, TERRAIN_STATS, TerrainType,
  AI_STRENGTH_FATIGUE_DIVISOR, AI_LOW_MORALE_THRESHOLD, AI_LOW_SIZE_THRESHOLD,
  AI_THREAT_RADIUS_GENERAL,
} from '../../constants';
import type { BattlefieldAssessment } from './AITypes';

export class AIPerception {
  team: number;
  fogOfWar: FogOfWarSystem;
  terrainGrid: TerrainGrid;

  constructor(team: number, fogOfWar: FogOfWarSystem, terrainGrid: TerrainGrid) {
    this.team = team;
    this.fogOfWar = fogOfWar;
    this.terrainGrid = terrainGrid;
  }

  assess(
    unitManager: UnitManager,
    _supplySystem: SupplySystem,
    _env: EnvironmentState | null,
    currentTick: number,
    initialUnitCount: number,
  ): BattlefieldAssessment {
    const ownUnits = unitManager.getByTeam(this.team).filter(u => u.state !== UnitState.DEAD);
    const visibleEnemyIds = this.fogOfWar.getVisibleEnemyIds();

    // Collect visible enemy units
    const visibleEnemies: Unit[] = [];
    for (const eid of visibleEnemyIds) {
      const u = unitManager.get(eid);
      if (u && u.state !== UnitState.DEAD) visibleEnemies.push(u);
    }

    // Own center + strength
    const ownCenter = this.computeCenter(ownUnits);
    const ownStrength = this.computeStrength(ownUnits);

    // Enemy center + strength (from visible only)
    const enemyCenter = visibleEnemies.length > 0
      ? this.computeCenter(visibleEnemies)
      : { x: this.team === 1 ? 0 : this.terrainGrid.width * TILE_SIZE, y: ownCenter.y };
    const enemyStrength = this.computeStrength(visibleEnemies);

    // Strength ratio (guard against division by zero)
    const strengthRatio = enemyStrength > 0 ? ownStrength / enemyStrength : ownStrength > 0 ? 10 : 1;

    // Average morale
    const ownAvgMorale = ownUnits.length > 0
      ? ownUnits.reduce((s, u) => s + u.morale, 0) / ownUnits.length : 0;
    const enemyAvgMorale = visibleEnemies.length > 0
      ? visibleEnemies.reduce((s, u) => s + u.morale, 0) / visibleEnemies.length : 50;

    // Casualty percentages
    const ownCasualtyPercent = initialUnitCount > 0
      ? 1 - ownUnits.length / initialUnitCount : 0;

    // For enemy casualties we can only estimate from visible info
    const enemyCasualtyPercent = visibleEnemies.length > 0
      ? visibleEnemies.reduce((s, u) => s + (1 - u.size / u.maxSize), 0) / visibleEnemies.length : 0;

    // Flankable enemies: >45° offset from direct approach vector
    const flankableEnemies = this.findFlankableEnemies(visibleEnemies, ownCenter, enemyCenter);

    // Weak enemies
    const weakEnemies = visibleEnemies
      .filter(u => u.morale < AI_LOW_MORALE_THRESHOLD || u.size / u.maxSize < AI_LOW_SIZE_THRESHOLD)
      .map(u => u.id);

    // Terrain advantages: hills/forest near front line
    const terrainAdvantages = this.scanTerrainAdvantages(ownCenter, enemyCenter, visibleEnemies);

    // General threats
    const general = unitManager.getGeneral(this.team);
    const threatsToGeneral = general
      ? this.findThreats(general, visibleEnemies, AI_THREAT_RADIUS_GENERAL)
      : [];

    // Supply threats (enemies in our rear zone)
    const threatsToSupply = this.findSupplyThreats(visibleEnemies);

    // Engagement counts
    let ownEngagedCount = 0;
    let ownIdleCount = 0;
    let ownRoutingCount = 0;
    for (const u of ownUnits) {
      if (u.state === UnitState.ROUTING) ownRoutingCount++;
      else if (u.combatTargetId !== -1 || u.state === UnitState.ATTACKING) ownEngagedCount++;
      else ownIdleCount++;
    }

    return {
      ownStrength,
      enemyStrength,
      strengthRatio,
      ownCenter,
      enemyCenter,
      ownAvgMorale,
      enemyAvgMorale,
      ownCasualtyPercent,
      enemyCasualtyPercent,
      flankableEnemies,
      weakEnemies,
      terrainAdvantages,
      threatsToGeneral,
      threatsToSupply,
      ownEngagedCount,
      ownIdleCount,
      ownRoutingCount,
      visibleEnemyIds,
      currentTick,
    };
  }

  private computeCenter(units: Unit[]): { x: number; y: number } {
    if (units.length === 0) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    for (const u of units) { sx += u.x; sy += u.y; }
    return { x: sx / units.length, y: sy / units.length };
  }

  private computeStrength(units: Unit[]): number {
    let total = 0;
    for (const u of units) {
      const cfg = UNIT_TYPE_CONFIGS[u.type];
      if (!cfg) continue;
      const sizeRatio = u.size / u.maxSize;
      const fatiguePenalty = 1 - u.fatigue / AI_STRENGTH_FATIGUE_DIVISOR;
      total += sizeRatio * cfg.damage * cfg.attackSpeed * fatiguePenalty;
    }
    return total;
  }

  private findFlankableEnemies(
    enemies: Unit[],
    ownCenter: { x: number; y: number },
    enemyCenter: { x: number; y: number },
  ): number[] {
    if (enemies.length === 0) return [];

    // Approach vector: own center → enemy center
    const dx = enemyCenter.x - ownCenter.x;
    const dy = enemyCenter.y - ownCenter.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return [];

    const approachX = dx / len;
    const approachY = dy / len;

    const result: number[] = [];
    for (const e of enemies) {
      // Vector from own center to this enemy
      const ex = e.x - ownCenter.x;
      const ey = e.y - ownCenter.y;
      const elen = Math.sqrt(ex * ex + ey * ey);
      if (elen < 1) continue;

      // Dot product to find angle between approach and enemy direction
      const dot = (ex / elen) * approachX + (ey / elen) * approachY;
      // cos(45°) ≈ 0.707; if dot < 0.707, angle > 45°
      if (dot < 0.707) {
        result.push(e.id);
      }
    }
    return result;
  }

  private scanTerrainAdvantages(
    ownCenter: { x: number; y: number },
    enemyCenter: { x: number; y: number },
    visibleEnemies: Unit[],
  ): Array<{ tileX: number; tileY: number; defBonus: number }> {
    const result: Array<{ tileX: number; tileY: number; defBonus: number }> = [];

    // Midpoint between centers as "front line" reference
    const midX = (ownCenter.x + enemyCenter.x) / 2;
    const midY = (ownCenter.y + enemyCenter.y) / 2;
    const midTileX = Math.floor(midX / TILE_SIZE);
    const midTileY = Math.floor(midY / TILE_SIZE);

    // Scan 10-tile radius around the midpoint
    const scanRadius = 10;
    for (let dy = -scanRadius; dy <= scanRadius; dy++) {
      for (let dx = -scanRadius; dx <= scanRadius; dx++) {
        const tx = midTileX + dx;
        const ty = midTileY + dy;
        if (tx < 0 || tx >= this.terrainGrid.width || ty < 0 || ty >= this.terrainGrid.height) continue;

        const terrain = this.terrainGrid.getTerrain(tx, ty);
        const stats = TERRAIN_STATS[terrain as TerrainType];
        if (!stats || stats.defBonus <= 0) continue;

        // Skip tiles occupied by enemies
        const worldX = tx * TILE_SIZE + TILE_SIZE / 2;
        const worldY = ty * TILE_SIZE + TILE_SIZE / 2;
        let enemyOccupied = false;
        for (const e of visibleEnemies) {
          const edx = e.x - worldX;
          const edy = e.y - worldY;
          if (edx * edx + edy * edy < TILE_SIZE * TILE_SIZE) {
            enemyOccupied = true;
            break;
          }
        }
        if (enemyOccupied) continue;

        result.push({ tileX: tx, tileY: ty, defBonus: stats.defBonus });
      }
    }

    // Sort by defense bonus descending, take top 10
    result.sort((a, b) => b.defBonus - a.defBonus);
    return result.slice(0, 10);
  }

  private findThreats(target: Unit, enemies: Unit[], radiusTiles: number): number[] {
    const radiusPx = radiusTiles * TILE_SIZE;
    const r2 = radiusPx * radiusPx;
    const result: number[] = [];
    for (const e of enemies) {
      const dx = e.x - target.x;
      const dy = e.y - target.y;
      if (dx * dx + dy * dy <= r2) result.push(e.id);
    }
    return result;
  }

  private findSupplyThreats(visibleEnemies: Unit[]): number[] {
    // AI is team 1, deployed on right side. Rear zone = >70% of map width
    const mapWidthPx = this.terrainGrid.width * TILE_SIZE;
    const rearThreshold = this.team === 1 ? mapWidthPx * 0.7 : mapWidthPx * 0.3;
    const result: number[] = [];
    for (const e of visibleEnemies) {
      if (this.team === 1 ? e.x > rearThreshold : e.x < rearThreshold) {
        result.push(e.id);
      }
    }
    return result;
  }
}
