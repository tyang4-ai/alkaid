/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { BattleResult } from '../BattleEndOverlay';

let parentElement: HTMLDivElement;
let BattleEndOverlay: typeof import('../BattleEndOverlay').BattleEndOverlay;

beforeEach(async () => {
  parentElement = document.createElement('div');
  document.body.appendChild(parentElement);
  const mod = await import('../BattleEndOverlay');
  BattleEndOverlay = mod.BattleEndOverlay;
});

function makeResult(overrides: Partial<BattleResult> = {}): BattleResult {
  return {
    winnerTeam: 0,
    playerTeam: 0,
    victoryType: 0,
    playerCasualties: 50,
    playerStarting: 200,
    enemyCasualties: 180,
    enemyStarting: 200,
    durationTicks: 1000,
    ...overrides,
  };
}

describe('BattleEndOverlay', () => {
  it('overlay hidden initially (isVisible is false, pointer-events none)', () => {
    const overlay = new BattleEndOverlay(parentElement);
    const el = parentElement.querySelector('.battle-end-overlay') as HTMLDivElement;
    expect(el).not.toBeNull();
    expect(overlay.isVisible).toBe(false);
    // After show(), isVisible should be true
    overlay.show(makeResult());
    expect(overlay.isVisible).toBe(true);
    overlay.destroy();
  });

  it('shows victory text on win', () => {
    const overlay = new BattleEndOverlay(parentElement);
    overlay.show(makeResult({ winnerTeam: 0, playerTeam: 0 }));

    const el = parentElement.querySelector('.battle-end-overlay') as HTMLDivElement;
    expect(el.style.opacity).toBe('1');
    expect(overlay.isVisible).toBe(true);
    // Check for Chinese victory text (大勝)
    expect(el.innerHTML).toContain('\u5927\u52DD');
    expect(el.innerHTML).toContain('VICTORY');
    overlay.destroy();
  });

  it('shows defeat text on loss', () => {
    const overlay = new BattleEndOverlay(parentElement);
    overlay.show(makeResult({ winnerTeam: 1, playerTeam: 0 }));

    const el = parentElement.querySelector('.battle-end-overlay') as HTMLDivElement;
    // Check for Chinese defeat text (敗)
    expect(el.innerHTML).toContain('\u6557');
    expect(el.innerHTML).toContain('DEFEAT');
    overlay.destroy();
  });

  it('continue button exists', () => {
    const overlay = new BattleEndOverlay(parentElement);
    overlay.show(makeResult());

    const btn = parentElement.querySelector('.battle-end-continue');
    expect(btn).not.toBeNull();
    expect(btn?.tagName).toBe('BUTTON');
    overlay.destroy();
  });
});
