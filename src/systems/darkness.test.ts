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

  // Lumens now actively suppress darkness above a "this is a lot of light"
  // threshold (the design fix for "infinite light should be a felt
  // consequence, not just a research checkbox"). Below that threshold,
  // ordinary play is unaffected. Torch has no energy/fuel/exotic upkeep, so
  // its full count always counts toward totalLightOutput regardless of
  // power/exotic starvation - keeps these fixtures simple.
  test('modest light output does not erode darkness without research', () => {
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, torch: 1000 }, // 1,500 lumens, far below the 1e12 start
    };
    expect(computeDarkness(state)).toBe(1);
  });

  // Issue #4: lumen suppression is capped (never fully eliminates darkness on
  // its own) - so a player can no longer silently "solve" darkness, locking
  // out the Balance ending, just by building enough lights.
  test('light at or above the suppression ceiling caps darkness at 0.1, never zero, without research', () => {
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, torch: 700_000_000_000_000 }, // ~1.05e15 lumens
    };
    expect(computeDarkness(state)).toBeCloseTo(0.1, 5);
  });

  test('Preserve research counters lumen suppression: darkness rises well above the cap under full suppression', () => {
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, torch: 700_000_000_000_000 }, // ~1.05e15 lumens, full suppression
      research: ['darknessPreservation' as const, 'balancedUniverse' as const], // +0.3 + 0.5
    };
    // 1 - 0.9 (capped suppression) + 0.8 (research) = 0.9
    expect(computeDarkness(state)).toBeCloseTo(0.9, 5);
  });

  // Issue #4: Preserve research holds darkness at a floor (resistance)
  // instead of letting it drift below zero when deltas overshoot negative.
  test('Preserve research floors darkness even if other deltas and full suppression would drag it below zero', () => {
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, torch: 700_000_000_000_000 }, // full (capped) suppression
      research: [
        'eliminateShadows' as const,
        'illuminateOceans' as const,
        'illuminateNights' as const,
        'illuminateDeepSpace' as const,
        'blackHoleIllumination' as const, // -1 total
        'darknessPreservation' as const, // +0.3, also marks Preserve active
      ],
    };
    // raw = 1 - 0.9 (capped suppression) - 1 + 0.3 = -0.6 — would clamp to 0
    // without the Preserve floor, but Preserve research holds it at 0.3.
    expect(computeDarkness(state)).toBeCloseTo(0.3, 5);
  });

  test('lumen suppression scales smoothly between the start and full thresholds', () => {
    const state = {
      ...createInitialState(),
      // ~3.16e13 lumens: halfway (in log10) between 1e12 (start) and 1e15 (full)
      buildings: { ...createInitialState().buildings, torch: 21_080_000_000_000 },
    };
    const darkness = computeDarkness(state);
    expect(darkness).toBeGreaterThan(0.4);
    expect(darkness).toBeLessThan(0.6);
  });

  test('the Eliminate chain alone (no light) still reaches zero', () => {
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
