import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { Messenger } from '../simulation/command/Messenger';

export class MessengerRenderer {
  private graphics: Graphics;

  constructor(worldLayer: Container) {
    this.graphics = new Graphics();
    worldLayer.addChild(this.graphics);
  }

  update(messengers: readonly Messenger[], _alpha: number): void {
    this.graphics.clear();

    for (const m of messengers) {
      if (m.delivered) continue;

      // Draw fading trail
      for (let i = 0; i < m.trail.length; i++) {
        const t = m.trail[i];
        const age = (m.trail.length - i) / m.trail.length;
        const alpha = Math.max(0.05, 0.4 * (1 - age));
        const radius = 1.5;
        this.graphics.circle(t.x, t.y, radius);
        this.graphics.fill({ color: 0xFFD700, alpha });
      }

      // Draw glow around main dot
      this.graphics.circle(m.currentX, m.currentY, 6);
      this.graphics.fill({ color: 0xFFD700, alpha: 0.15 });

      // Draw main messenger dot
      this.graphics.circle(m.currentX, m.currentY, 3);
      this.graphics.fill({ color: 0xFFD700, alpha: 0.9 });
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
