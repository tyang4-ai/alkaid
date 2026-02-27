import { TerrainGrid } from '../terrain/TerrainGrid';
import { getMoveCost, PATH_DIAGONAL_COST, PATH_MAX_LENGTH, TILE_SIZE } from '../../constants';
import type { UnitType } from '../../constants';

export interface PathResult {
  found: boolean;
  path: Array<{ x: number; y: number }>;  // world-pixel waypoints
  nodesExplored: number;
}

// 8-directional offsets: N, NE, E, SE, S, SW, W, NW
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const IS_DIAGONAL = [false, true, false, true, false, true, false, true];

// Minimum possible terrain cost (roads = 0.5) for admissible heuristic
const MIN_COST = 0.5;

class MinHeap {
  private data: number[] = [];
  private positions: Int32Array;
  private fScore: Float32Array;

  constructor(size: number, fScore: Float32Array) {
    this.positions = new Int32Array(size).fill(-1);
    this.fScore = fScore;
  }

  get size(): number {
    return this.data.length;
  }

  push(nodeIndex: number): void {
    const pos = this.data.length;
    this.data.push(nodeIndex);
    this.positions[nodeIndex] = pos;
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

  decreaseKey(nodeIndex: number): void {
    const pos = this.positions[nodeIndex];
    if (pos !== -1) {
      this.bubbleUp(pos);
    }
  }

  contains(nodeIndex: number): boolean {
    return this.positions[nodeIndex] !== -1;
  }

  private bubbleUp(pos: number): void {
    while (pos > 0) {
      const parentPos = (pos - 1) >> 1;
      if (this.fScore[this.data[pos]] < this.fScore[this.data[parentPos]]) {
        this.swap(pos, parentPos);
        pos = parentPos;
      } else {
        break;
      }
    }
  }

  private sinkDown(pos: number): void {
    const length = this.data.length;
    while (true) {
      let smallest = pos;
      const left = 2 * pos + 1;
      const right = 2 * pos + 2;
      if (left < length && this.fScore[this.data[left]] < this.fScore[this.data[smallest]]) {
        smallest = left;
      }
      if (right < length && this.fScore[this.data[right]] < this.fScore[this.data[smallest]]) {
        smallest = right;
      }
      if (smallest !== pos) {
        this.swap(pos, smallest);
        pos = smallest;
      } else {
        break;
      }
    }
  }

  private swap(a: number, b: number): void {
    const nodeA = this.data[a];
    const nodeB = this.data[b];
    this.data[a] = nodeB;
    this.data[b] = nodeA;
    this.positions[nodeA] = b;
    this.positions[nodeB] = a;
  }
}

/** Octile distance heuristic, scaled by minimum terrain cost to stay admissible. */
function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (Math.max(dx, dy) + (PATH_DIAGONAL_COST - 1) * Math.min(dx, dy)) * MIN_COST;
}

export function findPath(
  grid: TerrainGrid,
  startTileX: number, startTileY: number,
  goalTileX: number, goalTileY: number,
  unitType: UnitType,
  maxNodes: number = PATH_MAX_LENGTH,
): PathResult {
  const w = grid.width;
  const h = grid.height;

  // Same tile
  if (startTileX === goalTileX && startTileY === goalTileY) {
    return { found: true, path: [], nodesExplored: 0 };
  }

  // Check goal is walkable
  if (goalTileX < 0 || goalTileX >= w || goalTileY < 0 || goalTileY >= h) {
    return { found: false, path: [], nodesExplored: 0 };
  }
  const goalTerrain = grid.getTerrain(goalTileX, goalTileY);
  if (getMoveCost(unitType, goalTerrain) < 0) {
    return { found: false, path: [], nodesExplored: 0 };
  }

  const size = w * h;
  const gScore = new Float32Array(size).fill(Infinity);
  const fScore = new Float32Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const visited = new Uint8Array(size);

  const startIdx = startTileY * w + startTileX;
  const goalIdx = goalTileY * w + goalTileX;

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(startTileX, startTileY, goalTileX, goalTileY);

  const heap = new MinHeap(size, fScore);
  heap.push(startIdx);

  let nodesExplored = 0;

  while (heap.size > 0 && nodesExplored < maxNodes) {
    const currentIdx = heap.pop();
    if (currentIdx === goalIdx) {
      return {
        found: true,
        path: reconstructPath(parent, goalIdx, w),
        nodesExplored,
      };
    }

    if (visited[currentIdx]) continue;
    visited[currentIdx] = 1;
    nodesExplored++;

    const cx = currentIdx % w;
    const cy = (currentIdx - cx) / w;

    for (let dir = 0; dir < 8; dir++) {
      const nx = cx + DX[dir];
      const ny = cy + DY[dir];

      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

      const nIdx = ny * w + nx;
      if (visited[nIdx]) continue;

      const terrainType = grid.getTerrain(nx, ny);
      const moveCost = getMoveCost(unitType, terrainType);
      if (moveCost < 0) continue; // impassable

      // Corner-cutting prevention for diagonal moves
      if (IS_DIAGONAL[dir]) {
        const adj1Terrain = grid.getTerrain(cx + DX[dir], cy);
        const adj2Terrain = grid.getTerrain(cx, cy + DY[dir]);
        if (getMoveCost(unitType, adj1Terrain) < 0 || getMoveCost(unitType, adj2Terrain) < 0) {
          continue;
        }
      }

      const stepCost = moveCost * (IS_DIAGONAL[dir] ? PATH_DIAGONAL_COST : 1.0);
      const tentativeG = gScore[currentIdx] + stepCost;

      if (tentativeG < gScore[nIdx]) {
        parent[nIdx] = currentIdx;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic(nx, ny, goalTileX, goalTileY);

        if (heap.contains(nIdx)) {
          heap.decreaseKey(nIdx);
        } else {
          heap.push(nIdx);
        }
      }
    }
  }

  return { found: false, path: [], nodesExplored };
}

function reconstructPath(parent: Int32Array, goalIdx: number, width: number): Array<{ x: number; y: number }> {
  const tilePath: Array<{ x: number; y: number }> = [];
  let idx = goalIdx;
  while (idx !== -1) {
    const tx = idx % width;
    const ty = (idx - tx) / width;
    tilePath.push({
      x: tx * TILE_SIZE + TILE_SIZE / 2,
      y: ty * TILE_SIZE + TILE_SIZE / 2,
    });
    idx = parent[idx];
  }
  tilePath.reverse();
  // Remove start position (unit is already there)
  if (tilePath.length > 0) tilePath.shift();
  return tilePath;
}
