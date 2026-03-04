import type { Camera } from '../core/Camera';
import type { UnitManager } from '../simulation/units/UnitManager';
import type { TerrainGrid } from '../simulation/terrain/TerrainGrid';
import type { FogOfWarSystem } from '../simulation/FogOfWarSystem';
import type { Unit } from '../simulation/units/Unit';
import {
  TOOLTIP_DELAY_MS, TOOLTIP_MAX_WIDTH, TOOLTIP_OFFSET,
  TERRAIN_STATS, TILE_SIZE,
  UNIT_TYPE_CONFIGS, UnitState, SELECTION_CLICK_RADIUS,
  OrderType, ORDER_DISPLAY,
} from '../constants';
import type { TerrainType } from '../constants';
import type { OrderManager } from '../simulation/OrderManager';

const TERRAIN_NAMES: Record<number, string> = {
  0: 'Water (水)', 1: 'Ford (浅滩)', 2: 'Plains (平原)',
  3: 'Forest (森林)', 4: 'Hills (丘陵)', 5: 'Mountains (山脉)',
  6: 'River (河流)', 7: 'Marsh (沼泽)', 8: 'Road (道路)', 9: 'City (城池)',
};

export class TooltipSystem {
  private tooltip: HTMLDivElement;
  private camera: Camera;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private isShowing = false;
  private orderManager: OrderManager | null = null;

  constructor(parentElement: HTMLElement, camera: Camera) {
    this.camera = camera;

    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = `
      position: fixed;
      max-width: ${TOOLTIP_MAX_WIDTH}px;
      background: rgba(28, 20, 16, 0.95);
      color: #D4C4A0;
      font-family: 'Noto Serif SC', 'Songti SC', serif;
      font-size: 12px;
      padding: 8px 10px;
      border: 1px solid #8B7D3C;
      border-radius: 3px;
      pointer-events: none;
      z-index: 200;
      display: none;
      line-height: 1.5;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    `;
    parentElement.appendChild(this.tooltip);
  }

  setOrderManager(orderManager: OrderManager): void {
    this.orderManager = orderManager;
  }

  update(
    mouseScreenX: number, mouseScreenY: number,
    unitManager: UnitManager,
    terrainGrid: TerrainGrid,
    fowSystem: FogOfWarSystem | null,
  ): void {
    // Check if mouse moved significantly (more than 3px)
    const dx = mouseScreenX - this.lastMouseX;
    const dy = mouseScreenY - this.lastMouseY;
    if (dx * dx + dy * dy > 9) {
      // Mouse moved — reset hover timer
      this.hideTooltip();
      this.lastMouseX = mouseScreenX;
      this.lastMouseY = mouseScreenY;

      if (this.hoverTimer) clearTimeout(this.hoverTimer);
      this.hoverTimer = setTimeout(() => {
        this.showTooltipAt(mouseScreenX, mouseScreenY, unitManager, terrainGrid, fowSystem);
      }, TOOLTIP_DELAY_MS);
    }
  }

  private showTooltipAt(
    screenX: number, screenY: number,
    unitManager: UnitManager,
    terrainGrid: TerrainGrid,
    fowSystem: FogOfWarSystem | null,
  ): void {
    // Convert screen to world coords
    const world = this.camera.screenToWorld(screenX, screenY);
    const worldX = world.x;
    const worldY = world.y;

    // Check for unit under cursor first
    const unit = this.findUnitAt(worldX, worldY, unitManager, fowSystem);
    if (unit) {
      this.showUnitTooltip(unit, screenX, screenY, fowSystem);
      return;
    }

    // Check for terrain tile
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    if (tileX >= 0 && tileX < terrainGrid.width && tileY >= 0 && tileY < terrainGrid.height) {
      const terrain = terrainGrid.getTerrain(tileX, tileY);
      this.showTerrainTooltip(terrain as TerrainType, screenX, screenY);
      return;
    }

    // Check for data-tooltip on DOM elements
    const el = document.elementFromPoint(screenX, screenY);
    if (el) {
      const tooltipAttr = (el as HTMLElement).dataset?.tooltip;
      if (tooltipAttr) {
        this.showTextTooltip(tooltipAttr, screenX, screenY);
        return;
      }
    }
  }

