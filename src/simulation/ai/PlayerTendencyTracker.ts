import { EventBus } from '../../core/EventBus';
import {
  TENDENCY_FEATURE_COUNT, TENDENCY_HISTORY_MAX, TENDENCY_MAP_CENTER_FRAC,
  DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, TILE_SIZE,
  UnitCategory, UNIT_TYPE_CONFIGS, OrderType,
  type UnitType,
} from '../../constants';

// The tracker needs a way to look up unit types. It receives a callback for this.
export type UnitLookup = (unitId: number) => { type: number; team: number; x: number; y: number } | undefined;

export class PlayerTendencyTracker {
  private eventBus: EventBus;
  private unitLookup: UnitLookup;

  // Per-battle counters
  private flankCounts = [0, 0, 0]; // left, center, right
  private aggressionOrders = { aggressive: 0, passive: 0 };
  private cavalryCount = 0;
  private cavalryFlankCount = 0;
  private totalUnits = 0;
  private supplyRaidOrders = 0;
  private totalOrders = 0;
  private deploymentSums = { rangedX: 0, rangedY: 0, rangedN: 0, meleeX: 0, meleeY: 0, meleeN: 0, cavX: 0, cavY: 0, cavN: 0 };
  private firstAttackTick = -1;
  private currentTick = 0;
  private battleMaxTick = 6000; // approximate max ticks for normalization

  // History ring buffer
  private history: Float32Array[] = [];

  // Unsubscribe handlers
  private unsubscribers: (() => void)[] = [];

  constructor(eventBus: EventBus, unitLookup: UnitLookup) {
    this.eventBus = eventBus;
    this.unitLookup = unitLookup;
    this.subscribe();
  }

  private subscribe(): void {
    const onOrder = (payload: { unitId: number; type: number }) => {
      const unit = this.unitLookup(payload.unitId);
      if (!unit || unit.team !== 0) return; // Only track player (team 0)

      this.totalOrders++;
      const mapWidthPx = DEFAULT_MAP_WIDTH * TILE_SIZE;
      const mapCenterX = mapWidthPx / 2;
      const threshold = mapWidthPx * TENDENCY_MAP_CENTER_FRAC;

      // Flank tracking based on unit position
      if (unit.x < mapCenterX - threshold) this.flankCounts[0]++;
      else if (unit.x > mapCenterX + threshold) this.flankCounts[2]++;
      else this.flankCounts[1]++;

      // Aggression tracking
      if (payload.type === OrderType.ATTACK || payload.type === OrderType.CHARGE) {
        this.aggressionOrders.aggressive++;
        if (this.firstAttackTick < 0) this.firstAttackTick = this.currentTick;
      } else if (payload.type === OrderType.HOLD || payload.type === OrderType.RETREAT) {
        this.aggressionOrders.passive++;
      }

      // Cavalry flank usage
      const cfg = UNIT_TYPE_CONFIGS[unit.type as UnitType];
      if (cfg && cfg.category === UnitCategory.CAVALRY) {
        if (payload.type === OrderType.FLANK) {
          this.cavalryFlankCount++;
        }
      }

      // Supply raid tracking - flank orders targeting enemy side
      if (payload.type === OrderType.FLANK) {
        this.supplyRaidOrders++;
      }
    };

    const onDeployment = (payload: { rosterId: number; unitId: number; x: number; y: number }) => {
      const unit = this.unitLookup(payload.unitId);
      if (!unit || unit.team !== 0) return;

      const mapWidthPx = DEFAULT_MAP_WIDTH * TILE_SIZE;
      const mapHeightPx = DEFAULT_MAP_HEIGHT * TILE_SIZE;
      const nx = payload.x / mapWidthPx;
      const ny = payload.y / mapHeightPx;

      const cfg = UNIT_TYPE_CONFIGS[unit.type as UnitType];
      if (!cfg) return;

      this.totalUnits++;
      if (cfg.category === UnitCategory.CAVALRY) {
        this.cavalryCount++;
        this.deploymentSums.cavX += nx;
        this.deploymentSums.cavY += ny;
        this.deploymentSums.cavN++;
      } else if (cfg.category === UnitCategory.RANGED) {
        this.deploymentSums.rangedX += nx;
        this.deploymentSums.rangedY += ny;
        this.deploymentSums.rangedN++;
      } else {
        this.deploymentSums.meleeX += nx;
        this.deploymentSums.meleeY += ny;
        this.deploymentSums.meleeN++;
      }
    };

    const onTick = (payload: { tickNumber: number }) => {
      this.currentTick = payload.tickNumber;
    };

    this.eventBus.on('order:issued', onOrder);
    this.eventBus.on('deployment:unitPlaced', onDeployment);
    this.eventBus.on('game:tick', onTick);

    this.unsubscribers.push(
      () => this.eventBus.off('order:issued', onOrder),
      () => this.eventBus.off('deployment:unitPlaced', onDeployment),
      () => this.eventBus.off('game:tick', onTick),
    );
  }

