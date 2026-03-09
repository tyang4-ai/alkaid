import type { EventBus } from '../core/EventBus';
import type { UnitManager } from '../simulation/units/UnitManager';
import { ALERT_BANNER_DURATION_MS, ALERT_MAX_VISIBLE, ALERT_LOG_MAX_ENTRIES, UNIT_TYPE_CONFIGS } from '../constants';
import type { UnitType } from '../constants';

interface AlertBanner {
  element: HTMLDivElement;
  createdAt: number;
  worldX?: number;
  worldY?: number;
}

interface AlertLogEntry {
  type: string;
  message: string;
  severity: 'danger' | 'warning' | 'info';
  timestamp: number;
}

const WEATHER_NAMES: Record<number, string> = {
  0: 'Clear', 1: 'Rain', 2: 'Fog', 3: 'Wind', 4: 'Snow',
};

const SEVERITY_COLORS = {
  danger: '#C75050',
  warning: '#C9A84C',
  info: '#4A90D9',
};

export class AlertSystem {
  private container: HTMLDivElement;
  private banners: AlertBanner[] = [];
  private log: AlertLogEntry[] = [];
  private logPanel: HTMLDivElement;
  private logBtn: HTMLButtonElement;
  private eventBus: EventBus;
  private unitManager: UnitManager;
  private now = 0;
  private unsubscribers: Array<() => void> = [];

  constructor(parentElement: HTMLElement, eventBus: EventBus, unitManager: UnitManager) {
    this.eventBus = eventBus;
    this.unitManager = unitManager;

    this.container = document.createElement('div');
    this.container.className = 'alert-banners';
    this.container.style.cssText = `
      position: absolute; top: 50px; left: 50%; transform: translateX(-50%);
      width: 400px; z-index: 200; pointer-events: none; display: none;
      flex-direction: column; gap: 4px;
    `;
    this.container.classList.add('alkaid-overlay', 'alkaid-hidden');
    parentElement.appendChild(this.container);

    // Alert log button
    this.logBtn = document.createElement('button');
    this.logBtn.textContent = '📜';
    this.logBtn.style.cssText = `
      position: absolute; top: 50px; right: 12px; z-index: 201;
      background: rgba(28, 20, 16, 0.92); border: 1px solid #8B7D3C;
      color: #D4C4A0; padding: 4px 8px; border-radius: 3px;
      cursor: pointer; font-size: 16px; pointer-events: auto; display: none;
    `;
    this.logBtn.addEventListener('click', () => this.toggleLog());
    parentElement.appendChild(this.logBtn);

    // Alert log panel (hidden by default)
    this.logPanel = document.createElement('div');
    this.logPanel.className = 'alert-log';
    this.logPanel.style.cssText = `
      position: absolute; top: 80px; right: 12px; width: 350px; max-height: 300px;
      overflow-y: auto; z-index: 202; display: none; pointer-events: auto;
      background: rgba(28, 20, 16, 0.95); border: 1px solid #8B7D3C;
      border-radius: 4px; padding: 8px;
    `;
    parentElement.appendChild(this.logPanel);
  }

  init(): void {
    const sub = <K extends keyof import('../core/EventBus').GameEvents>(
      event: K,
      handler: (payload: import('../core/EventBus').GameEvents[K]) => void,
    ) => {
      this.eventBus.on(event, handler);
      this.unsubscribers.push(() => this.eventBus.off(event, handler));
    };

    sub('unit:routed', ({ unitId }) => {
      const unit = this.unitManager.get(unitId);
      if (!unit) return;
      const cfg = UNIT_TYPE_CONFIGS[unit.type as UnitType];
      this.fire('rout', `⚠ ${cfg?.chineseName ?? 'Unit'} is routing!`, 'warning', unit.x, unit.y);
    });

    sub('combat:unitDestroyed', ({ unitId }) => {
      const unit = this.unitManager.get(unitId);
      if (unit?.isGeneral) {
        this.fire('general', '⚔ General under attack!', 'danger', unit.x, unit.y);
      }
    });

    sub('supply:collapse', () => {
      this.fire('supply', '🚫 Supply line collapsed!', 'danger');
    });

    sub('morale:armyRoutCascade', () => {
      this.fire('morale', '⚠ Army morale breaking!', 'danger');
    });

    sub('weather:changed', ({ newWeather }) => {
      const name = WEATHER_NAMES[newWeather] ?? 'Unknown';
      this.fire('weather', `天气: Weather changed to ${name}`, 'info');
    });

    sub('battle:surrender', () => {
      this.fire('surrender', '敌军投降! Enemy surrenders!', 'info');
    });
  }

