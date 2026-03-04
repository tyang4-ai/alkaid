import type { Camera } from '../core/Camera';
import type { TerrainGrid } from '../simulation/terrain/TerrainGrid';
import type { UnitManager } from '../simulation/units/UnitManager';
import type { FogOfWarSystem } from '../simulation/FogOfWarSystem';
import {
  MINIMAP_WIDTH, MINIMAP_HEIGHT, MINIMAP_MARGIN,
  MINIMAP_BG_ALPHA, MINIMAP_VIEWPORT_COLOR, MINIMAP_VIEWPORT_ALPHA,
  MINIMAP_PLAYER_DOT_COLOR, MINIMAP_ENEMY_DOT_COLOR, MINIMAP_DOT_SIZE,
  TERRAIN_COLORS, TILE_SIZE, UnitState,
} from '../constants';
import type { TerrainType } from '../constants';

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xFF, (hex >> 8) & 0xFF, hex & 0xFF];
}

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrainImageData: ImageData | null = null;
  private mapWidthPx: number;
  private mapHeightPx: number;
  private scaleX: number;
  private scaleY: number;
  private camera: Camera;
  private _visible = true;
  private isDragging = false;

  constructor(
    parentElement: HTMLElement,
    camera: Camera,
    mapWidthPx: number,
    mapHeightPx: number,
  ) {
    this.camera = camera;
    this.mapWidthPx = mapWidthPx;
    this.mapHeightPx = mapHeightPx;
    this.scaleX = MINIMAP_WIDTH / mapWidthPx;
    this.scaleY = MINIMAP_HEIGHT / mapHeightPx;

    this.canvas = document.createElement('canvas');
    this.canvas.width = MINIMAP_WIDTH;
    this.canvas.height = MINIMAP_HEIGHT;
    this.canvas.style.cssText = `
      position: fixed;
      bottom: ${MINIMAP_MARGIN}px;
      right: ${MINIMAP_MARGIN}px;
      width: ${MINIMAP_WIDTH}px;
      height: ${MINIMAP_HEIGHT}px;
      border: 1px solid #8B7D3C;
      cursor: pointer;
      z-index: 100;
      image-rendering: pixelated;
    `;

    this.ctx = this.canvas.getContext('2d')!;

    // Click-to-pan handlers
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mouseleave', this.onMouseUp);
    // Prevent game input from receiving these events
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => e.stopPropagation());

    parentElement.appendChild(this.canvas);
  }

  bakeTerrainFromGrid(terrainGrid: TerrainGrid): void {
    this.mapWidthPx = terrainGrid.width * TILE_SIZE;
    this.mapHeightPx = terrainGrid.height * TILE_SIZE;
    this.scaleX = MINIMAP_WIDTH / this.mapWidthPx;
    this.scaleY = MINIMAP_HEIGHT / this.mapHeightPx;

    const imageData = this.ctx.createImageData(MINIMAP_WIDTH, MINIMAP_HEIGHT);
    const data = imageData.data;

    for (let py = 0; py < MINIMAP_HEIGHT; py++) {
      for (let px = 0; px < MINIMAP_WIDTH; px++) {
        // Map minimap pixel to terrain tile
        const tileX = Math.floor((px / MINIMAP_WIDTH) * terrainGrid.width);
        const tileY = Math.floor((py / MINIMAP_HEIGHT) * terrainGrid.height);
        const terrain = terrainGrid.getTerrain(tileX, tileY) as TerrainType;
        const color = TERRAIN_COLORS[terrain] ?? 0x000000;
        const [r, g, b] = hexToRgb(color);
        const idx = (py * MINIMAP_WIDTH + px) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    this.terrainImageData = imageData;
  }

  update(
    unitManager: UnitManager,
    fowSystem: FogOfWarSystem | null,
    camera: Camera,
  ): void {
    if (!this._visible || !this.terrainImageData) return;
    this.camera = camera;

    const ctx = this.ctx;

    // Draw terrain base
    ctx.putImageData(this.terrainImageData, 0, 0);

    // FOW overlay
    if (fowSystem) {
      const fowCanvas = ctx.getImageData(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
      const fowData = fowCanvas.data;
      for (let py = 0; py < MINIMAP_HEIGHT; py++) {
        for (let px = 0; px < MINIMAP_WIDTH; px++) {
          const tileX = Math.floor((px / MINIMAP_WIDTH) * (this.mapWidthPx / TILE_SIZE));
          const tileY = Math.floor((py / MINIMAP_HEIGHT) * (this.mapHeightPx / TILE_SIZE));
          const visibility = fowSystem.getVisibility(tileX, tileY);
          const idx = (py * MINIMAP_WIDTH + px) * 4;
          if (visibility === 0) {
            // Unexplored — darken heavily
            fowData[idx] = Math.floor(fowData[idx] * 0.3);
            fowData[idx + 1] = Math.floor(fowData[idx + 1] * 0.3);
            fowData[idx + 2] = Math.floor(fowData[idx + 2] * 0.3);
          } else if (visibility === 1) {
            // Explored but not visible — darken somewhat
            fowData[idx] = Math.floor(fowData[idx] * 0.6);
            fowData[idx + 1] = Math.floor(fowData[idx + 1] * 0.6);
            fowData[idx + 2] = Math.floor(fowData[idx + 2] * 0.6);
          }
          // visibility === 2 (visible) — no darkening
        }
      }
      ctx.putImageData(fowCanvas, 0, 0);
    }

    // Background alpha overlay
    ctx.globalAlpha = 1 - MINIMAP_BG_ALPHA;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    ctx.globalAlpha = 1;

    // Draw unit dots
    const visibleEnemyIds = fowSystem ? fowSystem.getVisibleEnemyIds() : null;
    for (const unit of unitManager.getAll()) {
      if (unit.state === UnitState.DEAD) continue;

      const mx = unit.x * this.scaleX;
      const my = unit.y * this.scaleY;

      if (unit.team === 0) {
        // Player unit — always visible
        ctx.fillStyle = '#' + MINIMAP_PLAYER_DOT_COLOR.toString(16).padStart(6, '0');
      } else {
        // Enemy unit — only if visible in FOW
        if (visibleEnemyIds && !visibleEnemyIds.has(unit.id)) continue;
        ctx.fillStyle = '#' + MINIMAP_ENEMY_DOT_COLOR.toString(16).padStart(6, '0');
      }

      ctx.fillRect(
        Math.floor(mx - MINIMAP_DOT_SIZE / 2),
        Math.floor(my - MINIMAP_DOT_SIZE / 2),
        MINIMAP_DOT_SIZE,
        MINIMAP_DOT_SIZE,
      );
    }

    // Draw camera viewport rect
    const viewportLeft = camera.x * this.scaleX;
    const viewportTop = camera.y * this.scaleY;
    const viewportWidth = (camera.viewportWidth / camera.zoom) * this.scaleX;
    const viewportHeight = (camera.viewportHeight / camera.zoom) * this.scaleY;

    ctx.strokeStyle = '#' + MINIMAP_VIEWPORT_COLOR.toString(16).padStart(6, '0');
    ctx.globalAlpha = MINIMAP_VIEWPORT_ALPHA;
    ctx.lineWidth = 1;
    ctx.strokeRect(viewportLeft, viewportTop, viewportWidth, viewportHeight);
    ctx.globalAlpha = 1;
  }

  private screenToWorld(screenX: number, screenY: number): { worldX: number; worldY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const px = screenX - rect.left;
    const py = screenY - rect.top;
    return {
      worldX: (px / MINIMAP_WIDTH) * this.mapWidthPx,
      worldY: (py / MINIMAP_HEIGHT) * this.mapHeightPx,
    };
  }

  private panTo(screenX: number, screenY: number): void {
    const { worldX, worldY } = this.screenToWorld(screenX, screenY);
    this.camera.moveTo(worldX, worldY);
  }

  private onMouseDown = (e: MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    this.isDragging = true;
    this.panTo(e.clientX, e.clientY);
  };

  private onMouseMove = (e: MouseEvent): void => {
    e.stopPropagation();
    if (this.isDragging) {
      this.panTo(e.clientX, e.clientY);
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    e.stopPropagation();
    this.isDragging = false;
  };

  show(): void {
    this._visible = true;
    this.canvas.style.display = 'block';
  }

  hide(): void {
    this._visible = false;
    this.canvas.style.display = 'none';
  }

  get visible(): boolean {
    return this._visible;
  }

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.onMouseUp);
    this.canvas.remove();
  }
}
