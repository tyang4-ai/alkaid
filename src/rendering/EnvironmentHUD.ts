import type { EnvironmentState } from '../simulation/environment/EnvironmentState';
import { WeatherSystem } from '../simulation/environment/WeatherSystem';
import { TimeOfDaySystem } from '../simulation/environment/TimeOfDaySystem';
import { TIME_PHASE_DURATION_TICKS } from '../constants';

const WEATHER_ICONS: Record<number, string> = {
  0: '\u2600', 1: '\uD83C\uDF27', 2: '\uD83C\uDF2B', 3: '\uD83D\uDCA8', 4: '\u2744',
};

export class EnvironmentHUD {
  private container: HTMLDivElement;
  private lastWeather = -1;
  private lastTimeOfDay = -1;
  private lastTick = -1;

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'env-hud';
    this.container.style.cssText = `
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      min-width: 200px;
      background: rgba(28, 20, 16, 0.92);
      border: 1px solid #8B7D3C;
      color: #D4C4A0;
      font-family: monospace;
      font-size: 12px;
      padding: 8px 14px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: 100;
      text-align: center;
      user-select: none;
    `;
    parentElement.appendChild(this.container);
  }

  update(env: EnvironmentState | null): void {
    if (!env) {
      this.container.style.opacity = '0';
      return;
    }

    // Only re-render on change
    if (env.weather === this.lastWeather && env.timeOfDay === this.lastTimeOfDay && env.currentTick === this.lastTick) return;
    this.lastWeather = env.weather;
    this.lastTimeOfDay = env.timeOfDay;
    this.lastTick = env.currentTick;

    const icon = WEATHER_ICONS[env.weather] ?? '?';
    const wNameCN = WeatherSystem.getWeatherNameChinese(env.weather);
    const wNameEN = WeatherSystem.getWeatherName(env.weather);
    const tNameCN = TimeOfDaySystem.getTimeNameChinese(env.timeOfDay);
    const tNameEN = TimeOfDaySystem.getTimeName(env.timeOfDay);

    // Compute time progress bar
    const ticksInPhase = env.currentTick % TIME_PHASE_DURATION_TICKS;
    const progress = ticksInPhase / TIME_PHASE_DURATION_TICKS;
    const barWidth = 60;
    const filled = Math.round(progress * barWidth);

    let html = `<div style="font-size:14px;margin-bottom:4px">${icon} ${wNameCN} ${wNameEN}</div>`;
    html += `<div>${tNameCN} ${tNameEN}</div>`;
    html += `<div style="margin-top:4px;font-size:10px;color:#8B7D3C">`;
    html += `<span style="color:#C9A84C">${'\u2588'.repeat(Math.round(filled / 6))}</span>`;
    html += `<span style="color:#3A3020">${'\u2591'.repeat(Math.round((barWidth - filled) / 6))}</span>`;
    html += `</div>`;

    this.container.innerHTML = html;
    this.container.style.opacity = '1';
  }

  hide(): void {
    this.container.style.opacity = '0';
  }

  destroy(): void {
    this.container.remove();
  }
}
