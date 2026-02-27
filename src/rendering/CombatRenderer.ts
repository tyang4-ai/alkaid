import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { Unit } from '../simulation/units/Unit';

const ATTACK_LINE_COLOR = 0xCC3333;
const ATTACK_LINE_ALPHA = 0.35;
const ATTACK_LINE_WIDTH = 1;

export class CombatRenderer {
  private graphics: Graphics;

  constructor(worldLayer: Container) {
    this.graphics = new Graphics();
    worldLayer.addChild(this.graphics);
  }

  update(pairs: Array<{ attacker: Unit; defender: Unit }>, alpha: number): void {
    this.graphics.clear();

    for (const { attacker, defender } of pairs) {
      const ax = attacker.prevX + (attacker.x - attacker.prevX) * alpha;
      const ay = attacker.prevY + (attacker.y - attacker.prevY) * alpha;
      const dx = defender.prevX + (defender.x - defender.prevX) * alpha;
      const dy = defender.prevY + (defender.y - defender.prevY) * alpha;

      this.graphics.moveTo(ax, ay);
      this.graphics.lineTo(dx, dy);
      this.graphics.stroke({
        width: ATTACK_LINE_WIDTH,
        color: ATTACK_LINE_COLOR,
        alpha: ATTACK_LINE_ALPHA,
      });
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
