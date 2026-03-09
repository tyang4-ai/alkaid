/**
 * Hackathon landing/welcome screen — shown on first load.
 * "Alkaid AI War Room — Powered by DigitalOcean Gradient"
 */

export class LandingScreen {
  private overlay: HTMLDivElement;
  private onStart?: () => void;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(10,8,6,0.96);z-index:900;
      display:flex;justify-content:center;align-items:center;
      pointer-events:auto;font-family:'Segoe UI',Arial,sans-serif;
    `;
    this.overlay.classList.add('alkaid-overlay');
    document.body.appendChild(this.overlay);
    this.render();
  }

  setOnStart(cb: () => void): void {
    this.onStart = cb;
  }

  show(): void {
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => this.overlay.classList.remove('alkaid-hidden'));
  }

  hide(): void {
    this.overlay.classList.add('alkaid-hidden');
    setTimeout(() => { this.overlay.style.display = 'none'; }, 200);
  }

  destroy(): void {
    this.overlay.remove();
  }

  private render(): void {
    this.overlay.innerHTML = `
      <div style="
        text-align:center;max-width:800px;width:90%;
        display:flex;flex-direction:column;align-items:center;gap:28px;
      ">
        <!-- Title -->
        <div style="margin-bottom:8px;">
          <div style="
            font-size:56px;color:#C9A84C;font-family:serif;
            letter-spacing:8px;line-height:1.2;
            text-shadow:0 0 40px rgba(201,168,76,0.3);
          ">破軍</div>
          <div style="
            font-size:28px;color:#D4C4A0;font-family:serif;
            letter-spacing:6px;margin-top:4px;
          ">ALKAID</div>
          <div style="
            font-size:13px;color:#8B7D3C;letter-spacing:4px;
            margin-top:12px;text-transform:uppercase;
          ">AI War Room</div>
        </div>

        <!-- Tagline -->
        <div style="
          font-size:15px;color:#D4C4A0;line-height:1.7;
          max-width:600px;font-style:italic;
        ">
          "The supreme art of war is to subdue the enemy without fighting."<br>
          <span style="color:#8B7D3C;font-size:12px;">— Sun Tzu, The Art of War</span>
        </div>

        <!-- Feature Cards -->
        <div style="
          display:grid;grid-template-columns:repeat(3,1fr);gap:16px;
          width:100%;margin-top:8px;
        ">
          ${this.featureCard(
            '孫子',
            'AI Strategist',
            'Sun Tzu persona with Art of War wisdom, battle analysis, and army recommendations',
            '#C9A84C',
          )}
          ${this.featureCard(
            '智',
            'RL-Trained AI',
            'Deep reinforcement learning opponent trained on GPU Droplets with curriculum learning',
            '#4CAF50',
          )}
          ${this.featureCard(
            '圖',
            'War Dashboard',
            'Real-time training metrics, reward curves, win rates, and model performance analysis',
            '#0069FF',
          )}
        </div>

        <!-- Architecture -->
        <div style="
          display:flex;gap:12px;justify-content:center;align-items:center;
          font-size:11px;color:#8B7D3C;margin-top:4px;
        ">
          <span style="padding:4px 10px;border:1px solid rgba(0,105,255,0.3);border-radius:3px;color:#4BA3FF;">
            GPU Droplets
          </span>
          <span style="color:#5A4A3A;">+</span>
          <span style="padding:4px 10px;border:1px solid rgba(0,105,255,0.3);border-radius:3px;color:#4BA3FF;">
            Agent Platform
          </span>
          <span style="color:#5A4A3A;">+</span>
          <span style="padding:4px 10px;border:1px solid rgba(0,105,255,0.3);border-radius:3px;color:#4BA3FF;">
            App Platform
          </span>
        </div>

        <div style="font-size:11px;color:#5A4A3A;letter-spacing:1px;">
          Powered by DigitalOcean Gradient
        </div>

        <!-- Start Button -->
        <button id="landing-start-btn" style="
          background:linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.05));
          border:2px solid #C9A84C;color:#C9A84C;
          padding:14px 48px;font-size:18px;font-family:serif;
          letter-spacing:4px;cursor:pointer;border-radius:4px;
          margin-top:8px;transition:all 0.2s;
        ">
          BEGIN CAMPAIGN
        </button>

        <!-- Keyboard hints -->
        <div style="font-size:11px;color:#5A4A3A;">
          <span style="border:1px solid #3A3A3A;padding:1px 6px;border-radius:2px;font-family:monospace;">T</span> Agent Chat
          &nbsp;&nbsp;
          <span style="border:1px solid #3A3A3A;padding:1px 6px;border-radius:2px;font-family:monospace;">F12</span> Codex
          &nbsp;&nbsp;
          <span style="border:1px solid #3A3A3A;padding:1px 6px;border-radius:2px;font-family:monospace;">F3</span> Perf
        </div>
      </div>
    `;

    const btn = this.overlay.querySelector('#landing-start-btn') as HTMLButtonElement;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'linear-gradient(135deg,rgba(201,168,76,0.35),rgba(201,168,76,0.1))';
      btn.style.borderColor = '#E0C060';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.05))';
      btn.style.borderColor = '#C9A84C';
    });
    btn.addEventListener('click', () => {
      this.hide();
      this.onStart?.();
    });
  }

  private featureCard(icon: string, title: string, desc: string, accentColor: string): string {
    return `
      <div style="
        background:rgba(28,20,16,0.92);border:1px solid ${accentColor}33;
        border-radius:6px;padding:20px 16px;text-align:center;
      ">
        <div style="
          font-size:28px;color:${accentColor};font-family:serif;
          margin-bottom:10px;
        ">${icon}</div>
        <div style="
          font-size:14px;color:#D4C4A0;margin-bottom:8px;
          font-weight:600;letter-spacing:1px;
        ">${title}</div>
        <div style="font-size:12px;color:#8B7D3C;line-height:1.5;">${desc}</div>
      </div>
    `;
  }
}
