import { TerrainGrid } from '../terrain/TerrainGrid';
import { TerrainType, TILE_SIZE, DEPLOYMENT_ZONE_FRACTION } from '../../constants';

const BLOCKED_TERRAIN = new Set<TerrainType>([
  TerrainType.WATER,
  TerrainType.MOUNTAINS,
  TerrainType.RIVER,
]);

export class DeploymentZone {
  readonly validTiles: Set<number>;  // Set of (y * width + x)
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };
  private readonly gridWidth: number;
  private readonly gridHeight: number;

  constructor(terrainGrid: TerrainGrid, templateId: string, team: number) {
    this.gridWidth = terrainGrid.width;
    this.gridHeight = terrainGrid.height;
    this.validTiles = new Set();

    const candidateTiles = this.getCandidateTiles(terrainGrid, templateId, team);

    // Filter to walkable tiles only
    for (const key of candidateTiles) {
      const tx = key % terrainGrid.width;
      const ty = Math.floor(key / terrainGrid.width);
      if (!BLOCKED_TERRAIN.has(terrainGrid.getTerrain(tx, ty))) {
        this.validTiles.add(key);
      }
    }

    // Compute pixel bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const key of this.validTiles) {
      const tx = key % terrainGrid.width;
      const ty = Math.floor(key / terrainGrid.width);
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px + TILE_SIZE > maxX) maxX = px + TILE_SIZE;
      if (py + TILE_SIZE > maxY) maxY = py + TILE_SIZE;
    }

    this.bounds = this.validTiles.size > 0
      ? { minX, minY, maxX, maxY }
      : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  isInZone(worldX: number, worldY: number): boolean {
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    return this.validTiles.has(ty * this.gridWidth + tx);
  }

  isValidPlacement(tileX: number, tileY: number): boolean {
    return this.validTiles.has(tileY * this.gridWidth + tileX);
  }

  findNearestValid(worldX: number, worldY: number): { x: number; y: number } | null {
    const originTx = Math.floor(worldX / TILE_SIZE);
    const originTy = Math.floor(worldY / TILE_SIZE);

    // Check origin first
    if (this.validTiles.has(originTy * this.gridWidth + originTx)) {
      return this.tileToWorld(originTx, originTy);
    }

    // Spiral outward
    for (let radius = 1; radius < Math.max(this.gridWidth, this.gridHeight); radius++) {
      let bestDist = Infinity;
      let bestTile: { x: number; y: number } | null = null;

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const tx = originTx + dx;
          const ty = originTy + dy;
          if (tx < 0 || tx >= this.gridWidth || ty < 0 || ty >= this.gridHeight) continue;
          if (this.validTiles.has(ty * this.gridWidth + tx)) {
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
              bestDist = dist;
              bestTile = { x: tx, y: ty };
            }
          }
        }
      }

      if (bestTile) {
        return this.tileToWorld(bestTile.x, bestTile.y);
      }
    }

    return null;
  }

  getCenter(): { x: number; y: number } {
    if (this.validTiles.size === 0) return { x: 0, y: 0 };
    let sumX = 0, sumY = 0, count = 0;
    for (const key of this.validTiles) {
      sumX += key % this.gridWidth;
      sumY += Math.floor(key / this.gridWidth);
      count++;
    }
    return this.tileToWorld(Math.round(sumX / count), Math.round(sumY / count));
  }

  /** Center X of zone, Y biased toward rear (away from map center). */
  getCenterRear(): { x: number; y: number } {
    if (this.validTiles.size === 0) return { x: 0, y: 0 };
    let sumX = 0, sumY = 0, count = 0;
    let minTileY = Infinity, maxTileY = -Infinity;
    for (const key of this.validTiles) {
      const tx = key % this.gridWidth;
      const ty = Math.floor(key / this.gridWidth);
      sumX += tx;
      sumY += ty;
      if (ty < minTileY) minTileY = ty;
      if (ty > maxTileY) maxTileY = ty;
      count++;
    }
    const centerX = Math.round(sumX / count);
    const centerY = Math.round(sumY / count);
    // Bias toward rear: for team 0 (left side), rear = lower X, but in vertical axis
    // use center Y biased toward map edge
    const rearY = centerY + Math.round((maxTileY - minTileY) * 0.25);
    const clampedY = Math.min(rearY, maxTileY);
    return this.tileToWorld(centerX, clampedY);
  }

  private tileToWorld(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  }

  private getCandidateTiles(grid: TerrainGrid, templateId: string, team: number): Set<number> {
    const w = grid.width;
    const h = grid.height;
    const candidates = new Set<number>();
    const fraction = DEPLOYMENT_ZONE_FRACTION;

    // Generate for team 0 (left side), then mirror for team 1
    const effectiveTeam = team;

    switch (templateId) {
      case 'open_plains':
      default: {
        // Strip from x=0 to x=width*0.25 (or mirrored for team 1)
        const xBound = Math.floor(w * fraction);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < xBound; x++) {
            const tx = effectiveTeam === 0 ? x : (w - 1 - x);
            candidates.add(y * w + tx);
          }
        }
        break;
      }

      case 'mountain_pass': {
        // Narrow zone at pass entrance — x < width*0.25, middle 40% of y range
        const xBound = Math.floor(w * fraction);
        const yMin = Math.floor(h * 0.3);
        const yMax = Math.floor(h * 0.7);
        for (let y = yMin; y < yMax; y++) {
          for (let x = 0; x < xBound; x++) {
            const tx = effectiveTeam === 0 ? x : (w - 1 - x);
            candidates.add(y * w + tx);
          }
        }
        break;
      }

      case 'river_valley': {
        // Find the densest river band to determine the "main" river column.
        // Procedural rivers scatter tiles across the map, so counting tiles
        // per column and finding the peak gives us the main crossing.
        const riverDensity = new Int32Array(w);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const t = grid.getTerrain(x, y);
            if (t === TerrainType.RIVER) riverDensity[x]++;
          }
        }

        // Find the column with the most river tiles in the center 50% of the map
        let peakCol = Math.floor(w / 2);
        let peakCount = 0;
        const searchMin = Math.floor(w * 0.2);
        const searchMax = Math.floor(w * 0.8);
        for (let x = searchMin; x < searchMax; x++) {
          if (riverDensity[x] > peakCount) {
            peakCount = riverDensity[x];
            peakCol = x;
          }
        }

        // Use the river peak or standard fraction, whichever gives a reasonable zone
        const riverBound = effectiveTeam === 0 ? peakCol : w - peakCol;
        const standardBound = Math.floor(w * fraction);
        const xBound = peakCount > 5 ? Math.max(riverBound, standardBound) : standardBound;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < xBound; x++) {
            const tx = effectiveTeam === 0 ? x : (w - 1 - x);
            candidates.add(y * w + tx);
          }
        }
        break;
      }

      case 'siege': {
        // Outer ring — tiles at distance > 35% from map center, within left half (or right for team 1)
        const cx = w / 2;
        const cy = h / 2;
        const maxDist = Math.hypot(cx, cy);
        const threshold = maxDist * 0.35;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const dist = Math.hypot(x - cx, y - cy);
            const inLeftHalf = effectiveTeam === 0 ? x < cx : x >= cx;
            if (dist > threshold && inLeftHalf) {
              candidates.add(y * w + x);
            }
          }
        }
        break;
      }

      case 'wetlands': {
        // Non-water/marsh tiles in left 25% of map (or right for team 1)
        const xBound = Math.floor(w * fraction);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < xBound; x++) {
            const tx = effectiveTeam === 0 ? x : (w - 1 - x);
            const terrain = grid.getTerrain(tx, y);
            // Extra filter: skip marsh in addition to normal blocked
            if (terrain !== TerrainType.MARSH) {
              candidates.add(y * w + tx);
            }
          }
        }
        break;
      }
    }

    return candidates;
  }
}
