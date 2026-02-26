import { createNoise2D } from 'simplex-noise';
import { SeededRandom } from '../../utils/Random';
import { TerrainGrid } from './TerrainGrid';
import {
  TerrainType,
  DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT,
  TERRAIN_GEN,
} from '../../constants';
import { type MapTemplate, MAP_TEMPLATES } from './MapTemplates';

export class TerrainGenerator {
  private rng: SeededRandom;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new SeededRandom(seed);
  }

  generate(
    templateId: string = 'open_plains',
    width: number = DEFAULT_MAP_WIDTH,
    height: number = DEFAULT_MAP_HEIGHT,
  ): TerrainGrid {
    const template = MAP_TEMPLATES[templateId];
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    const size = width * height;
    const elevation = new Float32Array(size);
    const moisture = new Float32Array(size);
    const terrain = new Uint8Array(size);
    const riverFlow = new Int8Array(size).fill(-1);
    const tileBitmask = new Uint8Array(size);

    this.generateElevation(elevation, width, height, template);
    this.generateMoisture(moisture, width, height, template);
    this.generateRivers(elevation, riverFlow, width, height);
    this.assignBiomes(terrain, elevation, moisture, riverFlow, width, height);
    this.placeStructures(terrain, elevation, riverFlow, width, height, template);
    this.computeBitmask(terrain, tileBitmask, width, height);

    return new TerrainGrid({
      width, height, seed: this.seed, templateId,
      elevation, moisture, terrain, riverFlow, tileBitmask,
    });
  }

  private generateElevation(
    elevation: Float32Array, w: number, h: number, template: MapTemplate,
  ): void {
    const noise2D = createNoise2D(() => this.rng.next());
    const { OCTAVES, LACUNARITY, PERSISTENCE, BASE_FREQUENCY, ELEVATION_POWER } = TERRAIN_GEN;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let value = 0;
        let amplitude = 1;
        let frequency = BASE_FREQUENCY;
        let maxAmplitude = 0;

        for (let o = 0; o < OCTAVES; o++) {
          value += noise2D(x * frequency, y * frequency) * amplitude;
          maxAmplitude += amplitude;
          amplitude *= PERSISTENCE;
          frequency *= LACUNARITY;
        }

        value = (value / maxAmplitude + 1) / 2;
        value = Math.pow(value, ELEVATION_POWER);
        value = template.elevationBias(x, y, w, h, value);
        elevation[y * w + x] = Math.max(0, Math.min(1, value));
      }
    }
  }

  private generateMoisture(
    moisture: Float32Array, w: number, h: number, template: MapTemplate,
  ): void {
    const rngMoisture = new SeededRandom(this.seed + TERRAIN_GEN.MOISTURE_SEED_OFFSET);
    const noise2D = createNoise2D(() => rngMoisture.next());
    const { OCTAVES, LACUNARITY, PERSISTENCE, BASE_FREQUENCY } = TERRAIN_GEN;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let value = 0;
        let amplitude = 1;
        let frequency = BASE_FREQUENCY * 1.5;
        let maxAmplitude = 0;

        for (let o = 0; o < OCTAVES; o++) {
          value += noise2D(x * frequency, y * frequency) * amplitude;
          maxAmplitude += amplitude;
          amplitude *= PERSISTENCE;
          frequency *= LACUNARITY;
        }

        value = (value / maxAmplitude + 1) / 2;
        value = template.moistureBias(x, y, w, h, value);
        moisture[y * w + x] = Math.max(0, Math.min(1, value));
      }
    }
  }

  private generateRivers(
    elevation: Float32Array, riverFlow: Int8Array, w: number, h: number,
  ): void {
    const riverCount = this.rng.nextInt(TERRAIN_GEN.RIVER_COUNT_MIN, TERRAIN_GEN.RIVER_COUNT_MAX);
    const sources: { x: number; y: number }[] = [];

    const candidates: { x: number; y: number; elev: number }[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const elev = elevation[y * w + x];
        if (elev > 0.7) candidates.push({ x, y, elev });
      }
    }

    candidates.sort((a, b) => b.elev - a.elev);
    const minDist = Math.min(w, h) / 4;
    for (const c of candidates) {
      if (sources.length >= riverCount) break;
      const tooClose = sources.some(
        s => Math.hypot(s.x - c.x, s.y - c.y) < minDist,
      );
      if (!tooClose) sources.push({ x: c.x, y: c.y });
    }

    const dx = [0, 1, 1, 1, 0, -1, -1, -1];
    const dy = [-1, -1, 0, 1, 1, 1, 0, -1];

    for (const source of sources) {
      let cx = source.x;
      let cy = source.y;
      const visited = new Set<number>();

      for (let step = 0; step < w * h; step++) {
        const idx = cy * w + cx;
        if (visited.has(idx)) break;
        visited.add(idx);

        let bestDir = -1;
        let bestElev = elevation[idx];

        for (let d = 0; d < 8; d++) {
          const nx = cx + dx[d];
          const ny = cy + dy[d];
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nElev = elevation[ny * w + nx];
          if (nElev < bestElev) {
            bestElev = nElev;
            bestDir = d;
          }
        }

        if (bestDir === -1) break;

        riverFlow[idx] = bestDir;
        elevation[idx] *= TERRAIN_GEN.RIVER_EROSION;

        if (bestElev < TERRAIN_GEN.WATER_LEVEL) break;

        cx += dx[bestDir];
        cy += dy[bestDir];
      }
    }
  }

  private assignBiomes(
    terrain: Uint8Array, elevation: Float32Array, moisture: Float32Array,
    riverFlow: Int8Array, w: number, h: number,
  ): void {
    const { WATER_LEVEL, FORD_LEVEL, MOUNTAIN_LEVEL, HILLS_LEVEL, FOREST_MOISTURE } = TERRAIN_GEN;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const elev = elevation[idx];
        const moist = moisture[idx];

        if (riverFlow[idx] !== -1) {
          terrain[idx] = TerrainType.RIVER;
          continue;
        }

        if (elev < WATER_LEVEL) {
          terrain[idx] = TerrainType.WATER;
        } else if (elev < FORD_LEVEL) {
          terrain[idx] = TerrainType.FORD;
        } else if (elev > MOUNTAIN_LEVEL) {
          terrain[idx] = TerrainType.MOUNTAINS;
        } else if (elev > HILLS_LEVEL) {
          terrain[idx] = TerrainType.HILLS;
        } else if (moist > FOREST_MOISTURE) {
          terrain[idx] = TerrainType.FOREST;
        } else {
          terrain[idx] = TerrainType.PLAINS;
        }
      }
    }

    // Mark marsh in low-elevation high-moisture areas
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const elev = elevation[idx];
        const moist = moisture[idx];
        if (elev > FORD_LEVEL && elev < 0.30 && moist > 0.75 && terrain[idx] !== TerrainType.RIVER) {
          terrain[idx] = TerrainType.MARSH;
        }
      }
    }
  }

  private placeStructures(
    terrain: Uint8Array, _elevation: Float32Array, _riverFlow: Int8Array,
    w: number, h: number, template: MapTemplate,
  ): void {
    // Place cities from template-defined positions
    for (const city of template.cities) {
      const cx = Math.floor(city.x * w);
      const cy = Math.floor(city.y * h);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
            terrain[ty * w + tx] = TerrainType.CITY;
          }
        }
      }
    }

    // Place fords at ~15% of eligible river crossing points
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (terrain[idx] === TerrainType.RIVER) {
          const leftOk = terrain[y * w + (x - 1)] !== TerrainType.RIVER &&
                         terrain[y * w + (x - 1)] !== TerrainType.WATER;
          const rightOk = terrain[y * w + (x + 1)] !== TerrainType.RIVER &&
                          terrain[y * w + (x + 1)] !== TerrainType.WATER;
          const topOk = terrain[(y - 1) * w + x] !== TerrainType.RIVER &&
                        terrain[(y - 1) * w + x] !== TerrainType.WATER;
          const bottomOk = terrain[(y + 1) * w + x] !== TerrainType.RIVER &&
                           terrain[(y + 1) * w + x] !== TerrainType.WATER;

          if ((leftOk && rightOk) || (topOk && bottomOk)) {
            if (this.rng.next() < 0.15) {
              terrain[idx] = TerrainType.FORD;
            }
          }
        }
      }
    }
  }

  private computeBitmask(
    terrain: Uint8Array, tileBitmask: Uint8Array, w: number, h: number,
  ): void {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const type = terrain[idx];
        let mask = 0;

        if (y > 0 && terrain[(y - 1) * w + x] === type) mask |= 8;     // North
        if (x < w - 1 && terrain[y * w + (x + 1)] === type) mask |= 4;  // East
        if (y < h - 1 && terrain[(y + 1) * w + x] === type) mask |= 2;  // South
        if (x > 0 && terrain[y * w + (x - 1)] === type) mask |= 1;      // West

        tileBitmask[idx] = mask;
      }
    }
  }
}
