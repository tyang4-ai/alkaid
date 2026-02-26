import { describe, it, expect } from 'vitest';
import { TerrainGenerator } from '../TerrainGenerator';
import { TerrainType } from '../../../constants';

describe('TerrainGenerator', () => {
  it('generates a grid of correct dimensions', () => {
    const gen = new TerrainGenerator(42);
    const grid = gen.generate('open_plains', 50, 40);
    expect(grid.width).toBe(50);
    expect(grid.height).toBe(40);
  });

  it('same seed + template = identical terrain', () => {
    const a = new TerrainGenerator(42).generate('river_valley', 50, 40);
    const b = new TerrainGenerator(42).generate('river_valley', 50, 40);
    for (let i = 0; i < a.terrain.length; i++) {
      expect(a.terrain[i]).toBe(b.terrain[i]);
    }
  });

  it('different seeds produce different terrain', () => {
    const a = new TerrainGenerator(1).generate('open_plains', 50, 40);
    const b = new TerrainGenerator(2).generate('open_plains', 50, 40);
    let differences = 0;
    for (let i = 0; i < a.terrain.length; i++) {
      if (a.terrain[i] !== b.terrain[i]) differences++;
    }
    expect(differences).toBeGreaterThan(0);
  });

  it('elevation values are in [0, 1]', () => {
    const grid = new TerrainGenerator(100).generate('open_plains', 50, 40);
    for (let i = 0; i < grid.elevation.length; i++) {
      expect(grid.elevation[i]).toBeGreaterThanOrEqual(0);
      expect(grid.elevation[i]).toBeLessThanOrEqual(1);
    }
  });

  it('contains multiple terrain types', () => {
    const grid = new TerrainGenerator(42).generate('river_valley', 100, 80);
    const types = new Set<number>();
    for (let i = 0; i < grid.terrain.length; i++) {
      types.add(grid.terrain[i]);
    }
    expect(types.size).toBeGreaterThanOrEqual(3);
  });

  it('generates rivers (at least some river tiles)', () => {
    // Use mountain_pass — has high elevation areas that produce river sources
    const grid = new TerrainGenerator(42).generate('mountain_pass', 100, 80);
    let riverCount = 0;
    for (let i = 0; i < grid.terrain.length; i++) {
      if (grid.terrain[i] === TerrainType.RIVER) riverCount++;
    }
    expect(riverCount).toBeGreaterThan(0);
  });

  it('all 5 templates generate without error', () => {
    const templates = ['river_valley', 'mountain_pass', 'open_plains', 'wetlands', 'siege'];
    for (const t of templates) {
      const gen = new TerrainGenerator(42);
      expect(() => gen.generate(t, 50, 40)).not.toThrow();
    }
  });

  it('throws on unknown template', () => {
    const gen = new TerrainGenerator(42);
    expect(() => gen.generate('nonexistent')).toThrow('Unknown template');
  });

  it('computes auto-tile bitmask for all tiles', () => {
    const grid = new TerrainGenerator(42).generate('open_plains', 20, 20);
    for (let i = 0; i < grid.tileBitmask.length; i++) {
      expect(grid.tileBitmask[i]).toBeGreaterThanOrEqual(0);
      expect(grid.tileBitmask[i]).toBeLessThanOrEqual(15);
    }
  });

  it('bitmask reflects neighbor matching', () => {
    const grid = new TerrainGenerator(42).generate('open_plains', 50, 50);
    let fullyMatchedCount = 0;
    for (let y = 1; y < 49; y++) {
      for (let x = 1; x < 49; x++) {
        if (grid.getBitmask(x, y) === 15) fullyMatchedCount++;
      }
    }
    expect(fullyMatchedCount).toBeGreaterThan(0);
  });

  it('places city tiles from template', () => {
    const grid = new TerrainGenerator(42).generate('siege', 100, 80);
    let cityCount = 0;
    for (let i = 0; i < grid.terrain.length; i++) {
      if (grid.terrain[i] === TerrainType.CITY) cityCount++;
    }
    // Siege has 3 cities, each 3x3 = 27 tiles
    expect(cityCount).toBeGreaterThanOrEqual(9);
  });
});
