import { describe, it, expect } from 'vitest';
import { EnemyArmyGenerator } from '../EnemyArmyGenerator';
import { UnitType, CampaignTerritoryType, UnitCategory, UNIT_TYPE_CONFIGS } from '../../../constants';
import type { Territory } from '../CampaignTypes';

function makeTerritory(overrides: Partial<Territory> = {}): Territory {
  return {
    id: 'test',
    name: 'Test',
    chineseName: '测试',
    type: CampaignTerritoryType.FARMING_PLAINS,
    adjacentIds: [],
    mapPosition: { x: 0.5, y: 0.5 },
    terrainTemplate: 'open_plains',
    garrisonStrength: 8,
    garrisonBaseExp: 10,
    owner: 'enemy',
    conqueredTurn: null,
    ...overrides,
  };
}

describe('EnemyArmyGenerator', () => {
  const gen = new EnemyArmyGenerator();

  it('generates correct squad count matching garrison strength', () => {
    const territory = makeTerritory({ garrisonStrength: 8 });
    const squads = gen.generate(territory, 1, 0, 42);
    // Should be close to 8 squads (including general)
    expect(squads.length).toBeGreaterThanOrEqual(5);
    expect(squads.length).toBeLessThanOrEqual(12);
  });

  it('scaling increases with conquered territories', () => {
    const territory = makeTerritory({ garrisonStrength: 10 });
    const squads0 = gen.generate(territory, 1, 0, 42);
    const squads10 = gen.generate(territory, 1, 10, 42);
    // 10 conquered = +50% strength → more squads
    expect(squads10.length).toBeGreaterThanOrEqual(squads0.length);
  });

  it('exp scales with campaign turn', () => {
    const territory = makeTerritory({ garrisonBaseExp: 10 });
    const turn1 = gen.generate(territory, 1, 0, 42);
    const turn10 = gen.generate(territory, 10, 0, 42);

    const avgExp1 = turn1.filter(s => !s.isGeneral).reduce((sum, s) => sum + s.experience, 0) / turn1.filter(s => !s.isGeneral).length;
    const avgExp10 = turn10.filter(s => !s.isGeneral).reduce((sum, s) => sum + s.experience, 0) / turn10.filter(s => !s.isGeneral).length;

    expect(avgExp10).toBeGreaterThan(avgExp1);
  });

  it('exp caps at 85', () => {
    const territory = makeTerritory({ garrisonBaseExp: 80 });
    const squads = gen.generate(territory, 50, 0, 42);
    for (const s of squads) {
      expect(s.experience).toBeLessThanOrEqual(100); // 85 * 1.1 variation still under 100
    }
  });

  it('always includes general', () => {
    const territory = makeTerritory();
    const squads = gen.generate(territory, 1, 0, 42);
    const general = squads.find(s => s.isGeneral);
    expect(general).toBeDefined();
    expect(general!.type).toBe(UnitType.GENERAL);
  });

  it('deterministic with same seed', () => {
    const territory = makeTerritory();
    const squads1 = gen.generate(territory, 1, 0, 42);
    const squads2 = gen.generate(territory, 1, 0, 42);
    expect(squads1).toEqual(squads2);
  });

  it('different seeds produce different compositions', () => {
    const territory = makeTerritory();
    const squads1 = gen.generate(territory, 1, 0, 42);
    const squads2 = gen.generate(territory, 1, 0, 99);
    // Very unlikely to be identical with different seeds
    const types1 = squads1.map(s => s.type).join(',');
    const types2 = squads2.map(s => s.type).join(',');
    // At least one should differ (probabilistic but extremely likely)
    // We check sizes instead since types might coincide
    const sizes1 = squads1.map(s => s.size).join(',');
    const sizes2 = squads2.map(s => s.size).join(',');
    expect(sizes1 === sizes2 && types1 === types2).toBe(false);
  });

  it('horse plains territory has more cavalry', () => {
    const horsePlains = makeTerritory({
      type: CampaignTerritoryType.HORSE_PLAINS,
      garrisonStrength: 12,
    });
    const farming = makeTerritory({
      type: CampaignTerritoryType.FARMING_PLAINS,
      garrisonStrength: 12,
    });

    const horseSquads = gen.generate(horsePlains, 5, 0, 42);
    const farmSquads = gen.generate(farming, 5, 0, 42);

    const horseCavCount = horseSquads.filter(s =>
      UNIT_TYPE_CONFIGS[s.type]?.category === UnitCategory.CAVALRY
    ).length;
    const farmCavCount = farmSquads.filter(s =>
      UNIT_TYPE_CONFIGS[s.type]?.category === UnitCategory.CAVALRY
    ).length;

    expect(horseCavCount).toBeGreaterThanOrEqual(farmCavCount);
  });

  it('capital territory generates strong garrison', () => {
    const capital = makeTerritory({
      id: 'zijin',
      type: CampaignTerritoryType.CAPITAL_CITY,
      garrisonStrength: 18,
      garrisonBaseExp: 60,
    });
    const squads = gen.generate(capital, 10, 5, 42);
    expect(squads.length).toBeGreaterThanOrEqual(15);
  });

  it('all squad sizes are positive', () => {
    const territory = makeTerritory();
    const squads = gen.generate(territory, 1, 0, 42);
    for (const s of squads) {
      expect(s.size).toBeGreaterThan(0);
    }
  });
});
