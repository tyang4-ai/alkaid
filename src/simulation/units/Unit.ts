import type { UnitType, UnitState } from '../../constants';

/** Plain data interface — no methods (data-oriented design). */
export interface Unit {
  readonly id: number;
  type: UnitType;
  team: number;           // 0=player, 1=enemy (extensible to more teams)
  x: number;              // world pixels
  y: number;
  prevX: number;          // previous x for frame interpolation
  prevY: number;          // previous y for frame interpolation
  size: number;           // current soldier count
  maxSize: number;
  hp: number;             // size * hpPerSoldier
  morale: number;         // 0-100, default 70 (85 for elite)
  fatigue: number;        // 0-100, default 0
  supply: number;         // 0-100, default 100
  experience: number;     // 0-100, default 0
  state: UnitState;
  facing: number;         // radians

  // Pathfinding (Step 6)
  path: Array<{ x: number; y: number }> | null;  // world-pixel waypoints
  pathIndex: number;  // current waypoint index in path
  targetX: number;    // final destination world-pixel X (from order)
  targetY: number;    // final destination world-pixel Y (from order)
}
