import { describe, it, expect, vi } from 'vitest';

vi.mock('pixi.js', () => ({
  Container: class { addChild() {} removeChild() {} },
  Graphics: class {
    visible = true; alpha = 1; position = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    scale = { set(s: number) {} };
    clear() { return this; } circle() { return this; } fill() { return this; } stroke() { return this; }
    moveTo() { return this; } lineTo() { return this; }
    destroy() {}
  },
}));

import { BattleEffects } from '../BattleEffects';
import { Container } from 'pixi.js';

describe('BattleEffects', () => {
  it('spawns impact particles', () => {
    const layer = new Container();
    const fx = new BattleEffects(layer);
    fx.spawnImpact(100, 100);
    // Update should animate without crashing
    fx.update(0.016);
    fx.destroy();
  });

  it('spawns arrow volley', () => {
    const layer = new Container();
    const fx = new BattleEffects(layer);
    fx.spawnArrowVolley(0, 0, 100, 100);
    fx.update(0.016);
    fx.destroy();
  });

  it('spawns damage flash', () => {
    const layer = new Container();
    const fx = new BattleEffects(layer);
    fx.spawnDamageFlash(50, 50);
    fx.update(0.016);
    fx.destroy();
  });

  it('spawns unit destroyed effect', () => {
    const layer = new Container();
    const fx = new BattleEffects(layer);
    fx.spawnUnitDestroyed(75, 75);
    fx.update(0.016);
    fx.destroy();
  });

  it('spawns rout dust', () => {
    const layer = new Container();
    const fx = new BattleEffects(layer);
    fx.spawnRoutDust(50, 50);
    fx.update(0.016);
    fx.destroy();
  });

  it('particles expire after their lifetime', () => {
    const layer = new Container();
    const fx = new BattleEffects(layer);
    fx.spawnDamageFlash(50, 50); // life = 0.1s
    fx.update(0.2); // > lifetime
    // Should not crash, particle returned to pool
    fx.destroy();
  });

  it('clear removes all active particles', () => {
    const layer = new Container();
    const fx = new BattleEffects(layer);
    fx.spawnImpact(100, 100);
    fx.clear();
    fx.update(0.016); // Should handle empty active array
    fx.destroy();
  });
});
