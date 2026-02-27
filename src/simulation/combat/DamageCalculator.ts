import type { Unit } from '../units/Unit';
import type { TerrainType } from '../../constants';
import {
  UNIT_TYPE_CONFIGS, TERRAIN_STATS,
  UnitType, getTypeMatchup, isRangedUnit, canFireWhileMoving,
  UnitState,
  DAO_SHIELD_ARROW_REDUCTION,
  CROSSBOW_VOLLEY_RANKS,
  FIRE_WHILE_MOVING_PENALTY,
  CAVALRY_CHARGE_BONUS_LIGHT,
  CAVALRY_CHARGE_BONUS_HEAVY,
  ROUT_DAMAGE_TAKEN_MULT,
} from '../../constants';

export interface DamageResult {
  finalDamage: number;
  soldiersKilled: number;
  isRanged: boolean;
  wasCharge: boolean;
}

/**
 * Pure damage calculation per the formula in ref-unit-stats.md:
 *
 * baseDamage = attacker.damage * (attackerSquadSize / attackerMaxSize)
 * typeMultiplier = TYPE_MATCHUP_TABLE[attacker.type][defender.type]
 * terrainMultiplier = TERRAIN_DEFENSE[defender.terrain]
 * armorReduction = max(0, defender.armor - attacker.armorPen)
 * fatigueMultiplier = 1 - (attacker.fatigue / 200)
 * experienceMultiplier = 1 + (attacker.experience - 50) * 0.003
 * finalDamage = baseDamage * typeMultiplier * terrainMultiplier * (1 - armorReduction/20) * fatigueMultiplier * experienceMultiplier
 * soldiersKilled = floor(finalDamage / defender.hpPerSoldier)
 */
export function calculateDamage(
  attacker: Unit,
  defender: Unit,
  defenderTerrain: TerrainType,
  attackerMoving: boolean,
): DamageResult {
  const aCfg = UNIT_TYPE_CONFIGS[attacker.type];
  const dCfg = UNIT_TYPE_CONFIGS[defender.type];
  const ranged = isRangedUnit(attacker.type);

  // Base damage scaled by squad strength
  let baseDamage = aCfg.damage * (attacker.size / attacker.maxSize);

  // Crossbow volley: only 1/3 fires per tick
  if (attacker.type === UnitType.NU_CROSSBOWMEN) {
    baseDamage /= CROSSBOW_VOLLEY_RANKS;
  }

  // Can't fire while moving (except Horse Archers at full, Gong Archers at -30%)
  if (ranged && attackerMoving) {
    if (!canFireWhileMoving(attacker.type)) {
      return { finalDamage: 0, soldiersKilled: 0, isRanged: true, wasCharge: false };
    }
    if (attacker.type === UnitType.GONG_ARCHERS) {
      baseDamage *= (1 - FIRE_WHILE_MOVING_PENALTY);
    }
    // Horse Archers: no penalty
  }

  // Type matchup
  const typeMultiplier = getTypeMatchup(attacker.type, defender.type);

  // Terrain defense bonus for defender
  const terrainDef = TERRAIN_STATS[defenderTerrain].defBonus;
  const terrainMultiplier = 1.0 / (1.0 + terrainDef); // Higher defBonus = less damage taken

  // Armor reduction
  const armorReduction = Math.max(0, dCfg.armor - aCfg.armorPen);
  const armorFactor = 1 - armorReduction / 20;

  // Fatigue: 50% fatigue = 75% damage
  const fatigueMult = 1 - (attacker.fatigue / 200);

  // Experience: ±15% at 0/100 exp
  const expMult = 1 + (attacker.experience - 50) * 0.003;

  // Cavalry charge bonus
  let chargeBonus = 1.0;
  let wasCharge = false;
  if (!attacker.hasCharged && attacker.combatTicks === 0) {
    if (attacker.type === UnitType.LIGHT_CAVALRY) {
      chargeBonus = CAVALRY_CHARGE_BONUS_LIGHT;
      wasCharge = true;
    } else if (attacker.type === UnitType.HEAVY_CAVALRY) {
      chargeBonus = CAVALRY_CHARGE_BONUS_HEAVY;
      wasCharge = true;
    }
  }

  // Dao shield: -30% from ranged attacks
  let shieldReduction = 1.0;
  if (ranged && defender.type === UnitType.DAO_SWORDSMEN) {
    shieldReduction = 1 - DAO_SHIELD_ARROW_REDUCTION;
  }

  // Routing defender takes extra damage
  let routingMult = 1.0;
  if (defender.state === UnitState.ROUTING) {
    routingMult = ROUT_DAMAGE_TAKEN_MULT;
  }

  // Hold defense bonus applied via orderModifier (checked externally)
  // Weather multiplier: not yet implemented (Step 9), defaults to 1.0

  const finalDamage = baseDamage
    * typeMultiplier
    * terrainMultiplier
    * armorFactor
    * fatigueMult
    * expMult
    * chargeBonus
    * shieldReduction
    * routingMult;

  const soldiersKilled = Math.floor(finalDamage / dCfg.hpPerSoldier);

  return { finalDamage, soldiersKilled, isRanged: ranged, wasCharge };
}
