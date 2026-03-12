import { Renderer } from './rendering/Renderer';
import { TerrainRenderer } from './rendering/TerrainRenderer';
import { UnitRenderer } from './rendering/UnitRenderer';
import { SelectionRenderer } from './rendering/SelectionRenderer';
import { OrderRenderer } from './rendering/OrderRenderer';
import { RadialMenu } from './rendering/RadialMenu';
import { DragArrowRenderer } from './rendering/DragArrowRenderer';
import { DeploymentRenderer } from './rendering/DeploymentRenderer';
import { DeploymentSidebar } from './rendering/DeploymentSidebar';
import { MessengerRenderer } from './rendering/MessengerRenderer';
import { CommandRadiusRenderer } from './rendering/CommandRadiusRenderer';
import { CombatRenderer } from './rendering/CombatRenderer';
import { UnitInfoPanel } from './rendering/UnitInfoPanel';
import { EnvironmentHUD } from './rendering/EnvironmentHUD';
import { BattleEndOverlay } from './rendering/BattleEndOverlay';
import { SpeedControls } from './rendering/SpeedControls';
import { PauseMenu } from './rendering/PauseMenu';
import { AlertSystem } from './rendering/AlertSystem';
import { BattleHUD } from './rendering/BattleHUD';
import { HotkeyManager } from './core/HotkeyManager';
import { RetreatSystem } from './simulation/RetreatSystem';
import { Codex } from './rendering/Codex';
import { BattleEventLogger } from './simulation/BattleEventLogger';
import { AfterActionReport } from './rendering/AfterActionReport';
import { BattleCinematic } from './rendering/BattleCinematic';
import { SaveToast } from './rendering/SaveToast';
import { SaveLoadScreen } from './rendering/SaveLoadScreen';
import { SaveManager } from './simulation/persistence/SaveManager';
import type { SaveSystemRefs, EnvironmentStateSnapshot } from './simulation/persistence/SaveTypes';
import { GameLoop } from './core/GameLoop';
import { GameState } from './simulation/GameState';
import { TerrainGenerator } from './simulation/terrain/TerrainGenerator';
import { UnitManager } from './simulation/units/UnitManager';
import { SelectionManager } from './simulation/SelectionManager';
import { OrderManager } from './simulation/OrderManager';
import { DeploymentManager } from './simulation/deployment/DeploymentManager';
import { PathManager } from './simulation/pathfinding/PathManager';
import { CommandSystem } from './simulation/command/CommandSystem';
import { CombatSystem } from './simulation/combat/CombatSystem';
import { MoraleSystem } from './simulation/combat/MoraleSystem';
import { FatigueSystem } from './simulation/metrics/FatigueSystem';
import { SupplySystem } from './simulation/metrics/SupplySystem';
import { ExperienceSystem } from './simulation/metrics/ExperienceSystem';
import { WeatherSystem } from './simulation/environment/WeatherSystem';
import { TimeOfDaySystem } from './simulation/environment/TimeOfDaySystem';
import type { EnvironmentState } from './simulation/environment/EnvironmentState';
import { SurrenderSystem } from './simulation/combat/SurrenderSystem';
import { Camera } from './core/Camera';
import { InputManager } from './core/InputManager';
import { eventBus } from './core/EventBus';
import {
  DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, TILE_SIZE,
  UnitType, UnitState, DeploymentPhase, TerrainType, OrderType,
  VictoryType, CAMERA_DRAG_DEAD_ZONE, TimeOfDay,
  SAVE_AUTO_INTERVAL_MS, SAVE_QUICKSAVE_ID,
  CampaignPhase,
} from './constants';
import type { FormationType } from './constants';

// Campaign imports (Step 12)
import { CampaignManager } from './simulation/campaign/CampaignManager';
import { UnlockManager } from './simulation/campaign/UnlockManager';
import { RecruitmentManager } from './simulation/campaign/RecruitmentManager';
import { EnemyArmyGenerator } from './simulation/campaign/EnemyArmyGenerator';
import { RandomEventSystem } from './simulation/campaign/RandomEventSystem';
import type { BattleResult } from './simulation/campaign/CampaignTypes';
import { NewRunScreen } from './rendering/NewRunScreen';
import { CampaignMapScreen } from './rendering/CampaignMapScreen';
import { CampScreen } from './rendering/CampScreen';
import { IntelScreen } from './rendering/IntelScreen';
import { FogOfWarSystem } from './simulation/FogOfWarSystem';
import { FogOfWarRenderer } from './rendering/FogOfWarRenderer';
import { AIController } from './simulation/ai/AIController';
import { AIAdapter } from './simulation/ai/AIAdapter';
import { extractBattleContext } from './simulation/ai/BattleAnalyzer';
import { AIPersonalityType } from './simulation/ai/AITypes';
import { RandomEventModal } from './rendering/RandomEventModal';
import { ClemencyModal } from './rendering/ClemencyModal';
import { RunSummaryScreen } from './rendering/RunSummaryScreen';

// QoL imports (Steps 14b-14f)
import { PathWorkerClient } from './workers/PathWorkerClient';
import { Minimap } from './rendering/Minimap';
import { TooltipSystem } from './rendering/TooltipSystem';
import { PerfMonitor } from './rendering/PerfMonitor';
import { SettingsManager } from './core/SettingsManager';
import { SettingsScreen } from './rendering/SettingsScreen';
import { ReplayRecorder } from './simulation/replay/ReplayRecorder';
import { ReplayPlayer } from './simulation/replay/ReplayPlayer';
import { ReplayControls } from './rendering/ReplayControls';
import { OrderQueueRenderer } from './rendering/OrderQueueRenderer';
import type { ReplaySnapshot } from './simulation/persistence/SaveTypes';

// Hackathon: Agent Chat Panel + Landing Screen
import { AgentChatPanel } from './rendering/AgentChatPanel';
import { LandingScreen } from './rendering/LandingScreen';

// Audio system (Step 19)
import { AudioManager } from './audio/AudioManager';

type AppMode = 'campaign_ui' | 'battle' | 'replay';

