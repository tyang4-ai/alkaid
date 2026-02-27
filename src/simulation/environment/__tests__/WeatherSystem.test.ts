import { describe, it, expect, beforeEach } from 'vitest';
import { WeatherSystem } from '../WeatherSystem';
import type { EnvironmentState } from '../EnvironmentState';
import {
  WeatherType,
  WEATHER_SHIFT_INTERVAL_TICKS,
  WEATHER_PROBABILITIES,
} from '../../../constants';

function makeEnv(overrides?: Partial<EnvironmentState>): EnvironmentState {
  return {
    weather: WeatherType.CLEAR,
    windDirection: 0,
    timeOfDay: 0,
    currentTick: 0,
    battleStartTime: 0,
    ...overrides,
  };
}

describe('WeatherSystem', () => {
  let ws: WeatherSystem;

  beforeEach(() => {
    ws = new WeatherSystem(42);
  });

  it('should return a valid weather type from getInitialWeather', () => {
    const { weather, windDirection } = ws.getInitialWeather();
    expect(weather).toBeGreaterThanOrEqual(0);
    expect(weather).toBeLessThanOrEqual(4);
    expect(windDirection).toBeGreaterThanOrEqual(0);
    expect(windDirection).toBeLessThanOrEqual(7);
  });

  it('should be deterministic with the same seed', () => {
    const ws1 = new WeatherSystem(12345);
    const ws2 = new WeatherSystem(12345);
    expect(ws1.getInitialWeather()).toEqual(ws2.getInitialWeather());
  });

  it('should follow probability distribution (seed-deterministic)', () => {
    // Run many seeds and verify distribution is roughly correct
    const counts = [0, 0, 0, 0, 0];
    const trials = 1000;
    for (let seed = 0; seed < trials; seed++) {
      const w = new WeatherSystem(seed);
      const { weather } = w.getInitialWeather();
      counts[weather]++;
    }
    // Each should be within reasonable range of expected probability
    for (let i = 0; i < WEATHER_PROBABILITIES.length; i++) {
      const expected = WEATHER_PROBABILITIES[i] * trials;
      // Allow generous margin (20% of trials)
      expect(counts[i]).toBeGreaterThan(expected * 0.3);
      expect(counts[i]).toBeLessThan(expected * 2.5);
    }
  });

  it('should not shift weather before WEATHER_SHIFT_INTERVAL_TICKS', () => {
    const env = makeEnv({ weather: WeatherType.CLEAR });
    env.currentTick = WEATHER_SHIFT_INTERVAL_TICKS - 1;
    ws.tick(env);
    // Weather should remain CLEAR since interval hasn't elapsed
    expect(env.weather).toBe(WeatherType.CLEAR);
  });

  it('should only shift weather at WEATHER_SHIFT_INTERVAL_TICKS intervals', () => {
    const env = makeEnv({ weather: WeatherType.CLEAR });
    // First tick at 0 will be checked (lastShiftTick starts at 0)
    // Advance to the shift interval
    env.currentTick = WEATHER_SHIFT_INTERVAL_TICKS;
    // Run multiple tries with different seeds to confirm shift can happen
    let shifted = false;
    for (let seed = 0; seed < 100; seed++) {
      const w = new WeatherSystem(seed);
      w.getInitialWeather(); // consume initial RNG
      const e = makeEnv({ weather: WeatherType.CLEAR });
      e.currentTick = WEATHER_SHIFT_INTERVAL_TICKS;
      w.tick(e);
      if (e.weather !== WeatherType.CLEAR) {
        shifted = true;
        break;
      }
    }
    expect(shifted).toBe(true);
  });

  it('should only transition to adjacent weather types', () => {
    // Test transitions from CLEAR (can go to RAIN, FOG, WIND)
    const validFromClear = [WeatherType.CLEAR, WeatherType.RAIN, WeatherType.FOG, WeatherType.WIND];
    for (let seed = 0; seed < 200; seed++) {
      const w = new WeatherSystem(seed);
      w.getInitialWeather();
      const e = makeEnv({ weather: WeatherType.CLEAR });
      e.currentTick = WEATHER_SHIFT_INTERVAL_TICKS;
      w.tick(e);
      expect(validFromClear).toContain(e.weather);
    }
  });

  it('should never shift from snow', () => {
    for (let seed = 0; seed < 100; seed++) {
      const w = new WeatherSystem(seed);
      w.getInitialWeather();
      const e = makeEnv({ weather: WeatherType.SNOW });
      e.currentTick = WEATHER_SHIFT_INTERVAL_TICKS;
      w.tick(e);
      expect(e.weather).toBe(WeatherType.SNOW);
    }
  });

  it('should set wind direction when transitioning to WIND', () => {
    // Find a seed that transitions CLEAR -> WIND
    for (let seed = 0; seed < 500; seed++) {
      const w = new WeatherSystem(seed);
      w.getInitialWeather();
      const e = makeEnv({ weather: WeatherType.CLEAR, windDirection: -1 as number });
      e.currentTick = WEATHER_SHIFT_INTERVAL_TICKS;
      w.tick(e);
      if (e.weather === WeatherType.WIND) {
        expect(e.windDirection).toBeGreaterThanOrEqual(0);
        expect(e.windDirection).toBeLessThanOrEqual(7);
        return;
      }
    }
    // If we couldn't find a seed that transitions to WIND, that's still OK
    // (probabilistic test), but at least one should
    expect.unreachable('No seed transitioned to WIND within 500 tries');
  });

  it('should return correct English weather names', () => {
    expect(WeatherSystem.getWeatherName(WeatherType.CLEAR)).toBe('Clear');
    expect(WeatherSystem.getWeatherName(WeatherType.RAIN)).toBe('Rain');
    expect(WeatherSystem.getWeatherName(WeatherType.FOG)).toBe('Fog');
    expect(WeatherSystem.getWeatherName(WeatherType.WIND)).toBe('Wind');
    expect(WeatherSystem.getWeatherName(WeatherType.SNOW)).toBe('Snow');
    expect(WeatherSystem.getWeatherName(99)).toBe('Unknown');
  });

  it('should return correct Chinese weather names', () => {
    expect(WeatherSystem.getWeatherNameChinese(WeatherType.CLEAR)).toBe('\u6674');
    expect(WeatherSystem.getWeatherNameChinese(WeatherType.RAIN)).toBe('\u96E8');
    expect(WeatherSystem.getWeatherNameChinese(WeatherType.FOG)).toBe('\u96FE');
    expect(WeatherSystem.getWeatherNameChinese(WeatherType.WIND)).toBe('\u98CE');
    expect(WeatherSystem.getWeatherNameChinese(WeatherType.SNOW)).toBe('\u96EA');
    expect(WeatherSystem.getWeatherNameChinese(99)).toBe('?');
  });
});
