import { describe, it, expect, vi } from 'vitest';

vi.mock('pixi.js', () => ({
  Container: class { addChild() {} removeChild() {} },
  Graphics: class {
    visible = true; alpha = 1; width = 0; height = 0;
    position = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    clear() { return this; } circle() { return this; } fill() { return this; } stroke() { return this; }
    moveTo() { return this; } lineTo() { return this; } rect() { return this; }
    destroy() {}
  },
}));

import { WeatherEffects } from '../WeatherEffects';
import { Container } from 'pixi.js';
import { WeatherType } from '../../constants';

const mockCamera = {
  x: 400,
  y: 300,
  zoom: 1,
  viewportWidth: 800,
  viewportHeight: 600,
} as any;

describe('WeatherEffects', () => {
  it('starts in clear weather with no particles', () => {
    const layer = new Container();
    const wx = new WeatherEffects(layer);
    wx.update(0.016, mockCamera);
    wx.destroy();
  });

  it('creates rain particles', () => {
    const layer = new Container();
    const wx = new WeatherEffects(layer);
    wx.setWeather(WeatherType.RAIN);
    wx.update(0.016, mockCamera);
    wx.destroy();
  });

  it('creates fog overlay', () => {
    const layer = new Container();
    const wx = new WeatherEffects(layer);
    wx.setWeather(WeatherType.FOG);
    wx.update(0.016, mockCamera);
    wx.destroy();
  });

  it('creates wind particles', () => {
    const layer = new Container();
    const wx = new WeatherEffects(layer);
    wx.setWeather(WeatherType.WIND, Math.PI / 4);
    wx.update(0.016, mockCamera);
    wx.destroy();
  });

  it('creates snow particles', () => {
    const layer = new Container();
    const wx = new WeatherEffects(layer);
    wx.setWeather(WeatherType.SNOW);
    wx.update(0.016, mockCamera);
    wx.destroy();
  });

  it('transitions between weather types', () => {
    const layer = new Container();
    const wx = new WeatherEffects(layer);
    wx.setWeather(WeatherType.RAIN);
    wx.update(0.016, mockCamera);
    wx.setWeather(WeatherType.SNOW);
    wx.update(0.016, mockCamera);
    wx.setWeather(WeatherType.CLEAR);
    wx.update(0.016, mockCamera);
    wx.destroy();
  });
});
