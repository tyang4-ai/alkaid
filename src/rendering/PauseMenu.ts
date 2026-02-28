import type { EventBus } from '../core/EventBus';

export class PauseMenu {
  private overlay: HTMLDivElement;
  private retreatDialog: HTMLDivElement | null = null;
  private eventBus: EventBus;
  private onRetreatConfirm: (() => void) | null = null;

  constructor(parentElement: HTMLElement, eventBus: EventBus) {
    this.eventBus = eventBus;

    this.overlay = document.createElement('div');
    this.overlay.className = 'pause-menu';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(10, 8, 6, 0.7); display: none; z-index: 500;
      justify-content: center; align-items: center; flex-direction: column;
      pointer-events: auto;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: rgba(28, 20, 16, 0.95); border: 2px solid #8B7D3C;
      border-radius: 6px; padding: 32px 48px; text-align: center;
    `;

    const title = document.createElement('div');
    title.textContent = '暫停 — PAUSED';
    title.style.cssText = `
      font-size: 28px; color: #D4C4A0; font-family: serif;
      margin-bottom: 24px; letter-spacing: 2px;
    `;
    panel.appendChild(title);

    const resumeBtn = document.createElement('button');
    resumeBtn.textContent = 'Resume';
    this.styleMenuButton(resumeBtn);
    resumeBtn.addEventListener('click', () => {
      this.eventBus.emit('game:resumed', undefined);
    });
    panel.appendChild(resumeBtn);

    const menuBtn = document.createElement('button');
    menuBtn.textContent = 'Return to Menu';
    this.styleMenuButton(menuBtn);
    menuBtn.style.marginTop = '8px';
    menuBtn.style.background = 'rgba(60, 50, 40, 0.8)';
    menuBtn.addEventListener('click', () => {
      window.location.reload();
    });
    panel.appendChild(menuBtn);

    this.overlay.appendChild(panel);
    parentElement.appendChild(this.overlay);

    // Auto-show/hide on events
    this.eventBus.on('game:paused', () => this.show());
    this.eventBus.on('game:resumed', () => this.hide());
  }

  private styleMenuButton(btn: HTMLButtonElement): void {
    btn.style.cssText = `
      display: block; width: 200px; padding: 10px 20px; margin: 0 auto;
      background: #8B2500; color: #D4C4A0; border: 1px solid #8B7D3C;
      border-radius: 4px; cursor: pointer; font-size: 16px; font-family: serif;
    `;
  }

  show(): void {
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.hideRetreatConfirm();
  }

  showRetreatConfirm(onConfirm: () => void): void {
    if (this.retreatDialog) return;
    this.onRetreatConfirm = onConfirm;

    this.retreatDialog = document.createElement('div');
    this.retreatDialog.className = 'retreat-confirm';
    this.retreatDialog.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(28, 20, 16, 0.95); border: 2px solid #8B7D3C;
      border-radius: 6px; padding: 20px 28px; text-align: center;
      z-index: 510; pointer-events: auto;
    `;

    const msg = document.createElement('div');
    msg.textContent = 'Retreat? All units will withdraw.';
    msg.style.cssText = 'color: #D4C4A0; font-size: 16px; margin-bottom: 16px; font-family: serif;';
    this.retreatDialog.appendChild(msg);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm Retreat';
    confirmBtn.className = 'retreat-confirm-btn';
    this.styleMenuButton(confirmBtn);
    confirmBtn.style.width = 'auto';
    confirmBtn.addEventListener('click', () => {
      this.onRetreatConfirm?.();
      this.hideRetreatConfirm();
    });
    btnRow.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    this.styleMenuButton(cancelBtn);
    cancelBtn.style.width = 'auto';
    cancelBtn.style.background = 'rgba(60, 50, 40, 0.8)';
    cancelBtn.addEventListener('click', () => this.hideRetreatConfirm());
    btnRow.appendChild(cancelBtn);

    this.retreatDialog.appendChild(btnRow);
    this.overlay.parentElement!.appendChild(this.retreatDialog);
  }

  hideRetreatConfirm(): void {
    if (this.retreatDialog) {
      this.retreatDialog.remove();
      this.retreatDialog = null;
      this.onRetreatConfirm = null;
    }
  }

  get isRetreatConfirmVisible(): boolean {
    return this.retreatDialog !== null;
  }

  destroy(): void {
    this.overlay.remove();
    this.hideRetreatConfirm();
  }
}
