import type { ReplaySnapshot } from '../persistence/SaveTypes';
import type { ReplayOrder } from './ReplayTypes';

export class ReplayPlayer {
  private replay: ReplaySnapshot;
  private _currentTick = 0;
  private _replayMode = false;
  private frameIndex = 0;
  private _speed = 1;

  constructor(replay: ReplaySnapshot) {
    this.replay = replay;
    this._replayMode = true;
    this._currentTick = 0;
    this.frameIndex = 0;
  }

  isReplayMode(): boolean {
    return this._replayMode;
  }

  getCurrentTick(): number {
    return this._currentTick;
  }

  getTotalTicks(): number {
    return this.replay.totalTicks;
  }

  get speed(): number {
    return this._speed;
  }

  set speed(s: number) {
    this._speed = s;
  }

  /** Returns orders that should be issued at the given tick. */
  getOrdersForTick(tick: number): ReplayOrder[] {
    this._currentTick = tick;
    const orders: ReplayOrder[] = [];

    // Advance frame index to match current tick
    while (this.frameIndex < this.replay.frames.length) {
      const frame = this.replay.frames[this.frameIndex];
      if (frame.tick < tick) {
        this.frameIndex++;
        continue;
      }
      if (frame.tick === tick) {
        for (const o of frame.orders) {
          orders.push({
            unitId: o.unitId,
            orderType: o.orderType as any,
            targetX: o.targetX,
            targetY: o.targetY,
            targetUnitId: o.targetUnitId,
            team: o.team,
          });
        }
        this.frameIndex++;
        break;
      }
      break; // frame.tick > tick — no orders this tick
    }

    return orders;
  }

  /** Re-position to a specific tick (for scrubbing). Resets frame index. */
  scrubTo(tick: number): void {
    this._currentTick = tick;
    // Reset frame index to find the right position
    this.frameIndex = 0;
    while (this.frameIndex < this.replay.frames.length &&
           this.replay.frames[this.frameIndex].tick < tick) {
      this.frameIndex++;
    }
  }

  /** Get all orders up to a given tick (for re-simulation during scrub). */
  getAllOrdersUpTo(tick: number): Array<{ tick: number; orders: ReplayOrder[] }> {
    const result: Array<{ tick: number; orders: ReplayOrder[] }> = [];
    for (const frame of this.replay.frames) {
      if (frame.tick > tick) break;
      result.push({
        tick: frame.tick,
        orders: frame.orders.map(o => ({
          unitId: o.unitId,
          orderType: o.orderType as any,
          targetX: o.targetX,
          targetY: o.targetY,
          targetUnitId: o.targetUnitId,
          team: o.team,
        })),
      });
    }
    return result;
  }

  get replayData(): ReplaySnapshot {
    return this.replay;
  }

  stop(): void {
    this._replayMode = false;
  }
}
