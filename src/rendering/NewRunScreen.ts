import type { Territory } from '../simulation/campaign/CampaignTypes';

export class NewRunScreen {
  private overlay: HTMLDivElement;
  private onStart?: (territoryId: string, mode: 'ironman' | 'practice') => void;
  private selectedTerritoryId: string | null = null;
  private mode: 'ironman' | 'practice' = 'ironman';

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(10,8,6,0.92);z-index:500;
      display:none;justify-content:center;align-items:center;
      pointer-events:auto;font-family:'Segoe UI',Arial,sans-serif;
    `;
    this.overlay.classList.add('alkaid-overlay', 'alkaid-hidden');
    document.body.appendChild(this.overlay);
  }

  show(candidates: Territory[]): void {
    this.selectedTerritoryId = null;
    this.mode = 'ironman';
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => this.overlay.classList.remove('alkaid-hidden'));
    this.render(candidates);
  }

  hide(): void {
    this.overlay.classList.add('alkaid-hidden');
    setTimeout(() => { this.overlay.style.display = 'none'; }, 200);
    this.overlay.innerHTML = '';
  }

  setOnStart(cb: (territoryId: string, mode: 'ironman' | 'practice') => void): void {
    this.onStart = cb;
  }

  destroy(): void {
    this.overlay.remove();
  }

  private render(candidates: Territory[]): void {
    const territoryCards = candidates.map(t => `
      <div class="nr-territory-card" data-id="${t.id}" style="
        background:rgba(28,20,16,0.95);border:2px solid #555;border-radius:6px;
        padding:16px 20px;cursor:pointer;transition:border-color 0.2s;
        min-width:180px;text-align:center;
      ">
        <div style="font-size:22px;color:#C9A84C;margin-bottom:4px;">${t.chineseName}</div>
        <div style="font-size:14px;color:#D4C4A0;margin-bottom:8px;">${t.name}</div>
        <div style="font-size:12px;color:#8B7D3C;">
          ${this.getTerritoryTypeLabel(t.type)}<br>
          Garrison: ${t.garrisonStrength} squads
          ${t.specialBonus ? `<br><span style="color:#6B8E5A;">★ ${t.specialBonus.replace(/_/g, ' ')}</span>` : ''}
        </div>
      </div>
    `).join('');

    this.overlay.innerHTML = `
      <div style="
        background:rgba(28,20,16,0.97);border:2px solid #8B7D3C;border-radius:8px;
        padding:32px 40px;max-width:700px;width:90%;display:flex;flex-direction:column;
        align-items:center;gap:24px;
      ">
        <div style="text-align:center;">
          <div style="font-size:28px;color:#C9A84C;letter-spacing:3px;margin-bottom:4px;">新征途</div>
          <div style="font-size:16px;color:#D4C4A0;">New Campaign</div>
        </div>

        <div style="color:#8B7D3C;font-size:13px;text-align:center;">
          Choose your starting territory
        </div>

        <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
          ${territoryCards}
        </div>

        <div style="display:flex;gap:16px;align-items:center;">
          <span style="color:#8B7D3C;font-size:13px;">Mode:</span>
          <button id="nr-mode-ironman" style="
            padding:6px 16px;border:1px solid #8B7D3C;border-radius:4px;
            background:#8B2500;color:#D4C4A0;cursor:pointer;font-size:13px;
          ">Ironman 铁人</button>
          <button id="nr-mode-practice" style="
            padding:6px 16px;border:1px solid #555;border-radius:4px;
            background:rgba(28,20,16,0.8);color:#8B7D3C;cursor:pointer;font-size:13px;
          ">Practice 练习</button>
        </div>

        <button id="nr-start-btn" style="
          padding:10px 32px;border:2px solid #555;border-radius:6px;
          background:rgba(60,40,30,0.6);color:#555;cursor:not-allowed;
          font-size:16px;letter-spacing:1px;
        " disabled>Begin Campaign 開始</button>
      </div>
    `;

    this.bindEvents(candidates);
  }

  private bindEvents(_candidates: Territory[]): void {
    // Territory card selection
    const cards = this.overlay.querySelectorAll<HTMLDivElement>('.nr-territory-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id!;
        this.selectedTerritoryId = id;
        // Update visual selection
        cards.forEach(c => {
          c.style.borderColor = c.dataset.id === id ? '#C9A84C' : '#555';
        });
        // Enable start button
        const btn = this.overlay.querySelector<HTMLButtonElement>('#nr-start-btn')!;
        btn.disabled = false;
        btn.style.background = '#8B2500';
        btn.style.color = '#D4C4A0';
        btn.style.borderColor = '#8B7D3C';
        btn.style.cursor = 'pointer';
      });
      card.addEventListener('mouseenter', () => {
        if (card.dataset.id !== this.selectedTerritoryId) {
          card.style.borderColor = '#8B7D3C';
        }
      });
      card.addEventListener('mouseleave', () => {
        if (card.dataset.id !== this.selectedTerritoryId) {
          card.style.borderColor = '#555';
        }
      });
    });

    // Mode toggle
    const ironmanBtn = this.overlay.querySelector<HTMLButtonElement>('#nr-mode-ironman')!;
    const practiceBtn = this.overlay.querySelector<HTMLButtonElement>('#nr-mode-practice')!;
    ironmanBtn.addEventListener('click', () => {
      this.mode = 'ironman';
      ironmanBtn.style.background = '#8B2500';
      ironmanBtn.style.borderColor = '#8B7D3C';
      ironmanBtn.style.color = '#D4C4A0';
      practiceBtn.style.background = 'rgba(28,20,16,0.8)';
      practiceBtn.style.borderColor = '#555';
      practiceBtn.style.color = '#8B7D3C';
    });
    practiceBtn.addEventListener('click', () => {
      this.mode = 'practice';
      practiceBtn.style.background = '#8B2500';
      practiceBtn.style.borderColor = '#8B7D3C';
      practiceBtn.style.color = '#D4C4A0';
      ironmanBtn.style.background = 'rgba(28,20,16,0.8)';
      ironmanBtn.style.borderColor = '#555';
      ironmanBtn.style.color = '#8B7D3C';
    });

    // Start button
    const startBtn = this.overlay.querySelector<HTMLButtonElement>('#nr-start-btn')!;
    startBtn.addEventListener('click', () => {
      if (this.selectedTerritoryId) {
        this.onStart?.(this.selectedTerritoryId, this.mode);
      }
    });
  }

  private getTerritoryTypeLabel(type: number): string {
    const labels: Record<number, string> = {
      0: 'Farming Plains 农田',
      1: 'Trade City 商城',
      2: 'Horse Plains 马场',
      3: 'Iron Mountains 铁山',
      4: 'River Port 河港',
      5: 'Forest Region 林区',
      6: 'Capital City 帝都',
      7: 'Frontier Fort 边关',
    };
    return labels[type] ?? 'Unknown';
  }
}
