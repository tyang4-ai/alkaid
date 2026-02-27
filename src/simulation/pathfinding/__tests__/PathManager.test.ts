import { describe, it, expect, beforeEach } from 'vitest';
import { PathManager } from '../PathManager';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { TerrainType, UnitType, UnitState, TILE_SIZE } from '../../../constants';
import type { Unit } from '../../units/Unit';

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

function makeUnit(id: number, type: UnitType, x: number, y: number): Unit {
  return {
    id, type, team: 0,
    x, y, prevX: x, prevY: y,
    size: 10, maxSize: 100, hp: 1000,
    morale: 70, fatigue: 0, supply: 100, experience: 0,
    state: UnitState.IDLE, facing: 0,
    path: null, pathIndex: 0, targetX: x, targetY: y,
  };
}

describe('PathManager', () => {
  let grid: TerrainGrid;
  let pm: PathManager;

  beforeEach(() => {
    grid = makeGrid(20, 20);
    pm = new PathManager(grid);
  });

  it('requestPath queues a request', () => {
    const unit = makeUnit(1, UnitType.JI_HALBERDIERS, 16, 16);
    pm.requestPath(unit, 200, 200);
    expect(pm.pendingRequests).toBe(1);
  });

  it('tick processes requests and assigns paths to units', () => {
    const unit = makeUnit(1, UnitType.JI_HALBERDIERS,
      1 * TILE_SIZE + 8, 5 * TILE_SIZE + 8);
    pm.requestPath(unit, 10 * TILE_SIZE + 8, 5 * TILE_SIZE + 8);
    pm.tick(0);
    expect(unit.path).not.toBeNull();
    expect(unit.path!.length).toBeGreaterThan(0);
    expect(pm.pendingRequests).toBe(0);
  });

  it('budget limits per tick (6 requests → 5 processed, 1 queued)', () => {
    const units: Unit[] = [];
    for (let i = 0; i < 6; i++) {
      // Spread targets so they don't group into flow field
      const unit = makeUnit(i + 1, UnitType.JI_HALBERDIERS,
        1 * TILE_SIZE + 8, (i + 1) * TILE_SIZE + 8);
      units.push(unit);
      pm.requestPath(unit, (15 + i) * TILE_SIZE + 8, (i + 1) * TILE_SIZE + 8);
    }
    pm.tick(0);
    // 5 should be processed, 1 queued
    expect(pm.pendingRequests).toBe(1);
  });

  it('flow field used when 6+ units target same area', () => {
    const units: Unit[] = [];
    for (let i = 0; i < 7; i++) {
      const unit = makeUnit(i + 1, UnitType.JI_HALBERDIERS,
        1 * TILE_SIZE + 8, (i + 2) * TILE_SIZE + 8);
      units.push(unit);
      // All target same area
      pm.requestPath(unit, 10 * TILE_SIZE + 8, 10 * TILE_SIZE + 8);
    }
    pm.tick(0);
    // All should be processed (flow field counts as 3 but handles all)
    expect(pm.pendingRequests).toBe(0);
    // Units should not have individual paths (flow field used instead)
    for (const u of units) {
      expect(u.path).toBeNull();
    }
    // getMovementVector should work via flow field
    const vec = pm.getMovementVector(units[0]);
    expect(vec).not.toBeNull();
  });

  it('getMovementVector returns direction toward next waypoint', () => {
    const unit = makeUnit(1, UnitType.JI_HALBERDIERS,
      1 * TILE_SIZE + 8, 5 * TILE_SIZE + 8);
    pm.requestPath(unit, 10 * TILE_SIZE + 8, 5 * TILE_SIZE + 8);
    pm.tick(0);

    const vec = pm.getMovementVector(unit);
    expect(vec).not.toBeNull();
    // Should move rightward (positive dx)
    expect(vec!.dx).toBeGreaterThan(0);
  });

  it('getMovementVector returns null when no path', () => {
    const unit = makeUnit(1, UnitType.JI_HALBERDIERS, 16, 16);
    // No path requested
    const vec = pm.getMovementVector(unit);
    expect(vec).toBeNull();
  });

  it('cache eviction removes old flow fields', () => {
    const units: Unit[] = [];
    for (let i = 0; i < 7; i++) {
      const unit = makeUnit(i + 1, UnitType.JI_HALBERDIERS,
        1 * TILE_SIZE + 8, (i + 2) * TILE_SIZE + 8);
      units.push(unit);
      pm.requestPath(unit, 10 * TILE_SIZE + 8, 10 * TILE_SIZE + 8);
    }
    pm.tick(0); // creates flow field at tick 0

    // Tick far in the future to trigger eviction
    pm.tick(100);
    // Flow field should be evicted (TTL is 40 ticks)
    // New request should need new computation
    const newUnit = makeUnit(100, UnitType.JI_HALBERDIERS, 16, 16);
    pm.requestPath(newUnit, 10 * TILE_SIZE + 8, 10 * TILE_SIZE + 8);
    pm.tick(101);
    // Should still work
    expect(pm.pendingRequests).toBe(0);
  });

  it('clear() resets all state', () => {
    const unit = makeUnit(1, UnitType.JI_HALBERDIERS, 16, 16);
    pm.requestPath(unit, 200, 200);
    pm.clear();
    expect(pm.pendingRequests).toBe(0);
  });
});
