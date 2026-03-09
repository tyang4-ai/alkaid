import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../core/Camera';
import { WeatherType } from '../constants';

interface WeatherParticle {
  gfx: Graphics;
  x: number;
  y: number;
  speed: number;
  size: number;
}

export class WeatherEffects {
  private effectLayer: Container;
  private particles: WeatherParticle[] = [];
  private currentWeather: WeatherType = WeatherType.CLEAR;
  private fogOverlay: Graphics | null = null;
  private windDirection = 0;

  constructor(effectLayer: Container) {
    this.effectLayer = effectLayer;
  }

  setWeather(weatherType: WeatherType, windDirection = 0): void {
    this.currentWeather = weatherType;
    this.windDirection = windDirection;
    this.rebuildParticles();
  }

  private rebuildParticles(): void {
    // Clear existing
    for (const p of this.particles) {
      p.gfx.destroy();
    }
    this.particles = [];

    if (this.fogOverlay) {
      this.fogOverlay.destroy();
      this.fogOverlay = null;
    }

    switch (this.currentWeather) {
      case WeatherType.RAIN:
        this.createRainParticles(80);
        break;
      case WeatherType.FOG:
        this.createFogOverlay();
        break;
      case WeatherType.WIND:
        this.createWindParticles(25);
        break;
      case WeatherType.SNOW:
        this.createSnowParticles(40);
        break;
      case WeatherType.CLEAR:
      default:
        break;
    }
  }

  private createRainParticles(count: number): void {
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      g.moveTo(0, 0).lineTo(2, 8);
      g.stroke({ width: 1, color: 0x99BBDD, alpha: 0.4 });
      this.effectLayer.addChild(g);

      this.particles.push({
        gfx: g,
        x: Math.random() * 2000,
        y: Math.random() * 1500,
        speed: 250 + Math.random() * 100,
        size: 1,
      });
    }
  }

  private createFogOverlay(): void {
    this.fogOverlay = new Graphics();
    this.fogOverlay.rect(0, 0, 2000, 1500);
    this.fogOverlay.fill({ color: 0xDDDDDD, alpha: 0.15 });
    this.effectLayer.addChild(this.fogOverlay);
  }

  private createWindParticles(count: number): void {
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const len = 4 + Math.random() * 8;
      g.moveTo(0, 0).lineTo(len, 0);
      g.stroke({ width: 0.5, color: 0xCCCCCC, alpha: 0.3 });
      this.effectLayer.addChild(g);

      this.particles.push({
        gfx: g,
        x: Math.random() * 2000,
        y: Math.random() * 1500,
        speed: 80 + Math.random() * 60,
        size: len,
      });
    }
  }

  private createSnowParticles(count: number): void {
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const r = 1 + Math.random() * 2;
      g.circle(0, 0, r);
      g.fill({ color: 0xFFFFFF, alpha: 0.6 });
      this.effectLayer.addChild(g);

      this.particles.push({
        gfx: g,
        x: Math.random() * 2000,
        y: Math.random() * 1500,
        speed: 30 + Math.random() * 30,
        size: r,
      });
    }
  }

  update(dt: number, camera: Camera): void {
    // Derive viewport rect from Camera's public properties
    const vw = camera.viewportWidth / camera.zoom;
    const vh = camera.viewportHeight / camera.zoom;
    const vx = camera.x - vw / 2;
    const vy = camera.y - vh / 2;

    for (const p of this.particles) {
      switch (this.currentWeather) {
        case WeatherType.RAIN:
          p.x += 50 * dt; // slight diagonal
          p.y += p.speed * dt;
          break;
        case WeatherType.WIND: {
          const wx = Math.cos(this.windDirection) * p.speed;
          const wy = Math.sin(this.windDirection) * p.speed;
          p.x += wx * dt;
          p.y += wy * dt;
          break;
        }
        case WeatherType.SNOW:
          p.x += Math.sin(p.y * 0.01) * 10 * dt; // gentle sway
          p.y += p.speed * dt;
          break;
      }

      // Wrap around viewport
      if (p.x > vw) p.x -= vw;
      if (p.x < 0) p.x += vw;
      if (p.y > vh) p.y -= vh;
      if (p.y < 0) p.y += vh;

      // Position in world space relative to camera
      p.gfx.position.set(vx + p.x, vy + p.y);
    }

    // Fog alpha pulse
    if (this.fogOverlay && this.currentWeather === WeatherType.FOG) {
      const pulse = 0.12 + Math.sin(Date.now() * 0.001) * 0.05;
      this.fogOverlay.alpha = pulse;
      this.fogOverlay.position.set(vx, vy);
      this.fogOverlay.width = vw;
      this.fogOverlay.height = vh;
    }
  }

  destroy(): void {
    for (const p of this.particles) {
      p.gfx.destroy();
    }
    this.particles = [];
    if (this.fogOverlay) {
      this.fogOverlay.destroy();
      this.fogOverlay = null;
    }
  }
}
