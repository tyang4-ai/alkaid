import { eventBus } from './EventBus';
import {
  SAVE_SETTINGS_KEY, COLORBLIND_PALETTES,
  UI_SCALE_MIN, UI_SCALE_MAX,
} from '../constants';

export interface GameSettingsFull {
  colorblindMode: 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  uiScale: number;
  highContrast: boolean;
  hotkeyBindings: Record<string, string>;
  screenReaderHints: boolean;
}

const DEFAULT_HOTKEY_BINDINGS: Record<string, string> = {
  'attack': 'KeyA',
  'hold': 'KeyH',
  'retreat': 'KeyR',
  'flank': 'KeyF',
  'charge': 'KeyC',
  'formUp': 'KeyG',
  'disengage': 'KeyD',
  'rally': 'KeyY',
  'pause': 'Space',
  'codex': 'F12',
  'perfMonitor': 'F3',
  'centerGeneral': 'Home',
};

const DEFAULT_SETTINGS: GameSettingsFull = {
  colorblindMode: 'off',
  uiScale: 1.0,
  highContrast: false,
  hotkeyBindings: { ...DEFAULT_HOTKEY_BINDINGS },
  screenReaderHints: false,
};

export class SettingsManager {
  private settings: GameSettingsFull;

  constructor() {
    this.settings = this.load();
  }

  get<K extends keyof GameSettingsFull>(key: K): GameSettingsFull[K] {
    return this.settings[key];
  }

  set<K extends keyof GameSettingsFull>(key: K, value: GameSettingsFull[K]): void {
    this.settings[key] = value;
    this.save();
    eventBus.emit('settings:changed', { key, value });

    if (key === 'colorblindMode') {
      eventBus.emit('settings:colorblindChanged', { mode: value as string });
    }
    if (key === 'uiScale') {
      eventBus.emit('settings:uiScaleChanged', { scale: value as number });
    }
  }

  getTeamColors(): { player: number; enemy: number } {
    const mode = this.settings.colorblindMode;
    const palette = COLORBLIND_PALETTES[mode];
    return { player: palette.player, enemy: palette.enemy };
  }

  getHotkeyBinding(action: string): string {
    return this.settings.hotkeyBindings[action] ?? DEFAULT_HOTKEY_BINDINGS[action] ?? '';
  }

  setHotkeyBinding(action: string, keyCode: string): void {
    this.settings.hotkeyBindings[action] = keyCode;
    this.save();
    eventBus.emit('settings:changed', { key: 'hotkeyBindings', value: this.settings.hotkeyBindings });
  }

  getAllSettings(): GameSettingsFull {
    return { ...this.settings, hotkeyBindings: { ...this.settings.hotkeyBindings } };
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // localStorage may be unavailable
    }
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS, hotkeyBindings: { ...DEFAULT_HOTKEY_BINDINGS } };
    this.save();
    eventBus.emit('settings:changed', { key: 'all', value: this.settings });
    eventBus.emit('settings:colorblindChanged', { mode: this.settings.colorblindMode });
    eventBus.emit('settings:uiScaleChanged', { scale: this.settings.uiScale });
  }

  private load(): GameSettingsFull {
    try {
      const raw = localStorage.getItem(SAVE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          colorblindMode: parsed.colorblindMode ?? DEFAULT_SETTINGS.colorblindMode,
          uiScale: Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, parsed.uiScale ?? DEFAULT_SETTINGS.uiScale)),
          highContrast: parsed.highContrast ?? DEFAULT_SETTINGS.highContrast,
          hotkeyBindings: { ...DEFAULT_HOTKEY_BINDINGS, ...(parsed.hotkeyBindings ?? {}) },
          screenReaderHints: parsed.screenReaderHints ?? DEFAULT_SETTINGS.screenReaderHints,
        };
      }
    } catch {
      // Corrupt or missing data
    }
    return { ...DEFAULT_SETTINGS, hotkeyBindings: { ...DEFAULT_HOTKEY_BINDINGS } };
  }
}
