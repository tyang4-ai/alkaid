import type { OrderType } from '../../constants';

/** Plain data interface for a messenger dot traveling from general to target squad. */
export interface Messenger {
  readonly id: number;
  fromX: number;
  fromY: number;
  targetUnitId: number;
  orderType: OrderType;
  targetX: number;       // current movement target (tracks unit position)
  targetY: number;
  orderTargetX: number;  // original order destination (for delivery)
  orderTargetY: number;
  currentX: number;
  currentY: number;
  speed: number;     // tiles/sec (computed at dispatch time)
  spawnTick: number;
  delivered: boolean;
  trail: Array<{ x: number; y: number; tick: number }>;
}
