import {
  Container, Graphics, RenderTexture, Sprite,
  type Renderer as PixiRenderer, type Texture,
} from 'pixi.js';
import type { Unit } from '../simulation/units/Unit';
import {
  UNIT_BASE_DOT_RADIUS, UNIT_MIN_DOT_RADIUS,
  UNIT_TYPE_SHAPE, UNIT_SHAPE, TEAM_COLORS,
} from '../constants';
import { spriteManager } from './SpriteManager';
import { ExperienceSystem } from '../simulation/metrics/ExperienceSystem';

// Texture size = 2 * radius + padding for stroke
const TEX_SIZE = (UNIT_BASE_DOT_RADIUS + 2) * 2;
const TEX_HALF = TEX_SIZE / 2;

/** Cache key: "shape-color" e.g. "0-4a90d9" */
function texKey(shape: number, color: number): string {
  return `${shape}-${color.toString(16)}`;
}

// Veterancy badge constants
const BADGE_PIP_RADIUS = 1.5;
const BADGE_PIP_SPACING = 4;
const BADGE_COLOR = 0xFFD700; // Gold
const BADGE_ZOOM_THRESHOLD = 1.5;

export class UnitRenderer {
  private unitLayer: Container;
  private pixiRenderer: PixiRenderer;
  private textures = new Map<string, Texture>();
  private sprites = new Map<number, Sprite>();
  private badges = new Map<number, Graphics>();
  private colorOverrides: { player: number; enemy: number } | null = null;

  constructor(unitLayer: Container, pixiRenderer: PixiRenderer) {
    this.unitLayer = unitLayer;
    this.pixiRenderer = pixiRenderer;
  }

  private getTexture(shape: number, color: number, unitType?: number): Texture {
    // Use unitType-color key if available (more specific for sprite lookup)
    const key = unitType !== undefined ? `${unitType}-${color.toString(16)}` : texKey(shape, color);
    let tex = this.textures.get(key);
    if (tex) return tex;

    // Try sprite manager first (Step 17c)
    if (unitType !== undefined && spriteManager.isLoaded()) {
      const spriteTex = spriteManager.getUnitTexture(unitType);
      if (spriteTex) {
        // Render tinted sprite into a RenderTexture
        const s = new Sprite(spriteTex);
        s.tint = color;
        s.width = TEX_SIZE;
        s.height = TEX_SIZE;
        const rt = RenderTexture.create({ width: TEX_SIZE, height: TEX_SIZE });
        this.pixiRenderer.render({ container: s, target: rt });
        s.destroy();
        this.textures.set(key, rt);
        return rt;
      }
    }

    // Fallback: geometric shape drawing
    const g = new Graphics();
    const r = UNIT_BASE_DOT_RADIUS;
    const cx = TEX_HALF;
    const cy = TEX_HALF;

    switch (shape) {
      case UNIT_SHAPE.CIRCLE:
        g.circle(cx, cy, r);
        break;
      case UNIT_SHAPE.TRIANGLE: {
        const h = r * Math.sqrt(3);
        g.poly([
          cx, cy - r,
          cx - h / 2, cy + r * 0.5,
          cx + h / 2, cy + r * 0.5,
        ]);
        break;
      }
      case UNIT_SHAPE.DIAMOND:
        g.poly([
          cx, cy - r,
          cx + r * 0.7, cy,
          cx, cy + r,
          cx - r * 0.7, cy,
        ]);
        break;
      case UNIT_SHAPE.SQUARE:
        g.rect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
        break;
      case UNIT_SHAPE.HEXAGON: {
        const pts: number[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          pts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
        }
        g.poly(pts);
        break;
      }
    }

    g.fill(color);
    g.stroke({ width: 1, color: 0x000000, alpha: 0.5 });

    const rt = RenderTexture.create({ width: TEX_SIZE, height: TEX_SIZE });
    this.pixiRenderer.render({ container: g, target: rt });
    g.destroy();

    this.textures.set(key, rt);
    return rt;
  }

  setColorOverrides(player: number, enemy: number): void {
    this.colorOverrides = { player, enemy };
    // Clear cached textures so they regenerate with new colors
    this.clear();
  }

