export interface GameStateData {
  tickNumber: number;
  paused: boolean;
  speedMultiplier: number;
  battleTimeTicks: number;
}

export class GameState {
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
}
