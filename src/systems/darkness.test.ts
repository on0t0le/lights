import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { computeDarkness, applyDarkness } from './darkness';

describe('computeDarkness', () => {
  test('is fully natural (1) with no research and no buildings', () => {
    expect(computeDarkness(createInitialState())).toBe(1);
  });

  test('decreases as Illuminate/Eliminate research is purchased', () => {
    const state = { ...createInitialState(), research: ['eliminateShadows' as const] };
    expect(computeDarkness(state)).toBeCloseTo(0.8);
  });

  test('reaches zero once the full eliminate chain plus Black Hole Illumination is purchased', () => {
    const state = {
      ...createInitialState(),
      research: [
        'eliminateShadows' as const,
        'illuminateOceans' as const,
        'illuminateNights' as const,
        'illuminateDeepSpace' as const,
        'blackHoleIllumination' as const,
      ],
    };
    expect(computeDarkness(state)).toBe(0);
  });

  test('never goes negative when research deltas overshoot', () => {
    const state = {
      ...createInitialState(),
      research: [
        'eliminateShadows' as const,
        'illuminateOceans' as const,
        'illuminateNights' as const,
        'illuminateDeepSpace' as const,
        'blackHoleIllumination' as const,
      ],
      buildings: { ...createInitialState().buildings, stellarMirror: 1000 },
    };
    expect(computeDarkness(state)).toBe(0);
  });

  test('Darkness Preservation and Balanced Universe restore darkness back up, capped at 1', () => {
    const state = {
      ...createInitialState(),
      research: ['darknessPreservation' as const, 'balancedUniverse' as const],
    };
    expect(computeDarkness(state)).toBe(1);
  });

  test('extreme light alone erodes darkness even without research', () => {
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, stellarMirror: 1000, whiteDwarfReactor: 1000 },
    };
    expect(computeDarkness(state)).toBeLessThan(1);
  });
});

describe('applyDarkness', () => {
  test('writes computeDarkness onto state.darkness', () => {
    const state = { ...createInitialState(), research: ['eliminateShadows' as const] };
    expect(applyDarkness(state).darkness).toBeCloseTo(0.8);
  });

  test('does not mutate the original state', () => {
    const state = { ...createInitialState(), research: ['eliminateShadows' as const] };
    applyDarkness(state);
    expect(state.darkness).toBe(1);
  });
});
