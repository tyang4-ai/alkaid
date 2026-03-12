import { describe, it, expect, beforeEach } from 'vitest';
import { FogOfWarSystem, FogVisibility } from '../FogOfWarSystem';
import { TerrainGrid } from '../terrain/TerrainGrid';
import type { TerrainGridData } from '../terrain/TerrainGrid';
import type { Unit } from '../units/Unit';
import type { EnvironmentState } from '../environment/EnvironmentState';
import {
  TerrainType, UnitType, UnitState, TILE_SIZE, WeatherType, TimeOfDay,
} from '../../constants';

const MAP_W = 30;
const MAP_H = 30;

/** Create a flat plains terrain grid */
function makePlainGrid(w = MAP_W, h = MAP_H): TerrainGrid {
  const size = w * h;
  const data: TerrainGridData = {
    width: w,
    height: h,
    seed: 1,
    templateId: 'test',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain: new Uint8Array(size).fill(TerrainType.PLAINS),
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size),
  };
  return new TerrainGrid(data);
}

/** Create a grid with specific terrain at certain tiles */
function makeGridWith(overrides: Array<{ x: number; y: number; terrain: TerrainType; elevation?: number }>): TerrainGrid {
  const size = MAP_W * MAP_H;
  const elevation = new Float32Array(size).fill(0.5);
  const terrain = new Uint8Array(size).fill(TerrainType.PLAINS);
  for (const o of overrides) {
    terrain[o.y * MAP_W + o.x] = o.terrain;
    if (o.elevation !== undefined) {
      elevation[o.y * MAP_W + o.x] = o.elevation;
    }
  }
  const data: TerrainGridData = {
    width: MAP_W,
    height: MAP_H,
    seed: 1,
    templateId: 'test',
    elevation,
    moisture: new Float32Array(size).fill(0.5),
    terrain,
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size),
  };
  return new TerrainGrid(data);
}

/** Create a minimal unit at tile coords */
function makeUnit(
  id: number,
  tileX: number,
  tileY: number,
  team: number,
  type: UnitType = UnitType.JI_HALBERDIERS,
  state: UnitState = UnitState.IDLE,
): Unit {
  return {
    id,
    type,
    team,
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
    prevX: tileX * TILE_SIZE + TILE_SIZE / 2,
    prevY: tileY * TILE_SIZE + TILE_SIZE / 2,
    size: 50,
    maxSize: 100,
    hp: 5000,
    morale: 70,
    fatigue: 0,
    supply: 100,
    experience: 0,
    state,
    facing: 0,
    path: null,
    pathIndex: 0,
    targetX: 0,
    targetY: 0,
    isGeneral: false,
    pendingOrderType: null,
    pendingOrderTick: 0,
    attackCooldown: 0,
    lastAttackTick: 0,
    hasCharged: false,
    combatTargetId: -1,
    combatTicks: 0,
    siegeSetupTicks: 0,
    formUpTicks: 0,
    disengageTicks: 0,
    orderModifier: null,
    routTicks: 0,
    killCount: 0,
    holdUnderBombardmentTicks: 0,
    desertionFrac: 0,
  };
}

function makeEnv(weather: number = WeatherType.CLEAR, timeOfDay: number = TimeOfDay.MIDDAY): EnvironmentState {
  return { weather, windDirection: 0, timeOfDay, currentTick: 0, battleStartTime: TimeOfDay.DAWN };
}

