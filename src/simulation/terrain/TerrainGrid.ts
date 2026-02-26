import { TerrainType } from '../../constants';

export interface TerrainGridData {
  width: number;
  height: number;
  seed: number;
  templateId: string;
  elevation: Float32Array;   // [y * width + x] normalized 0-1
  moisture: Float32Array;    // [y * width + x] normalized 0-1
  terrain: Uint8Array;       // [y * width + x] TerrainType enum values
  riverFlow: Int8Array;      // [y * width + x] direction (-1 = no river, 0-7 = 8-dir neighbor)
  tileBitmask: Uint8Array;   // [y * width + x] 4-bit auto-tile bitmask (N|E|S|W neighbor match)
}

// Auto-tile bitmask flags (cardinal neighbors that share the same terrain type)
// Bit layout: N=8, E=4, S=2, W=1 → 16 possible combinations (0-15)
export const BITMASK_N = 8;
export const BITMASK_E = 4;
export const BITMASK_S = 2;
export const BITMASK_W = 1;

export class TerrainGrid {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly templateId: string;
  readonly elevation: Float32Array;
  readonly moisture: Float32Array;
  readonly terrain: Uint8Array;
  readonly riverFlow: Int8Array;
  readonly tileBitmask: Uint8Array;

  constructor(data: TerrainGridData) {
    this.width = data.width;
    this.height = data.height;
    this.seed = data.seed;
    this.templateId = data.templateId;
    this.elevation = data.elevation;
    this.moisture = data.moisture;
    this.terrain = data.terrain;
    this.riverFlow = data.riverFlow;
    this.tileBitmask = data.tileBitmask;
  }

  getElevation(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.elevation[y * this.width + x];
  }

  getMoisture(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.moisture[y * this.width + x];
  }

  getTerrain(x: number, y: number): TerrainType {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TerrainType.WATER;
    return this.terrain[y * this.width + x] as TerrainType;
  }

  getBitmask(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.tileBitmask[y * this.width + x];
  }

  hasRiver(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return this.riverFlow[y * this.width + x] !== -1;
  }
}
