import { describe, it, expect } from 'vitest';
import { getFormationTemplate, assignFormation } from '../FormationTemplates';
import { DeploymentZone } from '../DeploymentZone';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import {
  TerrainType, UnitType, UnitCategory, FormationType,
  UNIT_TYPE_CONFIGS,
} from '../../../constants';
import type { RosterEntry } from '../RosterEntry';

function makeFlatGrid(width = 200, height = 150): TerrainGrid {
  const size = width * height;
  return new TerrainGrid({
    width, height, seed: 42, templateId: 'open_plains',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain: new Uint8Array(size).fill(TerrainType.PLAINS),
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size).fill(0),
  });
}

function makeRoster(): RosterEntry[] {
  const entries: RosterEntry[] = [
    { rosterId: 0, type: UnitType.JI_HALBERDIERS, size: 120, maxSize: 120, experience: 0, morale: 70, placed: false, unitId: null, isGeneral: false },
    { rosterId: 1, type: UnitType.JI_HALBERDIERS, size: 120, maxSize: 120, experience: 0, morale: 70, placed: false, unitId: null, isGeneral: false },
    { rosterId: 2, type: UnitType.NU_CROSSBOWMEN, size: 100, maxSize: 100, experience: 0, morale: 70, placed: false, unitId: null, isGeneral: false },
    { rosterId: 3, type: UnitType.GONG_ARCHERS, size: 80, maxSize: 80, experience: 0, morale: 70, placed: false, unitId: null, isGeneral: false },
    { rosterId: 4, type: UnitType.LIGHT_CAVALRY, size: 40, maxSize: 40, experience: 0, morale: 70, placed: false, unitId: null, isGeneral: false },
    { rosterId: 5, type: UnitType.ELITE_GUARD, size: 15, maxSize: 30, experience: 0, morale: 85, placed: false, unitId: null, isGeneral: true },
  ];
  return entries;
}

describe('FormationTemplates', () => {
  it('each formation template has at least 1 slot', () => {
    const formations = [
      FormationType.STANDARD_LINE,
      FormationType.CRESCENT,
      FormationType.ECHELON_LEFT,
      FormationType.ECHELON_RIGHT,
      FormationType.DEFENSIVE_SQUARE,
      FormationType.AMBUSH,
    ];

    for (const f of formations) {
      const template = getFormationTemplate(f);
      expect(template.slots.length).toBeGreaterThan(0);
      expect(template.type).toBe(f);
    }
  });

  it('assignFormation maps infantry to infantry slots', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);
    const roster = makeRoster();
    const center = zone.getCenter();

    const assignments = assignFormation(roster, FormationType.STANDARD_LINE, center, zone);

    expect(assignments.length).toBeGreaterThan(0);
    // Check that infantry units were assigned
    const infantryIds = roster.filter(e => UNIT_TYPE_CONFIGS[e.type].category === UnitCategory.INFANTRY).map(e => e.rosterId);
    const assignedInfantry = assignments.filter(a => infantryIds.includes(a.rosterId));
    expect(assignedInfantry.length).toBeGreaterThan(0);
  });

  it('excess units remain unassigned', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    // Create roster with more units than slots
    const bigRoster: RosterEntry[] = [];
    for (let i = 0; i < 20; i++) {
      bigRoster.push({
        rosterId: i, type: UnitType.JI_HALBERDIERS, size: 120, maxSize: 120,
        experience: 0, morale: 70, placed: false, unitId: null, isGeneral: false,
      });
    }
    const center = zone.getCenter();
    const template = getFormationTemplate(FormationType.STANDARD_LINE);

    const assignments = assignFormation(bigRoster, FormationType.STANDARD_LINE, center, zone);

    // Should assign at most as many as there are slots
    expect(assignments.length).toBeLessThanOrEqual(template.slots.length);
  });

  it('fewer units than slots skips gracefully', () => {
    const grid = makeFlatGrid();
    const zone = new DeploymentZone(grid, 'open_plains', 0);

    // Only 1 infantry unit
    const smallRoster: RosterEntry[] = [
      { rosterId: 0, type: UnitType.JI_HALBERDIERS, size: 120, maxSize: 120, experience: 0, morale: 70, placed: false, unitId: null, isGeneral: false },
    ];
    const center = zone.getCenter();

    const assignments = assignFormation(smallRoster, FormationType.STANDARD_LINE, center, zone);
    expect(assignments.length).toBe(1);
  });

  it('Standard Line places ranged behind infantry (lower Y offset)', () => {
    const template = getFormationTemplate(FormationType.STANDARD_LINE);

    const infantrySlots = template.slots.filter(s => s.preferredCategory === UnitCategory.INFANTRY && !s.isGeneral);
    const rangedSlots = template.slots.filter(s => s.preferredCategory === UnitCategory.RANGED);

    // Infantry should have higher Y offsets (toward enemy) than ranged
    const avgInfantryY = infantrySlots.reduce((sum, s) => sum + s.offsetY, 0) / infantrySlots.length;
    const avgRangedY = rangedSlots.reduce((sum, s) => sum + s.offsetY, 0) / rangedSlots.length;

    expect(avgInfantryY).toBeGreaterThan(avgRangedY);
  });

  it('all slot positions within reasonable bounds', () => {
    const formations = [
      FormationType.STANDARD_LINE,
      FormationType.CRESCENT,
      FormationType.ECHELON_LEFT,
      FormationType.ECHELON_RIGHT,
      FormationType.DEFENSIVE_SQUARE,
      FormationType.AMBUSH,
    ];

    for (const f of formations) {
      const template = getFormationTemplate(f);
      for (const slot of template.slots) {
        // Offsets should be within 15 tiles of center in any direction
        expect(Math.abs(slot.offsetX)).toBeLessThanOrEqual(15);
        expect(Math.abs(slot.offsetY)).toBeLessThanOrEqual(15);
      }
    }
  });
});
