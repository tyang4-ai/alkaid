/**
 * AI Adapter — switches between rule-based AIController and RL-based RLController.
 * Provides a unified interface for the game loop.
 */

import { AIController } from './AIController';
import { RLController } from './RLController';
import { OnnxWorkerClient } from '../../workers/OnnxWorkerClient';
import type { UnitManager } from '../units/UnitManager';
import type { CommandSystem } from '../command/CommandSystem';
import type { OrderManager } from '../OrderManager';
import type { SupplySystem } from '../metrics/SupplySystem';
import type { SurrenderSystem } from '../combat/SurrenderSystem';
import type { EnvironmentState } from '../environment/EnvironmentState';
import type { FogOfWarSystem } from '../FogOfWarSystem';
import type { TerrainGrid } from '../terrain/TerrainGrid';
import { AI_TEAM, RL_MODEL_PATH } from '../../constants';
import type { AIPersonalityType } from './AITypes';

export type AIMode = 'rule-based' | 'rl';

export class AIAdapter {
  private ruleBasedController: AIController;
  private rlController: RLController | null = null;
  private onnxClient: OnnxWorkerClient | null = null;
  private mode: AIMode;
  private rlReady = false;

  constructor(
    team: number,
    personality: AIPersonalityType,
    seed: number,
    fogOfWar: FogOfWarSystem,
    terrainGrid: TerrainGrid,
    mode: AIMode = 'rule-based',
  ) {
    this.ruleBasedController = new AIController(team, personality, seed, fogOfWar, terrainGrid);
    this.mode = mode;

    if (mode === 'rl') {
      this.initRL();
    }
  }

  private async initRL(): Promise<void> {
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
    if (this.mode === 'rl' && this.rlReady && this.rlController) {
      await this.rlController.tick(
        currentTick, unitManager, commandSystem, orderManager,
        supplySystem, surrenderSystem, env, isPaused,
      );
    } else {
      // Fall back to rule-based
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
  }

  /** Expose rule-based controller for serialization/deserialization */
  getRuleBasedController(): AIController {
    return this.ruleBasedController;
  }
}
