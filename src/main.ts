import { Renderer } from './rendering/Renderer';
import { TerrainRenderer } from './rendering/TerrainRenderer';
import { UnitRenderer } from './rendering/UnitRenderer';
import { SelectionRenderer } from './rendering/SelectionRenderer';
import { OrderRenderer } from './rendering/OrderRenderer';
import { RadialMenu } from './rendering/RadialMenu';
import { DeploymentRenderer } from './rendering/DeploymentRenderer';
import { DeploymentSidebar } from './rendering/DeploymentSidebar';
import { GameLoop } from './core/GameLoop';
import { GameState } from './simulation/GameState';
import { TerrainGenerator } from './simulation/terrain/TerrainGenerator';
import { UnitManager } from './simulation/units/UnitManager';
import { SelectionManager } from './simulation/SelectionManager';
import { OrderManager } from './simulation/OrderManager';
import { DeploymentManager } from './simulation/deployment/DeploymentManager';
import { PathManager } from './simulation/pathfinding/PathManager';
import { Camera } from './core/Camera';
import { InputManager } from './core/InputManager';
import { eventBus } from './core/EventBus';
import {
  DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, TILE_SIZE,
  UnitType, DeploymentPhase, TerrainType, OrderType,
  CAMERA_DRAG_DEAD_ZONE,
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
  const radialMenu = new RadialMenu(renderer.uiLayer);

  // Pathfinding
  const pathManager = new PathManager(terrainGrid);

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

  // --- Start deployment ---
  const startingRoster = [
    { type: UnitType.JI_HALBERDIERS, size: 120, experience: 0 },
    { type: UnitType.JI_HALBERDIERS, size: 120, experience: 0 },
    { type: UnitType.DAO_SWORDSMEN, size: 80, experience: 0 },
    { type: UnitType.NU_CROSSBOWMEN, size: 100, experience: 0 },
    { type: UnitType.NU_CROSSBOWMEN, size: 100, experience: 0 },
    { type: UnitType.GONG_ARCHERS, size: 80, experience: 0 },
    { type: UnitType.LIGHT_CAVALRY, size: 40, experience: 0 },
    { type: UnitType.ELITE_GUARD, size: 15, experience: 0, isGeneral: true },
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
    pathManager.updateSpatialHash(unitManager.getAll());
    pathManager.tick(gameState.getState().tickNumber);
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
    orderRenderer.update(orderManager, selectionManager, (id) => unitManager.get(id), alpha);

    // Ghost during deployment drag
    if (deploymentManager.phase === DeploymentPhase.DEPLOYING && dragActive) {
      const world = camera.screenToWorld(mouseScreenX, mouseScreenY);
      const dZone = deploymentManager.getZone();
      const isValid = dZone ? dZone.isInZone(world.x, world.y) : false;
      deploymentRenderer.showGhost(world.x, world.y, dragUnitType, isValid);
    }

    const mousePos = inputManager.getMouseScreenPos();
    radialMenu.updateHover(mousePos.x, mousePos.y);
    renderer.updateFPS(gameLoop.currentFPS, gameLoop.currentTick, unitManager.count);
    renderer.render(alpha);
  });

  // --- Game state events ---
  eventBus.on('game:paused', () => gameState.setPaused(true));
  eventBus.on('game:resumed', () => gameState.setPaused(false));
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
          orderManager.setOrder(id, {
            type: orderType, unitId: id,
            targetX: radialMenu.worldX, targetY: radialMenu.worldY,
          });
          // Wire MOVE orders to pathfinding
          if (orderType === OrderType.MOVE) {
            const unit = unitManager.get(id);
            if (unit) {
              unit.targetX = radialMenu.worldX;
              unit.targetY = radialMenu.worldY;
              pathManager.requestPath(unit, radialMenu.worldX, radialMenu.worldY);
            }
          }
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

    const enemySquads: UnitType[] = [
      UnitType.JI_HALBERDIERS,
      UnitType.JI_HALBERDIERS,
      UnitType.HEAVY_CAVALRY,
      UnitType.NU_CROSSBOWMEN,
      UnitType.HORSE_ARCHERS,
      UnitType.GONG_ARCHERS,
      UnitType.ELITE_GUARD,
    ];

    const startRow = centerRow - Math.floor((enemySquads.length - 1) / 2) * spacing;

    for (let i = 0; i < enemySquads.length; i++) {
      const row = startRow + i * spacing;
      const pos = findValidPos(terrainGrid.width, terrainGrid.height, enemyCol, row, blocked);
      um.spawn({ type: enemySquads[i], team: 1, x: pos.x, y: pos.y });
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
    pathManager,
    deploymentManager, deploymentRenderer, deploymentSidebar,
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
  console.log('Debug: __alkaid.deploymentManager.phase');

  gameLoop.start();
  gameLoop.pause(); // Start paused for deployment
}

main().catch((err) => {
  console.error('Failed to initialize Alkaid:', err);
  document.body.innerHTML = `<pre style="color:red;padding:20px">Failed to start:\n${err.message}</pre>`;
});
