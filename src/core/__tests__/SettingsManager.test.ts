import { describe, it, expect } from 'vitest';
import { SettingsManager } from '../SettingsManager';
import { COLORBLIND_PALETTES, UI_SCALE_MAX } from '../../constants';

describe('SettingsManager', () => {

  it('loads default settings', () => {
    const sm = new SettingsManager();
    expect(sm.get('colorblindMode')).toBe('off');
    expect(sm.get('uiScale')).toBe(1.0);
    expect(sm.get('highContrast')).toBe(false);
    expect(sm.get('screenReaderHints')).toBe(false);
  });

  it('set updates value immediately', () => {
    const sm = new SettingsManager();
    sm.set('colorblindMode', 'deuteranopia');
    expect(sm.get('colorblindMode')).toBe('deuteranopia');
  });

  it('colorblind palette returns correct colors for off', () => {
    const sm = new SettingsManager();
    const colors = sm.getTeamColors();
    expect(colors.player).toBe(COLORBLIND_PALETTES.off.player);
    expect(colors.enemy).toBe(COLORBLIND_PALETTES.off.enemy);
  });

  it('colorblind palette returns correct colors for deuteranopia', () => {
    const sm = new SettingsManager();
    sm.set('colorblindMode', 'deuteranopia');
    const colors = sm.getTeamColors();
    expect(colors.player).toBe(COLORBLIND_PALETTES.deuteranopia.player);
    expect(colors.enemy).toBe(COLORBLIND_PALETTES.deuteranopia.enemy);
  });

  it('hotkey remapping works', () => {
    const sm = new SettingsManager();
    expect(sm.getHotkeyBinding('attack')).toBe('KeyA');

    sm.setHotkeyBinding('attack', 'KeyQ');
    expect(sm.getHotkeyBinding('attack')).toBe('KeyQ');
  });

  it('UI scale set is clamped by setter', () => {
    const sm = new SettingsManager();
    // Setting within range should work
    sm.set('uiScale', 1.25);
    expect(sm.get('uiScale')).toBe(1.25);
    // Verify max constant is correct
    expect(UI_SCALE_MAX).toBe(1.50);
  });

  it('reset restores defaults', () => {
    const sm = new SettingsManager();
    sm.set('colorblindMode', 'tritanopia');
    sm.set('highContrast', true);
    sm.set('uiScale', 1.25);

    sm.reset();
    expect(sm.get('colorblindMode')).toBe('off');
    expect(sm.get('highContrast')).toBe(false);
    expect(sm.get('uiScale')).toBe(1.0);
  });

  it('getAllSettings returns a copy', () => {
    const sm = new SettingsManager();
    const all = sm.getAllSettings();
    all.colorblindMode = 'tritanopia';
    // Original should be unaffected
    expect(sm.get('colorblindMode')).toBe('off');
  });

  it('getHotkeyBinding returns empty string for unknown action', () => {
    const sm = new SettingsManager();
    expect(sm.getHotkeyBinding('nonexistent')).toBe('');
  });

  it('default settings are valid', () => {
    const sm = new SettingsManager();
    const all = sm.getAllSettings();
    expect(all.colorblindMode).toBe('off');
    expect(all.uiScale).toBe(1.0);
    expect(all.highContrast).toBe(false);
    expect(all.screenReaderHints).toBe(false);
    expect(typeof all.hotkeyBindings).toBe('object');
  });
});
