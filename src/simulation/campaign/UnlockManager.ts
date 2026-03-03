import { SAVE_UNLOCKS_KEY, UnitType } from '../../constants';
import type { UnlockState, UnlockDefinition } from './CampaignTypes';
import { UNLOCK_DEFINITIONS } from './UnlockDefinitions';

// Base unit types always available (no unlock needed)
const BASE_UNIT_TYPES: UnitType[] = [
  UnitType.JI_HALBERDIERS,
  UnitType.DAO_SWORDSMEN,
  UnitType.NU_CROSSBOWMEN,
  UnitType.SCOUTS,
];

export class UnlockManager {
  private state: UnlockState;

  constructor() {
    this.state = {
      totalPointsEarned: 0,
      totalPointsSpent: 0,
      unlockedIds: [],
    };
    this.load();
  }

  getPointsBalance(): number {
    return this.state.totalPointsEarned - this.state.totalPointsSpent;
  }

  isUnlocked(id: string): boolean {
    return this.state.unlockedIds.includes(id);
  }

  /** Get unlocks that are affordable, have prerequisites met, and aren't already purchased. */
  getAvailableUnlocks(): UnlockDefinition[] {
    const balance = this.getPointsBalance();
    return UNLOCK_DEFINITIONS.filter(def => {
      if (this.isUnlocked(def.id)) return false;
      if (def.cost > balance) return false;
      if (!def.prerequisiteIds.every(pid => this.isUnlocked(pid))) return false;
      return true;
    });
  }

  /** Get all unlocked unit types (base + unlocked). */
  getUnlockedUnitTypes(): UnitType[] {
    const types = [...BASE_UNIT_TYPES];
    for (const id of this.state.unlockedIds) {
      const def = UNLOCK_DEFINITIONS.find(d => d.id === id);
      if (def && def.effect.type === 'unit_unlock' && def.effect.unitType !== undefined) {
        types.push(def.effect.unitType);
      }
    }
    return types;
  }

  purchaseUnlock(id: string): boolean {
    const def = UNLOCK_DEFINITIONS.find(d => d.id === id);
    if (!def) return false;
    if (this.isUnlocked(id)) return false;
    if (def.cost > this.getPointsBalance()) return false;
    if (!def.prerequisiteIds.every(pid => this.isUnlocked(pid))) return false;

    this.state.totalPointsSpent += def.cost;
    this.state.unlockedIds.push(id);
    this.save();
    return true;
  }

  /** Add points from a completed run. Returns points earned. */
  addRunResult(result: {
    territoriesConquered: number;
    battlesWon: number;
    won: boolean;
    bonusObjectivesCompleted: number;
  }): number {
    const points =
      result.territoriesConquered * 10 +
      result.battlesWon * 5 +
      (result.won ? 50 : 0) +
      result.bonusObjectivesCompleted * 15;
    this.state.totalPointsEarned += points;
    this.save();
    return points;
  }

  // --- Starting condition helpers ---

  getStartingExp(): number {
    const warCollege = UNLOCK_DEFINITIONS.find(d => d.id === 'war_college');
    if (warCollege && this.isUnlocked('war_college') && warCollege.effect.value !== undefined) {
      return warCollege.effect.value;
    }
    return 0;
  }

  getArmySizeMultiplier(): number {
    const gs = UNLOCK_DEFINITIONS.find(d => d.id === 'grand_strategist');
    if (gs && this.isUnlocked('grand_strategist') && gs.effect.value !== undefined) {
      return gs.effect.value;
    }
    return 1.0;
  }

  getCommandDelayMultiplier(): number {
    const sm = UNLOCK_DEFINITIONS.find(d => d.id === 'swift_messengers');
    if (sm && this.isUnlocked('swift_messengers') && sm.effect.value !== undefined) {
      return sm.effect.value;
    }
    return 1.0;
  }

  getCommandRadiusMultiplier(): number {
    const db = UNLOCK_DEFINITIONS.find(d => d.id === 'dragon_banner');
    if (db && this.isUnlocked('dragon_banner') && db.effect.value !== undefined) {
      return db.effect.value;
    }
    return 1.0;
  }

  getRoutThresholdBonus(): number {
    const id = UNLOCK_DEFINITIONS.find(d => d.id === 'iron_discipline');
    if (id && this.isUnlocked('iron_discipline') && id.effect.value !== undefined) {
      return id.effect.value;
    }
    return 0;
  }

  // --- Persistence ---

  save(): void {
    try {
      localStorage.setItem(SAVE_UNLOCKS_KEY, JSON.stringify(this.state));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  }

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_UNLOCKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.totalPointsEarned === 'number') {
          this.state = parsed;
        }
      }
    } catch {
      // Corrupted data — use defaults
    }
  }

  /** Reset all unlock state (for testing). */
  reset(): void {
    this.state = {
      totalPointsEarned: 0,
      totalPointsSpent: 0,
      unlockedIds: [],
    };
    try {
      localStorage.removeItem(SAVE_UNLOCKS_KEY);
    } catch {
      // ignore
    }
  }

  getState(): UnlockState {
    return { ...this.state, unlockedIds: [...this.state.unlockedIds] };
  }

  getAllDefinitions(): UnlockDefinition[] {
    return UNLOCK_DEFINITIONS;
  }
}
