import type { SaveManager } from '../simulation/persistence/SaveManager';
import type { SaveSlotMeta } from '../simulation/persistence/SaveTypes';
import type { EventBus } from '../core/EventBus';
import { SAVE_SOFT_LIMIT } from '../constants';

export class SaveLoadScreen {
  private overlay: HTMLDivElement;
  private listContainer: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private newSaveBtn: HTMLButtonElement;
  private warningEl: HTMLDivElement;
  private saveManager: SaveManager;
  private eventBus: EventBus;
  private mode: 'save' | 'load' = 'save';
  private onLoadSnapshot: ((slotId: string) => void) | null = null;
  private onClose: (() => void) | null = null;

  constructor(parentElement: HTMLElement, saveManager: SaveManager, eventBus: EventBus) {
    this.saveManager = saveManager;
    this.eventBus = eventBus;

    this.overlay = document.createElement('div');
    this.overlay.className = 'save-load-screen';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(10, 8, 6, 0.85); display: none; z-index: 600;
      justify-content: center; align-items: center; flex-direction: column;
      pointer-events: auto;
    `;
    this.overlay.classList.add('alkaid-overlay', 'alkaid-hidden');

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: rgba(28, 20, 16, 0.95); border: 2px solid #8B7D3C;
      border-radius: 6px; padding: 24px 32px; width: 500px; max-height: 80vh;
      display: flex; flex-direction: column;
    `;

    // Title
    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = `
      font-size: 24px; color: #D4C4A0; font-family: serif;
      margin-bottom: 16px; text-align: center; letter-spacing: 2px;
    `;
    panel.appendChild(this.titleEl);

    // Warning
    this.warningEl = document.createElement('div');
    this.warningEl.style.cssText = `
      color: #C97A50; font-size: 12px; font-family: serif;
      text-align: center; margin-bottom: 8px; display: none;
    `;
    panel.appendChild(this.warningEl);

    // Scrollable list
    this.listContainer = document.createElement('div');
    this.listContainer.style.cssText = `
      flex: 1; overflow-y: auto; max-height: 400px; margin-bottom: 16px;
    `;
    panel.appendChild(this.listContainer);

    // New Save button (save mode only)
    this.newSaveBtn = document.createElement('button');
    this.newSaveBtn.textContent = '+ New Save 新存檔';
    this.newSaveBtn.className = 'new-save-btn';
    this.styleButton(this.newSaveBtn);
    this.newSaveBtn.style.marginBottom = '8px';
    this.newSaveBtn.addEventListener('click', () => this.promptNewSave());
    panel.appendChild(this.newSaveBtn);

    // Bottom row: Export, Import, Back
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.className = 'export-btn';
    this.styleSmallButton(exportBtn);
    exportBtn.addEventListener('click', () => this.handleExport());
    bottomRow.appendChild(exportBtn);

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import';
    importBtn.className = 'import-btn';
    this.styleSmallButton(importBtn);
    importBtn.addEventListener('click', () => this.handleImport());
    bottomRow.appendChild(importBtn);

    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back 返回';
    backBtn.className = 'back-btn';
    this.styleSmallButton(backBtn);
    backBtn.style.background = 'rgba(60, 50, 40, 0.8)';
    backBtn.addEventListener('click', () => this.hide());
    bottomRow.appendChild(backBtn);

    panel.appendChild(bottomRow);
    this.overlay.appendChild(panel);
    parentElement.appendChild(this.overlay);
  }

  setCallbacks(onLoadSnapshot: (slotId: string) => void, onClose: () => void): void {
    this.onLoadSnapshot = onLoadSnapshot;
    this.onClose = onClose;
  }

