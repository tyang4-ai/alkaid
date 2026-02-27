import { Container, Graphics } from 'pixi.js';
import type { Unit } from '../simulation/units/Unit';
import type { SelectionManager } from '../simulation/SelectionManager';
import {
  SELECTION_RING_COLOR, SELECTION_RING_WIDTH,
  SELECTION_RING_PULSE_SPEED, SELECTION_RING_ALPHA_MIN, SELECTION_RING_ALPHA_MAX,
  SELECTION_RING_RADIUS_PAD, UNIT_BASE_DOT_RADIUS, UNIT_MIN_DOT_RADIUS,
  SELECTION_BOX_FILL_COLOR, SELECTION_BOX_FILL_ALPHA,
  SELECTION_BOX_STROKE_COLOR, SELECTION_BOX_STROKE_ALPHA,
} from '../constants';

export class SelectionRenderer {
  private worldGraphics: Graphics;
  private screenGraphics: Graphics;
  private elapsed = 0;

  constructor(worldLayer: Container, uiLayer: Container) {
    this.worldGraphics = new Graphics();
    worldLayer.addChild(this.worldGraphics);
    this.screenGraphics = new Graphics();
    uiLayer.addChild(this.screenGraphics);
  }

  update(
    selectionManager: SelectionManager,
    getUnit: (id: number) => Unit | undefined,
    alpha: number,
    dtMs: number,
    boxRect: { x1: number; y1: number; x2: number; y2: number } | null,
  ): void {
    this.elapsed += dtMs / 1000;
    this.worldGraphics.clear();
    this.screenGraphics.clear();

    // Selection rings (world space)
    const pulse = Math.sin(this.elapsed * SELECTION_RING_PULSE_SPEED);
    const ringAlpha = SELECTION_RING_ALPHA_MIN +
      (SELECTION_RING_ALPHA_MAX - SELECTION_RING_ALPHA_MIN) * (pulse * 0.5 + 0.5);

    for (const id of selectionManager.selectedIds) {
      const unit = getUnit(id);
      if (!unit || unit.state === 5) continue;

      const renderX = unit.prevX + (unit.x - unit.prevX) * alpha;
      const renderY = unit.prevY + (unit.y - unit.prevY) * alpha;
      const strengthRatio = unit.size / unit.maxSize;
      const dotRadius = Math.max(UNIT_MIN_DOT_RADIUS, UNIT_BASE_DOT_RADIUS * Math.sqrt(strengthRatio));
      const ringRadius = dotRadius + SELECTION_RING_RADIUS_PAD;

      this.worldGraphics.circle(renderX, renderY, ringRadius);
      this.worldGraphics.stroke({
        width: SELECTION_RING_WIDTH,
        color: SELECTION_RING_COLOR,
        alpha: ringAlpha,
      });
    }

    // Box-select rectangle (screen space)
    if (boxRect) {
      const x = Math.min(boxRect.x1, boxRect.x2);
      const y = Math.min(boxRect.y1, boxRect.y2);
      const w = Math.abs(boxRect.x2 - boxRect.x1);
      const h = Math.abs(boxRect.y2 - boxRect.y1);

      this.screenGraphics.rect(x, y, w, h);
      this.screenGraphics.fill({ color: SELECTION_BOX_FILL_COLOR, alpha: SELECTION_BOX_FILL_ALPHA });
      this.screenGraphics.stroke({
        width: 1,
        color: SELECTION_BOX_STROKE_COLOR,
        alpha: SELECTION_BOX_STROKE_ALPHA,
      });
    }
  }

  destroy(): void {
    this.worldGraphics.destroy();
    this.screenGraphics.destroy();
  }
}
