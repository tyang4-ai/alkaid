import type { Unit } from '../simulation/units/Unit';
import type { SelectionManager } from '../simulation/SelectionManager';
import type { UnitManager } from '../simulation/units/UnitManager';
import {
  UNIT_TYPE_CONFIGS, UnitState, UnitCategory, OrderType,
  UNIT_TYPE_SHAPE, UNIT_SHAPE,
} from '../constants';
import { ExperienceSystem } from '../simulation/metrics/ExperienceSystem';

/** Shape icon for unit type. */
const SHAPE_ICONS: Record<number, string> = {
  [UNIT_SHAPE.CIRCLE]: '●',
  [UNIT_SHAPE.TRIANGLE]: '▲',
  [UNIT_SHAPE.DIAMOND]: '◆',
  [UNIT_SHAPE.SQUARE]: '■',
  [UNIT_SHAPE.HEXAGON]: '⬡',
};

/** Category display names. */
const CATEGORY_NAMES: Record<number, string> = {
  [UnitCategory.INFANTRY]: 'Infantry',
  [UnitCategory.RANGED]: 'Ranged',
  [UnitCategory.CAVALRY]: 'Cavalry',
  [UnitCategory.SIEGE]: 'Siege',
  [UnitCategory.NAVAL]: 'Naval',
};

/** State display names. */
const STATE_NAMES: Record<number, string> = {
  [UnitState.IDLE]: 'Idle',
  [UnitState.MOVING]: 'Moving',
  [UnitState.ATTACKING]: 'Attacking',
  [UnitState.DEFENDING]: 'Defending',
  [UnitState.ROUTING]: 'Routing',
  [UnitState.DEAD]: 'Dead',
};

/** Order display names. */
const ORDER_NAMES: Record<number, string> = {
  [OrderType.MOVE]: 'Move',
  [OrderType.ATTACK]: 'Attack',
  [OrderType.HOLD]: 'Hold',
  [OrderType.RETREAT]: 'Retreat',
  [OrderType.FLANK]: 'Flank',
  [OrderType.CHARGE]: 'Charge',
  [OrderType.FORM_UP]: 'Form Up',
  [OrderType.DISENGAGE]: 'Disengage',
  [OrderType.RALLY]: 'Rally',
};

function barColor(pct: number): string {
  if (pct > 60) return '#5B8C5A'; // green
  if (pct > 30) return '#C9A84C'; // yellow/gold
  return '#A23B2C'; // red
}

