import type { RandomEventDefinition } from '../simulation/campaign/CampaignTypes';

export class RandomEventModal {
  private overlay: HTMLDivElement;
  private onChoice?: (choiceIndex: number) => void;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(10,8,6,0.80);z-index:700;
      display:none;justify-content:center;align-items:center;
      pointer-events:auto;font-family:'Segoe UI',Arial,sans-serif;
    `;
    document.body.appendChild(this.overlay);
  }

  show(def: RandomEventDefinition, onChoice: (choiceIndex: number) => void): void {
    this.onChoice = onChoice;
    this.overlay.style.display = 'flex';

    const choicesHtml = def.choices.map((c, i) => `
      <button class="event-choice-btn" data-idx="${i}" style="
        padding:10px 16px;border:1px solid #8B7D3C;border-radius:4px;
        background:rgba(60,40,30,0.8);color:#D4C4A0;cursor:pointer;
        font-size:13px;text-align:left;width:100%;
      ">
        <div style="color:#C9A84C;">${c.chineseLabel} ${c.label}</div>
        <div style="color:#8B7D3C;font-size:11px;margin-top:4px;">${c.description}</div>
      </button>
    `).join('');

    this.overlay.innerHTML = `
      <div style="
        background:rgba(28,20,16,0.97);border:2px solid #C9A84C;border-radius:8px;
        padding:28px 32px;max-width:450px;width:90%;
        display:flex;flex-direction:column;gap:16px;
      ">
        <div style="text-align:center;">
          <div style="font-size:22px;color:#C9A84C;letter-spacing:2px;">${def.chineseName}</div>
          <div style="font-size:14px;color:#D4C4A0;margin-top:2px;">${def.name}</div>
        </div>

        <div style="
          color:#D4C4A0;font-size:13px;line-height:1.6;
          padding:12px;background:rgba(20,15,10,0.6);border-radius:4px;
          border-left:3px solid #8B7D3C;
        ">
          ${def.description}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          ${choicesHtml}
        </div>
      </div>
    `;

    this.overlay.querySelectorAll<HTMLButtonElement>('.event-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx!);
        this.hide();
        this.onChoice?.(idx);
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#8B2500';
        btn.style.borderColor = '#C9A84C';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(60,40,30,0.8)';
        btn.style.borderColor = '#8B7D3C';
      });
    });
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = '';
  }

  destroy(): void {
    this.overlay.remove();
  }
}
