import type { EventBus } from '../core/EventBus';
import {
  UNIT_TYPE_CONFIGS, TERRAIN_STATS, TerrainType,
  WEATHER_MODIFIERS, WeatherType, SNOW_FATIGUE_MULT,
  UnitType,
  FATIGUE_SPEED_THRESHOLDS, FATIGUE_MORALE_THRESHOLD,
  SURRENDER_PRESSURE_THRESHOLD, SURRENDER_CONSECUTIVE_CHECKS,
  SURRENDER_WEIGHT_MORALE, SURRENDER_WEIGHT_CASUALTY,
  SURRENDER_WEIGHT_SUPPLY, SURRENDER_WEIGHT_ENCIRCLEMENT,
  SURRENDER_WEIGHT_LEADERSHIP,
} from '../constants';

const TABS = ['Units', 'Terrain', 'Weather', 'Mechanics', 'Controls'] as const;

const TERRAIN_NAMES: Record<number, string> = {
  0: 'Water 水', 1: 'Ford 浅滩', 2: 'Plains 平原', 3: 'Forest 森林',
  4: 'Hills 丘陵', 5: 'Mountains 山地', 6: 'River 河流', 7: 'Marsh 沼泽',
  8: 'Road 道路', 9: 'City 城市',
};

const WEATHER_NAMES: Record<number, string> = {
  0: 'Clear 晴', 1: 'Rain 雨', 2: 'Fog 雾', 3: 'Wind 风', 4: 'Snow 雪',
};

const CATEGORY_NAMES: Record<number, string> = {
  0: 'Infantry', 1: 'Ranged', 2: 'Cavalry', 3: 'Siege', 4: 'Naval',
};

const SHAPE_ICONS: Record<number, string> = {
  0: '●', 1: '▲', 2: '◆', 3: '■', 4: '⬡',
};

const UNIT_SHAPES: Record<number, number> = {
  0: 0, 1: 0, 2: 2, 3: 2, 4: 1, 5: 1, 6: 1, 7: 3, 8: 0, 9: 0, 10: 4, 11: 4, 12: 4, 13: 0,
};

export class Codex {
  private overlay: HTMLDivElement;
  private contentArea: HTMLDivElement;
  private tabBtns: HTMLButtonElement[] = [];
  private eventBus: EventBus;

  private _visible = false;

  constructor(parentElement: HTMLElement, eventBus: EventBus) {
    this.eventBus = eventBus;

    this.overlay = document.createElement('div');
    this.overlay.className = 'codex-overlay';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(10, 8, 6, 0.85); display: none; z-index: 800;
      justify-content: center; align-items: center; pointer-events: auto;
    `;
    this.overlay.classList.add('alkaid-overlay', 'alkaid-hidden');

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: rgba(28, 20, 16, 0.97); border: 2px solid #8B7D3C;
      border-radius: 6px; width: 85%; max-width: 900px; height: 80%;
      display: flex; flex-direction: column; overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; border-bottom: 1px solid #8B7D3C;
    `;

    const title = document.createElement('span');
    title.textContent = '兵法典 Codex';
    title.style.cssText = 'font-size: 20px; color: #C9A84C; font-family: serif; letter-spacing: 2px;';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: 1px solid #5A4A3A; color: #D4C4A0;
      padding: 4px 10px; cursor: pointer; font-size: 16px; border-radius: 3px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display: flex; gap: 2px; padding: 8px 16px; border-bottom: 1px solid rgba(139,125,60,0.3);';

    for (let i = 0; i < TABS.length; i++) {
      const btn = document.createElement('button');
      btn.textContent = TABS[i];
      btn.dataset.tab = String(i);
      this.styleTabBtn(btn, i === 0);
      btn.addEventListener('click', () => this.switchTab(i));
      this.tabBtns.push(btn);
      tabBar.appendChild(btn);
    }
    panel.appendChild(tabBar);

    // Content area
    this.contentArea = document.createElement('div');
    this.contentArea.style.cssText = `
      flex: 1; overflow-y: auto; padding: 16px;
      color: #D4C4A0; font-family: monospace; font-size: 13px;
      background: rgba(40, 32, 24, 0.3);
    `;
    panel.appendChild(this.contentArea);

    this.overlay.appendChild(panel);
    parentElement.appendChild(this.overlay);

    this.renderTab(0);
  }

