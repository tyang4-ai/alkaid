import {
  Container, Graphics, RenderTexture, Sprite,
  type Renderer as PixiRenderer,
} from 'pixi.js';
import { FogVisibility } from '../simulation/FogOfWarSystem';
import type { FogOfWarSystem } from '../simulation/FogOfWarSystem';
import { TILE_SIZE } from '../constants';

const ALPHA_UNEXPLORED = 0.92;
const ALPHA_EXPLORED = 0.55;

export class FogOfWarRenderer {
  private fogLayer: Container;
  private pixiRenderer: PixiRenderer;
  private fogSprite: Sprite | null = null;
  private fogTexture: RenderTexture | null = null;
  private lastVersion = -1;
  private mapWidth: number;
  private mapHeight: number;

  constructor(fogLayer: Container, pixiRenderer: PixiRenderer, mapWidth: number, mapHeight: number) {
    this.fogLayer = fogLayer;
    this.pixiRenderer = pixiRenderer;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  update(fowSystem: FogOfWarSystem): void {
    if (fowSystem.version === this.lastVersion) return;
    this.lastVersion = fowSystem.version;
    this.bake(fowSystem);
  }

  clear(): void {
    if (this.fogSprite) {
      this.fogLayer.removeChild(this.fogSprite);
      this.fogSprite.destroy();
      this.fogSprite = null;
    }
    if (this.fogTexture) {
      this.fogTexture.destroy(true);
      this.fogTexture = null;
    }
    this.lastVersion = -1;
  }

  private bake(fowSystem: FogOfWarSystem): void {
    const pixelW = this.mapWidth * TILE_SIZE;
    const pixelH = this.mapHeight * TILE_SIZE;

    const g = new Graphics();

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const vis = fowSystem.getVisibility(x, y);
        if (vis === FogVisibility.VISIBLE) continue; // Transparent — no overlay

        const alpha = vis === FogVisibility.UNEXPLORED ? ALPHA_UNEXPLORED : ALPHA_EXPLORED;
        g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        g.fill({ color: 0x000000, alpha });
      }
    }

    // Create or reuse render texture
    if (!this.fogTexture) {
      this.fogTexture = RenderTexture.create({ width: pixelW, height: pixelH });
    }

    this.pixiRenderer.render({ container: g, target: this.fogTexture, clear: true });
    g.destroy();

    if (!this.fogSprite) {
      this.fogSprite = new Sprite(this.fogTexture);
      this.fogLayer.addChild(this.fogSprite);
    } else {
      this.fogSprite.texture = this.fogTexture;
    }
  }
}
