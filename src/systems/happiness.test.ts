import { describe, expect, test } from 'vitest';
import { computeHappiness, BASE_HAPPINESS, applyHappiness } from './happiness';
import { createInitialState } from '../state';

describe('computeHappiness', () => {
  test('baseline with no buildings and no events is BASE_HAPPINESS', () => {
    expect(computeHappiness(createInitialState())).toBe(BASE_HAPPINESS);
  });

  test('gentle lights (positive happinessPerUnit) raise happiness above baseline', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, candle: 10 } };
    expect(computeHappiness(state)).toBeGreaterThan(BASE_HAPPINESS);
  });

  test('a power plant (negative happinessPerUnit) lowers happiness below baseline', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, powerPlant: 5 } };
    expect(computeHappiness(state)).toBeLessThan(BASE_HAPPINESS);
  });

  test('harsh lights lower happiness too, not just power plants', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, gasLamp: 5 } };
    expect(computeHappiness(state)).toBeLessThan(BASE_HAPPINESS);
  });

  test('clamps at 0 with enough negative-happiness buildings', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, powerPlant: 1000 } };
    expect(computeHappiness(state)).toBe(0);
  });

  test('clamps at 1 with enough positive-happiness buildings', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, campfire: 1000 } };
    expect(computeHappiness(state)).toBe(1);
  });

  test('an active Bird Migration Disrupted event reduces happiness', () => {
    const state = { ...createInitialState(), activeEvent: { id: 'birdMigration' as const, ticksRemaining: 5 } };
    const baseline = createInitialState();
    expect(computeHappiness(state)).toBeLessThan(computeHappiness(baseline));
  });

  test('Artificial Sleep research softens (but does not remove) negative building contributions', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, powerPlant: 5 } };
    const withResearch = { ...state, research: ['artificialSleep' as const] };
    const baselineHappiness = computeHappiness(createInitialState());
    expect(computeHappiness(withResearch)).toBeGreaterThan(computeHappiness(state));
    expect(computeHappiness(withResearch)).toBeLessThan(baselineHappiness);
  });

  test('Artificial Sleep does not affect positive contributions', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, candle: 10 } };
    const withResearch = { ...state, research: ['artificialSleep' as const] };
    expect(computeHappiness(withResearch)).toBe(computeHappiness(state));
  });
});

describe('applyHappiness', () => {
  test('writes computeHappiness into resources.happiness', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, candle: 10 } };
    const next = applyHappiness(state);
    expect(next.resources.happiness).toBe(computeHappiness(state));
  });
});