  fire(type: string, message: string, severity: 'danger' | 'warning' | 'info', worldX?: number, worldY?: number): void {
    // Log entry
    this.log.push({ type, message, severity, timestamp: this.now });
    if (this.log.length > ALERT_LOG_MAX_ENTRIES) {
      this.log.shift();
    }

    // Create banner
    const el = document.createElement('div');
    el.style.cssText = `
      background: rgba(28, 20, 16, 0.92); padding: 8px 12px;
      border-left: 4px solid ${SEVERITY_COLORS[severity]};
      color: #D4C4A0; font-size: 13px; font-family: serif;
      border-radius: 0 3px 3px 0; pointer-events: auto; cursor: pointer;
      transition: opacity 0.3s;
    `;
    el.textContent = message;

    if (worldX !== undefined && worldY !== undefined) {
      el.addEventListener('click', () => {
        this.eventBus.emit('camera:moved', { x: worldX, y: worldY, zoom: 1.0 });
      });
    }

    this.container.appendChild(el);
    this.banners.push({ element: el, createdAt: this.now, worldX, worldY });

    // Emit event
    this.eventBus.emit('alert:fired', { type, message, severity, worldX, worldY });

    // Enforce max visible
    while (this.banners.length > ALERT_MAX_VISIBLE) {
      const old = this.banners.shift();
      old?.element.remove();
    }
  }

  update(dtMs: number): void {
    this.now += dtMs;

    // Expire old banners
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const age = this.now - this.banners[i].createdAt;
      if (age > ALERT_BANNER_DURATION_MS) {
        this.banners[i].element.remove();
        this.banners.splice(i, 1);
      } else if (age > ALERT_BANNER_DURATION_MS - 500) {
        // Fade out in last 500ms
        this.banners[i].element.style.opacity = String(1 - (age - (ALERT_BANNER_DURATION_MS - 500)) / 500);
      }
    }
  }

  private toggleLog(): void {
    const visible = this.logPanel.style.display !== 'none';
    if (visible) {
      this.logPanel.style.display = 'none';
    } else {
      this.logPanel.innerHTML = '';
      for (const entry of [...this.log].reverse()) {
        const row = document.createElement('div');
        row.style.cssText = `
          color: ${SEVERITY_COLORS[entry.severity]}; font-size: 12px;
          padding: 2px 0; border-bottom: 1px solid rgba(139,125,60,0.2);
          font-family: monospace;
        `;
        row.textContent = entry.message;
        this.logPanel.appendChild(row);
      }
      this.logPanel.style.display = 'block';
    }
  }

  show(): void {
    this.container.style.display = 'flex';
    requestAnimationFrame(() => this.container.classList.remove('alkaid-hidden'));
    this.logBtn.style.display = 'block';
  }

  hide(): void {
    this.container.classList.add('alkaid-hidden');
    setTimeout(() => { this.container.style.display = 'none'; }, 200);
    this.logBtn.style.display = 'none';
    this.logPanel.style.display = 'none';
  }

  getLog(): AlertLogEntry[] {
    return [...this.log];
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.container.remove();
    this.logBtn.remove();
    this.logPanel.remove();
  }
}
