import type { Camera } from '../core/Camera';
import type { SelectionManager } from '../simulation/SelectionManager';
import type { OrderManager } from '../simulation/OrderManager';
import type { UnitManager } from '../simulation/units/UnitManager';
import { ORDER_WAYPOINT_RADIUS, ORDER_WAYPOINT_COLOR } from '../constants';

/**
 * Renders numbered gold circles at each queued waypoint for selected units.
 * Uses a Canvas2D overlay for simplicity.
 */
export class OrderQueueRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(parentElement: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 50;
    `;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d')!;
    parentElement.appendChild(this.canvas);

    window.addEventListener('resize', this.onResize);
  }

  update(
    selectionManager: SelectionManager,
    orderManager: OrderManager,
    unitManager: UnitManager,
    camera: Camera,
  ): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (selectionManager.count === 0) return;

    const colorHex = '#' + ORDER_WAYPOINT_COLOR.toString(16).padStart(6, '0');

    for (const unitId of selectionManager.selectedIds) {
      const queue = orderManager.peekQueue(unitId);
      if (queue.length <= 1) continue;

      const unit = unitManager.get(unitId);
      if (!unit) continue;

      // Draw dashed lines connecting waypoints
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();

      const unitScreen = camera.worldToScreen(unit.x, unit.y);
      ctx.moveTo(unitScreen.x, unitScreen.y);

      for (let i = 0; i < queue.length; i++) {
        const order = queue[i];
        if (order.targetX === undefined || order.targetY === undefined) continue;
        const s = camera.worldToScreen(order.targetX, order.targetY);
        ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Draw numbered waypoint circles (skip first — it's the current order)
      for (let i = 1; i < queue.length; i++) {
        const order = queue[i];
        if (order.targetX === undefined || order.targetY === undefined) continue;
        const s = camera.worldToScreen(order.targetX, order.targetY);
        const sx = s.x;
        const sy = s.y;

        // Gold circle
        ctx.fillStyle = colorHex;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, ORDER_WAYPOINT_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Number label
        ctx.fillStyle = '#000';
        ctx.globalAlpha = 1;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), sx, sy);
      }
    }
  }

  private onResize = (): void => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  hide(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.canvas.remove();
  }
}
