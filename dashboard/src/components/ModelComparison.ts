/**
 * Model comparison table — winrate vs each bot type.
 */

import type { TrainingMetrics } from '../DashboardApp';

const BOT_TYPES = [
  'Passive Bot',
  'Aggressive Bot',
  'Defensive Bot',
  'Flanker Bot',
  'Mixed Bot',
];

export class ModelComparison {
  readonly element: HTMLDivElement;
  private tbody: HTMLTableSectionElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      background: rgba(28, 20, 16, 0.92); border: 1px solid #8B7D3C;
      border-radius: 6px; padding: 20px; display: flex; flex-direction: column;
    `;

    const title = document.createElement('div');
    title.textContent = 'Model vs Bots';
    title.style.cssText = 'font-size: 16px; color: #C9A84C; font-family: serif; letter-spacing: 2px; margin-bottom: 16px;';
    this.element.appendChild(title);

    const table = document.createElement('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px;';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th style="text-align: left; padding: 8px; border-bottom: 1px solid #8B7D3C; color: #8B7D3C;">Opponent</th>
      <th style="text-align: right; padding: 8px; border-bottom: 1px solid #8B7D3C; color: #8B7D3C;">Win Rate</th>
      <th style="text-align: right; padding: 8px; border-bottom: 1px solid #8B7D3C; color: #8B7D3C;">Games</th>
    </tr>`;
    table.appendChild(thead);

    this.tbody = document.createElement('tbody');
    for (const bot of BOT_TYPES) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid rgba(139,125,60,0.2); color: #D4C4A0;">${bot}</td>
        <td style="padding: 8px; border-bottom: 1px solid rgba(139,125,60,0.2); color: #C9A84C; text-align: right;">--</td>
        <td style="padding: 8px; border-bottom: 1px solid rgba(139,125,60,0.2); color: #8B7D3C; text-align: right;">0</td>
      `;
      this.tbody.appendChild(tr);
    }
    table.appendChild(this.tbody);
    this.element.appendChild(table);

    // Overall summary
    const summary = document.createElement('div');
    summary.style.cssText = `
      margin-top: 16px; padding: 12px;
      background: rgba(201, 168, 76, 0.08); border: 1px solid rgba(139, 125, 60, 0.3);
      border-radius: 4px; font-size: 11px; color: #8B7D3C; text-align: center;
    `;
    summary.textContent = 'Benchmark data will appear after evaluation runs complete.';
    summary.className = 'model-summary';
    this.element.appendChild(summary);
  }

  update(metrics: TrainingMetrics): void {
    // Simulated distribution based on overall winrate for demo
    const baseWr = metrics.winrate;
    const rows = this.tbody.querySelectorAll('tr');
    const offsets = [-0.15, -0.05, 0.0, 0.05, 0.1];

    rows.forEach((row, i) => {
      const cells = row.querySelectorAll('td');
      const wr = Math.max(0, Math.min(1, baseWr + (offsets[i] ?? 0)));
      const games = Math.floor(metrics.episode / 5);
      cells[1].textContent = `${(wr * 100).toFixed(1)}%`;
      cells[1].style.color = wr >= 0.5 ? '#4CAF50' : '#FF6B6B';
      cells[2].textContent = String(games);
    });

    const summary = this.element.querySelector('.model-summary') as HTMLDivElement;
    if (summary) {
      summary.textContent = `Overall: ${(baseWr * 100).toFixed(1)}% win rate across ${metrics.episode} episodes`;
    }
  }
}
