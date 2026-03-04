import { Camera } from './Camera';
import { eventBus } from './EventBus';
import {
  CAMERA_PAN_SPEED,
  CAMERA_EDGE_SCROLL_ZONE,
  CAMERA_ZOOM_SPEED,
  CAMERA_DRAG_DEAD_ZONE,
} from '../constants';

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
  /** Set true to prevent left-drag from panning the camera (e.g. during deployment drag). */
  suppressLeftDrag = false;
  private leftDownX = 0;
  private leftDownY = 0;
  private leftDragLastX = 0;
  private leftDragLastY = 0;

  // Right-click drag state
  private rightButtonDown = false;
  private rightDragging = false;
  private rightDownX = 0;
  private rightDownY = 0;

  // Ctrl+drag box-select state
  private ctrlBoxSelecting = false;
  private boxStartScreenX = 0;
  private boxStartScreenY = 0;
  private _boxRect: { x1: number; y1: number; x2: number; y2: number } | null = null;

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

    this.handleKeyDown = this.onKeyDown.bind(this);
    this.handleKeyUp = this.onKeyUp.bind(this);
    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleMouseDown = this.onMouseDown.bind(this);
    this.handleMouseUp = this.onMouseUp.bind(this);
    this.handleWheel = this.onWheel.bind(this);
    this.handleContextMenu = (e: Event) => e.preventDefault();
    this.handleResize = this.onResize.bind(this);
    this.handleBlur = () => {
      this.keysDown.clear();
      this.ctrlBoxSelecting = false;
      this._boxRect = null;
    };

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

  update(dtMs: number): void {
    let dx = 0;
    let dy = 0;

    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) dy -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) dy += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) dx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) dx += 1;

    const vw = this.camera.viewportWidth;
    const vh = this.camera.viewportHeight;
    const zone = CAMERA_EDGE_SCROLL_ZONE;

    if (this._mouseX < zone) dx -= 1;
    if (this._mouseX > vw - zone) dx += 1;
    if (this._mouseY < zone) dy -= 1;
    if (this._mouseY > vh - zone) dy += 1;

    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    if (dx !== 0 || dy !== 0) {
      const speed = CAMERA_PAN_SPEED * (dtMs / 1000);
      this.camera.pan(
        dx * speed / this.camera.zoom,
        dy * speed / this.camera.zoom,
      );
    }
  }

  isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  getMouseScreenPos(): { x: number; y: number } {
    return { x: this._mouseX, y: this._mouseY };
  }

  get isDragging(): boolean {
    return this.leftDragging;
  }

  get boxSelectRect() {
    return this._boxRect;
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

  private static readonly GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'Escape',
  ]);

  private onKeyDown(e: KeyboardEvent): void {
    if (InputManager.GAME_KEYS.has(e.code)) e.preventDefault();
    this.keysDown.add(e.code);
    // Escape handling moved to HotkeyManager (Step 10)
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

    // Right-click drag
    if (this.rightButtonDown) {
      const rdx = e.clientX - this.rightDownX;
      const rdy = e.clientY - this.rightDownY;
      if (!this.rightDragging && rdx * rdx + rdy * rdy > CAMERA_DRAG_DEAD_ZONE * CAMERA_DRAG_DEAD_ZONE) {
        this.rightDragging = true;
        const world = this.camera.screenToWorld(this._mouseX, this._mouseY);
        eventBus.emit('input:rightDragStart', {
          worldX: world.x, worldY: world.y,
          screenX: this._mouseX, screenY: this._mouseY,
        });
      }
      if (this.rightDragging) {
        const world = this.camera.screenToWorld(this._mouseX, this._mouseY);
        eventBus.emit('input:rightDragMove', {
          worldX: world.x, worldY: world.y,
          screenX: this._mouseX, screenY: this._mouseY,
        });
      }
    }

    // Left-click drag
    if (this.leftButtonDown) {
      const dx = e.clientX - this.leftDownX;
      const dy = e.clientY - this.leftDownY;
      const pastDeadZone = dx * dx + dy * dy > CAMERA_DRAG_DEAD_ZONE * CAMERA_DRAG_DEAD_ZONE;

      if (this.ctrlBoxSelecting) {
        // Box-select mode: update screen-space rect for renderer
        if (pastDeadZone) {
          this._boxRect = {
            x1: this.boxStartScreenX,
            y1: this.boxStartScreenY,
            x2: this._mouseX,
            y2: this._mouseY,
          };
        }
      } else if (!this.suppressLeftDrag) {
        // Camera pan mode (skipped when suppressLeftDrag is set, e.g. deployment drag)
        if (!this.leftDragging) {
          if (pastDeadZone) {
            this.leftDragging = true;
            this.leftDragLastX = e.clientX;
            this.leftDragLastY = e.clientY;
          }
        } else {
          const moveDx = e.clientX - this.leftDragLastX;
          const moveDy = e.clientY - this.leftDragLastY;
          this.camera.pan(-moveDx / this.camera.zoom, -moveDy / this.camera.zoom);
          this.leftDragLastX = e.clientX;
          this.leftDragLastY = e.clientY;
        }
      }
    }
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.leftButtonDown = true;
      this.leftDragging = false;
      this.leftDownX = e.clientX;
      this.leftDownY = e.clientY;

      // Emit mouseDown for deployment sidebar drag initiation
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = this.camera.screenToWorld(screenX, screenY);
      eventBus.emit('input:mouseDown', { screenX, screenY, worldX: world.x, worldY: world.y });

      if (e.ctrlKey) {
        this.ctrlBoxSelecting = true;
        this.boxStartScreenX = screenX;
        this.boxStartScreenY = screenY;
      } else {
        this.ctrlBoxSelecting = false;
      }
    } else if (e.button === 1) {
      this.middleButtonDown = true;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
      e.preventDefault();
    } else if (e.button === 2) {
      this.rightButtonDown = true;
      this.rightDragging = false;
      this.rightDownX = e.clientX;
      this.rightDownY = e.clientY;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      if (this.ctrlBoxSelecting && this._boxRect) {
        // Box-select complete: convert screen rect to world coords
        const topLeft = this.camera.screenToWorld(this._boxRect.x1, this._boxRect.y1);
        const bottomRight = this.camera.screenToWorld(this._boxRect.x2, this._boxRect.y2);
        eventBus.emit('input:boxSelect', {
          x1: topLeft.x, y1: topLeft.y,
          x2: bottomRight.x, y2: bottomRight.y,
        });
      } else if (!this.leftDragging && !this.ctrlBoxSelecting) {
        // Click (no drag): emit click event
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.camera.screenToWorld(screenX, screenY);
        eventBus.emit('input:click', {
          worldX: world.x, worldY: world.y,
          screenX, screenY,
          shift: e.shiftKey,
        });
      }

      this.leftButtonDown = false;
      this.leftDragging = false;
      this.ctrlBoxSelecting = false;
      this._boxRect = null;
    } else if (e.button === 1) {
      this.middleButtonDown = false;
    } else if (e.button === 2) {
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = this.camera.screenToWorld(screenX, screenY);

      if (this.rightDragging) {
        // Right-drag end: emit drag end event
        eventBus.emit('input:rightDragEnd', {
          worldX: world.x, worldY: world.y,
          screenX, screenY, shift: e.shiftKey,
        });
      } else {
        // Quick right-click (no drag): emit click event
        eventBus.emit('input:rightClick', {
          worldX: world.x, worldY: world.y,
          screenX, screenY,
        });
      }

      this.rightButtonDown = false;
      this.rightDragging = false;
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
