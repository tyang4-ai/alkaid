const STYLE_ID = 'alkaid-loading-screen-style';

const CSS = `
@keyframes alkaid-dot-pulse {
  0%, 20% { opacity: 0; }
  40% { opacity: 1; }
  100% { opacity: 0; }
}

.alkaid-loading-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(10, 8, 6, 0.96);
  z-index: 950;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease;
  font-family: "Noto Serif SC", "SimSun", serif;
}

.alkaid-loading-overlay.visible {
  opacity: 1;
  pointer-events: auto;
}

.alkaid-loading-message {
  color: #D4C4A0;
  font-size: 22px;
  letter-spacing: 2px;
  margin-bottom: 8px;
}

.alkaid-loading-dots {
  display: inline-flex;
  gap: 4px;
  margin-left: 2px;
}

.alkaid-loading-dots span {
  color: #C9A84C;
  font-size: 22px;
  opacity: 0;
  animation: alkaid-dot-pulse 1.4s ease-in-out infinite;
}

.alkaid-loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.alkaid-loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}
`;

export class LoadingScreen {
  private overlay: HTMLDivElement;
  private messageEl: HTMLSpanElement;
  private styleEl: HTMLStyleElement | null = null;

  constructor() {
    // Inject keyframes style if not already present
    if (!document.getElementById(STYLE_ID)) {
      this.styleEl = document.createElement('style');
      this.styleEl.id = STYLE_ID;
      this.styleEl.textContent = CSS;
      document.head.appendChild(this.styleEl);
    }

    this.overlay = document.createElement('div');
    this.overlay.className = 'alkaid-loading-overlay';

    const content = document.createElement('div');
    content.style.textAlign = 'center';

    this.messageEl = document.createElement('span');
    this.messageEl.className = 'alkaid-loading-message';
    this.messageEl.textContent = '生成地形...';

    const dots = document.createElement('span');
    dots.className = 'alkaid-loading-dots';
    dots.innerHTML = '<span>.</span><span>.</span><span>.</span>';

    const line = document.createElement('div');
    line.style.display = 'flex';
    line.style.alignItems = 'baseline';
    line.style.justifyContent = 'center';
    line.appendChild(this.messageEl);
    line.appendChild(dots);

    content.appendChild(line);
    this.overlay.appendChild(content);
    document.body.appendChild(this.overlay);
  }

  show(message?: string): void {
    if (message) {
      this.messageEl.textContent = message;
    }
    // Force reflow so transition triggers even if called synchronously after constructor
    void this.overlay.offsetHeight;
    this.overlay.classList.add('visible');
  }

  setMessage(message: string): void {
    this.messageEl.textContent = message;
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }

  destroy(): void {
    this.overlay.remove();
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }
}
