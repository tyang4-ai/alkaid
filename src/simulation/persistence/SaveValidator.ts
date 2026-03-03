export class SaveValidator {
  static validate(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Save data must be a non-null object'] };
    }

    const obj = data as Record<string, unknown>;

    // Required top-level fields
    if (typeof obj.version !== 'string') {
      errors.push('Missing or invalid "version" (expected string)');
    }
    if (typeof obj.timestamp !== 'number') {
      errors.push('Missing or invalid "timestamp" (expected number)');
    }
    if (obj.type !== 'battle' && obj.type !== 'campaign') {
      errors.push('Missing or invalid "type" (expected "battle" or "campaign")');
    }

    // Meta validation
    if (!obj.meta || typeof obj.meta !== 'object') {
      errors.push('Missing or invalid "meta" object');
    }

    // Type-specific validation
    if (obj.type === 'battle') {
      if (!obj.battle || typeof obj.battle !== 'object') {
        errors.push('Missing "battle" data for type=battle');
      } else {
        const battle = obj.battle as Record<string, unknown>;
        if (typeof battle.terrainSeed !== 'number') {
          errors.push('battle.terrainSeed must be a number');
        }
        if (typeof battle.templateId !== 'string') {
          errors.push('battle.templateId must be a string');
        }
        if (!battle.gameState || typeof battle.gameState !== 'object') {
          errors.push('battle.gameState must be an object');
        }
        if (!Array.isArray(battle.units)) {
          errors.push('battle.units must be an array');
        }
      }
    }

    if (obj.type === 'campaign') {
      if (!obj.campaign || typeof obj.campaign !== 'object') {
        errors.push('Missing "campaign" data for type=campaign');
      } else {
        const campaign = obj.campaign as Record<string, unknown>;
        if (!campaign.campaignState || typeof campaign.campaignState !== 'object') {
          errors.push('campaign.campaignState must be an object');
        } else {
          const cs = campaign.campaignState as Record<string, unknown>;
          if (typeof cs.runId !== 'string') errors.push('campaign.campaignState.runId must be a string');
          if (typeof cs.seed !== 'number') errors.push('campaign.campaignState.seed must be a number');
          if (typeof cs.turn !== 'number') errors.push('campaign.campaignState.turn must be a number');
          if (!Array.isArray(cs.territories)) errors.push('campaign.campaignState.territories must be an array');
          if (!cs.roster || typeof cs.roster !== 'object') errors.push('campaign.campaignState.roster must be an object');
          if (!cs.resources || typeof cs.resources !== 'object') errors.push('campaign.campaignState.resources must be an object');
        }
        if (typeof campaign.wasLoaded !== 'boolean') {
          errors.push('campaign.wasLoaded must be a boolean');
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
