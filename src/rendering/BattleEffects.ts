import { Container, Graphics } from 'pixi.js';
import { eventBus } from '../core/EventBus';

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  fadeOut: boolean;
}

export class BattleEffects {
  private pool: Graphics[] = [];
  private active: Particle[] = [];

  constructor(effectLayer: Container) {
    // Pre-allocate pool
    for (let i = 0; i < 200; i++) {
      const g = new Graphics();
      g.visible = false;
      effectLayer.addChild(g);
      this.pool.push(g);
    }
    this.subscribe();
  }

  private subscribe(): void {
    eventBus.on('combat:chargeImpact', (_data: { unitId: number; targetId: number; damage: number }) => {
      // We don't have unit positions here, so we'll use a simple burst
      // In practice, main.ts would need to pass coordinates
    });
  }

  /** Burst of 5-8 particles outward from a point */
  spawnImpact(x: number, y: number, color = 0xFFAA33): void {
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) break;
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 30 + Math.random() * 50;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.3 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.fadeOut = true;
      p.gfx.clear();
      p.gfx.circle(0, 0, 2);
      p.gfx.fill(color);
      p.gfx.position.set(x, y);
      p.gfx.visible = true;
      p.gfx.alpha = 1;
    }
  }

  /** Arrow volley: 3-5 arcing line segments */
  spawnArrowVolley(sx: number, sy: number, tx: number, ty: number): void {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) break;
      const dx = tx - sx + (Math.random() - 0.5) * 30;
      const dy = ty - sy + (Math.random() - 0.5) * 30;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = 200 + Math.random() * 100;
      p.vx = (dx / dist) * speed;
      p.vy = (dy / dist) * speed;
      p.life = dist / speed;
      p.maxLife = p.life;
      p.fadeOut = false;
      p.gfx.clear();
      p.gfx.moveTo(0, 0).lineTo(-dx / dist * 6, -dy / dist * 6);
      p.gfx.stroke({ width: 1.5, color: 0xCCCCCC });
      p.gfx.position.set(sx + (Math.random() - 0.5) * 20, sy + (Math.random() - 0.5) * 20);
      p.gfx.visible = true;
      p.gfx.alpha = 0.8;
    }
  }

  /** Brief red flash at a position */
  spawnDamageFlash(x: number, y: number): void {
    const p = this.acquire();
    if (!p) return;
    p.vx = 0;
    p.vy = 0;
    p.life = 0.1;
    p.maxLife = 0.1;
    p.fadeOut = true;
    p.gfx.clear();
    p.gfx.circle(0, 0, 8);
    p.gfx.fill({ color: 0xFF0000, alpha: 0.4 });
    p.gfx.position.set(x, y);
    p.gfx.visible = true;
    p.gfx.alpha = 1;
  }

  /** Expand + fade circle for destroyed unit */
  spawnUnitDestroyed(x: number, y: number): void {
    const p = this.acquire();
    if (!p) return;
    p.vx = 0;
    p.vy = 0;
    p.life = 0.5;
    p.maxLife = 0.5;
    p.fadeOut = true;
    p.gfx.clear();
    p.gfx.circle(0, 0, 4);
    p.gfx.fill({ color: 0xFF4444, alpha: 0.6 });
    p.gfx.position.set(x, y);
    p.gfx.visible = true;
    p.gfx.alpha = 1;
  }

  /** Trailing dust for routed units */
  spawnRoutDust(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const p = this.acquire();
      if (!p) break;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -10 - Math.random() * 20;
      p.life = 0.4 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.fadeOut = true;
      p.gfx.clear();
      p.gfx.circle(0, 0, 1.5 + Math.random() * 1.5);
      p.gfx.fill({ color: 0x8B7355, alpha: 0.5 });
      p.gfx.position.set(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8);
      p.gfx.visible = true;
      p.gfx.alpha = 1;
    }
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p);
        this.active.splice(i, 1);
        continue;
      }
      p.gfx.position.x += p.vx * dt;
      p.gfx.position.y += p.vy * dt;
      if (p.fadeOut) {
        p.gfx.alpha = Math.max(0, p.life / p.maxLife);
      }
      // Expand effect for destroyed units
      if (p.maxLife === 0.5 && p.vx === 0 && p.vy === 0) {
        const progress = 1 - p.life / p.maxLife;
        p.gfx.scale.set(1 + progress * 2);
      }
    }
  }

  private acquire(): Particle | null {
    const gfx = this.pool.pop();
    if (!gfx) return null;
    const p: Particle = { gfx, vx: 0, vy: 0, life: 0, maxLife: 0, fadeOut: false };
    this.active.push(p);
    return p;
  }

  private release(p: Particle): void {
    p.gfx.visible = false;
    p.gfx.scale.set(1);
    this.pool.push(p.gfx);
  }

  clear(): void {
    for (const p of this.active) {
      this.release(p);
    }
    this.active.length = 0;
  }

  destroy(): void {
    this.clear();
    for (const g of this.pool) {
      g.destroy();
    }
    this.pool.length = 0;
  }
}
