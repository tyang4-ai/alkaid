import { describe, it, expect } from 'vitest';
import { TerrainGrid } from '../TerrainGrid';
import { TerrainType } from '../../../constants';

describe('TerrainGrid', () => {
  function makeGrid(w = 4, h = 4) {
    const size = w * h;
    return new TerrainGrid({
      width: w, height: h, seed: 1, templateId: 'test',
      elevation: new Float32Array(size).fill(0.5),
      moisture: new Float32Array(size).fill(0.5),
      terrain: new Uint8Array(size).fill(TerrainType.PLAINS),
      riverFlow: new Int8Array(size).fill(-1),
      tileBitmask: new Uint8Array(size).fill(15),
    });
  }

  it('stores dimensions and seed', () => {
    const g = makeGrid(10, 8);
    expect(g.width).toBe(10);
    expect(g.height).toBe(8);
    expect(g.seed).toBe(1);
  });

  it('getElevation returns value at coord', () => {
    const g = makeGrid();
    expect(g.getElevation(0, 0)).toBe(0.5);
  });

  it('getTerrain returns WATER for out-of-bounds', () => {
    const g = makeGrid();
    expect(g.getTerrain(-1, 0)).toBe(TerrainType.WATER);
    expect(g.getTerrain(0, -1)).toBe(TerrainType.WATER);
    expect(g.getTerrain(100, 0)).toBe(TerrainType.WATER);
  });

  it('getBitmask returns 0 for out-of-bounds', () => {
    const g = makeGrid();
    expect(g.getBitmask(-1, 0)).toBe(0);
    expect(g.getBitmask(100, 0)).toBe(0);
  });

  it('getBitmask returns stored value for in-bounds', () => {
    const g = makeGrid();
    expect(g.getBitmask(1, 1)).toBe(15);
  });

  it('hasRiver returns false when riverFlow is -1', () => {
    const g = makeGrid();
    expect(g.hasRiver(0, 0)).toBe(false);
  });

  it('hasRiver returns false for out-of-bounds', () => {
    const g = makeGrid();
    expect(g.hasRiver(-1, 0)).toBe(false);
  });

  it('getMoisture returns 0 for out-of-bounds', () => {
    const g = makeGrid();
    expect(g.getMoisture(-1, 0)).toBe(0);
  });

  it('getElevation returns 0 for out-of-bounds', () => {
    const g = makeGrid();
    expect(g.getElevation(-1, 0)).toBe(0);
  });
});
