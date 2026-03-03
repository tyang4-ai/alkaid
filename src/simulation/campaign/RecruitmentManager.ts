import {
  UnitType, UnitCategory, UNIT_TYPE_CONFIGS, RECRUITMENT_COSTS,
  CAMPAIGN_MAX_SQUADS, CAMPAIGN_MAX_SIEGE, CAMPAIGN_MAX_CAVALRY,
  CAMPAIGN_MAX_ELITE_GUARD, CAMPAIGN_REINFORCE_COST_MULT,
} from '../../constants';
import type { CampaignSquad, Resources, ArmyRoster, CampaignState } from './CampaignTypes';

export interface CanResult {
  allowed: boolean;
  reason?: string;
}

export class RecruitmentManager {

  canRecruit(
    type: UnitType,
    resources: Resources,
    roster: ArmyRoster,
    unlockedTypes: UnitType[],
  ): CanResult {
    if (!unlockedTypes.includes(type)) {
      return { allowed: false, reason: 'Unit type not unlocked' };
    }

    const limits = this.checkArmyLimits(roster, type);
    if (!limits.valid) {
      return { allowed: false, reason: limits.violations[0] };
    }

    const cost = RECRUITMENT_COSTS[type];
    if (!cost) return { allowed: false, reason: 'Unknown unit type' };

    if (resources.gold < cost.gold) return { allowed: false, reason: 'Not enough gold' };
    if (resources.population < cost.population) return { allowed: false, reason: 'Not enough population' };
    if (resources.horses < cost.horses) return { allowed: false, reason: 'Not enough horses' };
    if (resources.iron < cost.iron) return { allowed: false, reason: 'Not enough iron' };

    return { allowed: true };
  }

  recruit(type: UnitType, state: CampaignState, unlockedTypes: UnitType[]): CampaignSquad | null {
    const check = this.canRecruit(type, state.resources, state.roster, unlockedTypes);
    if (!check.allowed) return null;

    const cost = RECRUITMENT_COSTS[type];
    state.resources.gold -= cost.gold;
    state.resources.population -= cost.population;
    state.resources.horses -= cost.horses;
    state.resources.iron -= cost.iron;

    const config = UNIT_TYPE_CONFIGS[type];
    const squad: CampaignSquad = {
      squadId: state.roster.nextSquadId++,
      type,
      size: config.maxSize,
      maxSize: config.maxSize,
      experience: 0,
      morale: 70,
      fatigue: 0,
      trainingTurnsRemaining: cost.trainingTurns,
      isCaptured: false,
      capturedEffectiveness: 1.0,
    };

    state.roster.squads.push(squad);
    return squad;
  }

  canReinforce(squad: CampaignSquad, resources: Resources): CanResult {
    if (squad.size >= squad.maxSize) {
      return { allowed: false, reason: 'Squad already at full strength' };
    }
    if (squad.trainingTurnsRemaining > 0) {
      return { allowed: false, reason: 'Squad still in training' };
    }

    const cost = RECRUITMENT_COSTS[squad.type];
    if (!cost) return { allowed: false, reason: 'Unknown unit type' };

    const reinforceGold = Math.ceil(cost.gold * CAMPAIGN_REINFORCE_COST_MULT);
    if (resources.gold < reinforceGold) return { allowed: false, reason: 'Not enough gold' };

    const soldiersNeeded = squad.maxSize - squad.size;
    if (resources.population < soldiersNeeded) return { allowed: false, reason: 'Not enough population' };

    return { allowed: true };
  }

  reinforce(squad: CampaignSquad, resources: Resources): { updatedSquad: CampaignSquad; cost: Resources } | null {
    const check = this.canReinforce(squad, resources);
    if (!check.allowed) return null;

    const recruitCost = RECRUITMENT_COSTS[squad.type];
    const reinforceGold = Math.ceil(recruitCost.gold * CAMPAIGN_REINFORCE_COST_MULT);
    const soldiersAdded = squad.maxSize - squad.size;

    // Exp dilution: newExp = (currentSize * currentExp + addedSoldiers * 0) / newSize
    const newExp = RecruitmentManager.calcReinforcedExp(squad.size, squad.experience, soldiersAdded);

    const cost: Resources = {
      gold: reinforceGold,
      population: soldiersAdded,
      horses: 0,
      iron: 0,
      food: 0,
    };

    resources.gold -= cost.gold;
    resources.population -= cost.population;

    squad.size = squad.maxSize;
    squad.experience = newExp;

    return { updatedSquad: squad, cost };
  }

