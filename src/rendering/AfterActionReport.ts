import type { BattleMetrics } from '../simulation/BattleEventLogger';
import type { UnitManager } from '../simulation/units/UnitManager';
import { UNIT_TYPE_CONFIGS, VictoryType, SIM_TICK_RATE } from '../constants';
import type { UnitType } from '../constants';

const VICTORY_LABELS: Record<number, string> = {
  [VictoryType.SURRENDER]: 'Enemy Surrendered 敌军投降',
  [VictoryType.ANNIHILATION]: 'Annihilation 殲滅',
  [VictoryType.GENERAL_KILLED]: 'General Killed 將亡',
  [VictoryType.STARVATION]: 'Starvation 饥亡',
  [VictoryType.RETREAT]: 'Retreat 撤退',
  [VictoryType.STALEMATE]: 'Stalemate 僵局',
};

export class AfterActionReport {
  private overlay: HTMLDivElement;
  private _visible = false;
  private onContinue?: () => void;
  private onWatchReplay?: () => void;

  constructor(parentElement: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'after-action-report';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(10, 8, 6, 0.9); display: none; z-index: 900;
      justify-content: center; align-items: center; pointer-events: auto;
      overflow-y: auto;
    `;
    parentElement.appendChild(this.overlay);
  }

  show(
    metrics: BattleMetrics,
    unitManager: UnitManager,
    victoryType: number,
    winnerTeam: number,
  ): void {
    this._visible = true;
    this.overlay.style.display = 'flex';

    const durationTicks = metrics.endTick - metrics.startTick;
    const durationSec = (durationTicks / SIM_TICK_RATE).toFixed(1);
    const isVictory = winnerTeam === 0;
    const resultText = isVictory ? 'Victory 勝利' : 'Defeat 敗北';
    const resultColor = isVictory ? '#C9A84C' : '#C75050';
    const victoryLabel = VICTORY_LABELS[victoryType] ?? 'Unknown';

    // Compute casualties
    let playerCasualties = 0, playerStarting = 0;
    let enemyCasualties = 0, enemyStarting = 0;
    for (const u of unitManager.getByTeam(0)) {
      playerStarting += u.maxSize;
      playerCasualties += u.maxSize - u.size;
    }
    for (const u of unitManager.getByTeam(1)) {
      enemyStarting += u.maxSize;
      enemyCasualties += u.maxSize - u.size;
    }

    // Build timeline SVG
    const timelineSVG = this.buildTimelineSVG(metrics);

    // Build per-squad breakdown
    const squadRows = this.buildSquadBreakdown(unitManager);

    // Key moments (last 8)
    const keyMoments = metrics.events.slice(-8).map(e =>
      `<div style="color:#8B7D3C;font-size:11px;padding:2px 0;">T${e.tick}: ${e.message}</div>`
    ).join('');

    this.overlay.innerHTML = `
      <div style="background:rgba(28,20,16,0.97);border:2px solid #8B7D3C;border-radius:6px;
        width:85%;max-width:800px;max-height:90%;overflow-y:auto;padding:24px;">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:28px;color:${resultColor};font-family:serif;letter-spacing:3px;">${resultText}</div>
          <div style="font-size:14px;color:#8B7D3C;margin-top:4px;">${victoryLabel}</div>
          <div style="font-size:12px;color:#D4C4A0;margin-top:8px;">Duration: ${durationTicks} ticks (${durationSec}s)</div>
        </div>

        <div style="display:flex;gap:16px;margin-bottom:16px;">
          <div style="flex:1;border:1px solid rgba(139,125,60,0.3);border-radius:4px;padding:12px;">
            <div style="color:#C9A84C;font-size:14px;margin-bottom:8px;font-family:serif;">Casualties 伤亡</div>
            <div style="color:#4A90D9;margin-bottom:4px;">Your army: ${playerCasualties}/${playerStarting}</div>
            <div style="color:#C75050;">Enemy: ${enemyCasualties}/${enemyStarting}</div>
          </div>
          <div style="flex:1;border:1px solid rgba(139,125,60,0.3);border-radius:4px;padding:12px;">
            <div style="color:#C9A84C;font-size:14px;margin-bottom:8px;font-family:serif;">Key Moments 要事</div>
            ${keyMoments || '<div style="color:#8B7D3C;font-size:11px;">No events recorded</div>'}
          </div>
        </div>

        <div style="border:1px solid rgba(139,125,60,0.3);border-radius:4px;padding:12px;margin-bottom:16px;">
          <div style="color:#C9A84C;font-size:14px;margin-bottom:8px;font-family:serif;">Timeline 战况</div>
          ${timelineSVG}
        </div>

        <div style="border:1px solid rgba(139,125,60,0.3);border-radius:4px;padding:12px;margin-bottom:16px;">
          <div style="color:#C9A84C;font-size:14px;margin-bottom:8px;font-family:serif;">Per-Squad Breakdown 部队详情</div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;color:#D4C4A0;">
              <tr style="color:#C9A84C;border-bottom:1px solid #8B7D3C;">
                <th style="text-align:left;padding:4px;">Unit</th>
                <th style="text-align:center;">Team</th>
                <th style="text-align:center;">Survived</th>
                <th style="text-align:center;">Lost</th>
                <th style="text-align:center;">Morale</th>
                <th style="text-align:center;">State</th>
              </tr>
              ${squadRows}
            </table>
          </div>
        </div>

        <div style="text-align:center;display:flex;gap:12px;justify-content:center;">
          <button id="aar-replay" style="background:rgba(60,50,40,0.8);color:#D4C4A0;border:1px solid #8B7D3C;
            padding:10px 32px;border-radius:4px;cursor:pointer;font-size:16px;font-family:serif;">
            Watch Replay 回放
          </button>
          <button id="aar-continue" style="background:#8B2500;color:#D4C4A0;border:1px solid #8B7D3C;
            padding:10px 32px;border-radius:4px;cursor:pointer;font-size:16px;font-family:serif;">
            Continue 继续
          </button>
        </div>
      </div>
    `;

    // Bind replay button
    const replayBtn = this.overlay.querySelector('#aar-replay');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        this.onWatchReplay?.();
      });
    }

    // Bind continue button
    const continueBtn = this.overlay.querySelector('#aar-continue');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        if (this.onContinue) {
          this.onContinue();
        } else {
          window.location.reload();
        }
      });
    }
  }

  setOnContinue(cb: () => void): void {
    this.onContinue = cb;
  }

  setOnWatchReplay(cb: () => void): void {
    this.onWatchReplay = cb;
  }

  private buildTimelineSVG(metrics: BattleMetrics): string {
    const width = 700;
    const height = 120;
    const padding = 30;

    const morale0 = metrics.moraleHistory.get(0) ?? [];
    const morale1 = metrics.moraleHistory.get(1) ?? [];

    if (morale0.length < 2) {
      return '<div style="color:#8B7D3C;font-size:11px;text-align:center;">Not enough data for timeline</div>';
    }

    const makePolyline = (data: number[], maxVal: number, color: string): string => {
      const points = data.map((v, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - (v / maxVal) * (height - 2 * padding);
        return `${x},${y}`;
      }).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" />`;
    };

