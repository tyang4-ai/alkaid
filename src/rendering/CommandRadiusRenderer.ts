import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { Unit } from '../simulation/units/Unit';

const COMMAND_RADIUS_STROKE_COLOR = 0xC9A84C;
const COMMAND_RADIUS_STROKE_ALPHA = 0.20;
const COMMAND_RADIUS_FILL_ALPHA = 0.04;

export class CommandRadiusRenderer {
  private graphics: Graphics;

  constructor(worldLayer: Container) {
    this.graphics = new Graphics();
    worldLayer.addChild(this.graphics);
  }

  update(general: Unit | undefined, commandRadiusPixels: number, alpha: number): void {
    this.graphics.clear();
    if (!general) return;

    const gx = general.prevX + (general.x - general.prevX) * alpha;
    const gy = general.prevY + (general.y - general.prevY) * alpha;

    // Fill
    this.graphics.circle(gx, gy, commandRadiusPixels);
    this.graphics.fill({ color: COMMAND_RADIUS_STROKE_COLOR, alpha: COMMAND_RADIUS_FILL_ALPHA });

    // Stroke
    this.graphics.circle(gx, gy, commandRadiusPixels);
    this.graphics.stroke({ width: 1.5, color: COMMAND_RADIUS_STROKE_COLOR, alpha: COMMAND_RADIUS_STROKE_ALPHA });
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
