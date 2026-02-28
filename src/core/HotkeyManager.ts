import type { EventBus } from './EventBus';
import type { SelectionManager } from '../simulation/SelectionManager';
import type { UnitManager } from '../simulation/units/UnitManager';
import type { OrderManager } from '../simulation/OrderManager';
import type { CommandSystem } from '../simulation/command/CommandSystem';
import type { Camera } from './Camera';
import type { GameState } from '../simulation/GameState';
import { OrderType, SPEED_OPTIONS, UnitState } from '../constants';

const ORDER_HOTKEYS: Record<string, OrderType> = {
  'KeyA': OrderType.ATTACK,
  'KeyH': OrderType.HOLD,
  'KeyR': OrderType.RETREAT,
  'KeyF': OrderType.FLANK,
  'KeyC': OrderType.CHARGE,
  'KeyG': OrderType.FORM_UP,
  'KeyD': OrderType.DISENGAGE,
  'KeyY': OrderType.RALLY,
};

export class HotkeyManager {
  private eventBus: EventBus;
  private selectionManager: SelectionManager;
  private unitManager: UnitManager;
  private commandSystem: CommandSystem;
  private camera: Camera;
  private gameState: GameState;

  private groups: Map<number, number[]> = new Map();
  private handleKeyDown: (e: KeyboardEvent) => void;
  private onEscapeAction: (() => void) | null = null;
  private onCodexToggle: (() => void) | null = null;
  private _battleActive = false;

  constructor(
    eventBus: EventBus,
    selectionManager: SelectionManager,
    unitManager: UnitManager,
    _orderManager: OrderManager,
    commandSystem: CommandSystem,
    camera: Camera,
    gameState: GameState,
  ) {
    this.eventBus = eventBus;
    this.selectionManager = selectionManager;
    this.unitManager = unitManager;
    this.commandSystem = commandSystem;
    this.camera = camera;
    this.gameState = gameState;

    this.handleKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  setEscapeAction(fn: () => void): void {
    this.onEscapeAction = fn;
  }

  setCodexToggle(fn: () => void): void {
    this.onCodexToggle = fn;
  }

  setBattleActive(active: boolean): void {
    this._battleActive = active;
  }

  private onKeyDown(e: KeyboardEvent): void {
    const state = this.gameState.getState();

    // Space: toggle pause (only during battle)
    if (e.code === 'Space') {
      if (!this._battleActive) return;
      e.preventDefault();
      if (state.paused) {
        this.eventBus.emit('game:resumed', undefined);
      } else {
        this.eventBus.emit('game:paused', undefined);
      }
      return;
    }

    // Escape: deselect or retreat confirmation
    if (e.code === 'Escape') {
      e.preventDefault();
      if (this.selectionManager.count > 0) {
        this.selectionManager.deselectAll();
      } else if (this.onEscapeAction) {
        this.onEscapeAction();
      }
      return;
    }

    // F12: toggle codex
    if (e.code === 'F12') {
      e.preventDefault();
      this.onCodexToggle?.();
      return;
    }

    // Home: center on general
    if (e.code === 'Home') {
      e.preventDefault();
      const general = this.unitManager.getGeneral(0);
      if (general && general.state !== UnitState.DEAD) {
        this.camera.moveTo(general.x, general.y);
      }
      return;
    }

    // Tab / Shift+Tab: cycle selection
    if (e.code === 'Tab') {
      e.preventDefault();
      this.cycleSelection(e.shiftKey);
      return;
    }

    // Number keys 1-4: speed control (always)
    const digitMatch = e.code.match(/^Digit([1-4])$/);
    if (digitMatch && !e.ctrlKey) {
      const idx = parseInt(digitMatch[1]) - 1;
      if (idx < SPEED_OPTIONS.length) {
        e.preventDefault();
        this.eventBus.emit('speed:changed', { multiplier: SPEED_OPTIONS[idx] });
        return;
      }
    }

    // Ctrl+1-9: assign group
    const groupDigitMatch = e.code.match(/^Digit([1-9])$/);
    if (groupDigitMatch && e.ctrlKey) {
      e.preventDefault();
      const groupId = parseInt(groupDigitMatch[1]);
      const unitIds = [...this.selectionManager.selectedIds];
      if (unitIds.length > 0) {
        this.groups.set(groupId, unitIds);
        this.eventBus.emit('group:assigned', { groupId, unitIds });
      }
      return;
    }

    // Double-tap 5-9: select group (1-4 used for speed, so 5-9 single tap selects group)
    if (groupDigitMatch && !e.ctrlKey) {
      const groupId = parseInt(groupDigitMatch[1]);
      if (groupId >= 5) {
        e.preventDefault();
        this.selectGroup(groupId);
        return;
      }
    }

    // Order hotkeys (only when units selected)
    if (this.selectionManager.count > 0 && ORDER_HOTKEYS[e.code] !== undefined) {
      e.preventDefault();
      const orderType = ORDER_HOTKEYS[e.code];
      for (const id of this.selectionManager.selectedIds) {
        const unit = this.unitManager.get(id);
        if (unit) {
          const order = { type: orderType, unitId: id, targetX: unit.x, targetY: unit.y };
          if (unit) unit.pendingOrderType = orderType;
          this.commandSystem.issueOrder(order, this.unitManager, state.paused);
        }
      }
      return;
    }
  }

  private selectGroup(groupId: number): void {
    const unitIds = this.groups.get(groupId);
    if (unitIds && unitIds.length > 0) {
      // Filter to still-alive units
      const alive = unitIds.filter(id => {
        const u = this.unitManager.get(id);
        return u && u.state !== UnitState.DEAD;
      });
      if (alive.length > 0) {
        this.selectionManager.selectMultiple(alive);
        this.eventBus.emit('group:selected', { groupId });
      }
    }
  }

  private cycleSelection(reverse: boolean): void {
    const playerUnits = this.unitManager.getByTeam(0)
      .filter(u => u.state !== UnitState.DEAD);
    if (playerUnits.length === 0) return;

    const currentId = this.selectionManager.count > 0
      ? [...this.selectionManager.selectedIds][0]
      : -1;

    let currentIdx = playerUnits.findIndex(u => u.id === currentId);
    if (reverse) {
      currentIdx = currentIdx <= 0 ? playerUnits.length - 1 : currentIdx - 1;
    } else {
      currentIdx = currentIdx >= playerUnits.length - 1 ? 0 : currentIdx + 1;
    }

    this.selectionManager.select(playerUnits[currentIdx].id);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
