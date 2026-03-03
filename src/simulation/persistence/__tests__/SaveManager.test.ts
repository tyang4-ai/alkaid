import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SaveManager } from '../SaveManager';
import { GameState } from '../../GameState';
import { UnitManager } from '../../units/UnitManager';
import { OrderManager } from '../../OrderManager';
import { SupplySystem } from '../../metrics/SupplySystem';
import { SurrenderSystem } from '../../combat/SurrenderSystem';
import { CommandSystem } from '../../command/CommandSystem';
import { WeatherSystem } from '../../environment/WeatherSystem';
import { TimeOfDaySystem } from '../../environment/TimeOfDaySystem';
import { DeploymentManager } from '../../deployment/DeploymentManager';
import { RetreatSystem } from '../../RetreatSystem';
import { BattleEventLogger } from '../../BattleEventLogger';
import { EventBus } from '../../../core/EventBus';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { UnitType, DeploymentPhase } from '../../../constants';
import type { SaveSystemRefs, EnvironmentStateSnapshot } from '../SaveTypes';
import { SAVE_QUICKSAVE_ID } from '../../../constants';

// Mock localStorage for Node test environment
const localStore = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => localStore.get(key) ?? null,
  setItem: (key: string, value: string) => { localStore.set(key, value); },
  removeItem: (key: string) => { localStore.delete(key); },
  clear: () => { localStore.clear(); },
  get length() { return localStore.size; },
  key: (index: number) => [...localStore.keys()][index] ?? null,
} as Storage;

function createRefs(): SaveSystemRefs {
  const eventBus = new EventBus();
  const size = 10;
  const len = size * size;
  const grid = new TerrainGrid({
    width: size, height: size, seed: 42, templateId: 'test',
    elevation: new Float32Array(len),
    moisture: new Float32Array(len),
    terrain: new Uint8Array(len),
    riverFlow: new Int8Array(len).fill(-1),
    tileBitmask: new Uint8Array(len),
  });
  const gameState = new GameState();
  const unitManager = new UnitManager();
  const orderManager = new OrderManager();
  const supplySystem = new SupplySystem(grid);
  const surrenderSystem = new SurrenderSystem();
  const commandSystem = new CommandSystem();
  const weatherSystem = new WeatherSystem(42);
  const timeOfDaySystem = new TimeOfDaySystem();
  const deploymentManager = new DeploymentManager();
  const retreatSystem = new RetreatSystem();
  const battleEventLogger = new BattleEventLogger(eventBus);

  // Set up some state
  gameState.tick(0); gameState.tick(0); // tick=2
  unitManager.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
  unitManager.spawn({ type: UnitType.DAO_SWORDSMEN, team: 1, x: 300, y: 300 });
  supplySystem.initArmy(0);
  supplySystem.initArmy(1);
  deploymentManager.deserialize({ phase: DeploymentPhase.BATTLE, battleTicks: 50, reservesSpawned: true });

  let envState: EnvironmentStateSnapshot = { weather: 0, timeOfDay: 0, windDirection: 0, visibility: 1 };
  let battleStartTick = 0;
  let battleEnded = false;

  return {
    gameState,
    unitManager,
    orderManager,
    supplySystem,
    surrenderSystem,
    commandSystem,
    weatherSystem,
    timeOfDaySystem,
    deploymentManager,
    retreatSystem,
    battleEventLogger,
    getEnvironmentState: () => envState,
    setEnvironmentState: (s) => { envState = s; },
    getBattleStartTick: () => battleStartTick,
    setBattleStartTick: (t) => { battleStartTick = t; },
    getBattleEnded: () => battleEnded,
    setBattleEnded: (e) => { battleEnded = e; },
    getTerrainSeed: () => 42,
    getTemplateId: () => 'valley_clash',
  };
}

