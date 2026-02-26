import { Renderer } from './rendering/Renderer';
import { GameLoop } from './core/GameLoop';
import { GameState } from './simulation/GameState';
import { eventBus } from './core/EventBus';

async function main(): Promise<void> {
  const container = document.getElementById('game-container');
  if (!container) throw new Error('Missing #game-container');

  const renderer = new Renderer();
  await renderer.init(container);

  const gameState = new GameState();
  const gameLoop = new GameLoop();

  gameLoop.onSimTick((dt) => gameState.tick(dt));
  gameLoop.onRender((alpha) => {
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
    gameLoop,
    gameState,
    renderer,
    eventBus,
    pause: () => gameLoop.pause(),
    resume: () => gameLoop.resume(),
    setSpeed: (s: number) => gameLoop.setSpeed(s),
  };

  console.log('Alkaid (破军) — War Simulator initialized');
  console.log('Debug: __alkaid.pause() / .resume() / .setSpeed(2)');
  gameLoop.start();
}

main().catch((err) => {
  console.error('Failed to initialize Alkaid:', err);
  document.body.innerHTML = `<pre style="color:red;padding:20px">Failed to start:\n${err.message}</pre>`;
});
