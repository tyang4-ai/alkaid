/**
 * AI Adapter — switches between rule-based AIController and RL-based RLController.
 * Integrates difficulty scaling, player tendency tracking, and adaptation layer.
 */

import { AIController } from './AIController';
import { RLController } from './RLController';
import { DifficultyManager } from './DifficultyManager';
import { PlayerTendencyTracker, type UnitLookup } from './PlayerTendencyTracker';
import { AdaptationLayer } from './AdaptationLayer';
import { PERSONALITY_WEIGHTS } from './AIPersonality';
import { OnnxWorkerClient } from '../../workers/OnnxWorkerClient';
import type { UnitManager } from '../units/UnitManager';
import type { CommandSystem } from '../command/CommandSystem';
import type { OrderManager } from '../OrderManager';
import type { SupplySystem } from '../metrics/SupplySystem';
import type { SurrenderSystem } from '../combat/SurrenderSystem';
import type { EnvironmentState } from '../environment/EnvironmentState';
import type { FogOfWarSystem } from '../FogOfWarSystem';
import type { TerrainGrid } from '../terrain/TerrainGrid';
import type { SettingsManager } from '../../core/SettingsManager';
import type { EventBus } from '../../core/EventBus';
import { AI_TEAM, RL_MODEL_PATH, DIFFICULTY_CONFIG, DifficultyLevel } from '../../constants';
import type { AIPersonalityType, PersonalityWeights } from './AITypes';
import type { AISnapshot } from '../persistence/SaveTypes';

export type AIMode = 'rule-based' | 'rl';

export class AIAdapter {
  private ruleBasedController: AIController;
  private rlController: RLController | null = null;
  private onnxClient: OnnxWorkerClient | null = null;
  private mode: AIMode;
  private rlReady = false;

  // Step 16: Adaptation + Difficulty
  readonly tendencyTracker: PlayerTendencyTracker;
  readonly adaptationLayer: AdaptationLayer;
  readonly difficultyManager: DifficultyManager;
  private settingsManager: SettingsManager;

  constructor(
    team: number,
    personality: AIPersonalityType,
    seed: number,
    fogOfWar: FogOfWarSystem,
    terrainGrid: TerrainGrid,
    eventBus: EventBus,
    settingsManager: SettingsManager,
    unitLookup: UnitLookup,
    mode: AIMode = 'rule-based',
  ) {
    this.ruleBasedController = new AIController(team, personality, seed, fogOfWar, terrainGrid);
    this.mode = mode;
    this.settingsManager = settingsManager;

    // Step 16: Adaptation subsystems
    this.tendencyTracker = new PlayerTendencyTracker(eventBus, unitLookup);
    this.adaptationLayer = new AdaptationLayer();
    this.difficultyManager = new DifficultyManager();

    if (mode === 'rl') {
      this.initRL();
    }
  }

  async initRL(): Promise<void> {
    try {
      this.onnxClient = new OnnxWorkerClient();
      await this.onnxClient.init(RL_MODEL_PATH);
      this.rlController = new RLController(AI_TEAM, this.onnxClient);
      this.rlReady = true;
      console.log('RL AI initialized successfully');
    } catch (err) {
      console.warn('RL AI init failed, falling back to rule-based:', err);
      this.mode = 'rule-based';
      this.rlReady = false;
    }
  }

