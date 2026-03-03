import { describe, it, expect } from 'vitest';
import { migrate, CURRENT_SAVE_VERSION } from '../MigrationChain';

describe('MigrationChain', () => {
  it('passes through current version unchanged', () => {
    const data = { version: CURRENT_SAVE_VERSION, timestamp: 1000, type: 'battle' };
    const result = migrate(data);
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.timestamp).toBe(1000);
  });

  it('throws on unknown future version', () => {
    const data = { version: '99.0.0', timestamp: 1000, type: 'battle' };
    expect(() => migrate(data)).toThrow();
  });

  it('defaults missing version to current version', () => {
    const data = { timestamp: 1000, type: 'battle' };
    const result = migrate(data);
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
  });
});