function makeBar(value: number, max: number, width = 10): string {
  const pct = max > 0 ? value / max : 0;
  const filled = Math.round(pct * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export class UnitInfoPanel {
  private container: HTMLDivElement;
  private visible = false;
  private lastHash = '';
  private detailUnitId: number | null = null; // for drill-down from summary

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'unit-info-panel';
    this.container.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: 12px;
      width: 280px;
      background: rgba(28, 20, 16, 0.92);
      border: 1px solid #8B7D3C;
      color: #D4C4A0;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: 100;
      line-height: 1.5;
      user-select: none;
    `;
    parentElement.appendChild(this.container);
  }

  /** Call every render frame. Updates panel if selection or unit stats changed. */
  update(selectionManager: SelectionManager, unitManager: UnitManager): void {
    const ids = [...selectionManager.selectedIds];

    if (ids.length === 0) {
      this.hide();
      this.detailUnitId = null;
      return;
    }

    // If we have a detail drill-down override, check it's still valid
    if (this.detailUnitId !== null) {
      if (!ids.includes(this.detailUnitId)) {
        this.detailUnitId = null;
      }
    }

    // Compute hash for dirty check
    const units = ids.map(id => unitManager.get(id)).filter((u): u is Unit => !!u);
    if (units.length === 0) {
      this.hide();
      return;
    }

    const hash = this.computeHash(units);
    if (hash === this.lastHash) return;
    this.lastHash = hash;

    // Decide which view
    if (units.length === 1 || this.detailUnitId !== null) {
      const unit = this.detailUnitId !== null
        ? units.find(u => u.id === this.detailUnitId) ?? units[0]
        : units[0];
      this.renderDetailView(unit, units.length > 1);
    } else {
      this.renderSummaryView(units);
    }

    this.show();
  }

  private computeHash(units: Unit[]): string {
    // Quick hash of key fields that could change
    let h = `${units.length}:${this.detailUnitId}:`;
    for (const u of units) {
      h += `${u.id},${u.size},${Math.round(u.morale)},${Math.round(u.fatigue)},${Math.round(u.supply)},${u.experience},${u.state},${u.orderModifier ?? -1};`;
    }
    return h;
  }

  private renderDetailView(unit: Unit, showBack: boolean): void {
    const cfg = UNIT_TYPE_CONFIGS[unit.type];
    const shape = SHAPE_ICONS[UNIT_TYPE_SHAPE[unit.type]] ?? '●';
    const category = CATEGORY_NAMES[cfg.category] ?? 'Unknown';
    const team = unit.team === 0 ? 'Player' : 'Enemy';
    const tierName = ExperienceSystem.getTierName(unit.experience);
    const state = STATE_NAMES[unit.state] ?? 'Unknown';
    const order = unit.orderModifier !== null ? ORDER_NAMES[unit.orderModifier] ?? '' : 'None';

    const strengthPct = cfg.maxSize > 0 ? (unit.size / cfg.maxSize) * 100 : 0;
    const moralePct = unit.morale;
    const fatiguePct = unit.fatigue;
    const supplyPct = unit.supply;
    const expPct = unit.experience;

    let html = `<div class="uip-header" style="border-bottom:1px solid #8B7D3C;padding-bottom:6px;margin-bottom:6px">`;
    if (showBack) {
      html += `<span class="uip-back" data-action="back" style="cursor:pointer;color:#8B7D3C;margin-right:6px">◀</span>`;
    }
    html += `<strong>${cfg.displayName}</strong> <span style="color:#8B7D3C">(${cfg.chineseName})</span></div>`;

    html += `<div style="color:#8B7D3C">${shape} ${category} &nbsp;&nbsp; Team: ${team}</div>`;
    html += `<div style="margin-top:6px">`;
    html += this.statRow('Strength', unit.size, cfg.maxSize, strengthPct);
    html += this.statRow('Morale', unit.morale, 100, moralePct);
    html += this.statRow('Fatigue', unit.fatigue, 100, fatiguePct, true);
    html += this.statRow('Supply', unit.supply, 100, supplyPct);
    html += `<div>Exp &nbsp;&nbsp;&nbsp;&nbsp; <span style="color:${barColor(expPct)}">${makeBar(expPct, 100)}</span> ${Math.round(expPct)} <span style="color:#8B7D3C">${tierName}</span></div>`;
    html += `</div>`;

    html += `<div style="margin-top:6px;border-top:1px solid #8B7D3C30;padding-top:4px">`;
    html += `ATK <strong>${cfg.damage}</strong> &nbsp; ARM <strong>${cfg.armor}</strong> &nbsp; SPD <strong>${cfg.speed}</strong><br>`;
    html += `RNG <strong>${cfg.range}</strong> &nbsp; PEN <strong>${cfg.armorPen}</strong> &nbsp; A.SPD <strong>${cfg.attackSpeed}</strong>`;
    html += `</div>`;

    html += `<div style="margin-top:6px;border-top:1px solid #8B7D3C30;padding-top:4px;color:#8B7D3C">`;
    html += `State: ${state}`;
    if (unit.state === UnitState.MOVING) {
      html += ` → (${Math.round(unit.targetX)}, ${Math.round(unit.targetY)})`;
    }
    html += `<br>Order: ${order}`;
    html += `</div>`;

    this.container.innerHTML = html;
    this.bindEvents();
  }

  private renderSummaryView(units: Unit[]): void {
    let html = `<div class="uip-header" style="border-bottom:1px solid #8B7D3C;padding-bottom:6px;margin-bottom:6px">`;
    html += `<strong>${units.length} Units Selected</strong></div>`;

    for (const unit of units) {
      const cfg = UNIT_TYPE_CONFIGS[unit.type];
      const shape = SHAPE_ICONS[UNIT_TYPE_SHAPE[unit.type]] ?? '●';
      const pct = cfg.maxSize > 0 ? (unit.size / cfg.maxSize) * 100 : 0;
      html += `<div class="uip-row" data-unit-id="${unit.id}" style="cursor:pointer;padding:2px 0;border-bottom:1px solid #8B7D3C20">`;
      html += `${shape} ${cfg.displayName} &nbsp;<span style="color:${barColor(pct)}">${makeBar(unit.size, cfg.maxSize, 6)}</span> ${unit.size}/${cfg.maxSize}`;
      html += `</div>`;
    }

    html += `<div style="margin-top:6px;color:#8B7D3C;text-align:center;font-size:11px">Click a row for details</div>`;
    this.container.innerHTML = html;
    this.bindEvents();
  }

  private statRow(label: string, value: number, max: number, pct: number, inverted = false): string {
    // For fatigue, lower is better (green at low, red at high)
    const displayPct = inverted ? 100 - pct : pct;
    const padded = label.padEnd(9);
    return `<div>${padded}<span style="color:${barColor(displayPct)}">${makeBar(value, max)}</span> ${Math.round(value)}/${max}</div>`;
  }

  private bindEvents(): void {
    // Summary row click → detail drill-down
    const rows = this.container.querySelectorAll('.uip-row');
    for (const row of rows) {
      row.addEventListener('click', (e) => {
        const id = parseInt((e.currentTarget as HTMLElement).dataset.unitId ?? '', 10);
        if (!isNaN(id)) {
          this.detailUnitId = id;
          this.lastHash = ''; // force re-render
        }
      });
    }

    // Back button
    const back = this.container.querySelector('.uip-back');
    if (back) {
      back.addEventListener('click', () => {
        this.detailUnitId = null;
        this.lastHash = '';
      });
    }
  }

  private show(): void {
    if (!this.visible) {
      this.visible = true;
      this.container.style.opacity = '1';
    }
  }

  hide(): void {
    if (this.visible) {
      this.visible = false;
      this.container.style.opacity = '0';
      this.lastHash = '';
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /** Destroy and remove from DOM. */
  destroy(): void {
    this.container.remove();
  }
}