  async tick(
    currentTick: number,
    unitManager: UnitManager,
    commandSystem: CommandSystem,
    orderManager: OrderManager,
    supplySystem: SupplySystem,
    surrenderSystem: SurrenderSystem,
    env: EnvironmentState | null,
    isPaused: boolean,
  ): Promise<void> {
    const difficulty = this.settingsManager.get('difficulty');
    const config = DIFFICULTY_CONFIG[difficulty];

    // Try RL path if difficulty prefers it and model is available
    if (config.preferRL && this.rlReady && this.rlController) {
      this.rlController.setTemperature(this.difficultyManager.getTemperature(difficulty));
      this.rlController.setDecisionIntervalMult(config.decisionIntervalMult);
      // Enable MCTS for BRUTAL difficulty
      this.rlController.setUseMCTS(difficulty === DifficultyLevel.BRUTAL);
      await this.rlController.tick(
        currentTick, unitManager, commandSystem, orderManager,
        supplySystem, surrenderSystem, env, isPaused,
      );
    } else if (this.mode === 'rl' && this.rlReady && this.rlController && !config.preferRL) {
      // Explicit RL mode set but difficulty doesn't prefer it — still use RL with default temp
      await this.rlController.tick(
        currentTick, unitManager, commandSystem, orderManager,
        supplySystem, surrenderSystem, env, isPaused,
      );
    } else {
      // Rule-based path: apply difficulty + adaptation to personality weights
      const baseWeights = { ...PERSONALITY_WEIGHTS[this.ruleBasedController.personality] };
      const diffWeights = this.difficultyManager.applyModifiers(baseWeights, difficulty);

      if (this.difficultyManager.isAdaptationEnabled(difficulty)) {
        const tendencies = this.tendencyTracker.getFeatures();
        const bias = this.adaptationLayer.predict(tendencies);
        applyBias(diffWeights, bias);
      }

      this.ruleBasedController.setDynamicWeights(diffWeights);
      this.ruleBasedController.tick(
        currentTick, unitManager, commandSystem, orderManager,
        supplySystem, env, isPaused,
      );
    }
  }

  getMode(): AIMode {
    return this.mode;
  }

  isRLReady(): boolean {
    return this.rlReady;
  }

  setMode(mode: AIMode): void {
    this.mode = mode;
    if (mode === 'rl' && !this.rlReady && !this.onnxClient) {
      this.initRL();
    }
  }

  destroy(): void {
    if (this.onnxClient) {
      this.onnxClient.destroy();
      this.onnxClient = null;
    }
    this.rlController = null;
    this.rlReady = false;
    this.tendencyTracker.destroy();
  }

  reset(): void {
    this.ruleBasedController.reset();
    this.tendencyTracker.reset();
  }

  initBattle(unitManager: UnitManager): void {
    this.ruleBasedController.initBattle(unitManager);

    // Auto-init RL if difficulty prefers it
    const difficulty = this.settingsManager.get('difficulty');
    if (this.difficultyManager.prefersRL(difficulty) && !this.rlReady && !this.onnxClient) {
      this.initRL();
    }
  }

  serialize(): AISnapshot {
    return this.ruleBasedController.serialize();
  }

  deserialize(data: AISnapshot): void {
    this.ruleBasedController.deserialize(data);
  }

  /** Expose rule-based controller for serialization/deserialization */
  getRuleBasedController(): AIController {
    return this.ruleBasedController;
  }
}

/**
 * Apply MLP bias output to personality weights (additive, clamped).
 * Matches PersonalityWeights field order (19 fields).
 */
function applyBias(weights: PersonalityWeights, bias: Float32Array): void {
  const keys: (keyof PersonalityWeights)[] = [
    'engagementTick', 'decisionInterval', 'attackerBias',
    'defenderBias', 'flankerBias', 'reserveBias',
    'aggressiveness', 'caution', 'flankTendency',
    'terrainExploitation', 'supplyRaidPriority', 'pursuitDesire',
    'ambushTendency', 'adaptability', 'chargePreference',
    'pressThreshold', 'retreatThreshold', 'desperateThreshold',
    'generalSafeDistance',
  ];

  for (let i = 0; i < keys.length && i < bias.length; i++) {
    const key = keys[i];
    const val = weights[key] + bias[i];
    // Clamp: engagementTick and generalSafeDistance are larger numbers,
    // others are mostly 0-1 fractions or ratios
    if (key === 'engagementTick' || key === 'generalSafeDistance' || key === 'decisionInterval') {
      weights[key] = Math.max(1, val);
    } else {
      weights[key] = Math.max(0, Math.min(2, val)); // Allow up to 2 for thresholds
    }
  }
}
