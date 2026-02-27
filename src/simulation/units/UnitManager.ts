import type { Unit } from './Unit';
import type { UnitType } from '../../constants';
import {
  UnitState, UnitType as UT, UNIT_TYPE_CONFIGS, OrderType,
  PATH_ARRIVAL_THRESHOLD, TILE_SIZE, SIM_TICK_RATE,
  CHARGE_SPEED_MULT, CHARGE_FATIGUE_PER_TICK,
  DISENGAGE_SPEED_PENALTY, DISENGAGE_PENALTY_TICKS,
  ROUT_SPEED_MULTIPLIER,
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
  isGeneral?: boolean;
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
    const isGeneral = opts.isGeneral ?? (opts.type === UT.GENERAL);
    const isElite = opts.type === UT.ELITE_GUARD;
    const morale = opts.morale ?? (isGeneral ? 90 : isElite ? 85 : 70);

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

      // Command (Step 7)
      isGeneral,
      pendingOrderType: null,
      pendingOrderTick: 0,

      // Combat (Step 8)
      attackCooldown: 0,
      lastAttackTick: 0,
      hasCharged: false,
      combatTargetId: -1,
      combatTicks: 0,
      siegeSetupTicks: 0,

      // Order effects
      formUpTicks: 0,
      disengageTicks: 0,
      orderModifier: null,
      routTicks: 0,
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

  getAllArray(): Unit[] {
    return [...this.units.values()];
  }

  getByTeam(team: number): Unit[] {
    const result: Unit[] = [];
    for (const unit of this.units.values()) {
      if (unit.team === team) result.push(unit);
    }
    return result;
  }

  getGeneral(team: number): Unit | undefined {
    for (const unit of this.units.values()) {
      if (unit.team === team && unit.isGeneral && unit.state !== UnitState.DEAD) {
        return unit;
      }
    }
    return undefined;
  }

  tick(_dt: number, pathManager?: PathManager, orderManager?: OrderManager): void {
    for (const unit of this.units.values()) {
      unit.prevX = unit.x;
      unit.prevY = unit.y;

      if (!pathManager || !orderManager) continue;
      if (unit.state === UnitState.DEAD) continue;

      // Decrement disengage penalty ticks
      if (unit.disengageTicks > 0) unit.disengageTicks--;

      // Routing units flee toward nearest map edge
      if (unit.state === UnitState.ROUTING) {
        if (unit.routTicks > 0) unit.routTicks--;
        this.moveRouting(unit);
        continue;
      }

      const order = orderManager.getOrder(unit.id);
      if (!order) continue;

      // Handle order-specific state
      switch (order.type) {
        case OrderType.HOLD:
          unit.state = UnitState.DEFENDING;
          unit.orderModifier = OrderType.HOLD;
          continue; // No movement

        case OrderType.FORM_UP:
          if (unit.formUpTicks > 0) {
            unit.formUpTicks--;
            unit.state = UnitState.DEFENDING;
            continue;
          }
          // Form up complete — apply bonuses, stay in place
          unit.orderModifier = OrderType.FORM_UP;
          unit.state = UnitState.DEFENDING;
          continue;

        case OrderType.RALLY:
          // Rally is handled by MoraleSystem, unit stays in place
          unit.state = UnitState.IDLE;
          continue;

        case OrderType.DISENGAGE:
          unit.disengageTicks = DISENGAGE_PENALTY_TICKS;
          unit.combatTargetId = -1;
          unit.combatTicks = 0;
          unit.orderModifier = OrderType.DISENGAGE;
          // Fall through to movement
          break;

        case OrderType.CHARGE:
          unit.orderModifier = OrderType.CHARGE;
          unit.fatigue = Math.min(100, unit.fatigue + CHARGE_FATIGUE_PER_TICK / SIM_TICK_RATE);
          break;

        default:
          unit.orderModifier = null;
          break;
      }

      // Movement orders (MOVE, ATTACK, RETREAT, FLANK, CHARGE, DISENGAGE)
      if (order.targetX === undefined || order.targetY === undefined) continue;

      const dx = order.targetX - unit.x;
      const dy = order.targetY - unit.y;
      if (dx * dx + dy * dy < PATH_ARRIVAL_THRESHOLD * PATH_ARRIVAL_THRESHOLD) {
        unit.state = UnitState.IDLE;
        orderManager.clearOrder(unit.id);
        unit.path = null;
        unit.orderModifier = null;
        continue;
      }

      // Calculate speed multiplier from order effects
      let speedMult = 1.0;
      if (order.type === OrderType.CHARGE) speedMult = CHARGE_SPEED_MULT;
      if (unit.disengageTicks > 0) speedMult *= (1.0 - DISENGAGE_SPEED_PENALTY);

      this.moveUnit(unit, order, pathManager, speedMult);
    }
  }

  private moveUnit(
    unit: Unit,
    order: { targetX?: number; targetY?: number },
    pathManager: PathManager,
    speedMult: number,
  ): void {
    const tx = order.targetX ?? unit.x;
    const ty = order.targetY ?? unit.y;
    const dx = tx - unit.x;
    const dy = ty - unit.y;

    let moveVec = pathManager.getMovementVector(unit);
    if (!moveVec) {
      const directDist = Math.sqrt(dx * dx + dy * dy);
      if (directDist > PATH_ARRIVAL_THRESHOLD && directDist < TILE_SIZE * 2) {
        moveVec = { dx: dx / directDist, dy: dy / directDist };
      } else {
        pathManager.requestPath(unit, tx, ty);
        return;
      }
    }

    const config = UNIT_TYPE_CONFIGS[unit.type];
    const speedPixelsPerTick = (config.speed * speedMult * TILE_SIZE) / SIM_TICK_RATE;
    unit.x += moveVec.dx * speedPixelsPerTick;
    unit.y += moveVec.dy * speedPixelsPerTick;
    unit.state = UnitState.MOVING;
    unit.facing = Math.atan2(moveVec.dy, moveVec.dx);
  }

  private moveRouting(unit: Unit): void {
    // Flee toward nearest map edge
    const config = UNIT_TYPE_CONFIGS[unit.type];
    const speed = (config.speed * ROUT_SPEED_MULTIPLIER * TILE_SIZE) / SIM_TICK_RATE;

    // Find nearest edge direction
    // Use facing as flee direction (already set when rout triggered)
    unit.x += Math.cos(unit.facing) * speed;
    unit.y += Math.sin(unit.facing) * speed;
  }

  clear(): void {
    this.units.clear();
    this.nextId = 1;
    eventBus.emit('units:cleared', undefined);
  }
}
