import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { addResource, spendResource } from './resources';
import { buyBuilding, buildingCost } from './buildings';

describe('buyBuilding', () => {
  test('increments owned count and spends lumens when affordable', () => {
    const state = addResource(createInitialState(), 'lumens', 10);
    const cost = buildingCost('candle', 0);
    const next = buyBuilding(state, 'candle');
    expect(next.buildings.candle).toBe(1);
    expect(next.resources.lumens).toBe(state.resources.lumens - cost);
  });

  test('returns state unchanged when not affordable', () => {
    const state = spendResource(createInitialState(), 'lumens', 100); // drain to 0
    const next = buyBuilding(state, 'candle');
    expect(next).toBe(state);
  });

  test('returns state unchanged when the building is still locked', () => {
    const state = addResource(createInitialState(), 'lumens', 100000);
    const next = buyBuilding(state, 'lantern'); // requires 3 candles owned first
    expect(next).toBe(state);
  });

  test('each purchase costs more than the last', () => {
    const state = addResource(createInitialState(), 'lumens', 1000);
    const afterOne = buyBuilding(state, 'candle');
    const afterTwo = buyBuilding(afterOne, 'candle');
    const firstCost = state.resources.lumens - afterOne.resources.lumens;
    const secondCost = afterOne.resources.lumens - afterTwo.resources.lumens;
    expect(secondCost).toBeGreaterThan(firstCost);
  });
});
