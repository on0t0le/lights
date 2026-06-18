import { describe, expect, test } from 'vitest';
import { addResource, spendResource, canAfford } from './resources';
import { createInitialState } from '../state';

describe('addResource', () => {
  test('increases the named resource by the given amount', () => {
    const state = createInitialState();
    const next = addResource(state, 'lumens', 5);
    expect(next.resources.lumens).toBe(state.resources.lumens + 5);
  });

  test('does not mutate the original state', () => {
    const state = createInitialState();
    const before = state.resources.lumens;
    addResource(state, 'lumens', 5);
    expect(state.resources.lumens).toBe(before);
  });
});

describe('spendResource', () => {
  test('decreases the named resource by the given amount', () => {
    const state = addResource(createInitialState(), 'lumens', 10);
    const next = spendResource(state, 'lumens', 4);
    expect(next.resources.lumens).toBe(state.resources.lumens - 4);
  });

  test('clamps at zero, never goes negative', () => {
    const state = addResource(createInitialState(), 'lumens', 3);
    const next = spendResource(state, 'lumens', 10);
    expect(next.resources.lumens).toBe(0);
  });
});

describe('canAfford', () => {
  test('true when resource amount is greater than or equal to cost', () => {
    const state = addResource(createInitialState(), 'lumens', 10);
    expect(canAfford(state, 'lumens', 10)).toBe(true);
  });

  test('false when resource amount is less than cost', () => {
    const state = createInitialState();
    expect(canAfford(state, 'lumens', state.resources.lumens + 1)).toBe(false);
  });
});
