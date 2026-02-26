import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState';

describe('GameState', () => {
  let state: GameState;
  beforeEach(() => {
    state = new GameState();
  });

  it('starts at tick 0', () => {
    expect(state.getState().tickNumber).toBe(0);
  });

  it('increments tick on tick()', () => {
    state.tick(50);
    state.tick(50);
    expect(state.getState().tickNumber).toBe(2);
  });

  it('increments battleTimeTicks on tick()', () => {
    state.tick(50);
    state.tick(50);
    state.tick(50);
    expect(state.getState().battleTimeTicks).toBe(3);
  });

  it('tracks pause state', () => {
    state.setPaused(true);
    expect(state.getState().paused).toBe(true);
    state.setPaused(false);
    expect(state.getState().paused).toBe(false);
  });

  it('tracks speed multiplier', () => {
    state.setSpeedMultiplier(2);
    expect(state.getState().speedMultiplier).toBe(2);
  });

  it('reset returns to initial state', () => {
    state.tick(50);
    state.tick(50);
    state.setPaused(true);
    state.setSpeedMultiplier(3);
    state.reset();
    expect(state.getState().tickNumber).toBe(0);
    expect(state.getState().paused).toBe(false);
    expect(state.getState().speedMultiplier).toBe(1);
    expect(state.getState().battleTimeTicks).toBe(0);
  });
});
