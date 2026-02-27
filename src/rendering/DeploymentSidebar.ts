import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { RosterEntry } from '../simulation/deployment/RosterEntry';
import type { FormationType } from '../constants';
import {
  SIDEBAR_WIDTH, SIDEBAR_BG_COLOR, SIDEBAR_BG_ALPHA,
  SIDEBAR_ITEM_HEIGHT, SIDEBAR_PADDING, SIDEBAR_FONT_COLOR,
  SIDEBAR_HIGHLIGHT_COLOR, SIDEBAR_BUTTON_COLOR,
  UNIT_TYPE_CONFIGS, UNIT_TYPE_SHAPE, UNIT_SHAPE,
  TEAM_COLORS, FORMATION_DISPLAY, FormationType as FT,
} from '../constants';

const TITLE_HEIGHT = 40;
const BUTTON_HEIGHT = 36;
const DROPDOWN_ITEM_HEIGHT = 32;

export class DeploymentSidebar {
  private container: Container;
  private parentLayer: Container;
  private bg: Graphics;
  private titleText: Text;
  private itemsContainer: Container;
  private formationButton: Container;
  private beginButton: Container;
  private dropdownContainer: Container;
  private countdownText: Text;

  private rosterItems: Array<{
    container: Container;
    rosterId: number;
    bg: Graphics;
    checkmark: Text;
  }> = [];

  private dropdownOpen = false;
  private sidebarX = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;

