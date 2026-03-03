import type { Serializable } from './persistence/Serializable';
import type { GameStateSnapshot } from './persistence/SaveTypes';

export interface GameStateData {
  tickNumber: number;
  paused: boolean;
  speedMultiplier: number;
  battleTimeTicks: number;
}

export class GameState implements Serializable<GameStateSnapshot> {
  private state: GameStateData = {
    tickNumber: 0,
    paused: false,
    speedMultiplier: 1,
    battleTimeTicks: 0,
  };

  getState(): Readonly<GameStateData> {
    return this.state;
  }

  tick(_dt: number): void {
    this.state.tickNumber++;
    this.state.battleTimeTicks++;
  }

  setPaused(paused: boolean): void {
    this.state.paused = paused;
  }

  setSpeedMultiplier(m: number): void {
    this.state.speedMultiplier = m;
  }

  reset(): void {
    this.state = {
      tickNumber: 0,
      paused: false,
      speedMultiplier: 1,
      battleTimeTicks: 0,
    };
  }

  serialize(): GameStateSnapshot {
    const s = this.state;
    return {
      tickNumber: s.tickNumber,
      paused: s.paused,
      speedMultiplier: s.speedMultiplier,
      battleTimeTicks: s.battleTimeTicks,
    };
  }

  deserialize(data: GameStateSnapshot): void {
    this.state.tickNumber = data.tickNumber;
    this.state.paused = data.paused;
    this.state.speedMultiplier = data.speedMultiplier;
    this.state.battleTimeTicks = data.battleTimeTicks;
  }
}
