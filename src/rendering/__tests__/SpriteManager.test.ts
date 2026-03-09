import { describe, it, expect, vi } from 'vitest';

// Mock pixi.js so SpriteManager can be imported in Node environment
vi.mock('pixi.js', () => ({
  Assets: {
    add: vi.fn(),
    load: vi.fn().mockResolvedValue({}),
  },
  Texture: class Texture {},
}));

import { SpriteManager } from '../SpriteManager';

describe('SpriteManager', () => {
  it('starts as not loaded', () => {
    const sm = new SpriteManager();
    expect(sm.isLoaded()).toBe(false);
  });

  it('returns null for unit texture when not loaded', () => {
    const sm = new SpriteManager();
    expect(sm.getUnitTexture(0)).toBeNull();
    expect(sm.getUnitTexture(13)).toBeNull();
  });

  it('returns null for terrain texture when not loaded', () => {
    const sm = new SpriteManager();
    expect(sm.getTerrainTexture(0, 0)).toBeNull();
    expect(sm.getTerrainTexture(2, 3)).toBeNull();
  });

  it('returns null for UI icon when not loaded', () => {
    const sm = new SpriteManager();
    expect(sm.getUIIcon('morale')).toBeNull();
  });

  it('returns null for invalid unit type', () => {
    const sm = new SpriteManager();
    expect(sm.getUnitTexture(99)).toBeNull();
  });

  it('returns null for invalid terrain type', () => {
    const sm = new SpriteManager();
    expect(sm.getTerrainTexture(99, 0)).toBeNull();
  });
});
