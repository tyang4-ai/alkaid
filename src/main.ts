import { Renderer } from './rendering/Renderer';
import { TerrainRenderer } from './rendering/TerrainRenderer';
import { GameLoop } from './core/GameLoop';
import { GameState } from './simulation/GameState';
import { TerrainGenerator } from './simulation/terrain/TerrainGenerator';
import { Camera } from './core/Camera';
import { InputManager } from './core/InputManager';
import { eventBus } from './core/EventBus';
import { DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, TILE_SIZE } from './constants';

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

  // Camera + input
  const mapPixelW = DEFAULT_MAP_WIDTH * TILE_SIZE;
  const mapPixelH = DEFAULT_MAP_HEIGHT * TILE_SIZE;
  const camera = new Camera(mapPixelW, mapPixelH, window.innerWidth, window.innerHeight);
  camera.snap();
  const inputManager = new InputManager(camera, renderer.canvas);

  const gameState = new GameState();
  const gameLoop = new GameLoop();

  let lastFrameTime = performance.now();

  gameLoop.onSimTick((dt) => gameState.tick(dt));
  gameLoop.onRender((alpha) => {
    const now = performance.now();
    const frameDt = now - lastFrameTime;
    lastFrameTime = now;

    inputManager.update(frameDt);
    camera.update(frameDt);
    renderer.applyCamera(camera);

    renderer.updateFPS(gameLoop.currentFPS, gameLoop.currentTick);
    renderer.render(alpha);
  });

  eventBus.on('game:paused', () => gameState.setPaused(true));
  eventBus.on('game:resumed', () => gameState.setPaused(false));
  eventBus.on('speed:changed', ({ multiplier }) =>
    gameState.setSpeedMultiplier(multiplier),
  );

  // Debug console access
  (window as any).__alkaid = {
    gameLoop, gameState, renderer, eventBus,
    terrainGrid, terrainRenderer, camera, inputManager,
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
  console.log('Camera: WASD/arrows to pan, scroll to zoom, middle-click drag');
  console.log('Debug: __alkaid.regen(seed?, template?) to regenerate');
  console.log('Templates: river_valley, mountain_pass, open_plains, wetlands, siege');
  gameLoop.start();
}

main().catch((err) => {
  console.error('Failed to initialize Alkaid:', err);
  document.body.innerHTML = `<pre style="color:red;padding:20px">Failed to start:\n${err.message}</pre>`;
});
