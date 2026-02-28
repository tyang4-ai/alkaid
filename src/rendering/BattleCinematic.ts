import { CINEMATIC_DURATION_MS, VictoryType } from '../constants';

const CINEMATIC_CONFIG: Record<number, {
  text: string;
  bgStyle: string;
  textColor: string;
  animation: string;
}> = {
  [VictoryType.SURRENDER]: {
    text: '投降',
    bgStyle: 'rgba(10, 8, 6, 0.7)',
    textColor: '#C9A84C',
    animation: 'cinematic-sweep',
  },
  [VictoryType.ANNIHILATION]: {
    text: '殲滅',
    bgStyle: 'rgba(20, 10, 10, 0.6)',
    textColor: '#FF6B4A',
    animation: 'cinematic-flash',
  },
  [VictoryType.GENERAL_KILLED]: {
    text: '將亡',
    bgStyle: 'rgba(30, 5, 5, 0.8)',
    textColor: '#C75050',
    animation: 'cinematic-darken',
  },
  [VictoryType.RETREAT]: {
    text: '撤退',
    bgStyle: 'rgba(10, 8, 6, 0.6)',
    textColor: '#8B7D3C',
    animation: 'cinematic-slide',
  },
  [VictoryType.STALEMATE]: {
    text: '僵局',
    bgStyle: 'rgba(20, 18, 14, 0.6)',
    textColor: '#A89070',
    animation: 'cinematic-fade',
  },
};

export class BattleCinematic {
  private overlay: HTMLDivElement;
  private styleEl: HTMLStyleElement;
  private _visible = false;
  private resolvePromise: (() => void) | null = null;
  private skipHandler: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(parentElement: HTMLElement) {
    // Add CSS animations
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = `
      @keyframes cinematic-sweep {
        0% { opacity: 0; transform: translateX(-100px); }
        20% { opacity: 1; transform: translateX(0); }
        80% { opacity: 1; transform: translateX(0); }
        100% { opacity: 0; }
      }
      @keyframes cinematic-flash {
        0% { opacity: 0; }
        5% { opacity: 1; background: rgba(255,100,74,0.3); }
        15% { background: transparent; }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes cinematic-darken {
        0% { opacity: 0; box-shadow: inset 0 0 0 0 rgba(200,50,50,0); }
        20% { opacity: 1; box-shadow: inset 0 0 200px 50px rgba(200,50,50,0.3); }
        80% { opacity: 1; box-shadow: inset 0 0 200px 50px rgba(200,50,50,0.3); }
        100% { opacity: 0; box-shadow: inset 0 0 0 0 rgba(200,50,50,0); }
      }
      @keyframes cinematic-slide {
        0% { opacity: 0; transform: translateX(200px); }
        20% { opacity: 1; transform: translateX(0); }
        80% { opacity: 1; transform: translateX(0); }
        100% { opacity: 0; }
      }
      @keyframes cinematic-fade {
        0% { opacity: 0; filter: sepia(0); }
        20% { opacity: 1; filter: sepia(0.8); }
        80% { opacity: 1; filter: sepia(0.8); }
        100% { opacity: 0; filter: sepia(0); }
      }
      @keyframes cinematic-text-appear {
        0% { opacity: 0; transform: scale(0.8); }
        20% { opacity: 1; transform: scale(1.0); }
        80% { opacity: 1; transform: scale(1.0); }
        100% { opacity: 0; transform: scale(1.1); }
      }
    `;
    document.head?.appendChild(this.styleEl);

    this.overlay = document.createElement('div');
    this.overlay.className = 'battle-cinematic';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: none; z-index: 950; pointer-events: auto;
      justify-content: center; align-items: center;
    `;
    parentElement.appendChild(this.overlay);
  }

  play(type: number): Promise<void> {
    const config = CINEMATIC_CONFIG[type] ?? CINEMATIC_CONFIG[VictoryType.SURRENDER];

    return new Promise<void>((resolve) => {
      this.resolvePromise = resolve;
      this._visible = true;
      this.overlay.style.display = 'flex';
      this.overlay.style.background = config.bgStyle;
      this.overlay.style.animation = `${config.animation} ${CINEMATIC_DURATION_MS}ms ease-in-out forwards`;

      this.overlay.innerHTML = `
        <div style="
          font-size: 72px; color: ${config.textColor}; font-family: serif;
          letter-spacing: 12px; text-shadow: 0 0 40px rgba(0,0,0,0.8);
          animation: cinematic-text-appear ${CINEMATIC_DURATION_MS}ms ease-in-out forwards;
        ">${config.text}</div>
      `;

      // Skip handler
      this.skipHandler = () => this.skip();
      window.addEventListener('keydown', this.skipHandler);
      this.overlay.addEventListener('click', this.skipHandler);

      // Auto-complete
      this.timer = setTimeout(() => {
        this.complete();
      }, CINEMATIC_DURATION_MS);
    });
  }

  private skip(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.complete();
  }

  private complete(): void {
    this._visible = false;
    this.overlay.style.display = 'none';
    this.overlay.style.animation = '';
    this.overlay.innerHTML = '';

    if (this.skipHandler) {
      window.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = null;
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.complete();
    this.overlay.remove();
    this.styleEl.remove();
  }
}
