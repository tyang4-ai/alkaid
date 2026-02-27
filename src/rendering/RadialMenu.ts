import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  OrderType, ORDER_DISPLAY,
  RADIAL_MENU_RADIUS, RADIAL_MENU_INNER_RADIUS,
  RADIAL_MENU_WEDGE_COLOR, RADIAL_MENU_HOVER_COLOR,
  RADIAL_MENU_BORDER_COLOR, RADIAL_MENU_FONT_SIZE,
} from '../constants';

const ORDER_TYPES: OrderType[] = [
  OrderType.MOVE, OrderType.ATTACK, OrderType.HOLD, OrderType.RETREAT,
  OrderType.FLANK, OrderType.CHARGE, OrderType.FORM_UP, OrderType.DISENGAGE,
];
const WEDGE_COUNT = ORDER_TYPES.length;
const WEDGE_ANGLE = (Math.PI * 2) / WEDGE_COUNT;

export class RadialMenu {
  readonly container: Container;
  private wedgeGraphics: Graphics;
  private labels: Text[] = [];
  private hoveredIndex = -1;
  private _visible = false;
  private _worldX = 0;
  private _worldY = 0;

  get visible(): boolean { return this._visible; }
  get worldX(): number { return this._worldX; }
  get worldY(): number { return this._worldY; }

  constructor(uiLayer: Container) {
    this.container = new Container();
    this.container.visible = false;
    uiLayer.addChild(this.container);

    this.wedgeGraphics = new Graphics();
    this.container.addChild(this.wedgeGraphics);

    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: RADIAL_MENU_FONT_SIZE,
      fill: 0xDDDDDD,
      stroke: { color: 0x000000, width: 2 },
    });

    for (let i = 0; i < WEDGE_COUNT; i++) {
      const startAngle = WEDGE_ANGLE * i - Math.PI / 2;
      const midAngle = startAngle + WEDGE_ANGLE / 2;
      // Place labels outside the ring, always horizontal
      const labelR = RADIAL_MENU_RADIUS + 14;
      const lx = Math.cos(midAngle) * labelR;
      const ly = Math.sin(midAngle) * labelR;

      const info = ORDER_DISPLAY[ORDER_TYPES[i]];
      const text = new Text({ text: info.label, style });
      text.anchor.set(0.5);
      text.position.set(lx, ly);
      this.container.addChild(text);
      this.labels.push(text);
    }
  }

  show(screenX: number, screenY: number, worldX: number, worldY: number): void {
    this.container.position.set(screenX, screenY);
    this.container.visible = true;
    this._visible = true;
    this._worldX = worldX;
    this._worldY = worldY;
    this.hoveredIndex = -1;
    this.redraw();
  }

  hide(): void {
    this.container.visible = false;
    this._visible = false;
    this.hoveredIndex = -1;
  }

  updateHover(screenX: number, screenY: number): void {
    if (!this._visible) return;
    const idx = this.getWedgeIndex(screenX, screenY);
    if (idx !== this.hoveredIndex) {
      this.hoveredIndex = idx;
      this.redraw();
    }
  }

  getOrderAtPoint(screenX: number, screenY: number): OrderType | -1 {
    const idx = this.getWedgeIndex(screenX, screenY);
    if (idx === -1) return -1;
    return ORDER_TYPES[idx];
  }

  private getWedgeIndex(screenX: number, screenY: number): number {
    const cx = this.container.x;
    const cy = this.container.y;
    const dx = screenX - cx;
    const dy = screenY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < RADIAL_MENU_INNER_RADIUS || dist > RADIAL_MENU_RADIUS + 15) return -1;

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    return Math.floor(angle / WEDGE_ANGLE) % WEDGE_COUNT;
  }

  private redraw(): void {
    this.wedgeGraphics.clear();

    for (let i = 0; i < WEDGE_COUNT; i++) {
      const startAngle = WEDGE_ANGLE * i - Math.PI / 2;
      const endAngle = startAngle + WEDGE_ANGLE;
      const isHovered = i === this.hoveredIndex;
      const fillColor = isHovered ? RADIAL_MENU_HOVER_COLOR : RADIAL_MENU_WEDGE_COLOR;
      const orderColor = ORDER_DISPLAY[ORDER_TYPES[i]].color;

      const r = RADIAL_MENU_RADIUS;
      const ir = RADIAL_MENU_INNER_RADIUS;

      // Wedge background
      this.wedgeGraphics
        .moveTo(Math.cos(startAngle) * ir, Math.sin(startAngle) * ir)
        .lineTo(Math.cos(startAngle) * r, Math.sin(startAngle) * r)
        .arc(0, 0, r, startAngle, endAngle)
        .lineTo(Math.cos(endAngle) * ir, Math.sin(endAngle) * ir)
        .arc(0, 0, ir, endAngle, startAngle, true)
        .fill({ color: fillColor, alpha: 0.9 })
        .stroke({ width: 1, color: RADIAL_MENU_BORDER_COLOR, alpha: 0.5 });

      // Colored accent line on outer edge of wedge
      const midAngle = startAngle + WEDGE_ANGLE / 2;
      const accentPad = 0.04; // slight inset from wedge edges
      this.wedgeGraphics
        .arc(0, 0, r - 1, startAngle + accentPad, endAngle - accentPad)
        .stroke({ width: 3, color: orderColor, alpha: isHovered ? 1.0 : 0.6 });

      this.labels[i].style.fill = isHovered ? 0xFFFFFF : 0xCCCCCC;
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
