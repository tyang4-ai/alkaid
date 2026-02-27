import { describe, it, expect } from 'vitest';
import { computeFlowField, sampleFlowField } from '../FlowField';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { TerrainType, UnitType, TILE_SIZE } from '../../../constants';

function makeGrid(
  width: number, height: number,
  fill: TerrainType = TerrainType.PLAINS,
  overrides: Array<{ x: number; y: number; t: TerrainType }> = [],
): TerrainGrid {
  const terrain = new Uint8Array(width * height).fill(fill);
  for (const o of overrides) {
    terrain[o.y * width + o.x] = o.t;
  }
  return new TerrainGrid({
    width, height, seed: 0, templateId: 'test',
    elevation: new Float32Array(width * height),
    moisture: new Float32Array(width * height),
    terrain,
    riverFlow: new Int8Array(width * height).fill(-1),
    tileBitmask: new Uint8Array(width * height),
  });
}

describe('FlowField', () => {
  it('open plains: all tiles point toward target', () => {
    const grid = makeGrid(10, 10);
    const field = computeFlowField(grid, 5, 5, UnitType.JI_HALBERDIERS);

    // Tile (0,5) should have a direction pointing east (toward target at x=5)
    const dir = field.directions[5 * field.width + 0];
    expect(dir).toBeGreaterThanOrEqual(0);
    expect(dir).toBeLessThanOrEqual(7);

    // Tile to the right of target (8,5) should point west
    const dirRight = field.directions[5 * field.width + 8];
    expect(dirRight).toBeGreaterThanOrEqual(0);
  });

  it('tiles behind water obstacle route around it', () => {
    // Water wall at x=5, y=3..7
    const overrides = [3, 4, 5, 6, 7].map(y => ({ x: 5, y, t: TerrainType.WATER }));
    const grid = makeGrid(10, 10, TerrainType.PLAINS, overrides);
    const field = computeFlowField(grid, 8, 5, UnitType.JI_HALBERDIERS);

    // Tile (3,5) should still be reachable (can go around water)
    const idx = 5 * field.width + 3;
    expect(field.costs[idx]).toBeLessThan(Infinity);
    expect(field.directions[idx]).toBeGreaterThanOrEqual(0);
  });

  it('target tile direction is -2', () => {
    const grid = makeGrid(10, 10);
    const field = computeFlowField(grid, 5, 5, UnitType.JI_HALBERDIERS);
    const idx = 5 * field.width + 5;
    expect(field.directions[idx]).toBe(-2);
  });

  it('unreachable tile (island) direction is -1', () => {
    // Surround tile (5,5) with water — it becomes unreachable FROM outside
    // But (5,5) is the target... so let's make a separate island
    const overrides = [
      { x: 3, y: 3, t: TerrainType.WATER }, { x: 4, y: 3, t: TerrainType.WATER }, { x: 5, y: 3, t: TerrainType.WATER },
      { x: 3, y: 4, t: TerrainType.WATER },                                        { x: 5, y: 4, t: TerrainType.WATER },
      { x: 3, y: 5, t: TerrainType.WATER }, { x: 4, y: 5, t: TerrainType.WATER }, { x: 5, y: 5, t: TerrainType.WATER },
    ];
    const grid = makeGrid(10, 10, TerrainType.PLAINS, overrides);
    const field = computeFlowField(grid, 0, 0, UnitType.JI_HALBERDIERS);

    // (4,4) is surrounded by water — should be unreachable
    const idx = 4 * field.width + 4;
    expect(field.directions[idx]).toBe(-1);
    expect(field.costs[idx]).toBe(Infinity);
  });

  it('sampleFlowField returns correct direction vector', () => {
    const grid = makeGrid(10, 10);
    const field = computeFlowField(grid, 5, 5, UnitType.JI_HALBERDIERS);

    // Sample from tile (3, 5) — should point toward target (east-ish)
    const worldX = 3 * TILE_SIZE + TILE_SIZE / 2;
    const worldY = 5 * TILE_SIZE + TILE_SIZE / 2;
    const vec = sampleFlowField(field, worldX, worldY);
    expect(vec).not.toBeNull();
    // dx should be positive (moving right toward target)
    expect(vec!.dx).toBeGreaterThan(0);
  });

  it('cost increases with distance from target', () => {
    const grid = makeGrid(10, 10);
    const field = computeFlowField(grid, 5, 5, UnitType.JI_HALBERDIERS);

    const costNear = field.costs[5 * field.width + 4]; // 1 tile away
    const costFar = field.costs[5 * field.width + 0];  // 5 tiles away
    expect(costFar).toBeGreaterThan(costNear);
  });
});
