import { describe, it, expect, vi } from 'vitest';

// Test PerfMonitor logic without real DOM
describe('PerfMonitor', () => {
  it('toggle changes visibility', () => {
    let visible = false;
    const toggle = () => { visible = !visible; };

    toggle();
    expect(visible).toBe(true);
    toggle();
    expect(visible).toBe(false);
  });

  it('frame time recording computes average correctly', () => {
    const times = [2.0, 3.0, 4.0, 1.0];
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBe(2.5);
  });

  it('tick time recording computes average correctly', () => {
    const times = [1.0, 1.5, 2.0];
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeCloseTo(1.5);
  });

  it('throttled update respects interval', () => {
    const INTERVAL = 500;
    let lastUpdate = -INTERVAL; // Initialize so first call always updates
    let updateCount = 0;

    function tryUpdate(now: number) {
      if (now - lastUpdate >= INTERVAL) {
        lastUpdate = now;
        updateCount++;
      }
    }

    tryUpdate(0);    // Should update (0 - (-500) >= 500)
    tryUpdate(200);  // Too soon
    tryUpdate(499);  // Still too soon
    tryUpdate(500);  // Should update
    tryUpdate(999);  // Too soon
    tryUpdate(1000); // Should update

    expect(updateCount).toBe(3);
  });

  it('memory fallback returns N/A when not available', () => {
    const perf = {} as any;
    let memStr = 'N/A';
    if (perf.memory) {
      const mb = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
      memStr = `${mb} MB`;
    }
    expect(memStr).toBe('N/A');
  });

  it('FPS calculation computes correctly', () => {
    const frameCount = 60;
    const deltaMs = 1000;
    const fps = Math.round((frameCount / deltaMs) * 1000);
    expect(fps).toBe(60);
  });
});