  private teamColor(team: number): number {
    if (this.colorOverrides) {
      if (team === 0) return this.colorOverrides.player;
      if (team === 1) return this.colorOverrides.enemy;
    }
    if (team === 0) return TEAM_COLORS.PLAYER;
    if (team === 1) return TEAM_COLORS.ENEMY;
    return TEAM_COLORS.NEUTRAL;
  }

  update(units: IterableIterator<Unit>, alpha: number, visibleEnemyIds?: Set<number>, cameraZoom?: number): void {
    const seenIds = new Set<number>();
    const showBadges = (cameraZoom ?? 1) >= BADGE_ZOOM_THRESHOLD;

    for (const unit of units) {
      if (unit.state === 5) continue; // DEAD

      // FOW: hide enemy units not in visible tiles
      if (unit.team !== 0 && visibleEnemyIds && !visibleEnemyIds.has(unit.id)) {
        const hiddenSprite = this.sprites.get(unit.id);
        if (hiddenSprite) hiddenSprite.visible = false;
        const hiddenBadge = this.badges.get(unit.id);
        if (hiddenBadge) hiddenBadge.visible = false;
        seenIds.add(unit.id); // Keep sprite alive, just hidden
        continue;
      }

      seenIds.add(unit.id);

      let sprite = this.sprites.get(unit.id);
      if (!sprite) {
        const shape = UNIT_TYPE_SHAPE[unit.type];
        const color = this.teamColor(unit.team);
        const texture = this.getTexture(shape, color, unit.type);
        sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        this.unitLayer.addChild(sprite);
        this.sprites.set(unit.id, sprite);
      }

      // Ensure sprite visible (may have been hidden by FOW previously)
      sprite.visible = true;

      // Interpolated position
      const renderX = unit.prevX + (unit.x - unit.prevX) * alpha;
      const renderY = unit.prevY + (unit.y - unit.prevY) * alpha;
      sprite.position.set(renderX, renderY);

      // Scale by squad strength: sqrt for visual smoothness
      const strengthRatio = unit.size / unit.maxSize;
      const radius = Math.max(UNIT_MIN_DOT_RADIUS, UNIT_BASE_DOT_RADIUS * Math.sqrt(strengthRatio));
      const scale = radius / UNIT_BASE_DOT_RADIUS;
      sprite.scale.set(scale);

      // Opacity: weak squads fade
      sprite.alpha = 0.3 + 0.7 * strengthRatio;

      // Veterancy badges: gold pips below unit (only at high zoom)
      const tier = ExperienceSystem.getTier(unit.experience);
      if (showBadges && tier > 0) {
        let badge = this.badges.get(unit.id);
        if (!badge) {
          badge = new Graphics();
          this.unitLayer.addChild(badge);
          this.badges.set(unit.id, badge);
        }
        badge.visible = true;
        badge.clear();
        const pipCount = tier; // 1-4 pips
        const totalWidth = (pipCount - 1) * BADGE_PIP_SPACING;
        const startX = -totalWidth / 2;
        for (let i = 0; i < pipCount; i++) {
          badge.circle(startX + i * BADGE_PIP_SPACING, 0, BADGE_PIP_RADIUS);
        }
        badge.fill(BADGE_COLOR);
        badge.position.set(renderX, renderY + radius + 4);
      } else {
        const badge = this.badges.get(unit.id);
        if (badge) badge.visible = false;
      }
    }

    // Remove sprites for destroyed/dead units
    for (const [id, sprite] of this.sprites) {
      if (!seenIds.has(id)) {
        this.unitLayer.removeChild(sprite);
        sprite.destroy();
        this.sprites.delete(id);
        const badge = this.badges.get(id);
        if (badge) {
          this.unitLayer.removeChild(badge);
          badge.destroy();
          this.badges.delete(id);
        }
      }
    }
  }

  clear(): void {
    for (const sprite of this.sprites.values()) {
      this.unitLayer.removeChild(sprite);
      sprite.destroy();
    }
    this.sprites.clear();

    for (const badge of this.badges.values()) {
      this.unitLayer.removeChild(badge);
      badge.destroy();
    }
    this.badges.clear();

    for (const tex of this.textures.values()) {
      tex.destroy(true);
    }
    this.textures.clear();
  }
}