  private styleTabBtn(btn: HTMLButtonElement, active: boolean): void {
    btn.style.cssText = `
      background: ${active ? '#C9A84C' : 'rgba(60, 50, 40, 0.8)'};
      color: ${active ? '#1C1410' : '#D4C4A0'};
      border: 1px solid ${active ? '#C9A84C' : '#5A4A3A'};
      padding: 6px 14px; border-radius: 3px; cursor: pointer;
      font-size: 13px; font-family: serif;
    `;
  }

  private switchTab(idx: number): void {
    for (let i = 0; i < this.tabBtns.length; i++) {
      this.styleTabBtn(this.tabBtns[i], i === idx);
    }
    this.renderTab(idx);
  }

  private renderTab(idx: number): void {
    switch (idx) {
      case 0: this.renderUnits(); break;
      case 1: this.renderTerrain(); break;
      case 2: this.renderWeather(); break;
      case 3: this.renderMechanics(); break;
      case 4: this.renderControls(); break;
    }
  }

  private renderUnits(): void {
    let html = '<div style="color:#C9A84C;font-size:16px;margin-bottom:12px;font-family:serif;">Unit Encyclopedia 兵种</div>';
    const unitTypes = Object.values(UnitType).filter(v => typeof v === 'number') as number[];

    for (const ut of unitTypes) {
      const cfg = UNIT_TYPE_CONFIGS[ut as UnitType];
      if (!cfg) continue;
      const shape = SHAPE_ICONS[UNIT_SHAPES[ut] ?? 0];
      const cat = CATEGORY_NAMES[cfg.category] ?? 'Unknown';

      html += `
        <div style="border:1px solid rgba(139,125,60,0.3);border-radius:4px;padding:10px;margin-bottom:8px;background:rgba(28,20,16,0.5);">
          <div style="font-size:15px;color:#C9A84C;margin-bottom:6px;">${shape} ${cfg.chineseName} ${cfg.displayName} <span style="color:#8B7D3C;font-size:11px;">[${cat}]</span></div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr>
              <td style="color:#8B7D3C;width:70px;">ATK</td><td>${cfg.damage}</td>
              <td style="color:#8B7D3C;width:70px;">DEF</td><td>${cfg.armor}</td>
              <td style="color:#8B7D3C;width:70px;">SPD</td><td>${cfg.speed}</td>
            </tr>
            <tr>
              <td style="color:#8B7D3C;">RNG</td><td>${cfg.range}</td>
              <td style="color:#8B7D3C;">HP</td><td>${cfg.hpPerSoldier}</td>
              <td style="color:#8B7D3C;">Size</td><td>${cfg.maxSize}</td>
            </tr>
            <tr>
              <td style="color:#8B7D3C;">AtkSpd</td><td>${cfg.attackSpeed}/s</td>
              <td style="color:#8B7D3C;">ArmorPen</td><td>${cfg.armorPen}</td>
              <td style="color:#8B7D3C;">Cost</td><td>${cfg.cost}g</td>
            </tr>
          </table>
        </div>
      `;
    }

    this.contentArea.innerHTML = html;
  }

