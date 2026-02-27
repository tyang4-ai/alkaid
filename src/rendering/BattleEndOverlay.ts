import { VictoryType } from '../constants';

export interface BattleResult {
  winnerTeam: number;
  playerTeam: number;
  victoryType: number;
  playerCasualties: number;
  playerStarting: number;
  enemyCasualties: number;
  enemyStarting: number;
  durationTicks: number;
}

export class BattleEndOverlay {
  private container: HTMLDivElement;
  private visible = false;

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'battle-end-overlay';
    this.container.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(10, 8, 6, 0.85);
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.5s ease;
      font-family: monospace;
    `;
    parentElement.appendChild(this.container);
  }

  show(result: BattleResult): void {
    const isVictory = result.winnerTeam === result.playerTeam;

    const title = isVictory ? '\u5927\u52DD' : '\u6557';
    const subtitle = isVictory ? 'VICTORY' : 'DEFEAT';
    const titleColor = isVictory ? '#C9A84C' : '#8B4444';
    const borderColor = isVictory ? '#8B7D3C' : '#5A3333';
    const accentColor = isVictory ? '#D4C4A0' : '#AA7777';

    const victoryTypeName = this.getVictoryTypeName(result.victoryType);
    const victoryTypeNameCN = this.getVictoryTypeNameChinese(result.victoryType);

    this.container.innerHTML = `
      <div style="
        border: 2px solid ${borderColor};
        background: rgba(28, 20, 16, 0.95);
        padding: 32px 48px;
        text-align: center;
        min-width: 360px;
      ">
        <div style="font-size: 36px; color: ${titleColor}; margin-bottom: 4px">\u2694 ${title} \u2694</div>
        <div style="font-size: 18px; color: ${accentColor}; margin-bottom: 20px; letter-spacing: 4px">${subtitle}</div>

        <div style="color: ${accentColor}; margin-bottom: 16px">${victoryTypeNameCN} \u2014 ${victoryTypeName}</div>

        <div style="
          border: 1px solid ${borderColor};
          padding: 12px 16px;
          margin: 0 auto 20px;
          text-align: left;
          color: #D4C4A0;
          font-size: 13px;
          line-height: 1.8;
        ">
          <div style="color: ${titleColor}; margin-bottom: 8px; font-size: 12px">\u2500\u2500 Battle Summary \u2500\u2500</div>
          <div>Casualties: &nbsp; ${result.playerCasualties} / ${result.playerStarting}</div>
          <div>Enemy Lost: &nbsp; ${result.enemyCasualties} / ${result.enemyStarting}</div>
          <div>Duration: &nbsp;&nbsp;&nbsp; ${result.durationTicks} ticks</div>
          <div>Victory: &nbsp;&nbsp;&nbsp;&nbsp; ${victoryTypeName}</div>
        </div>

        <button class="battle-end-continue" style="
          background: ${isVictory ? '#8B2500' : '#555'};
          color: #D4C4A0;
          border: 1px solid ${borderColor};
          padding: 8px 24px;
          font-family: monospace;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">Continue</button>
      </div>
    `;

    // Continue button handler
    const btn = this.container.querySelector('.battle-end-continue') as HTMLButtonElement;
    if (btn) {
      btn.addEventListener('mouseover', () => {
        btn.style.background = isVictory ? '#A23B2C' : '#777';
      });
      btn.addEventListener('mouseout', () => {
        btn.style.background = isVictory ? '#8B2500' : '#555';
      });
      btn.addEventListener('click', () => {
        // For now, just reload. Campaign system will handle this later.
        window.location.reload();
      });
    }

    this.visible = true;
    this.container.style.opacity = '1';
    this.container.style.pointerEvents = 'auto';
  }

  hide(): void {
    this.visible = false;
    this.container.style.opacity = '0';
    this.container.style.pointerEvents = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private getVictoryTypeName(type: number): string {
    const names: Record<number, string> = {
      [VictoryType.SURRENDER]: 'Surrender',
      [VictoryType.ANNIHILATION]: 'Annihilation',
      [VictoryType.GENERAL_KILLED]: 'General Killed',
      [VictoryType.STARVATION]: 'Starvation',
    };
    return names[type] ?? 'Unknown';
  }

  private getVictoryTypeNameChinese(type: number): string {
    const names: Record<number, string> = {
      [VictoryType.SURRENDER]: '\u6295\u964D',
      [VictoryType.ANNIHILATION]: '\u5168\u6B7C',
      [VictoryType.GENERAL_KILLED]: '\u65A9\u5C06',
      [VictoryType.STARVATION]: '\u65AD\u7CAE',
    };
    return names[type] ?? '?';
  }

  destroy(): void {
    this.container.remove();
  }
}