  constructor(uiLayer: Container) {
    this.parentLayer = uiLayer;
    this.container = new Container();
    this.container.visible = false;

    // Background
    this.bg = new Graphics();
    this.container.addChild(this.bg);

    // Title — warm gold on lacquer, like gilded calligraphy
    const titleStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 14,
      fill: 0xC9A84C,
      fontWeight: 'bold',
    });
    this.titleText = new Text({ text: 'YOUR ARMY  部署', style: titleStyle });
    this.titleText.position.set(SIDEBAR_PADDING, SIDEBAR_PADDING);
    this.container.addChild(this.titleText);

    // Items container
    this.itemsContainer = new Container();
    this.itemsContainer.position.set(0, TITLE_HEIGHT);
    this.container.addChild(this.itemsContainer);

    // Formation button
    this.formationButton = new Container();
    this.container.addChild(this.formationButton);

    // Begin battle button
    this.beginButton = new Container();
    this.container.addChild(this.beginButton);

    // Dropdown
    this.dropdownContainer = new Container();
    this.dropdownContainer.visible = false;
    this.container.addChild(this.dropdownContainer);

    // Countdown overlay — cinnabar red, like a war drum count
    const countdownStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 72,
      fill: 0xA23B2C,
      fontWeight: 'bold',
      stroke: { color: 0x0A0806, width: 5 },
    });
    this.countdownText = new Text({ text: '', style: countdownStyle });
    this.countdownText.anchor.set(0.5);
    this.countdownText.visible = false;
    // This goes on the parent layer, not sidebar, for center-screen positioning
    this.parentLayer.addChild(this.countdownText);

    this.parentLayer.addChild(this.container);
  }

  show(): void {
    this.container.visible = true;
    this.updateLayout();
  }

  hide(): void {
    this.container.visible = false;
    this.dropdownOpen = false;
    this.dropdownContainer.visible = false;
    this.countdownText.visible = false;
  }

  setRoster(roster: readonly RosterEntry[]): void {
    // Clear existing items
    for (const item of this.rosterItems) {
      this.itemsContainer.removeChild(item.container);
      item.container.destroy({ children: true });
    }
    this.rosterItems = [];

    const nameStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 11,
      fill: SIDEBAR_FONT_COLOR,
    });
    const detailStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 9,
      fill: 0x8A7A60,
    });
    const checkStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 14,
      fill: 0x5B8C5A,
    });

    for (let i = 0; i < roster.length; i++) {
      const entry = roster[i];
      const config = UNIT_TYPE_CONFIGS[entry.type];
      const itemContainer = new Container();
      itemContainer.position.set(0, i * SIDEBAR_ITEM_HEIGHT);

      // Background
      const itemBg = new Graphics();
      itemBg.rect(0, 0, SIDEBAR_WIDTH, SIDEBAR_ITEM_HEIGHT);
      itemBg.fill({ color: i % 2 === 0 ? SIDEBAR_BG_COLOR : SIDEBAR_HIGHLIGHT_COLOR, alpha: 1 });
      itemContainer.addChild(itemBg);

      // Shape icon
      const shapeG = new Graphics();
      const shape = UNIT_TYPE_SHAPE[entry.type];
      const iconX = SIDEBAR_PADDING + 8;
      const iconY = SIDEBAR_ITEM_HEIGHT / 2;
      this.drawShapeIcon(shapeG, iconX, iconY, shape, 6, TEAM_COLORS.PLAYER);
      itemContainer.addChild(shapeG);

      // Unit name
      const suffix = entry.isGeneral ? ' ★' : '';
      const nameText = new Text({
        text: `${config.chineseName} ${config.displayName}${suffix}`,
        style: nameStyle,
      });
      nameText.position.set(SIDEBAR_PADDING + 22, 6);
      itemContainer.addChild(nameText);

      // Details
      const detailText = new Text({
        text: `${entry.size}/${entry.maxSize}  exp:${entry.experience}`,
        style: detailStyle,
      });
      detailText.position.set(SIDEBAR_PADDING + 22, 24);
      itemContainer.addChild(detailText);

      // Checkmark (hidden until placed)
      const checkmark = new Text({ text: '✓', style: checkStyle });
      checkmark.position.set(SIDEBAR_WIDTH - 24, 14);
      checkmark.visible = false;
      itemContainer.addChild(checkmark);

      this.itemsContainer.addChild(itemContainer);
      this.rosterItems.push({
        container: itemContainer,
        rosterId: entry.rosterId,
        bg: itemBg,
        checkmark,
      });
    }

    this.updateLayout();
  }

  updateRoster(roster: readonly RosterEntry[]): void {
    for (const entry of roster) {
      const item = this.rosterItems.find(r => r.rosterId === entry.rosterId);
      if (!item) continue;
      item.container.alpha = entry.placed ? 0.5 : 1.0;
      item.checkmark.visible = entry.placed;
    }
  }

  containsPoint(screenX: number, screenY: number): boolean {
    if (!this.container.visible) return false;
    return screenX >= this.sidebarX && screenX < this.sidebarX + SIDEBAR_WIDTH &&
           screenY >= 0 && screenY < this.viewportHeight;
  }

  getRosterItemAt(screenX: number, screenY: number): number | null {
    if (!this.containsPoint(screenX, screenY)) return null;
    const localY = screenY - TITLE_HEIGHT;
    if (localY < 0) return null;
    const index = Math.floor(localY / SIDEBAR_ITEM_HEIGHT);
    if (index >= 0 && index < this.rosterItems.length) {
      return this.rosterItems[index].rosterId;
    }
    return null;
  }

  isBeginButtonAt(screenX: number, screenY: number): boolean {
    if (!this.containsPoint(screenX, screenY)) return false;
    const buttonY = this.getBeginButtonY();
    const localX = screenX - this.sidebarX;
    const localY = screenY;
    return localY >= buttonY && localY < buttonY + BUTTON_HEIGHT &&
           localX >= SIDEBAR_PADDING && localX < SIDEBAR_WIDTH - SIDEBAR_PADDING;
  }

  isFormationButtonAt(screenX: number, screenY: number): boolean {
    if (!this.containsPoint(screenX, screenY)) return false;
    const buttonY = this.getFormationButtonY();
    const localX = screenX - this.sidebarX;
    const localY = screenY;
    return localY >= buttonY && localY < buttonY + BUTTON_HEIGHT &&
           localX >= SIDEBAR_PADDING && localX < SIDEBAR_WIDTH - SIDEBAR_PADDING;
  }

  toggleFormationDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
    this.dropdownContainer.visible = this.dropdownOpen;

    if (this.dropdownOpen) {
      this.buildDropdown();
    }
  }

  getFormationAt(screenX: number, screenY: number): FormationType | null {
    if (!this.dropdownOpen) return null;
    if (!this.containsPoint(screenX, screenY)) return null;
    const dropdownY = this.getFormationButtonY() + BUTTON_HEIGHT;
    const localY = screenY - dropdownY;
    if (localY < 0) return null;
    const index = Math.floor(localY / DROPDOWN_ITEM_HEIGHT);
    const formations = Object.values(FT).filter(v => typeof v === 'number') as FormationType[];
    if (index >= 0 && index < formations.length) {
      return formations[index];
    }
    return null;
  }

  showCountdown(seconds: number): void {
    if (seconds > 0) {
      this.countdownText.text = `${seconds}`;
      this.countdownText.visible = true;
      this.countdownText.position.set(
        (this.viewportWidth - SIDEBAR_WIDTH) / 2,
        this.viewportHeight / 2,
      );
    } else {
      this.countdownText.visible = false;
    }
  }

  destroy(): void {
    this.parentLayer.removeChild(this.container);
    this.container.destroy({ children: true });
    this.parentLayer.removeChild(this.countdownText);
    this.countdownText.destroy();
  }

  private updateLayout(): void {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.sidebarX = this.viewportWidth - SIDEBAR_WIDTH;
    this.container.position.set(this.sidebarX, 0);

    // Redraw background
    this.bg.clear();
    this.bg.rect(0, 0, SIDEBAR_WIDTH, this.viewportHeight);
    this.bg.fill({ color: SIDEBAR_BG_COLOR, alpha: SIDEBAR_BG_ALPHA });

    // Separator under title — aged gold line
    this.bg.moveTo(SIDEBAR_PADDING, TITLE_HEIGHT - 2)
      .lineTo(SIDEBAR_WIDTH - SIDEBAR_PADDING, TITLE_HEIGHT - 2)
      .stroke({ width: 1, color: 0x8B6914, alpha: 0.4 });

    // Position formation button
    this.buildFormationButton();
    // Position begin button
    this.buildBeginButton();
  }

  private getFormationButtonY(): number {
    return TITLE_HEIGHT + this.rosterItems.length * SIDEBAR_ITEM_HEIGHT + SIDEBAR_PADDING;
  }

  private getBeginButtonY(): number {
    return this.getFormationButtonY() + BUTTON_HEIGHT + SIDEBAR_PADDING;
  }

  private buildFormationButton(): void {
    // Clear existing
    while (this.formationButton.children.length > 0) {
      this.formationButton.removeChildAt(0);
    }

    const y = this.getFormationButtonY();
    this.formationButton.position.set(0, y);

    const bg = new Graphics();
    bg.roundRect(SIDEBAR_PADDING, 0, SIDEBAR_WIDTH - SIDEBAR_PADDING * 2, BUTTON_HEIGHT, 3);
    bg.fill({ color: SIDEBAR_HIGHLIGHT_COLOR, alpha: 1 });
    bg.stroke({ width: 1, color: 0x8B6914, alpha: 0.3 });
    this.formationButton.addChild(bg);

    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 11,
      fill: SIDEBAR_FONT_COLOR,
    });
    const text = new Text({ text: 'Formation  阵型  ▼', style });
    text.position.set(SIDEBAR_PADDING + 12, 10);
    this.formationButton.addChild(text);
  }

  private buildBeginButton(): void {
    while (this.beginButton.children.length > 0) {
      this.beginButton.removeChildAt(0);
    }

    const y = this.getBeginButtonY();
    this.beginButton.position.set(0, y);

    const bg = new Graphics();
    bg.roundRect(SIDEBAR_PADDING, 0, SIDEBAR_WIDTH - SIDEBAR_PADDING * 2, BUTTON_HEIGHT, 3);
    bg.fill({ color: SIDEBAR_BUTTON_COLOR, alpha: 1 });
    bg.stroke({ width: 1, color: 0x5A1800, alpha: 0.6 });
    this.beginButton.addChild(bg);

    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 13,
      fill: 0xF0E0C0,
      fontWeight: 'bold',
    });
    const text = new Text({ text: 'Begin Battle  开战', style });
    text.position.set(SIDEBAR_PADDING + 24, 9);
    this.beginButton.addChild(text);
  }

  private buildDropdown(): void {
    while (this.dropdownContainer.children.length > 0) {
      this.dropdownContainer.removeChildAt(0);
    }

    const startY = this.getFormationButtonY() + BUTTON_HEIGHT;
    this.dropdownContainer.position.set(0, startY);

    const formations = Object.values(FT).filter(v => typeof v === 'number') as FormationType[];
    const totalH = formations.length * DROPDOWN_ITEM_HEIGHT;

    // Dropdown background
    const bg = new Graphics();
    bg.rect(SIDEBAR_PADDING, 0, SIDEBAR_WIDTH - SIDEBAR_PADDING * 2, totalH);
    bg.fill({ color: 0x140E08, alpha: 0.96 });
    bg.stroke({ width: 1, color: 0x8B6914, alpha: 0.3 });
    this.dropdownContainer.addChild(bg);

    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 10,
      fill: SIDEBAR_FONT_COLOR,
    });

    for (let i = 0; i < formations.length; i++) {
      const f = formations[i];
      const display = FORMATION_DISPLAY[f];
      const text = new Text({
        text: `${display.chinese}  ${display.label}`,
        style,
      });
      text.position.set(SIDEBAR_PADDING + 8, i * DROPDOWN_ITEM_HEIGHT + 8);
      this.dropdownContainer.addChild(text);
    }
  }

  private drawShapeIcon(g: Graphics, cx: number, cy: number, shape: number, r: number, color: number): void {
    switch (shape) {
      case UNIT_SHAPE.CIRCLE:
        g.circle(cx, cy, r);
        break;
      case UNIT_SHAPE.TRIANGLE: {
        const h = r * Math.sqrt(3);
        g.poly([cx, cy - r, cx - h / 2, cy + r * 0.5, cx + h / 2, cy + r * 0.5]);
        break;
      }
      case UNIT_SHAPE.DIAMOND:
        g.poly([cx, cy - r, cx + r * 0.7, cy, cx, cy + r, cx - r * 0.7, cy]);
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
  }
}
