export interface EnvironmentState {
  weather: number;        // WeatherType enum
  windDirection: number;  // 0-7 (8 cardinal/intercardinal directions), only relevant when weather === WIND
  timeOfDay: number;      // TimeOfDay enum
  currentTick: number;    // for time progression
  battleStartTime: number; // TimeOfDay at battle start
}
