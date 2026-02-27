import { Container, Graphics, RenderTexture, Sprite, type Renderer as PixiRenderer } from 'pixi.js';
import type { DeploymentZone } from '../simulation/deployment/DeploymentZone';
import type { UnitType } from '../constants';
import {
  TILE_SIZE,
  DEPLOYMENT_ZONE_COLOR, DEPLOYMENT_ZONE_ALPHA,
  DEPLOYMENT_ZONE_BORDER_COLOR, DEPLOYMENT_ZONE_BORDER_ALPHA, DEPLOYMENT_ZONE_BORDER_WIDTH,
  DEPLOYMENT_GHOST_ALPHA, DEPLOYMENT_GHOST_VALID_COLOR, DEPLOYMENT_GHOST_INVALID_COLOR,
  DEPLOYMENT_COMMAND_RADIUS_COLOR, DEPLOYMENT_COMMAND_RADIUS_ALPHA,
  UNIT_TYPE_SHAPE, UNIT_SHAPE, UNIT_BASE_DOT_RADIUS,
} from '../constants';

export class DeploymentRenderer {
  private container: Container;
  private zoneSprite: Sprite | null = null;
  private ghostGraphics: Graphics;
  private commandRadiusGraphics: Graphics;

  constructor(worldLayer: Container) {
    this.container = worldLayer;
    this.ghostGraphics = new Graphics();
    this.ghostGraphics.visible = false;
    this.container.addChild(this.ghostGraphics);
    this.commandRadiusGraphics = new Graphics();
    this.commandRadiusGraphics.visible = false;
    this.container.addChild(this.commandRadiusGraphics);
  }

  renderZone(zone: DeploymentZone, _tileSize: number, pixiRenderer: PixiRenderer): void {
    this.clearZone();

    if (zone.validTiles.size === 0) return;

    const { minX, minY, maxX, maxY } = zone.bounds;
    const g = new Graphics();

    const tileMinX = Math.floor(minX / TILE_SIZE);
    const tileMinY = Math.floor(minY / TILE_SIZE);
    const tileMaxX = Math.ceil(maxX / TILE_SIZE);
    const tileMaxY = Math.ceil(maxY / TILE_SIZE);

    for (let ty = tileMinY; ty < tileMaxY; ty++) {
      for (let tx = tileMinX; tx < tileMaxX; tx++) {
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ty * TILE_SIZE + TILE_SIZE / 2;
        if (zone.isInZone(wx, wy)) {
          g.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          g.fill({ color: DEPLOYMENT_ZONE_COLOR, alpha: DEPLOYMENT_ZONE_ALPHA });
        }
      }
    }

    // Draw border around zone edges
    for (let ty = tileMinY; ty < tileMaxY; ty++) {
      for (let tx = tileMinX; tx < tileMaxX; tx++) {
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ty * TILE_SIZE + TILE_SIZE / 2;
        if (!zone.isInZone(wx, wy)) continue;

        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;

        // Check each neighbor — draw border on exposed edges
        if (!zone.isInZone(wx, wy - TILE_SIZE)) {
          g.moveTo(px, py).lineTo(px + TILE_SIZE, py)
            .stroke({ width: DEPLOYMENT_ZONE_BORDER_WIDTH, color: DEPLOYMENT_ZONE_BORDER_COLOR, alpha: DEPLOYMENT_ZONE_BORDER_ALPHA });
        }
        if (!zone.isInZone(wx, wy + TILE_SIZE)) {
          g.moveTo(px, py + TILE_SIZE).lineTo(px + TILE_SIZE, py + TILE_SIZE)
            .stroke({ width: DEPLOYMENT_ZONE_BORDER_WIDTH, color: DEPLOYMENT_ZONE_BORDER_COLOR, alpha: DEPLOYMENT_ZONE_BORDER_ALPHA });
        }
        if (!zone.isInZone(wx - TILE_SIZE, wy)) {
          g.moveTo(px, py).lineTo(px, py + TILE_SIZE)
            .stroke({ width: DEPLOYMENT_ZONE_BORDER_WIDTH, color: DEPLOYMENT_ZONE_BORDER_COLOR, alpha: DEPLOYMENT_ZONE_BORDER_ALPHA });
        }
        if (!zone.isInZone(wx + TILE_SIZE, wy)) {
          g.moveTo(px + TILE_SIZE, py).lineTo(px + TILE_SIZE, py + TILE_SIZE)
            .stroke({ width: DEPLOYMENT_ZONE_BORDER_WIDTH, color: DEPLOYMENT_ZONE_BORDER_COLOR, alpha: DEPLOYMENT_ZONE_BORDER_ALPHA });
        }
      }
    }

    // Bake to RenderTexture
    const rt = RenderTexture.create({ width: tileMaxX * TILE_SIZE, height: tileMaxY * TILE_SIZE });
    pixiRenderer.render({ container: g, target: rt });
    g.destroy();

    this.zoneSprite = new Sprite(rt);
    this.container.addChildAt(this.zoneSprite, 0);
  }

