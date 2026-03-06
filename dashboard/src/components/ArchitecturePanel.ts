/**
 * Architecture diagram showing DigitalOcean Gradient services.
 */

export class ArchitecturePanel {
  readonly element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      background: rgba(28, 20, 16, 0.92); border: 1px solid #8B7D3C;
      border-radius: 6px; padding: 20px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Architecture';
    title.style.cssText = 'font-size: 16px; color: #C9A84C; font-family: serif; letter-spacing: 2px; margin-bottom: 16px;';
    this.element.appendChild(title);

    const diagram = document.createElement('div');
    diagram.style.cssText = 'display: flex; flex-direction: column; gap: 12px; font-size: 12px;';

    diagram.innerHTML = `
      <!-- Browser Layer -->
      <div style="
        border: 1px solid rgba(201,168,76,0.4); border-radius: 6px; padding: 14px;
        background: rgba(201,168,76,0.05);
      ">
        <div style="color: #C9A84C; font-weight: bold; margin-bottom: 8px;">Browser (Client)</div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${this.box('Alkaid Game', '#D4C4A0', 'PixiJS + TypeScript')}
          ${this.box('ONNX Worker', '#4CAF50', 'RL Model Inference')}
          ${this.box('Agent Chat', '#C9A84C', 'Sun Tzu Panel')}
          ${this.box('Dashboard', '#4BA3FF', 'Training Metrics')}
        </div>
      </div>

      <!-- Arrow -->
      <div style="text-align: center; color: #5A4A3A; font-size: 18px;">&#8595; API &#8595;</div>

      <!-- Backend Layer -->
      <div style="
        border: 1px solid rgba(0,105,255,0.3); border-radius: 6px; padding: 14px;
        background: rgba(0,105,255,0.03);
      ">
        <div style="color: #4BA3FF; font-weight: bold; margin-bottom: 8px;">
          DigitalOcean App Platform
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${this.box('FastAPI Backend', '#4BA3FF', 'Routes + Simulation')}
          ${this.box('Static Frontend', '#4BA3FF', 'Game + Dashboard')}
        </div>
      </div>

      <!-- Arrow -->
      <div style="text-align: center; color: #5A4A3A; font-size: 18px;">&#8595;</div>

      <!-- Gradient Layer -->
      <div style="
        border: 1px solid rgba(0,105,255,0.5); border-radius: 6px; padding: 14px;
        background: rgba(0,105,255,0.06);
      ">
        <div style="color: #0069FF; font-weight: bold; margin-bottom: 8px;">
          DigitalOcean Gradient AI Platform
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${this.box('GPU Droplet', '#0069FF', 'RTX 4000 — RL Training')}
          ${this.box('Agent Platform', '#0069FF', 'Sun Tzu RAG + Tools')}
          ${this.box('ONNX Model', '#0069FF', 'Exported to Browser')}
        </div>
      </div>
    `;

    this.element.appendChild(diagram);
  }

  private box(label: string, color: string, subtitle: string): string {
    return `
      <div style="
        border: 1px solid ${color}44; border-radius: 4px; padding: 8px 12px;
        background: ${color}0A; flex: 1; min-width: 120px;
      ">
        <div style="color: ${color}; font-weight: 600; font-size: 12px;">${label}</div>
        <div style="color: #8B7D3C; font-size: 10px; margin-top: 2px;">${subtitle}</div>
      </div>
    `;
  }
}