  private renderTerrain(): void {
    let html = '<div style="color:#C9A84C;font-size:16px;margin-bottom:12px;font-family:serif;">Terrain 地形</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
    html += '<tr style="color:#C9A84C;border-bottom:1px solid #8B7D3C;"><th style="text-align:left;padding:4px;">Terrain</th><th>Move Cost</th><th>Def Bonus</th><th>Cav Effect</th><th>Forage</th></tr>';

    const terrainTypes = Object.values(TerrainType).filter(v => typeof v === 'number') as number[];
    for (const tt of terrainTypes) {
      const stats = TERRAIN_STATS[tt as TerrainType];
      const name = TERRAIN_NAMES[tt] ?? `Type ${tt}`;
      html += `<tr style="border-bottom:1px solid rgba(139,125,60,0.15);">
        <td style="padding:4px;color:#D4C4A0;">${name}</td>
        <td style="text-align:center;">${stats.moveCost === -1 ? '✕' : stats.moveCost.toFixed(1)}</td>
        <td style="text-align:center;">${stats.defBonus > 0 ? '+' : ''}${(stats.defBonus * 100).toFixed(0)}%</td>
        <td style="text-align:center;">${(stats.cavEffect * 100).toFixed(0)}%</td>
        <td style="text-align:center;">${stats.forageRate.toFixed(1)}</td>
      </tr>`;
    }
    html += '</table>';
    this.contentArea.innerHTML = html;
  }

  private renderWeather(): void {
    let html = '<div style="color:#C9A84C;font-size:16px;margin-bottom:12px;font-family:serif;">Weather 天气</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
    html += '<tr style="color:#C9A84C;border-bottom:1px solid #8B7D3C;"><th style="text-align:left;padding:4px;">Weather</th><th>Ranged</th><th>Movement</th><th>Visibility</th><th>Fire</th><th>Ford Danger</th></tr>';

    const weatherTypes = Object.values(WeatherType).filter(v => typeof v === 'number') as number[];
    for (const wt of weatherTypes) {
      const mod = WEATHER_MODIFIERS[wt as WeatherType];
      const name = WEATHER_NAMES[wt] ?? `Type ${wt}`;
      html += `<tr style="border-bottom:1px solid rgba(139,125,60,0.15);">
        <td style="padding:4px;color:#D4C4A0;">${name}</td>
        <td style="text-align:center;">${(mod.rangedMult * 100).toFixed(0)}%</td>
        <td style="text-align:center;">${(mod.movementMult * 100).toFixed(0)}%</td>
        <td style="text-align:center;">${(mod.visibilityMult * 100).toFixed(0)}%</td>
        <td style="text-align:center;">${(mod.fireMult * 100).toFixed(0)}%</td>
        <td style="text-align:center;">${(mod.fordDangerMult * 100).toFixed(0)}%</td>
      </tr>`;
    }
    html += '</table>';
    html += `<div style="margin-top:12px;color:#8B7D3C;font-size:11px;">Snow fatigue multiplier: ${SNOW_FATIGUE_MULT}x</div>`;
    this.contentArea.innerHTML = html;
  }

  private renderMechanics(): void {
    let html = '<div style="color:#C9A84C;font-size:16px;margin-bottom:12px;font-family:serif;">Game Mechanics 机制</div>';

    // Morale
    html += '<div style="color:#C9A84C;font-size:14px;margin:12px 0 6px;">Morale 士气</div>';
    html += '<div>• Morale ranges from 0-100. Units route when morale drops to 0.</div>';
    html += '<div>• Routing units flee at 1.5x speed and take 1.5x damage.</div>';
    html += '<div>• General nearby: +1.0 morale/tick. General killed: -30 morale army-wide.</div>';

    // Fatigue
    html += '<div style="color:#C9A84C;font-size:14px;margin:12px 0 6px;">Fatigue 疲劳</div>';
    html += '<div>Speed penalties by fatigue level:</div>';
    html += '<div style="margin-left:12px;">';
    for (const [threshold, mult] of FATIGUE_SPEED_THRESHOLDS) {
      html += `<div>• ≥${threshold}: ${(mult * 100).toFixed(0)}% speed</div>`;
    }
    html += `</div><div>• Morale penalty starts at ${FATIGUE_MORALE_THRESHOLD} fatigue.</div>`;

    // Supply
    html += '<div style="color:#C9A84C;font-size:14px;margin:12px 0 6px;">Supply 补给</div>';
    html += '<div>• Well-fed (>50%): +0.5 morale/tick</div>';
    html += '<div>• Low rations (25-50%): -1 morale/tick, 90% speed</div>';
    html += '<div>• Hunger (<25%): -3 morale/tick, 80% speed, 80% combat</div>';
    html += '<div>• Starvation (0%): -5 morale/tick, 70% speed, 60% combat, desertions</div>';

    // Surrender
    html += '<div style="color:#C9A84C;font-size:14px;margin:12px 0 6px;">Surrender 投降</div>';
    html += `<div>• Threshold: ${SURRENDER_PRESSURE_THRESHOLD} pressure for ${SURRENDER_CONSECUTIVE_CHECKS} consecutive checks</div>`;
    html += `<div>• Weights: Morale ${(SURRENDER_WEIGHT_MORALE * 100).toFixed(0)}%, ` +
      `Casualty ${(SURRENDER_WEIGHT_CASUALTY * 100).toFixed(0)}%, ` +
      `Supply ${(SURRENDER_WEIGHT_SUPPLY * 100).toFixed(0)}%, ` +
      `Encirclement ${(SURRENDER_WEIGHT_ENCIRCLEMENT * 100).toFixed(0)}%, ` +
      `Leadership ${(SURRENDER_WEIGHT_LEADERSHIP * 100).toFixed(0)}%</div>`;

    this.contentArea.innerHTML = html;
  }

