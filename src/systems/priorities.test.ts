import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import {
  lumenPriorityMultiplier,
  happinessPriorityBonus,
  energyPriorityMultiplier,
  contrastPriorityBonus,
  wonderPriorityMultiplier,
} from './priorities';

describe('lumenPriorityMultiplier', () => {
  test('is exactly 1 at the neutral default (0.5)', () => {
    expect(lumenPriorityMultiplier(createInitialState())).toBe(1);
  });

  test('rises above 1 as the lumens slider increases', () => {
    const state = { ...createInitialState(), priorities: { ...createInitialState().priorities, lumens: 1 } };
    expect(lumenPriorityMultiplier(state)).toBeGreaterThan(1);
  });

  test('drops below 1 as the lumens slider decreases', () => {
    const state = { ...createInitialState(), priorities: { ...createInitialState().priorities, lumens: 0 } };
    expect(lumenPriorityMultiplier(state)).toBeLessThan(1);
  });
});

describe('happinessPriorityBonus', () => {
  test('is exactly 0 at the neutral default (0.5)', () => {
    expect(happinessPriorityBonus(createInitialState())).toBe(0);
  });

  test('rises above 0 as the happiness slider increases', () => {
    const state = { ...createInitialState(), priorities: { ...createInitialState().priorities, happiness: 1 } };
    expect(happinessPriorityBonus(state)).toBeGreaterThan(0);
  });

  test('stays capped (never sends happiness above a small bonus)', () => {
    const state = { ...createInitialState(), priorities: { ...createInitialState().priorities, happiness: 1 } };
    expect(happinessPriorityBonus(state)).toBeLessThanOrEqual(0.2);
  });
});

describe('energyPriorityMultiplier', () => {
  test('is exactly 1 at the neutral default (0.5)', () => {
    expect(energyPriorityMultiplier(createInitialState())).toBe(1);
  });

  test('rises above 1 as the energy slider increases', () => {
    const state = { ...createInitialState(), priorities: { ...createInitialState().priorities, energy: 1 } };
    expect(energyPriorityMultiplier(state)).toBeGreaterThan(1);
  });
});

describe('contrastPriorityBonus', () => {
  test('is exactly 0 at the neutral default (0.5)', () => {
    expect(contrastPriorityBonus(createInitialState())).toBe(0);
  });

  test('rises above 0 as the contrast slider increases', () => {
    const state = { ...createInitialState(), priorities: { ...createInitialState().priorities, contrast: 1 } };
    expect(contrastPriorityBonus(state)).toBeGreaterThan(0);
  });
});

describe('wonderPriorityMultiplier', () => {
  test('is exactly 1 at the neutral default (0.5)', () => {
    expect(wonderPriorityMultiplier(createInitialState())).toBe(1);
  });

  test('rises above 1 as the wonder slider increases', () => {
    const state = { ...createInitialState(), priorities: { ...createInitialState().priorities, wonder: 1 } };
    expect(wonderPriorityMultiplier(state)).toBeGreaterThan(1);
  });
});
