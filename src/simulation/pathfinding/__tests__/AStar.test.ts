import { describe, it, expect } from 'vitest';
import { findPath } from '../AStar';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { TerrainType, UnitType, TILE_SIZE } from '../../../constants';

/** Create a simple terrain grid filled with a given terrain, with optional overrides. */
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

describe('AStar findPath', () => {
  it('finds straight-line path on open plains', () => {
    const grid = makeGrid(10, 10);
    const result = findPath(grid, 0, 5, 9, 5, UnitType.JI_HALBERDIERS);
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
    // Last waypoint should be near goal tile center
    const last = result.path[result.path.length - 1];
    expect(last.x).toBe(9 * TILE_SIZE + TILE_SIZE / 2);
    expect(last.y).toBe(5 * TILE_SIZE + TILE_SIZE / 2);
  });

  it('paths around a water obstacle', () => {
    // Water wall at x=5, y=3..7
    const overrides = [3, 4, 5, 6, 7].map(y => ({ x: 5, y, t: TerrainType.WATER }));
    const grid = makeGrid(10, 10, TerrainType.PLAINS, overrides);
    const result = findPath(grid, 2, 5, 8, 5, UnitType.JI_HALBERDIERS);
    expect(result.found).toBe(true);
    // Path should not go through x=5 at y=3..7
    for (const wp of result.path) {
      const tileX = Math.floor(wp.x / TILE_SIZE);
      const tileY = Math.floor(wp.y / TILE_SIZE);
      if (tileX === 5 && tileY >= 3 && tileY <= 7) {
        throw new Error('Path goes through water obstacle');
      }
    }
  });

  it('cavalry cannot path through mountains (impassable)', () => {
    // Mountain wall at x=5, y=0..9 (entire column)
    const overrides = Array.from({ length: 10 }, (_, y) => ({ x: 5, y, t: TerrainType.MOUNTAINS }));
    const grid = makeGrid(10, 10, TerrainType.PLAINS, overrides);
    const result = findPath(grid, 2, 5, 8, 5, UnitType.LIGHT_CAVALRY);
    expect(result.found).toBe(false);
  });

  it('Dao Swordsmen path through forest (no penalty) vs default higher cost', () => {
    // Fill middle with forest
    const overrides: Array<{ x: number; y: number; t: TerrainType }> = [];
    for (let x = 3; x <= 7; x++) {
      for (let y = 0; y < 10; y++) {
        overrides.push({ x, y, t: TerrainType.FOREST });
      }
    }
    const grid = makeGrid(10, 10, TerrainType.PLAINS, overrides);

    const daoResult = findPath(grid, 1, 5, 9, 5, UnitType.DAO_SWORDSMEN);
    const halberdResult = findPath(grid, 1, 5, 9, 5, UnitType.JI_HALBERDIERS);

    expect(daoResult.found).toBe(true);
    expect(halberdResult.found).toBe(true);
    // Dao should explore fewer nodes since forest is cost 1.0 for them
    expect(daoResult.nodesExplored).toBeLessThanOrEqual(halberdResult.nodesExplored);
  });

  it('returns found=false when target is surrounded by water', () => {
    const overrides = [
      { x: 4, y: 4, t: TerrainType.WATER }, { x: 5, y: 4, t: TerrainType.WATER }, { x: 6, y: 4, t: TerrainType.WATER },
      { x: 4, y: 5, t: TerrainType.WATER },                                        { x: 6, y: 5, t: TerrainType.WATER },
      { x: 4, y: 6, t: TerrainType.WATER }, { x: 5, y: 6, t: TerrainType.WATER }, { x: 6, y: 6, t: TerrainType.WATER },
    ];
    const grid = makeGrid(10, 10, TerrainType.PLAINS, overrides);
    const result = findPath(grid, 0, 0, 5, 5, UnitType.JI_HALBERDIERS);
    expect(result.found).toBe(false);
  });

  it('start == goal returns empty path with found=true', () => {
    const grid = makeGrid(10, 10);
    const result = findPath(grid, 5, 5, 5, 5, UnitType.JI_HALBERDIERS);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([]);
    expect(result.nodesExplored).toBe(0);
  });

  it('prevents diagonal corner-cutting', () => {
    // Water at (5,4) and (4,5) — should block diagonal from (4,4) to (5,5)
    const overrides = [
      { x: 5, y: 4, t: TerrainType.WATER },
      { x: 4, y: 5, t: TerrainType.WATER },
    ];
    const grid = makeGrid(10, 10, TerrainType.PLAINS, overrides);
    const result = findPath(grid, 4, 4, 5, 5, UnitType.JI_HALBERDIERS);
    expect(result.found).toBe(true);
    // Path must go around, so length > 1 (can't do it in a single diagonal step)
    expect(result.path.length).toBeGreaterThan(1);
  });

  it('prefers roads (lower cost)', () => {
    // Road strip at y=5 from x=1..8
    const overrides = Array.from({ length: 8 }, (_, i) => ({ x: i + 1, y: 5, t: TerrainType.ROAD }));
    const grid = makeGrid(10, 10, TerrainType.HILLS, overrides); // hills everywhere else (cost 2.0)
    const result = findPath(grid, 0, 5, 9, 5, UnitType.JI_HALBERDIERS);
    expect(result.found).toBe(true);
    // Path should mostly follow road at y=5
    const roadWaypoints = result.path.filter(wp => {
      const ty = Math.floor(wp.y / TILE_SIZE);
      return ty === 5;
    });
    expect(roadWaypoints.length).toBeGreaterThanOrEqual(5);
  });

  it('maxNodes cap terminates search gracefully', () => {
    const grid = makeGrid(50, 50);
    const result = findPath(grid, 0, 0, 49, 49, UnitType.JI_HALBERDIERS, 10);
    // With only 10 nodes, it shouldn't reach the far corner
    expect(result.found).toBe(false);
    expect(result.nodesExplored).toBeLessThanOrEqual(10);
  });

  it('output waypoints are in world pixels', () => {
    const grid = makeGrid(10, 10);
    const result = findPath(grid, 0, 0, 3, 0, UnitType.JI_HALBERDIERS);
    expect(result.found).toBe(true);
    for (const wp of result.path) {
      // Should be tile center: tileX * 16 + 8
      expect(wp.x % TILE_SIZE).toBe(TILE_SIZE / 2);
      expect(wp.y % TILE_SIZE).toBe(TILE_SIZE / 2);
    }
  });
});