  canPromote(squad: CampaignSquad, resources: Resources, roster: ArmyRoster): CanResult {
    if (squad.experience < 80) {
      return { allowed: false, reason: 'Requires experience >= 80' };
    }
    if (squad.type === UnitType.ELITE_GUARD) {
      return { allowed: false, reason: 'Already Elite Guard' };
    }
    if (resources.gold < 400) return { allowed: false, reason: 'Not enough gold (need 400)' };
    if (resources.iron < 15) return { allowed: false, reason: 'Not enough iron (need 15)' };

    // Check elite guard limit
    const eliteCount = roster.squads.filter(s => s.type === UnitType.ELITE_GUARD).length;
    if (eliteCount >= CAMPAIGN_MAX_ELITE_GUARD) {
      return { allowed: false, reason: 'Maximum Elite Guard squads reached' };
    }

    return { allowed: true };
  }

  promote(squad: CampaignSquad, resources: Resources): { updatedSquad: CampaignSquad; cost: Resources } | null {
    // Note: canPromote should be checked before calling this
    const cost: Resources = { gold: 400, population: 0, horses: 0, iron: 15, food: 0 };

    resources.gold -= cost.gold;
    resources.iron -= cost.iron;

    squad.type = UnitType.ELITE_GUARD;
    squad.maxSize = UNIT_TYPE_CONFIGS[UnitType.ELITE_GUARD].maxSize;
    if (squad.size > squad.maxSize) squad.size = squad.maxSize;
    squad.morale = 85;

    return { updatedSquad: squad, cost };
  }

  dismiss(squad: CampaignSquad): { goldRecovered: number } {
    const recruitCost = RECRUITMENT_COSTS[squad.type];
    const goldRecovered = recruitCost ? Math.floor(recruitCost.gold * 0.25) : 0;
    return { goldRecovered };
  }

  restArmy(roster: ArmyRoster): void {
    for (const squad of roster.squads) {
      squad.fatigue = 0;
      squad.morale = squad.type === UnitType.ELITE_GUARD ? 85 : 70;
    }
  }

  checkArmyLimits(roster: ArmyRoster, addingType?: UnitType): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    let totalSquads = roster.squads.length;
    let siegeCount = roster.squads.filter(s => UNIT_TYPE_CONFIGS[s.type].category === UnitCategory.SIEGE).length;
    let cavCount = roster.squads.filter(s => UNIT_TYPE_CONFIGS[s.type].category === UnitCategory.CAVALRY).length;
    let eliteCount = roster.squads.filter(s => s.type === UnitType.ELITE_GUARD).length;

    if (addingType !== undefined) {
      totalSquads++;
      const config = UNIT_TYPE_CONFIGS[addingType];
      if (config.category === UnitCategory.SIEGE) siegeCount++;
      if (config.category === UnitCategory.CAVALRY) cavCount++;
      if (addingType === UnitType.ELITE_GUARD) eliteCount++;
    }

    if (totalSquads > CAMPAIGN_MAX_SQUADS) violations.push(`Maximum ${CAMPAIGN_MAX_SQUADS} squads`);
    if (siegeCount > CAMPAIGN_MAX_SIEGE) violations.push(`Maximum ${CAMPAIGN_MAX_SIEGE} siege squads`);
    if (cavCount > CAMPAIGN_MAX_CAVALRY) violations.push(`Maximum ${CAMPAIGN_MAX_CAVALRY} cavalry squads`);
    if (eliteCount > CAMPAIGN_MAX_ELITE_GUARD) violations.push(`Maximum ${CAMPAIGN_MAX_ELITE_GUARD} Elite Guard squad`);

    return { valid: violations.length === 0, violations };
  }

  static calcReinforcedExp(currentSize: number, currentExp: number, addedSoldiers: number): number {
    const newSize = currentSize + addedSoldiers;
    if (newSize === 0) return 0;
    return Math.floor((currentSize * currentExp) / newSize);
  }
}
