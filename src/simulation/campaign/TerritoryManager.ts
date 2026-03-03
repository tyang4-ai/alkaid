import { TERRITORY_RESOURCE_GENERATION } from '../../constants';
import type { Territory, Resources } from './CampaignTypes';
import { STARTING_TERRITORY_IDS } from './TerritoryGraph';

export class TerritoryManager {
  private territories: Map<string, Territory>;

  constructor(territories: Territory[]) {
    this.territories = new Map();
    for (const t of territories) {
      this.territories.set(t.id, t);
    }
  }

  get(id: string): Territory | undefined {
    return this.territories.get(id);
  }

  getAll(): Territory[] {
    return Array.from(this.territories.values());
  }

  getAdjacentTo(id: string): Territory[] {
    const territory = this.territories.get(id);
    if (!territory) return [];
    return territory.adjacentIds
      .map(adjId => this.territories.get(adjId))
      .filter((t): t is Territory => t !== undefined);
  }

  /** Get enemy territories adjacent to any player-owned territory. */
  getAttackableFrom(playerIds: string[]): Territory[] {
    const attackable = new Set<string>();
    for (const pid of playerIds) {
      const territory = this.territories.get(pid);
      if (!territory || territory.owner !== 'player') continue;
      for (const adjId of territory.adjacentIds) {
        const adj = this.territories.get(adjId);
        if (adj && adj.owner === 'enemy') {
          attackable.add(adjId);
        }
      }
    }
    return Array.from(attackable)
      .map(id => this.territories.get(id)!)
      .filter(Boolean);
  }

  getPlayerTerritories(): Territory[] {
    return this.getAll().filter(t => t.owner === 'player');
  }

  /** BFS shortest distance (in hops) between two territories. Returns -1 if unreachable. */
  getDistance(fromId: string, toId: string): number {
    if (fromId === toId) return 0;
    if (!this.territories.has(fromId) || !this.territories.has(toId)) return -1;

    const visited = new Set<string>();
    const queue: Array<{ id: string; dist: number }> = [{ id: fromId, dist: 0 }];
    visited.add(fromId);

    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;
      const territory = this.territories.get(id)!;
      for (const adjId of territory.adjacentIds) {
        if (adjId === toId) return dist + 1;
        if (!visited.has(adjId)) {
          visited.add(adjId);
          queue.push({ id: adjId, dist: dist + 1 });
        }
      }
    }
    return -1;
  }

  /** Sum resource generation from all player-owned territories. */
  calculateResourceIncome(playerIds: string[]): Resources {
    const income: Resources = { gold: 0, population: 0, horses: 0, iron: 0, food: 0 };
    for (const id of playerIds) {
      const territory = this.territories.get(id);
      if (!territory || territory.owner !== 'player') continue;
      const gen = TERRITORY_RESOURCE_GENERATION[territory.type];
      if (gen) {
        income.gold += gen.gold;
        income.population += gen.population;
        income.horses += gen.horses;
        income.iron += gen.iron;
        income.food += gen.food;
      }
    }
    return income;
  }

  captureTerritory(id: string, turn: number): void {
    const territory = this.territories.get(id);
    if (territory) {
      territory.owner = 'player';
      territory.conqueredTurn = turn;
    }
  }

  loseTerritory(id: string): void {
    const territory = this.territories.get(id);
    if (territory) {
      territory.owner = 'enemy';
      territory.conqueredTurn = null;
    }
  }

  getStartingCandidates(): Territory[] {
    return STARTING_TERRITORY_IDS
      .map(id => this.territories.get(id))
      .filter((t): t is Territory => t !== undefined);
  }

  /** Replace all territories (used during deserialization). */
  replaceAll(territories: Territory[]): void {
    this.territories.clear();
    for (const t of territories) {
      this.territories.set(t.id, t);
    }
  }
}
