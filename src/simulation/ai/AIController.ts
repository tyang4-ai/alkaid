import { SeededRandom } from '../../utils/Random';
import { eventBus } from '../../core/EventBus';
import { UnitState, type OrderType } from '../../constants';
import type { UnitManager } from '../units/UnitManager';
import type { CommandSystem } from '../command/CommandSystem';
import type { OrderManager } from '../OrderManager';
import type { SupplySystem } from '../metrics/SupplySystem';
import type { EnvironmentState } from '../environment/EnvironmentState';
import { FogOfWarSystem } from '../FogOfWarSystem';
import { TerrainGrid } from '../terrain/TerrainGrid';
import type { AISnapshot } from '../persistence/SaveTypes';
import { AIPhase } from './AITypes';
import type { AIPersonalityType, PersonalityWeights, UnitRoleAssignment, BattlefieldAssessment, TacticalRole } from './AITypes';
import { PERSONALITY_WEIGHTS } from './AIPersonality';
import { AIPerception } from './AIPerception';
import { AIRoleAssigner } from './AIRoleAssigner';
import { AIDecisionMaker } from './AIDecisionMaker';

export class AIController {
  team: number;
  personality: AIPersonalityType;
  rng: SeededRandom;
  fogOfWar: FogOfWarSystem;
  terrainGrid: TerrainGrid;

  perception: AIPerception;
  roleAssigner: AIRoleAssigner;
  decisionMaker: AIDecisionMaker;

  phase: AIPhase;
  lastDecisionTick: number;
  initialUnitCount: number;
  roleAssignments: UnitRoleAssignment[];

  /** Dynamic weights override, set by AIAdapter for difficulty/adaptation. */
  private dynamicWeights: PersonalityWeights | null = null;

  constructor(
    team: number,
    personality: AIPersonalityType,
    seed: number,
    fogOfWar: FogOfWarSystem,
    terrainGrid: TerrainGrid,
  ) {
    this.team = team;
    this.personality = personality;
    this.rng = new SeededRandom(seed);
    this.fogOfWar = fogOfWar;
    this.terrainGrid = terrainGrid;

    this.perception = new AIPerception(team, fogOfWar, terrainGrid);
    this.roleAssigner = new AIRoleAssigner();
    this.decisionMaker = new AIDecisionMaker(team, terrainGrid.width, terrainGrid.height);

    this.phase = AIPhase.OPENING;
    this.lastDecisionTick = -999;
    this.initialUnitCount = 0;
    this.roleAssignments = [];
  }

  initBattle(unitManager: UnitManager): void {
    const alive = unitManager.getByTeam(this.team).filter(u => u.state !== UnitState.DEAD);
    this.initialUnitCount = alive.length;
    this.phase = AIPhase.OPENING;
    this.lastDecisionTick = -999;
    this.roleAssignments = [];
  }

  /** Set dynamic weights override for difficulty/adaptation. Pass null to clear. */
  setDynamicWeights(weights: PersonalityWeights | null): void {
    this.dynamicWeights = weights;
  }

  tick(
    currentTick: number,
    unitManager: UnitManager,
    commandSystem: CommandSystem,
    orderManager: OrderManager,
    supplySystem: SupplySystem,
    env: EnvironmentState | null,
    isPaused: boolean,
  ): void {
    if (isPaused) return;

    const weights = this.dynamicWeights ?? PERSONALITY_WEIGHTS[this.personality];
    const interval = weights.decisionInterval;

    if (currentTick - this.lastDecisionTick < interval) return;
    this.lastDecisionTick = currentTick;

    // 1. Perception — assess the battlefield
    const assessment = this.perception.assess(
      unitManager, supplySystem, env, currentTick, this.initialUnitCount,
    );

    // 2. Update phase state machine
    this.updatePhase(assessment, currentTick);

    // 3. Assign roles
    const ownUnits = unitManager.getByTeam(this.team).filter(u => u.state !== UnitState.DEAD);
    this.roleAssignments = this.roleAssigner.assign(ownUnits, assessment, this.phase, weights, this.rng);

    // 4. Make decisions
    const decisions = this.decisionMaker.decide(
      this.roleAssignments, assessment, unitManager, orderManager, this.phase, weights, this.terrainGrid, this.rng,
    );

    // 5. Issue orders via CommandSystem (messenger delay applies)
    for (const d of decisions) {
      const order = {
        type: d.orderType as OrderType,
        unitId: d.unitId,
        targetX: d.targetX,
        targetY: d.targetY,
        targetUnitId: d.targetUnitId,
      };

      const unit = unitManager.get(d.unitId);
      if (unit) {
        unit.pendingOrderType = d.orderType as OrderType;
      }

      commandSystem.issueOrder(order, unitManager, isPaused);
    }

    // 6. Emit decision cycle event
    eventBus.emit('ai:decisionCycle', {
      team: this.team,
      tick: currentTick,
      phase: this.phase,
      orderCount: decisions.length,
    });
  }

