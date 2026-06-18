import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { resolveEnding } from './endings';

describe('resolveEnding', () => {
  test('stays null with a fresh game', () => {
    expect(resolveEnding(createInitialState()).ending).toBeNull();
  });

  test('locks in Infinite Light once darkness and contrast both bottom out', () => {
    const state = {
      ...createInitialState(),
      darkness: 0,
      resources: { ...createInitialState().resources, contrast: 0 },
    };
    expect(resolveEnding(state).ending).toBe('infiniteLight');
  });

  test('does not lock in Infinite Light if only darkness is zero', () => {
    const state = {
      ...createInitialState(),
      darkness: 0,
      resources: { ...createInitialState().resources, contrast: 0.1 },
    };
    expect(resolveEnding(state).ending).toBeNull();
  });

  test('locks in Balance once Balanced Universe research is purchased, even with darkness/contrast still nonzero', () => {
    const state = {
      ...createInitialState(),
      research: ['balancedUniverse' as const],
      darkness: 0.6,
      resources: { ...createInitialState().resources, contrast: 0.3 },
    };
    expect(resolveEnding(state).ending).toBe('balance');
  });

  test('Balance wins over Infinite Light when both conditions are technically met', () => {
    const state = {
      ...createInitialState(),
      research: ['balancedUniverse' as const],
      darkness: 0,
      resources: { ...createInitialState().resources, contrast: 0 },
    };
    expect(resolveEnding(state).ending).toBe('balance');
  });

  test('is sticky: does not change once an ending is already set', () => {
    const state = {
      ...createInitialState(),
      ending: 'infiniteLight' as const,
      research: ['balancedUniverse' as const],
    };
    expect(resolveEnding(state).ending).toBe('infiniteLight');
  });

  test('does not mutate the original state', () => {
    const state = {
      ...createInitialState(),
      darkness: 0,
      resources: { ...createInitialState().resources, contrast: 0 },
    };
    resolveEnding(state);
    expect(state.ending).toBeNull();
  });
});
