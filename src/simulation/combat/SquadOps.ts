import type { Unit } from '../units/Unit';
import type { UnitManager } from '../units/UnitManager';
import { eventBus } from '../../core/EventBus';
import {
  UNIT_TYPE_CONFIGS, UnitState,
  COMBINE_THRESHOLD, SPLIT_MORALE_PENALTY,
} from '../../constants';

/** Check if two squads can be combined. */
export function canCombine(a: Unit, b: Unit): boolean {
  if (a.type !== b.type) return false;
  if (a.team !== b.team) return false;
  if (a.state === UnitState.DEAD || b.state === UnitState.DEAD) return false;
  if (a.state === UnitState.ROUTING || b.state === UnitState.ROUTING) return false;

  const aStrength = a.size / a.maxSize;
  const bStrength = b.size / b.maxSize;
  return aStrength < COMBINE_THRESHOLD && bStrength < COMBINE_THRESHOLD;
}

/** Combine two squads. Survivor keeps the bigger squad's ID. */
export function combineSquads(survivor: Unit, absorbed: Unit): void {
  const cfg = UNIT_TYPE_CONFIGS[survivor.type];
  const totalSize = Math.min(survivor.size + absorbed.size, cfg.maxSize);

  // Weighted-average stats
  const totalPop = survivor.size + absorbed.size;
  survivor.morale = (survivor.morale * survivor.size + absorbed.morale * absorbed.size) / totalPop;
  survivor.fatigue = (survivor.fatigue * survivor.size + absorbed.fatigue * absorbed.size) / totalPop;
  survivor.experience = Math.round(
    (survivor.experience * survivor.size + absorbed.experience * absorbed.size) / totalPop,
  );

  survivor.size = totalSize;
  survivor.hp = totalSize * cfg.hpPerSoldier;

  // Mark absorbed as dead
  absorbed.size = 0;
  absorbed.hp = 0;
  absorbed.state = UnitState.DEAD;

  eventBus.emit('unit:combined', { survivorId: survivor.id, absorbedId: absorbed.id });
}

/** Split a squad in half. Returns the new unit. */
export function splitSquad(unit: Unit, unitManager: UnitManager): Unit | null {
  if (unit.size < 2) return null;

  const halfSize = Math.floor(unit.size / 2);
  const cfg = UNIT_TYPE_CONFIGS[unit.type];

  // Reduce original
  unit.size -= halfSize;
  unit.hp = unit.size * cfg.hpPerSoldier;
  unit.morale = Math.max(0, unit.morale - SPLIT_MORALE_PENALTY);

  // Spawn new unit at slight offset
  const newUnit = unitManager.spawn({
    type: unit.type,
    team: unit.team,
    x: unit.x + 16,
    y: unit.y + 16,
    size: halfSize,
    experience: unit.experience,
    morale: Math.max(0, unit.morale - SPLIT_MORALE_PENALTY),
  });

  eventBus.emit('unit:split', { originalId: unit.id, newId: newUnit.id });
  return newUnit;
}
