import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../Random';

describe('SeededRandom', () => {
  it('produces deterministic output for same seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different output for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() returns values in [0, 1)', () => {
    const rng = new SeededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt returns values in inclusive range', () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('nextFloat returns values in [min, max)', () => {
    const rng = new SeededRandom(77);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextFloat(2.0, 5.0);
      expect(v).toBeGreaterThanOrEqual(2.0);
      expect(v).toBeLessThan(5.0);
    }
  });
});