describe('SaveManager', () => {
  let sm: SaveManager;
  let refs: SaveSystemRefs;

  beforeEach(async () => {
    refs = createRefs();
    sm = new SaveManager(refs);
    await sm.initDB();
  });

  afterEach(() => {
    // Close the DB connection before deleting to avoid hanging
    (sm as unknown as { db: IDBDatabase | null }).db?.close();
    indexedDB.deleteDatabase('alkaid-saves');
    localStorage.clear();
  });

  it('createBattleSnapshot returns valid structure', () => {
    const snapshot = sm.createBattleSnapshot();
    expect(snapshot.terrainSeed).toBe(42);
    expect(snapshot.templateId).toBe('valley_clash');
    expect(snapshot.gameState.tickNumber).toBe(2);
    expect(snapshot.units).toHaveLength(2);
    expect(snapshot.deployment.phase).toBe(DeploymentPhase.BATTLE);
  });

  it('saveBattle + loadBattle round-trip via IndexedDB', async () => {
    await sm.saveBattle('test-slot', 'My Save');
    const loaded = await sm.loadBattle('test-slot');
    expect(loaded).toBeDefined();
    expect(loaded!.gameState.tickNumber).toBe(2);
    expect(loaded!.units).toHaveLength(2);
    expect(loaded!.terrainSeed).toBe(42);
  });

  it('quickSave saves to quicksave slot', async () => {
    await sm.quickSave();
    const loaded = await sm.loadBattle(SAVE_QUICKSAVE_ID);
    expect(loaded).toBeDefined();
    expect(loaded!.gameState.tickNumber).toBe(2);
  });

  it('listSaves returns sorted SaveSlotMeta', async () => {
    await sm.saveBattle('slot-a', 'First Save');
    // Small delay to ensure different timestamp
    await sm.saveBattle('slot-b', 'Second Save');

    const saves = await sm.listSaves();
    expect(saves.length).toBe(2);
    // Most recent first
    expect(saves[0].timestamp).toBeGreaterThanOrEqual(saves[1].timestamp);
  });

  it('deleteSave removes a slot', async () => {
    await sm.saveBattle('to-delete', 'Temp Save');
    let saves = await sm.listSaves();
    expect(saves.length).toBe(1);

    await sm.deleteSave('to-delete');
    saves = await sm.listSaves();
    expect(saves.length).toBe(0);
  });

  it('saveEmergency + loadEmergency round-trip via localStorage', () => {
    sm.saveEmergency();
    const loaded = sm.loadEmergency();
    expect(loaded).toBeDefined();
    expect(loaded!.gameState.tickNumber).toBe(2);
  });

  it('loadBattle returns null for non-existent slot', async () => {
    const loaded = await sm.loadBattle('nonexistent');
    expect(loaded).toBeNull();
  });

  it('exportToJSON produces valid JSON string', async () => {
    await sm.saveBattle('export-test', 'Export Save');
    const json = await sm.exportToJSON('export-test');
    expect(json).toBeDefined();
    const parsed = JSON.parse(json!);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.battle.gameState.tickNumber).toBe(2);
  });

  it('importFromJSON restores a save', async () => {
    await sm.saveBattle('orig', 'Original');
    const json = await sm.exportToJSON('orig');
    expect(json).toBeDefined();

    await sm.deleteSave('orig');
    const snapshot = sm.importFromJSON(json!);
    expect(snapshot).toBeDefined();
    expect(snapshot!.gameState.tickNumber).toBe(2);
  });

  it('restoreBattle round-trips full game state through save/restore', async () => {
    // Advance game state to create interesting state (cast to access tick())
    (refs.gameState as GameState).tick(0);
    (refs.gameState as GameState).tick(0); // tick=4
    refs.setBattleStartTick(1);
    refs.setEnvironmentState({ weather: 2, timeOfDay: 3, windDirection: 180, visibility: 0.5 });

    // Save the current state
    await sm.saveBattle('restore-test', 'Restore Test');

    // Create a fresh set of refs and a new SaveManager pointing at same DB
    const freshRefs = createRefs(); // tick=2, defaults
    const sm2 = new SaveManager(freshRefs);
    // Share the same DB handle
    (sm2 as unknown as { db: IDBDatabase | null }).db =
      (sm as unknown as { db: IDBDatabase | null }).db;

    // Load and restore
    const snapshot = await sm2.loadBattle('restore-test');
    expect(snapshot).toBeDefined();
    sm2.restoreBattle(snapshot!);

    // Verify all systems were restored
    expect(freshRefs.gameState.getState().tickNumber).toBe(4);
    expect(freshRefs.getBattleStartTick()).toBe(1);
    expect(freshRefs.getEnvironmentState().weather).toBe(2);
    expect(freshRefs.getEnvironmentState().visibility).toBe(0.5);
    expect([...(freshRefs.unitManager as UnitManager).getAll()]).toHaveLength(2);
    expect(freshRefs.deploymentManager.serialize().phase).toBe(DeploymentPhase.BATTLE);
  });
});
