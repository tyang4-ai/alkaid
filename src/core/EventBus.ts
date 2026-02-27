export interface GameEvents {
  'game:started': undefined;
  'game:paused': undefined;
  'game:resumed': undefined;
  'game:tick': { tickNumber: number; dt: number };
  'render:frame': { alpha: number; fps: number };
  'speed:changed': { multiplier: number };
  'terrain:generated': { seed: number; templateId: string };
  'camera:moved': { x: number; y: number; zoom: number };
  'unit:spawned': { id: number; type: number; team: number };
  'unit:destroyed': { id: number };
  'units:cleared': undefined;
  'selection:changed': { ids: number[] };
  'input:click': { worldX: number; worldY: number; screenX: number; screenY: number; shift: boolean };
  'input:boxSelect': { x1: number; y1: number; x2: number; y2: number };
  'input:rightClick': { worldX: number; worldY: number; screenX: number; screenY: number };
  'order:issued': { unitId: number; type: number };
  'order:cleared': { unitId: number };
  'deployment:started': { rosterCount: number };
  'deployment:unitPlaced': { rosterId: number; unitId: number; x: number; y: number };
  'deployment:unitRemoved': { rosterId: number };
  'deployment:formationApplied': { formation: number };
  'deployment:countdownStarted': undefined;
  'deployment:countdownTick': { remaining: number };
  'deployment:battleStarted': undefined;
  'input:mouseDown': { screenX: number; screenY: number; worldX: number; worldY: number };
  'path:requested': { unitId: number };
  'path:found': { unitId: number; length: number };
  'path:notFound': { unitId: number };
  'input:rightDragStart': { worldX: number; worldY: number; screenX: number; screenY: number };
  'input:rightDragMove': { worldX: number; worldY: number; screenX: number; screenY: number };
  'input:rightDragEnd': { worldX: number; worldY: number; screenX: number; screenY: number };

  // Command system (Step 7)
  'command:messengerSent': { targetUnitId: number; orderType: number };
  'command:orderDelivered': { targetUnitId: number; orderType: number };
  'command:orderMisinterpreted': { targetUnitId: number; originalType: number; newType: number };

  // Combat system (Step 8)
  'combat:engaged': { attackerId: number; defenderId: number };
  'combat:damage': { attackerId: number; defenderId: number; damage: number; killed: number };
  'combat:unitDestroyed': { unitId: number; killedBy: number };
  'combat:chargeImpact': { unitId: number; targetId: number; damage: number };
  'unit:routed': { unitId: number; morale: number };
  'unit:rallied': { unitId: number };
  'unit:combined': { survivorId: number; absorbedId: number };
  'unit:split': { originalId: number; newId: number };
}

type EventKey = keyof GameEvents;
type EventCallback<K extends EventKey> = (payload: GameEvents[K]) => void;

interface Listener<K extends EventKey> {
  callback: EventCallback<K>;
  once: boolean;
}

export class EventBus {
  private listeners = new Map<EventKey, Listener<any>[]>();

  on<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push({ callback, once: false });
  }

  once<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push({ callback, once: true });
  }

  off<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.findIndex(l => l.callback === callback);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit<K extends EventKey>(event: K, payload: GameEvents[K]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].callback(payload);
      if (list[i].once) list.splice(i, 1);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
