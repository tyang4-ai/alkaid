import { describe, it, expect, beforeEach } from 'vitest';
import { DeploymentManager } from '../DeploymentManager';
import { UnitManager } from '../../units/UnitManager';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import {
  TerrainType, UnitType, DeploymentPhase,
  DEPLOYMENT_RESERVE_DELAY_TICKS, DEPLOYMENT_COUNTDOWN_SECONDS, SIM_TICK_RATE,
  FormationType,
} from '../../../constants';

function makeFlatGrid(width = 200, height = 150): TerrainGrid {
  const size = width * height;
  return new TerrainGrid({
    width, height, seed: 42, templateId: 'open_plains',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain: new Uint8Array(size).fill(TerrainType.PLAINS),
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size).fill(0),
  });
}

const TILE_SIZE = 16;

function makeRoster() {
  return [
    { type: UnitType.JI_HALBERDIERS, size: 120, experience: 0 },
    { type: UnitType.NU_CROSSBOWMEN, size: 100, experience: 0 },
    { type: UnitType.LIGHT_CAVALRY, size: 40, experience: 0 },
    { type: UnitType.ELITE_GUARD, size: 15, experience: 0, isGeneral: true },
  ];
}

describe('DeploymentManager', () => {
  let dm: DeploymentManager;
  let um: UnitManager;
  let grid: TerrainGrid;

  beforeEach(() => {
    dm = new DeploymentManager();
    um = new UnitManager();
    grid = makeFlatGrid();
  });

  it('startDeployment populates roster and sets phase=DEPLOYING', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    expect(dm.phase).toBe(DeploymentPhase.DEPLOYING);
    expect(dm.getRoster()).toHaveLength(4);
  });

  it('placeUnit spawns unit and marks roster entry as placed', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    // Place at a point inside the zone (tile 10, 75)
    const worldX = 10 * TILE_SIZE + TILE_SIZE / 2;
    const worldY = 75 * TILE_SIZE + TILE_SIZE / 2;
    const unitId = dm.placeUnit(0, worldX, worldY, um);

    expect(unitId).not.toBeNull();
    expect(um.count).toBe(1);
    const roster = dm.getRoster();
    expect(roster[0].placed).toBe(true);
    expect(roster[0].unitId).toBe(unitId);
  });

  it('placeUnit rejects placement outside zone', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    // Right side of map (tile 150, 75) — outside zone
    const worldX = 150 * TILE_SIZE + TILE_SIZE / 2;
    const worldY = 75 * TILE_SIZE + TILE_SIZE / 2;
    const unitId = dm.placeUnit(0, worldX, worldY, um);

    expect(unitId).toBeNull();
    expect(um.count).toBe(0);
  });

  it('placeUnit rejects if rosterId already placed', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    const worldX = 10 * TILE_SIZE + TILE_SIZE / 2;
    const worldY = 75 * TILE_SIZE + TILE_SIZE / 2;

    dm.placeUnit(0, worldX, worldY, um);
    const second = dm.placeUnit(0, worldX + TILE_SIZE, worldY, um);
    expect(second).toBeNull();
    expect(um.count).toBe(1);
  });

  it('removeUnit destroys unit and marks entry unplaced', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    const worldX = 10 * TILE_SIZE + TILE_SIZE / 2;
    const worldY = 75 * TILE_SIZE + TILE_SIZE / 2;
    dm.placeUnit(0, worldX, worldY, um);

    expect(um.count).toBe(1);
    const removed = dm.removeUnit(0, um);
    expect(removed).toBe(true);
    expect(um.count).toBe(0);
    expect(dm.getRoster()[0].placed).toBe(false);
    expect(dm.getRoster()[0].unitId).toBeNull();
  });

  it('applyFormation places all units per template', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    dm.applyFormation(FormationType.STANDARD_LINE, um);

    // Should have placed at least some units
    const placedCount = dm.getRoster().filter(e => e.placed).length;
    expect(placedCount).toBeGreaterThan(0);
    expect(um.count).toBe(placedCount);
  });

  it('beginCountdown transitions to COUNTDOWN', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    dm.beginCountdown();
    expect(dm.phase).toBe(DeploymentPhase.COUNTDOWN);
  });

  it('beginCountdown auto-places general if not placed', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    // Don't place general (rosterId 3)
    dm.beginCountdown();

    // General should be auto-placed after countdown ends
    // Tick through countdown
    const totalTicks = DEPLOYMENT_COUNTDOWN_SECONDS * SIM_TICK_RATE;
    for (let i = 0; i < totalTicks; i++) {
      dm.tick(50, um);
    }

    const general = dm.getRoster().find(e => e.isGeneral);
    expect(general?.placed).toBe(true);
  });

  it('tick during COUNTDOWN decrements and transitions to BATTLE', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    dm.beginCountdown();

    const totalTicks = DEPLOYMENT_COUNTDOWN_SECONDS * SIM_TICK_RATE;
    for (let i = 0; i < totalTicks; i++) {
      dm.tick(50, um);
    }

    expect(dm.phase).toBe(DeploymentPhase.BATTLE);
  });

  it('after 60 battle ticks, unplaced units spawn at map edge', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    // Place only 2 of 4 units
    dm.placeUnit(0, 10 * TILE_SIZE + 8, 75 * TILE_SIZE + 8, um);
    dm.placeUnit(1, 12 * TILE_SIZE + 8, 75 * TILE_SIZE + 8, um);
    expect(um.count).toBe(2);

    dm.beginCountdown();

    // Tick through countdown
    const countdownTicks = DEPLOYMENT_COUNTDOWN_SECONDS * SIM_TICK_RATE;
    for (let i = 0; i < countdownTicks; i++) {
      dm.tick(50, um);
    }

    expect(dm.phase).toBe(DeploymentPhase.BATTLE);

    // Tick 60 battle ticks for reserves
    for (let i = 0; i < DEPLOYMENT_RESERVE_DELAY_TICKS; i++) {
      dm.tick(50, um);
    }

    // All roster entries should now be placed (general auto-placed + reserves)
    const allPlaced = dm.getRoster().every(e => e.placed);
    expect(allPlaced).toBe(true);
    // Original 2 + general auto-placed during countdown + reserve = total 4
    expect(um.count).toBe(4);
  });

  it('getRoster reflects current state', () => {
    dm.startDeployment(makeRoster(), grid, 'open_plains');
    const before = dm.getRoster();
    expect(before[0].placed).toBe(false);

    dm.placeUnit(0, 10 * TILE_SIZE + 8, 75 * TILE_SIZE + 8, um);
    const after = dm.getRoster();
    expect(after[0].placed).toBe(true);
  });
});
