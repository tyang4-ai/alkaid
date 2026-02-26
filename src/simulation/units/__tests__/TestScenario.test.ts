import { describe, it, expect, beforeEach } from 'vitest';
import { UnitManager } from '../UnitManager';
import { spawnTestArmies } from '../TestScenario';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { TerrainType, TILE_SIZE } from '../../../constants';

/** Create a flat plains grid for testing. */
function makeFlatGrid(width = 200, height = 150): TerrainGrid {
  const size = width * height;
  const terrain = new Uint8Array(size).fill(TerrainType.PLAINS);
  return new TerrainGrid({
    width,
    height,
    seed: 42,
    templateId: 'test',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain,
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size).fill(0),
  });
}

describe('spawnTestArmies', () => {
  let mgr: UnitManager;
  let grid: TerrainGrid;

  beforeEach(() => {
    mgr = new UnitManager();
    grid = makeFlatGrid();
  });

  it('spawns 10 units total (5 per team)', () => {
    spawnTestArmies(mgr, grid);
    expect(mgr.count).toBe(10);
    expect(mgr.getByTeam(0)).toHaveLength(5);
    expect(mgr.getByTeam(1)).toHaveLength(5);
  });

  it('places player army on left side and enemy on right', () => {
    spawnTestArmies(mgr, grid);
    const mapMidX = (grid.width * TILE_SIZE) / 2;

    for (const unit of mgr.getByTeam(0)) {
      expect(unit.x).toBeLessThan(mapMidX);
    }
    for (const unit of mgr.getByTeam(1)) {
      expect(unit.x).toBeGreaterThan(mapMidX);
    }
  });

  it('all units are on valid terrain (not water/mountain/river)', () => {
    spawnTestArmies(mgr, grid);
    const blocked = new Set<TerrainType>([TerrainType.WATER, TerrainType.MOUNTAINS, TerrainType.RIVER]);

    for (const unit of mgr.getByTeam(0).concat(mgr.getByTeam(1))) {
      const tx = Math.floor(unit.x / TILE_SIZE);
      const ty = Math.floor(unit.y / TILE_SIZE);
      expect(blocked.has(grid.getTerrain(tx, ty))).toBe(false);
    }
  });
});
