import {
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_LERP_FACTOR,
} from '../constants';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}

/**
 * Pure data + math camera. No PixiJS, no DOM — fully testable in Node.
 * Position (x, y) represents the world-space center of the viewport.
 */
export class Camera {
  // Current interpolated values (what's rendered)
  private _x: number;
  private _y: number;
  private _zoom: number;

  // Lerp targets
  private _targetX: number;
  private _targetY: number;
  private _targetZoom: number;

  // World bounds (pixels)
  private _mapWidth: number;
  private _mapHeight: number;

  // Screen dimensions
  private _viewportWidth: number;
  private _viewportHeight: number;

  constructor(
    mapWidth: number,
    mapHeight: number,
    viewportWidth: number,
    viewportHeight: number,
  ) {
    this._mapWidth = mapWidth;
    this._mapHeight = mapHeight;
    this._viewportWidth = viewportWidth;
    this._viewportHeight = viewportHeight;

    // Start centered on the map
    const cx = mapWidth / 2;
    const cy = mapHeight / 2;
    this._targetX = cx;
    this._targetY = cy;
    this._targetZoom = 1;
    this._x = cx;
    this._y = cy;
    this._zoom = 1;

    this.clampTarget();
  }

  // --- Public readonly accessors ---

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get zoom(): number { return this._zoom; }
  get targetX(): number { return this._targetX; }
  get targetY(): number { return this._targetY; }
  get targetZoom(): number { return this._targetZoom; }
  get viewportWidth(): number { return this._viewportWidth; }
  get viewportHeight(): number { return this._viewportHeight; }

  // --- Movement ---

  /** Add delta to target position (world pixels). */
  pan(dx: number, dy: number): void {
    this._targetX += dx;
    this._targetY += dy;
    this.clampTarget();
  }

  /** Set absolute target position (world pixels). */
  moveTo(worldX: number, worldY: number): void {
    this._targetX = worldX;
    this._targetY = worldY;
    this.clampTarget();
  }

  /** Instantly set current = target (no interpolation). */
  snap(): void {
    this.clampTarget();
    this._x = this._targetX;
    this._y = this._targetY;
    this._zoom = this._targetZoom;
  }

  // --- Zoom ---

  /**
   * Zoom toward/away from a screen-space anchor point.
   * `delta` is typically ±CAMERA_ZOOM_SPEED.
   * The world point under the cursor stays under the cursor after zoom.
   */
  zoomAt(delta: number, anchorScreenX: number, anchorScreenY: number): void {
    const oldZoom = this._targetZoom;
    const newZoom = clamp(
      oldZoom * (1 + delta),
      CAMERA_ZOOM_MIN,
      CAMERA_ZOOM_MAX,
    );
    if (newZoom === oldZoom) return;

    // Anchor math: keep world point under cursor stationary
    const screenOffsetX = anchorScreenX - this._viewportWidth / 2;
    const screenOffsetY = anchorScreenY - this._viewportHeight / 2;
    const worldAnchorX = this._targetX + screenOffsetX / oldZoom;
    const worldAnchorY = this._targetY + screenOffsetY / oldZoom;

    this._targetZoom = newZoom;
    this._targetX = worldAnchorX - screenOffsetX / newZoom;
    this._targetY = worldAnchorY - screenOffsetY / newZoom;
    this.clampTarget();
  }

  // --- Per-frame update ---

  /**
   * Frame-rate independent lerp.
   * factor = 1 - (1 - LERP_FACTOR) ^ (dt / 16.667)
   * Snaps when residual < 0.01px / 0.0001 zoom.
   */
  update(dtMs: number): void {
    const t = 1 - Math.pow(1 - CAMERA_LERP_FACTOR, dtMs / 16.667);

    this._x += (this._targetX - this._x) * t;
    this._y += (this._targetY - this._y) * t;
    this._zoom += (this._targetZoom - this._zoom) * t;

    // Snap when close enough
    if (Math.abs(this._targetX - this._x) < 0.01) this._x = this._targetX;
    if (Math.abs(this._targetY - this._y) < 0.01) this._y = this._targetY;
    if (Math.abs(this._targetZoom - this._zoom) < 0.0001) this._zoom = this._targetZoom;
  }

  // --- Coordinate conversion ---

  /** Convert screen coordinates to world coordinates. */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: this._x + (screenX - this._viewportWidth / 2) / this._zoom,
      y: this._y + (screenY - this._viewportHeight / 2) / this._zoom,
    };
  }

  /** Convert world coordinates to screen coordinates. */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this._x) * this._zoom + this._viewportWidth / 2,
      y: (worldY - this._y) * this._zoom + this._viewportHeight / 2,
    };
  }

  // --- Viewport ---

  /** Update viewport dimensions (call on window resize). */
  setViewport(width: number, height: number): void {
    this._viewportWidth = width;
    this._viewportHeight = height;
    this.clampTarget();
  }

  // --- State ---

  getState(): CameraState {
    return {
      x: this._x,
      y: this._y,
      zoom: this._zoom,
      targetX: this._targetX,
      targetY: this._targetY,
      targetZoom: this._targetZoom,
    };
  }

  // --- Private ---

  /**
   * Ensure viewport never extends beyond map edges.
   * If viewport is larger than map at current zoom, center on that axis.
   */
  private clampTarget(): void {
    const halfViewW = this._viewportWidth / (2 * this._targetZoom);
    const halfViewH = this._viewportHeight / (2 * this._targetZoom);

    if (halfViewW * 2 >= this._mapWidth) {
      this._targetX = this._mapWidth / 2;
    } else {
      this._targetX = clamp(this._targetX, halfViewW, this._mapWidth - halfViewW);
    }

    if (halfViewH * 2 >= this._mapHeight) {
      this._targetY = this._mapHeight / 2;
    } else {
      this._targetY = clamp(this._targetY, halfViewH, this._mapHeight - halfViewH);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
