import type { WorkerOutMsg } from './pathfinding.types';
import { WORKER_PATH_TIMEOUT_MS } from '../constants';
import type { UnitType } from '../constants';
import type { FlowFieldResult } from '../simulation/pathfinding/FlowField';

export interface WorkerPathResult {
  found: boolean;
  path: Array<{ x: number; y: number }>;
  nodesExplored: number;
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class PathWorkerClient {
  private worker: Worker;
  private pendingPaths = new Map<number, PendingRequest<WorkerPathResult>>();
  private pendingFlows = new Map<number, PendingRequest<FlowFieldResult>>();
  private nextId = 0;
  private _terminated = false;

  constructor() {
    this.worker = new Worker(
      new URL('./pathfinding.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.worker.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
      this.handleMessage(e.data);
    };
    this.worker.onerror = (e) => {
      console.error('[PathWorkerClient] Worker error:', e.message);
    };
  }

  initTerrain(terrain: Uint8Array, width: number, height: number): void {
    // Copy terrain data (Transferable would invalidate source)
    const copy = new Uint8Array(terrain);
    this.worker.postMessage(
      { type: 'init', width, height, terrain: copy },
      [copy.buffer],
    );
  }

  requestPath(
    unitType: UnitType,
    startTX: number, startTY: number,
    goalTX: number, goalTY: number,
  ): Promise<WorkerPathResult> {
    if (this._terminated) return Promise.reject(new Error('Worker terminated'));

    const id = this.nextId++;
    return new Promise<WorkerPathResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingPaths.delete(id);
        reject(new Error(`Path request ${id} timed out`));
      }, WORKER_PATH_TIMEOUT_MS);

      this.pendingPaths.set(id, { resolve, reject, timer });
      this.worker.postMessage({
        type: 'pathRequest', id, unitType, startTX, startTY, goalTX, goalTY,
      });
    });
  }

  requestFlowField(
    unitType: UnitType,
    targetTX: number, targetTY: number,
  ): Promise<FlowFieldResult> {
    if (this._terminated) return Promise.reject(new Error('Worker terminated'));

    const id = this.nextId++;
    return new Promise<FlowFieldResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingFlows.delete(id);
        reject(new Error(`Flow field request ${id} timed out`));
      }, WORKER_PATH_TIMEOUT_MS);

      this.pendingFlows.set(id, { resolve, reject, timer });
      this.worker.postMessage({
        type: 'flowRequest', id, unitType, targetTX, targetTY,
      });
    });
  }

  private handleMessage(msg: WorkerOutMsg): void {
    if (msg.type === 'pathResult') {
      const pending = this.pendingPaths.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingPaths.delete(msg.id);
        pending.resolve({
          found: msg.found,
          path: msg.path,
          nodesExplored: msg.nodesExplored,
        });
      }
    } else if (msg.type === 'flowResult') {
      const pending = this.pendingFlows.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingFlows.delete(msg.id);
        pending.resolve({
          directions: msg.directions,
          costs: msg.costs,
          width: msg.width,
          height: msg.height,
          targetTileX: msg.targetTileX,
          targetTileY: msg.targetTileY,
        });
      }
    } else if (msg.type === 'error') {
      // Check both pending maps
      const pendingPath = this.pendingPaths.get(msg.id);
      if (pendingPath) {
        clearTimeout(pendingPath.timer);
        this.pendingPaths.delete(msg.id);
        pendingPath.reject(new Error(msg.message));
        return;
      }
      const pendingFlow = this.pendingFlows.get(msg.id);
      if (pendingFlow) {
        clearTimeout(pendingFlow.timer);
        this.pendingFlows.delete(msg.id);
        pendingFlow.reject(new Error(msg.message));
      }
    }
  }

  get hasPending(): boolean {
    return this.pendingPaths.size > 0 || this.pendingFlows.size > 0;
  }

  terminate(): void {
    this._terminated = true;
    // Reject all pending
    for (const [, pending] of this.pendingPaths) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Worker terminated'));
    }
    this.pendingPaths.clear();
    for (const [, pending] of this.pendingFlows) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Worker terminated'));
    }
    this.pendingFlows.clear();
    this.worker.terminate();
  }
}
