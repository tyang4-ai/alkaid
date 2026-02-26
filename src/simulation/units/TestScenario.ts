import { UnitManager } from './UnitManager';
import { TerrainGrid } from '../terrain/TerrainGrid';
import { UnitType, TerrainType, TILE_SIZE } from '../../constants';

/** Spiral-search outward from (tileX, tileY) for a walkable tile. */
function findValidPos(
  grid: TerrainGrid, tileX: number, tileY: number,
): { x: number; y: number } {
  const blocked = new Set<TerrainType>([TerrainType.WATER, TerrainType.MOUNTAINS, TerrainType.RIVER]);

  // Check origin first
  if (tileX >= 0 && tileX < grid.width && tileY >= 0 && tileY < grid.height) {
    if (!blocked.has(grid.getTerrain(tileX, tileY))) {
      return tileToWorld(tileX, tileY);
    }
  }

  // Spiral outward
  for (let radius = 1; radius < 20; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // only ring
        const tx = tileX + dx;
        const ty = tileY + dy;
        if (tx < 0 || tx >= grid.width || ty < 0 || ty >= grid.height) continue;
        if (!blocked.has(grid.getTerrain(tx, ty))) {
          return tileToWorld(tx, ty);
        }
      }
    }
  }

  // Fallback: center of map
  return tileToWorld(Math.floor(grid.width / 2), Math.floor(grid.height / 2));
}

function tileToWorld(tx: number, ty: number): { x: number; y: number } {
  return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
}

/**
 * Spawn two opposing test armies for visual verification.
 * Player (team 0) at ~25% map width, Enemy (team 1) at ~75%.
 */
export function spawnTestArmies(unitManager: UnitManager, grid: TerrainGrid): void {
  const playerCol = Math.floor(grid.width * 0.25);
  const enemyCol = Math.floor(grid.width * 0.75);
  const centerRow = Math.floor(grid.height / 2);
  const spacing = 4; // tiles between squads

  const playerSquads: UnitType[] = [
    UnitType.JI_HALBERDIERS,
    UnitType.DAO_SWORDSMEN,
    UnitType.NU_CROSSBOWMEN,
    UnitType.GONG_ARCHERS,
    UnitType.LIGHT_CAVALRY,
  ];

  const enemySquads: UnitType[] = [
    UnitType.JI_HALBERDIERS,
    UnitType.HEAVY_CAVALRY,
    UnitType.NU_CROSSBOWMEN,
    UnitType.HORSE_ARCHERS,
    UnitType.ELITE_GUARD,
  ];

  const startRow = centerRow - Math.floor((playerSquads.length - 1) / 2) * spacing;

  for (let i = 0; i < playerSquads.length; i++) {
    const row = startRow + i * spacing;
    const pos = findValidPos(grid, playerCol, row);
    unitManager.spawn({ type: playerSquads[i], team: 0, x: pos.x, y: pos.y });
  }

  for (let i = 0; i < enemySquads.length; i++) {
    const row = startRow + i * spacing;
    const pos = findValidPos(grid, enemyCol, row);
    unitManager.spawn({ type: enemySquads[i], team: 1, x: pos.x, y: pos.y });
  }
}
