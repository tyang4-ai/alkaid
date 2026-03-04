import type { OrderType } from '../../constants';

export interface ReplayOrder {
  unitId: number;
  orderType: OrderType;
  targetX: number;
  targetY: number;
  targetUnitId?: number;
  team: number;
}

export interface ReplayFrame {
  tick: number;
  orders: ReplayOrder[];
}
