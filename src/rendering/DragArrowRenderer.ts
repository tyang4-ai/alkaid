import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import {
  ORDER_LINE_WIDTH, ORDER_LINE_ALPHA,
  ORDER_LINE_DASH, ORDER_LINE_GAP,
} from '../constants';

const ARROWHEAD_SIZE = 10;
const ARROW_COLOR = 0xFFFFFF;

export class DragArrowRenderer {
  private graphics: Graphics;
  private _active = false;

  constructor(worldLayer: Container) {
    this.graphics = new Graphics();
    worldLayer.addChild(this.graphics);
  }

  show(): void { this._active = true; }

  hide(): void { this._active = false; this.graphics.clear(); }

  get active(): boolean { return this._active; }

  /** Draw arrow from (fromX,fromY) to (toX,toY) in world coords. */
  update(fromX: number, fromY: number, toX: number, toY: number): void {
    this.graphics.clear();
    if (!this._active) return;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return;

    const nx = dx / dist;
    const ny = dy / dist;

    // Dashed line (same pattern as OrderRenderer)
    const segLen = ORDER_LINE_DASH + ORDER_LINE_GAP;
    let pos = 0;
    while (pos < dist) {
      const dashEnd = Math.min(pos + ORDER_LINE_DASH, dist);
      this.graphics
        .moveTo(fromX + nx * pos, fromY + ny * pos)
        .lineTo(fromX + nx * dashEnd, fromY + ny * dashEnd)
        .stroke({ width: ORDER_LINE_WIDTH, color: ARROW_COLOR, alpha: ORDER_LINE_ALPHA });
      pos += segLen;
    }

    // Arrowhead: filled triangle at tip
    const s = ARROWHEAD_SIZE;
    // Perpendicular vector
    const px = -ny;
    const py = nx;
    // Triangle points: tip, and two base points offset back along the line
    const baseX = toX - nx * s;
    const baseY = toY - ny * s;
    this.graphics
      .poly([
        toX, toY,
        baseX + px * s * 0.4, baseY + py * s * 0.4,
        baseX - px * s * 0.4, baseY - py * s * 0.4,
      ])
      .fill({ color: ARROW_COLOR, alpha: ORDER_LINE_ALPHA });
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
