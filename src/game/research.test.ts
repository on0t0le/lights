import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import {
  availableResearch,
  buyResearch,
  researchCost,
  researchLumenMultiplier,
  isUnlockedByResearch,
  researchDarknessDelta,
  hasPreserveResearch,
} from './research';

describe('availableResearch', () => {
  test('Fire Making is available from the start', () => {
    const ids = availableResearch(createInitialState()).map((c) => c.id);
    expect(ids).toContain('fireMaking');
  });

  test('Oil Extraction is hidden until Fire Making is purchased, and until era 2 is reached', () => {
    const state = createInitialState();
    expect(availableResearch(state).map((c) => c.id)).not.toContain('oilExtraction');
    const withPrereq = { ...state, phase: 2, research: ['fireMaking' as const] };
    expect(availableResearch(withPrereq).map((c) => c.id)).toContain('oilExtraction');
  });

  test('already-purchased cards are not offered again', () => {
    const state = { ...createInitialState(), research: ['fireMaking' as const] };
    expect(availableResearch(state).map((c) => c.id)).not.toContain('fireMaking');
  });

  test('cards beyond the current era are never offered', () => {
    const state = createInitialState(); // era 1
    expect(availableResearch(state).map((c) => c.id)).not.toContain('oilExtraction'); // era 2
  });

  test('the endgame branch is hidden until era 15 and Universal Computation is purchased', () => {
    const state = { ...createInitialState(), phase: 15 };
    expect(availableResearch(state).map((c) => c.id)).not.toContain('eliminateShadows');
    const withPrereq = { ...state, research: ['universalComputation' as const] };
    expect(availableResearch(withPrereq).map((c) => c.id)).toContain('eliminateShadows');
  });
});

describe('buyResearch', () => {
  test('purchases a card when affordable, deducting lumens', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, lumens: 100 } };
    const next = buyResearch(state, 'fireMaking');
    expect(next.research).toContain('fireMaking');
    expect(next.resources.lumens).toBe(70); // 100 - 30 cost
  });

  test('does nothing when not affordable', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, lumens: 1 } };
    const next = buyResearch(state, 'fireMaking');
    expect(next).toEqual(state);
  });

  test('does nothing when not available (prereq missing)', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, lumens: 9999999 }, phase: 2 };
    const next = buyResearch(state, 'oilExtraction');
    expect(next).toEqual(state);
  });
});

// Issue #2: materials discount research cost, so the resource stays useful
// well past its original era-10+ megastructure-savings role.
describe('researchCost', () => {
  test('equals the card cost with no materials', () => {
    expect(researchCost(createInitialState(), 'fireMaking')).toBe(30);
  });

  test('is discounted by a log-scaled materials bonus', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, materials: 999 } };
    // 30 / (1 + 0.10 * log10(1 + 999)) = 30 / (1 + 0.10 * 3) = 30 / 1.3
    expect(researchCost(state, 'fireMaking')).toBeCloseTo(30 / 1.3, 5);
  });

  test('buyResearch spends the discounted cost, not the raw card cost', () => {
    const state = {
      ...createInitialState(),
      resources: { ...createInitialState().resources, lumens: 100, materials: 999 },
    };
    const next = buyResearch(state, 'fireMaking');
    expect(next.research).toContain('fireMaking');
    expect(next.resources.lumens).toBeCloseTo(100 - 30 / 1.3, 5);
  });
});

describe('hasPreserveResearch', () => {
  test('false with no research', () => {
    expect(hasPreserveResearch(createInitialState())).toBe(false);
  });

  test('true once any Preserve-branch card is purchased', () => {
    const state = { ...createInitialState(), research: ['darknessPreservation' as const] };
    expect(hasPreserveResearch(state)).toBe(true);
  });

  test('false when only Eliminate-branch cards are purchased', () => {
    const state = { ...createInitialState(), research: ['eliminateShadows' as const] };
    expect(hasPreserveResearch(state)).toBe(false);
  });
});

describe('researchLumenMultiplier', () => {
  test('is exactly 1 with no research', () => {
    expect(researchLumenMultiplier(createInitialState())).toBe(1);
  });

  test('multiplies in purchased cards', () => {
    const state = { ...createInitialState(), research: ['fireMaking' as const] };
    expect(researchLumenMultiplier(state)).toBeCloseTo(1.2);
  });

  test('compounds multiple purchased cards', () => {
    const state = { ...createInitialState(), research: ['fireMaking' as const, 'oilExtraction' as const] };
    expect(researchLumenMultiplier(state)).toBeCloseTo(1.2 * 1.18);
  });
});

describe('isUnlockedByResearch', () => {
  test('false when the unlocking card has not been purchased', () => {
    expect(isUnlockedByResearch(createInitialState(), 'torch')).toBe(false);
  });

  test('true once Fire Making is purchased', () => {
    const state = { ...createInitialState(), research: ['fireMaking' as const] };
    expect(isUnlockedByResearch(state, 'torch')).toBe(true);
  });

  test('Orbital Construction unlocks both Orbital Mirror and Space Elevator', () => {
    const state = { ...createInitialState(), research: ['orbitalConstruction' as const] };
    expect(isUnlockedByResearch(state, 'orbitalMirror')).toBe(true);
    expect(isUnlockedByResearch(state, 'spaceElevator')).toBe(true);
  });
});

describe('researchDarknessDelta', () => {
  test('is zero with no research', () => {
    expect(researchDarknessDelta(createInitialState())).toBe(0);
  });

  test('sums negative deltas from the Illuminate/eliminate chain', () => {
    const state = {
      ...createInitialState(),
      research: ['eliminateShadows' as const, 'illuminateOceans' as const],
    };
    expect(researchDarknessDelta(state)).toBeCloseTo(-0.4);
  });

  test('the full eliminate chain plus Black Hole Illumination sums to -1', () => {
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
    expect(researchDarknessDelta(state)).toBeCloseTo(-1);
  });

  test('Darkness Preservation and Balanced Universe restore darkness (positive delta)', () => {
    const state = {
      ...createInitialState(),
      research: ['darknessPreservation' as const, 'balancedUniverse' as const],
    };
    expect(researchDarknessDelta(state)).toBeCloseTo(0.8);
  });
});
