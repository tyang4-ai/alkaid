import { Assets, Texture } from 'pixi.js';

interface SpriteManifest {
  units: Record<string, string>;
  terrain: Record<string, string[]>;
  ui: Record<string, string>;
}

// Unit type index to manifest key mapping
const UNIT_TYPE_KEYS: Record<number, string> = {
  0: 'ji_halberdiers',
  1: 'dao_swordsmen',
  2: 'nu_crossbowmen',
  3: 'gong_archers',
  4: 'light_cavalry',
  5: 'heavy_cavalry',
  6: 'horse_archers',
  7: 'siege_engineers',
  8: 'elite_guard',
  9: 'scouts',
  10: 'meng_chong',
  11: 'lou_chuan',
  12: 'fire_ships',
  13: 'general',
};

// Terrain type index to manifest key mapping
const TERRAIN_TYPE_KEYS: Record<number, string> = {
  0: 'water',
  1: 'ford',
  2: 'plains',
  3: 'forest',
  4: 'hills',
  5: 'mountains',
  6: 'river',
  7: 'marsh',
  8: 'road',
  9: 'city',
};

export class SpriteManager {
  private textures = new Map<string, Texture>();
  private manifest: SpriteManifest | null = null;
  private loaded = false;

  async init(): Promise<void> {
    try {
      // Load manifest
      const response = await fetch('/assets/sprites/manifest.json');
      this.manifest = await response.json();

      if (!this.manifest) return;

      // Collect all paths to load
      const paths: Record<string, string> = {};

      // Unit sprites
      for (const [key, path] of Object.entries(this.manifest.units)) {
        const fullPath = `/assets/sprites/${path}`;
        paths[`unit_${key}`] = fullPath;
      }

      // Terrain sprites
      for (const [key, variants] of Object.entries(this.manifest.terrain)) {
        for (let i = 0; i < variants.length; i++) {
          const fullPath = `/assets/sprites/${variants[i]}`;
          paths[`terrain_${key}_${i}`] = fullPath;
        }
      }

      // UI sprites
      for (const [key, path] of Object.entries(this.manifest.ui)) {
        const fullPath = `/assets/sprites/${path}`;
        paths[`ui_${key}`] = fullPath;
      }

      // Batch load all textures
      for (const [alias, url] of Object.entries(paths)) {
        Assets.add({ alias, src: url });
      }

      const loaded = await Assets.load(Object.keys(paths));

      // Store loaded textures
      for (const [alias, texture] of Object.entries(loaded)) {
        if (texture instanceof Texture) {
          this.textures.set(alias, texture);
        }
      }

      this.loaded = true;
      console.log(`SpriteManager: loaded ${this.textures.size} sprites`);
    } catch (err) {
      console.warn('SpriteManager: failed to load sprites, using fallbacks:', err);
      this.loaded = false;
    }
  }

  getUnitTexture(unitType: number): Texture | null {
    const key = UNIT_TYPE_KEYS[unitType];
    if (!key) return null;
    return this.textures.get(`unit_${key}`) ?? null;
  }

  getTerrainTexture(terrainType: number, variant: number): Texture | null {
    const key = TERRAIN_TYPE_KEYS[terrainType];
    if (!key) return null;
    return this.textures.get(`terrain_${key}_${variant}`) ?? null;
  }

  getUIIcon(name: string): Texture | null {
    return this.textures.get(`ui_${name}`) ?? null;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

/** Singleton instance */
export const spriteManager = new SpriteManager();
