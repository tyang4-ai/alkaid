import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CAMERA_PAN_SPEED, CAMERA_ZOOM_SPEED } from '../../constants';

// Minimal mock Camera
function createMockCamera() {
  return {
    pan: vi.fn(),
    zoomAt: vi.fn(),
    setViewport: vi.fn(),
    screenToWorld: vi.fn((_sx: number, _sy: number) => ({ x: 0, y: 0 })),
    zoom: 1,
    viewportWidth: 1920,
    viewportHeight: 1080,
  };
}

// Minimal mock canvas
function createMockCanvas() {
  const listeners: Record<string, Function[]> = {};
  return {
    addEventListener: vi.fn((event: string, fn: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    }),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }),
    _fire(event: string, data: any) {
      (listeners[event] || []).forEach(fn => fn(data));
    },
  };
}

describe('InputManager', () => {
  let mockCamera: ReturnType<typeof createMockCamera>;
  let mockCanvas: ReturnType<typeof createMockCanvas>;
  let input: any; // InputManager
  const windowListeners: Record<string, Function[]> = {};

  let origAddEL: any;
  let origRemoveEL: any;

  beforeEach(async () => {
    mockCamera = createMockCamera();
    mockCanvas = createMockCanvas();

    // Ensure window exists in Node
    if (typeof globalThis.window === 'undefined') {
      (globalThis as any).window = globalThis;
    }

    origAddEL = window.addEventListener;
    origRemoveEL = window.removeEventListener;

    // Intercept window.addEventListener
    window.addEventListener = vi.fn((event: string, fn: Function) => {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(fn);
    }) as any;
    window.removeEventListener = vi.fn() as any;

    // Dynamic import to ensure window shim is in place
    const { InputManager } = await import('../InputManager');
    input = new InputManager(mockCamera as any, mockCanvas as any);

    // Move mouse to center to avoid edge-scroll triggering in default state
    mockCanvas._fire('mousemove', { clientX: 960, clientY: 540 });
    mockCamera.pan.mockClear();
  });

  afterEach(() => {
    window.addEventListener = origAddEL;
    window.removeEventListener = origRemoveEL;
    for (const key of Object.keys(windowListeners)) delete windowListeners[key];
  });

  function fireWindowEvent(event: string, data: any) {
    (windowListeners[event] || []).forEach(fn => fn(data));
  }

  it('tracks keydown and keyup state', () => {
    fireWindowEvent('keydown', { code: 'KeyW', preventDefault: vi.fn() });
    expect(input.isKeyDown('KeyW')).toBe(true);

    fireWindowEvent('keyup', { code: 'KeyW' });
    expect(input.isKeyDown('KeyW')).toBe(false);
  });

  it('update() calls camera.pan when W is held', () => {
    fireWindowEvent('keydown', { code: 'KeyW', preventDefault: vi.fn() });
    input.update(1000);
    expect(mockCamera.pan).toHaveBeenCalled();
    const [, dy] = mockCamera.pan.mock.calls[0];
    expect(dy).toBeLessThan(0); // W = up = negative Y
  });

  it('update() does not call pan when no keys are held', () => {
    input.update(16.667);
    expect(mockCamera.pan).not.toHaveBeenCalled();
  });

  it('normalizes diagonal movement', () => {
    fireWindowEvent('keydown', { code: 'KeyW', preventDefault: vi.fn() });
    fireWindowEvent('keydown', { code: 'KeyD', preventDefault: vi.fn() });
    input.update(1000);
    expect(mockCamera.pan).toHaveBeenCalled();
    const [dx, dy] = mockCamera.pan.mock.calls[0];
    const expectedMag = CAMERA_PAN_SPEED / mockCamera.zoom;
    const actualMag = Math.sqrt(dx * dx + dy * dy);
    expect(actualMag).toBeCloseTo(expectedMag, 0);
  });

  it('wheel event calls camera.zoomAt', () => {
    mockCanvas._fire('wheel', {
      deltaY: -120,
      clientX: 500,
      clientY: 300,
      preventDefault: vi.fn(),
    });
    expect(mockCamera.zoomAt).toHaveBeenCalledWith(
      CAMERA_ZOOM_SPEED,
      500,
      300,
    );
  });

  it('wheel event zooms out for positive deltaY', () => {
    mockCanvas._fire('wheel', {
      deltaY: 120,
      clientX: 500,
      clientY: 300,
      preventDefault: vi.fn(),
    });
    expect(mockCamera.zoomAt).toHaveBeenCalledWith(
      -CAMERA_ZOOM_SPEED,
      500,
      300,
    );
  });

  it('middle-click drag pans with inverted delta', () => {
    mockCanvas._fire('mousedown', { button: 1, clientX: 500, clientY: 400, preventDefault: vi.fn() });
    mockCanvas._fire('mousemove', { clientX: 520, clientY: 410 });
    expect(mockCamera.pan).toHaveBeenCalled();
    const [dx, dy] = mockCamera.pan.mock.calls[0];
    expect(dx).toBeCloseTo(-20 / mockCamera.zoom);
    expect(dy).toBeCloseTo(-10 / mockCamera.zoom);
  });

  it('middle-click release stops dragging', () => {
    mockCanvas._fire('mousedown', { button: 1, clientX: 500, clientY: 400, preventDefault: vi.fn() });
    fireWindowEvent('mouseup', { button: 1 });
    mockCamera.pan.mockClear();
    mockCanvas._fire('mousemove', { clientX: 600, clientY: 500 });
    expect(mockCamera.pan).not.toHaveBeenCalled();
  });

  it('blur clears all keys', () => {
    fireWindowEvent('keydown', { code: 'KeyW', preventDefault: vi.fn() });
    fireWindowEvent('keydown', { code: 'KeyA', preventDefault: vi.fn() });
    expect(input.isKeyDown('KeyW')).toBe(true);
    fireWindowEvent('blur', {});
    expect(input.isKeyDown('KeyW')).toBe(false);
    expect(input.isKeyDown('KeyA')).toBe(false);
  });

  it('destroy() calls removeEventListener', () => {
    input.destroy();
    expect(mockCanvas.removeEventListener).toHaveBeenCalled();
    expect(window.removeEventListener).toHaveBeenCalled();
  });

  it('getMouseScreenPos() returns tracked mouse position', () => {
    mockCanvas._fire('mousemove', { clientX: 123, clientY: 456 });
    const pos = input.getMouseScreenPos();
    expect(pos.x).toBe(123);
    expect(pos.y).toBe(456);
  });

  // --- Left-click drag ---

  it('left-click small movement (within dead zone) does not pan', () => {
    mockCanvas._fire('mousedown', { button: 0, clientX: 500, clientY: 400 });
    mockCanvas._fire('mousemove', { clientX: 503, clientY: 402 }); // 3.6px < 5px
    expect(mockCamera.pan).not.toHaveBeenCalled();
    expect(input.isDragging).toBe(false);
  });

  it('left-click drag past dead zone starts panning', () => {
    mockCanvas._fire('mousedown', { button: 0, clientX: 500, clientY: 400 });
    // Move past dead zone (>5px)
    mockCanvas._fire('mousemove', { clientX: 510, clientY: 400 }); // 10px > 5px
    expect(input.isDragging).toBe(true);
    // Next move should pan
    mockCanvas._fire('mousemove', { clientX: 530, clientY: 410 });
    expect(mockCamera.pan).toHaveBeenCalled();
    const [dx, dy] = mockCamera.pan.mock.calls[0];
    expect(dx).toBeCloseTo(-20 / mockCamera.zoom);
    expect(dy).toBeCloseTo(-10 / mockCamera.zoom);
  });

  it('left-click release resets drag state', () => {
    mockCanvas._fire('mousedown', { button: 0, clientX: 500, clientY: 400 });
    mockCanvas._fire('mousemove', { clientX: 520, clientY: 400 }); // past dead zone
    expect(input.isDragging).toBe(true);
    fireWindowEvent('mouseup', { button: 0 });
    expect(input.isDragging).toBe(false);
    // Further movement should not pan
    mockCamera.pan.mockClear();
    mockCanvas._fire('mousemove', { clientX: 550, clientY: 400 });
    expect(mockCamera.pan).not.toHaveBeenCalled();
  });
});
