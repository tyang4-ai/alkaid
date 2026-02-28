import type { EventBus, GameEvents } from '../core/EventBus';
import type { UnitManager } from './units/UnitManager';
import type { SupplySystem } from './metrics/SupplySystem';
import { UnitState } from '../constants';

export interface BattleEvent {
  tick: number;
  message: string;
  category: 'combat' | 'morale' | 'supply' | 'weather' | 'surrender';
  worldX?: number;
  worldY?: number;
}

export interface BattleMetrics {
  startTick: number;
  endTick: number;
  events: BattleEvent[];
  moraleHistory: Map<number, number[]>;    // team → morale at each sample
  supplyHistory: Map<number, number[]>;    // team → supply% at each sample
  casualtyHistory: Map<number, number[]>;  // team → cumulative casualties at each sample
  sampleInterval: number; // ticks between samples
}

const WEATHER_NAMES: Record<number, string> = {
  0: 'Clear', 1: 'Rain', 2: 'Fog', 3: 'Wind', 4: 'Snow',
};

const TIME_NAMES: Record<number, string> = {
  0: 'Dawn', 1: 'Morning', 2: 'Midday', 3: 'Afternoon', 4: 'Dusk', 5: 'Night',
};

export class BattleEventLogger {
  private eventBus: EventBus;
  private events: BattleEvent[] = [];
  private moraleHistory: Map<number, number[]> = new Map();
  private supplyHistory: Map<number, number[]> = new Map();
  private casualtyHistory: Map<number, number[]> = new Map();
  private startTick = 0;
  private endTick = 0;
  private sampleInterval = 10;
  private currentTick = 0;
  private unsubscribers: Array<() => void> = [];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  startLogging(tick: number): void {
    this.startTick = tick;
    this.events = [];
    this.moraleHistory = new Map([[0, []], [1, []]]);
    this.supplyHistory = new Map([[0, []], [1, []]]);
    this.casualtyHistory = new Map([[0, []], [1, []]]);

    const sub = <K extends keyof GameEvents>(
      event: K,
      handler: (payload: GameEvents[K]) => void,
    ) => {
      this.eventBus.on(event, handler);
      this.unsubscribers.push(() => this.eventBus.off(event, handler));
    };

    sub('unit:routed', () => {
      this.logEvent('combat', `Squad routed`);
    });

    sub('combat:unitDestroyed', () => {
      this.logEvent('combat', `Unit destroyed`);
    });

    sub('supply:collapse', (payload) => {
      this.logEvent('supply', `Supply collapsed for team ${payload.team}`);
    });

    sub('morale:armyRoutCascade', ({ routPercent }) => {
      this.logEvent('morale', `Army morale cascade (${Math.round(routPercent)}%)`);
    });

    sub('weather:changed', ({ newWeather }) => {
      const name = WEATHER_NAMES[newWeather] ?? 'Unknown';
      this.logEvent('weather', `Weather changed to ${name}`);
    });

    sub('time:phaseChanged', ({ newPhase }) => {
      const name = TIME_NAMES[newPhase] ?? 'Unknown';
      this.logEvent('weather', `Time advanced to ${name}`);
    });

    sub('battle:surrender', (payload) => {
      this.logEvent('surrender', `Team ${payload.team} surrendered`);
    });

    sub('retreat:initiated', ({ team }) => {
      this.logEvent('combat', `Team ${team} retreating`);
    });
  }

  private logEvent(category: BattleEvent['category'], message: string, worldX?: number, worldY?: number): void {
    this.events.push({
      tick: this.currentTick,
      message,
      category,
      worldX,
      worldY,
    });

    this.eventBus.emit('battle:eventLogged', {
      tick: this.currentTick,
      message,
      category,
      worldX,
      worldY,
    });
  }

  sample(tick: number, unitManager: UnitManager, supplySystem: SupplySystem): void {
    this.currentTick = tick;
    if ((tick - this.startTick) % this.sampleInterval !== 0) return;

    for (const team of [0, 1]) {
      const units = unitManager.getByTeam(team);
      const alive = units.filter(u => u.state !== UnitState.DEAD);

      // Average morale
      let totalMorale = 0;
      for (const u of alive) totalMorale += u.morale;
      const avgMorale = alive.length > 0 ? totalMorale / alive.length : 0;
      this.moraleHistory.get(team)!.push(avgMorale);

      // Supply
      const foodPct = supplySystem.getFoodPercent(team);
      this.supplyHistory.get(team)!.push(foodPct);

      // Casualties
      let casualties = 0;
      for (const u of units) casualties += u.maxSize - u.size;
      this.casualtyHistory.get(team)!.push(casualties);
    }
  }

  stopLogging(tick: number): void {
    this.endTick = tick;
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  getMetrics(): BattleMetrics {
    return {
      startTick: this.startTick,
      endTick: this.endTick,
      events: [...this.events],
      moraleHistory: new Map(this.moraleHistory),
      supplyHistory: new Map(this.supplyHistory),
      casualtyHistory: new Map(this.casualtyHistory),
      sampleInterval: this.sampleInterval,
    };
  }
}
