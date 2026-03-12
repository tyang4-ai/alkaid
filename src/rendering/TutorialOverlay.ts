interface TutorialSlide {
  titleCN: string;
  titleEN: string;
  body: string;
  icon: string;
}

const SLIDES: TutorialSlide[] = [
  {
    titleCN: '兵種',
    titleEN: 'Units',
    body: 'Your army has infantry, cavalry, and ranged units. Each has strengths and weaknesses.',
    icon: '\u2694',
  },
  {
    titleCN: '命令',
    titleEN: 'Orders',
    body: 'Right-click to move. Right-click an enemy to attack. Use the radial menu for advanced orders.',
    icon: '\u2691',
  },
  {
    titleCN: '地形',
    titleEN: 'Terrain',
    body: 'Hills give defense bonuses. Forests slow movement. Rivers block cavalry.',
    icon: '\u26F0',
  },
  {
    titleCN: '士氣與補給',
    titleEN: 'Morale & Supply',
    body: 'Units rout when morale drops. Armies starve without supply. Rest between battles.',
    icon: '\u26C8',
  },
  {
    titleCN: '勝利',
    titleEN: 'Victory',
    body: 'Win by destroying the enemy army, killing their general, or breaking their will to fight.',
    icon: '\u2655',
  },
];

export class TutorialOverlay {
  private overlay: HTMLDivElement;
  private currentSlide = 0;
  private onCloseCallback?: () => void;
  private dontShowAgainCallback?: (val: boolean) => void;
  private dontShowAgain = false;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(10,8,6,0.96);z-index:1000;
      display:none;justify-content:center;align-items:center;
      pointer-events:auto;font-family:'Segoe UI',Arial,sans-serif;
      opacity:0;transition:opacity 0.4s ease;
    `;
    document.body.appendChild(this.overlay);
  }

  show(onClose: () => void): void {
    this.onCloseCallback = onClose;
    this.currentSlide = 0;
    this.dontShowAgain = false;
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
    });
    this.render();
  }

  hide(): void {
    this.overlay.style.opacity = '0';
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.overlay.innerHTML = '';
    }, 400);
  }

  setDontShowAgainCallback(cb: (val: boolean) => void): void {
    this.dontShowAgainCallback = cb;
  }

  destroy(): void {
    this.overlay.remove();
  }

  private close(): void {
    if (this.dontShowAgain) {
      this.dontShowAgainCallback?.(true);
    }
    this.hide();
    this.onCloseCallback?.();
  }

  private render(): void {
    const slide = SLIDES[this.currentSlide];
    const isFirst = this.currentSlide === 0;
    const isLast = this.currentSlide === SLIDES.length - 1;

    const dotsHtml = SLIDES.map((_, i) => {
      const active = i === this.currentSlide;
      return `<span class="tut-dot" data-idx="${i}" style="
        display:inline-block;width:10px;height:10px;border-radius:50%;
        margin:0 5px;cursor:pointer;transition:background 0.3s,border-color 0.3s;
        background:${active ? '#C9A84C' : 'transparent'};
        border:1px solid ${active ? '#C9A84C' : '#8B7D3C'};
      "></span>`;
    }).join('');

    const checkboxHtml = isLast ? `
      <label style="
        display:flex;align-items:center;gap:8px;
        color:#8B7D3C;font-size:12px;cursor:pointer;margin-top:8px;
        user-select:none;
      ">
        <input type="checkbox" id="tut-dontshow" style="
          accent-color:#C9A84C;cursor:pointer;
        " ${this.dontShowAgain ? 'checked' : ''}/>
        不再顯示 Don't show again
      </label>
    ` : '';

    this.overlay.innerHTML = `
      <div style="
        background:rgba(28,20,16,0.97);border:2px solid #8B7D3C;border-radius:8px;
        padding:32px 40px;max-width:480px;width:90%;
        display:flex;flex-direction:column;align-items:center;gap:20px;
        position:relative;
      ">
        <!-- Skip button -->
        <button id="tut-skip" style="
          position:absolute;top:12px;right:16px;
          background:none;border:none;color:#8B7D3C;
          font-size:12px;cursor:pointer;font-family:inherit;
          padding:4px 8px;transition:color 0.2s;
        ">Skip \u203A</button>

        <!-- Slide icon -->
        <div style="font-size:36px;line-height:1;margin-top:4px;">${slide.icon}</div>

        <!-- Title -->
        <div style="text-align:center;">
          <div style="font-size:24px;color:#C9A84C;letter-spacing:3px;">${slide.titleCN}</div>
          <div style="font-size:13px;color:#8B7D3C;margin-top:2px;letter-spacing:2px;">${slide.titleEN}</div>
        </div>

        <!-- Body -->
        <div class="tut-body" style="
          color:#D4C4A0;font-size:14px;line-height:1.7;text-align:center;
          padding:16px 20px;
          background:rgba(20,15,10,0.6);border-radius:4px;
          border-left:3px solid #8B7D3C;border-right:3px solid #8B7D3C;
          width:100%;box-sizing:border-box;
          opacity:1;transition:opacity 0.3s ease;
        ">${slide.body}</div>

        <!-- Dot indicators -->
        <div style="display:flex;align-items:center;justify-content:center;">
          ${dotsHtml}
        </div>

        <!-- Checkbox (last slide only) -->
        ${checkboxHtml}

        <!-- Navigation buttons -->
        <div style="display:flex;gap:12px;width:100%;justify-content:center;">
          ${!isFirst ? `
            <button id="tut-prev" style="
              padding:9px 22px;border:1px solid #8B7D3C;border-radius:4px;
              background:rgba(60,40,30,0.8);color:#D4C4A0;cursor:pointer;
              font-size:13px;font-family:inherit;transition:background 0.2s;
            ">\u25C0 Previous</button>
          ` : ''}
          <button id="tut-next" style="
            padding:9px 22px;border:1px solid #C9A84C;border-radius:4px;
            background:${isLast ? '#8B2500' : 'rgba(60,40,30,0.8)'};
            color:#D4C4A0;cursor:pointer;
            font-size:13px;font-family:inherit;transition:background 0.2s;
          ">${isLast ? 'Begin \u25B6' : 'Next \u25B6'}</button>
        </div>

        <!-- Slide counter -->
        <div style="color:#5A4D3C;font-size:11px;">${this.currentSlide + 1} / ${SLIDES.length}</div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Skip button
    const skipBtn = this.overlay.querySelector('#tut-skip') as HTMLButtonElement | null;
    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.close());
      skipBtn.addEventListener('mouseenter', () => { skipBtn.style.color = '#D4C4A0'; });
      skipBtn.addEventListener('mouseleave', () => { skipBtn.style.color = '#8B7D3C'; });
    }

    // Previous button
    const prevBtn = this.overlay.querySelector('#tut-prev') as HTMLButtonElement | null;
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentSlide > 0) {
          this.fadeTransition(() => {
            this.currentSlide--;
            this.render();
          });
        }
      });
      prevBtn.addEventListener('mouseenter', () => { prevBtn.style.background = '#8B2500'; });
      prevBtn.addEventListener('mouseleave', () => { prevBtn.style.background = 'rgba(60,40,30,0.8)'; });
    }

    // Next / Begin button
    const nextBtn = this.overlay.querySelector('#tut-next') as HTMLButtonElement | null;
    if (nextBtn) {
      const isLast = this.currentSlide === SLIDES.length - 1;
      nextBtn.addEventListener('click', () => {
        if (isLast) {
          this.close();
        } else {
          this.fadeTransition(() => {
            this.currentSlide++;
            this.render();
          });
        }
      });
      nextBtn.addEventListener('mouseenter', () => {
        nextBtn.style.background = isLast ? '#A23B2C' : '#8B2500';
      });
      nextBtn.addEventListener('mouseleave', () => {
        nextBtn.style.background = isLast ? '#8B2500' : 'rgba(60,40,30,0.8)';
      });
    }

    // Dot indicators
    this.overlay.querySelectorAll<HTMLSpanElement>('.tut-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.idx!);
        if (idx !== this.currentSlide) {
          this.fadeTransition(() => {
            this.currentSlide = idx;
            this.render();
          });
        }
      });
    });

    // Don't show again checkbox
    const checkbox = this.overlay.querySelector('#tut-dontshow') as HTMLInputElement | null;
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        this.dontShowAgain = checkbox.checked;
      });
    }
  }

  private fadeTransition(onChange: () => void): void {
    const body = this.overlay.querySelector('.tut-body') as HTMLElement | null;
    if (body) {
      body.style.opacity = '0';
      setTimeout(() => {
        onChange();
      }, 200);
    } else {
      onChange();
    }
  }
}
