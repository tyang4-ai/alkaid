import { PERF_UPDATE_INTERVAL_MS } from '../constants';

export class PerfMonitor {
  private container: HTMLDivElement;
  private _visible = false;
  private lastUpdateTime = 0;

  // Timing accumulators
  private frameStartTime = 0;
  private frameTimes: number[] = [];
  private tickStartTime = 0;
  private tickTimes: number[] = [];
  private pathTimes: number[] = [];
  private aiTimes: number[] = [];
  private activeUnits = 0;
  private totalUnits = 0;
  private frameCount = 0;
  private lastFpsTime = 0;
  private fps = 0;

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.75);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 8px 12px;
      border: 1px solid #333;
      z-index: 9999;
      pointer-events: none;
      white-space: pre;
      display: none;
      line-height: 1.4;
    `;
    parentElement.appendChild(this.container);
    this.lastFpsTime = performance.now();
  }

  toggle(): void {
    this._visible = !this._visible;
    this.container.style.display = this._visible ? 'block' : 'none';
  }

  get visible(): boolean {
    return this._visible;
  }

  recordFrameStart(): void {
    this.frameStartTime = performance.now();
    this.frameCount++;
  }

  recordFrameEnd(): void {
    const elapsed = performance.now() - this.frameStartTime;
    this.frameTimes.push(elapsed);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
  }

  recordTickStart(): void {
    this.tickStartTime = performance.now();
  }

  recordTickEnd(): void {
    const elapsed = performance.now() - this.tickStartTime;
    this.tickTimes.push(elapsed);
    if (this.tickTimes.length > 60) this.tickTimes.shift();
  }

  recordPathTime(ms: number): void {
    this.pathTimes.push(ms);
    if (this.pathTimes.length > 60) this.pathTimes.shift();
  }

  recordAITime(ms: number): void {
    this.aiTimes.push(ms);
    if (this.aiTimes.length > 60) this.aiTimes.shift();
  }

  setUnitCounts(active: number, total: number): void {
    this.activeUnits = active;
    this.totalUnits = total;
  }

  update(): void {
    if (!this._visible) return;

    const now = performance.now();

    // FPS calculation
    const fpsDelta = now - this.lastFpsTime;
    if (fpsDelta >= 1000) {
      this.fps = Math.round((this.frameCount / fpsDelta) * 1000);
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // Throttle DOM updates
    if (now - this.lastUpdateTime < PERF_UPDATE_INTERVAL_MS) return;
    this.lastUpdateTime = now;

    const avgFrame = this.average(this.frameTimes);
    const avgTick = this.average(this.tickTimes);
    const avgPath = this.average(this.pathTimes);
    const avgAI = this.average(this.aiTimes);

    // Memory (Chrome only)
    let memStr = 'N/A';
    const perf = performance as any;
    if (perf.memory) {
      const mb = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
      memStr = `${mb} MB`;
    }

    this.container.textContent =
      `--- Alkaid Debug ---\n` +
      `FPS: ${this.fps} | TPS: 20\n` +
      `Frame: ${avgFrame.toFixed(1)}ms | Tick: ${avgTick.toFixed(1)}ms\n` +
      `Path: ${avgPath.toFixed(1)}ms | AI: ${avgAI.toFixed(1)}ms\n` +
      `Units: ${this.activeUnits}/${this.totalUnits} active\n` +
      `Memory: ${memStr}`;
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    let sum = 0;
    for (const v of arr) sum += v;
    return sum / arr.length;
  }

  destroy(): void {
    this.container.remove();
  }
}
