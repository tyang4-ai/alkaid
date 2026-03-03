import { UnitType, CAMPAIGN_RANDOM_EVENT_CHANCE } from '../../constants';
import type { CampaignState, RandomEventDefinition } from './CampaignTypes';
import { RANDOM_EVENT_DEFINITIONS } from './RandomEventDefinitions';
import { TerritoryManager } from './TerritoryManager';

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

export class RandomEventSystem {

  /** Roll for a random event. Returns event id or null. */
  rollForEvent(seed: number, turn: number, state: CampaignState): string | null {
    const rng = seededRng(seed + turn * 31);
    const roll = rng();
    if (roll >= CAMPAIGN_RANDOM_EVENT_CHANCE) return null;

    // Filter eligible events
    const eligible = RANDOM_EVENT_DEFINITIONS.filter(def => {
      if (def.condition && !def.condition(state)) return false;
      return true;
    });

    if (eligible.length === 0) return null;

    // Pick one using next random value
    const idx = Math.floor(rng() * eligible.length);
    return eligible[idx].id;
  }

  getDefinition(id: string): RandomEventDefinition | undefined {
    return RANDOM_EVENT_DEFINITIONS.find(def => def.id === id);
  }

  /** Apply a choice for an event. Returns outcome description. */
  applyChoice(
    eventId: string,
    choiceIndex: number,
    state: CampaignState,
    territoryManager?: TerritoryManager,
  ): string {
    switch (eventId) {
      case 'peasant_uprising':
        return this.applyPeasantUprising(choiceIndex, state, territoryManager);
      case 'defectors':
        return this.applyDefectors(choiceIndex, state);
      case 'supply_cache':
        return this.applySupplyCache(state);
      case 'disease':
        return this.applyDisease(choiceIndex, state);
      case 'rival_duel':
        return this.applyRivalDuel(choiceIndex, state);
      case 'merchant':
        return this.applyMerchant(choiceIndex, state);
      case 'storm':
        return this.applyStorm(state);
      case 'spy_report':
        return 'Enemy composition revealed for next battle.';
      case 'deserters':
        return this.applyDeserters(state);
      case 'alliance':
        return this.applyAlliance(choiceIndex, state, territoryManager);
      default:
        return 'Unknown event.';
    }
  }

  private applyPeasantUprising(choice: number, state: CampaignState, tm?: TerritoryManager): string {
    if (choice === 0) {
      // Suppress: pay 50 gold
      state.resources.gold = Math.max(0, state.resources.gold - 50);
      return 'You spent 50 gold to suppress the revolt. Order restored.';
    } else {
      // Abandon: lose a random player territory (not starting)
      if (tm) {
        const playerTerritories = tm.getPlayerTerritories()
          .filter(t => t.id !== state.startingTerritoryId);
        if (playerTerritories.length > 0) {
          const lostTerritory = playerTerritories[playerTerritories.length - 1];
          tm.loseTerritory(lostTerritory.id);
          state.territoriesConquered = Math.max(1, state.territoriesConquered - 1);
          return `${lostTerritory.name} (${lostTerritory.chineseName}) was lost to the uprising!`;
        }
      }
      return 'The revolt subsides on its own.';
    }
  }

  private applyDefectors(choice: number, state: CampaignState): string {
    if (choice === 0) {
      // Accept: gain troops, morale hit
      state.roster.squads.push({
        squadId: state.roster.nextSquadId++,
        type: UnitType.JI_HALBERDIERS,
        size: 30,
        maxSize: 120,
        experience: 40,
        morale: 60,
        fatigue: 0,
        trainingTurnsRemaining: 0,
        isCaptured: true,
        capturedEffectiveness: 0.5,
      });
      for (const squad of state.roster.squads) {
        if (!squad.isCaptured || squad.squadId !== state.roster.nextSquadId - 1) {
          squad.morale = Math.max(0, squad.morale - 10);
        }
      }
      return 'Defectors joined your army. Existing troops are uneasy (-10 morale).';
    }
    return 'You turned away the defectors.';
  }

  private applySupplyCache(state: CampaignState): string {
    state.resources.food += 50;
    return 'Found a hidden granary! +50 food.';
  }

  private applyDisease(choice: number, state: CampaignState): string {
    // Always lose 5%
    for (const squad of state.roster.squads) {
      const loss = Math.max(1, Math.floor(squad.size * 0.05));
      squad.size = Math.max(1, squad.size - loss);
    }
    if (choice === 0) {
      return 'Disease struck the camp. Squads lost 5% soldiers. Resting to prevent further spread.';
    }
    return 'Disease struck the camp. Squads lost 5% soldiers. Pushing on risks further losses.';
  }

  private applyRivalDuel(choice: number, state: CampaignState): string {
    if (choice === 0) {
      // 50/50 based on general experience
      const won = state.roster.generalExperience >= 50 || Math.random() < 0.5;
      if (won) {
        for (const squad of state.roster.squads) {
          squad.morale = Math.min(100, squad.morale + 20);
        }
        return 'Your general won the duel! +20 morale army-wide.';
      } else {
        for (const squad of state.roster.squads) {
          squad.morale = Math.max(0, squad.morale - 20);
        }
        return 'Your general lost the duel. -20 morale army-wide.';
      }
    }
    // Decline
    for (const squad of state.roster.squads) {
      squad.morale = Math.max(0, squad.morale - 5);
    }
    return 'You declined the challenge. -5 morale (seen as cowardly).';
  }

  private applyMerchant(choice: number, state: CampaignState): string {
    if (choice === 0 && state.resources.gold >= 200) {
      state.resources.gold -= 200;
      // Find strongest squad and boost exp
      const sortedByExp = [...state.roster.squads].sort((a, b) => b.experience - a.experience);
      if (sortedByExp.length > 0) {
        sortedByExp[0].experience = Math.min(100, sortedByExp[0].experience + 10);
        return `Purchased equipment for 200 gold. +10 exp to your strongest squad.`;
      }
    }
    return 'The merchant moves on.';
  }

  private applyStorm(state: CampaignState): string {
    state.resources.food = Math.max(0, state.resources.food - 30);
    for (const squad of state.roster.squads) {
      squad.fatigue = Math.min(100, squad.fatigue + 20);
    }
    return 'A severe storm damages camp. -30 food, +20 fatigue.';
  }

  private applyDeserters(state: CampaignState): string {
    // Remove lowest morale squad
    if (state.roster.squads.length === 0) return 'No squads to desert.';
    const sorted = [...state.roster.squads].sort((a, b) => a.morale - b.morale);
    const deserter = sorted[0];
    state.roster.squads = state.roster.squads.filter(s => s.squadId !== deserter.squadId);
    return `A squad of ${deserter.size} soldiers deserted due to low morale.`;
  }

  private applyAlliance(choice: number, state: CampaignState, tm?: TerritoryManager): string {
    if (choice === 0 && tm) {
      const attackable = tm.getAttackableFrom(tm.getPlayerTerritories().map(t => t.id));
      if (attackable.length > 0) {
        const ally = attackable[0];
        tm.captureTerritory(ally.id, state.turn);
        state.territoriesConquered++;
        return `${ally.name} (${ally.chineseName}) joined your cause peacefully!`;
      }
      return 'No adjacent territories available for alliance.';
    }
    return 'You refused the alliance offer.';
  }
}
