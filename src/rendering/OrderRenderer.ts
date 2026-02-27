import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { OrderManager } from '../simulation/OrderManager';
import type { SelectionManager } from '../simulation/SelectionManager';
import type { Unit } from '../simulation/units/Unit';
import {
  ORDER_DISPLAY, ORDER_LINE_WIDTH, ORDER_LINE_ALPHA,
  ORDER_LINE_DASH, ORDER_LINE_GAP, ORDER_FLAG_SIZE,
} from '../constants';

export class OrderRenderer {
  private graphics: Graphics;

  constructor(worldLayer: Container) {
    this.graphics = new Graphics();
    worldLayer.addChild(this.graphics);
  }

  update(
    orderManager: OrderManager,
    selectionManager: SelectionManager,
    getUnit: (id: number) => Unit | undefined,
    alpha: number,
  ): void {
    this.graphics.clear();

    for (const id of selectionManager.selectedIds) {
      const order = orderManager.getOrder(id);
      if (!order || order.targetX === undefined || order.targetY === undefined) continue;

      const unit = getUnit(id);
      if (!unit || unit.state === 5) continue;

      const ux = unit.prevX + (unit.x - unit.prevX) * alpha;
      const uy = unit.prevY + (unit.y - unit.prevY) * alpha;
      const tx = order.targetX;
      const ty = order.targetY;
      const color = ORDER_DISPLAY[order.type].color;

      this.drawDashedLine(ux, uy, tx, ty, color);
      this.drawFlag(tx, ty, color);
    }
  }

  private drawDashedLine(
    x1: number, y1: number, x2: number, y2: number, color: number,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const segLen = ORDER_LINE_DASH + ORDER_LINE_GAP;
    let pos = 0;

    while (pos < dist) {
      const dashEnd = Math.min(pos + ORDER_LINE_DASH, dist);
      this.graphics
        .moveTo(x1 + nx * pos, y1 + ny * pos)
        .lineTo(x1 + nx * dashEnd, y1 + ny * dashEnd)
        .stroke({ width: ORDER_LINE_WIDTH, color, alpha: ORDER_LINE_ALPHA });
      pos += segLen;
    }
  }

  private drawFlag(x: number, y: number, color: number): void {
    const s = ORDER_FLAG_SIZE;
    this.graphics
      .moveTo(x, y)
      .lineTo(x, y - s * 2)
      .stroke({ width: 1.5, color, alpha: 0.8 });
    this.graphics
      .poly([x, y - s * 2, x + s, y - s * 1.5, x, y - s])
      .fill({ color, alpha: 0.7 });
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
