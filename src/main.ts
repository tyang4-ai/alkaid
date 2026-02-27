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
import { BattleEndOverlay, type BattleResult } from './rendering/BattleEndOverlay';
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
} from './constants';
import type { FormationType } from './constants';

async function main(): Promise<void> {
  const container = document.getElementById('game-container');
  if (!container) throw new Error('Missing #game-container');

  const renderer = new Renderer();
  await renderer.init(container);

  // Generate terrain
  const seed = Date.now();
  const templateId = 'river_valley';
  const terrainGen = new TerrainGenerator(seed);
  const terrainGrid = terrainGen.generate(templateId);

  // Render terrain
  const terrainRenderer = new TerrainRenderer(renderer.terrainLayer);
  terrainRenderer.bake(terrainGrid, renderer.pixiRenderer);
  eventBus.emit('terrain:generated', { seed, templateId });

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

  // Pathfinding
  const pathManager = new PathManager(terrainGrid);

  // Command System (Step 7)
  const commandSystem = new CommandSystem();

  // Combat System (Step 8)
  const combatSystem = new CombatSystem(terrainGrid);
  const moraleSystem = new MoraleSystem();

  // Metrics Systems (Step 9a)
  const fatigueSystem = new FatigueSystem(terrainGrid);
  const supplySystem = new SupplySystem(terrainGrid);
  const experienceSystem = new ExperienceSystem();

  // Unit Info Panel (Step 9a)
  const unitInfoPanel = new UnitInfoPanel(container);

  // Environment Systems (Step 9b)
  const weatherSystem = new WeatherSystem(seed);
  const timeOfDaySystem = new TimeOfDaySystem(TimeOfDay.DAWN);
  const environmentHUD = new EnvironmentHUD(container);
  let environmentState: EnvironmentState | null = null;

  // Surrender System (Step 9c)
  const surrenderSystem = new SurrenderSystem();
  const battleEndOverlay = new BattleEndOverlay(container);
  let battleStartTick = 0;
  let battleEnded = false;

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

  const gameState = new GameState();
  const gameLoop = new GameLoop();

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

  // --- Start deployment ---
  const startingRoster = [
    { type: UnitType.JI_HALBERDIERS, size: 120, experience: 0 },
    { type: UnitType.JI_HALBERDIERS, size: 120, experience: 0 },
    { type: UnitType.DAO_SWORDSMEN, size: 80, experience: 0 },
    { type: UnitType.NU_CROSSBOWMEN, size: 100, experience: 0 },
    { type: UnitType.NU_CROSSBOWMEN, size: 100, experience: 0 },
    { type: UnitType.GONG_ARCHERS, size: 80, experience: 0 },
    { type: UnitType.LIGHT_CAVALRY, size: 40, experience: 0 },
    { type: UnitType.GENERAL, size: 1, experience: 50, isGeneral: true },
  ];

  deploymentManager.startDeployment(startingRoster, terrainGrid, templateId);
  deploymentSidebar.show();
  deploymentSidebar.setRoster(deploymentManager.getRoster());

  const zone = deploymentManager.getZone();
  if (zone) {
    deploymentRenderer.renderZone(zone, TILE_SIZE, renderer.pixiRenderer);
  }

  // --- Sim tick ---
  let lastFrameTime = performance.now();

  gameLoop.onSimTick((dt) => {
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

      supplySystem.tick(unitManager, environmentState ?? undefined);
      fatigueSystem.tick(unitManager, orderManager, supplySystem.getAllFoodPercents(), environmentState ?? undefined);
      combatSystem.tick(tick, unitManager, pathManager.spatialHash, moraleSystem, supplySystem.getAllFoodPercents(), environmentState ?? undefined);
      experienceSystem.tick(unitManager);
      moraleSystem.tick(unitManager, orderManager, supplySystem.getAllFoodPercents(), terrainGrid, environmentState ?? undefined);

      // Surrender check (after morale, before unitManager.tick)
      if (!battleEnded) {
        surrenderSystem.tick(tick, unitManager, supplySystem);

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

    // Unit movement + order effects
    unitManager.tick(dt, pathManager, orderManager);
    deploymentManager.tick(dt, unitManager);
  });

  gameLoop.onRender((alpha) => {
    const now = performance.now();
    const frameDt = now - lastFrameTime;
    lastFrameTime = now;

    inputManager.update(frameDt);
    camera.update(frameDt);
    renderer.applyCamera(camera);

    unitRenderer.update(unitManager.getAll(), alpha);
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

    const mousePos = inputManager.getMouseScreenPos();
    radialMenu.updateHover(mousePos.x, mousePos.y);
    // Unit Info Panel (updates every frame for live stat bars)
    unitInfoPanel.update(selectionManager, unitManager);
    renderer.updateFPS(gameLoop.currentFPS, gameLoop.currentTick, unitManager.count);
    renderer.render(alpha);
  });

  // --- Game state events ---
  eventBus.on('game:paused', () => gameState.setPaused(true));
  eventBus.on('game:resumed', () => {
    gameState.setPaused(false);
    // Flush queued orders on unpause
    commandSystem.flushQueue(unitManager, gameState.getState().tickNumber);
  });
  eventBus.on('speed:changed', ({ multiplier }) =>
    gameState.setSpeedMultiplier(multiplier),
  );

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
    spawnEnemyArmy(unitManager);

    // Initialize supply for both armies
    supplySystem.initArmy(0, 100, 100);
    supplySystem.initArmy(1, 100, 100);

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
  });

  // --- Battle end handler (Step 9c) ---
  eventBus.on('battle:ended', ({ winnerTeam, victoryType }) => {
    if (battleEnded) return;
    battleEnded = true;

    // Compute battle result
    const playerAlive = unitManager.getByTeam(0).filter(u => u.state !== UnitState.DEAD);
    const enemyAlive = unitManager.getByTeam(1).filter(u => u.state !== UnitState.DEAD);
    let playerCurrent = 0, enemyCurrent = 0;
    for (const u of playerAlive) playerCurrent += u.size;
    for (const u of enemyAlive) enemyCurrent += u.size;

    // Estimate starting from maxSize (approximate)
    let playerStarting = 0, enemyStarting = 0;
    for (const u of unitManager.getByTeam(0)) {
      playerStarting += u.maxSize;
    }
    for (const u of unitManager.getByTeam(1)) {
      enemyStarting += u.maxSize;
    }

    const result: BattleResult = {
      winnerTeam,
      playerTeam: 0,
      victoryType,
      playerCasualties: playerStarting - playerCurrent,
      playerStarting,
      enemyCasualties: enemyStarting - enemyCurrent,
      enemyStarting,
      durationTicks: gameState.getState().tickNumber - battleStartTick,
    };

    battleEndOverlay.show(result);
    gameLoop.pause();
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

  eventBus.on('input:rightDragEnd', ({ worldX, worldY }) => {
    if (deploymentManager.phase === DeploymentPhase.DEPLOYING) return;
    dragArrowRenderer.hide();
    if (selectionManager.count === 0) return;

    for (const id of selectionManager.selectedIds) {
      issueOrderViaCommand(id, OrderType.MOVE, worldX, worldY);
    }
  });

  // ESC deselect
  eventBus.on('selection:changed', ({ ids }) => {
    if (ids.length === 0) {
      radialMenu.hide();
      selectionManager.deselectAll();
    }
  });

  // --- Enemy army spawning ---
  function spawnEnemyArmy(um: UnitManager): void {
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
    surrenderSystem, battleEndOverlay,
    spawnUnit: (type: UnitType, team: number, x: number, y: number) =>
      unitManager.spawn({ type, team, x, y }),
    pause: () => gameLoop.pause(),
    resume: () => gameLoop.resume(),
    setSpeed: (s: number) => gameLoop.setSpeed(s),
    regen: (newSeed?: number, newTemplate?: string) => {
      const s = newSeed ?? Date.now();
      const t = newTemplate ?? templateId;
      const gen = new TerrainGenerator(s);
      const grid = gen.generate(t);
      terrainRenderer.bake(grid, renderer.pixiRenderer);
      console.log(`Regenerated: seed=${s}, template=${t}`);
    },
  };

  console.log(`Alkaid (破军) — Terrain seed: ${seed}, template: ${templateId}`);
  console.log('DEPLOYMENT PHASE: Drag units from sidebar to deployment zone');
  console.log('Right-click placed units to remove them');
  console.log('Select a formation, then click Begin Battle');
  console.log('Debug: __alkaid.commandSystem, __alkaid.combatSystem, __alkaid.moraleSystem');

  gameLoop.start();
  gameLoop.pause(); // Start paused for deployment
}

main().catch((err) => {
  console.error('Failed to initialize Alkaid:', err);
  document.body.innerHTML = `<pre style="color:red;padding:20px">Failed to start:\n${err.message}</pre>`;
});
