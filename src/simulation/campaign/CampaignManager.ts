import {
  CampaignPhase, UnitType, UNIT_TYPE_CONFIGS,
  CAMPAIGN_WIN_TERRITORIES, CAMPAIGN_STARTING_GOLD, CAMPAIGN_STARTING_FOOD,
} from '../../constants';
import type { EventBus } from '../../core/EventBus';
import type {
  CampaignState, ArmyRoster, CampaignSquad,
  BattleResult, Serializable,
} from './CampaignTypes';
import { TerritoryManager } from './TerritoryManager';
import { createTerritories } from './TerritoryGraph';

function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class CampaignManager implements Serializable<CampaignState> {
  private state!: CampaignState;
  private territoryManager!: TerritoryManager;
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    // Initialize with default territories so getStartingCandidates() works pre-run
    this.territoryManager = new TerritoryManager(createTerritories());
  }

  // --- Lifecycle ---

  startNewRun(seed: number, startTerritoryId: string, unlockedUnitTypes: UnitType[] = [], startingExp = 0): void {
    const territories = createTerritories();
    this.territoryManager = new TerritoryManager(territories);

    // Capture starting territory
    this.territoryManager.captureTerritory(startTerritoryId, 0);

    const roster = this.buildStartingRoster(unlockedUnitTypes, startingExp);

    this.state = {
      runId: generateRunId(),
      seed,
      difficulty: 'normal',
      mode: 'ironman',
      territories,
      startingTerritoryId: startTerritoryId,
      roster,
      resources: {
        gold: CAMPAIGN_STARTING_GOLD,
        population: 0,
        horses: 0,
        iron: 0,
        food: CAMPAIGN_STARTING_FOOD,
      },
      turn: 1,
      territoriesConquered: 1, // starting territory counts
      battlesWon: 0,
      battlesLost: 0,
      totalEnemiesDefeated: 0,
      totalSoldiersLost: 0,
      bonusObjectivesCompleted: [],
      phase: CampaignPhase.CAMPAIGN_MAP,
      selectedTerritoryId: null,
      pendingEvent: null,
    };

    this.eventBus.emit('campaign:runStarted', {
      seed,
      startTerritoryId,
    });
  }

  private buildStartingRoster(unlockedUnitTypes: UnitType[], startingExp: number): ArmyRoster {
    let nextId = 1;
    const squads: CampaignSquad[] = [];

    const addSquad = (type: UnitType, count: number, exp = 0): void => {
      for (let i = 0; i < count; i++) {
        squads.push({
          squadId: nextId++,
          type,
          size: UNIT_TYPE_CONFIGS[type].maxSize,
          maxSize: UNIT_TYPE_CONFIGS[type].maxSize,
          experience: Math.max(exp, startingExp),
          morale: 70,
          fatigue: 0,
          trainingTurnsRemaining: 0,
          isCaptured: false,
          capturedEffectiveness: 1.0,
        });
      }
    };

    // Base army
    addSquad(UnitType.JI_HALBERDIERS, 3);
    addSquad(UnitType.NU_CROSSBOWMEN, 2);
    addSquad(UnitType.DAO_SWORDSMEN, 1);
    addSquad(UnitType.SCOUTS, 1, 10);

    // If Elite Guard unlocked, add 1 guard squad
    if (unlockedUnitTypes.includes(UnitType.ELITE_GUARD)) {
      squads.push({
        squadId: nextId++,
        type: UnitType.ELITE_GUARD,
        size: 15, // General's personal guard, smaller than max
        maxSize: UNIT_TYPE_CONFIGS[UnitType.ELITE_GUARD].maxSize,
        experience: Math.max(40, startingExp),
        morale: 85,
        fatigue: 0,
        trainingTurnsRemaining: 0,
        isCaptured: false,
        capturedEffectiveness: 1.0,
      });
    }

    return {
      squads,
      generalAlive: true,
      generalExperience: 0,
      nextSquadId: nextId,
    };
  }

  // --- Phase Transitions ---

  transitionTo(phase: CampaignPhase): boolean {
    const allowed = this.getAllowedTransitions(this.state.phase);
    if (!allowed.includes(phase)) return false;

    const oldPhase = this.state.phase;
    this.state.phase = phase;
    this.eventBus.emit('campaign:phaseChanged', { oldPhase, newPhase: phase });
    return true;
  }

  private getAllowedTransitions(from: CampaignPhase): CampaignPhase[] {
    switch (from) {
      case CampaignPhase.NEW_RUN_SETUP: return [CampaignPhase.CAMPAIGN_MAP];
      case CampaignPhase.CAMPAIGN_MAP: return [CampaignPhase.CAMP, CampaignPhase.PRE_BATTLE_INTEL];
      case CampaignPhase.CAMP: return [CampaignPhase.CAMPAIGN_MAP];
      case CampaignPhase.PRE_BATTLE_INTEL: return [CampaignPhase.BATTLE, CampaignPhase.CAMPAIGN_MAP];
      case CampaignPhase.BATTLE: return [CampaignPhase.POST_BATTLE];
      case CampaignPhase.POST_BATTLE: return [CampaignPhase.CAMPAIGN_MAP, CampaignPhase.CAMP, CampaignPhase.RUN_OVER];
      case CampaignPhase.RUN_OVER: return [];
      default: return [];
    }
  }

  // --- Turn Management ---

  advanceTurn(): void {
    // 1. Collect resources from owned territories
    const playerIds = this.territoryManager.getPlayerTerritories().map(t => t.id);
    const income = this.territoryManager.calculateResourceIncome(playerIds);
    this.state.resources.gold += income.gold;
    this.state.resources.population += income.population;
    this.state.resources.horses += income.horses;
    this.state.resources.iron += income.iron;
    this.state.resources.food += income.food;

    // 2. Tick training
    for (const squad of this.state.roster.squads) {
      if (squad.trainingTurnsRemaining > 0) {
        squad.trainingTurnsRemaining--;
      }
    }

    // 3. Improve captured troop effectiveness
    for (const squad of this.state.roster.squads) {
      if (squad.isCaptured && squad.capturedEffectiveness < 1.0) {
        squad.capturedEffectiveness = Math.min(1.0, squad.capturedEffectiveness + 0.1);
      }
    }

    // 4. Increment turn
    this.state.turn++;

    // 5. Emit
    this.eventBus.emit('campaign:turnAdvanced', { turn: this.state.turn });
    this.eventBus.emit('campaign:resourcesChanged', { resources: { ...this.state.resources } });
  }

  // --- Territory ---

  selectTerritory(id: string): boolean {
    const territory = this.territoryManager.get(id);
    if (!territory) return false;
    if (territory.owner === 'player') return false;

    // Must be adjacent to a player territory
    const playerTerritories = this.territoryManager.getPlayerTerritories();
    const attackable = this.territoryManager.getAttackableFrom(playerTerritories.map(t => t.id));
    if (!attackable.some(t => t.id === id)) return false;

    this.state.selectedTerritoryId = id;
    return true;
  }

  // --- Battle Interface ---

  /** Get squads ready for deployment (training complete). */
  getPlayerRosterForDeployment(): CampaignSquad[] {
    return this.state.roster.squads.filter(s => s.trainingTurnsRemaining === 0);
  }

  processBattleResult(result: BattleResult): void {
    // Match surviving squads by squadId
    const updatedSquads: CampaignSquad[] = [];

    for (const squad of this.state.roster.squads) {
      const survivor = result.survivingPlayerSquads.find(s => s.squadId === squad.squadId);
      if (survivor) {
        squad.size = survivor.size;
        squad.experience = survivor.experience;
        updatedSquads.push(squad);
      } else if (squad.trainingTurnsRemaining > 0) {
        // Squad was in training, not deployed — keep it
        updatedSquads.push(squad);
      }
      // Otherwise: squad was deployed but didn't survive — remove
    }

    this.state.roster.squads = updatedSquads;

    // Handle captured enemy squads
    for (const captured of result.capturedEnemySquads) {
      this.state.roster.squads.push({
        squadId: this.state.roster.nextSquadId++,
        type: captured.type,
        size: captured.size,
        maxSize: UNIT_TYPE_CONFIGS[captured.type].maxSize,
        experience: captured.experience,
        morale: 60,
        fatigue: 0,
        trainingTurnsRemaining: 0,
        isCaptured: true,
        capturedEffectiveness: 0.5,
      });
    }

    // General status
    this.state.roster.generalAlive = result.generalAlive;

    // Stats
    this.state.totalEnemiesDefeated += result.totalEnemiesDefeated;
    this.state.totalSoldiersLost += result.totalPlayerLosses;

    if (result.won) {
      this.state.battlesWon++;
      if (this.state.selectedTerritoryId) {
        this.territoryManager.captureTerritory(this.state.selectedTerritoryId, this.state.turn);
        this.state.territoriesConquered++;
        this.eventBus.emit('campaign:territoryConquered', {
          territoryId: this.state.selectedTerritoryId,
          turn: this.state.turn,
        });
      }
      // Bonus objective: no squad fully lost
      if (result.noSquadFullyLost && !this.state.bonusObjectivesCompleted.includes('no_squad_lost')) {
        this.state.bonusObjectivesCompleted.push('no_squad_lost');
      }
    } else {
      this.state.battlesLost++;
    }

    this.state.selectedTerritoryId = null;

    this.eventBus.emit('campaign:battleComplete', {
      won: result.won,
      victoryType: result.victoryType,
    });
  }

  // --- Run End ---

  checkRunEnd(): 'win' | 'lose' | 'continue' {
    if (!this.state.roster.generalAlive) return 'lose';
    if (this.state.territoriesConquered >= CAMPAIGN_WIN_TERRITORIES) return 'win';
    return 'continue';
  }

  calculateUnlockPoints(): number {
    const won = this.state.territoriesConquered >= CAMPAIGN_WIN_TERRITORIES;
    return (
      this.state.territoriesConquered * 10 +
      this.state.battlesWon * 5 +
      (won ? 50 : 0) +
      this.state.bonusObjectivesCompleted.length * 15
    );
  }

  // --- Getters ---

  getState(): CampaignState {
    return this.state;
  }

  getTerritoryManager(): TerritoryManager {
    return this.territoryManager;
  }

  isInitialized(): boolean {
    return !!this.state;
  }

  // --- Serializable ---

  serialize(): CampaignState {
    // Sync territories from manager back to state
    this.state.territories = this.territoryManager.getAll();
    return JSON.parse(JSON.stringify(this.state));
  }

  deserialize(data: CampaignState): void {
    this.state = JSON.parse(JSON.stringify(data));
    this.territoryManager = new TerritoryManager(this.state.territories);
  }
}
