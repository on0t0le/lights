import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { buyBuilding } from '../game/buildings';
import { addResource } from '../game/resources';
import { totalLightOutput } from './automation';

describe('totalLightOutput', () => {
  test('zero when no buildings owned', () => {
    expect(totalLightOutput(createInitialState())).toBe(0);
  });

  test('sums lumen output across owned buildings', () => {
    const state = buyBuilding(
      buyBuilding(addResource(createInitialState(), 'lumens', 100), 'candle'),
      'candle'
    );
    expect(totalLightOutput(state)).toBeCloseTo(0.4, 5);
  });
});