  private renderControls(): void {
    const keys = [
      ['Space', 'Toggle pause'],
      ['1-4', 'Speed: 0.5x / 1x / 2x / 3x'],
      ['A', 'Attack order'],
      ['H', 'Hold order'],
      ['R', 'Retreat order'],
      ['F', 'Flank order'],
      ['C', 'Charge order'],
      ['G', 'Form Up order'],
      ['D', 'Disengage order'],
      ['Y', 'Rally order'],
      ['Ctrl+1-9', 'Assign selected to group'],
      ['5-9', 'Select group'],
      ['Tab', 'Cycle to next squad'],
      ['Shift+Tab', 'Cycle to prev squad'],
      ['Home', 'Center camera on general'],
      ['Escape', 'Deselect / Retreat confirm'],
      ['F12', 'Toggle Codex'],
    ];

    let html = '<div style="color:#C9A84C;font-size:16px;margin-bottom:12px;font-family:serif;">Controls 操作</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<tr style="color:#C9A84C;border-bottom:1px solid #8B7D3C;"><th style="text-align:left;padding:4px;width:120px;">Key</th><th style="text-align:left;">Action</th></tr>';

    for (const [key, action] of keys) {
      html += `<tr style="border-bottom:1px solid rgba(139,125,60,0.15);">
        <td style="padding:4px;color:#C9A84C;font-family:monospace;">${key}</td>
        <td style="padding:4px;">${action}</td>
      </tr>`;
    }
    html += '</table>';

    html += '<div style="margin-top:16px;color:#C9A84C;font-size:14px;margin-bottom:6px;">Mouse</div>';
    html += '<div>• Left-click: Select unit</div>';
    html += '<div>• Shift+click: Add to selection</div>';
    html += '<div>• Ctrl+drag: Box select</div>';
    html += '<div>• Right-click: Open order radial menu</div>';
    html += '<div>• Right-drag: Issue move order</div>';
    html += '<div>• Middle-drag: Pan camera</div>';
    html += '<div>• Scroll wheel: Zoom</div>';

    this.contentArea.innerHTML = html;
  }

  toggle(): void {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this._visible = true;
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => this.overlay.classList.remove('alkaid-hidden'));
    this.eventBus.emit('game:paused', undefined);
    this.eventBus.emit('codex:toggled', { open: true });
  }

  hide(): void {
    this._visible = false;
    this.overlay.classList.add('alkaid-hidden');
    setTimeout(() => { this.overlay.style.display = 'none'; }, 200);
    this.eventBus.emit('game:resumed', undefined);
    this.eventBus.emit('codex:toggled', { open: false });
  }

  get visible(): boolean {
    return this._visible;
  }

  destroy(): void {
    this.overlay.remove();
  }
}
