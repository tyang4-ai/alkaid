import { describe, it, expect, beforeEach } from 'vitest';
import { AIPerception } from '../AIPerception';
import { FogOfWarSystem } from '../../FogOfWarSystem';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { UnitManager } from '../../units/UnitManager';
import { SupplySystem } from '../../metrics/SupplySystem';
import { TerrainType, UnitType, UnitState, TILE_SIZE } from '../../../constants';

const MAP_W = 20;
const MAP_H = 20;

function makePlainGrid(w = MAP_W, h = MAP_H): TerrainGrid {
  const size = w * h;
  return new TerrainGrid({
    width: w, height: h, seed: 1, templateId: 'test',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain: new Uint8Array(size).fill(TerrainType.PLAINS),
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size),
  });
}

function makeGridWithHills(hillTiles: Array<{ x: number; y: number }>): TerrainGrid {
  const size = MAP_W * MAP_H;
  const terrain = new Uint8Array(size).fill(TerrainType.PLAINS);
  for (const h of hillTiles) {
    terrain[h.y * MAP_W + h.x] = TerrainType.HILLS;
  }
  return new TerrainGrid({
    width: MAP_W, height: MAP_H, seed: 1, templateId: 'test',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain,
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size),
  });
}

describe('AIPerception', () => {
  let grid: TerrainGrid;
  let um: UnitManager;
  let supply: SupplySystem;
  let fow: FogOfWarSystem;
  let perception: AIPerception;

  beforeEach(() => {
    grid = makePlainGrid();
    um = new UnitManager();
    supply = new SupplySystem(grid);
    fow = new FogOfWarSystem(grid, MAP_W, MAP_H);
    perception = new AIPerception(1, fow, grid);
  });

  it('assessment with no visible enemies → zero enemy strength', () => {
    // AI team=1 units
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 200, y: 100 });

    // Player team=0 units (not visible without FOW tick)
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 50, y: 100 });

    const a = perception.assess(um, supply, null, 10, 1);
    expect(a.enemyStrength).toBe(0);
    expect(a.visibleEnemyIds.size).toBe(0);
  });

  it('own strength computed correctly for known units', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 200, y: 100, size: 100 });

    const a = perception.assess(um, supply, null, 10, 1);
    expect(a.ownStrength).toBeGreaterThan(0);
  });

  it('casualty % correct when half the units die', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 200, y: 100 });
    // Initial count was 2
    const a = perception.assess(um, supply, null, 10, 2);
    expect(a.ownCasualtyPercent).toBeCloseTo(0.5, 1);
  });

  it('center of mass computed correctly', () => {
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 100, y: 100 });
    const u2 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 200, y: 200 });

    const a = perception.assess(um, supply, null, 10, 2);
    expect(a.ownCenter.x).toBeCloseTo((u1.x + u2.x) / 2, 0);
    expect(a.ownCenter.y).toBeCloseTo((u1.y + u2.y) / 2, 0);
  });

  it('strength ratio = own/enemy when both visible', () => {
    // Make FOW reveal enemies by having own units close
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 5 * TILE_SIZE, y: 5 * TILE_SIZE });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 5 * TILE_SIZE + TILE_SIZE, y: 5 * TILE_SIZE });

    // Tick FOW so team 1 sees team 0 (swap teams for AI perspective)
    fow.tick(1, um.getByTeam(1), um.getByTeam(0), null);

    const a = perception.assess(um, supply, null, 10, 1);
    expect(a.visibleEnemyIds.size).toBeGreaterThan(0);
    // Both same unit type and same size → ratio ~1.0
    expect(a.strengthRatio).toBeCloseTo(1.0, 0);
  });

  it('FOW filtering: enemies not in visible set excluded', () => {
    // Team 1 at one corner, team 0 at far corner — not visible
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 2 * TILE_SIZE, y: 2 * TILE_SIZE });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 18 * TILE_SIZE, y: 18 * TILE_SIZE });

    fow.tick(1, um.getByTeam(1), um.getByTeam(0), null);
    const a = perception.assess(um, supply, null, 10, 1);
    expect(a.visibleEnemyIds.size).toBe(0);
    expect(a.enemyStrength).toBe(0);
  });

  it('weak enemy detection: low morale', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 5 * TILE_SIZE, y: 5 * TILE_SIZE });
    const enemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 5 * TILE_SIZE + TILE_SIZE, y: 5 * TILE_SIZE });
    enemy.morale = 20; // Below AI_LOW_MORALE_THRESHOLD (30)

    fow.tick(1, um.getByTeam(1), um.getByTeam(0), null);
    const a = perception.assess(um, supply, null, 10, 1);
    expect(a.weakEnemies).toContain(enemy.id);
  });

  it('weak enemy detection: low size ratio', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 5 * TILE_SIZE, y: 5 * TILE_SIZE });
    const enemy = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 5 * TILE_SIZE + TILE_SIZE, y: 5 * TILE_SIZE });
    enemy.size = 10; // 10/100 = 0.1 < AI_LOW_SIZE_THRESHOLD (0.4)

    fow.tick(1, um.getByTeam(1), um.getByTeam(0), null);
    const a = perception.assess(um, supply, null, 10, 1);
    expect(a.weakEnemies).toContain(enemy.id);
  });

  it('terrain advantage scan finds hills', () => {
    const hillGrid = makeGridWithHills([{ x: 10, y: 10 }]);
    const hillFow = new FogOfWarSystem(hillGrid, MAP_W, MAP_H);
    const p = new AIPerception(1, hillFow, hillGrid);

    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 10 * TILE_SIZE, y: 10 * TILE_SIZE });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 10 * TILE_SIZE + 2 * TILE_SIZE, y: 10 * TILE_SIZE });

    hillFow.tick(1, um.getByTeam(1), um.getByTeam(0), null);
    const a = p.assess(um, supply, null, 10, 1);
    expect(a.terrainAdvantages.length).toBeGreaterThan(0);
    expect(a.terrainAdvantages.some(t => t.defBonus > 0)).toBe(true);
  });

  it('general threat detection', () => {
    um.spawn({ type: UnitType.GENERAL, team: 1, x: 5 * TILE_SIZE, y: 5 * TILE_SIZE, isGeneral: true });
    const enemy = um.spawn({ type: UnitType.LIGHT_CAVALRY, team: 0, x: 6 * TILE_SIZE, y: 5 * TILE_SIZE });

    fow.tick(1, um.getByTeam(1), um.getByTeam(0), null);
    const a = perception.assess(um, supply, null, 10, 1);
    expect(a.threatsToGeneral).toContain(enemy.id);
  });

  it('supply threat detection: enemy in rear zone', () => {
    // AI is team 1 (right side). Rear = >70% map width = 14+ tiles on 20-tile map
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 15 * TILE_SIZE, y: 10 * TILE_SIZE });
    const raider = um.spawn({ type: UnitType.LIGHT_CAVALRY, team: 0, x: 16 * TILE_SIZE, y: 10 * TILE_SIZE });

    fow.tick(1, um.getByTeam(1), um.getByTeam(0), null);
    const a = perception.assess(um, supply, null, 10, 1);
    expect(a.threatsToSupply).toContain(raider.id);
  });

  it('engagement counts: engaged, idle, routing', () => {
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 100, y: 100 });
    u1.combatTargetId = 99; // engaged
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 200, y: 100 });
    // u2 is idle (default)
    const u3 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 300, y: 100 });
    u3.state = UnitState.ROUTING;

    const a = perception.assess(um, supply, null, 10, 3);
    expect(a.ownEngagedCount).toBe(1);
    expect(a.ownIdleCount).toBe(1);
    expect(a.ownRoutingCount).toBe(1);
  });
});
