import { describe, it, expect } from 'vitest';
import { PathManager } from '../PathManager';
import { OrderManager } from '../../OrderManager';
import { UnitManager } from '../../units/UnitManager';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import {
  TerrainType, UnitType, UnitState, OrderType,
  TILE_SIZE, PATH_ARRIVAL_THRESHOLD,
} from '../../../constants';

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

describe('Pathfinding Integration', () => {
  it('unit with MOVE order moves toward target over multiple ticks', () => {
    const grid = makeGrid(20, 20);
    const pm = new PathManager(grid);
    const om = new OrderManager();
    const um = new UnitManager();

    const startX = 2 * TILE_SIZE + 8;
    const startY = 10 * TILE_SIZE + 8;
    const targetX = 15 * TILE_SIZE + 8;
    const targetY = 10 * TILE_SIZE + 8;

    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: startX, y: startY });
    om.setOrder(unit.id, { type: OrderType.MOVE, unitId: unit.id, targetX, targetY });
    pm.requestPath(unit, targetX, targetY);
    unit.targetX = targetX;
    unit.targetY = targetY;

    // Run several sim ticks
    for (let tick = 0; tick < 100; tick++) {
      pm.updateSpatialHash(um.getAll());
      pm.tick(tick);
      um.tick(0.05, pm, om);
    }

    // Unit should have moved significantly toward target
    expect(unit.x).toBeGreaterThan(startX + 50);
    expect(unit.state === UnitState.MOVING || unit.state === UnitState.IDLE).toBe(true);
  });

  it('unit stops at arrival threshold', () => {
    const grid = makeGrid(20, 20);
    const pm = new PathManager(grid);
    const om = new OrderManager();
    const um = new UnitManager();

    // Short distance — just 3 tiles
    const startX = 5 * TILE_SIZE + 8;
    const startY = 10 * TILE_SIZE + 8;
    const targetX = 8 * TILE_SIZE + 8;
    const targetY = 10 * TILE_SIZE + 8;

    const unit = um.spawn({ type: UnitType.LIGHT_CAVALRY, team: 0, x: startX, y: startY });
    om.setOrder(unit.id, { type: OrderType.MOVE, unitId: unit.id, targetX, targetY });
    pm.requestPath(unit, targetX, targetY);
    unit.targetX = targetX;
    unit.targetY = targetY;

    // Run enough ticks to reach target (cavalry speed = 2.5 tiles/sec, 3 tiles = ~1.2 sec = 24 ticks)
    for (let tick = 0; tick < 60; tick++) {
      pm.updateSpatialHash(um.getAll());
      pm.tick(tick);
      um.tick(0.05, pm, om);
    }

    // Should be at target and IDLE
    const dx = unit.x - targetX;
    const dy = unit.y - targetY;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThan(PATH_ARRIVAL_THRESHOLD + 5);
    expect(unit.state).toBe(UnitState.IDLE);
    expect(om.getOrder(unit.id)).toBeUndefined();
  });

  it('unit pathfinds around water obstacle (multi-tick)', () => {
    // Water wall at x=10, y=5..15
    const overrides = Array.from({ length: 11 }, (_, i) => ({
      x: 10, y: i + 5, t: TerrainType.WATER,
    }));
    const grid = makeGrid(20, 20, TerrainType.PLAINS, overrides);
    const pm = new PathManager(grid);
    const om = new OrderManager();
    const um = new UnitManager();

    const startX = 5 * TILE_SIZE + 8;
    const startY = 10 * TILE_SIZE + 8;
    const targetX = 15 * TILE_SIZE + 8;
    const targetY = 10 * TILE_SIZE + 8;

    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: startX, y: startY });
    om.setOrder(unit.id, { type: OrderType.MOVE, unitId: unit.id, targetX, targetY });
    pm.requestPath(unit, targetX, targetY);
    unit.targetX = targetX;
    unit.targetY = targetY;

    for (let tick = 0; tick < 200; tick++) {
      pm.updateSpatialHash(um.getAll());
      pm.tick(tick);
      um.tick(0.05, pm, om);
    }

    // Should have moved past the water obstacle
    expect(unit.x).toBeGreaterThan(10 * TILE_SIZE);
  });

  it('multiple units to same target uses flow field', () => {
    const grid = makeGrid(20, 20);
    const pm = new PathManager(grid);
    const om = new OrderManager();
    const um = new UnitManager();

    const targetX = 15 * TILE_SIZE + 8;
    const targetY = 10 * TILE_SIZE + 8;

    const units = [];
    for (let i = 0; i < 7; i++) {
      const unit = um.spawn({
        type: UnitType.JI_HALBERDIERS, team: 0,
        x: 2 * TILE_SIZE + 8, y: (5 + i) * TILE_SIZE + 8,
      });
      om.setOrder(unit.id, { type: OrderType.MOVE, unitId: unit.id, targetX, targetY });
      pm.requestPath(unit, targetX, targetY);
      unit.targetX = targetX;
      unit.targetY = targetY;
      units.push(unit);
    }

    // One tick should process all via flow field
    pm.updateSpatialHash(um.getAll());
    pm.tick(0);

    // All units should have no individual path (using flow field)
    for (const u of units) {
      expect(u.path).toBeNull();
    }

    // But getMovementVector should return direction
    for (const u of units) {
      const vec = pm.getMovementVector(u);
      expect(vec).not.toBeNull();
    }
  });
});
