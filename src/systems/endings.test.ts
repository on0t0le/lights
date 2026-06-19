import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { resolveEnding } from './endings';

describe('resolveEnding', () => {
  test('stays null with a fresh game', () => {
    expect(resolveEnding(createInitialState()).ending).toBeNull();
  });

  // Issue #5/#10: Infinite Light is now a deliberate capstone research
  // purchase (Black Hole Illumination), not a passive darkness-zero
  // side-effect - darkness alone bottoming out (e.g. from a stray buff)
  // should never silently lock in an ending the player didn't choose.
  test('locks in Infinite Light once Black Hole Illumination is purchased', () => {
    const state = { ...createInitialState(), research: ['blackHoleIllumination' as const], darkness: 0 };
    expect(resolveEnding(state).ending).toBe('infiniteLight');
  });

  test('does not lock in Infinite Light from darkness alone, without the capstone research', () => {
    const state = { ...createInitialState(), darkness: 0 };
    expect(resolveEnding(state).ending).toBeNull();
  });

  test('locks in Balance once Balanced Universe research is purchased, even with darkness still nonzero', () => {
    const state = {
      ...createInitialState(),
      research: ['balancedUniverse' as const],
      darkness: 0.6,
    };
    expect(resolveEnding(state).ending).toBe('balance');
  });

  test('Balance wins over Infinite Light when both capstones are technically owned', () => {
    const state = {
      ...createInitialState(),
      research: ['balancedUniverse' as const, 'blackHoleIllumination' as const],
      darkness: 0,
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
    const state = { ...createInitialState(), research: ['blackHoleIllumination' as const], darkness: 0 };
    resolveEnding(state);
    expect(state.ending).toBeNull();
  });
});
