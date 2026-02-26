import { SIM_TICK_INTERVAL_MS, MAX_FRAME_DELTA_MS } from '../constants';
import { eventBus } from './EventBus';

export type SimTickCallback = (dt: number) => void;
export type RenderCallback = (alpha: number) => void;

export class GameLoop {
  private accumulator = 0;
  private lastTimestamp = 0;
  private rafId: number | null = null;
  private tickNumber = 0;

  private _running = false;
  private _paused = false;
  private _speedMultiplier = 1;

  private simTickCallbacks: SimTickCallback[] = [];
  private renderCallbacks: RenderCallback[] = [];

  // FPS tracking
  private frameCount = 0;
  private fpsAccumulator = 0;
  private _currentFPS = 0;

  get running(): boolean { return this._running; }
  get paused(): boolean { return this._paused; }
  get speedMultiplier(): number { return this._speedMultiplier; }
  get currentFPS(): number { return this._currentFPS; }
  get currentTick(): number { return this.tickNumber; }

  onSimTick(cb: SimTickCallback): void {
    this.simTickCallbacks.push(cb);
  }

  onRender(cb: RenderCallback): void {
    this.renderCallbacks.push(cb);
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
    eventBus.emit('game:started', undefined);
  }

  pause(): void {
    if (!this._running || this._paused) return;
    this._paused = true;
    eventBus.emit('game:paused', undefined);
  }

  resume(): void {
    if (!this._running || !this._paused) return;
    this._paused = false;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    eventBus.emit('game:resumed', undefined);
  }

  togglePause(): void {
    if (this._paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  setSpeed(multiplier: number): void {
    this._speedMultiplier = Math.max(0.25, Math.min(4, multiplier));
    eventBus.emit('speed:changed', { multiplier: this._speedMultiplier });
  }

  stop(): void {
    this._running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Core frame — arrow function to preserve `this` for rAF */
  private frame = (timestamp: number): void => {
    if (!this._running) return;
    this.rafId = requestAnimationFrame(this.frame);

    let frameDelta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    if (frameDelta > MAX_FRAME_DELTA_MS) frameDelta = MAX_FRAME_DELTA_MS;

    // FPS tracking (1-second rolling window)
    this.frameCount++;
    this.fpsAccumulator += frameDelta;
    if (this.fpsAccumulator >= 1000) {
      this._currentFPS = Math.round(
        (this.frameCount * 1000) / this.fpsAccumulator
      );
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }

    // Accumulate simulation time (speed-scaled, paused = 0)
    this.accumulator += this._paused ? 0 : frameDelta * this._speedMultiplier;

    // Run fixed simulation ticks
    const tickDt = SIM_TICK_INTERVAL_MS;
    while (this.accumulator >= tickDt) {
      this.tickNumber++;
      for (const cb of this.simTickCallbacks) cb(tickDt);
      eventBus.emit('game:tick', {
        tickNumber: this.tickNumber,
        dt: tickDt,
      });
      this.accumulator -= tickDt;
    }

    // Alpha = interpolation fraction between last tick and next
    const alpha = this.accumulator / tickDt;
    for (const cb of this.renderCallbacks) cb(alpha);
    eventBus.emit('render:frame', { alpha, fps: this._currentFPS });
  };
}