  private updatePhase(assessment: BattlefieldAssessment, currentTick: number): void {
    const weights = this.dynamicWeights ?? PERSONALITY_WEIGHTS[this.personality];
    const oldPhase = this.phase;

    // DESPERATE: check first (overrides everything)
    if (assessment.ownCasualtyPercent > weights.desperateThreshold) {
      if (this.phase !== AIPhase.DESPERATE) {
        this.phase = AIPhase.DESPERATE;
        this.emitPhaseChange(oldPhase, this.phase, currentTick);
      }
      return;
    }

    switch (this.phase) {
      case AIPhase.OPENING:
        // Transition to ENGAGEMENT when tick exceeds engagement threshold or units engage
        if (currentTick > weights.engagementTick || assessment.ownEngagedCount > 0) {
          this.phase = AIPhase.ENGAGEMENT;
          this.emitPhaseChange(oldPhase, this.phase, currentTick);
        }
        break;

      case AIPhase.ENGAGEMENT:
        if (assessment.strengthRatio > weights.pressThreshold) {
          this.phase = AIPhase.PRESSING;
          this.emitPhaseChange(oldPhase, this.phase, currentTick);
        } else if (assessment.strengthRatio < weights.retreatThreshold) {
          this.phase = AIPhase.RETREATING;
          this.emitPhaseChange(oldPhase, this.phase, currentTick);
        }
        break;

      case AIPhase.PRESSING:
        // Hysteresis: drop back to ENGAGEMENT only if ratio falls below threshold - 0.2
        if (assessment.strengthRatio < weights.pressThreshold - 0.2) {
          this.phase = AIPhase.ENGAGEMENT;
          this.emitPhaseChange(oldPhase, this.phase, currentTick);
        }
        break;

      case AIPhase.RETREATING:
        // Hysteresis: recover to ENGAGEMENT only if ratio rises above threshold + 0.2
        if (assessment.strengthRatio > weights.retreatThreshold + 0.2) {
          this.phase = AIPhase.ENGAGEMENT;
          this.emitPhaseChange(oldPhase, this.phase, currentTick);
        }
        break;

      case AIPhase.DESPERATE:
        // Can recover if casualties drop (shouldn't happen, but for robustness)
        if (assessment.ownCasualtyPercent <= weights.desperateThreshold - 0.1) {
          this.phase = AIPhase.RETREATING;
          this.emitPhaseChange(oldPhase, this.phase, currentTick);
        }
        break;
    }
  }

  private emitPhaseChange(oldPhase: AIPhase, newPhase: AIPhase, tick: number): void {
    eventBus.emit('ai:phaseChanged', {
      team: this.team,
      oldPhase,
      newPhase,
      tick,
    });
  }

  serialize(): AISnapshot {
    return {
      personality: this.personality,
      team: this.team,
      lastDecisionTick: this.lastDecisionTick,
      phase: this.phase,
      initialUnitCount: this.initialUnitCount,
      rngState: this.rng.getState(),
      roleAssignments: this.roleAssignments.map(a => ({
        unitId: a.unitId,
        role: a.role,
        targetX: a.targetX,
        targetY: a.targetY,
      })),
    };
  }

  deserialize(data: AISnapshot): void {
    this.personality = data.personality as AIPersonalityType;
    this.team = data.team;
    this.lastDecisionTick = data.lastDecisionTick;
    this.phase = data.phase as AIPhase;
    this.initialUnitCount = data.initialUnitCount;
    this.rng.setState(data.rngState);
    this.roleAssignments = data.roleAssignments.map(a => ({
      unitId: a.unitId,
      role: a.role as TacticalRole,
      targetX: a.targetX,
      targetY: a.targetY,
    }));
  }

  reset(): void {
    this.phase = AIPhase.OPENING;
    this.lastDecisionTick = -999;
    this.initialUnitCount = 0;
    this.roleAssignments = [];
  }
}
