/**
 * SupplySystem — tracks food/supply levels per team.
 * Minimal implementation for surrender system dependency.
 * Full implementation will be expanded in Step 10.
 */

interface TeamSupply {
  food: number;    // current food units
  maxFood: number; // maximum food capacity
}

export class SupplySystem {
  private teams = new Map<number, TeamSupply>();

  /** Initialize army supply for a team. */
  initArmy(team: number, food: number, maxFood: number): void {
    this.teams.set(team, { food, maxFood });
  }

  /** Get food percentage for a team (0-100). */
  getFoodPercent(team: number): number {
    const supply = this.teams.get(team);
    if (!supply || supply.maxFood <= 0) return 100;
    return Math.max(0, Math.min(100, (supply.food / supply.maxFood) * 100));
  }

  /** Get food percentages for all teams. */
  getAllFoodPercents(): Map<number, number> {
    const result = new Map<number, number>();
    for (const [team] of this.teams) {
      result.set(team, this.getFoodPercent(team));
    }
    return result;
  }

  /** Set food for a team directly (for testing/debug). */
  setFood(team: number, food: number): void {
    const supply = this.teams.get(team);
    if (supply) {
      supply.food = Math.max(0, food);
    }
  }

  /** Tick supply consumption (placeholder for Step 10). */
  tick(): void {
    // Full implementation in Step 10
  }
}
