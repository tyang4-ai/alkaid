import { describe, it, expect } from 'vitest';
import { ContourGenerator } from '../ContourGenerator';

describe('ContourGenerator', () => {
  it('generates no contours for flat terrain', () => {
    const elev = new Float32Array(16).fill(0.5);
    const segs = ContourGenerator.generate(elev, 4, 4);
    expect(segs.length).toBe(0);
  });

  it('generates contours for a gradient', () => {
    const w = 10, h = 5;
    const elev = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        elev[y * w + x] = x / (w - 1);
      }
    }
    const segs = ContourGenerator.generate(elev, w, h);
    expect(segs.length).toBeGreaterThan(0);
  });

  it('marks major contours correctly', () => {
    const w = 20, h = 5;
    const elev = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        elev[y * w + x] = x / (w - 1);
      }
    }
    const segs = ContourGenerator.generate(elev, w, h);
    const majors = segs.filter(s => s.isMajor);
    const minors = segs.filter(s => !s.isMajor);
    expect(majors.length).toBeGreaterThan(0);
    expect(minors.length).toBeGreaterThan(0);
  });

  it('contour segments have valid coordinates', () => {
    const w = 10, h = 10;
    const elev = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        elev[y * w + x] = (x + y) / (w + h - 2);
      }
    }
    const segs = ContourGenerator.generate(elev, w, h);
    for (const s of segs) {
      expect(s.x1).toBeGreaterThanOrEqual(0);
      expect(s.y1).toBeGreaterThanOrEqual(0);
      expect(s.x2).toBeLessThanOrEqual(w);
      expect(s.y2).toBeLessThanOrEqual(h);
    }
  });
});
