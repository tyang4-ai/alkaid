import {
  FormationType, UnitCategory, TILE_SIZE,
  UNIT_TYPE_CONFIGS,
} from '../../constants';
import type { RosterEntry } from './RosterEntry';
import type { DeploymentZone } from './DeploymentZone';

export interface FormationSlot {
  offsetX: number;  // tiles from zone center, +x = right
  offsetY: number;  // tiles from zone center, +y = toward enemy
  preferredCategory: UnitCategory;
  priority: number; // lower = filled first
  isGeneral?: boolean;
}

export interface FormationTemplate {
  type: FormationType;
  slots: FormationSlot[];
}

const STANDARD_LINE: FormationSlot[] = [
  // Front row infantry (y=+4, toward enemy)
  { offsetX: -6, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX: -2, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX:  2, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX:  6, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  // Ranged row (y=+1, behind infantry)
  { offsetX: -4, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 2 },
  { offsetX:  0, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 2 },
  { offsetX:  4, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 2 },
  // Cavalry flanks
  { offsetX: -10, offsetY: 4, preferredCategory: UnitCategory.CAVALRY, priority: 3 },
  { offsetX:  10, offsetY: 4, preferredCategory: UnitCategory.CAVALRY, priority: 3 },
  // Elite guard
  { offsetX: 0, offsetY: -1, preferredCategory: UnitCategory.INFANTRY, priority: 4 },
  // General
  { offsetX: 0, offsetY: -3, preferredCategory: UnitCategory.INFANTRY, priority: 10, isGeneral: true },
];

const CRESCENT: FormationSlot[] = [
  // Center forward
  { offsetX: 0, offsetY: 5, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  // Inner arc
  { offsetX: -3, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX:  3, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  // Outer arc (swept back)
  { offsetX: -6, offsetY: 2, preferredCategory: UnitCategory.RANGED, priority: 2 },
  { offsetX:  6, offsetY: 2, preferredCategory: UnitCategory.RANGED, priority: 2 },
  // Ranged center
  { offsetX: 0, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 2 },
  // Cavalry far flanks
  { offsetX: -10, offsetY: 0, preferredCategory: UnitCategory.CAVALRY, priority: 3 },
  { offsetX:  10, offsetY: 0, preferredCategory: UnitCategory.CAVALRY, priority: 3 },
  // General rear center
  { offsetX: 0, offsetY: -3, preferredCategory: UnitCategory.INFANTRY, priority: 10, isGeneral: true },
];

const ECHELON_LEFT: FormationSlot[] = [
  // Diagonal from top-left to bottom-right
  { offsetX: -6, offsetY: 5, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX: -3, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX:  0, offsetY: 3, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX:  3, offsetY: 2, preferredCategory: UnitCategory.RANGED, priority: 2 },
  { offsetX:  6, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 2 },
  // Cavalry leading edge
  { offsetX: -9, offsetY: 6, preferredCategory: UnitCategory.CAVALRY, priority: 3 },
  // Support
  { offsetX: -3, offsetY: 0, preferredCategory: UnitCategory.RANGED, priority: 2 },
  { offsetX:  0, offsetY: -1, preferredCategory: UnitCategory.INFANTRY, priority: 4 },
  // General
  { offsetX: 3, offsetY: -2, preferredCategory: UnitCategory.INFANTRY, priority: 10, isGeneral: true },
];

const ECHELON_RIGHT: FormationSlot[] = [
  // Mirror of echelon left
  { offsetX:  6, offsetY: 5, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX:  3, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX:  0, offsetY: 3, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX: -3, offsetY: 2, preferredCategory: UnitCategory.RANGED, priority: 2 },
  { offsetX: -6, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 2 },
  // Cavalry leading edge
  { offsetX: 9, offsetY: 6, preferredCategory: UnitCategory.CAVALRY, priority: 3 },
  // Support
  { offsetX: 3, offsetY: 0, preferredCategory: UnitCategory.RANGED, priority: 2 },
  { offsetX: 0, offsetY: -1, preferredCategory: UnitCategory.INFANTRY, priority: 4 },
  // General
  { offsetX: -3, offsetY: -2, preferredCategory: UnitCategory.INFANTRY, priority: 10, isGeneral: true },
];

const DEFENSIVE_SQUARE: FormationSlot[] = [
  // Front side
  { offsetX: -3, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX:  3, offsetY: 4, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  // Right side
  { offsetX: 5, offsetY: 2, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  // Back side
  { offsetX: -3, offsetY: -2, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX:  3, offsetY: -2, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  // Left side
  { offsetX: -5, offsetY: 2, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  // Ranged inside
  { offsetX: -2, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 2 },
  { offsetX:  2, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 2 },
  // Cavalry reserve behind
  { offsetX: 0, offsetY: -4, preferredCategory: UnitCategory.CAVALRY, priority: 3 },
  // General center
  { offsetX: 0, offsetY: 1, preferredCategory: UnitCategory.INFANTRY, priority: 10, isGeneral: true },
];

const AMBUSH: FormationSlot[] = [
  // Bait units at front
  { offsetX: 0, offsetY: 6, preferredCategory: UnitCategory.INFANTRY, priority: 1 },
  { offsetX: 3, offsetY: 5, preferredCategory: UnitCategory.RANGED, priority: 2 },
  // Left flanking group (hidden)
  { offsetX: -8, offsetY: 2, preferredCategory: UnitCategory.INFANTRY, priority: 3 },
  { offsetX: -8, offsetY: 0, preferredCategory: UnitCategory.CAVALRY, priority: 3 },
  { offsetX: -7, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 3 },
  // Right flanking group (hidden)
  { offsetX: 8, offsetY: 2, preferredCategory: UnitCategory.INFANTRY, priority: 3 },
  { offsetX: 8, offsetY: 0, preferredCategory: UnitCategory.CAVALRY, priority: 3 },
  { offsetX: 7, offsetY: 1, preferredCategory: UnitCategory.RANGED, priority: 3 },
  // General in rear
  { offsetX: 0, offsetY: -4, preferredCategory: UnitCategory.INFANTRY, priority: 10, isGeneral: true },
];

const TEMPLATES: Record<FormationType, FormationSlot[]> = {
  [FormationType.STANDARD_LINE]: STANDARD_LINE,
  [FormationType.CRESCENT]: CRESCENT,
  [FormationType.ECHELON_LEFT]: ECHELON_LEFT,
  [FormationType.ECHELON_RIGHT]: ECHELON_RIGHT,
  [FormationType.DEFENSIVE_SQUARE]: DEFENSIVE_SQUARE,
  [FormationType.AMBUSH]: AMBUSH,
};

export function getFormationTemplate(type: FormationType): FormationTemplate {
  return { type, slots: TEMPLATES[type] };
}

export function assignFormation(
  roster: RosterEntry[],
  formation: FormationType,
  zoneCenter: { x: number; y: number },
  deploymentZone: DeploymentZone,
): Array<{ rosterId: number; worldX: number; worldY: number }> {
  const template = getFormationTemplate(formation);
  const sortedSlots = [...template.slots].sort((a, b) => a.priority - b.priority);

  // Group unplaced roster entries by category
  const available: Map<UnitCategory, RosterEntry[]> = new Map();
  const generalEntries: RosterEntry[] = [];

  for (const entry of roster) {
    if (entry.placed) continue;
    if (entry.isGeneral) {
      generalEntries.push(entry);
      continue;
    }
    const category = UNIT_TYPE_CONFIGS[entry.type].category;
    if (!available.has(category)) available.set(category, []);
    available.get(category)!.push(entry);
  }

  const assignments: Array<{ rosterId: number; worldX: number; worldY: number }> = [];
  const assigned = new Set<number>();

  for (const slot of sortedSlots) {
    // General slot
    if (slot.isGeneral) {
      const general = generalEntries.find(e => !assigned.has(e.rosterId));
      if (general) {
        const pos = slotToWorld(slot, zoneCenter, deploymentZone);
        if (pos) {
          assignments.push({ rosterId: general.rosterId, worldX: pos.x, worldY: pos.y });
          assigned.add(general.rosterId);
        }
      }
      continue;
    }

    // Find unit of preferred category
    let unit = findUnassigned(available, slot.preferredCategory, assigned);

    // Fallback: infantry fills any melee slot, ranged fills ranged slots
    if (!unit) {
      if (slot.preferredCategory === UnitCategory.INFANTRY ||
          slot.preferredCategory === UnitCategory.CAVALRY) {
        unit = findUnassigned(available, UnitCategory.INFANTRY, assigned);
      }
      if (!unit && slot.preferredCategory === UnitCategory.RANGED) {
        unit = findUnassigned(available, UnitCategory.RANGED, assigned);
      }
      // Last resort: any available unit
      if (!unit) {
        for (const [, entries] of available) {
          const found = entries.find(e => !assigned.has(e.rosterId));
          if (found) { unit = found; break; }
        }
      }
    }

    if (unit) {
      const pos = slotToWorld(slot, zoneCenter, deploymentZone);
      if (pos) {
        assignments.push({ rosterId: unit.rosterId, worldX: pos.x, worldY: pos.y });
        assigned.add(unit.rosterId);
      }
    }
  }

  return assignments;
}

function findUnassigned(
  available: Map<UnitCategory, RosterEntry[]>,
  category: UnitCategory,
  assigned: Set<number>,
): RosterEntry | undefined {
  const entries = available.get(category);
  if (!entries) return undefined;
  return entries.find(e => !assigned.has(e.rosterId));
}

function slotToWorld(
  slot: FormationSlot,
  zoneCenter: { x: number; y: number },
  zone: DeploymentZone,
): { x: number; y: number } | null {
  const worldX = zoneCenter.x + slot.offsetX * TILE_SIZE;
  const worldY = zoneCenter.y + slot.offsetY * TILE_SIZE;

  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);

  if (zone.isValidPlacement(tileX, tileY)) {
    return { x: worldX, y: worldY };
  }

  // Find nearest valid tile
  return zone.findNearestValid(worldX, worldY);
}
