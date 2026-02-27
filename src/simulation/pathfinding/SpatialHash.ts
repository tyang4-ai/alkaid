import { SPATIAL_HASH_CELL_SIZE } from '../../constants';

export class SpatialHash {
  private cellSize: number;
  private cells = new Map<number, Set<number>>();  // cellKey -> Set of unit IDs
  private unitCells = new Map<number, number>();    // unitId -> cellKey

  constructor(cellSize: number = SPATIAL_HASH_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cy: number): number {
    return cy * 10000 + cx;
  }

  insert(id: number, x: number, y: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const k = this.key(cx, cy);

    let cell = this.cells.get(k);
    if (!cell) {
      cell = new Set();
      this.cells.set(k, cell);
    }
    cell.add(id);
    this.unitCells.set(id, k);
  }

  remove(id: number): void {
    const k = this.unitCells.get(id);
    if (k === undefined) return;
    const cell = this.cells.get(k);
    if (cell) {
      cell.delete(id);
      if (cell.size === 0) this.cells.delete(k);
    }
    this.unitCells.delete(id);
  }

  update(id: number, x: number, y: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const newKey = this.key(cx, cy);
    const oldKey = this.unitCells.get(id);

    if (oldKey === newKey) return; // same cell, no-op

    this.remove(id);
    this.insert(id, x, y);
  }

  /** Get all unit IDs in the same cell and adjacent cells (9-cell query). */
  queryNear(x: number, y: number): number[] {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const result: number[] = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const k = this.key(cx + dx, cy + dy);
        const cell = this.cells.get(k);
        if (cell) {
          for (const id of cell) {
            result.push(id);
          }
        }
      }
    }
    return result;
  }

  /** Get all unit IDs within a radius (post-filter by distance). */
  queryRadius(x: number, y: number, radius: number, positions: Map<number, { x: number; y: number }>): number[] {
    const r2 = radius * radius;
    const candidates = this.queryNear(x, y);
    const result: number[] = [];

    for (const id of candidates) {
      const pos = positions.get(id);
      if (!pos) continue;
      const dx = pos.x - x;
      const dy = pos.y - y;
      if (dx * dx + dy * dy <= r2) {
        result.push(id);
      }
    }
    return result;
  }

  clear(): void {
    this.cells.clear();
    this.unitCells.clear();
  }
}
