import type { Unit } from '../units/Unit';
import { UnitType, UnitState, UnitCategory, UNIT_TYPE_CONFIGS } from '../../constants';
import { TacticalRole, AIPhase } from './AITypes';
import type { PersonalityWeights, BattlefieldAssessment, UnitRoleAssignment } from './AITypes';
import type { SeededRandom } from '../../utils/Random';

export class AIRoleAssigner {
  assign(
    units: Unit[],
    assessment: BattlefieldAssessment,
    phase: AIPhase,
    weights: PersonalityWeights,
    _rng: SeededRandom,
  ): UnitRoleAssignment[] {
    const alive = units.filter(u => u.state !== UnitState.DEAD);
    if (alive.length === 0) return [];

    // RETREATING phase: everyone becomes DEFENDER (retreat)
    if (phase === AIPhase.RETREATING) {
      return alive.map(u => ({ unitId: u.id, role: TacticalRole.DEFENDER }));
    }

    // DESPERATE + Aggressive → all-in CHARGE (everyone ATTACKER)
    if (phase === AIPhase.DESPERATE && weights.aggressiveness > 0.7) {
      return alive.map(u => ({ unitId: u.id, role: TacticalRole.ATTACKER }));
    }

    const assignments: UnitRoleAssignment[] = [];
    const remaining: Unit[] = [];

    // 1. General always GUARD
    // 2. Scouts always SCOUT
    // 3. Elite Guard always GUARD (protect general)
    for (const u of alive) {
      if (u.isGeneral) {
        assignments.push({ unitId: u.id, role: TacticalRole.GUARD });
      } else if (u.type === UnitType.SCOUTS) {
        assignments.push({ unitId: u.id, role: TacticalRole.SCOUT });
      } else if (u.type === UnitType.ELITE_GUARD) {
        assignments.push({ unitId: u.id, role: TacticalRole.GUARD });
      } else {
        remaining.push(u);
      }
    }

    // 3. Supply raider: if priority > 0.5, assign up to 2 light cavalry
    if (weights.supplyRaidPriority > 0.5) {
      let raidersAssigned = 0;
      for (let i = remaining.length - 1; i >= 0 && raidersAssigned < 2; i--) {
        if (remaining[i].type === UnitType.LIGHT_CAVALRY) {
          assignments.push({ unitId: remaining[i].id, role: TacticalRole.SUPPLY_RAIDER });
          remaining.splice(i, 1);
          raidersAssigned++;
        }
      }
    }

    // 4. Allocate remaining by bias weights + type affinity
    // Score each unit for each role, assign greedily
    for (const u of remaining) {
      const scores = this.scoreRoles(u, weights, assessment, phase);
      // Pick highest scoring role
      let bestRole: TacticalRole = TacticalRole.ATTACKER;
      let bestScore = -Infinity;
      for (const [role, score] of scores) {
        if (score > bestScore) {
          bestScore = score;
          bestRole = role;
        }
      }
      assignments.push({ unitId: u.id, role: bestRole });
    }

    // 5. Dynamic overrides
    this.applyDynamicOverrides(assignments, assessment, weights, alive);

    return assignments;
  }

  private scoreRoles(
    unit: Unit,
    weights: PersonalityWeights,
    _assessment: BattlefieldAssessment,
    phase: AIPhase,
  ): Array<[TacticalRole, number]> {
    const cfg = UNIT_TYPE_CONFIGS[unit.type];
    const category = cfg?.category;

    let attackScore = weights.attackerBias;
    let defendScore = weights.defenderBias;
    let flankScore = weights.flankerBias;
    let reserveScore = weights.reserveBias;

    // Type affinity
    if (category === UnitCategory.CAVALRY) {
      flankScore += 0.3;
    }
    if (category === UnitCategory.RANGED) {
      defendScore += 0.2;
    }
    if (category === UnitCategory.INFANTRY) {
      attackScore += 0.2;
    }
    if (category === UnitCategory.SIEGE) {
      attackScore += 0.5; // Siege always attacks
    }

    // Phase adjustments
    if (phase === AIPhase.OPENING) {
      reserveScore += 0.1; // Slightly prefer reserve in opening
    }
    if (phase === AIPhase.PRESSING) {
      attackScore += 0.2;
      reserveScore -= 0.3; // Reserves should commit
    }

    return [
      [TacticalRole.ATTACKER, attackScore],
      [TacticalRole.DEFENDER, defendScore],
      [TacticalRole.FLANKER, flankScore],
      [TacticalRole.RESERVE, reserveScore],
    ];
  }

  private applyDynamicOverrides(
    assignments: UnitRoleAssignment[],
    assessment: BattlefieldAssessment,
    _weights: PersonalityWeights,
    alive: Unit[],
  ): void {
    // If threats to general, pull one RESERVE to GUARD
    if (assessment.threatsToGeneral.length > 0) {
      const reserveIdx = assignments.findIndex(a => a.role === TacticalRole.RESERVE);
      if (reserveIdx !== -1) {
        assignments[reserveIdx].role = TacticalRole.GUARD;
      }
    }

    // If many routing (>30% of engaged), commit reserves
    const totalCombat = assessment.ownEngagedCount + assessment.ownRoutingCount;
    if (totalCombat > 0 && assessment.ownRoutingCount / totalCombat > 0.3) {
      for (const a of assignments) {
        if (a.role === TacticalRole.RESERVE) {
          // Only commit non-general units
          const unit = alive.find(u => u.id === a.unitId);
          if (unit && !unit.isGeneral) {
            a.role = TacticalRole.ATTACKER;
          }
        }
      }
    }
  }
}