  getFeatures(): Float32Array {
    const f = new Float32Array(TENDENCY_FEATURE_COUNT);

    // [0-2] flank distribution (normalized)
    const flankTotal = this.flankCounts[0] + this.flankCounts[1] + this.flankCounts[2];
    if (flankTotal > 0) {
      f[0] = this.flankCounts[0] / flankTotal;
      f[1] = this.flankCounts[1] / flankTotal;
      f[2] = this.flankCounts[2] / flankTotal;
    } else {
      f[0] = 0.33; f[1] = 0.34; f[2] = 0.33;
    }

    // [3] aggression
    const aggTotal = this.aggressionOrders.aggressive + this.aggressionOrders.passive;
    f[3] = aggTotal > 0 ? Math.min(1, this.aggressionOrders.aggressive / aggTotal) : 0.5;

    // [4] cavalry usage percentage
    f[4] = this.totalUnits > 0 ? this.cavalryCount / this.totalUnits : 0;

    // [5] cavalry flank vs direct
    f[5] = this.cavalryCount > 0 ? Math.min(1, this.cavalryFlankCount / Math.max(1, this.cavalryCount)) : 0;

    // [6] supply raid awareness
    f[6] = this.totalOrders > 0 ? Math.min(1, this.supplyRaidOrders / this.totalOrders) : 0;

    // [7-8] ranged deployment position
    f[7] = this.deploymentSums.rangedN > 0 ? this.deploymentSums.rangedX / this.deploymentSums.rangedN : 0.5;
    f[8] = this.deploymentSums.rangedN > 0 ? this.deploymentSums.rangedY / this.deploymentSums.rangedN : 0.5;

    // [9-10] melee deployment position
    f[9] = this.deploymentSums.meleeN > 0 ? this.deploymentSums.meleeX / this.deploymentSums.meleeN : 0.5;
    f[10] = this.deploymentSums.meleeN > 0 ? this.deploymentSums.meleeY / this.deploymentSums.meleeN : 0.5;

    // [11-12] cavalry deployment position
    f[11] = this.deploymentSums.cavN > 0 ? this.deploymentSums.cavX / this.deploymentSums.cavN : 0.5;
    f[12] = this.deploymentSums.cavN > 0 ? this.deploymentSums.cavY / this.deploymentSums.cavN : 0.5;

    // [13] aggressive timing
    f[13] = this.firstAttackTick >= 0 ? Math.min(1, this.firstAttackTick / this.battleMaxTick) : 1.0;

    return f;
  }

  recordBattleEnd(): void {
    const features = this.getFeatures();
    this.history.push(new Float32Array(features));
    if (this.history.length > TENDENCY_HISTORY_MAX) {
      this.history.shift();
    }
    this.eventBus.emit('tendency:updated', { features });
  }

  getHistory(): Float32Array[] {
    return [...this.history];
  }

  reset(): void {
    this.flankCounts = [0, 0, 0];
    this.aggressionOrders = { aggressive: 0, passive: 0 };
    this.cavalryCount = 0;
    this.cavalryFlankCount = 0;
    this.totalUnits = 0;
    this.supplyRaidOrders = 0;
    this.totalOrders = 0;
    this.deploymentSums = { rangedX: 0, rangedY: 0, rangedN: 0, meleeX: 0, meleeY: 0, meleeN: 0, cavX: 0, cavY: 0, cavN: 0 };
    this.firstAttackTick = -1;
  }

  serialize(): { history: number[][]; features: number[] } {
    return {
      history: this.history.map(h => Array.from(h)),
      features: Array.from(this.getFeatures()),
    };
  }

  deserialize(data: { history: number[][]; features: number[] }): void {
    this.history = data.history.map(h => new Float32Array(h));
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }
}
