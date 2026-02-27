import type { UnitType } from '../../constants';

export interface RosterEntry {
  rosterId: number;
  type: UnitType;
  size: number;
  maxSize: number;
  experience: number;
  morale: number;
  placed: boolean;
  unitId: number | null;  // UnitManager ID when placed, null when in sidebar
  isGeneral: boolean;
}
