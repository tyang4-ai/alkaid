// Web Worker for off-thread pathfinding.
// This is bundled independently by Vite.

import type { WorkerInMsg, WorkerOutMsg } from './pathfinding.types';
import {
  getMoveCost, PATH_DIAGONAL_COST, PATH_MAX_LENGTH, TILE_SIZE,
} from '../constants';
import type { UnitType, TerrainType } from '../constants';

let terrainData: Uint8Array | null = null;
let mapWidth = 0;
let mapHeight = 0;

/** Get terrain type at tile coords from flat array. */
function getTerrain(tx: number, ty: number): TerrainType {
  return terrainData![ty * mapWidth + tx] as TerrainType;
}

// 8-directional offsets
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const IS_DIAGONAL = [false, true, false, true, false, true, false, true];
const REVERSE_DIR = [4, 5, 6, 7, 0, 1, 2, 3];
const MIN_COST = 0.5;

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (Math.max(dx, dy) + (PATH_DIAGONAL_COST - 1) * Math.min(dx, dy)) * MIN_COST;
}

/** A* pathfinding — same algorithm as AStar.ts but operates on flat terrain array. */
function findPathWorker(
  startTX: number, startTY: number,
  goalTX: number, goalTY: number,
  unitType: UnitType,
): { found: boolean; path: Array<{ x: number; y: number }>; nodesExplored: number } {
  const w = mapWidth;
  const h = mapHeight;

  if (startTX === goalTX && startTY === goalTY) {
    return { found: true, path: [], nodesExplored: 0 };
  }

  if (goalTX < 0 || goalTX >= w || goalTY < 0 || goalTY >= h) {
    return { found: false, path: [], nodesExplored: 0 };
  }
  if (getMoveCost(unitType, getTerrain(goalTX, goalTY)) < 0) {
    return { found: false, path: [], nodesExplored: 0 };
  }

  const size = w * h;
  const gScore = new Float32Array(size).fill(Infinity);
  const fScore = new Float32Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const visited = new Uint8Array(size);

  const startIdx = startTY * w + startTX;
  const goalIdx = goalTY * w + goalTX;

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(startTX, startTY, goalTX, goalTY);

  const open: number[] = [startIdx];
  let nodesExplored = 0;

  while (open.length > 0 && nodesExplored < PATH_MAX_LENGTH) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[bestIdx]]) bestIdx = i;
    }
    const currentIdx = open[bestIdx];
    open[bestIdx] = open[open.length - 1];
    open.pop();

    if (currentIdx === goalIdx) {
      return { found: true, path: reconstructPath(parent, goalIdx, w), nodesExplored };
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

      const moveCost = getMoveCost(unitType, getTerrain(nx, ny));
      if (moveCost < 0) continue;

      if (IS_DIAGONAL[dir]) {
        if (getMoveCost(unitType, getTerrain(cx + DX[dir], cy)) < 0 ||
            getMoveCost(unitType, getTerrain(cx, cy + DY[dir])) < 0) continue;
      }

      const stepCost = moveCost * (IS_DIAGONAL[dir] ? PATH_DIAGONAL_COST : 1.0);
      const tentativeG = gScore[currentIdx] + stepCost;

      if (tentativeG < gScore[nIdx]) {
        parent[nIdx] = currentIdx;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic(nx, ny, goalTX, goalTY);
        open.push(nIdx);
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
  if (tilePath.length > 0) tilePath.shift();
  return tilePath;
}

/** Dijkstra flow field. */
function computeFlowFieldWorker(
  targetTX: number, targetTY: number,
  unitType: UnitType,
): { directions: Int8Array; costs: Float32Array; width: number; height: number; targetTileX: number; targetTileY: number } {
  const w = mapWidth;
  const h = mapHeight;
  const size = w * h;

  const costs = new Float32Array(size).fill(Infinity);
  const directions = new Int8Array(size).fill(-1);

  const targetIdx = targetTY * w + targetTX;
  costs[targetIdx] = 0;
  directions[targetIdx] = -2;

  const queue: number[] = [targetIdx];
  const visited = new Uint8Array(size);

  while (queue.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (costs[queue[i]] < costs[queue[bestIdx]]) bestIdx = i;
    }
    const currentIdx = queue[bestIdx];
    queue[bestIdx] = queue[queue.length - 1];
    queue.pop();

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

      const moveCost = getMoveCost(unitType, getTerrain(nx, ny));
      if (moveCost < 0) continue;

      if (IS_DIAGONAL[dir]) {
        if (getMoveCost(unitType, getTerrain(cx + DX[dir], cy)) < 0 ||
            getMoveCost(unitType, getTerrain(cx, cy + DY[dir])) < 0) continue;
      }

      const stepCost = moveCost * (IS_DIAGONAL[dir] ? PATH_DIAGONAL_COST : 1.0);
      const newCost = costs[currentIdx] + stepCost;

      if (newCost < costs[nIdx]) {
        costs[nIdx] = newCost;
        directions[nIdx] = REVERSE_DIR[dir];
        queue.push(nIdx);
      }
    }
  }

  return { directions, costs, width: w, height: h, targetTileX: targetTX, targetTileY: targetTY };
}

// Worker message handler
// eslint-disable-next-line no-restricted-globals
(self as any).onmessage = (e: MessageEvent<WorkerInMsg>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    terrainData = msg.terrain;
    mapWidth = msg.width;
    mapHeight = msg.height;
    return;
  }

  if (!terrainData) {
    const errorMsg: WorkerOutMsg = { type: 'error', id: (msg as any).id ?? 0, message: 'Terrain not initialized' };
    (self as any).postMessage(errorMsg);
    return;
  }

  if (msg.type === 'pathRequest') {
    try {
      const result = findPathWorker(
        msg.startTX, msg.startTY,
        msg.goalTX, msg.goalTY,
        msg.unitType as UnitType,
      );
      const response: WorkerOutMsg = {
        type: 'pathResult',
        id: msg.id,
        found: result.found,
        path: result.path,
        nodesExplored: result.nodesExplored,
      };
      (self as any).postMessage(response);
    } catch (err) {
      const errorMsg: WorkerOutMsg = { type: 'error', id: msg.id, message: String(err) };
      (self as any).postMessage(errorMsg);
    }
  }

  if (msg.type === 'flowRequest') {
    try {
      const result = computeFlowFieldWorker(
        msg.targetTX, msg.targetTY,
        msg.unitType as UnitType,
      );
      const response: WorkerOutMsg = {
        type: 'flowResult',
        id: msg.id,
        directions: result.directions,
        costs: result.costs,
        width: result.width,
        height: result.height,
        targetTileX: result.targetTileX,
        targetTileY: result.targetTileY,
      };
      (self as any).postMessage(response, { transfer: [result.directions.buffer, result.costs.buffer] });
    } catch (err) {
      const errorMsg: WorkerOutMsg = { type: 'error', id: msg.id, message: String(err) };
      (self as any).postMessage(errorMsg);
    }
  }
};
