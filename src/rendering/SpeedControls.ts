import type { EventBus } from '../core/EventBus';
import { SPEED_OPTIONS } from '../constants';

export class SpeedControls {
  private container: HTMLDivElement;
  private pauseBtn: HTMLButtonElement;
  private speedBtns: HTMLButtonElement[] = [];
  private eventBus: EventBus;
  private currentSpeed = 1.0;
  private paused = false;

  constructor(parentElement: HTMLElement, eventBus: EventBus) {
    this.eventBus = eventBus;

    this.container = document.createElement('div');
    this.container.className = 'speed-controls';
    this.container.style.cssText = `
      position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 4px; padding: 6px 10px; z-index: 90;
      background: rgba(28, 20, 16, 0.92); border: 1px solid #8B7D3C;
      border-radius: 4px; pointer-events: auto; user-select: none;
    `;

    // Pause button
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.textContent = '⏸';
    this.styleButton(this.pauseBtn, false);
    this.pauseBtn.addEventListener('click', () => {
      if (this.paused) {
        this.eventBus.emit('game:resumed', undefined);
      } else {
        this.eventBus.emit('game:paused', undefined);
      }
    });
    this.container.appendChild(this.pauseBtn);

    // Speed buttons
    for (const speed of SPEED_OPTIONS) {
      const btn = document.createElement('button');
      btn.textContent = `${speed}x`;
      btn.dataset.speed = String(speed);
      this.styleButton(btn, speed === 1.0);
      btn.addEventListener('click', () => {
        this.eventBus.emit('speed:changed', { multiplier: speed });
      });
      this.speedBtns.push(btn);
      this.container.appendChild(btn);
    }

    this.container.style.display = 'none';
    parentElement.appendChild(this.container);

    // Listen for external state changes
    this.eventBus.on('game:paused', () => this.syncState(true, this.currentSpeed));
    this.eventBus.on('game:resumed', () => this.syncState(false, this.currentSpeed));
    this.eventBus.on('speed:changed', ({ multiplier }) => this.syncState(this.paused, multiplier));
  }

  private styleButton(btn: HTMLButtonElement, active: boolean): void {
    btn.style.cssText = `
      background: ${active ? '#C9A84C' : 'rgba(60, 50, 40, 0.8)'};
      color: ${active ? '#1C1410' : '#D4C4A0'};
      border: 1px solid ${active ? '#C9A84C' : '#5A4A3A'};
      padding: 4px 8px; border-radius: 3px; cursor: pointer;
      font-size: 13px; font-family: monospace; min-width: 36px;
    `;
  }

  private syncState(paused: boolean, speed: number): void {
    this.paused = paused;
    this.currentSpeed = speed;
    this.pauseBtn.textContent = paused ? '▶' : '⏸';
    for (const btn of this.speedBtns) {
      const s = parseFloat(btn.dataset.speed!);
      this.styleButton(btn, s === speed);
    }
  }

  update(paused: boolean, speed: number): void {
    if (paused !== this.paused || speed !== this.currentSpeed) {
      this.syncState(paused, speed);
    }
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  destroy(): void {
    this.container.remove();
  }
}
