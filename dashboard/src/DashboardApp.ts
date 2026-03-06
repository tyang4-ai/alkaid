/**
 * Main dashboard application — composes all panels.
 */

import { HeaderPanel } from './components/HeaderPanel';
import { MetricsCards } from './components/MetricsCards';
import { TrainingCharts } from './components/TrainingCharts';
import { ModelComparison } from './components/ModelComparison';
import { AgentChat } from './components/AgentChat';

const API_BASE = 'http://localhost:8000';

export interface TrainingMetrics {
  episode: number;
  reward_mean: number;
  reward_std: number;
  winrate: number;
  curriculum_stage: number;
  loss_policy: number;
  loss_value: number;
  entropy: number;
  history: Array<{
    episode: number;
    reward: number;
    winrate: number;
    stage: number;
  }>;
}

export interface TrainingStatus {
  running: boolean;
  current_episode: number;
  total_episodes: number;
  gpu_hours: number;
  eta_hours: number;
  stage_name: string;
}

export class DashboardApp {
  private root: HTMLElement;
  private metricsCards!: MetricsCards;
  private charts!: TrainingCharts;
  private modelComparison!: ModelComparison;
  private pollInterval: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  init(): void {
    this.root.innerHTML = '';
    this.root.style.cssText = `
      max-width: 1400px; margin: 0 auto; padding: 24px;
      display: flex; flex-direction: column; gap: 24px;
    `;

    // Header
    const header = new HeaderPanel();
    this.root.appendChild(header.element);

    // Metrics cards row
    this.metricsCards = new MetricsCards();
    this.root.appendChild(this.metricsCards.element);

    // Main content: charts left, model comparison right
    const mainRow = document.createElement('div');
    mainRow.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr; gap: 24px;';

    this.charts = new TrainingCharts();
    mainRow.appendChild(this.charts.element);

    this.modelComparison = new ModelComparison();
    mainRow.appendChild(this.modelComparison.element);

    this.root.appendChild(mainRow);

    // Agent chat (full-width)
    const agentChat = new AgentChat(API_BASE);
    this.root.appendChild(agentChat.element);

    // Start polling
    this.fetchAndUpdate();
    this.pollInterval = window.setInterval(() => this.fetchAndUpdate(), 10000);
  }

  private async fetchAndUpdate(): Promise<void> {
    try {
      const [metricsRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/training/metrics`),
        fetch(`${API_BASE}/api/training/status`),
      ]);

      if (metricsRes.ok) {
        const metrics: TrainingMetrics = await metricsRes.json();
        this.metricsCards.update(metrics);
        this.charts.update(metrics);
        this.modelComparison.update(metrics);
      }

      if (statusRes.ok) {
        const status: TrainingStatus = await statusRes.json();
        this.metricsCards.updateStatus(status);
      }
    } catch {
      // Backend not available — silently continue with stale data
    }
  }

  destroy(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
    }
  }
}
