import type { UnitManager } from '../simulation/units/UnitManager';
import type { SupplySystem } from '../simulation/metrics/SupplySystem';
import type { SurrenderSystem } from '../simulation/combat/SurrenderSystem';
import type { GameState } from '../simulation/GameState';
import { UnitState } from '../constants';

export class BattleHUD {
  private container: HTMLDivElement;
  private contentEl: HTMLDivElement;
  private lastHash = '';

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'battle-hud';
    this.container.style.cssText = `
      position: absolute; top: 12px; left: 12px; width: 270px; z-index: 100;
      background: rgba(28, 20, 16, 0.92); border: 1px solid #8B7D3C;
      border-radius: 4px; padding: 10px 12px; pointer-events: auto;
      font-family: monospace; font-size: 12px; color: #D4C4A0;
      display: none;
    `;

    const title = document.createElement('div');
    title.textContent = '⚔ Army Status';
    title.style.cssText = `
      font-size: 14px; font-family: serif; color: #C9A84C;
      margin-bottom: 8px; text-align: center; letter-spacing: 1px;
    `;
    this.container.appendChild(title);

    this.contentEl = document.createElement('div');
    this.container.appendChild(this.contentEl);

    parentElement.appendChild(this.container);
  }

  update(
    unitManager: UnitManager,
    supplySystem: SupplySystem,
    surrenderSystem: SurrenderSystem,
    gameState: GameState,
  ): void {
    const state = gameState.getState();

    // Compute stats for both teams
    const stats = [0, 1].map(team => {
      const units = unitManager.getByTeam(team);
      const alive = units.filter(u => u.state !== UnitState.DEAD);
      let totalSoldiers = 0;
      let maxSoldiers = 0;
      let totalMorale = 0;
      let totalFatigue = 0;

      for (const u of units) {
        maxSoldiers += u.maxSize;
      }
      for (const u of alive) {
        totalSoldiers += u.size;
        totalMorale += u.morale;
        totalFatigue += (u.fatigue ?? 0);
      }

      const avgMorale = alive.length > 0 ? totalMorale / alive.length : 0;
      const avgFatigue = alive.length > 0 ? totalFatigue / alive.length : 0;
      const foodPct = supplySystem.getFoodPercent(team);
      const pressure = surrenderSystem.getPressure(team);

      return {
        soldiers: totalSoldiers,
        maxSoldiers,
        morale: avgMorale,
        fatigue: avgFatigue,
        supply: foodPct,
        pressure,
      };
    });

    // Dirty check
    const hash = JSON.stringify(stats) + state.tickNumber + state.speedMultiplier;
    if (hash === this.lastHash) return;
    this.lastHash = hash;

    const bar = (val: number, max: number, color: string) => {
      const pct = Math.min(100, Math.max(0, (val / max) * 100));
      return `<div style="width:100%;height:8px;background:rgba(60,50,40,0.6);border-radius:2px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${color};"></div></div>`;
    };

    const row = (label: string, p: string, e: string) =>
      `<div style="display:flex;gap:4px;margin:2px 0;align-items:center;">
        <span style="width:60px;color:#8B7D3C;font-size:11px;">${label}</span>
        <span style="flex:1;">${p}</span>
        <span style="flex:1;">${e}</span>
      </div>`;

    this.contentEl.innerHTML = `
      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <span style="flex:1;text-align:center;color:#4A90D9;">🟦 You</span>
        <span style="flex:1;text-align:center;color:#C75050;">🟥 Enemy</span>
      </div>
      ${row('Troops', `${stats[0].soldiers}/${stats[0].maxSoldiers}`, `${stats[1].soldiers}/${stats[1].maxSoldiers}`)}
      ${row('Morale', bar(stats[0].morale, 100, '#C9A84C'), bar(stats[1].morale, 100, '#C9A84C'))}
      ${row('Supply', bar(stats[0].supply, 1, '#5B8C5A'), bar(stats[1].supply, 1, '#5B8C5A'))}
      ${row('Fatigue', bar(stats[0].fatigue, 100, '#8B6914'), bar(stats[1].fatigue, 100, '#8B6914'))}
      ${row('Pressure', `${Math.round(stats[0].pressure)}`, `${Math.round(stats[1].pressure)}`)}
      <div style="margin-top:6px;text-align:center;color:#8B7D3C;font-size:11px;">
        Tick: ${state.tickNumber} &nbsp; Speed: ${state.speedMultiplier}x
      </div>
    `;
  }

  show(): void {
    this.container.style.display = 'block';
    this.lastHash = ''; // force re-render
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  destroy(): void {
    this.container.remove();
  }
}
