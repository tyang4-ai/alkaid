import type {
  SaveFile, SaveSlotMeta, BattleSnapshot, SaveSystemRefs,
  CampaignSnapshot,
} from './SaveTypes';
import type { CampaignState } from '../campaign/CampaignTypes';
import { SaveValidator } from './SaveValidator';
import { migrate } from './MigrationChain';
import {
  SAVE_VERSION, SAVE_DB_NAME, SAVE_DB_VERSION, SAVE_STORE_NAME,
  SAVE_EMERGENCY_KEY, SAVE_QUICKSAVE_ID, CAMPAIGN_IRONMAN_SLOT_ID,
} from '../../constants';

export class SaveManager {
  private refs: SaveSystemRefs;
  private db: IDBDatabase | null = null;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private beforeUnloadHandler: (() => void) | null = null;

  constructor(refs: SaveSystemRefs) {
    this.refs = refs;
  }

  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SAVE_DB_NAME, SAVE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SAVE_STORE_NAME)) {
          db.createObjectStore(SAVE_STORE_NAME, { keyPath: 'meta.slotId' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  createBattleSnapshot(): BattleSnapshot {
    return {
      terrainSeed: this.refs.getTerrainSeed(),
      templateId: this.refs.getTemplateId(),
      gameState: this.refs.gameState.serialize(),
      units: this.refs.unitManager.serialize().units,
      nextUnitId: this.refs.unitManager.serialize().nextId,
      orders: this.refs.orderManager.serialize(),
      supply: this.refs.supplySystem.serialize(),
      surrender: this.refs.surrenderSystem.serialize(),
      command: this.refs.commandSystem.serialize(),
      weather: this.refs.weatherSystem.serialize(),
      timeOfDay: this.refs.timeOfDaySystem.serialize(),
      environment: this.refs.getEnvironmentState(),
      deployment: this.refs.deploymentManager.serialize(),
      retreat: this.refs.retreatSystem.serialize(),
      battleEventLogger: this.refs.battleEventLogger.serialize(),
      battleStartTick: this.refs.getBattleStartTick(),
      battleEnded: this.refs.getBattleEnded(),
    };
  }

  async saveBattle(slotId: string, name?: string): Promise<void> {
    if (!this.db) throw new Error('SaveManager: DB not initialized');

    const snapshot = this.createBattleSnapshot();
    const now = Date.now();

    // Compute troop counts
    let playerTroops = 0;
    let enemyTroops = 0;
    for (const u of snapshot.units) {
      if (u.team === 0) playerTroops += u.size;
      else enemyTroops += u.size;
    }

    const meta: SaveSlotMeta = {
      slotId,
      name: name ?? slotId,
      timestamp: now,
      tick: snapshot.gameState.tickNumber,
      templateId: snapshot.templateId,
      playerTroops,
      enemyTroops,
    };

    const saveFile: SaveFile = {
      version: SAVE_VERSION,
      timestamp: now,
      type: 'battle',
      meta,
      battle: snapshot,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SAVE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SAVE_STORE_NAME);
      store.put(saveFile);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async quickSave(): Promise<void> {
    return this.saveBattle(SAVE_QUICKSAVE_ID, 'Quick Save');
  }

  async autoSave(): Promise<void> {
    return this.saveBattle(SAVE_QUICKSAVE_ID, 'Auto Save');
  }

  async loadBattle(slotId: string): Promise<BattleSnapshot | null> {
    if (!this.db) throw new Error('SaveManager: DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SAVE_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVE_STORE_NAME);
      const request = store.get(slotId);
      request.onsuccess = () => {
        const result = request.result as SaveFile | undefined;
        if (!result) {
          resolve(null);
          return;
        }

        // Validate
        const validation = SaveValidator.validate(result);
        if (!validation.valid) {
          console.warn('SaveManager: Invalid save data', validation.errors);
          resolve(null);
          return;
        }

        // Migrate
        const migrated = migrate(result as unknown as Record<string, unknown>) as unknown as SaveFile;
        resolve(migrated.battle ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async listSaves(): Promise<SaveSlotMeta[]> {
    if (!this.db) throw new Error('SaveManager: DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SAVE_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVE_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const saves = (request.result as SaveFile[])
          .map(s => s.meta)
          .sort((a, b) => b.timestamp - a.timestamp);
        resolve(saves);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSave(slotId: string): Promise<void> {
    if (!this.db) throw new Error('SaveManager: DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SAVE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SAVE_STORE_NAME);
      store.delete(slotId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  saveEmergency(): void {
    try {
      const snapshot = this.createBattleSnapshot();
      // Lean snapshot: strip event logger history to save space
      snapshot.battleEventLogger.moraleHistory = [];
      snapshot.battleEventLogger.supplyHistory = [];
      snapshot.battleEventLogger.casualtyHistory = [];
      localStorage.setItem(SAVE_EMERGENCY_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('SaveManager: Emergency save failed', e);
    }
  }

  loadEmergency(): BattleSnapshot | null {
    try {
      const raw = localStorage.getItem(SAVE_EMERGENCY_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as BattleSnapshot;
      localStorage.removeItem(SAVE_EMERGENCY_KEY);
      return data;
    } catch {
      return null;
    }
  }

  async exportToJSON(slotId: string): Promise<string | null> {
    if (!this.db) throw new Error('SaveManager: DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SAVE_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVE_STORE_NAME);
      const request = store.get(slotId);
      request.onsuccess = () => {
        const result = request.result as SaveFile | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        resolve(JSON.stringify(result, null, 2));
      };
      request.onerror = () => reject(request.error);
    });
  }

  exportToFile(json: string, filename: string): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  importFromJSON(json: string): BattleSnapshot | null {
    try {
      const data = JSON.parse(json);
      const validation = SaveValidator.validate(data);
      if (!validation.valid) {
        console.warn('SaveManager: Import validation failed', validation.errors);
        return null;
      }
      const migrated = migrate(data) as unknown as SaveFile;
      return migrated.battle ?? null;
    } catch (e) {
      console.warn('SaveManager: Import parse failed', e);
      return null;
    }
  }

  async importAndSave(json: string, slotId: string, name: string): Promise<boolean> {
    try {
      const data = JSON.parse(json);
      const validation = SaveValidator.validate(data);
      if (!validation.valid) return false;
      const migrated = migrate(data) as unknown as SaveFile;
      migrated.meta.slotId = slotId;
      migrated.meta.name = name;
      migrated.meta.timestamp = Date.now();

      if (!this.db) return false;
      return new Promise((resolve, reject) => {
        const tx = this.db!.transaction(SAVE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(SAVE_STORE_NAME);
        store.put(migrated);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return false;
    }
  }

  // --- Campaign Save Methods ---

  async saveCampaign(state: CampaignState, activeBattle?: BattleSnapshot): Promise<void> {
    if (!this.db) throw new Error('SaveManager: DB not initialized');

    const now = Date.now();
    const slotId = CAMPAIGN_IRONMAN_SLOT_ID;

    const totalTroops = state.roster.squads.reduce((sum, s) => sum + s.size, 0);

    const meta: SaveSlotMeta = {
      slotId,
      name: `Campaign T${state.turn}`,
      timestamp: now,
      tick: 0,
      templateId: '',
      playerTroops: totalTroops,
      enemyTroops: 0,
    };

    const campaignSnapshot: CampaignSnapshot = {
      campaignState: state,
      activeBattle,
      wasLoaded: false,
    };

    const saveFile: SaveFile = {
      version: SAVE_VERSION,
      timestamp: now,
      type: 'campaign',
      meta,
      campaign: campaignSnapshot,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SAVE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SAVE_STORE_NAME);
      store.put(saveFile);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadCampaign(): Promise<CampaignSnapshot | null> {
    if (!this.db) throw new Error('SaveManager: DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SAVE_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVE_STORE_NAME);
      const request = store.get(CAMPAIGN_IRONMAN_SLOT_ID);
      request.onsuccess = () => {
        const result = request.result as SaveFile | undefined;
        if (!result || result.type !== 'campaign' || !result.campaign) {
          resolve(null);
          return;
        }

        const validation = SaveValidator.validate(result);
        if (!validation.valid) {
          console.warn('SaveManager: Invalid campaign save', validation.errors);
          resolve(null);
          return;
        }

        const migrated = migrate(result as unknown as Record<string, unknown>) as unknown as SaveFile;
        const snapshot = migrated.campaign!;

        // Ironman: mark as loaded — overwrite with wasLoaded=true
        snapshot.wasLoaded = true;
        const writeTx = this.db!.transaction(SAVE_STORE_NAME, 'readwrite');
        const writeStore = writeTx.objectStore(SAVE_STORE_NAME);
        migrated.campaign = snapshot;
        writeStore.put(migrated);

        resolve(snapshot);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCampaignSave(): Promise<void> {
    return this.deleteSave(CAMPAIGN_IRONMAN_SLOT_ID);
  }

  async hasCampaignSave(): Promise<boolean> {
    if (!this.db) throw new Error('SaveManager: DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SAVE_STORE_NAME, 'readonly');
      const store = tx.objectStore(SAVE_STORE_NAME);
      const request = store.get(CAMPAIGN_IRONMAN_SLOT_ID);
      request.onsuccess = () => {
        const result = request.result as SaveFile | undefined;
        resolve(!!result && result.type === 'campaign');
      };
      request.onerror = () => reject(request.error);
    });
  }

  restoreBattle(snapshot: BattleSnapshot): void {
    this.refs.gameState.deserialize(snapshot.gameState);
    this.refs.unitManager.deserialize({ units: snapshot.units, nextId: snapshot.nextUnitId });
    this.refs.orderManager.deserialize(snapshot.orders);
    this.refs.supplySystem.deserialize(snapshot.supply);
    this.refs.surrenderSystem.deserialize(snapshot.surrender);
    this.refs.commandSystem.deserialize(snapshot.command);
    this.refs.weatherSystem.deserialize(snapshot.weather);
    this.refs.timeOfDaySystem.deserialize(snapshot.timeOfDay);
    this.refs.deploymentManager.deserialize(snapshot.deployment);
    this.refs.retreatSystem.deserialize(snapshot.retreat);
    this.refs.battleEventLogger.deserialize(snapshot.battleEventLogger);
    this.refs.setEnvironmentState(snapshot.environment);
    this.refs.setBattleStartTick(snapshot.battleStartTick);
    this.refs.setBattleEnded(snapshot.battleEnded);
  }

  startAutoSave(intervalMs: number): void {
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(() => {
      this.autoSave().catch(e => console.warn('Auto-save failed', e));
    }, intervalMs);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  registerBeforeUnload(): void {
    this.beforeUnloadHandler = () => {
      this.saveEmergency();
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  unregisterBeforeUnload(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}
