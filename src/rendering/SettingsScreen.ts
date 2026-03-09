import type { SettingsManager } from '../core/SettingsManager';
import { UI_SCALE_MIN, UI_SCALE_MAX, UI_SCALE_STEP, DifficultyLevel, DIFFICULTY_NAMES } from '../constants';
import type { DifficultyLevel as DifficultyLevelType } from '../constants';

export class SettingsScreen {
  private overlay: HTMLDivElement;
  private settingsManager: SettingsManager;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private onClose: (() => void) | null = null;

  constructor(parentElement: HTMLElement, settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.85);
      display: none; z-index: 1000;
      overflow-y: auto;
    `;
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', 'Settings');

    parentElement.appendChild(this.overlay);
  }

  show(onClose?: () => void): void {
    this.onClose = onClose ?? null;
    this.renderContent();
    this.overlay.style.display = 'block';
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.cleanupRebind();
    this.onClose?.();
  }

  get visible(): boolean {
    return this.overlay.style.display !== 'none';
  }

  private renderContent(): void {
    const settings = this.settingsManager.getAllSettings();

    this.overlay.innerHTML = `
      <div style="
        max-width: 500px; margin: 40px auto; padding: 24px;
        background: rgba(28, 20, 16, 0.95);
        border: 2px solid #8B7D3C; border-radius: 4px;
        color: #D4C4A0; font-family: 'Noto Serif SC', serif;
      ">
        <h2 style="text-align: center; color: #C9A84C; margin: 0 0 20px 0; font-size: 20px;">
          設定 — Settings
        </h2>

        <!-- Display Section -->
        <h3 style="color: #C9A84C; font-size: 14px; margin: 16px 0 8px;">Display</h3>

        <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <label>Colorblind Mode:</label>
          <select id="settings-colorblind" style="
            background: #2A1F14; color: #D4C4A0; border: 1px solid #8B7D3C;
            padding: 4px 8px; font-size: 13px; border-radius: 2px;
          ">
            <option value="off" ${settings.colorblindMode === 'off' ? 'selected' : ''}>Off</option>
            <option value="deuteranopia" ${settings.colorblindMode === 'deuteranopia' ? 'selected' : ''}>Deuteranopia (Red-Green)</option>
            <option value="protanopia" ${settings.colorblindMode === 'protanopia' ? 'selected' : ''}>Protanopia (Red-Green)</option>
            <option value="tritanopia" ${settings.colorblindMode === 'tritanopia' ? 'selected' : ''}>Tritanopia (Blue-Yellow)</option>
          </select>
        </div>

        <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <label>UI Scale: <span id="settings-scale-val">${settings.uiScale.toFixed(2)}x</span></label>
          <input type="range" id="settings-ui-scale"
            min="${UI_SCALE_MIN}" max="${UI_SCALE_MAX}" step="${UI_SCALE_STEP}"
            value="${settings.uiScale}"
            style="width: 150px; accent-color: #C9A84C;"
          >
        </div>

        <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <label>High Contrast:</label>
          <input type="checkbox" id="settings-high-contrast" ${settings.highContrast ? 'checked' : ''}
            style="accent-color: #C9A84C; width: 18px; height: 18px;">
        </div>

        <!-- Difficulty Section -->
        <h3 style="color: #C9A84C; font-size: 14px; margin: 16px 0 8px;">Difficulty</h3>

        <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <label>AI Difficulty:</label>
          <select id="settings-difficulty" style="
            background: #2A1F14; color: #D4C4A0; border: 1px solid #8B7D3C;
            padding: 4px 8px; font-size: 13px; border-radius: 2px;
          ">
            ${Object.entries(DIFFICULTY_NAMES).map(([val, name]) =>
              `<option value="${val}" ${settings.difficulty === Number(val) ? 'selected' : ''}>${name}</option>`
            ).join('\n            ')}
          </select>
        </div>

        <!-- Accessibility Section -->
        <h3 style="color: #C9A84C; font-size: 14px; margin: 16px 0 8px;">Accessibility</h3>

        <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <label>Screen Reader Hints:</label>
          <input type="checkbox" id="settings-screen-reader" ${settings.screenReaderHints ? 'checked' : ''}
            style="accent-color: #C9A84C; width: 18px; height: 18px;">
        </div>

        <!-- Controls Section -->
        <h3 style="color: #C9A84C; font-size: 14px; margin: 16px 0 8px;">Controls</h3>
        <div id="settings-hotkeys" style="font-size: 12px;"></div>

