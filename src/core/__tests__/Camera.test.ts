import { describe, it, expect, beforeEach } from 'vitest';
import { Camera } from '../Camera';

// Map: 3200x2400 world pixels (200*16 x 150*16), viewport: 1920x1080
const MAP_W = 3200;
const MAP_H = 2400;
const VP_W = 1920;
const VP_H = 1080;

describe('Camera', () => {
  let cam: Camera;

  beforeEach(() => {
    cam = new Camera(MAP_W, MAP_H, VP_W, VP_H);
  });

  // --- Initialization ---

  describe('Initialization', () => {
    it('starts centered on the map', () => {
      expect(cam.targetX).toBe(MAP_W / 2);
      expect(cam.targetY).toBe(MAP_H / 2);
      expect(cam.targetZoom).toBe(1);
    });

    it('snap() sets current = target immediately', () => {
      cam.pan(100, 50);
      cam.snap();
      expect(cam.x).toBe(cam.targetX);
      expect(cam.y).toBe(cam.targetY);
      expect(cam.zoom).toBe(cam.targetZoom);
    });
  });

  // --- Pan ---

  describe('Pan', () => {
    it('pan() moves target position by delta', () => {
      const startX = cam.targetX;
      const startY = cam.targetY;
      cam.pan(100, -50);
      expect(cam.targetX).toBe(startX + 100);
      expect(cam.targetY).toBe(startY - 50);
    });

    it('moveTo() sets absolute target position', () => {
      cam.moveTo(1000, 800);
      expect(cam.targetX).toBe(1000);
      expect(cam.targetY).toBe(800);
    });
  });

  // --- Lerp ---

  describe('Lerp / update()', () => {
    it('update() moves current toward target', () => {
      cam.snap();
      cam.pan(500, 0);
      const beforeX = cam.x;
      cam.update(16.667);
      expect(cam.x).toBeGreaterThan(beforeX);
      expect(cam.x).toBeLessThan(cam.targetX);
    });

    it('eventually converges after many updates', () => {
      cam.snap();
      cam.pan(200, 200);
      for (let i = 0; i < 300; i++) cam.update(16.667);
      expect(cam.x).toBe(cam.targetX);
      expect(cam.y).toBe(cam.targetY);
    });

    it('is frame-rate independent (similar result for different dt)', () => {
      // Two cameras diverge from center by the same amount
      const camA = new Camera(MAP_W, MAP_H, VP_W, VP_H);
      const camB = new Camera(MAP_W, MAP_H, VP_W, VP_H);
      camA.snap();
      camB.snap();
      camA.pan(500, 0);
      camB.pan(500, 0);

      // A: 60 frames at ~16.667ms
      for (let i = 0; i < 60; i++) camA.update(16.667);
      // B: 30 frames at ~33.333ms (same total time)
      for (let i = 0; i < 30; i++) camB.update(33.333);

      expect(Math.abs(camA.x - camB.x)).toBeLessThan(1);
    });
  });

  // --- Bounds ---

  describe('Bounds clamping', () => {
    it('cannot pan past left edge', () => {
      cam.snap();
      cam.pan(-99999, 0);
      const halfView = VP_W / (2 * cam.targetZoom);
      expect(cam.targetX).toBe(halfView);
    });

    it('cannot pan past right edge', () => {
      cam.snap();
      cam.pan(99999, 0);
      const halfView = VP_W / (2 * cam.targetZoom);
      expect(cam.targetX).toBe(MAP_W - halfView);
    });

    it('cannot pan past top edge', () => {
      cam.snap();
      cam.pan(0, -99999);
      const halfView = VP_H / (2 * cam.targetZoom);
      expect(cam.targetY).toBe(halfView);
    });

    it('cannot pan past bottom edge', () => {
      cam.snap();
      cam.pan(0, 99999);
      const halfView = VP_H / (2 * cam.targetZoom);
      expect(cam.targetY).toBe(MAP_H - halfView);
    });

    it('centers when viewport > map at current zoom', () => {
      // Zoom out so much that the viewport covers the whole map
      // At zoom 0.25, viewport in world = 1920/0.25 = 7680 > 3200
      cam = new Camera(MAP_W, MAP_H, VP_W, VP_H);
      // Directly force a low zoom by zooming out many times
      for (let i = 0; i < 30; i++) {
        cam.zoomAt(-0.15, VP_W / 2, VP_H / 2);
      }
      expect(cam.targetX).toBe(MAP_W / 2);
      // Y axis: viewport in world = 1080/0.25 = 4320 > 2400, so also centered
      expect(cam.targetY).toBe(MAP_H / 2);
    });
  });

  // --- Zoom ---

  describe('Zoom', () => {
    it('zoomAt() changes targetZoom', () => {
      cam.snap();
      cam.zoomAt(0.15, VP_W / 2, VP_H / 2);
      expect(cam.targetZoom).toBeGreaterThan(1);
    });

    it('clamps zoom to minimum', () => {
      cam.snap();
      for (let i = 0; i < 50; i++) cam.zoomAt(-0.15, VP_W / 2, VP_H / 2);
      expect(cam.targetZoom).toBe(0.25);
    });

    it('clamps zoom to maximum', () => {
      cam.snap();
      for (let i = 0; i < 50; i++) cam.zoomAt(0.15, VP_W / 2, VP_H / 2);
      expect(cam.targetZoom).toBe(3.0);
    });

    it('anchors zoom at cursor position (world point stays)', () => {
      cam.snap();
      // Place cursor at specific screen position
      const screenX = 400;
      const screenY = 300;
      const worldBefore = cam.screenToWorld(screenX, screenY);
      cam.zoomAt(0.15, screenX, screenY);
      cam.snap(); // snap so current = target
      const worldAfter = cam.screenToWorld(screenX, screenY);
      expect(Math.abs(worldBefore.x - worldAfter.x)).toBeLessThan(0.5);
      expect(Math.abs(worldBefore.y - worldAfter.y)).toBeLessThan(0.5);
    });
  });

  // --- Coordinate conversion ---

  describe('Coordinate conversion', () => {
    it('screenToWorld at zoom 1 (centered)', () => {
      cam.snap();
      // Center of screen = center of map
      const world = cam.screenToWorld(VP_W / 2, VP_H / 2);
      expect(world.x).toBeCloseTo(MAP_W / 2, 1);
      expect(world.y).toBeCloseTo(MAP_H / 2, 1);
    });

    it('screenToWorld at zoom 2', () => {
      cam.snap();
      cam.zoomAt(1.0, VP_W / 2, VP_H / 2); // double zoom (centered)
      cam.snap();
      // Center should still be map center
      const world = cam.screenToWorld(VP_W / 2, VP_H / 2);
      expect(world.x).toBeCloseTo(MAP_W / 2, 1);
      expect(world.y).toBeCloseTo(MAP_H / 2, 1);
    });

    it('round-trip consistency: screenToWorld -> worldToScreen', () => {
      cam.snap();
      const sx = 500;
      const sy = 400;
      const world = cam.screenToWorld(sx, sy);
      const screen = cam.worldToScreen(world.x, world.y);
      expect(screen.x).toBeCloseTo(sx, 5);
      expect(screen.y).toBeCloseTo(sy, 5);
    });

    it('round-trip at non-1 zoom', () => {
      cam.snap();
      cam.zoomAt(0.5, VP_W / 2, VP_H / 2);
      cam.snap();
      const sx = 1200;
      const sy = 700;
      const world = cam.screenToWorld(sx, sy);
      const screen = cam.worldToScreen(world.x, world.y);
      expect(screen.x).toBeCloseTo(sx, 3);
      expect(screen.y).toBeCloseTo(sy, 3);
    });
  });

  // --- Viewport ---

  describe('Viewport', () => {
    it('setViewport() updates dimensions', () => {
      cam.setViewport(800, 600);
      expect(cam.viewportWidth).toBe(800);
      expect(cam.viewportHeight).toBe(600);
    });

    it('setViewport() re-clamps target', () => {
      cam.moveTo(100, 100);
      cam.snap();
      // Make viewport huge so it forces centering
      cam.setViewport(MAP_W * 4, MAP_H * 4);
      expect(cam.targetX).toBe(MAP_W / 2);
      expect(cam.targetY).toBe(MAP_H / 2);
    });
  });

  // --- getState ---

  describe('getState()', () => {
    it('returns current state object', () => {
      cam.snap();
      const state = cam.getState();
      expect(state.x).toBe(cam.x);
      expect(state.y).toBe(cam.y);
      expect(state.zoom).toBe(cam.zoom);
      expect(state.targetX).toBe(cam.targetX);
      expect(state.targetY).toBe(cam.targetY);
      expect(state.targetZoom).toBe(cam.targetZoom);
    });
  });
});