  async show(mode: 'save' | 'load'): Promise<void> {
    this.mode = mode;
    this.titleEl.textContent = mode === 'save' ? '存檔 Save Game' : '讀檔 Load Game';
    this.newSaveBtn.style.display = mode === 'save' ? 'block' : 'none';
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => this.overlay.classList.remove('alkaid-hidden'));
    await this.refresh();
  }

  hide(): void {
    this.overlay.classList.add('alkaid-hidden');
    setTimeout(() => { this.overlay.style.display = 'none'; }, 200);
    this.onClose?.();
  }

  async refresh(): Promise<void> {
    const saves = await this.saveManager.listSaves();
    this.listContainer.innerHTML = '';

    // Show warning if near soft limit
    if (saves.length >= SAVE_SOFT_LIMIT) {
      this.warningEl.textContent = `${saves.length} saves — consider deleting old saves`;
      this.warningEl.style.display = 'block';
    } else {
      this.warningEl.style.display = 'none';
    }

    if (saves.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No saves found';
      empty.style.cssText = 'color: #8B7D3C; font-family: serif; text-align: center; padding: 24px;';
      this.listContainer.appendChild(empty);
      return;
    }

    for (const meta of saves) {
      this.listContainer.appendChild(this.createSlotRow(meta));
    }
  }

  private createSlotRow(meta: SaveSlotMeta): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'save-slot-row';
    row.style.cssText = `
      display: flex; align-items: center; padding: 10px 12px;
      border: 1px solid rgba(139, 125, 60, 0.3); border-radius: 4px;
      margin-bottom: 4px; cursor: pointer;
      transition: background 0.15s;
    `;
    row.addEventListener('mouseenter', () => {
      row.style.background = 'rgba(139, 125, 60, 0.15)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.background = 'transparent';
    });

    // Info column
    const info = document.createElement('div');
    info.style.cssText = 'flex: 1;';

    const name = document.createElement('div');
    name.textContent = meta.name;
    name.style.cssText = 'color: #D4C4A0; font-family: serif; font-size: 15px;';
    info.appendChild(name);

    const details = document.createElement('div');
    const date = new Date(meta.timestamp);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    details.textContent = `${dateStr} — Tick ${meta.tick} — ${meta.playerTroops} vs ${meta.enemyTroops}`;
    details.style.cssText = 'color: #8B7D3C; font-size: 12px; font-family: serif;';
    info.appendChild(details);

    row.appendChild(info);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.textContent = '\u2715';
    delBtn.className = 'delete-save-btn';
    delBtn.style.cssText = `
      background: none; border: none; color: #8B7D3C; cursor: pointer;
      font-size: 16px; padding: 4px 8px; opacity: 0.6;
    `;
    delBtn.addEventListener('mouseenter', () => { delBtn.style.opacity = '1'; delBtn.style.color = '#C97A50'; });
    delBtn.addEventListener('mouseleave', () => { delBtn.style.opacity = '0.6'; delBtn.style.color = '#8B7D3C'; });
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.saveManager.deleteSave(meta.slotId);
      await this.refresh();
    });
    row.appendChild(delBtn);

    // Click row to save/load
    row.addEventListener('click', async () => {
      if (this.mode === 'save') {
        await this.saveManager.saveBattle(meta.slotId, meta.name);
        this.eventBus.emit('save:completed', { type: 'manual', success: true });
        await this.refresh();
      } else {
        this.onLoadSnapshot?.(meta.slotId);
        this.hide();
      }
    });

    return row;
  }

  private async promptNewSave(): Promise<void> {
    const name = prompt('Save name:');
    if (!name) return;
    const slotId = `save-${Date.now()}`;
    await this.saveManager.saveBattle(slotId, name);
    this.eventBus.emit('save:completed', { type: 'manual', success: true });
    await this.refresh();
  }

  private async handleExport(): Promise<void> {
    const saves = await this.saveManager.listSaves();
    if (saves.length === 0) return;
    // Export most recent save
    const json = await this.saveManager.exportToJSON(saves[0].slotId);
    if (json) {
      this.saveManager.exportToFile(json, `alkaid-save-${saves[0].name}.json`);
    }
  }

  private handleImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const slotId = `import-${Date.now()}`;
      const success = await this.saveManager.importAndSave(text, slotId, file.name.replace('.json', ''));
      if (success) {
        this.eventBus.emit('save:completed', { type: 'manual', success: true });
        await this.refresh();
      } else {
        this.eventBus.emit('save:error', { message: 'Import failed: invalid save file' });
      }
    });
    input.click();
  }

  destroy(): void {
    this.overlay.remove();
  }

  private styleButton(btn: HTMLButtonElement): void {
    btn.style.cssText = `
      display: block; width: 100%; padding: 10px 20px;
      background: #8B2500; color: #D4C4A0; border: 1px solid #8B7D3C;
      border-radius: 4px; cursor: pointer; font-size: 15px; font-family: serif;
    `;
  }

  private styleSmallButton(btn: HTMLButtonElement): void {
    btn.style.cssText = `
      padding: 6px 14px;
      background: #8B2500; color: #D4C4A0; border: 1px solid #8B7D3C;
      border-radius: 4px; cursor: pointer; font-size: 13px; font-family: serif;
    `;
  }
}