  private findUnitAt(
    worldX: number, worldY: number,
    unitManager: UnitManager,
    fowSystem: FogOfWarSystem | null,
  ): Unit | null {
    const visibleEnemyIds = fowSystem ? fowSystem.getVisibleEnemyIds() : null;
    let closest: Unit | null = null;
    let closestDist = SELECTION_CLICK_RADIUS * SELECTION_CLICK_RADIUS;

    for (const unit of unitManager.getAll()) {
      if (unit.state === UnitState.DEAD) continue;
      // Only show enemies that are visible in FOW
      if (unit.team !== 0 && visibleEnemyIds && !visibleEnemyIds.has(unit.id)) continue;

      const dx = unit.x - worldX;
      const dy = unit.y - worldY;
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closest = unit;
      }
    }
    return closest;
  }

  private showUnitTooltip(
    unit: Unit,
    screenX: number, screenY: number,
    _fowSystem: FogOfWarSystem | null,
  ): void {
    const config = UNIT_TYPE_CONFIGS[unit.type];
    const isEnemy = unit.team !== 0;

    let html: string;
    if (isEnemy) {
      // Enemy: limited info
      html = `<b>${config.chineseName} ${config.displayName}</b><br>`;
      html += `Est. Size: ~${Math.round(unit.size / 10) * 10}`;
    } else {
      // Friendly: full info
      html = `<b>${config.chineseName} ${config.displayName}</b><br>`;
      html += `Size: ${unit.size}/${unit.maxSize}<br>`;
      html += `Morale: ${Math.round(unit.morale)}%<br>`;
      html += `Fatigue: ${Math.round(unit.fatigue)}%`;

      // Show current order
      if (this.orderManager) {
        const order = this.orderManager.getOrder(unit.id);
        if (order) {
          const display = ORDER_DISPLAY[order.type as OrderType];
          if (display) {
            html += `<br>Order: ${display.chinese} (${display.label})`;
          }
        }
      }
    }

    this.tooltip.innerHTML = html;
    this.positionTooltip(screenX, screenY);
    this.tooltip.style.display = 'block';
    this.isShowing = true;
  }

  private showTerrainTooltip(terrain: TerrainType, screenX: number, screenY: number): void {
    const name = TERRAIN_NAMES[terrain] ?? 'Unknown';
    const stats = TERRAIN_STATS[terrain];
    if (!stats) return;

    let html = `<b>${name}</b><br>`;
    html += `Move Cost: ${stats.moveCost < 0 ? 'Impassable' : stats.moveCost.toFixed(1) + 'x'}<br>`;
    html += `Def Bonus: ${stats.defBonus >= 0 ? '+' : ''}${(stats.defBonus * 100).toFixed(0)}%<br>`;
    html += `Forage: ${stats.forageRate.toFixed(1)}`;

    this.tooltip.innerHTML = html;
    this.positionTooltip(screenX, screenY);
    this.tooltip.style.display = 'block';
    this.isShowing = true;
  }

  private showTextTooltip(text: string, screenX: number, screenY: number): void {
    this.tooltip.textContent = text;
    this.positionTooltip(screenX, screenY);
    this.tooltip.style.display = 'block';
    this.isShowing = true;
  }

  private positionTooltip(screenX: number, screenY: number): void {
    let left = screenX + TOOLTIP_OFFSET;
    let top = screenY + TOOLTIP_OFFSET;

    // Clamp to viewport edges
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const rect = this.tooltip.getBoundingClientRect();
    const w = rect.width || TOOLTIP_MAX_WIDTH;
    const h = rect.height || 80;

    if (left + w > viewW - 4) left = screenX - w - TOOLTIP_OFFSET;
    if (top + h > viewH - 4) top = screenY - h - TOOLTIP_OFFSET;
    if (left < 4) left = 4;
    if (top < 4) top = 4;

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  private hideTooltip(): void {
    if (this.isShowing) {
      this.tooltip.style.display = 'none';
      this.isShowing = false;
    }
  }

  destroy(): void {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.tooltip.remove();
  }
}
