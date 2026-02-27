import { describe, it, expect } from 'vitest';
import { DeploymentZone } from '../DeploymentZone';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { TerrainType, TILE_SIZE } from '../../../constants';

function makeFlatGrid(width = 200, height = 150, fill: TerrainType = TerrainType.PLAINS): TerrainGrid {
  const size = width * height;
  return new TerrainGrid({
    width, height, seed: 42, templateId: 'open_plains',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain: new Uint8Array(size).fill(fill),
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size).fill(0),
  });
}

function makeGridWithTerrain(width: number, height: number, templateId: string, terrainFn: (x: number, y: number) => TerrainType): TerrainGrid {
  const size = width * height;
  const terrain = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      terrain[y * width + x] = terrainFn(x, y);
    }
  }
  return new TerrainGrid({
    width, height, seed: 42, templateId,
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain,
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size).fill(0),
  });
}

describe('DeploymentZone', () => {
  it('open_plains team 0 has tiles in left 25% of map', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    expect(zone.validTiles.size).toBeGreaterThan(0);
    const maxX = Math.floor(grid.width * 0.25);

    for (const key of zone.validTiles) {
      const tx = key % grid.width;
      expect(tx).toBeLessThan(maxX);
    }
  });

  it('open_plains team 0 has no tiles in right 75%', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    const minRightX = Math.floor(grid.width * 0.25);
    for (const key of zone.validTiles) {
      const tx = key % grid.width;
      expect(tx).toBeLessThan(minRightX);
    }
  });

  it('team 1 mirrors to right side', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 1);

    expect(zone.validTiles.size).toBeGreaterThan(0);
    const minRightX = grid.width - Math.floor(grid.width * 0.25);

    for (const key of zone.validTiles) {
      const tx = key % grid.width;
      expect(tx).toBeGreaterThanOrEqual(minRightX);
    }
  });

  it('isInZone returns true for points inside zone', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    // Point at tile (5, 5) should be in zone
    const worldX = 5 * TILE_SIZE + TILE_SIZE / 2;
    const worldY = 5 * TILE_SIZE + TILE_SIZE / 2;
    expect(zone.isInZone(worldX, worldY)).toBe(true);
  });

  it('isInZone returns false for points outside zone', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    // Point at tile (150, 75) should be outside zone (right side)
    const worldX = 150 * TILE_SIZE + TILE_SIZE / 2;
    const worldY = 75 * TILE_SIZE + TILE_SIZE / 2;
    expect(zone.isInZone(worldX, worldY)).toBe(false);
  });

  it('isValidPlacement rejects WATER tiles even if in zone bounds', () => {
    // Put water in the left 25%
    const grid = makeGridWithTerrain(200, 150, 'open_plains', (x, _y) => {
      return x < 10 ? TerrainType.WATER : TerrainType.PLAINS;
    });
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    // Tile (5, 75) is water — should not be valid
    expect(zone.isValidPlacement(5, 75)).toBe(false);
    // Tile (15, 75) is plains in zone — should be valid
    expect(zone.isValidPlacement(15, 75)).toBe(true);
  });

  it('isValidPlacement rejects MOUNTAINS and RIVER tiles', () => {
    const grid = makeGridWithTerrain(200, 150, 'open_plains', (x, y) => {
      if (x === 10 && y === 50) return TerrainType.MOUNTAINS;
      if (x === 10 && y === 51) return TerrainType.RIVER;
      return TerrainType.PLAINS;
    });
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    expect(zone.isValidPlacement(10, 50)).toBe(false);
    expect(zone.isValidPlacement(10, 51)).toBe(false);
  });

  it('findNearestValid returns closest walkable in-zone tile', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    // Point in zone should return the tile itself
    const result = zone.findNearestValid(5 * TILE_SIZE, 5 * TILE_SIZE);
    expect(result).not.toBeNull();
    expect(result!.x).toBeGreaterThan(0);
  });

  it('findNearestValid returns null for all-water zone', () => {
    const grid = makeFlatGrid(200, 150, TerrainType.WATER);
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    expect(zone.validTiles.size).toBe(0);
    expect(zone.findNearestValid(100, 100)).toBeNull();
  });

  it('getCenter returns approximate center of zone', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    const center = zone.getCenter();
    const maxX = Math.floor(grid.width * 0.25) * TILE_SIZE;
    expect(center.x).toBeGreaterThan(0);
    expect(center.x).toBeLessThan(maxX + TILE_SIZE);
  });

  it('getCenterRear returns position biased toward rear', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    const center = zone.getCenter();
    const rear = zone.getCenterRear();
    // Rear should have a Y at or beyond center Y
    expect(rear.y).toBeGreaterThanOrEqual(center.y);
  });
});
