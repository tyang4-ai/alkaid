import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameLoop } from '../GameLoop';

// Mock browser APIs not available in Node
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(performance.now()), 0) as unknown as number;
});
vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  clearTimeout(id);
});

describe('GameLoop', () => {
  let loop: GameLoop;
  beforeEach(() => {
    loop = new GameLoop();
  });
  afterEach(() => {
    loop.stop();
  });

  it('starts in stopped state', () => {
    expect(loop.running).toBe(false);
    expect(loop.paused).toBe(false);
  });

  it('reports running after start', () => {
    loop.start();
    expect(loop.running).toBe(true);
  });

  it('does not double-start', () => {
    loop.start();
    loop.start(); // Should not throw
    expect(loop.running).toBe(true);
  });

  it('stops cleanly', () => {
    loop.start();
    loop.stop();
    expect(loop.running).toBe(false);
  });

  it('clamps speed multiplier to valid range', () => {
    loop.setSpeed(10);
    expect(loop.speedMultiplier).toBe(4);
    loop.setSpeed(-1);
    expect(loop.speedMultiplier).toBe(0.25);
    loop.setSpeed(2);
    expect(loop.speedMultiplier).toBe(2);
  });

  it('togglePause switches state', () => {
    loop.start();
    expect(loop.paused).toBe(false);
    loop.togglePause();
    expect(loop.paused).toBe(true);
    loop.togglePause();
    expect(loop.paused).toBe(false);
  });

  it('pause does nothing when not running', () => {
    loop.pause();
    expect(loop.paused).toBe(false);
  });

  it('resume does nothing when not paused', () => {
    loop.start();
    loop.resume(); // Should not throw
    expect(loop.paused).toBe(false);
  });

  it('starts at tick 0', () => {
    expect(loop.currentTick).toBe(0);
  });

  it('starts at FPS 0', () => {
    expect(loop.currentFPS).toBe(0);
  });
});
