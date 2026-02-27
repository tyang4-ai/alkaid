import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialHash } from '../SpatialHash';

describe('SpatialHash', () => {
  let hash: SpatialHash;

  beforeEach(() => {
    hash = new SpatialHash(64);
  });

  it('insert and queryNear returns correct IDs', () => {
    hash.insert(1, 100, 100);
    hash.insert(2, 110, 110);
    const result = hash.queryNear(100, 100);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('update moves unit between cells', () => {
    hash.insert(1, 10, 10); // cell (0,0)
    // queryNear at old position finds it
    expect(hash.queryNear(10, 10)).toContain(1);

    hash.update(1, 200, 200); // cell (3,3)
    // No longer in old cell area
    expect(hash.queryNear(10, 10)).not.toContain(1);
    // Found in new cell area
    expect(hash.queryNear(200, 200)).toContain(1);
  });

  it('remove makes unit invisible to queries', () => {
    hash.insert(1, 50, 50);
    expect(hash.queryNear(50, 50)).toContain(1);

    hash.remove(1);
    expect(hash.queryNear(50, 50)).not.toContain(1);
  });

  it('queryRadius filters by actual distance', () => {
    const positions = new Map<number, { x: number; y: number }>();
    hash.insert(1, 100, 100);
    positions.set(1, { x: 100, y: 100 });
    hash.insert(2, 110, 100);
    positions.set(2, { x: 110, y: 100 });
    hash.insert(3, 100, 160); // far away but same near-cells possible
    positions.set(3, { x: 100, y: 160 });

    const result = hash.queryRadius(100, 100, 15, positions);
    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).not.toContain(3);
  });

  it('adjacent-cell queries span grid boundaries', () => {
    // Place unit just past cell boundary
    hash.insert(1, 63, 63);  // cell (0,0)
    hash.insert(2, 65, 65);  // cell (1,1)

    // Query near the boundary should find both
    const result = hash.queryNear(63, 63);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('empty query returns empty array', () => {
    expect(hash.queryNear(500, 500)).toEqual([]);
  });

  it('handles multiple units in same cell', () => {
    hash.insert(1, 10, 10);
    hash.insert(2, 20, 20);
    hash.insert(3, 30, 30);
    // All in cell (0,0) since cellSize=64
    const result = hash.queryNear(10, 10);
    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(3);
  });

  it('clear() empties all cells', () => {
    hash.insert(1, 10, 10);
    hash.insert(2, 200, 200);
    hash.clear();
    expect(hash.queryNear(10, 10)).toEqual([]);
    expect(hash.queryNear(200, 200)).toEqual([]);
  });
});
