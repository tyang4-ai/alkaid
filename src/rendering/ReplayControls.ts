import { eventBus } from '../core/EventBus';

export class ReplayControls {
  private container: HTMLDivElement;
  private timeline: HTMLInputElement;
  private playPauseBtn: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  private fowBtn: HTMLButtonElement;
  private exitBtn: HTMLButtonElement;
  private tickLabel: HTMLSpanElement;
  private _visible = false;
  private _paused = false;
  private _speed = 1;
  private _fowMode: 'player' | 'enemy' | 'none' = 'player';
  private totalTicks = 0;

  private onExitCallback: (() => void) | null = null;

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(28, 20, 16, 0.92);
      border: 1px solid #8B7D3C;
      border-radius: 4px;
      padding: 8px 16px;
      display: none;
      z-index: 200;
      color: #D4C4A0;
      font-family: 'Noto Serif SC', serif;
      font-size: 12px;
      gap: 8px;
      align-items: center;
    `;
    this.container.setAttribute('role', 'toolbar');
    this.container.setAttribute('aria-label', 'Replay Controls');

    // Play/Pause
    this.playPauseBtn = this.createButton('▶', 'Play/Pause');
    this.playPauseBtn.addEventListener('click', () => {
      this._paused = !this._paused;
      this.playPauseBtn.textContent = this._paused ? '▶' : '⏸';
      if (this._paused) {
        eventBus.emit('game:paused', undefined);
      } else {
        eventBus.emit('game:resumed', undefined);
      }
    });

    // Timeline scrubber
    this.timeline = document.createElement('input');
    this.timeline.type = 'range';
    this.timeline.min = '0';
    this.timeline.max = '0';
    this.timeline.value = '0';
    this.timeline.style.cssText = 'width: 200px; accent-color: #C9A84C;';
    this.timeline.addEventListener('input', () => {
      const tick = parseInt(this.timeline.value);
      eventBus.emit('replay:scrubTo', { tick });
    });

    // Tick label
    this.tickLabel = document.createElement('span');
    this.tickLabel.style.cssText = 'min-width: 80px; text-align: center; font-family: monospace; font-size: 11px;';
    this.tickLabel.textContent = '0 / 0';

    // Speed
    this.speedBtn = this.createButton('1x', 'Speed');
    this.speedBtn.addEventListener('click', () => {
      const speeds = [1, 2, 4];
      const idx = speeds.indexOf(this._speed);
      this._speed = speeds[(idx + 1) % speeds.length];
      this.speedBtn.textContent = `${this._speed}x`;
      eventBus.emit('speed:changed', { multiplier: this._speed });
    });

    // FOW toggle
    this.fowBtn = this.createButton('Player View', 'FOW Mode');
    this.fowBtn.addEventListener('click', () => {
      const modes: Array<'player' | 'enemy' | 'none'> = ['player', 'enemy', 'none'];
      const labels = ['Player View', 'Enemy View', 'Full Map'];
      const idx = modes.indexOf(this._fowMode);
      this._fowMode = modes[(idx + 1) % modes.length];
      this.fowBtn.textContent = labels[(idx + 1) % modes.length];
      eventBus.emit('replay:fowToggled', { mode: this._fowMode });
    });

    // Exit replay
    this.exitBtn = this.createButton('Exit Replay', 'Exit');
    this.exitBtn.style.background = '#8B2500';
    this.exitBtn.addEventListener('click', () => {
      this.onExitCallback?.();
    });

    // Assemble
    this.container.appendChild(this.playPauseBtn);
    this.container.appendChild(this.timeline);
    this.container.appendChild(this.tickLabel);
    this.container.appendChild(this.speedBtn);
    this.container.appendChild(this.fowBtn);
    this.container.appendChild(this.exitBtn);

    parentElement.appendChild(this.container);
  }

  setOnExit(cb: () => void): void {
    this.onExitCallback = cb;
  }

  show(totalTicks: number): void {
    this.totalTicks = totalTicks;
    this.timeline.max = String(totalTicks);
    this.timeline.value = '0';
    this.tickLabel.textContent = `0 / ${totalTicks}`;
    this._paused = false;
    this._speed = 1;
    this._fowMode = 'player';
    this.playPauseBtn.textContent = '⏸';
    this.speedBtn.textContent = '1x';
    this.fowBtn.textContent = 'Player View';
    this.container.style.display = 'flex';
    this._visible = true;
  }

  hide(): void {
    this.container.style.display = 'none';
    this._visible = false;
  }

  updateTick(currentTick: number): void {
    this.timeline.value = String(currentTick);
    this.tickLabel.textContent = `${currentTick} / ${this.totalTicks}`;
  }

  get visible(): boolean {
    return this._visible;
  }

  get paused(): boolean {
    return this._paused;
  }

  get fowMode(): 'player' | 'enemy' | 'none' {
    return this._fowMode;
  }

  private createButton(text: string, ariaLabel: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.setAttribute('aria-label', ariaLabel);
    btn.style.cssText = `
      background: #2A1F14; color: #D4C4A0; border: 1px solid #8B7D3C;
      padding: 4px 10px; cursor: pointer; font-size: 12px; border-radius: 2px;
    `;
    return btn;
  }

  destroy(): void {
    this.container.remove();
  }
}
