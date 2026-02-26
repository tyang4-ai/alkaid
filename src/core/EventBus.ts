export interface GameEvents {
  'game:started': undefined;
  'game:paused': undefined;
  'game:resumed': undefined;
  'game:tick': { tickNumber: number; dt: number };
  'render:frame': { alpha: number; fps: number };
  'speed:changed': { multiplier: number };
  'terrain:generated': { seed: number; templateId: string };
  'camera:moved': { x: number; y: number; zoom: number };
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
