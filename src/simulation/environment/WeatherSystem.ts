import { SeededRandom } from '../../utils/Random';
import { eventBus } from '../../core/EventBus';
import type { EnvironmentState } from './EnvironmentState';
import type { Serializable } from '../persistence/Serializable';
import type { WeatherSnapshot } from '../persistence/SaveTypes';
import {
  WeatherType,
  WEATHER_PROBABILITIES,
  WEATHER_SHIFT_INTERVAL_TICKS,
  WEATHER_SHIFT_CHANCE,
} from '../../constants';

// Adjacent weather transitions (bidirectional): clear<->rain, clear<->fog, clear<->wind
// Snow never transitions
const ADJACENT_WEATHER: Record<number, number[]> = {
  [WeatherType.CLEAR]: [WeatherType.RAIN, WeatherType.FOG, WeatherType.WIND],
  [WeatherType.RAIN]: [WeatherType.CLEAR],
  [WeatherType.FOG]: [WeatherType.CLEAR],
  [WeatherType.WIND]: [WeatherType.CLEAR],
  [WeatherType.SNOW]: [], // snow never shifts
};

export class WeatherSystem implements Serializable<WeatherSnapshot> {
  private rng: SeededRandom;
  private currentWeather = 0;
  private lastShiftTick = 0;

  constructor(seed: number) {
    this.rng = new SeededRandom(seed);
  }

  getInitialWeather(): { weather: number; windDirection: number } {
    const roll = this.rng.next();
    let cumulative = 0;
    let weather: number = WeatherType.CLEAR;
    for (let i = 0; i < WEATHER_PROBABILITIES.length; i++) {
      cumulative += WEATHER_PROBABILITIES[i];
      if (roll < cumulative) {
        weather = i;
        break;
      }
    }
    this.currentWeather = weather;
    const windDirection = this.rng.nextInt(0, 7);
    return { weather, windDirection };
  }

  tick(env: EnvironmentState): void {
    if (env.currentTick - this.lastShiftTick < WEATHER_SHIFT_INTERVAL_TICKS) return;
    this.lastShiftTick = env.currentTick;

    const adjacent = ADJACENT_WEATHER[env.weather];
    if (!adjacent || adjacent.length === 0) return; // Snow never shifts

    if (this.rng.next() < WEATHER_SHIFT_CHANCE) {
      const oldWeather = env.weather;
      env.weather = adjacent[this.rng.nextInt(0, adjacent.length - 1)];
      this.currentWeather = env.weather;

      // If transitioning to wind, pick a new wind direction
      if (env.weather === WeatherType.WIND) {
        env.windDirection = this.rng.nextInt(0, 7);
      }

      eventBus.emit('weather:changed', {
        oldWeather,
        newWeather: env.weather,
        tick: env.currentTick,
      });
    }
  }

  serialize(): WeatherSnapshot {
    return {
      currentWeather: this.currentWeather,
      rngState: this.rng.getState(),
      ticksSinceLastShift: this.lastShiftTick,
    };
  }

  deserialize(data: WeatherSnapshot): void {
    this.currentWeather = data.currentWeather;
    this.rng.setState(data.rngState);
    this.lastShiftTick = data.ticksSinceLastShift;
  }

  static getWeatherName(type: number): string {
    const names = ['Clear', 'Rain', 'Fog', 'Wind', 'Snow'];
    return names[type] ?? 'Unknown';
  }

  static getWeatherNameChinese(type: number): string {
    const names = ['\u6674', '\u96E8', '\u96FE', '\u98CE', '\u96EA'];
    return names[type] ?? '?';
  }
}
