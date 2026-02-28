import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../EventBus';
import { OrderType, SPEED_OPTIONS, UnitState } from '../../constants';

// Full window shim for keydown listener support
const windowListeners: Record<string, Function[]> = {};
if (!globalThis.window || !globalThis.window.addEventListener) {
  (globalThis as any).window = {
    addEventListener(event: string, handler: Function) {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(handler);
    },
    removeEventListener(event: string, handler: Function) {
      const list = windowListeners[event];
      if (list) {
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    },
    dispatchEvent(e: any) {
      const list = windowListeners[e.type];
      if (list) list.forEach(fn => fn(e));
      return true;
    },
  };
}

function createMockSelectionManager() {
  return {
    count: 0,
    selectedIds: new Set<number>(),
    select: vi.fn(),
    selectMultiple: vi.fn(),
    deselectAll: vi.fn(),
  };
}

function createMockUnitManager(units: any[] = []) {
  return {
    get(id: number) { return units.find((u: any) => u.id === id); },
    getByTeam(team: number) { return units.filter((u: any) => u.team === team); },
    getGeneral(team: number) { return units.find((u: any) => u.team === team && u.isGeneral); },
  };
}

function createMockCommandSystem() {
  return { issueOrder: vi.fn() };
}

function createMockCamera() {
  return { moveTo: vi.fn() };
}

function createMockGameState(overrides?: any) {
  return {
    getState: () => ({
      paused: false,
      speedMultiplier: 1.0,
      tickNumber: 100,
      ...overrides,
    }),
  };
}

function fireKey(code: string, opts?: { ctrlKey?: boolean; shiftKey?: boolean }) {
  const e = { type: 'keydown', code, ctrlKey: opts?.ctrlKey ?? false, shiftKey: opts?.shiftKey ?? false, preventDefault: vi.fn() };
  const list = windowListeners['keydown'];
  if (list) list.forEach(fn => fn(e));
}

describe('HotkeyManager', () => {
  let eventBus: EventBus;
  let selMgr: ReturnType<typeof createMockSelectionManager>;
  let unitMgr: ReturnType<typeof createMockUnitManager>;
  let cmdSys: ReturnType<typeof createMockCommandSystem>;
  let camera: ReturnType<typeof createMockCamera>;
  let gameState: ReturnType<typeof createMockGameState>;
  let hotkeys: any;

  beforeEach(async () => {
    // Clear all existing listeners
    for (const key of Object.keys(windowListeners)) {
      windowListeners[key] = [];
    }

    eventBus = new EventBus();
    selMgr = createMockSelectionManager();
    unitMgr = createMockUnitManager([
      { id: 1, team: 0, x: 100, y: 100, state: UnitState.IDLE, isGeneral: true, pendingOrderType: undefined },
      { id: 2, team: 0, x: 200, y: 200, state: UnitState.IDLE, pendingOrderType: undefined },
    ]);
    cmdSys = createMockCommandSystem();
    camera = createMockCamera();
    gameState = createMockGameState();

    const mod = await import('../HotkeyManager');
    hotkeys = new mod.HotkeyManager(eventBus, selMgr as any, unitMgr as any, {} as any, cmdSys as any, camera as any, gameState as any);
  });

  afterEach(() => {
    hotkeys?.destroy();
  });

  it('Space toggles pause', () => {
    hotkeys.setBattleActive(true);
    const spy = vi.fn();
    eventBus.on('game:paused', spy);
    fireKey('Space');
    expect(spy).toHaveBeenCalled();
  });

  it('Space resumes when paused', async () => {
    hotkeys.destroy();
    for (const key of Object.keys(windowListeners)) {
      windowListeners[key] = [];
    }
    const pausedState = createMockGameState({ paused: true });
    const mod = await import('../HotkeyManager');
    hotkeys = new mod.HotkeyManager(eventBus, selMgr as any, unitMgr as any, {} as any, cmdSys as any, camera as any, pausedState as any);
    hotkeys.setBattleActive(true);

    const spy = vi.fn();
    eventBus.on('game:resumed', spy);
    fireKey('Space');
    expect(spy).toHaveBeenCalled();
  });

  it('order hotkeys dispatch correct order type', () => {
    selMgr.count = 1;
    selMgr.selectedIds = new Set([1]);

    fireKey('KeyH'); // Hold
    expect(cmdSys.issueOrder).toHaveBeenCalled();
    const call = cmdSys.issueOrder.mock.calls[0];
    expect(call[0].type).toBe(OrderType.HOLD);
  });

  it('Ctrl+number assigns group', () => {
    selMgr.count = 2;
    selMgr.selectedIds = new Set([1, 2]);

    const spy = vi.fn();
    eventBus.on('group:assigned', spy);

    fireKey('Digit5', { ctrlKey: true });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ groupId: 5 }));
  });

  it('Tab cycles selection', () => {
    selMgr.count = 1;
    selMgr.selectedIds = new Set([1]);

    fireKey('Tab');
    expect(selMgr.select).toHaveBeenCalledWith(2); // Next unit
  });

  it('Escape deselects when units selected', () => {
    selMgr.count = 1;
    selMgr.selectedIds = new Set([1]);

    fireKey('Escape');
    expect(selMgr.deselectAll).toHaveBeenCalled();
  });

  it('Home centers on general', () => {
    fireKey('Home');
    expect(camera.moveTo).toHaveBeenCalledWith(100, 100);
  });

  it('speed keys work', () => {
    const spy = vi.fn();
    eventBus.on('speed:changed', spy);

    fireKey('Digit3');
    expect(spy).toHaveBeenCalledWith({ multiplier: SPEED_OPTIONS[2] }); // 2x
  });
});
