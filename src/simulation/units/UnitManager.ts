import type { Unit } from './Unit';
import type { UnitType } from '../../constants';
import { UnitState, UNIT_TYPE_CONFIGS } from '../../constants';
import { eventBus } from '../../core/EventBus';

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

  /** Save previous positions for interpolation. Movement logic added in Step 6. */
  tick(_dt: number): void {
    for (const unit of this.units.values()) {
      unit.prevX = unit.x;
      unit.prevY = unit.y;
    }
  }

  clear(): void {
    this.units.clear();
    this.nextId = 1;
    eventBus.emit('units:cleared', undefined);
  }
}
