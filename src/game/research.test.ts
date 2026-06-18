import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import {
  availableResearch,
  buyResearch,
  researchLumenMultiplier,
  isUnlockedByResearch,
  researchDarknessDelta,
} from './research';

describe('availableResearch', () => {
  test('Candle Making is available from the start', () => {
    const ids = availableResearch(createInitialState()).map((c) => c.id);
    expect(ids).toContain('candleMaking');
  });

  test('Street Electricity is hidden until Candle Making is purchased', () => {
    const state = createInitialState();
    expect(availableResearch(state).map((c) => c.id)).not.toContain('streetElectricity');
    const withPrereq = { ...state, research: ['candleMaking' as const] };
    expect(availableResearch(withPrereq).map((c) => c.id)).toContain('streetElectricity');
  });

  test('already-purchased cards are not offered again', () => {
    const state = { ...createInitialState(), research: ['candleMaking' as const] };
    expect(availableResearch(state).map((c) => c.id)).not.toContain('candleMaking');
  });

  test('cards beyond the current phase are never offered', () => {
    const state = createInitialState(); // phase 1
    expect(availableResearch(state).map((c) => c.id)).not.toContain('leds'); // phase 2
  });

  test('Fusion Power and Artificial Sleep are hidden until Phase 3, then appear once LEDs is purchased', () => {
    const state = { ...createInitialState(), phase: 3 as const };
    expect(availableResearch(state).map((c) => c.id)).not.toContain('fusionPower');
    const withPrereq = { ...state, research: ['candleMaking' as const, 'streetElectricity' as const, 'leds' as const] };
    expect(availableResearch(withPrereq).map((c) => c.id)).toContain('fusionPower');
    expect(availableResearch(withPrereq).map((c) => c.id)).toContain('artificialSleep');
  });

  test('Orbital Mirrors is hidden until Fusion Power is purchased', () => {
    const state = {
      ...createInitialState(),
      phase: 3 as const,
      research: ['candleMaking' as const, 'streetElectricity' as const, 'leds' as const],
    };
    expect(availableResearch(state).map((c) => c.id)).not.toContain('orbitalMirrors');
    const withPrereq = { ...state, research: [...state.research, 'fusionPower' as const] };
    expect(availableResearch(withPrereq).map((c) => c.id)).toContain('orbitalMirrors');
  });
});

describe('buyResearch', () => {
  test('purchases a card when affordable, deducting lumens', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, lumens: 100 } };
    const next = buyResearch(state, 'candleMaking');
    expect(next.research).toContain('candleMaking');
    expect(next.resources.lumens).toBe(60); // 100 - 40 cost
  });

  test('does nothing when not affordable', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, lumens: 1 } };
    const next = buyResearch(state, 'candleMaking');
    expect(next).toEqual(state);
  });

  test('does nothing when not available (prereq missing)', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, lumens: 9999 } };
    const next = buyResearch(state, 'streetElectricity');
    expect(next).toEqual(state);
  });
});

describe('researchLumenMultiplier', () => {
  test('is exactly 1 with no research', () => {
    expect(researchLumenMultiplier(createInitialState())).toBe(1);
  });

  test('multiplies in purchased cards', () => {
    const state = { ...createInitialState(), research: ['candleMaking' as const] };
    expect(researchLumenMultiplier(state)).toBeCloseTo(1.2);
  });

  test('compounds multiple purchased cards', () => {
    const state = { ...createInitialState(), research: ['candleMaking' as const, 'streetElectricity' as const] };
    expect(researchLumenMultiplier(state)).toBeCloseTo(1.2 * 1.15);
  });
});

describe('isUnlockedByResearch', () => {
  test('false when the unlocking card has not been purchased', () => {
    expect(isUnlockedByResearch(createInitialState(), 'streetlamp')).toBe(false);
  });

  test('true once Street Electricity is purchased', () => {
    const state = { ...createInitialState(), research: ['streetElectricity' as const] };
    expect(isUnlockedByResearch(state, 'streetlamp')).toBe(true);
  });

  test('Fusion Power unlocks Fusion Reactor; Orbital Mirrors unlocks Orbital Mirror', () => {
    expect(isUnlockedByResearch({ ...createInitialState(), research: ['fusionPower' as const] }, 'fusionReactor')).toBe(
      true
    );
    expect(
      isUnlockedByResearch({ ...createInitialState(), research: ['orbitalMirrors' as const] }, 'orbitalMirror')
    ).toBe(true);
  });

  test('Dyson Swarms unlocks both White Dwarf Reactor and Stellar Mirror', () => {
    const state = { ...createInitialState(), research: ['dysonSwarms' as const] };
    expect(isUnlockedByResearch(state, 'whiteDwarfReactor')).toBe(true);
    expect(isUnlockedByResearch(state, 'stellarMirror')).toBe(true);
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
