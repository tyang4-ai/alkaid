import { TerrainGrid } from './terrain/TerrainGrid';
import type { Unit } from './units/Unit';
import type { EnvironmentState } from './environment/EnvironmentState';
import type { FogOfWarSnapshot } from './persistence/SaveTypes';
import {
  TILE_SIZE, UnitType, UnitState, TerrainType,
  FOW_BASE_VISION_TILES,
  FOW_SCOUT_STEALTH_RANGE,
  FOW_HILL_ELEVATION_BONUS,
  FOW_TICK_RECOMPUTE_INTERVAL,
  FOW_DIRTY_MOVE_THRESHOLD_TILES,
  FOW_VISION_MULTIPLIERS,
  FOW_TERRAIN_BLOCKS_LOS,
  WEATHER_MODIFIERS,
  TIME_OF_DAY_MODIFIERS,
} from '../constants';

export const FogVisibility = { UNEXPLORED: 0, EXPLORED: 1, VISIBLE: 2 } as const;
export type FogVisibility = (typeof FogVisibility)[keyof typeof FogVisibility];

// Standard 8-octant multiplier table for symmetric shadowcasting
// Each entry: [xx, xy, yx, yy] transforms (col, row) → (dx, dy)
const OCTANT_TRANSFORMS: [number, number, number, number][] = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
];

interface UnitTilePos {
  tileX: number;
  tileY: number;
}

export class FogOfWarSystem {
  private grid: TerrainGrid;
  private mapWidth: number;
  private mapHeight: number;
  tiles: Uint8Array;
  version = 0;

  private visibleEnemyIds = new Set<number>();
  private stealthedScoutIds = new Set<number>();
  private lastComputedPos = new Map<number, UnitTilePos>();

  constructor(grid: TerrainGrid, mapWidth: number, mapHeight: number) {
    this.grid = grid;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.tiles = new Uint8Array(mapWidth * mapHeight); // All 0 = UNEXPLORED
  }

