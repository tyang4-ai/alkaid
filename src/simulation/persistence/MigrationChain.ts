export const CURRENT_SAVE_VERSION = '1.1.0';

const KNOWN_VERSIONS = new Set(['1.0.0', '1.1.0']);

export function migrate(data: Record<string, unknown>): Record<string, unknown> {
  // Default missing version to current
  if (!data.version) {
    data.version = CURRENT_SAVE_VERSION;
  }

  const version = data.version as string;

  if (!KNOWN_VERSIONS.has(version)) {
    throw new Error(
      `Unknown save version "${version}". Known versions: ${[...KNOWN_VERSIONS].join(', ')}. ` +
      `This save may be from a newer version of the game.`,
    );
  }

  // Version migration chain
  if (version === '1.0.0') {
    // v1.0.0 → v1.1.0: Add campaign save support
    // Old battle-only saves don't need campaign data, just bump version
    if (data.type === 'campaign' && data.campaign) {
      const campaign = data.campaign as Record<string, unknown>;
      if (campaign.wasLoaded === undefined) {
        campaign.wasLoaded = false;
      }
    }
    data.version = '1.1.0';
  }

  return data;
}