        <!-- Buttons -->
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
          <button id="settings-reset" style="
            background: #8B2500; color: #D4C4A0; border: 1px solid #8B7D3C;
            padding: 8px 16px; cursor: pointer; font-size: 13px; border-radius: 2px;
          ">Reset to Defaults</button>
          <button id="settings-close" style="
            background: #2A1F14; color: #D4C4A0; border: 1px solid #8B7D3C;
            padding: 8px 16px; cursor: pointer; font-size: 13px; border-radius: 2px;
          ">Close</button>
        </div>
      </div>
    `;

    // Render hotkey table
    this.renderHotkeyTable(settings.hotkeyBindings);

    // Bind events
    this.overlay.querySelector('#settings-colorblind')!.addEventListener('change', (e) => {
      this.settingsManager.set('colorblindMode', (e.target as HTMLSelectElement).value as any);
    });

    this.overlay.querySelector('#settings-ui-scale')!.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.settingsManager.set('uiScale', val);
      this.overlay.querySelector('#settings-scale-val')!.textContent = `${val.toFixed(2)}x`;
    });

    this.overlay.querySelector('#settings-high-contrast')!.addEventListener('change', (e) => {
      this.settingsManager.set('highContrast', (e.target as HTMLInputElement).checked);
    });

    this.overlay.querySelector('#settings-difficulty')!.addEventListener('change', (e) => {
      this.settingsManager.set('difficulty', Number((e.target as HTMLSelectElement).value) as DifficultyLevelType);
    });

    this.overlay.querySelector('#settings-screen-reader')!.addEventListener('change', (e) => {
      this.settingsManager.set('screenReaderHints', (e.target as HTMLInputElement).checked);
    });

    this.overlay.querySelector('#settings-reset')!.addEventListener('click', () => {
      this.settingsManager.reset();
      this.renderContent(); // Re-render with defaults
    });

    this.overlay.querySelector('#settings-close')!.addEventListener('click', () => {
      this.hide();
    });
  }

  private renderHotkeyTable(bindings: Record<string, string>): void {
    const container = this.overlay.querySelector('#settings-hotkeys')!;
    const actionNames: Record<string, string> = {
      attack: 'Attack (攻击)', hold: 'Hold (驻守)', retreat: 'Retreat (撤退)',
      flank: 'Flank (侧击)', charge: 'Charge (冲锋)', formUp: 'Form Up (列阵)',
      disengage: 'Disengage (脱离)', rally: 'Rally (集结)', pause: 'Pause (暂停)',
      codex: 'Codex', perfMonitor: 'Perf Monitor', centerGeneral: 'Center on General',
    };

    let html = '<div style="display: grid; grid-template-columns: 1fr auto auto; gap: 4px 8px; align-items: center;">';
    for (const [action, label] of Object.entries(actionNames)) {
      const currentKey = bindings[action] ?? '';
      const displayKey = this.keyCodeToDisplay(currentKey);
      html += `
        <span>${label}</span>
        <span style="color: #C9A84C; font-family: monospace;">${displayKey}</span>
        <button class="rebind-btn" data-action="${action}" style="
          background: #2A1F14; color: #D4C4A0; border: 1px solid #8B7D3C;
          padding: 2px 8px; cursor: pointer; font-size: 11px; border-radius: 2px;
        ">Rebind</button>
      `;
    }
    html += '</div>';
    container.innerHTML = html;

    // Bind rebind buttons
    container.querySelectorAll('.rebind-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action!;
        this.startRebind(action, e.target as HTMLButtonElement);
      });
    });
  }

  private startRebind(action: string, button: HTMLButtonElement): void {
    this.cleanupRebind();
    button.textContent = 'Press key...';
    button.style.background = '#8B2500';

    this.keydownHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        // Cancel rebind
        this.cleanupRebind();
        this.renderContent();
        return;
      }
      this.settingsManager.setHotkeyBinding(action, e.code);
      this.cleanupRebind();
      this.renderContent();
    };
    window.addEventListener('keydown', this.keydownHandler, { capture: true });
  }

  private cleanupRebind(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, { capture: true });
      this.keydownHandler = null;
    }
  }

  private keyCodeToDisplay(code: string): string {
    if (!code) return '—';
    // Convert KeyboardEvent.code to readable label
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }

  destroy(): void {
    this.cleanupRebind();
    this.overlay.remove();
  }
}
