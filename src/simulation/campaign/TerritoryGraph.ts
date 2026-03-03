import { CampaignTerritoryType } from '../../constants';
import type { Territory } from './CampaignTypes';

/**
 * Static data for 20 fictional territories.
 * All start enemy-owned. 4 are starting candidates (graph edges).
 *
 * Layout: roughly 4 clusters connected by chokepoints.
 * Capital (Zijin) in center, reachable from any start via ~4-5 hops.
 */

const T = CampaignTerritoryType;

export const STARTING_TERRITORY_IDS = ['longmen', 'baima', 'jinsha', 'cangwu'] as const;

export const TERRITORY_DATA: Omit<Territory, 'owner' | 'conqueredTurn'>[] = [
  // --- Northwest Cluster ---
  {
    id: 'longmen', name: 'Longmen', chineseName: '龍門',
    type: T.FRONTIER_FORT, adjacentIds: ['cuizhu', 'qingshi'],
    mapPosition: { x: 0.08, y: 0.15 },
    terrainTemplate: 'mountain_pass', garrisonStrength: 5, garrisonBaseExp: 5,
    specialBonus: 'veteran_scouts',
  },
  {
    id: 'cuizhu', name: 'Cuizhu', chineseName: '翠竹',
    type: T.FOREST_REGION, adjacentIds: ['longmen', 'baima', 'yuntai'],
    mapPosition: { x: 0.22, y: 0.12 },
    terrainTemplate: 'dense_forest', garrisonStrength: 7, garrisonBaseExp: 10,
  },
  {
    id: 'baima', name: 'Baima', chineseName: '白馬',
    type: T.HORSE_PLAINS, adjacentIds: ['cuizhu', 'xuanwu'],
    mapPosition: { x: 0.38, y: 0.08 },
    terrainTemplate: 'open_plains', garrisonStrength: 6, garrisonBaseExp: 5,
    specialBonus: 'horse_supply',
  },

  // --- Northeast Cluster ---
  {
    id: 'jinsha', name: 'Jinsha', chineseName: '金沙',
    type: T.RIVER_PORT, adjacentIds: ['chibi', 'fengxiang'],
    mapPosition: { x: 0.85, y: 0.10 },
    terrainTemplate: 'river_valley', garrisonStrength: 6, garrisonBaseExp: 8,
    specialBonus: 'trade_income',
  },
  {
    id: 'yuntai', name: 'Yuntai', chineseName: '雲台',
    type: T.IRON_MOUNTAINS, adjacentIds: ['cuizhu', 'xuanwu', 'hulao'],
    mapPosition: { x: 0.30, y: 0.28 },
    terrainTemplate: 'mountain_pass', garrisonStrength: 9, garrisonBaseExp: 20,
  },
  {
    id: 'cangwu', name: 'Cangwu', chineseName: '蒼梧',
    type: T.FARMING_PLAINS, adjacentIds: ['qingshi', 'tianzhu'],
    mapPosition: { x: 0.10, y: 0.50 },
    terrainTemplate: 'open_plains', garrisonStrength: 5, garrisonBaseExp: 5,
    specialBonus: 'food_surplus',
  },
  {
    id: 'qingshi', name: 'Qingshi', chineseName: '青石',
    type: T.FRONTIER_FORT, adjacentIds: ['longmen', 'cangwu', 'tianzhu', 'hulao'],
    mapPosition: { x: 0.15, y: 0.35 },
    terrainTemplate: 'mountain_pass', garrisonStrength: 8, garrisonBaseExp: 15,
  },
  {
    id: 'chibi', name: 'Chibi', chineseName: '赤壁',
    type: T.RIVER_PORT, adjacentIds: ['jinsha', 'xuanwu', 'zhuque'],
    mapPosition: { x: 0.72, y: 0.18 },
    terrainTemplate: 'river_valley', garrisonStrength: 10, garrisonBaseExp: 25,
  },

  // --- Central Belt ---
  {
    id: 'xuanwu', name: 'Xuanwu', chineseName: '玄武',
    type: T.TRADE_CITY, adjacentIds: ['baima', 'yuntai', 'chibi', 'zijin'],
    mapPosition: { x: 0.50, y: 0.20 },
    terrainTemplate: 'open_plains', garrisonStrength: 11, garrisonBaseExp: 30,
  },
  {
    id: 'fengxiang', name: 'Fengxiang', chineseName: '鳳翔',
    type: T.FARMING_PLAINS, adjacentIds: ['jinsha', 'zhuque', 'yinhe'],
    mapPosition: { x: 0.82, y: 0.35 },
    terrainTemplate: 'open_plains', garrisonStrength: 8, garrisonBaseExp: 15,
  },
  {
    id: 'hulao', name: 'Hulao', chineseName: '虎牢',
    type: T.IRON_MOUNTAINS, adjacentIds: ['yuntai', 'qingshi', 'qilin', 'zijin'],
    mapPosition: { x: 0.28, y: 0.50 },
    terrainTemplate: 'mountain_pass', garrisonStrength: 12, garrisonBaseExp: 35,
  },
  {
    id: 'tianzhu', name: 'Tianzhu', chineseName: '天柱',
    type: T.FOREST_REGION, adjacentIds: ['cangwu', 'qingshi', 'qilin'],
    mapPosition: { x: 0.15, y: 0.68 },
    terrainTemplate: 'dense_forest', garrisonStrength: 9, garrisonBaseExp: 20,
  },
  {
    id: 'qilin', name: 'Qilin', chineseName: '麒麟',
    type: T.HORSE_PLAINS, adjacentIds: ['hulao', 'tianzhu', 'jiange', 'zijin'],
    mapPosition: { x: 0.35, y: 0.65 },
    terrainTemplate: 'open_plains', garrisonStrength: 10, garrisonBaseExp: 25,
  },
  {
    id: 'zhuque', name: 'Zhuque', chineseName: '朱雀',
    type: T.TRADE_CITY, adjacentIds: ['chibi', 'fengxiang', 'zijin', 'yaochi'],
    mapPosition: { x: 0.68, y: 0.38 },
    terrainTemplate: 'open_plains', garrisonStrength: 11, garrisonBaseExp: 30,
  },

  // --- Capital ---
  {
    id: 'zijin', name: 'Zijin', chineseName: '紫禁',
    type: T.CAPITAL_CITY, adjacentIds: ['xuanwu', 'hulao', 'qilin', 'zhuque', 'yaochi'],
    mapPosition: { x: 0.50, y: 0.48 },
    terrainTemplate: 'fortified_city', garrisonStrength: 18, garrisonBaseExp: 60,
    specialBonus: 'imperial_treasury',
  },

  // --- Southern Belt ---
  {
    id: 'yaochi', name: 'Yaochi', chineseName: '瑤池',
    type: T.FARMING_PLAINS, adjacentIds: ['zhuque', 'zijin', 'yinhe', 'kunlun'],
    mapPosition: { x: 0.60, y: 0.65 },
    terrainTemplate: 'open_plains', garrisonStrength: 10, garrisonBaseExp: 20,
  },
  {
    id: 'jiange', name: 'Jiange', chineseName: '劍閣',
    type: T.FRONTIER_FORT, adjacentIds: ['qilin', 'kunlun', 'penglai'],
    mapPosition: { x: 0.30, y: 0.82 },
    terrainTemplate: 'mountain_pass', garrisonStrength: 13, garrisonBaseExp: 40,
  },
  {
    id: 'yinhe', name: 'Yinhe', chineseName: '銀河',
    type: T.TRADE_CITY, adjacentIds: ['fengxiang', 'yaochi', 'penglai'],
    mapPosition: { x: 0.78, y: 0.68 },
    terrainTemplate: 'open_plains', garrisonStrength: 12, garrisonBaseExp: 30,
  },
  {
    id: 'kunlun', name: 'Kunlun', chineseName: '昆侖',
    type: T.IRON_MOUNTAINS, adjacentIds: ['yaochi', 'jiange', 'penglai'],
    mapPosition: { x: 0.48, y: 0.82 },
    terrainTemplate: 'mountain_pass', garrisonStrength: 14, garrisonBaseExp: 45,
  },
  {
    id: 'penglai', name: 'Penglai', chineseName: '蓬萊',
    type: T.FOREST_REGION, adjacentIds: ['jiange', 'yinhe', 'kunlun'],
    mapPosition: { x: 0.60, y: 0.90 },
    terrainTemplate: 'dense_forest', garrisonStrength: 11, garrisonBaseExp: 35,
  },
];

/** Create a full Territory array with default enemy ownership. */
export function createTerritories(): Territory[] {
  return TERRITORY_DATA.map(t => ({
    ...t,
    owner: 'enemy' as const,
    conqueredTurn: null,
  }));
}