  showGhost(worldX: number, worldY: number, unitType: UnitType, isValid: boolean): void {
    const g = this.ghostGraphics;
    g.clear();
    g.visible = true;

    const shape = UNIT_TYPE_SHAPE[unitType];
    const color = isValid ? DEPLOYMENT_GHOST_VALID_COLOR : DEPLOYMENT_GHOST_INVALID_COLOR;
    const r = UNIT_BASE_DOT_RADIUS * 1.5;

    this.drawShape(g, worldX, worldY, shape, r, color);
    g.fill({ color, alpha: DEPLOYMENT_GHOST_ALPHA });
    g.stroke({ width: 1.5, color, alpha: DEPLOYMENT_GHOST_ALPHA + 0.2 });
  }

  hideGhost(): void {
    this.ghostGraphics.visible = false;
    this.ghostGraphics.clear();
  }

  showCommandRadius(worldX: number, worldY: number, radiusPixels: number): void {
    const g = this.commandRadiusGraphics;
    g.clear();
    g.visible = true;
    g.circle(worldX, worldY, radiusPixels);
    g.stroke({ width: 2, color: DEPLOYMENT_COMMAND_RADIUS_COLOR, alpha: DEPLOYMENT_COMMAND_RADIUS_ALPHA });
    g.fill({ color: DEPLOYMENT_COMMAND_RADIUS_COLOR, alpha: DEPLOYMENT_COMMAND_RADIUS_ALPHA * 0.3 });
  }

  hideCommandRadius(): void {
    this.commandRadiusGraphics.visible = false;
    this.commandRadiusGraphics.clear();
  }

  clear(): void {
    this.clearZone();
    this.hideGhost();
    this.hideCommandRadius();
  }

  destroy(): void {
    this.clear();
    this.container.removeChild(this.ghostGraphics);
    this.ghostGraphics.destroy();
    this.container.removeChild(this.commandRadiusGraphics);
    this.commandRadiusGraphics.destroy();
  }

  private clearZone(): void {
    if (this.zoneSprite) {
      this.zoneSprite.texture.destroy(true);
      this.container.removeChild(this.zoneSprite);
      this.zoneSprite.destroy();
      this.zoneSprite = null;
    }
  }

  private drawShape(g: Graphics, cx: number, cy: number, shape: number, r: number, _color: number): void {
    switch (shape) {
      case UNIT_SHAPE.CIRCLE:
        g.circle(cx, cy, r);
        break;
      case UNIT_SHAPE.TRIANGLE: {
        const h = r * Math.sqrt(3);
        g.poly([cx, cy - r, cx - h / 2, cy + r * 0.5, cx + h / 2, cy + r * 0.5]);
        break;
      }
      case UNIT_SHAPE.DIAMOND:
        g.poly([cx, cy - r, cx + r * 0.7, cy, cx, cy + r, cx - r * 0.7, cy]);
        break;
      case UNIT_SHAPE.SQUARE:
        g.rect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
        break;
      case UNIT_SHAPE.HEXAGON: {
        const pts: number[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          pts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
        }
        g.poly(pts);
        break;
      }
    }
  }
}
