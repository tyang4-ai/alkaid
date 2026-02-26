import { Camera } from './Camera';
import {
  CAMERA_PAN_SPEED,
  CAMERA_EDGE_SCROLL_ZONE,
  CAMERA_ZOOM_SPEED,
  CAMERA_DRAG_DEAD_ZONE,
} from '../constants';

/**
 * DOM event handler. Binds keyboard/mouse/wheel events, calls Camera methods.
 */
export class InputManager {
  private camera: Camera;
  private canvas: HTMLCanvasElement;

  private keysDown = new Set<string>();
  private _mouseX = 0;
  private _mouseY = 0;
  private middleButtonDown = false;
  private dragLastX = 0;
  private dragLastY = 0;

  // Left-click drag state (dead zone distinguishes click from drag)
  private leftButtonDown = false;
  private leftDragging = false;
  private leftDownX = 0;
  private leftDownY = 0;
  private leftDragLastX = 0;
  private leftDragLastY = 0;

  // Bound handlers for removal
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private handleMouseMove: (e: MouseEvent) => void;
  private handleMouseDown: (e: MouseEvent) => void;
  private handleMouseUp: (e: MouseEvent) => void;
  private handleWheel: (e: WheelEvent) => void;
  private handleContextMenu: (e: Event) => void;
  private handleResize: () => void;
  private handleBlur: () => void;

  constructor(camera: Camera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;

    // Bind all handlers
    this.handleKeyDown = this.onKeyDown.bind(this);
    this.handleKeyUp = this.onKeyUp.bind(this);
    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleMouseDown = this.onMouseDown.bind(this);
    this.handleMouseUp = this.onMouseUp.bind(this);
    this.handleWheel = this.onWheel.bind(this);
    this.handleContextMenu = (e: Event) => e.preventDefault();
    this.handleResize = this.onResize.bind(this);
    this.handleBlur = () => this.keysDown.clear();

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('blur', this.handleBlur);
  }

  /** Called every render frame. Handles keyboard + edge scroll panning. */
  update(dtMs: number): void {
    let dx = 0;
    let dy = 0;

    // WASD / arrow keys
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) dy -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) dy += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) dx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) dx += 1;

    // Edge scrolling
    const vw = this.camera.viewportWidth;
    const vh = this.camera.viewportHeight;
    const zone = CAMERA_EDGE_SCROLL_ZONE;

    if (this._mouseX < zone) dx -= 1;
    if (this._mouseX > vw - zone) dx += 1;
    if (this._mouseY < zone) dy -= 1;
    if (this._mouseY > vh - zone) dy += 1;

    // Normalize diagonal to unit length
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    if (dx !== 0 || dy !== 0) {
      const speed = CAMERA_PAN_SPEED * (dtMs / 1000);
      // Speed scales inversely with zoom so panning feels consistent
      this.camera.pan(
        dx * speed / this.camera.zoom,
        dy * speed / this.camera.zoom,
      );
    }
  }

  // --- Public utilities ---

  isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  getMouseScreenPos(): { x: number; y: number } {
    return { x: this._mouseX, y: this._mouseY };
  }

  /** True when the user is actively left-click dragging (past dead zone). */
  get isDragging(): boolean {
    return this.leftDragging;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('blur', this.handleBlur);
  }

  // --- Private event handlers ---

  private static readonly GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space',
  ]);

  private onKeyDown(e: KeyboardEvent): void {
    if (InputManager.GAME_KEYS.has(e.code)) e.preventDefault();
    this.keysDown.add(e.code);
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code);
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this._mouseX = e.clientX - rect.left;
    this._mouseY = e.clientY - rect.top;

    // Middle-click drag
    if (this.middleButtonDown) {
      const dx = e.clientX - this.dragLastX;
      const dy = e.clientY - this.dragLastY;
      this.camera.pan(-dx / this.camera.zoom, -dy / this.camera.zoom);
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
    }

    // Left-click drag (with dead zone)
    if (this.leftButtonDown) {
      if (!this.leftDragging) {
        const dx = e.clientX - this.leftDownX;
        const dy = e.clientY - this.leftDownY;
        if (dx * dx + dy * dy > CAMERA_DRAG_DEAD_ZONE * CAMERA_DRAG_DEAD_ZONE) {
          this.leftDragging = true;
          this.leftDragLastX = e.clientX;
          this.leftDragLastY = e.clientY;
        }
      } else {
        const dx = e.clientX - this.leftDragLastX;
        const dy = e.clientY - this.leftDragLastY;
        this.camera.pan(-dx / this.camera.zoom, -dy / this.camera.zoom);
        this.leftDragLastX = e.clientX;
        this.leftDragLastY = e.clientY;
      }
    }
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      // Left click — start potential drag
      this.leftButtonDown = true;
      this.leftDragging = false;
      this.leftDownX = e.clientX;
      this.leftDownY = e.clientY;
    } else if (e.button === 1) {
      // Middle click
      this.middleButtonDown = true;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
      e.preventDefault();
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      // TODO Step 5: if !leftDragging, this was a click — handle unit selection
      this.leftButtonDown = false;
      this.leftDragging = false;
    } else if (e.button === 1) {
      this.middleButtonDown = false;
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * CAMERA_ZOOM_SPEED;
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    this.camera.zoomAt(delta, screenX, screenY);
  }

  private onResize(): void {
    this.camera.setViewport(window.innerWidth, window.innerHeight);
  }
}
