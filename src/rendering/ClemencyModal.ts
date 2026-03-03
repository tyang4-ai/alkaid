export class ClemencyModal {
  private overlay: HTMLDivElement;
  private onChoice?: (accepted: boolean) => void;

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

  show(capturedCount: number, onChoice: (accepted: boolean) => void): void {
    this.onChoice = onChoice;
    this.overlay.style.display = 'flex';

    this.overlay.innerHTML = `
      <div style="
        background:rgba(28,20,16,0.97);border:2px solid #C9A84C;border-radius:8px;
        padding:28px 32px;max-width:420px;width:90%;
        display:flex;flex-direction:column;gap:16px;text-align:center;
      ">
        <div>
          <div style="font-size:22px;color:#C9A84C;letter-spacing:2px;">受降</div>
          <div style="font-size:14px;color:#D4C4A0;margin-top:2px;">Accept Surrender</div>
        </div>

        <div style="
          color:#D4C4A0;font-size:13px;line-height:1.6;
          padding:12px;background:rgba(20,15,10,0.6);border-radius:4px;
        ">
          The enemy has surrendered. ${capturedCount} soldiers can be absorbed into your army
          at reduced effectiveness (50% initially, improving each turn).
        </div>

        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="clemency-accept" style="
            padding:10px 24px;border:1px solid #8B7D3C;border-radius:4px;
            background:#2A4A2A;color:#8BAA6B;cursor:pointer;font-size:14px;
          ">Accept 受降</button>
          <button id="clemency-refuse" style="
            padding:10px 24px;border:1px solid #663333;border-radius:4px;
            background:#4A2A2A;color:#AA6666;cursor:pointer;font-size:14px;
          ">Refuse 拒絕</button>
        </div>
      </div>
    `;

    this.overlay.querySelector('#clemency-accept')?.addEventListener('click', () => {
      this.hide();
      this.onChoice?.(true);
    });
    this.overlay.querySelector('#clemency-refuse')?.addEventListener('click', () => {
      this.hide();
      this.onChoice?.(false);
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