    // Y-axis labels
    const yLabels = [0, 50, 100].map(v => {
      const y = height - padding - (v / 100) * (height - 2 * padding);
      return `<text x="${padding - 4}" y="${y + 3}" fill="#8B7D3C" font-size="9" text-anchor="end">${v}</text>`;
    }).join('');

    // X-axis label
    const xLabel = `<text x="${width / 2}" y="${height - 4}" fill="#8B7D3C" font-size="9" text-anchor="middle">Ticks (sampled every ${metrics.sampleInterval})</text>`;

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;">
      <rect x="${padding}" y="${padding - 10}" width="${width - 2 * padding}" height="${height - 2 * padding + 10}" fill="rgba(40,32,24,0.3)" />
      ${yLabels}
      ${xLabel}
      ${makePolyline(morale0, 100, '#4A90D9')}
      ${makePolyline(morale1, 100, '#C75050')}
      <text x="${padding + 4}" y="${padding}" fill="#4A90D9" font-size="9">You</text>
      <text x="${padding + 40}" y="${padding}" fill="#C75050" font-size="9">Enemy</text>
    </svg>`;
  }

  private buildSquadBreakdown(unitManager: UnitManager): string {
    const STATE_NAMES: Record<number, string> = {
      0: 'Idle', 1: 'Moving', 2: 'Fighting', 3: 'Defending', 4: 'Routing', 5: 'Dead',
    };

    let rows = '';
    for (const team of [0, 1]) {
      const units = unitManager.getByTeam(team);
      for (const u of units) {
        const cfg = UNIT_TYPE_CONFIGS[u.type as UnitType];
        const name = cfg ? `${cfg.chineseName} ${cfg.displayName}` : `Unit #${u.id}`;
        const lost = u.maxSize - u.size;
        const stateName = STATE_NAMES[u.state] ?? 'Unknown';
        const teamColor = team === 0 ? '#4A90D9' : '#C75050';
        const teamLabel = team === 0 ? 'You' : 'Enemy';

        rows += `<tr style="border-bottom:1px solid rgba(139,125,60,0.1);">
          <td style="padding:3px 4px;">${name}</td>
          <td style="text-align:center;color:${teamColor};">${teamLabel}</td>
          <td style="text-align:center;">${u.size}/${u.maxSize}</td>
          <td style="text-align:center;">${lost}</td>
          <td style="text-align:center;">${Math.round(u.morale)}</td>
          <td style="text-align:center;">${stateName}</td>
        </tr>`;
      }
    }
    return rows;
  }

  hide(): void {
    this._visible = false;
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = '';
  }

  get visible(): boolean {
    return this._visible;
  }

  destroy(): void {
    this.overlay.remove();
  }
}
