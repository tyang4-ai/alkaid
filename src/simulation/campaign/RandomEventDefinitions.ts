import type { RandomEventDefinition } from './CampaignTypes';

export const RANDOM_EVENT_DEFINITIONS: RandomEventDefinition[] = [
  {
    id: 'peasant_uprising',
    name: 'Peasant Uprising', chineseName: '民變',
    description: 'A conquered territory revolts! Send troops to suppress or lose it.',
    choices: [
      { label: 'Suppress', chineseLabel: '镇压', description: 'Pay 50 gold to suppress the revolt' },
      { label: 'Abandon', chineseLabel: '放弃', description: 'Lose the territory' },
    ],
    condition: (state) => state.territoriesConquered > 1,
  },
  {
    id: 'defectors',
    name: 'Defectors', chineseName: '叛軍來投',
    description: 'Enemy soldiers offer to join your army. 30 troops with experience 40.',
    choices: [
      { label: 'Accept', chineseLabel: '接受', description: 'Gain 30 troops (exp 40), -10 morale to existing army' },
      { label: 'Refuse', chineseLabel: '拒绝', description: 'Decline — no effect' },
    ],
  },
  {
    id: 'supply_cache',
    name: 'Supply Cache', chineseName: '糧倉',
    description: 'Scouts discover a hidden granary! +50 food.',
    choices: [
      { label: 'Collect', chineseLabel: '收取', description: '+50 food' },
    ],
  },
  {
    id: 'disease',
    name: 'Disease', chineseName: '疫病',
    description: 'Plague hits the camp. All squads lose 5% soldiers.',
    choices: [
      { label: 'Rest', chineseLabel: '休养', description: 'Rest a turn — no further losses' },
      { label: 'Push On', chineseLabel: '继续进军', description: 'Risk another 5% loss next turn' },
    ],
  },
  {
    id: 'rival_duel',
    name: 'Rival General\'s Challenge', chineseName: '武將挑戰',
    description: 'An enemy champion challenges your general to a duel.',
    choices: [
      { label: 'Accept', chineseLabel: '接受', description: '50/50 — win: +20 morale, lose: -20 morale' },
      { label: 'Decline', chineseLabel: '婉拒', description: '-5 morale (seen as cowardly)' },
    ],
  },
  {
    id: 'merchant',
    name: 'Traveling Merchant', chineseName: '商隊',
    description: 'A merchant offers rare equipment at a premium.',
    choices: [
      { label: 'Buy', chineseLabel: '购买', description: '200 gold → +10 exp to your strongest squad' },
      { label: 'Pass', chineseLabel: '拒绝', description: 'Save your gold' },
    ],
    condition: (state) => state.resources.gold >= 200,
  },
  {
    id: 'storm',
    name: 'Severe Storm', chineseName: '暴風',
    description: 'A terrible storm damages the camp. -30 food, +20 fatigue.',
    choices: [
      { label: 'Endure', chineseLabel: '忍耐', description: 'Weather the storm' },
    ],
  },
  {
    id: 'spy_report',
    name: 'Spy Report', chineseName: '密報',
    description: 'A spy reveals the exact enemy composition of a nearby territory.',
    choices: [
      { label: 'Acknowledge', chineseLabel: '知悉', description: 'Intel gathered' },
    ],
  },
  {
    id: 'deserters',
    name: 'Deserters', chineseName: '逃兵',
    description: 'Morale is dangerously low. Your weakest squad deserts!',
    choices: [
      { label: 'Accept Loss', chineseLabel: '接受', description: 'Lowest morale squad leaves' },
    ],
    condition: (state) => state.roster.squads.some(s => s.morale < 30),
  },
  {
    id: 'alliance',
    name: 'Alliance Offer', chineseName: '結盟',
    description: 'An adjacent territory offers to join you without a fight.',
    choices: [
      { label: 'Accept', chineseLabel: '接受', description: 'Gain territory (no combat exp/loot)' },
      { label: 'Refuse', chineseLabel: '拒绝', description: 'Conquer normally for full rewards later' },
    ],
  },
];
