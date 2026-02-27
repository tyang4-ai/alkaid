import type { Unit } from './Unit';
import type { UnitType } from '../../constants';
import {
  UnitState, UNIT_TYPE_CONFIGS, OrderType,
  PATH_ARRIVAL_THRESHOLD, TILE_SIZE, SIM_TICK_RATE,
} from '../../constants';
import { eventBus } from '../../core/EventBus';
import type { PathManager } from '../pathfinding/PathManager';
import type { OrderManager } from '../OrderManager';

export interface SpawnOptions {
  type: UnitType;
  team: number;
  x: number;
  y: number;
  size?: number;
  experience?: number;
  morale?: number;
}

export class UnitManager {
  private units = new Map<number, Unit>();
  private nextId = 1;

  get count(): number {
    return this.units.size;
  }

  spawn(opts: SpawnOptions): Unit {
    const config = UNIT_TYPE_CONFIGS[opts.type];
    const size = opts.size ?? config.maxSize;
    const isElite = opts.type === 8; // ELITE_GUARD
    const morale = opts.morale ?? (isElite ? 85 : 70);

    const unit: Unit = {
      id: this.nextId++,
      type: opts.type,
      team: opts.team,
      x: opts.x,
      y: opts.y,
      prevX: opts.x,
      prevY: opts.y,
      size,
      maxSize: config.maxSize,
      hp: size * config.hpPerSoldier,
      morale,
      fatigue: 0,
      supply: 100,
      experience: opts.experience ?? 0,
      state: UnitState.IDLE,
      facing: 0,
      path: null,
      pathIndex: 0,
      targetX: opts.x,
      targetY: opts.y,
    };

    this.units.set(unit.id, unit);
    eventBus.emit('unit:spawned', { id: unit.id, type: unit.type, team: unit.team });
    return unit;
  }

  destroy(id: number): boolean {
    const existed = this.units.delete(id);
    if (existed) {
      eventBus.emit('unit:destroyed', { id });
    }
    return existed;
  }

  get(id: number): Unit | undefined {
    return this.units.get(id);
  }

  getAll(): IterableIterator<Unit> {
    return this.units.values();
  }

  getByTeam(team: number): Unit[] {
    const result: Unit[] = [];
    for (const unit of this.units.values()) {
      if (unit.team === team) result.push(unit);
    }
    return result;
  }

  tick(_dt: number, pathManager?: PathManager, orderManager?: OrderManager): void {
    for (const unit of this.units.values()) {
      unit.prevX = unit.x;
      unit.prevY = unit.y;

      if (!pathManager || !orderManager) continue;
      if (unit.state === UnitState.DEAD || unit.state === UnitState.ROUTING) continue;

      const order = orderManager.getOrder(unit.id);
      if (!order || order.type !== OrderType.MOVE) continue;

      // Check arrival at final destination
      const dx = (order.targetX ?? unit.x) - unit.x;
      const dy = (order.targetY ?? unit.y) - unit.y;
      if (dx * dx + dy * dy < PATH_ARRIVAL_THRESHOLD * PATH_ARRIVAL_THRESHOLD) {
        unit.state = UnitState.IDLE;
        orderManager.clearOrder(unit.id);
        unit.path = null;
        continue;
      }

      // Get movement vector from PathManager
      let moveVec = pathManager.getMovementVector(unit);
      if (!moveVec) {
        // Last mile: if path exhausted but close to target, move directly
        const directDist = Math.sqrt(dx * dx + dy * dy);
        if (directDist > PATH_ARRIVAL_THRESHOLD && directDist < TILE_SIZE * 2) {
          moveVec = { dx: dx / directDist, dy: dy / directDist };
        } else {
          pathManager.requestPath(unit, order.targetX ?? unit.x, order.targetY ?? unit.y);
          continue;
        }
      }

      // Apply movement: speed in tiles/sec → pixels/tick
      const config = UNIT_TYPE_CONFIGS[unit.type];
      const speedPixelsPerTick = (config.speed * TILE_SIZE) / SIM_TICK_RATE;
      unit.x += moveVec.dx * speedPixelsPerTick;
      unit.y += moveVec.dy * speedPixelsPerTick;
      unit.state = UnitState.MOVING;
      unit.facing = Math.atan2(moveVec.dy, moveVec.dx);
    }
  }

  clear(): void {
    this.units.clear();
    this.nextId = 1;
    eventBus.emit('units:cleared', undefined);
  }
}
