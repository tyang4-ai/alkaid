import type { EventBus } from '../core/EventBus';

export class SaveToast {
  private el: HTMLDivElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parentElement: HTMLElement, eventBus: EventBus) {
    this.el = document.createElement('div');
    this.el.className = 'save-toast';
    this.el.style.cssText = `
      position: absolute; bottom: 20px; left: 20px;
      background: rgba(28, 20, 16, 0.9); border: 1px solid #8B7D3C;
      border-radius: 4px; padding: 8px 16px;
      color: #D4C4A0; font-family: serif; font-size: 14px;
      z-index: 50; opacity: 0; transition: opacity 0.2s ease;
      pointer-events: none;
    `;
    this.el.textContent = 'Saved \u2713';
    parentElement.appendChild(this.el);

    eventBus.on('save:completed', (data) => {
      if (data.success) this.flash();
    });
  }

  flash(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.el.style.opacity = '1';
    this.hideTimer = setTimeout(() => {
      this.el.style.opacity = '0';
      this.hideTimer = null;
    }, 1700);
  }

  destroy(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.el.remove();
  }
}