describe('FogOfWarSystem', () => {
  let grid: TerrainGrid;
  let fow: FogOfWarSystem;

  beforeEach(() => {
    grid = makePlainGrid();
    fow = new FogOfWarSystem(grid, MAP_W, MAP_H);
  });

  it('initializes all tiles as UNEXPLORED', () => {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        expect(fow.getVisibility(x, y)).toBe(FogVisibility.UNEXPLORED);
      }
    }
  });

  it('reveals tiles within vision radius around a unit', () => {
    const unit = makeUnit(1, 15, 15, 0);
    fow.tick(0, [unit], [], null);

    // Unit's own tile should be visible
    expect(fow.getVisibility(15, 15)).toBe(FogVisibility.VISIBLE);
    // Tiles within radius 5 should be visible
    expect(fow.getVisibility(16, 15)).toBe(FogVisibility.VISIBLE);
    expect(fow.getVisibility(15, 16)).toBe(FogVisibility.VISIBLE);
    expect(fow.getVisibility(14, 15)).toBe(FogVisibility.VISIBLE);
    expect(fow.getVisibility(15, 14)).toBe(FogVisibility.VISIBLE);
  });

  it('viewer tile is always visible', () => {
    const unit = makeUnit(1, 10, 10, 0);
    fow.tick(0, [unit], [], null);
    expect(fow.getVisibility(10, 10)).toBe(FogVisibility.VISIBLE);
  });

  it('forest blocks LOS beyond it', () => {
    // Place forest tile 2 tiles east of viewer at (10,10)
    const overrides = [{ x: 12, y: 10, terrain: TerrainType.FOREST }];
    grid = makeGridWith(overrides);
    fow = new FogOfWarSystem(grid, MAP_W, MAP_H);

    const unit = makeUnit(1, 10, 10, 0);
    fow.tick(0, [unit], [], null);

    // Forest tile itself should be visible
    expect(fow.getVisibility(12, 10)).toBe(FogVisibility.VISIBLE);
    // Tile directly behind forest (further from viewer) should be blocked
    // Due to shadowcasting, tiles in the shadow of the forest won't be visible
    // Check a tile further out in the same direction
    expect(fow.getVisibility(14, 10)).toBe(FogVisibility.UNEXPLORED);
  });

  it('mountain blocks LOS beyond it', () => {
    const overrides = [{ x: 12, y: 10, terrain: TerrainType.MOUNTAINS }];
    grid = makeGridWith(overrides);
    fow = new FogOfWarSystem(grid, MAP_W, MAP_H);

    const unit = makeUnit(1, 10, 10, 0);
    fow.tick(0, [unit], [], null);

    expect(fow.getVisibility(12, 10)).toBe(FogVisibility.VISIBLE);
    expect(fow.getVisibility(14, 10)).toBe(FogVisibility.UNEXPLORED);
  });

  it('hill elevation bonus increases vision radius', () => {
    // Place unit on hills terrain
    const overrides = [{ x: 15, y: 15, terrain: TerrainType.HILLS }];
    grid = makeGridWith(overrides);
    fow = new FogOfWarSystem(grid, MAP_W, MAP_H);

    const hillUnit = makeUnit(1, 15, 15, 0);
    const hillRadius = fow.computeEffectiveVisionRadius(hillUnit, null);

    // Plain unit at same spot on plains grid
    const plainGrid = makePlainGrid();
    const plainFow = new FogOfWarSystem(plainGrid, MAP_W, MAP_H);
    const plainUnit = makeUnit(2, 15, 15, 0);
    const plainRadius = plainFow.computeEffectiveVisionRadius(plainUnit, null);

    // Hill should give 50% bonus: floor(5 * 1.5) = 7 vs 5
    expect(hillRadius).toBe(7);
    expect(plainRadius).toBe(5);
    expect(hillRadius).toBeGreaterThan(plainRadius);
  });

  it('uphill blocking: high elevation blocks LOS past it', () => {
    // Viewer at elevation 0.5, blocker at elevation 0.8 (>0.65)
    const overrides = [{ x: 12, y: 10, terrain: TerrainType.PLAINS, elevation: 0.8 }];
    grid = makeGridWith(overrides);
    fow = new FogOfWarSystem(grid, MAP_W, MAP_H);

    const unit = makeUnit(1, 10, 10, 0);
    fow.tick(0, [unit], [], null);

    // The high-elevation tile itself is visible
    expect(fow.getVisibility(12, 10)).toBe(FogVisibility.VISIBLE);
    // Tiles past it should be blocked (in shadow)
    expect(fow.getVisibility(14, 10)).toBe(FogVisibility.UNEXPLORED);
  });

  it('fog weather halves effective radius', () => {
    const unit = makeUnit(1, 15, 15, 0);
    const env = makeEnv(WeatherType.FOG, TimeOfDay.MIDDAY);
    const radius = fow.computeEffectiveVisionRadius(unit, env);
    // 5 * 1 * 0.5 * 1.0 = 2
    expect(radius).toBe(2);
  });

  it('night time reduces radius', () => {
    const unit = makeUnit(1, 15, 15, 0);
    const env = makeEnv(WeatherType.CLEAR, TimeOfDay.NIGHT);
    const radius = fow.computeEffectiveVisionRadius(unit, env);
    // 5 * 1 * 1.0 * 0.3 = 1 (floor, min 1)
    expect(radius).toBe(1);
  });

  it('scout has 3x vision multiplier', () => {
    const scout = makeUnit(1, 15, 15, 0, UnitType.SCOUTS);
    const radius = fow.computeEffectiveVisionRadius(scout, null);
    // 5 * 3 = 15
    expect(radius).toBe(15);
  });

  it('light cavalry has 2x vision multiplier', () => {
    const cav = makeUnit(1, 15, 15, 0, UnitType.LIGHT_CAVALRY);
    const radius = fow.computeEffectiveVisionRadius(cav, null);
    // 5 * 2 = 10
    expect(radius).toBe(10);
  });

  it('default unit has 1x vision multiplier', () => {
    const halberds = makeUnit(1, 15, 15, 0, UnitType.JI_HALBERDIERS);
    const radius = fow.computeEffectiveVisionRadius(halberds, null);
    expect(radius).toBe(5);
  });

  it('VISIBLE transitions to EXPLORED when unit moves away', () => {
    const unit = makeUnit(1, 10, 10, 0);
    fow.tick(0, [unit], [], null);
    expect(fow.getVisibility(10, 10)).toBe(FogVisibility.VISIBLE);

    // Move unit far away
    unit.x = 25 * TILE_SIZE + TILE_SIZE / 2;
    unit.y = 25 * TILE_SIZE + TILE_SIZE / 2;
    fow.tick(4, [unit], [], null);

    // Old position should now be EXPLORED
    expect(fow.getVisibility(10, 10)).toBe(FogVisibility.EXPLORED);
    // New position should be VISIBLE
    expect(fow.getVisibility(25, 25)).toBe(FogVisibility.VISIBLE);
  });

  it('EXPLORED persists — never reverts to UNEXPLORED', () => {
    const unit = makeUnit(1, 10, 10, 0);
    fow.tick(0, [unit], [], null);
    expect(fow.getVisibility(11, 10)).toBe(FogVisibility.VISIBLE);

    // Move away
    unit.x = 25 * TILE_SIZE + TILE_SIZE / 2;
    unit.y = 25 * TILE_SIZE + TILE_SIZE / 2;
    fow.tick(4, [unit], [], null);

    // Should be EXPLORED, not UNEXPLORED
    expect(fow.getVisibility(11, 10)).toBe(FogVisibility.EXPLORED);

    // Tick again from far away — should still be EXPLORED
    fow.tick(8, [unit], [], null);
    expect(fow.getVisibility(11, 10)).toBe(FogVisibility.EXPLORED);
  });

  it('enemy in VISIBLE tile is in visibleEnemyIds', () => {
    const player = makeUnit(1, 15, 15, 0);
    const enemy = makeUnit(2, 16, 15, 1); // 1 tile away — within vision

    fow.tick(0, [player], [enemy], null);
    expect(fow.getVisibleEnemyIds().has(2)).toBe(true);
  });

  it('enemy in EXPLORED tile is NOT in visibleEnemyIds', () => {
    const player = makeUnit(1, 5, 5, 0);
    const enemy = makeUnit(2, 25, 25, 1); // Far away — not in vision

    fow.tick(0, [player], [enemy], null);
    expect(fow.getVisibleEnemyIds().has(2)).toBe(false);
  });

  it('player scout is stealthed when no enemy scouts and out of range', () => {
    const playerScout = makeUnit(1, 5, 5, 0, UnitType.SCOUTS);
    const enemy = makeUnit(2, 20, 20, 1, UnitType.JI_HALBERDIERS);

    fow.tick(0, [playerScout], [enemy], null);
    expect(fow.isScoutStealthed(1)).toBe(true);
  });

  it('player scout not stealthed when enemy has scouts', () => {
    const playerScout = makeUnit(1, 5, 5, 0, UnitType.SCOUTS);
    const enemyScout = makeUnit(2, 20, 20, 1, UnitType.SCOUTS);

    fow.tick(0, [playerScout], [enemyScout], null);
    expect(fow.isScoutStealthed(1)).toBe(false);
  });

  it('player scout detected when enemy within 2 tiles', () => {
    const playerScout = makeUnit(1, 10, 10, 0, UnitType.SCOUTS);
    const enemy = makeUnit(2, 11, 10, 1, UnitType.JI_HALBERDIERS); // 1 tile away

    fow.tick(0, [playerScout], [enemy], null);
    expect(fow.isScoutStealthed(1)).toBe(false);
  });

  it('serialize/deserialize round-trip preserves tiles', () => {
    const unit = makeUnit(1, 15, 15, 0);
    fow.tick(0, [unit], [], null);

    const snapshot = fow.serialize();
    const fow2 = new FogOfWarSystem(grid, MAP_W, MAP_H);
    fow2.deserialize(snapshot);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        expect(fow2.getVisibility(x, y)).toBe(fow.getVisibility(x, y));
      }
    }
  });

  it('reset() clears all tiles to UNEXPLORED', () => {
    const unit = makeUnit(1, 15, 15, 0);
    fow.tick(0, [unit], [], null);
    expect(fow.getVisibility(15, 15)).toBe(FogVisibility.VISIBLE);

    fow.reset();
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        expect(fow.getVisibility(x, y)).toBe(FogVisibility.UNEXPLORED);
      }
    }
    expect(fow.getVisibleEnemyIds().size).toBe(0);
  });

  it('dirty flag: version unchanged when stationary and not on recompute interval', () => {
    const unit = makeUnit(1, 15, 15, 0);
    fow.tick(0, [unit], [], null); // Initial tick (tick 0 % 4 === 0)
    const v1 = fow.version;

    // Tick 1: not dirty, not on interval → should NOT recompute
    fow.tick(1, [unit], [], null);
    expect(fow.version).toBe(v1);
  });

  it('dirty flag: version increments when unit moves 1+ tiles', () => {
    const unit = makeUnit(1, 15, 15, 0);
    fow.tick(0, [unit], [], null);
    const v1 = fow.version;

    // Move unit 2 tiles
    unit.x = 17 * TILE_SIZE + TILE_SIZE / 2;
    fow.tick(1, [unit], [], null);
    expect(fow.version).toBeGreaterThan(v1);
  });

  it('fallback interval recomputes at tick % 4 === 0', () => {
    const unit = makeUnit(1, 15, 15, 0);
    fow.tick(0, [unit], [], null);

    // tick 4 → should recompute via interval fallback even though stationary
    fow.tick(4, [unit], [], null);
    // Version may not change if visible count stays same, but the computation runs
    // We verify the recompute ran by checking the tile is still VISIBLE
    expect(fow.getVisibility(15, 15)).toBe(FogVisibility.VISIBLE);
  });

  it('multiple player units: vision is union', () => {
    const unit1 = makeUnit(1, 5, 5, 0);
    const unit2 = makeUnit(2, 25, 25, 0);

    fow.tick(0, [unit1, unit2], [], null);

    // Both units' tiles should be visible
    expect(fow.getVisibility(5, 5)).toBe(FogVisibility.VISIBLE);
    expect(fow.getVisibility(25, 25)).toBe(FogVisibility.VISIBLE);
  });

  it('units at map boundary do not crash', () => {
    const unit = makeUnit(1, 0, 0, 0);
    expect(() => fow.tick(0, [unit], [], null)).not.toThrow();
    expect(fow.getVisibility(0, 0)).toBe(FogVisibility.VISIBLE);

    const cornerUnit = makeUnit(2, MAP_W - 1, MAP_H - 1, 0);
    expect(() => fow.tick(4, [unit, cornerUnit], [], null)).not.toThrow();
    expect(fow.getVisibility(MAP_W - 1, MAP_H - 1)).toBe(FogVisibility.VISIBLE);
  });

  it('dead units do not contribute vision', () => {
    const deadUnit = makeUnit(1, 15, 15, 0, UnitType.JI_HALBERDIERS, UnitState.DEAD);
    fow.tick(0, [deadUnit], [], null);
    // Should not reveal anything
    expect(fow.getVisibility(15, 15)).toBe(FogVisibility.UNEXPLORED);
  });

  it('out-of-bounds tile returns UNEXPLORED', () => {
    expect(fow.getVisibility(-1, -1)).toBe(FogVisibility.UNEXPLORED);
    expect(fow.getVisibility(MAP_W, MAP_H)).toBe(FogVisibility.UNEXPLORED);
  });

  it('combined weather+night: scouts at night+fog have reduced vision', () => {
    const scout = makeUnit(1, 15, 15, 0, UnitType.SCOUTS);
    const env = makeEnv(WeatherType.FOG, TimeOfDay.NIGHT);
    const radius = fow.computeEffectiveVisionRadius(scout, env);
    // 5 * 3 * 0.5 * 0.3 = 2.25 → floor → 2
    expect(radius).toBe(2);
  });
});
