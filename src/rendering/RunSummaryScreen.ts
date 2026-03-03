import { CAMPAIGN_WIN_TERRITORIES } from '../constants';
import type { CampaignState } from '../simulation/campaign/CampaignTypes';
import type { UnlockManager } from '../simulation/campaign/UnlockManager';

export class RunSummaryScreen {
  private overlay: HTMLDivElement;
  private onNewRun?: () => void;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(10,8,6,0.95);z-index:900;
      display:none;justify-content:center;align-items:center;
      pointer-events:auto;font-family:'Segoe UI',Arial,sans-serif;
    `;
    document.body.appendChild(this.overlay);
  }

  show(
    state: CampaignState,
    unlockManager: UnlockManager,
    pointsEarned: number,
  ): void {
    this.overlay.style.display = 'flex';

    const won = state.territoriesConquered >= CAMPAIGN_WIN_TERRITORIES;
    const heading = won ? '大捷 Victory!' : '败北 Defeat';
    const headingColor = won ? '#C9A84C' : '#C75050';
    const subtext = won
      ? 'All territories conquered. The realm is united.'
      : 'Your general has fallen. The campaign is over.';

    // Unlock points breakdown
    const ptsTerr = state.territoriesConquered * 10;
    const ptsBattles = state.battlesWon * 5;
    const ptsWon = won ? 50 : 0;
    const ptsBonus = state.bonusObjectivesCompleted.length * 15;

    // Available unlocks
    const available = unlockManager.getAvailableUnlocks();
    const unlockHtml = available.length > 0
      ? available.map(u => `
        <div style="
          display:flex;justify-content:space-between;align-items:center;
          padding:6px 8px;background:rgba(20,15,10,0.6);border-radius:4px;
        ">
          <div>
            <span style="color:#C9A84C;font-size:12px;">${u.chineseName}</span>
            <span style="color:#8B7D3C;font-size:11px;">${u.name}</span>
            <div style="color:#666;font-size:10px;">${u.description}</div>
          </div>
          <button class="unlock-buy-btn" data-id="${u.id}" style="
            padding:4px 12px;font-size:11px;background:#6A5A2A;color:#D4C4A0;
            border:1px solid #8B7D3C;border-radius:3px;cursor:pointer;
          ">${u.cost}pts</button>
        </div>
      `).join('')
      : '<div style="color:#555;font-size:12px;">No unlocks available</div>';

    this.overlay.innerHTML = `
      <div style="
        background:rgba(28,20,16,0.97);border:2px solid ${headingColor};border-radius:8px;
        padding:32px 40px;max-width:550px;width:90%;
        display:flex;flex-direction:column;gap:20px;max-height:90vh;overflow-y:auto;
      ">
        <div style="text-align:center;">
          <div style="font-size:32px;color:${headingColor};letter-spacing:4px;">${heading}</div>
          <div style="font-size:13px;color:#8B7D3C;margin-top:4px;">${subtext}</div>
        </div>

        <div style="
          display:grid;grid-template-columns:1fr 1fr;gap:8px;
          padding:12px;background:rgba(20,15,10,0.5);border-radius:4px;
        ">
          <div style="color:#8B7D3C;font-size:12px;">Territories</div>
          <div style="color:#D4C4A0;font-size:12px;text-align:right;">${state.territoriesConquered}/20</div>
          <div style="color:#8B7D3C;font-size:12px;">Battles Won</div>
          <div style="color:#D4C4A0;font-size:12px;text-align:right;">${state.battlesWon}</div>
          <div style="color:#8B7D3C;font-size:12px;">Battles Lost</div>
          <div style="color:#D4C4A0;font-size:12px;text-align:right;">${state.battlesLost}</div>
          <div style="color:#8B7D3C;font-size:12px;">Enemies Defeated</div>
          <div style="color:#D4C4A0;font-size:12px;text-align:right;">${state.totalEnemiesDefeated}</div>
          <div style="color:#8B7D3C;font-size:12px;">Soldiers Lost</div>
          <div style="color:#D4C4A0;font-size:12px;text-align:right;">${state.totalSoldiersLost}</div>
          <div style="color:#8B7D3C;font-size:12px;">Campaign Turns</div>
          <div style="color:#D4C4A0;font-size:12px;text-align:right;">${state.turn}</div>
        </div>

        ${state.mode === 'ironman' ? `
        <div style="
          padding:12px;background:rgba(40,35,20,0.5);border:1px solid #8B7D3C;border-radius:4px;
        ">
          <div style="color:#C9A84C;font-size:14px;margin-bottom:8px;">
            Unlock Points Earned: ${pointsEarned}
          </div>
          <div style="color:#8B7D3C;font-size:11px;">
            Territories: ${ptsTerr} + Battles: ${ptsBattles}${ptsWon > 0 ? ` + Victory: ${ptsWon}` : ''}${ptsBonus > 0 ? ` + Bonus: ${ptsBonus}` : ''}
          </div>
          <div style="color:#8B7D3C;font-size:11px;margin-top:4px;">
            Balance: ${unlockManager.getPointsBalance()} pts
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="color:#C9A84C;font-size:13px;">Available Unlocks</div>
          ${unlockHtml}
        </div>
        ` : `
        <div style="color:#555;font-size:12px;text-align:center;">
          Practice mode — no unlock points earned
        </div>
        `}

        <button id="summary-new-run-btn" style="
          padding:10px 32px;border:2px solid #8B7D3C;border-radius:6px;
          background:#8B2500;color:#D4C4A0;cursor:pointer;font-size:16px;
          align-self:center;letter-spacing:1px;
        ">New Run 再戰</button>
      </div>
    `;

    this.bindEvents(unlockManager);
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = '';
  }

  setOnNewRun(cb: () => void): void {
    this.onNewRun = cb;
  }

  destroy(): void {
    this.overlay.remove();
  }

  private bindEvents(um: UnlockManager): void {
    // Buy unlock buttons
    this.overlay.querySelectorAll<HTMLButtonElement>('.unlock-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id!;
        if (um.purchaseUnlock(id)) {
          btn.textContent = '✓';
          btn.disabled = true;
          btn.style.background = '#333';
          btn.style.color = '#6B8E5A';
          // Update balance display
          const balEl = this.overlay.querySelector('[data-balance]');
          if (balEl) balEl.textContent = `Balance: ${um.getPointsBalance()} pts`;
        }
      });
    });

    // New run button
    this.overlay.querySelector('#summary-new-run-btn')?.addEventListener('click', () => {
      this.onNewRun?.();
    });
  }
}