// ---------------------------------------------------------------------------
// Global error handler — catch uncaught errors and show user-friendly overlay
// ---------------------------------------------------------------------------
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Alkaid Fatal]', { message, source, lineno, colno, error });
  showErrorOverlay(String(message), error?.stack);
  return true; // Prevent default browser error handling
};

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  console.error('[Alkaid Unhandled Promise]', event.reason);
  showErrorOverlay(
    event.reason?.message || String(event.reason),
    event.reason?.stack,
  );
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showErrorOverlay(message: string, stack?: string): void {
  // Only show once — don't spam
  if (document.getElementById('alkaid-error-overlay')) return;

  const safeMessage = escapeHtml(message);
  const safeStack = stack ? escapeHtml(stack) : '';

  const overlay = document.createElement('div');
  overlay.id = 'alkaid-error-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(26, 26, 46, 0.95); z-index: 99999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #D4C4A0; font-family: 'Noto Serif SC', serif; padding: 2rem;
  `;
  overlay.innerHTML = `
    <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #C75050;">&#9888; 破军 — Fatal Error</h1>
    <p style="font-size: 1.1rem; margin-bottom: 1rem; max-width: 600px; text-align: center;">
      ${safeMessage}
    </p>
    ${safeStack ? `<pre style="font-size: 0.75rem; max-width: 80%; overflow: auto; background: #111; padding: 1rem; border-radius: 4px; color: #888; max-height: 200px;">${safeStack}</pre>` : ''}
    <button onclick="location.reload()" style="
      margin-top: 1.5rem; padding: 0.75rem 2rem; background: #8B2500;
      color: #D4C4A0; border: none; border-radius: 4px; cursor: pointer;
      font-size: 1rem; font-family: inherit;
    ">重新加载 Reload</button>
  `;
  document.body.appendChild(overlay);
}

async function main(): Promise<void> {
  const container = document.getElementById('game-container');
  if (!container) throw new Error('Missing #game-container');

  let appMode: AppMode = 'campaign_ui';

  const renderer = new Renderer();
  await renderer.init(container);

  // Terrain (mutable — regenerated per battle)
  let currentSeed = Date.now();
  let currentTemplateId = 'river_valley';
  let terrainGrid = new TerrainGenerator(currentSeed).generate(currentTemplateId);

  // Render terrain
  const terrainRenderer = new TerrainRenderer(renderer.terrainLayer);
  terrainRenderer.bake(terrainGrid, renderer.pixiRenderer);
  eventBus.emit('terrain:generated', { seed: currentSeed, templateId: currentTemplateId });

  // Units
  const unitManager = new UnitManager();
  const unitRenderer = new UnitRenderer(renderer.unitLayer, renderer.pixiRenderer);

  // Selection + Orders
  const selectionManager = new SelectionManager();
  const orderManager = new OrderManager();
  const selectionRenderer = new SelectionRenderer(renderer.unitLayer, renderer.uiLayer);
  const orderRenderer = new OrderRenderer(renderer.effectLayer);
  const dragArrowRenderer = new DragArrowRenderer(renderer.effectLayer);
  const radialMenu = new RadialMenu(renderer.uiLayer);

  // Pathfinding (mutable — recreated per battle)
  let pathManager = new PathManager(terrainGrid);

  // Command System (Step 7)
  const commandSystem = new CommandSystem();

  // Combat System (Step 8, mutable — terrain-dependent)
  let combatSystem = new CombatSystem(terrainGrid);
  const moraleSystem = new MoraleSystem();

  // Fog of War (Step 13, mutable — terrain-dependent)
  let fogOfWarSystem = new FogOfWarSystem(terrainGrid, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);
  const fogOfWarRenderer = new FogOfWarRenderer(renderer.fogLayer, renderer.pixiRenderer, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);

  // --- QoL: SettingsManager (hoisted — needed by AI system below) ---
  const settingsManager = new SettingsManager();

  // --- Audio System (Step 19) ---
  const audioManager = AudioManager.getInstance();
  audioManager.loadSettings({
    masterVolume: settingsManager.get('masterVolume'),
    sfxVolume: settingsManager.get('sfxVolume'),
    musicVolume: settingsManager.get('musicVolume'),
    ambientVolume: settingsManager.get('ambientVolume'),
    muted: settingsManager.get('audioMuted'),
  });

  // Resume AudioContext on first user interaction (browser autoplay policy)
  const resumeAudio = () => {
    audioManager.init();
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('keydown', resumeAudio);
  };
  document.addEventListener('click', resumeAudio);
  document.addEventListener('keydown', resumeAudio);

  // AI System (Step 14, mutable — terrain-dependent)
  let aiFogOfWar = new FogOfWarSystem(terrainGrid, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);
  const aiUnitLookup = (unitId: number) => {
    const u = unitManager.get(unitId);
    if (!u) return undefined;
    return { type: u.type, team: u.team, x: u.x, y: u.y };
  };
  let aiController: AIAdapter | AIController = new AIAdapter(
    1, AIPersonalityType.BALANCED, currentSeed, aiFogOfWar, terrainGrid,
    eventBus, settingsManager, aiUnitLookup,
  );

  // Metrics Systems (Step 9a, mutable — terrain-dependent)
  let fatigueSystem = new FatigueSystem(terrainGrid);
  let supplySystem = new SupplySystem(terrainGrid);
  const experienceSystem = new ExperienceSystem();

  // Unit Info Panel (Step 9a)
  const unitInfoPanel = new UnitInfoPanel(container);

  // Environment Systems (Step 9b)
  let weatherSystem = new WeatherSystem(currentSeed);
  let timeOfDaySystem = new TimeOfDaySystem(TimeOfDay.DAWN);
  const environmentHUD = new EnvironmentHUD(container);
  let environmentState: EnvironmentState | null = null;

  // Surrender System (Step 9c)
  const surrenderSystem = new SurrenderSystem();
  const battleEndOverlay = new BattleEndOverlay(container);
  let battleStartTick = 0;
  let battleEnded = false;

  // Step 10: Speed Controls + Pause Menu + Alert System + Battle HUD
  const speedControls = new SpeedControls(container, eventBus);
  const pauseMenu = new PauseMenu(container, eventBus);
  const alertSystem = new AlertSystem(container, eventBus, unitManager);
  const battleHUD = new BattleHUD(container);
  const retreatSystem = new RetreatSystem();
  const codex = new Codex(container, eventBus);
  const agentChatPanel = new AgentChatPanel(container);
  agentChatPanel.setContextProvider(() => {
    if (appMode !== 'battle') return null;
    return extractBattleContext(
      unitManager, supplySystem, surrenderSystem,
      environmentState, gameState.getState().tickNumber,
      currentTemplateId,
    );
  });
  const battleEventLogger = new BattleEventLogger(eventBus);
  const afterActionReport = new AfterActionReport(container);
  const battleCinematic = new BattleCinematic(container);

  // --- QoL Systems (Steps 14b-14f) ---
  const settingsScreen = new SettingsScreen(container, settingsManager);
  const perfMonitor = new PerfMonitor(container);
  const replayRecorder = new ReplayRecorder();
  let replayPlayer: ReplayPlayer | null = null;
  let replayControls: ReplayControls | null = null;
  let lastReplaySnapshot: ReplaySnapshot | null = null;

  // Web Worker for pathfinding (initialized after terrainGrid)
  const pathWorkerClient = new PathWorkerClient();
  pathWorkerClient.initTerrain(terrainGrid.terrain, terrainGrid.width, terrainGrid.height);

  // Renderers for command + combat
  const messengerRenderer = new MessengerRenderer(renderer.effectLayer);
  const commandRadiusRenderer = new CommandRadiusRenderer(renderer.effectLayer);
  const combatRenderer = new CombatRenderer(renderer.effectLayer);

  // Deployment
  const deploymentManager = new DeploymentManager();
  const deploymentRenderer = new DeploymentRenderer(renderer.effectLayer);
  const deploymentSidebar = new DeploymentSidebar(renderer.uiLayer);

  // Camera + input
  const mapPixelW = DEFAULT_MAP_WIDTH * TILE_SIZE;
  const mapPixelH = DEFAULT_MAP_HEIGHT * TILE_SIZE;
  const camera = new Camera(mapPixelW, mapPixelH, window.innerWidth, window.innerHeight);
  camera.snap();
  const inputManager = new InputManager(camera, renderer.canvas);

  // Minimap, tooltips, order queue renderer (need camera)
  const minimap = new Minimap(container, camera, mapPixelW, mapPixelH);
  minimap.bakeTerrainFromGrid(terrainGrid);
  const tooltipSystem = new TooltipSystem(container, camera);
  const orderQueueRenderer = new OrderQueueRenderer(container);

  const gameState = new GameState();
  const gameLoop = new GameLoop();

  // Step 10: HotkeyManager (after all dependencies exist)
  const hotkeyManager = new HotkeyManager(
    eventBus, selectionManager, unitManager, orderManager,
    commandSystem, camera, gameState,
  );
  hotkeyManager.setCodexToggle(() => codex.toggle());
  hotkeyManager.setPerfMonitorToggle(() => perfMonitor.toggle());
  hotkeyManager.setChatPanelToggle(() => agentChatPanel.toggle());
  hotkeyManager.setEscapeAction(() => {
    if (deploymentManager.phase === DeploymentPhase.BATTLE && !battleEnded) {
      pauseMenu.showRetreatConfirm(() => {
        retreatSystem.initiateRetreat(0, unitManager, orderManager);
      });
    }
  });

  // --- Save System (Step 11) ---
  const saveRefs: SaveSystemRefs = {
    gameState, unitManager, orderManager, supplySystem, surrenderSystem,
    commandSystem, weatherSystem, timeOfDaySystem, deploymentManager,
    retreatSystem, battleEventLogger,
    getEnvironmentState: () => environmentState
      ? { weather: environmentState.weather, timeOfDay: environmentState.timeOfDay,
          windDirection: environmentState.windDirection, visibility: 1 }
      : { weather: 0, timeOfDay: 0, windDirection: 0, visibility: 1 },
    setEnvironmentState: (s: EnvironmentStateSnapshot) => {
      if (environmentState) {
        environmentState.weather = s.weather;
        environmentState.timeOfDay = s.timeOfDay;
        environmentState.windDirection = s.windDirection;
      }
    },
    getBattleStartTick: () => battleStartTick,
    setBattleStartTick: (t: number) => { battleStartTick = t; },
    getBattleEnded: () => battleEnded,
    setBattleEnded: (e: boolean) => { battleEnded = e; },
    getTerrainSeed: () => currentSeed,
    getTemplateId: () => currentTemplateId,
    fogOfWar: fogOfWarSystem,
    aiController: aiController,
    aiFogOfWar: aiFogOfWar,
  };

  const saveManager = new SaveManager(saveRefs);
  await saveManager.initDB();
  const saveLoadScreen = new SaveLoadScreen(container, saveManager, eventBus);
  const saveToast = new SaveToast(container, eventBus);

  // Wire PauseMenu settings toggle
  pauseMenu.setSettingsToggle(() => {
    settingsScreen.show(() => {
      // On close: apply colorblind palette
      const colors = settingsManager.getTeamColors();
      unitRenderer.setColorOverrides(colors.player, colors.enemy);
    });
  });

  // Wire PauseMenu save callbacks
  pauseMenu.setSaveCallbacks({
    onQuickSave: async () => {
      eventBus.emit('save:started', { type: 'quick' });
      try {
        await saveManager.quickSave();
        eventBus.emit('save:completed', { type: 'quick', success: true });
      } catch (e) {
        eventBus.emit('save:error', { message: String(e) });
      }
    },
    onQuickLoad: async () => {
      const snapshot = await saveManager.loadBattle(SAVE_QUICKSAVE_ID);
      if (snapshot) {
        saveManager.restoreBattle(snapshot);
        eventBus.emit('save:loaded', { slotId: SAVE_QUICKSAVE_ID });
        eventBus.emit('game:resumed', undefined);
      }
    },
    onSaveGame: () => {
      saveLoadScreen.show('save');
    },
    onLoadGame: () => {
      saveLoadScreen.show('load');
    },
  });

  // Wire SaveLoadScreen load callback
  saveLoadScreen.setCallbacks(
    async (slotId: string) => {
      const snapshot = await saveManager.loadBattle(slotId);
      if (snapshot) {
        saveManager.restoreBattle(snapshot);
        eventBus.emit('save:loaded', { slotId });
        eventBus.emit('game:resumed', undefined);
      }
    },
    () => {
      // onClose: return to pause menu
    },
  );

  // Emergency save on page unload
  saveManager.registerBeforeUnload();

  // Check for emergency save recovery on startup
  const emergencySnapshot = saveManager.loadEmergency();
  if (emergencySnapshot) {
    console.log('Emergency save detected — restoring...');
    saveManager.restoreBattle(emergencySnapshot);
  }

  // --- Campaign Systems (Step 12) ---
  const unlockManager = new UnlockManager();
  const campaignManager = new CampaignManager(eventBus);
  const enemyArmyGenerator = new EnemyArmyGenerator();
  const recruitmentManager = new RecruitmentManager();
  const randomEventSystem = new RandomEventSystem();

  // Campaign UI screens
  const newRunScreen = new NewRunScreen();
  const campaignMapScreen = new CampaignMapScreen();
  const campScreen = new CampScreen();
  const intelScreen = new IntelScreen();
  const randomEventModal = new RandomEventModal();
  const clemencyModal = new ClemencyModal();
  const runSummaryScreen = new RunSummaryScreen();

  // Territory ID being attacked (set when entering battle from campaign)
  let currentBattleTerritoryId: string | null = null;

  // --- Terrain regeneration helper ---
  function regenerateTerrain(seed: number, templateId: string): void {
    currentSeed = seed;
    // Fallback unknown templates to closest match
    const templateMap: Record<string, string> = {
      dense_forest: 'wetlands',
      fortified_city: 'siege',
    };
    currentTemplateId = templateMap[templateId] ?? templateId;
    terrainGrid = new TerrainGenerator(currentSeed).generate(currentTemplateId);
    terrainRenderer.bake(terrainGrid, renderer.pixiRenderer);
    eventBus.emit('terrain:generated', { seed: currentSeed, templateId: currentTemplateId });

    // Update worker terrain data
    pathWorkerClient.initTerrain(terrainGrid.terrain, terrainGrid.width, terrainGrid.height);

    // Bake minimap terrain
    minimap.bakeTerrainFromGrid(terrainGrid);

    // Recreate terrain-dependent systems
    pathManager = new PathManager(terrainGrid);
    combatSystem = new CombatSystem(terrainGrid);
    fatigueSystem = new FatigueSystem(terrainGrid);
    supplySystem = new SupplySystem(terrainGrid);
    fogOfWarSystem = new FogOfWarSystem(terrainGrid, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);
    aiFogOfWar = new FogOfWarSystem(terrainGrid, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);
    fogOfWarRenderer.clear();
  }

  // --- Reset battle state between campaigns ---
  function resetBattleSystems(): void {
    // Clear all units
    unitManager.deserialize({ units: [], nextId: 1 });
    orderManager.deserialize([]);
    commandSystem.deserialize({ messengers: [], nextMessengerId: 1, queue: [] });
    supplySystem.deserialize({ armies: [] });
    surrenderSystem.deserialize({ teamStates: [] });
    retreatSystem.deserialize({ retreatingTeams: [], retreatStartTick: [], lastStalemateCheck: 0 });
    battleEventLogger.deserialize({
      events: [], moraleHistory: [], supplyHistory: [], casualtyHistory: [],
      startTick: 0, endTick: 0, sampleInterval: 20,
    });
    battleEnded = false;
    battleStartTick = 0;
    environmentState = null;
    fogOfWarSystem.reset();
    aiFogOfWar.reset();
    aiController.reset();
    fogOfWarRenderer.clear();

    // Reset game state (tick counter etc.)
    gameState.deserialize({ tickNumber: 0, paused: true, speedMultiplier: 1, battleTimeTicks: 0 });

    // Clear QoL visual state
    minimap.hide();
    tooltipSystem.destroy();
    orderQueueRenderer.hide();
    if (replayControls) { replayControls.destroy(); replayControls = null; }
    replayPlayer = null;

    // Clear visual state
    selectionManager.deselectAll();
    unitRenderer.update(unitManager.getAll(), 0);
    messengerRenderer.update(commandSystem.getActiveMessengers(), 0);
    combatRenderer.update(combatSystem.getEngagedPairs(unitManager), 0);
    commandRadiusRenderer.update(undefined, 0, 0);
    dragArrowRenderer.hide();
    deploymentRenderer.clear();
    deploymentSidebar.hide();
    battleHUD.hide();
    speedControls.hide();
    environmentHUD.update(null);
    hotkeyManager.setBattleActive(false);
    afterActionReport.hide();
    battleEndOverlay.hide();
  }

  // --- AI personality per territory (deterministic from territory ID + campaign seed) ---
  function getAIPersonalityForTerritory(territoryId: string | null, campaignSeed: number): AIPersonalityType {
    if (!territoryId) return AIPersonalityType.BALANCED;
    let hash = campaignSeed;
    for (let i = 0; i < territoryId.length; i++) hash = (hash * 31 + territoryId.charCodeAt(i)) | 0;
    const types = [AIPersonalityType.AGGRESSIVE, AIPersonalityType.DEFENSIVE, AIPersonalityType.CUNNING, AIPersonalityType.BALANCED] as const;
    return types[Math.abs(hash) % 4];
  }

  // --- Start a battle from campaign ---
  function startBattle(territoryId: string): void {
    const state = campaignManager.getState();
    const tm = campaignManager.getTerritoryManager();
    const territory = tm.get(territoryId);
    if (!territory) return;

    currentBattleTerritoryId = territoryId;
    appMode = 'battle';

    // Hide all campaign screens
    campaignMapScreen.hide();
    campScreen.hide();
    intelScreen.hide();

    // Reset battle state
    resetBattleSystems();

    // Generate terrain for this territory
    regenerateTerrain(state.seed + state.turn * 100 + territory.id.length, territory.terrainTemplate);

    // Convert campaign roster to deployment roster
    const readySquads = campaignManager.getPlayerRosterForDeployment();
    const deployRoster = readySquads.map(s => ({
      type: s.type,
      size: s.size,
      experience: s.experience,
      isGeneral: s.type === UnitType.GENERAL,
      squadId: s.squadId,
    }));

    // Always add General if not in roster
    const hasGeneral = deployRoster.some(r => r.type === UnitType.GENERAL);
    if (!hasGeneral && state.roster.generalAlive) {
      deployRoster.push({
        type: UnitType.GENERAL,
        size: 1,
        experience: state.roster.generalExperience,
        isGeneral: true,
        squadId: -1,
      });
    }

    // Start deployment
    deploymentManager.startDeployment(deployRoster, terrainGrid, currentTemplateId);
    deploymentSidebar.show();
    deploymentSidebar.setRoster(deploymentManager.getRoster());

    const zone = deploymentManager.getZone();
    if (zone) {
      deploymentRenderer.renderZone(zone, TILE_SIZE, renderer.pixiRenderer);
    }

    // Ensure renderer is showing battle visuals
    renderer.render(0);

    // Stop any previous loop, then start fresh for this battle
    gameLoop.stop();
    gameLoop.start();
  }

  // --- Spawn campaign enemy army ---
  function spawnCampaignEnemy(): void {
    const state = campaignManager.getState();
    const tm = campaignManager.getTerritoryManager();
    const territory = currentBattleTerritoryId ? tm.get(currentBattleTerritoryId) : null;
    if (!territory) {
      spawnDefaultEnemyArmy(unitManager);
      return;
    }

    const enemySquads = enemyArmyGenerator.generate(
      territory, state.turn, state.territoriesConquered, state.seed,
    );

    const enemyCol = Math.floor(terrainGrid.width * 0.75);
    const centerRow = Math.floor(terrainGrid.height / 2);
    const spacing = 4;
    const blocked = new Set([TerrainType.WATER, TerrainType.MOUNTAINS, TerrainType.RIVER]);
    const startRow = centerRow - Math.floor((enemySquads.length - 1) / 2) * spacing;

    for (let i = 0; i < enemySquads.length; i++) {
      const row = startRow + i * spacing;
      const pos = findValidPos(terrainGrid.width, terrainGrid.height, enemyCol, row, blocked);
      unitManager.spawn({
        type: enemySquads[i].type,
        team: 1,
        x: pos.x,
        y: pos.y,
        size: enemySquads[i].size,
        experience: enemySquads[i].experience,
        isGeneral: enemySquads[i].isGeneral,
      });
    }
  }

  // --- Collect battle result for campaign processing ---
  function collectBattleResult(winnerTeam: number, victoryType: number): BattleResult {
    const playerUnits = unitManager.getByTeam(0);
    const enemyUnits = unitManager.getByTeam(1);

    let totalEnemiesDefeated = 0;
    for (const u of enemyUnits) {
      totalEnemiesDefeated += u.maxSize - u.size;
    }

    let totalPlayerLosses = 0;
    const survivingPlayerSquads: BattleResult['survivingPlayerSquads'] = [];
    for (const u of playerUnits) {
      totalPlayerLosses += u.maxSize - u.size;
      if (u.state !== UnitState.DEAD && u.size > 0) {
        survivingPlayerSquads.push({
          squadId: (u as any).squadId ?? u.id,
          type: u.type,
          size: u.size,
          experience: u.experience,
        });
      }
    }

    // Captured enemy squads (for clemency)
    const capturedEnemySquads: BattleResult['capturedEnemySquads'] = [];
    if (winnerTeam === 0 && victoryType === VictoryType.SURRENDER) {
      for (const u of enemyUnits) {
        if (u.state !== UnitState.DEAD && u.size > 0 && !u.isGeneral) {
          capturedEnemySquads.push({
            type: u.type,
            size: u.size,
            experience: u.experience,
          });
        }
      }
    }

    const generalAlive = playerUnits.some(u => u.isGeneral && u.state !== UnitState.DEAD);
    const noSquadFullyLost = !playerUnits.some(
      u => !u.isGeneral && u.state === UnitState.DEAD,
    );

    return {
      won: winnerTeam === 0,
      victoryType,
      generalAlive,
      survivingPlayerSquads,
      capturedEnemySquads,
      totalEnemiesDefeated,
      totalPlayerLosses,
      battleDurationTicks: gameState.getState().tickNumber - battleStartTick,
      noSquadFullyLost,
    };
  }

  // --- Handle battle continue (after AAR "Continue" button) ---
  function onBattleContinue(winnerTeam: number, victoryType: number): void {
    afterActionReport.hide();
    const result = collectBattleResult(winnerTeam, victoryType);

    // Handle clemency for surrendered enemy
    if (result.won && result.capturedEnemySquads.length > 0) {
      const totalCaptured = result.capturedEnemySquads.reduce((sum, s) => sum + s.size, 0);
      clemencyModal.show(totalCaptured, (accepted) => {
        if (!accepted) {
          result.capturedEnemySquads.length = 0; // Clear captured
        }
        finishBattleProcessing(result);
      });
    } else {
      finishBattleProcessing(result);
    }
  }

  function finishBattleProcessing(result: BattleResult): void {
    // Step 16: Record player tendencies and train adaptation layer
    if (aiController instanceof AIAdapter) {
      aiController.tendencyTracker.recordBattleEnd();
      const difficulty = settingsManager.get('difficulty');
      if (aiController.difficultyManager.isAdaptationEnabled(difficulty)) {
        const history = aiController.tendencyTracker.getHistory();
        // Outcome: positive if AI won, negative if player won
        const outcomes = history.map(() => result.won ? -1 : 1);
        aiController.adaptationLayer.train(history, outcomes);
        aiController.adaptationLayer.applyDecay(10);
        aiController.adaptationLayer.saveWeights().catch(() => {});
      }
    }

    campaignManager.processBattleResult(result);

    // Check run end conditions
    const runStatus = campaignManager.checkRunEnd();
    if (runStatus === 'win' || runStatus === 'lose') {
      campaignManager.transitionTo(CampaignPhase.RUN_OVER);
      const pointsEarned = campaignManager.calculateUnlockPoints();
      if (campaignManager.getState().mode === 'ironman') {
        unlockManager.addRunResult({
          territoriesConquered: campaignManager.getState().territoriesConquered,
          battlesWon: campaignManager.getState().battlesWon,
          won: runStatus === 'win',
          bonusObjectivesCompleted: campaignManager.getState().bonusObjectivesCompleted.length,
        });
      }
      // Delete ironman save on run end
      saveManager.deleteCampaignSave().catch(() => {});
      runSummaryScreen.show(campaignManager.getState(), unlockManager, pointsEarned);
    } else {
      campaignManager.transitionTo(CampaignPhase.CAMPAIGN_MAP);
      showCampaignMap();
      // Auto-save campaign state
      if (campaignManager.getState().mode === 'ironman') {
        saveManager.saveCampaign(campaignManager.getState()).catch(e =>
          console.warn('Campaign auto-save failed', e),
        );
      }
    }

    // Stop game loop — not needed during campaign UI
    gameLoop.stop();
    appMode = 'campaign_ui';
    currentBattleTerritoryId = null;
  }

  // --- Campaign UI helpers ---
  function showCampaignMap(): void {
    campaignMapScreen.show(campaignManager.getState(), campaignManager.getTerritoryManager());
  }

  function showCampScreen(): void {
    campScreen.show(campaignManager.getState(), recruitmentManager, unlockManager);
  }

  // --- Wire campaign screen callbacks ---

  // NewRunScreen
  newRunScreen.setOnStart((territoryId, mode) => {
    newRunScreen.hide();
    const seed = Date.now();
    const unlockedTypes = unlockManager.getUnlockedUnitTypes();
    const startingExp = unlockManager.getStartingExp();
    campaignManager.startNewRun(seed, territoryId, unlockedTypes, startingExp);
    // Set mode on state
    const state = campaignManager.getState();
    state.mode = mode;
    campaignManager.transitionTo(CampaignPhase.CAMPAIGN_MAP);
    showCampaignMap();
    eventBus.emit('campaign:runStarted', { seed, startTerritoryId: territoryId });
  });

  // CampaignMapScreen
  campaignMapScreen.setCallbacks({
    onCamp: () => {
      campaignMapScreen.hide();
      campaignManager.transitionTo(CampaignPhase.CAMP);
      showCampScreen();
    },
    onAttack: (territoryId: string) => {
      campaignMapScreen.hide();
      campaignManager.selectTerritory(territoryId);
      campaignManager.transitionTo(CampaignPhase.PRE_BATTLE_INTEL);

      const tm = campaignManager.getTerritoryManager();
      const territory = tm.get(territoryId)!;
      const readySquads = campaignManager.getPlayerRosterForDeployment();

      // Try to get enemy preview if spy_report was used (for now, always generate)
      const state = campaignManager.getState();
      const enemyPreview = enemyArmyGenerator.generate(
        territory, state.turn, state.territoriesConquered, state.seed,
      );

      const playerHasScouts = readySquads.some(s => s.type === UnitType.SCOUTS);
      intelScreen.show(territory, readySquads, enemyPreview, playerHasScouts);
    },
    onTerritorySelected: (territoryId: string) => {
      campaignManager.selectTerritory(territoryId);
      // Re-render map with selection
      campaignMapScreen.update(campaignManager.getState(), campaignManager.getTerritoryManager());
    },
  });

  // IntelScreen
  intelScreen.setCallbacks({
    onDeploy: () => {
      intelScreen.hide();
      const territoryId = campaignManager.getState().selectedTerritoryId;
      if (territoryId) {
        campaignManager.transitionTo(CampaignPhase.BATTLE);
        startBattle(territoryId);
      }
    },
    onCancel: () => {
      intelScreen.hide();
      campaignManager.transitionTo(CampaignPhase.CAMPAIGN_MAP);
      showCampaignMap();
    },
  });

  // CampScreen
  campScreen.setCallbacks({
    onReturnToMap: () => {
      campScreen.hide();
      campaignManager.transitionTo(CampaignPhase.CAMPAIGN_MAP);
      showCampaignMap();
    },
    onAdvanceTurn: () => {
      campaignManager.advanceTurn();

      // Check for random events
      const state = campaignManager.getState();
      const eventId = randomEventSystem.rollForEvent(state.seed, state.turn, state);
      if (eventId) {
        const def = randomEventSystem.getDefinition(eventId);
        if (def) {
          randomEventModal.show(def, (choiceIndex) => {
            const outcome = randomEventSystem.applyChoice(
              eventId, choiceIndex, state, campaignManager.getTerritoryManager(),
            );
            console.log('Event outcome:', outcome);
            // Re-render camp with updated state
            showCampScreen();
          });
        }
      }

      // Auto-save after turn advance
      if (state.mode === 'ironman') {
        saveManager.saveCampaign(state).catch(e =>
          console.warn('Campaign auto-save failed', e),
        );
      }

      // Re-render camp
      showCampScreen();
    },
    onRecruit: (type) => {
      const state = campaignManager.getState();
      const unlockedTypes = unlockManager.getUnlockedUnitTypes();
      const check = recruitmentManager.canRecruit(type, state.resources, state.roster, unlockedTypes);
      if (check.allowed) {
        const newSquad = recruitmentManager.recruit(type, state, unlockedTypes);
        if (newSquad) state.roster.squads.push(newSquad);
      }
    },
    onReinforce: (squadId) => {
      const state = campaignManager.getState();
      const squad = state.roster.squads.find(s => s.squadId === squadId);
      if (squad) {
        const check = recruitmentManager.canReinforce(squad, state.resources);
        if (check.allowed) {
          const result = recruitmentManager.reinforce(squad, state.resources);
          if (result) {
            state.resources.gold -= result.cost.gold;
            state.resources.population -= result.cost.population;
          }
        }
      }
    },
    onPromote: (squadId) => {
      const state = campaignManager.getState();
      const squad = state.roster.squads.find(s => s.squadId === squadId);
      if (squad) {
        const check = recruitmentManager.canPromote(squad, state.resources, state.roster);
        if (check.allowed) {
          const result = recruitmentManager.promote(squad, state.resources);
          if (result) {
            state.resources.gold -= result.cost.gold;
            state.resources.iron -= result.cost.iron;
          }
        }
      }
    },
    onDismiss: (squadId) => {
      const state = campaignManager.getState();
      const idx = state.roster.squads.findIndex(s => s.squadId === squadId);
      if (idx !== -1) {
        const squad = state.roster.squads[idx];
        const { goldRecovered } = recruitmentManager.dismiss(squad);
        state.resources.gold += goldRecovered;
        state.roster.squads.splice(idx, 1);
      }
    },
    onRest: () => {
      const state = campaignManager.getState();
      recruitmentManager.restArmy(state.roster);
    },
  });

  // RunSummaryScreen
  runSummaryScreen.setOnNewRun(() => {
    runSummaryScreen.hide();
    // Show new run screen again
    const tm = campaignManager.getTerritoryManager();
    newRunScreen.show(tm.getStartingCandidates());
  });

  // AfterActionReport — wire continue callback for campaign
  afterActionReport.setOnContinue(() => {
    onBattleContinue(
      lastBattleWinnerTeam,
      lastBattleVictoryType,
    );
  });

  // AfterActionReport — wire "Watch Replay" button
  afterActionReport.setOnWatchReplay(() => {
    if (!lastReplaySnapshot) return;
    afterActionReport.hide();

    // Enter replay mode
    appMode = 'replay';
    replayPlayer = new ReplayPlayer(lastReplaySnapshot);

    // Reset battle state and re-run from beginning
    resetBattleSystems();
    regenerateTerrain(lastReplaySnapshot.terrainSeed, lastReplaySnapshot.templateId);

    // Re-spawn initial units
    for (const snap of lastReplaySnapshot.initialUnits) {
      unitManager.spawn({
        type: snap.type as UnitType,
        team: snap.team,
        x: snap.x, y: snap.y,
        size: snap.size,
        experience: snap.experience,
        isGeneral: snap.isGeneral,
      });
    }

    // Initialize environment from replay
    const envInit = lastReplaySnapshot.environmentInit;
    environmentState = {
      weather: envInit.weather,
      windDirection: envInit.windDirection,
      timeOfDay: envInit.timeOfDay,
      currentTick: 0,
      battleStartTime: envInit.timeOfDay,
    };

    // Initialize systems for replay
    supplySystem.initArmy(0);
    supplySystem.initArmy(1);
    surrenderSystem.initBattle(unitManager);
    battleStartTick = 0;
    battleEnded = false;

    // Show replay controls
    replayControls = new ReplayControls(container);
    replayControls.show(replayPlayer.getTotalTicks());
    replayControls.setOnExit(() => {
      eventBus.emit('replay:ended', undefined);
    });
    minimap.show();

    // Start game loop for replay
    gameState.deserialize({ tickNumber: 0, paused: false, speedMultiplier: 1, battleTimeTicks: 0 });
    gameLoop.stop();
    gameLoop.start();
    gameLoop.resume();

    eventBus.emit('replay:started', { totalTicks: replayPlayer.getTotalTicks() });
  });

  // Track battle result for the continue callback
  let lastBattleWinnerTeam = 0;
  let lastBattleVictoryType = 0;

  // --- Deployment drag state ---
  let dragRosterId: number | null = null;
  let dragActive = false;
  let dragUnitType: UnitType = UnitType.JI_HALBERDIERS;
  let dragStartScreenX = 0;
  let dragStartScreenY = 0;
  let mouseScreenX = 0;
  let mouseScreenY = 0;

  // --- Right-drag arrow state ---
  let rightDragWorldX = 0;
  let rightDragWorldY = 0;

  // --- Sim tick ---
  let lastFrameTime = performance.now();

  gameLoop.onSimTick((dt) => {
    if (appMode !== 'battle' && appMode !== 'replay') return;

    perfMonitor.recordTickStart();

    gameState.tick(dt);
    const tick = gameState.getState().tickNumber;

    // Update spatial hash before systems that use it
    pathManager.updateSpatialHash(unitManager.getAll());
    pathManager.tick(tick);

    // Command system: advance messengers, deliver orders
    commandSystem.tick(tick, unitManager, orderManager, pathManager);

    // Battle-phase systems
    if (deploymentManager.phase === DeploymentPhase.BATTLE) {
      // Environment systems first (Step 9b)
      if (environmentState) {
        environmentState.currentTick = tick;
        weatherSystem.tick(environmentState);
        timeOfDaySystem.tick(environmentState);
      }

      // Fog of War (Step 13) — before supply so FOW state is fresh for current tick
      fogOfWarSystem.tick(tick, unitManager.getByTeam(0), unitManager.getByTeam(1), environmentState);

      // AI Fog of War (team 1 perspective — swapped args) + AI decisions (Step 14)
      aiFogOfWar.tick(tick, unitManager.getByTeam(1), unitManager.getByTeam(0), environmentState);
      if (aiController instanceof AIAdapter) {
        aiController.tick(tick, unitManager, commandSystem, orderManager, supplySystem, surrenderSystem, environmentState, gameState.getState().paused);
      } else {
        aiController.tick(tick, unitManager, commandSystem, orderManager, supplySystem, environmentState, gameState.getState().paused);
      }

      supplySystem.tick(unitManager, environmentState ?? undefined);
      fatigueSystem.tick(unitManager, orderManager, supplySystem.getAllFoodPercents(), environmentState ?? undefined);
      combatSystem.tick(tick, unitManager, pathManager.spatialHash, moraleSystem, supplySystem.getAllFoodPercents(), environmentState ?? undefined);
      experienceSystem.tick(unitManager);
      moraleSystem.tick(unitManager, orderManager, supplySystem.getAllFoodPercents(), terrainGrid, environmentState ?? undefined);

      // Surrender check (after morale, before unitManager.tick)
      if (!battleEnded) {
        surrenderSystem.tick(tick, unitManager, supplySystem);
        retreatSystem.tick(unitManager, tick);

        // Battle event logger sampling (every 10 ticks)
        battleEventLogger.sample(tick, unitManager, supplySystem);

        // Stalemate check every 20 ticks
        if (tick % 20 === 0) {
          retreatSystem.checkStalemate(unitManager, tick);
        }

        // Annihilation check: all enemy units dead
        for (const checkTeam of [0, 1]) {
          const aliveUnits = unitManager.getByTeam(checkTeam)
            .filter(u => u.state !== UnitState.DEAD);
          if (aliveUnits.length === 0) {
            const winnerTeam = checkTeam === 0 ? 1 : 0;
            eventBus.emit('battle:ended', {
              winnerTeam,
              victoryType: VictoryType.ANNIHILATION,
            });
          }
        }
      }
    }

    // Replay mode: issue recorded orders at the correct tick
    if (appMode === 'replay' && replayPlayer) {
      const replayOrders = replayPlayer.getOrdersForTick(tick);
      for (const ro of replayOrders) {
        const order = { type: ro.orderType, unitId: ro.unitId, targetX: ro.targetX, targetY: ro.targetY };
        const unit = unitManager.get(ro.unitId);
        if (unit) unit.pendingOrderType = ro.orderType;
        commandSystem.issueOrder(order, unitManager, false);
      }
      eventBus.emit('replay:tick', { currentTick: tick, totalTicks: replayPlayer.getTotalTicks() });
    }

    // Unit movement + order effects
    unitManager.tick(dt, pathManager, orderManager);
    deploymentManager.tick(dt, unitManager);

    perfMonitor.recordTickEnd();
    perfMonitor.setUnitCounts(
      unitManager.getByTeam(0).filter(u => u.state !== UnitState.DEAD).length +
      unitManager.getByTeam(1).filter(u => u.state !== UnitState.DEAD).length,
      unitManager.count,
    );
  });

  gameLoop.onRender((alpha) => {
    if (appMode !== 'battle' && appMode !== 'replay') return;

    perfMonitor.recordFrameStart();

    const now = performance.now();
    const frameDt = now - lastFrameTime;
    lastFrameTime = now;

    inputManager.update(frameDt);
    camera.update(frameDt);
    renderer.applyCamera(camera);

    unitRenderer.update(unitManager.getAll(), alpha, fogOfWarSystem.getVisibleEnemyIds());
    fogOfWarRenderer.update(fogOfWarSystem);
    selectionRenderer.update(
      selectionManager, (id) => unitManager.get(id), alpha, frameDt,
      inputManager.boxSelectRect,
    );
    orderRenderer.update(
      orderManager, selectionManager, (id) => unitManager.get(id), alpha,
      unitManager.getAll(), frameDt,
    );

    // Command + combat rendering
    const playerGeneral = unitManager.getGeneral(0);
    commandRadiusRenderer.update(playerGeneral, commandSystem.commandRadius, alpha);
    messengerRenderer.update(commandSystem.getActiveMessengers(), alpha);
    combatRenderer.update(combatSystem.getEngagedPairs(unitManager), alpha);

    // Right-drag arrow
    if (dragArrowRenderer.active) {
      let cx = 0, cy = 0, count = 0;
      for (const id of selectionManager.selectedIds) {
        const u = unitManager.get(id);
        if (u) {
          cx += u.prevX + (u.x - u.prevX) * alpha;
          cy += u.prevY + (u.y - u.prevY) * alpha;
          count++;
        }
      }
      if (count > 0) {
        dragArrowRenderer.update(cx / count, cy / count, rightDragWorldX, rightDragWorldY);
      }
    }

    // Ghost during deployment drag
    if (deploymentManager.phase === DeploymentPhase.DEPLOYING && dragActive) {
      const world = camera.screenToWorld(mouseScreenX, mouseScreenY);
      const dZone = deploymentManager.getZone();
      const isValid = dZone ? dZone.isInZone(world.x, world.y) : false;
      deploymentRenderer.showGhost(world.x, world.y, dragUnitType, isValid);
    }

    // Environment HUD (Step 9b)
    environmentHUD.update(environmentState);

    // Step 10: Speed Controls, Alert System, Battle HUD — show only during battle
    if (deploymentManager.phase === DeploymentPhase.BATTLE) {
      speedControls.show();
      speedControls.update(gameState.getState().paused, gameState.getState().speedMultiplier);
      alertSystem.update(frameDt);
      battleHUD.update(unitManager, supplySystem, surrenderSystem, gameState);
    } else {
      speedControls.hide();
    }

    const mousePos = inputManager.getMouseScreenPos();
    radialMenu.updateHover(mousePos.x, mousePos.y);
    // Unit Info Panel (updates every frame for live stat bars)
    unitInfoPanel.update(selectionManager, unitManager);
    // QoL overlays
    minimap.update(unitManager, fogOfWarSystem, camera);
    tooltipSystem.update(mouseScreenX, mouseScreenY, unitManager, terrainGrid, fogOfWarSystem);
    orderQueueRenderer.update(selectionManager, orderManager, unitManager, camera);
    perfMonitor.update();

    renderer.updateFPS(gameLoop.currentFPS, gameLoop.currentTick, unitManager.count);
    renderer.render(alpha);

    perfMonitor.recordFrameEnd();
  });

  // --- Game state events ---
  // Wire pause/resume events to both gameState AND gameLoop
  eventBus.on('game:paused', () => {
    gameState.setPaused(true);
    // Also pause the loop if it wasn't already (handles Space key / SpeedControls)
    if (gameLoop.running && !gameLoop.paused) {
      gameLoop._pauseInternal();
    }
  });
  eventBus.on('game:resumed', () => {
    gameState.setPaused(false);
    // Also resume the loop if it was paused
    if (gameLoop.running && gameLoop.paused) {
      gameLoop._resumeInternal();
    }
    // Flush queued orders on unpause
    commandSystem.flushQueue(unitManager, gameState.getState().tickNumber);
  });
  eventBus.on('speed:changed', ({ multiplier }) => {
    gameState.setSpeedMultiplier(multiplier);
    gameLoop._setSpeedInternal(multiplier);
  });

  // --- Replay exit ---
  eventBus.on('replay:ended', () => {
    appMode = 'campaign_ui';
    replayPlayer = null;
    if (replayControls) { replayControls.destroy(); replayControls = null; }
    gameLoop.stop();
    minimap.hide();

    // Show after-action report again
    afterActionReport.show(
      battleEventLogger.getMetrics(), unitManager,
      lastBattleVictoryType, lastBattleWinnerTeam,
    );
  });

  // --- Deployment countdown start: resume game loop so ticks advance ---
  eventBus.on('deployment:countdownStarted', () => {
    gameLoop.resume();
  });

  // --- Deployment countdown tick ---
  eventBus.on('deployment:countdownTick', ({ remaining }) => {
    deploymentSidebar.showCountdown(remaining);
  });

  // --- Battle transition ---
  eventBus.on('deployment:battleStarted', () => {
    deploymentSidebar.hide();
    deploymentRenderer.clear();
    gameLoop.resume();

    // Spawn enemy army: campaign-generated or default
    if (currentBattleTerritoryId) {
      spawnCampaignEnemy();
    } else {
      spawnDefaultEnemyArmy(unitManager);
    }

    // Initialize supply for both armies (uses SUPPLY_BASE_CAPACITY default)
    supplySystem.initArmy(0);
    supplySystem.initArmy(1);

    // Initialize environment (Step 9b)
    const initialWeather = weatherSystem.getInitialWeather();
    environmentState = {
      weather: initialWeather.weather,
      windDirection: initialWeather.windDirection,
      timeOfDay: TimeOfDay.DAWN,
      currentTick: 0,
      battleStartTime: TimeOfDay.DAWN,
    };

    // Initialize surrender tracking (Step 9c)
    surrenderSystem.initBattle(unitManager);
    battleStartTick = gameState.getState().tickNumber;
    battleEnded = false;

    // Initialize AI (Step 14)
    aiFogOfWar = new FogOfWarSystem(terrainGrid, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);
    const aiPersonality = getAIPersonalityForTerritory(
      currentBattleTerritoryId,
      campaignManager.getState().seed,
    );
    aiController = new AIAdapter(
      1, aiPersonality, currentSeed + 7777, aiFogOfWar, terrainGrid,
      eventBus, settingsManager, aiUnitLookup,
    );
    aiController.initBattle(unitManager);

    // Step 10: Initialize alert system + show battle HUD + start event logging
    alertSystem.init();
    battleHUD.show();
    battleEventLogger.startLogging(battleStartTick);
    hotkeyManager.setBattleActive(true);

    // QoL: Show minimap, start replay recording
    minimap.show();
    replayRecorder.startRecording(
      currentSeed, currentTemplateId,
      [...unitManager.getByTeam(0), ...unitManager.getByTeam(1)],
      { weather: environmentState!.weather, timeOfDay: environmentState!.timeOfDay,
        windDirection: environmentState!.windDirection, visibility: 1 },
      aiPersonality, currentSeed + 7777,
    );

    // Step 11: Start auto-save during battle
    saveManager.startAutoSave(SAVE_AUTO_INTERVAL_MS);
  });

  // --- Replay: record delivered orders ---
  eventBus.on('command:orderDelivered', ({ targetUnitId, orderType }) => {
    if (appMode !== 'battle' || battleEnded) return;
    const unit = unitManager.get(targetUnitId);
    if (!unit) return;
    const order = orderManager.getOrder(targetUnitId);
    const tick = gameState.getState().tickNumber - battleStartTick;
    replayRecorder.recordOrder(
      tick, targetUnitId, orderType as OrderType,
      order?.targetX ?? unit.x, order?.targetY ?? unit.y,
      undefined, unit.team,
    );
  });

  // --- Battle end handler (Step 9c) ---
  eventBus.on('battle:ended', ({ winnerTeam, victoryType }) => {
    if (battleEnded) return;
    battleEnded = true;

    // Track for continue callback
    lastBattleWinnerTeam = winnerTeam;
    lastBattleVictoryType = victoryType;

    // Stop event logging, replay recording, auto-save, pause
    battleEventLogger.stopLogging(gameState.getState().tickNumber);
    lastReplaySnapshot = replayRecorder.stopRecording(gameState.getState().tickNumber - battleStartTick);
    saveManager.stopAutoSave();
    gameLoop._pauseInternal();
    gameState.setPaused(true);

    // Play cinematic then show after-action report
    battleCinematic.play(victoryType).then(() => {
      afterActionReport.show(
        battleEventLogger.getMetrics(), unitManager, victoryType, winnerTeam,
      );
      battleEndOverlay.hide();
    });
  });

  // --- Retreat completed → defeat ---
  eventBus.on('retreat:completed', ({ team }) => {
    if (!battleEnded) {
      const winnerTeam = team === 0 ? 1 : 0;
      eventBus.emit('battle:ended', {
        winnerTeam,
        victoryType: VictoryType.RETREAT,
      });
    }
  });

  // --- Stalemate detected → show withdraw option ---
  eventBus.on('stalemate:detected', () => {
    if (!battleEnded) {
      alertSystem.fire('stalemate', '僵局 — Stalemate detected. Consider retreat.', 'warning');
    }
  });

  // --- General killed → army-wide morale hit + victory condition ---
  eventBus.on('combat:unitDestroyed', ({ unitId }) => {
    const unit = unitManager.get(unitId);
    if (unit?.isGeneral) {
      moraleSystem.applyGeneralKilled(unit.team, unitManager);
      // General killed victory condition (Step 9c)
      if (!battleEnded) {
        const winnerTeam = unit.team === 0 ? 1 : 0;
        eventBus.emit('battle:ended', {
          winnerTeam,
          victoryType: VictoryType.GENERAL_KILLED,
        });
      }
    }
  });

  // --- Unit routed → winning engagement morale boost ---
  eventBus.on('unit:routed', ({ unitId }) => {
    const routedUnit = unitManager.get(unitId);
    if (routedUnit) {
      moraleSystem.applyWinningEngagement(unitManager, routedUnit);
    }
  });

  // --- Supply collapse → set morale to 0 for all alive units of that team ---
  eventBus.on('supply:collapse', ({ team }) => {
    for (const unit of unitManager.getByTeam(team)) {
      if (unit.state !== UnitState.DEAD) {
        unit.morale = 0;
      }
    }
  });

  // --- Mouse tracking for drag ---
  renderer.canvas.addEventListener('mousemove', (e: MouseEvent) => {
    const rect = renderer.canvas.getBoundingClientRect();
    mouseScreenX = e.clientX - rect.left;
    mouseScreenY = e.clientY - rect.top;

    // Update drag state
    if (dragRosterId !== null && !dragActive) {
      const dx = mouseScreenX - dragStartScreenX;
      const dy = mouseScreenY - dragStartScreenY;
      if (dx * dx + dy * dy > CAMERA_DRAG_DEAD_ZONE * CAMERA_DRAG_DEAD_ZONE) {
        dragActive = true;
      }
    }
  });

  // --- Deployment drop on mouseup (input:click is suppressed during left-drags) ---
  window.addEventListener('mouseup', (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (deploymentManager.phase !== DeploymentPhase.DEPLOYING) return;
    if (!dragActive || dragRosterId === null) return;

    const rect = renderer.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = camera.screenToWorld(sx, sy);

    deploymentManager.placeUnit(dragRosterId, world.x, world.y, unitManager);
    deploymentSidebar.updateRoster(deploymentManager.getRoster());
    dragRosterId = null;
    dragActive = false;
    inputManager.suppressLeftDrag = false;
    deploymentRenderer.hideGhost();
  });

  // --- Input: mouseDown (sidebar drag initiation) ---
  eventBus.on('input:mouseDown', ({ screenX, screenY }) => {
    if (deploymentManager.phase !== DeploymentPhase.DEPLOYING) return;

    // Check sidebar hits
    if (deploymentSidebar.containsPoint(screenX, screenY)) {
      const rosterId = deploymentSidebar.getRosterItemAt(screenX, screenY);
      if (rosterId !== null) {
        const entry = deploymentManager.getRoster().find(e => e.rosterId === rosterId);
        if (entry && !entry.placed) {
          dragRosterId = rosterId;
          dragActive = false;
          dragUnitType = entry.type;
          dragStartScreenX = screenX;
          dragStartScreenY = screenY;
          inputManager.suppressLeftDrag = true;
        }
      }
    }
  });

  // Helper to issue order through command system
  function issueOrderViaCommand(unitId: number, orderType: OrderType, targetX: number, targetY: number): void {
    const order = { type: orderType, unitId, targetX, targetY };
    const unit = unitManager.get(unitId);
    if (unit) {
      unit.pendingOrderType = orderType;
    }
    commandSystem.issueOrder(order, unitManager, gameState.getState().paused);
  }

  // --- Input: click ---
  eventBus.on('input:click', ({ worldX, worldY, screenX, screenY, shift }) => {
    if (appMode !== 'battle') return;

    // --- Deployment mode ---
    if (deploymentManager.phase === DeploymentPhase.DEPLOYING) {
      // Handle drag drop (place unit)
      if (dragActive && dragRosterId !== null) {
        deploymentManager.placeUnit(dragRosterId, worldX, worldY, unitManager);
        deploymentSidebar.updateRoster(deploymentManager.getRoster());
        dragRosterId = null;
        dragActive = false;
        inputManager.suppressLeftDrag = false;
        deploymentRenderer.hideGhost();
        return;
      }

      // Reset drag on any click
      if (dragRosterId !== null) {
        dragRosterId = null;
        dragActive = false;
        inputManager.suppressLeftDrag = false;
        deploymentRenderer.hideGhost();
      }

      // Check sidebar button clicks
      if (deploymentSidebar.containsPoint(screenX, screenY)) {
        // Formation dropdown item
        if (deploymentSidebar.getFormationAt(screenX, screenY) !== null) {
          const formation = deploymentSidebar.getFormationAt(screenX, screenY)!;
          deploymentManager.applyFormation(formation as FormationType, unitManager);
          deploymentSidebar.updateRoster(deploymentManager.getRoster());
          deploymentSidebar.toggleFormationDropdown();
          return;
        }

        // Begin battle button
        if (deploymentSidebar.isBeginButtonAt(screenX, screenY)) {
          deploymentManager.beginCountdown();
          return;
        }

        // Formation button
        if (deploymentSidebar.isFormationButtonAt(screenX, screenY)) {
          deploymentSidebar.toggleFormationDropdown();
          return;
        }

        return; // Consume click within sidebar
      }

      return; // Don't pass to selection during deployment
    }

    // --- Normal mode (post-deployment) ---
    // If radial menu is open, check for wedge click
    if (radialMenu.visible) {
      const orderType = radialMenu.getOrderAtPoint(screenX, screenY);
      if (orderType !== -1) {
        for (const id of selectionManager.selectedIds) {
          issueOrderViaCommand(id, orderType, radialMenu.worldX, radialMenu.worldY);
        }
      }
      radialMenu.hide();
      return;
    }

    const hitId = selectionManager.getUnitAtPoint(worldX, worldY, unitManager.getAll(), camera.zoom);
    if (hitId !== -1) {
      if (shift) selectionManager.toggleSelection(hitId);
      else selectionManager.select(hitId);
    } else {
      selectionManager.deselectAll();
    }
  });

  // --- Input: boxSelect ---
  eventBus.on('input:boxSelect', ({ x1, y1, x2, y2 }) => {
    if (deploymentManager.phase === DeploymentPhase.DEPLOYING) return;
    const ids = selectionManager.getUnitsInRect(x1, y1, x2, y2, unitManager.getAll());
    selectionManager.selectMultiple(ids);
  });

  // --- Input: rightClick ---
  eventBus.on('input:rightClick', ({ worldX, worldY, screenX, screenY }) => {
    // During deployment: right-click to remove placed unit
    if (deploymentManager.phase === DeploymentPhase.DEPLOYING) {
      const hitId = selectionManager.getUnitAtPoint(worldX, worldY, unitManager.getAll(), camera.zoom);
      if (hitId !== -1) {
        const rosterEntry = deploymentManager.getRosterByUnitId(hitId);
        if (rosterEntry) {
          deploymentManager.removeUnit(rosterEntry.rosterId, unitManager);
          deploymentSidebar.updateRoster(deploymentManager.getRoster());
        }
      }
      return;
    }

    // Normal mode
    if (radialMenu.visible) { radialMenu.hide(); return; }
    if (selectionManager.count > 0) {
      radialMenu.show(screenX, screenY, worldX, worldY);
    }
  });

  // --- Input: rightDrag (direct move order via command system) ---
  eventBus.on('input:rightDragStart', () => {
    if (deploymentManager.phase === DeploymentPhase.DEPLOYING) return;
    if (selectionManager.count > 0) {
      dragArrowRenderer.show();
    }
  });

  eventBus.on('input:rightDragMove', ({ worldX, worldY }) => {
    rightDragWorldX = worldX;
    rightDragWorldY = worldY;
  });

  eventBus.on('input:rightDragEnd', ({ worldX, worldY, shift }) => {
    if (deploymentManager.phase === DeploymentPhase.DEPLOYING) return;
    dragArrowRenderer.hide();
    if (selectionManager.count === 0) return;

    if (shift) {
      // Shift+right-drag: append to order queue
      for (const id of selectionManager.selectedIds) {
        const order = { type: OrderType.MOVE, unitId: id, targetX: worldX, targetY: worldY };
        orderManager.appendOrder(id, order);
      }
    } else {
      for (const id of selectionManager.selectedIds) {
        issueOrderViaCommand(id, OrderType.MOVE, worldX, worldY);
      }
    }
  });

  // ESC deselect
  eventBus.on('selection:changed', ({ ids }) => {
    if (ids.length === 0) {
      radialMenu.hide();
      selectionManager.deselectAll();
    }
  });

  // --- Default enemy army spawning (non-campaign fallback) ---
  function spawnDefaultEnemyArmy(um: UnitManager): void {
    const enemyCol = Math.floor(terrainGrid.width * 0.75);
    const centerRow = Math.floor(terrainGrid.height / 2);
    const spacing = 4;
    const blocked = new Set([TerrainType.WATER, TerrainType.MOUNTAINS, TerrainType.RIVER]);

    const enemySquads: Array<{ type: UnitType; isGeneral?: boolean }> = [
      { type: UnitType.JI_HALBERDIERS },
      { type: UnitType.JI_HALBERDIERS },
      { type: UnitType.HEAVY_CAVALRY },
      { type: UnitType.NU_CROSSBOWMEN },
      { type: UnitType.HORSE_ARCHERS },
      { type: UnitType.GONG_ARCHERS },
      { type: UnitType.ELITE_GUARD },
      { type: UnitType.GENERAL, isGeneral: true },
    ];

    const startRow = centerRow - Math.floor((enemySquads.length - 1) / 2) * spacing;

    for (let i = 0; i < enemySquads.length; i++) {
      const row = startRow + i * spacing;
      const pos = findValidPos(terrainGrid.width, terrainGrid.height, enemyCol, row, blocked);
      um.spawn({
        type: enemySquads[i].type,
        team: 1,
        x: pos.x,
        y: pos.y,
        isGeneral: enemySquads[i].isGeneral,
      });
    }
  }

  function findValidPos(
    w: number, h: number, tileX: number, tileY: number, blocked: Set<number>,
  ): { x: number; y: number } {
    if (tileX >= 0 && tileX < w && tileY >= 0 && tileY < h) {
      if (!blocked.has(terrainGrid.getTerrain(tileX, tileY))) {
        return { x: tileX * TILE_SIZE + TILE_SIZE / 2, y: tileY * TILE_SIZE + TILE_SIZE / 2 };
      }
    }
    for (let radius = 1; radius < 20; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const tx = tileX + dx;
          const ty = tileY + dy;
          if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
          if (!blocked.has(terrainGrid.getTerrain(tx, ty))) {
            return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
          }
        }
      }
    }
    return { x: (w / 2) * TILE_SIZE, y: (h / 2) * TILE_SIZE };
  }

  // Debug console access
  (window as any).__alkaid = {
    gameLoop, gameState, renderer, eventBus,
    terrainGrid, terrainRenderer, camera, inputManager,
    unitManager, unitRenderer,
    selectionManager, orderManager,
    selectionRenderer, orderRenderer, radialMenu,
    pathManager, commandSystem, combatSystem, moraleSystem,
    deploymentManager, deploymentRenderer, deploymentSidebar, dragArrowRenderer,
    messengerRenderer, commandRadiusRenderer, combatRenderer,
    fatigueSystem, supplySystem, experienceSystem,
    weatherSystem, timeOfDaySystem, environmentHUD, environmentState,
    surrenderSystem, battleEndOverlay, speedControls, pauseMenu, alertSystem, battleHUD,
    hotkeyManager, retreatSystem, codex, battleEventLogger, afterActionReport, battleCinematic,
    saveManager, saveLoadScreen, saveToast,
    campaignManager, unlockManager, recruitmentManager, enemyArmyGenerator, randomEventSystem,
    newRunScreen, campaignMapScreen, campScreen, intelScreen,
    settingsManager, settingsScreen, perfMonitor, minimap, tooltipSystem,
    orderQueueRenderer, replayRecorder, pathWorkerClient,
    spawnUnit: (type: UnitType, team: number, x: number, y: number) =>
      unitManager.spawn({ type, team, x, y }),
    pause: () => gameLoop.pause(),
    resume: () => gameLoop.resume(),
    setSpeed: (s: number) => gameLoop.setSpeed(s),
    regen: (newSeed?: number, newTemplate?: string) => {
      const s = newSeed ?? Date.now();
      const t = newTemplate ?? currentTemplateId;
      regenerateTerrain(s, t);
      console.log(`Regenerated: seed=${s}, template=${t}`);
    },
  };

  // --- Startup Flow ---
  const landingScreen = new LandingScreen();

  const startCampaignFlow = async () => {
    // Check for existing campaign save
    const hasCampaign = await saveManager.hasCampaignSave();
    if (hasCampaign) {
      const campaignSnapshot = await saveManager.loadCampaign();
      if (campaignSnapshot) {
        campaignManager.deserialize(campaignSnapshot.campaignState);
        console.log('Campaign save loaded — resuming campaign');
        showCampaignMap();
      } else {
        const tm = campaignManager.getTerritoryManager();
        newRunScreen.show(tm.getStartingCandidates());
      }
    } else {
      const tm = campaignManager.getTerritoryManager();
      newRunScreen.show(tm.getStartingCandidates());
    }
  };

  landingScreen.setOnStart(() => startCampaignFlow());
  landingScreen.show();

  // Apply initial colorblind settings if not 'off'
  if (settingsManager.get('colorblindMode') !== 'off') {
    const colors = settingsManager.getTeamColors();
    unitRenderer.setColorOverrides(colors.player, colors.enemy);
  }

  console.log('Alkaid (破军) — Campaign Mode');
  console.log('Select a starting territory to begin your campaign');

  // Game loop stays stopped during campaign UI — starts when entering battle
}

main().catch((err) => {
  console.error('Failed to initialize Alkaid:', err);
  document.body.innerHTML = `<pre style="color:red;padding:20px">Failed to start:\n${err.message}</pre>`;
});
