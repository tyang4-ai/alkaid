import { findPath } from './AStar';
import { computeFlowField, sampleFlowField } from './FlowField';
import type { FlowFieldResult } from './FlowField';
import { SpatialHash } from './SpatialHash';
import { TerrainGrid } from '../terrain/TerrainGrid';
import type { Unit } from '../units/Unit';
import {
  PATH_MAX_COMPUTATIONS_PER_TICK, PATH_CACHE_TTL_TICKS,
  FLOW_FIELD_GROUP_THRESHOLD, FLOW_FIELD_TARGET_SNAP,
  PATH_ARRIVAL_THRESHOLD, TILE_SIZE,
} from '../../constants';
import type { UnitType } from '../../constants';

interface PathRequest {
  unitId: number;
  unitType: UnitType;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  unit: Unit;
}

interface CachedFlowField {
  field: FlowFieldResult;
  unitType: UnitType;
  createdTick: number;
}

export class PathManager {
  private terrainGrid: TerrainGrid;
  readonly spatialHash: SpatialHash;
  private requestQueue: PathRequest[] = [];
  private flowFieldCache = new Map<string, CachedFlowField>();
  private unitFlowFields = new Map<number, FlowFieldResult>();

  constructor(terrainGrid: TerrainGrid) {
    this.terrainGrid = terrainGrid;
    this.spatialHash = new SpatialHash();
  }

  requestPath(unit: Unit, targetX: number, targetY: number): void {
    // Remove existing request for this unit
    const idx = this.requestQueue.findIndex(r => r.unitId === unit.id);
    if (idx !== -1) this.requestQueue.splice(idx, 1);

    this.requestQueue.push({
      unitId: unit.id,
      unitType: unit.type,
      fromX: unit.x,
      fromY: unit.y,
      toX: targetX,
      toY: targetY,
      unit,
    });
  }

  tick(currentTick: number): void {
    this.evictCache(currentTick);

    if (this.requestQueue.length === 0) return;

    // Group requests by snapped target tile and unit type
    const groups = new Map<string, PathRequest[]>();
    for (const req of this.requestQueue) {
      const snappedTX = Math.round(Math.floor(req.toX / TILE_SIZE) / FLOW_FIELD_TARGET_SNAP) * FLOW_FIELD_TARGET_SNAP;
      const snappedTY = Math.round(Math.floor(req.toY / TILE_SIZE) / FLOW_FIELD_TARGET_SNAP) * FLOW_FIELD_TARGET_SNAP;
      const key = `${snappedTX},${snappedTY},${req.unitType}`;
      let group = groups.get(key);
      if (!group) {
        group = [];
        groups.set(key, group);
      }
      group.push(req);
    }

    let budget = PATH_MAX_COMPUTATIONS_PER_TICK;
    const processed: PathRequest[] = [];

    for (const [groupKey, group] of groups) {
      if (budget <= 0) break;

      if (group.length >= FLOW_FIELD_GROUP_THRESHOLD) {
        // Flow field for the group (counts as 3 budget)
        if (budget < 3) break;

        const snappedParts = groupKey.split(',');
        const targetTileX = parseInt(snappedParts[0]);
        const targetTileY = parseInt(snappedParts[1]);

        // Check cache
        const cacheKey = this.flowFieldKey(targetTileX, targetTileY, group[0].unitType);
        let cached = this.flowFieldCache.get(cacheKey);
        if (!cached) {
          const field = computeFlowField(this.terrainGrid, targetTileX, targetTileY, group[0].unitType);
          cached = { field, unitType: group[0].unitType, createdTick: currentTick };
          this.flowFieldCache.set(cacheKey, cached);
          budget -= 3;
        }

        for (const req of group) {
          req.unit.path = null;
          this.unitFlowFields.set(req.unitId, cached.field);
          processed.push(req);
        }
      } else {
        // Individual A* paths
        for (const req of group) {
          if (budget <= 0) break;

          const startTX = Math.floor(req.fromX / TILE_SIZE);
          const startTY = Math.floor(req.fromY / TILE_SIZE);
          const goalTX = Math.floor(req.toX / TILE_SIZE);
          const goalTY = Math.floor(req.toY / TILE_SIZE);

          const result = findPath(
            this.terrainGrid,
            startTX, startTY,
            goalTX, goalTY,
            req.unitType,
          );

          if (result.found) {
            req.unit.path = result.path;
            req.unit.pathIndex = 0;
          } else {
            req.unit.path = null;
          }
          this.unitFlowFields.delete(req.unitId);

          budget--;
          processed.push(req);
        }
      }
    }

    // Remove processed from queue
    for (const req of processed) {
      const idx = this.requestQueue.indexOf(req);
      if (idx !== -1) this.requestQueue.splice(idx, 1);
    }
  }

  getMovementVector(unit: Unit): { dx: number; dy: number } | null {
    // Path-based movement
    if (unit.path && unit.pathIndex < unit.path.length) {
      const waypoint = unit.path[unit.pathIndex];
      const dx = waypoint.x - unit.x;
      const dy = waypoint.y - unit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PATH_ARRIVAL_THRESHOLD) {
        unit.pathIndex++;
        if (unit.pathIndex >= unit.path.length) {
          return null; // Arrived at end of path
        }
        // Recurse to get vector to next waypoint
        return this.getMovementVector(unit);
      }

      return { dx: dx / dist, dy: dy / dist };
    }

    // Flow field movement
    const flowField = this.unitFlowFields.get(unit.id);
    if (flowField) {
      return sampleFlowField(flowField, unit.x, unit.y);
    }

    return null;
  }

  updateSpatialHash(units: IterableIterator<Unit>): void {
    this.spatialHash.clear();
    for (const unit of units) {
      this.spatialHash.insert(unit.id, unit.x, unit.y);
    }
  }

  private evictCache(currentTick: number): void {
    for (const [key, cached] of this.flowFieldCache) {
      if (currentTick - cached.createdTick > PATH_CACHE_TTL_TICKS) {
        this.flowFieldCache.delete(key);
      }
    }
  }

  private flowFieldKey(tileX: number, tileY: number, unitType: UnitType): string {
    return `${tileX},${tileY},${unitType}`;
  }

  get pendingRequests(): number {
    return this.requestQueue.length;
  }

  clear(): void {
    this.requestQueue = [];
    this.flowFieldCache.clear();
    this.unitFlowFields.clear();
    this.spatialHash.clear();
  }
}
