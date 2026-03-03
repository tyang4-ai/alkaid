import {
  UnitType, CampaignTerritoryType,
  CAMPAIGN_DIFFICULTY_GARRISON_SCALE, CAMPAIGN_DIFFICULTY_EXP_SCALE,
  UNIT_TYPE_CONFIGS,
} from '../../constants';
import type { Territory } from './CampaignTypes';

export interface EnemySquadDef {
  type: UnitType;
  size: number;
  experience: number;
  isGeneral?: boolean;
}

/** Simple seeded PRNG (mulberry32). */
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Composition weights by territory type: [infantry, ranged, cavalry, siege]
const COMPOSITION_WEIGHTS: Record<number, [number, number, number, number]> = {
  [CampaignTerritoryType.FARMING_PLAINS]: [0.50, 0.30, 0.15, 0.05],
  [CampaignTerritoryType.TRADE_CITY]:     [0.40, 0.25, 0.20, 0.15],
  [CampaignTerritoryType.HORSE_PLAINS]:   [0.25, 0.15, 0.55, 0.05],
  [CampaignTerritoryType.IRON_MOUNTAINS]: [0.35, 0.20, 0.10, 0.35],
  [CampaignTerritoryType.RIVER_PORT]:     [0.40, 0.35, 0.15, 0.10],
  [CampaignTerritoryType.FOREST_REGION]:  [0.35, 0.40, 0.15, 0.10],
  [CampaignTerritoryType.CAPITAL_CITY]:   [0.30, 0.20, 0.20, 0.30],
  [CampaignTerritoryType.FRONTIER_FORT]:  [0.45, 0.30, 0.10, 0.15],
};

const INFANTRY_TYPES: UnitType[] = [UnitType.JI_HALBERDIERS, UnitType.DAO_SWORDSMEN];
const RANGED_TYPES: UnitType[] = [UnitType.NU_CROSSBOWMEN, UnitType.GONG_ARCHERS];
const CAVALRY_TYPES: UnitType[] = [UnitType.LIGHT_CAVALRY, UnitType.HEAVY_CAVALRY, UnitType.HORSE_ARCHERS];
const SIEGE_TYPES: UnitType[] = [UnitType.SIEGE_ENGINEERS];

export class EnemyArmyGenerator {

  generate(
    territory: Territory,
    campaignTurn: number,
    territoriesConquered: number,
    seed: number,
  ): EnemySquadDef[] {
    const rng = seededRng(seed + territory.id.length * 7 + campaignTurn);

    // Scale garrison
    const scaledCount = Math.round(
      territory.garrisonStrength * (1 + territoriesConquered * CAMPAIGN_DIFFICULTY_GARRISON_SCALE)
    );
    const scaledExp = Math.min(85, territory.garrisonBaseExp + campaignTurn * CAMPAIGN_DIFFICULTY_EXP_SCALE);

    const weights = COMPOSITION_WEIGHTS[territory.type] ?? [0.40, 0.25, 0.20, 0.15];

    const squads: EnemySquadDef[] = [];

    // Allocate squads by category weights (excluding general)
    const squadCount = Math.max(1, scaledCount - 1); // -1 for general
    const infantryCount = Math.max(1, Math.round(squadCount * weights[0]));
    const rangedCount = Math.round(squadCount * weights[1]);
    const cavCount = Math.round(squadCount * weights[2]);
    const siegeCount = Math.max(0, squadCount - infantryCount - rangedCount - cavCount);

    // Generate squads per category
    this.addSquads(squads, infantryCount, INFANTRY_TYPES, scaledExp, rng);
    this.addSquads(squads, rangedCount, RANGED_TYPES, scaledExp, rng);
    this.addSquads(squads, cavCount, CAVALRY_TYPES, scaledExp, rng);
    this.addSquads(squads, siegeCount > 0 ? siegeCount : Math.round(squadCount * weights[3]), SIEGE_TYPES, scaledExp, rng);

    // Trim to target count if rounding caused overshoot
    while (squads.length > scaledCount - 1 && squads.length > 1) {
      squads.pop();
    }

    // Always add general
    squads.push({
      type: UnitType.GENERAL,
      size: 1,
      experience: scaledExp,
      isGeneral: true,
    });

    return squads;
  }

  private addSquads(
    out: EnemySquadDef[],
    count: number,
    typePool: UnitType[],
    exp: number,
    rng: () => number,
  ): void {
    for (let i = 0; i < count; i++) {
      const type = typePool[Math.floor(rng() * typePool.length)];
      const config = UNIT_TYPE_CONFIGS[type];
      // Vary size slightly: 80-100% of max
      const sizeFraction = 0.8 + rng() * 0.2;
      const size = Math.max(1, Math.round(config.maxSize * sizeFraction));
      // Vary exp slightly: ±10%
      const expVar = Math.max(0, Math.min(100, Math.round(exp * (0.9 + rng() * 0.2))));
      out.push({ type, size, experience: expVar });
    }
  }
}
