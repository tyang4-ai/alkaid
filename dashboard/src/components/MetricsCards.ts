/**
 * Metrics summary cards — episode, reward, winrate, stage, GPU hours.
 */

import type { TrainingMetrics, TrainingStatus } from '../DashboardApp';

interface CardDef {
  id: string;
  label: string;
  format: (metrics: TrainingMetrics) => string;
}

const CARDS: CardDef[] = [
  { id: 'episode', label: 'Episode', format: m => m.episode.toLocaleString() },
  { id: 'reward', label: 'Mean Reward', format: m => m.reward_mean.toFixed(1) },
  { id: 'winrate', label: 'Win Rate', format: m => `${(m.winrate * 100).toFixed(1)}%` },
  { id: 'stage', label: 'Curriculum Stage', format: m => `Stage ${m.curriculum_stage}` },
  { id: 'entropy', label: 'Entropy', format: m => m.entropy.toFixed(3) },
];

export class MetricsCards {
  readonly element: HTMLDivElement;
  private cardEls: Map<string, HTMLDivElement> = new Map();
  private statusEl: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const row = document.createElement('div');
    row.style.cssText = 'display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px;';

    for (const card of CARDS) {
      const el = this.createCard(card.label, '--');
      this.cardEls.set(card.id, el);
      row.appendChild(el);
    }

    this.element.appendChild(row);

    // Status bar
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = `
      padding: 8px 16px; background: rgba(28, 20, 16, 0.7);
      border: 1px solid rgba(139, 125, 60, 0.3); border-radius: 4px;
      font-size: 12px; color: #8B7D3C; text-align: center;
    `;
    this.statusEl.textContent = 'Connecting to training server...';
    this.element.appendChild(this.statusEl);
  }

  private createCard(label: string, value: string): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(28, 20, 16, 0.92); border: 1px solid #8B7D3C;
      border-radius: 6px; padding: 16px; text-align: center;
    `;

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; color: #8B7D3C; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;';
    card.appendChild(labelEl);

    const valueEl = document.createElement('div');
    valueEl.textContent = value;
    valueEl.style.cssText = 'font-size: 22px; color: #C9A84C; font-family: monospace; font-weight: bold;';
    valueEl.className = 'card-value';
    card.appendChild(valueEl);

    return card;
  }

  update(metrics: TrainingMetrics): void {
    for (const card of CARDS) {
      const el = this.cardEls.get(card.id);
      if (el) {
        const valueEl = el.querySelector('.card-value') as HTMLDivElement;
        if (valueEl) valueEl.textContent = card.format(metrics);
      }
    }
  }

  updateStatus(status: TrainingStatus): void {
    if (status.running) {
      const pct = status.total_episodes > 0
        ? ((status.current_episode / status.total_episodes) * 100).toFixed(1)
        : '0';
      this.statusEl.textContent =
        `Training: ${status.stage_name} | ${pct}% complete | `
        + `GPU: ${status.gpu_hours.toFixed(1)}h | ETA: ${status.eta_hours.toFixed(1)}h`;
      this.statusEl.style.color = '#4CAF50';
    } else {
      this.statusEl.textContent = `Training idle | GPU: ${status.gpu_hours.toFixed(1)}h used`;
      this.statusEl.style.color = '#8B7D3C';
    }
  }
}
