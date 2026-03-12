// Alkaid (破军) — Audio Manager
// Singleton audio manager using Web Audio API with procedural sound generation.
// No external dependencies (no Howler.js).

import { eventBus } from '../core/EventBus';
import { AudioPlaceholders } from './AudioPlaceholders';
import { getOneShotMethod, getLoopingMethod } from './SoundMap';

export class AudioManager {
  private static instance: AudioManager | null = null;

  private masterVolume = 0.7;
  private sfxVolume = 0.8;
  private musicVolume = 0.5;
  private ambientVolume = 0.6;
  private muted = false;
  private initialized = false;

  private placeholders = new AudioPlaceholders();
  private activeSounds = new Map<string, { stop(): void }>();

  // Prevent duplicate rapid-fire sounds (debounce per sound ID)
  private lastPlayTime = new Map<string, number>();
  private static readonly MIN_PLAY_INTERVAL_MS = 80;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private constructor() {
    // Private — use getInstance()
  }

  /**
   * Initialize — call once on first user interaction (browser autoplay policy).
   * Resumes AudioContext if suspended and sets up EventBus listeners.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.placeholders.resume();
    this.setupEventListeners();
  }

  // --- Volume controls ---

  getMasterVolume(): number { return this.masterVolume; }
  getSfxVolume(): number { return this.sfxVolume; }
  getMusicVolume(): number { return this.musicVolume; }
  getAmbientVolume(): number { return this.ambientVolume; }
  isMuted(): boolean { return this.muted; }

  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
  }

  setAmbientVolume(vol: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      // Stop all active looping sounds immediately
      for (const [id, handle] of this.activeSounds) {
        handle.stop();
        this.activeSounds.delete(id);
      }
    }
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.muted) {
      for (const [id, handle] of this.activeSounds) {
        handle.stop();
        this.activeSounds.delete(id);
      }
    }
  }

  /**
   * Load volume settings from stored values.
   */
  loadSettings(settings: {
    masterVolume?: number;
    sfxVolume?: number;
    musicVolume?: number;
    ambientVolume?: number;
    muted?: boolean;
  }): void {
    if (settings.masterVolume !== undefined) this.masterVolume = settings.masterVolume;
    if (settings.sfxVolume !== undefined) this.sfxVolume = settings.sfxVolume;
    if (settings.musicVolume !== undefined) this.musicVolume = settings.musicVolume;
    if (settings.ambientVolume !== undefined) this.ambientVolume = settings.ambientVolume;
    if (settings.muted !== undefined) this.setMuted(settings.muted);
  }

  // --- Play sounds by category ---

  /**
   * Play a one-shot SFX. Debounces rapid duplicate plays.
   */
  playSfx(soundId: string): void {
    if (this.muted) return;
    const vol = this.masterVolume * this.sfxVolume;
    if (vol <= 0) return;

    // Debounce
    const now = performance.now();
    const last = this.lastPlayTime.get(soundId) ?? 0;
    if (now - last < AudioManager.MIN_PLAY_INTERVAL_MS) return;
    this.lastPlayTime.set(soundId, now);

    const method = getOneShotMethod(soundId);
    if (method) {
      this.placeholders[method](vol);
    }
  }

  /**
   * Play a looping music track. Stops any existing music first.
   */
  playMusic(soundId: string): void {
    if (this.muted) return;
    const vol = this.masterVolume * this.musicVolume;

    // Stop existing music
    this.stopSound('music');

    if (vol <= 0) return;

    const method = getLoopingMethod(soundId);
    if (method) {
      const handle = this.placeholders[method](vol);
      this.activeSounds.set('music', handle);
    }
  }

  /**
   * Play a looping ambient sound. Keyed by soundId so multiple ambients can coexist.
   */
  playAmbient(soundId: string): void {
    if (this.muted) return;
    const vol = this.masterVolume * this.ambientVolume;

    // Stop existing ambient of this type
    this.stopSound(`ambient:${soundId}`);

    if (vol <= 0) return;

    const method = getLoopingMethod(soundId);
    if (method) {
      const handle = this.placeholders[method](vol);
      this.activeSounds.set(`ambient:${soundId}`, handle);
    }
  }

  /**
   * Stop a specific active sound by key.
   */
  stopSound(key: string): void {
    const handle = this.activeSounds.get(key);
    if (handle) {
      handle.stop();
      this.activeSounds.delete(key);
    }
  }

  /**
   * Stop all active sounds.
   */
  stopAll(): void {
    for (const [, handle] of this.activeSounds) {
      handle.stop();
    }
    this.activeSounds.clear();
  }

  // --- EventBus integration ---

  private setupEventListeners(): void {
    // Combat sounds
    eventBus.on('combat:damage', () => this.playSfx('sword_clash'));
    eventBus.on('combat:chargeImpact', () => this.playSfx('cavalry_charge'));

    // Unit state sounds
    eventBus.on('unit:routed', () => this.playSfx('rout_horn'));
    eventBus.on('unit:rallied', () => this.playSfx('horn_signal'));

    // Orders
    eventBus.on('order:issued', () => this.playSfx('order_horn'));
    eventBus.on('command:messengerSent', () => this.playSfx('horn_signal'));

    // Battle flow
    eventBus.on('deployment:battleStarted', () => {
      this.playSfx('horn_signal');
      this.playMusic('battle_theme');
    });

    eventBus.on('battle:ended', () => {
      this.stopAll();
      this.playSfx('horn_signal');
    });

    eventBus.on('battle:surrender', () => {
      this.stopAll();
      this.playSfx('drum_beat');
    });

    // Weather -> ambient sounds
    eventBus.on('weather:changed', (data) => this.handleWeatherChange(data));

    // UI sounds
    eventBus.on('deployment:unitPlaced', () => this.playSfx('ui_click'));
    eventBus.on('group:assigned', () => this.playSfx('ui_click'));
  }

  /**
   * React to weather changes by switching ambient sounds.
   */
  private handleWeatherChange(data: { oldWeather: number; newWeather: number }): void {
    // Stop old weather ambients
    this.stopSound('ambient:rain');
    this.stopSound('ambient:wind');

    // Weather enum values from constants.ts:
    // 0=CLEAR, 1=RAIN, 2=FOG, 3=WIND, 4=STORM
    const w = data.newWeather;
    if (w === 1) {
      this.playAmbient('rain');
    } else if (w === 3) {
      this.playAmbient('wind');
    } else if (w === 4) {
      // Storm = rain + wind
      this.playAmbient('rain');
      this.playAmbient('wind');
    }
  }

  /**
   * Clean up everything.
   */
  destroy(): void {
    this.stopAll();
    this.placeholders.destroy();
    AudioManager.instance = null;
    this.initialized = false;
  }
}
