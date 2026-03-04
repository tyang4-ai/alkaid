// Messages sent main→worker
export interface TerrainInitMsg {
  type: 'init';
  width: number;
  height: number;
  terrain: Uint8Array;
}

export interface PathRequestMsg {
  type: 'pathRequest';
  id: number;
  unitType: number;
  startTX: number;
  startTY: number;
  goalTX: number;
  goalTY: number;
}

export interface FlowFieldRequestMsg {
  type: 'flowRequest';
  id: number;
  unitType: number;
  targetTX: number;
  targetTY: number;
}

export type WorkerInMsg = TerrainInitMsg | PathRequestMsg | FlowFieldRequestMsg;

// Messages sent worker→main
export interface PathResultMsg {
  type: 'pathResult';
  id: number;
  found: boolean;
  path: Array<{ x: number; y: number }>;
  nodesExplored: number;
}

export interface FlowFieldResultMsg {
  type: 'flowResult';
  id: number;
  directions: Int8Array;
  costs: Float32Array;
  width: number;
  height: number;
  targetTileX: number;
  targetTileY: number;
}

export interface WorkerErrorMsg {
  type: 'error';
  id: number;
  message: string;
}

export type WorkerOutMsg = PathResultMsg | FlowFieldResultMsg | WorkerErrorMsg;
