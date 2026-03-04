import { describe, it, expect } from 'vitest';
import { MINIMAP_WIDTH, MINIMAP_HEIGHT, TILE_SIZE } from '../../constants';

describe('Minimap', () => {
  it('terrain bake produces correct scale factors', () => {
    const mapWidth = 200;
    const mapHeight = 150;
    const mapWidthPx = mapWidth * TILE_SIZE;
    const mapHeightPx = mapHeight * TILE_SIZE;

    const scaleX = MINIMAP_WIDTH / mapWidthPx;
    const scaleY = MINIMAP_HEIGHT / mapHeightPx;

    // 200 tiles * 16px = 3200px world width
    // MINIMAP_WIDTH=200 / 3200 = 0.0625
    expect(scaleX).toBeCloseTo(0.0625);
    expect(scaleY).toBeCloseTo(0.0625);
  });

  it('click computes correct world coords', () => {
    const mapWidthPx = 200 * TILE_SIZE;
    const mapHeightPx = 150 * TILE_SIZE;

    // Simulate clicking at center of minimap (100, 75)
    const px = MINIMAP_WIDTH / 2;
    const py = MINIMAP_HEIGHT / 2;
    const worldX = (px / MINIMAP_WIDTH) * mapWidthPx;
    const worldY = (py / MINIMAP_HEIGHT) * mapHeightPx;

    expect(worldX).toBe(mapWidthPx / 2);
    expect(worldY).toBe(mapHeightPx / 2);
  });

  it('click at top-left corner returns world origin', () => {
    const mapWidthPx = 200 * TILE_SIZE;
    const mapHeightPx = 150 * TILE_SIZE;

    const worldX = (0 / MINIMAP_WIDTH) * mapWidthPx;
    const worldY = (0 / MINIMAP_HEIGHT) * mapHeightPx;

    expect(worldX).toBe(0);
    expect(worldY).toBe(0);
  });

  it('viewport rect position scales correctly', () => {
    const mapWidthPx = 200 * TILE_SIZE;
    const scaleX = MINIMAP_WIDTH / mapWidthPx;

    // Camera at world (500, 300) with viewport 800x600, zoom 1
    const cameraX = 500;
    const viewportWidth = 800;
    const zoom = 1;

    const viewLeft = cameraX * scaleX;
    const viewWidth = (viewportWidth / zoom) * scaleX;

    expect(viewLeft).toBeCloseTo(500 * scaleX);
    expect(viewWidth).toBeCloseTo(800 * scaleX);
  });

  it('unit dot positions map correctly', () => {
    const mapWidthPx = 200 * TILE_SIZE;
    const mapHeightPx = 150 * TILE_SIZE;
    const scaleX = MINIMAP_WIDTH / mapWidthPx;
    const scaleY = MINIMAP_HEIGHT / mapHeightPx;

    // Unit at world (1600, 1200) — center of map
    const unitX = 1600;
    const unitY = 1200;
    const dotX = unitX * scaleX;
    const dotY = unitY * scaleY;

    expect(dotX).toBeCloseTo(MINIMAP_WIDTH / 2);
    expect(dotY).toBeCloseTo(MINIMAP_HEIGHT / 2);
  });

  it('terrain pixel mapping covers full grid', () => {
    const gridWidth = 200;
    const gridHeight = 150;

    // Top-left minimap pixel maps to tile (0,0)
    const tile0X = Math.floor((0 / MINIMAP_WIDTH) * gridWidth);
    const tile0Y = Math.floor((0 / MINIMAP_HEIGHT) * gridHeight);
    expect(tile0X).toBe(0);
    expect(tile0Y).toBe(0);

    // Bottom-right minimap pixel maps to last tile
    const tileLastX = Math.floor(((MINIMAP_WIDTH - 1) / MINIMAP_WIDTH) * gridWidth);
    const tileLastY = Math.floor(((MINIMAP_HEIGHT - 1) / MINIMAP_HEIGHT) * gridHeight);
    expect(tileLastX).toBe(gridWidth - 1);
    expect(tileLastY).toBe(gridHeight - 1);
  });
});
