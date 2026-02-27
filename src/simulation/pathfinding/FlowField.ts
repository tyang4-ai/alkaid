import { TerrainGrid } from '../terrain/TerrainGrid';
import { getMoveCost, PATH_DIAGONAL_COST, TILE_SIZE } from '../../constants';
import type { UnitType } from '../../constants';

export interface FlowFieldResult {
  /** Direction at each tile: 0-7 for 8 directions, -1 for unreachable, -2 for target. */
  directions: Int8Array;
  costs: Float32Array;
  width: number;
  height: number;
  targetTileX: number;
  targetTileY: number;
}

// Direction encoding: 0=N(0,-1), 1=NE(1,-1), 2=E(1,0), 3=SE(1,1), 4=S(0,1), 5=SW(-1,1), 6=W(-1,0), 7=NW(-1,-1)
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const IS_DIAGONAL = [false, true, false, true, false, true, false, true];
// Reverse direction (for Dijkstra expanding outward, we need the direction TO the parent)
const REVERSE_DIR = [4, 5, 6, 7, 0, 1, 2, 3];

/** Simple min-heap for Dijkstra. */
class DijkstraHeap {
  private data: number[] = [];
  private positions: Int32Array;
  private costs: Float32Array;

  constructor(size: number, costs: Float32Array) {
    this.positions = new Int32Array(size).fill(-1);
    this.costs = costs;
  }

  get size(): number { return this.data.length; }

  push(idx: number): void {
    const pos = this.data.length;
    this.data.push(idx);
    this.positions[idx] = pos;
    this.bubbleUp(pos);
  }

  pop(): number {
    const top = this.data[0];
    this.positions[top] = -1;
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.positions[last] = 0;
      this.sinkDown(0);
    }
    return top;
  }

  decreaseKey(idx: number): void {
    const pos = this.positions[idx];
    if (pos !== -1) this.bubbleUp(pos);
  }

  contains(idx: number): boolean {
    return this.positions[idx] !== -1;
  }

  private bubbleUp(pos: number): void {
    while (pos > 0) {
      const parentPos = (pos - 1) >> 1;
      if (this.costs[this.data[pos]] < this.costs[this.data[parentPos]]) {
        this.swap(pos, parentPos);
        pos = parentPos;
      } else break;
    }
  }

  private sinkDown(pos: number): void {
    const len = this.data.length;
    while (true) {
      let smallest = pos;
      const l = 2 * pos + 1;
      const r = 2 * pos + 2;
      if (l < len && this.costs[this.data[l]] < this.costs[this.data[smallest]]) smallest = l;
      if (r < len && this.costs[this.data[r]] < this.costs[this.data[smallest]]) smallest = r;
      if (smallest !== pos) { this.swap(pos, smallest); pos = smallest; }
      else break;
    }
  }

  private swap(a: number, b: number): void {
    const na = this.data[a], nb = this.data[b];
    this.data[a] = nb; this.data[b] = na;
    this.positions[na] = b; this.positions[nb] = a;
  }
}

export function computeFlowField(
  grid: TerrainGrid,
  targetTileX: number, targetTileY: number,
  unitType: UnitType,
): FlowFieldResult {
  const w = grid.width;
  const h = grid.height;
  const size = w * h;

  const costs = new Float32Array(size).fill(Infinity);
  const directions = new Int8Array(size).fill(-1); // -1 = unreachable

  const targetIdx = targetTileY * w + targetTileX;
  costs[targetIdx] = 0;
  directions[targetIdx] = -2; // target marker

  const heap = new DijkstraHeap(size, costs);
  heap.push(targetIdx);

  const visited = new Uint8Array(size);

  while (heap.size > 0) {
    const currentIdx = heap.pop();
    if (visited[currentIdx]) continue;
    visited[currentIdx] = 1;

    const cx = currentIdx % w;
    const cy = (currentIdx - cx) / w;

    for (let dir = 0; dir < 8; dir++) {
      const nx = cx + DX[dir];
      const ny = cy + DY[dir];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

      const nIdx = ny * w + nx;
      if (visited[nIdx]) continue;

      // Cost to move FROM neighbor TO current (the neighbor wants to move toward target)
      const terrainAtNeighbor = grid.getTerrain(nx, ny);
      const moveCost = getMoveCost(unitType, terrainAtNeighbor);
      if (moveCost < 0) continue;

      // Corner-cutting prevention for diagonal
      if (IS_DIAGONAL[dir]) {
        const adj1 = grid.getTerrain(cx + DX[dir], cy);
        const adj2 = grid.getTerrain(cx, cy + DY[dir]);
        if (getMoveCost(unitType, adj1) < 0 || getMoveCost(unitType, adj2) < 0) continue;
      }

      const stepCost = moveCost * (IS_DIAGONAL[dir] ? PATH_DIAGONAL_COST : 1.0);
      const newCost = costs[currentIdx] + stepCost;

      if (newCost < costs[nIdx]) {
        costs[nIdx] = newCost;
        // Direction for the neighbor: it should move TOWARD current (reverse of expansion direction)
        directions[nIdx] = REVERSE_DIR[dir];

        if (heap.contains(nIdx)) {
          heap.decreaseKey(nIdx);
        } else {
          heap.push(nIdx);
        }
      }
    }
  }

  return { directions, costs, width: w, height: h, targetTileX, targetTileY };
}

/** Get direction vector for a unit at (worldX, worldY) to follow the flow field. */
export function sampleFlowField(
  field: FlowFieldResult,
  worldX: number, worldY: number,
): { dx: number; dy: number } | null {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);

  if (tileX < 0 || tileX >= field.width || tileY < 0 || tileY >= field.height) return null;

  const idx = tileY * field.width + tileX;
  const dir = field.directions[idx];

  if (dir < 0) return null; // -1 unreachable, -2 at target

  const rawDx = DX[dir];
  const rawDy = DY[dir];
  // Normalize diagonal vectors
  if (rawDx !== 0 && rawDy !== 0) {
    const inv = 1 / Math.SQRT2;
    return { dx: rawDx * inv, dy: rawDy * inv };
  }
  return { dx: rawDx, dy: rawDy };
}
