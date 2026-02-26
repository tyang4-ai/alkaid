import { Container, Graphics, RenderTexture, Sprite, type Renderer as PixiRenderer } from 'pixi.js';
import { TerrainGrid } from '../simulation/terrain/TerrainGrid';
import { ContourGenerator } from '../simulation/terrain/ContourGenerator';
import {
  TILE_SIZE, TERRAIN_COLORS, CONTOUR, TerrainType,
} from '../constants';

export class TerrainRenderer {
  private terrainSprite: Sprite | null = null;
  private contourSprite: Sprite | null = null;
  private container: Container;

  constructor(parentContainer: Container) {
    this.container = parentContainer;
  }

  /**
   * Bake the terrain grid into render textures and add to stage.
   * Call once when a new map is generated.
   */
  bake(grid: TerrainGrid, pixiRenderer: PixiRenderer): void {
    this.clear();

    const pixelW = grid.width * TILE_SIZE;
    const pixelH = grid.height * TILE_SIZE;

    // --- Terrain tile layer ---
    const tileGraphics = new Graphics();
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const terrainType = grid.getTerrain(x, y) as TerrainType;
        const color = TERRAIN_COLORS[terrainType] ?? 0xFF00FF;
        tileGraphics.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        tileGraphics.fill(color);
      }
    }

    const terrainTexture = RenderTexture.create({ width: pixelW, height: pixelH });
    pixiRenderer.render({ container: tileGraphics, target: terrainTexture });
    tileGraphics.destroy();

    this.terrainSprite = new Sprite(terrainTexture);
    this.container.addChild(this.terrainSprite);

    // --- Contour line layer ---
    const segments = ContourGenerator.generate(grid.elevation, grid.width, grid.height);
    if (segments.length > 0) {
      const contourGraphics = new Graphics();
      for (const seg of segments) {
        const color = seg.isMajor ? CONTOUR.MAJOR_COLOR : CONTOUR.MINOR_COLOR;
        const alpha = seg.isMajor ? CONTOUR.MAJOR_ALPHA : CONTOUR.MINOR_ALPHA;
        const width = seg.isMajor ? CONTOUR.LINE_WIDTH_MAJOR : CONTOUR.LINE_WIDTH_MINOR;

        contourGraphics
          .moveTo(seg.x1 * TILE_SIZE, seg.y1 * TILE_SIZE)
          .lineTo(seg.x2 * TILE_SIZE, seg.y2 * TILE_SIZE)
          .stroke({ width, color, alpha });
      }

      const contourTexture = RenderTexture.create({ width: pixelW, height: pixelH });
      pixiRenderer.render({ container: contourGraphics, target: contourTexture });
      contourGraphics.destroy();

      this.contourSprite = new Sprite(contourTexture);
      this.container.addChild(this.contourSprite);
    }
  }

  clear(): void {
    if (this.terrainSprite) {
      this.terrainSprite.texture.destroy(true);
      this.container.removeChild(this.terrainSprite);
      this.terrainSprite.destroy();
      this.terrainSprite = null;
    }
    if (this.contourSprite) {
      this.contourSprite.texture.destroy(true);
      this.container.removeChild(this.contourSprite);
      this.contourSprite.destroy();
      this.contourSprite = null;
    }
  }
}
