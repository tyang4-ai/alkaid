/**
 * Training charts — reward curve and winrate over episodes.
 * Uses Canvas 2D for lightweight charting (no Chart.js dependency).
 */

import type { TrainingMetrics } from '../DashboardApp';

export class TrainingCharts {
  readonly element: HTMLDivElement;
  private rewardCanvas: HTMLCanvasElement;
  private winrateCanvas: HTMLCanvasElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      background: rgba(28, 20, 16, 0.92); border: 1px solid #8B7D3C;
      border-radius: 6px; padding: 20px; display: flex; flex-direction: column; gap: 20px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Training Progress';
    title.style.cssText = 'font-size: 16px; color: #C9A84C; font-family: serif; letter-spacing: 2px;';
    this.element.appendChild(title);

    // Reward chart
    const rewardLabel = document.createElement('div');
    rewardLabel.textContent = 'Reward (mean)';
    rewardLabel.style.cssText = 'font-size: 11px; color: #8B7D3C; text-transform: uppercase; letter-spacing: 1px;';
    this.element.appendChild(rewardLabel);

    this.rewardCanvas = document.createElement('canvas');
    this.rewardCanvas.width = 600;
    this.rewardCanvas.height = 200;
    this.rewardCanvas.style.cssText = 'width: 100%; height: 200px; border-radius: 4px;';
    this.element.appendChild(this.rewardCanvas);

    // Winrate chart
    const winLabel = document.createElement('div');
    winLabel.textContent = 'Win Rate (%)';
    winLabel.style.cssText = 'font-size: 11px; color: #8B7D3C; text-transform: uppercase; letter-spacing: 1px;';
    this.element.appendChild(winLabel);

    this.winrateCanvas = document.createElement('canvas');
    this.winrateCanvas.width = 600;
    this.winrateCanvas.height = 200;
    this.winrateCanvas.style.cssText = 'width: 100%; height: 200px; border-radius: 4px;';
    this.element.appendChild(this.winrateCanvas);
  }

  update(metrics: TrainingMetrics): void {
    const history = metrics.history ?? [];
    if (history.length === 0) return;

    this.drawChart(
      this.rewardCanvas,
      history.map(h => h.reward),
      '#C9A84C',
      history.map(h => h.episode),
    );

    this.drawChart(
      this.winrateCanvas,
      history.map(h => h.winrate * 100),
      '#4CAF50',
      history.map(h => h.episode),
      0, 100,
    );
  }

  private drawChart(
    canvas: HTMLCanvasElement,
    values: number[],
    color: string,
    xLabels: number[],
    forcedMin?: number,
    forcedMax?: number,
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize for DPR
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 10, right: 10, bottom: 25, left: 50 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Clear
    ctx.fillStyle = 'rgba(15, 12, 9, 0.8)';
    ctx.fillRect(0, 0, w, h);

    if (values.length < 2) return;

    const min = forcedMin ?? Math.min(...values);
    const max = forcedMax ?? Math.max(...values);
    const range = max - min || 1;

    // Grid lines
    ctx.strokeStyle = 'rgba(139, 125, 60, 0.2)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      // Y-axis label
      const val = max - (range * i) / 4;
      ctx.fillStyle = '#8B7D3C';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), pad.left - 6, y + 3);
    }

    // X-axis labels
    ctx.fillStyle = '#8B7D3C';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(values.length / 5));
    for (let i = 0; i < values.length; i += step) {
      const x = pad.left + (plotW * i) / (values.length - 1);
      ctx.fillText(String(xLabels[i] ?? i), x, h - 5);
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < values.length; i++) {
      const x = pad.left + (plotW * i) / (values.length - 1);
      const y = pad.top + plotH - ((values[i] - min) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill area under curve
    const lastX = pad.left + plotW;
    const baseline = pad.top + plotH;
    ctx.lineTo(lastX, baseline);
    ctx.lineTo(pad.left, baseline);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ', 0.1)').replace('rgb', 'rgba');
    ctx.fill();
  }
}