  tick(
    currentTick: number,
    playerUnits: Unit[],
    enemyUnits: Unit[],
    env: EnvironmentState | null,
  ): void {
    // Check dirty flag: has any player unit moved >= 1 tile?
    let dirty = false;
    for (const unit of playerUnits) {
      if (unit.state === UnitState.DEAD) continue;
      const tileX = Math.floor(unit.x / TILE_SIZE);
      const tileY = Math.floor(unit.y / TILE_SIZE);
      const last = this.lastComputedPos.get(unit.id);
      if (!last) {
        dirty = true;
        break;
      }
      const dx = Math.abs(tileX - last.tileX);
      const dy = Math.abs(tileY - last.tileY);
      if (dx >= FOW_DIRTY_MOVE_THRESHOLD_TILES || dy >= FOW_DIRTY_MOVE_THRESHOLD_TILES) {
        dirty = true;
        break;
      }
    }

    // Fallback interval recompute
    if (!dirty && currentTick % FOW_TICK_RECOMPUTE_INTERVAL !== 0) {
      return; // No recompute needed
    }

    // Phase 1: Downgrade VISIBLE → EXPLORED
    const prevVisibleCount = this.countVisible();
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i] === FogVisibility.VISIBLE) {
        this.tiles[i] = FogVisibility.EXPLORED;
      }
    }

    // Phase 2: Compute vision for each living player unit
    for (const unit of playerUnits) {
      if (unit.state === UnitState.DEAD) continue;

      const tileX = Math.floor(unit.x / TILE_SIZE);
      const tileY = Math.floor(unit.y / TILE_SIZE);
      const radius = this.computeEffectiveVisionRadius(unit, env);
      const viewerElevation = this.grid.getElevation(tileX, tileY);

      this.shadowcastAll(tileX, tileY, radius, viewerElevation);

      // Update last computed position
      this.lastComputedPos.set(unit.id, { tileX, tileY });
    }

    // Phase 3: Build visible enemy IDs
    this.visibleEnemyIds.clear();
    for (const enemy of enemyUnits) {
      if (enemy.state === UnitState.DEAD) continue;
      const etx = Math.floor(enemy.x / TILE_SIZE);
      const ety = Math.floor(enemy.y / TILE_SIZE);
      if (this.getVisibility(etx, ety) === FogVisibility.VISIBLE) {
        // Check if this enemy is a stealthed scout
        if (enemy.type === UnitType.SCOUTS && this.isEnemyScoutStealthed(enemy, playerUnits)) {
          continue; // Stealthed enemy scout — not visible
        }
        this.visibleEnemyIds.add(enemy.id);
      }
    }

    // Phase 4: Compute player scout stealth
    this.stealthedScoutIds.clear();
    const enemyHasScouts = enemyUnits.some(
      u => u.type === UnitType.SCOUTS && u.state !== UnitState.DEAD,
    );

    for (const unit of playerUnits) {
      if (unit.type !== UnitType.SCOUTS || unit.state === UnitState.DEAD) continue;

      if (enemyHasScouts) continue; // Enemy scouts reveal all player scouts

      // Check if any enemy is within stealth detection range
      const unitTX = Math.floor(unit.x / TILE_SIZE);
      const unitTY = Math.floor(unit.y / TILE_SIZE);
      let detected = false;

      for (const enemy of enemyUnits) {
        if (enemy.state === UnitState.DEAD) continue;
        const etx = Math.floor(enemy.x / TILE_SIZE);
        const ety = Math.floor(enemy.y / TILE_SIZE);
        const dist = Math.max(Math.abs(etx - unitTX), Math.abs(ety - unitTY)); // Chebyshev
        if (dist <= FOW_SCOUT_STEALTH_RANGE) {
          detected = true;
          break;
        }
      }

      if (!detected) {
        this.stealthedScoutIds.add(unit.id);
      }
    }

    // Phase 5: Increment version
    const nowVisibleCount = this.countVisible();
    if (prevVisibleCount !== nowVisibleCount || dirty) {
      this.version++;
    }
  }

  computeEffectiveVisionRadius(unit: Unit, env: EnvironmentState | null): number {
    const base = FOW_BASE_VISION_TILES;
    const typeMult = FOW_VISION_MULTIPLIERS[unit.type] ?? 1;

    let weatherMult = 1.0;
    let todMult = 1.0;
    if (env) {
      const weatherMods = WEATHER_MODIFIERS[env.weather as keyof typeof WEATHER_MODIFIERS];
      if (weatherMods) weatherMult = weatherMods.visibilityMult;
      const todMods = TIME_OF_DAY_MODIFIERS[env.timeOfDay as keyof typeof TIME_OF_DAY_MODIFIERS];
      if (todMods) todMult = todMods.visibilityMult;
    }

    const tileX = Math.floor(unit.x / TILE_SIZE);
    const tileY = Math.floor(unit.y / TILE_SIZE);
    const terrain = this.grid.getTerrain(tileX, tileY);
    const hillBonus = terrain === TerrainType.HILLS ? (1 + FOW_HILL_ELEVATION_BONUS) : 1.0;

    return Math.max(1, Math.floor(base * typeMult * weatherMult * todMult * hillBonus));
  }

  getVisibility(tileX: number, tileY: number): FogVisibility {
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
      return FogVisibility.UNEXPLORED;
    }
    return this.tiles[tileY * this.mapWidth + tileX] as FogVisibility;
  }

  getVisibleEnemyIds(): Set<number> {
    return this.visibleEnemyIds;
  }

  isScoutStealthed(scoutId: number): boolean {
    return this.stealthedScoutIds.has(scoutId);
  }

  serialize(): FogOfWarSnapshot {
    return { tiles: Array.from(this.tiles) };
  }

  deserialize(data: FogOfWarSnapshot): void {
    const len = Math.min(data.tiles.length, this.tiles.length);
    for (let i = 0; i < len; i++) {
      this.tiles[i] = data.tiles[i];
    }
    this.version++;
  }

  reset(): void {
    this.tiles.fill(0);
    this.visibleEnemyIds.clear();
    this.stealthedScoutIds.clear();
    this.lastComputedPos.clear();
    this.version++;
  }

  // --- Private methods ---

  private countVisible(): number {
    let count = 0;
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i] === FogVisibility.VISIBLE) count++;
    }
    return count;
  }

  private setVisible(tileX: number, tileY: number): void {
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return;
    this.tiles[tileY * this.mapWidth + tileX] = FogVisibility.VISIBLE;
  }

  private isBlocker(tileX: number, tileY: number, viewerElevation: number): boolean {
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return true;
    const terrain = this.grid.getTerrain(tileX, tileY);
    if (FOW_TERRAIN_BLOCKS_LOS[terrain]) return true;
    // Uphill blocking: significantly higher elevation blocks LOS
    const tileElev = this.grid.getElevation(tileX, tileY);
    if (tileElev > viewerElevation + 0.15) return true;
    return false;
  }

  private shadowcastAll(
    originX: number,
    originY: number,
    radius: number,
    viewerElevation: number,
  ): void {
    // Origin tile always visible
    this.setVisible(originX, originY);

    for (const [xx, xy, yx, yy] of OCTANT_TRANSFORMS) {
      this.shadowcastOctant(originX, originY, radius, viewerElevation, 1, 1.0, 0.0, xx, xy, yx, yy);
    }
  }

  /**
   * Recursive symmetric shadowcasting for one octant.
   * Scans columns (or rows) outward from origin. Each column spans a range
   * of "slope" values [topSlope, bottomSlope].
   * Blockers narrow the visible range; gaps maintain it.
   */
  private shadowcastOctant(
    originX: number,
    originY: number,
    radius: number,
    viewerElevation: number,
    col: number,
    topSlope: number,
    bottomSlope: number,
    xx: number,
    xy: number,
    yx: number,
    yy: number,
  ): void {
    if (col > radius) return;
    if (topSlope < bottomSlope) return;

    let prevBlocked = false;
    let newTopSlope = topSlope;

    const minRow = Math.floor(col * bottomSlope + 0.5);
    const maxRow = Math.floor(col * topSlope + 0.5);

    for (let row = maxRow; row >= minRow; row--) {
      const dx = xx * col + xy * row;
      const dy = yx * col + yy * row;
      const tileX = originX + dx;
      const tileY = originY + dy;

      // Check if within radius (circular FOV)
      const dist2 = dx * dx + dy * dy;
      if (dist2 > radius * radius) {
        prevBlocked = false;
        continue;
      }

      const blocked = this.isBlocker(tileX, tileY, viewerElevation);

      // The tile is visible (it may block, but it's still visible itself)
      this.setVisible(tileX, tileY);

      if (blocked) {
        if (!prevBlocked) {
          // Start of a new blocker section — recurse with narrowed slope
          const blockSlope = (row + 0.5) / (col - 0.5);
          this.shadowcastOctant(
            originX, originY, radius, viewerElevation,
            col + 1, newTopSlope, blockSlope,
            xx, xy, yx, yy,
          );
        }
        prevBlocked = true;
        newTopSlope = (row - 0.5) / (col + 0.5);
      } else {
        prevBlocked = false;
      }
    }

    // Continue scanning if the last cell wasn't blocked
    if (!prevBlocked) {
      this.shadowcastOctant(
        originX, originY, radius, viewerElevation,
        col + 1, newTopSlope, bottomSlope,
        xx, xy, yx, yy,
      );
    }
  }

  /**
   * Check if an enemy scout is stealthed from the player's perspective.
   * Enemy scouts are stealthed unless the player has scouts or the scout
   * is within FOW_SCOUT_STEALTH_RANGE of a player unit.
   */
  private isEnemyScoutStealthed(enemyScout: Unit, playerUnits: Unit[]): boolean {
    // Player has scouts → all enemy scouts are visible
    const playerHasScouts = playerUnits.some(
      u => u.type === UnitType.SCOUTS && u.state !== UnitState.DEAD,
    );
    if (playerHasScouts) return false;

    // Check if any player unit is close enough to detect
    const etx = Math.floor(enemyScout.x / TILE_SIZE);
    const ety = Math.floor(enemyScout.y / TILE_SIZE);
    for (const pu of playerUnits) {
      if (pu.state === UnitState.DEAD) continue;
      const ptx = Math.floor(pu.x / TILE_SIZE);
      const pty = Math.floor(pu.y / TILE_SIZE);
      const dist = Math.max(Math.abs(etx - ptx), Math.abs(ety - pty));
      if (dist <= FOW_SCOUT_STEALTH_RANGE) return false;
    }

    return true; // Stealthed
  }
}
