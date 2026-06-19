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
      buyBuilding(addResource(createInitialState(), 'lumens', 100), 'campfire'),
      'campfire'
    );
    expect(totalLightOutput(state)).toBeCloseTo(1, 5);
  });

  // Issue #6: exotic matter is a capability gate (a stock ratio), not a
  // continuous drain like fuel - a light dims smoothly as the reserve falls
  // short of what its owned units require, never hard-idling at zero stock.
  describe('exotic capability gating', () => {
    test('no exotic reserve at all dims an exotic-requiring light to zero', () => {
      const state = {
        ...createInitialState(),
        buildings: { ...createInitialState().buildings, fusionSun: 2 },
        resources: { ...createInitialState().resources, exotic: 0 },
      };
      expect(totalLightOutput(state)).toBe(0);
    });

    test('a partial exotic reserve dims the light proportionally, not to zero', () => {
      const state = {
        ...createInitialState(),
        buildings: { ...createInitialState().buildings, fusionSun: 2 }, // demand = 2 * 0.5 = 1
        resources: { ...createInitialState().resources, exotic: 0.5 }, // ratio = 0.5
      };
      expect(totalLightOutput(state)).toBeCloseTo(37500 * 2 * 0.5, 5);
    });

    test('a full exotic reserve lets the light run at its full rate', () => {
      const state = {
        ...createInitialState(),
        buildings: { ...createInitialState().buildings, fusionSun: 2 },
        resources: { ...createInitialState().resources, exotic: 1 },
      };
      expect(totalLightOutput(state)).toBeCloseTo(37500 * 2, 5);
    });

    test('the exotic reserve is not spent by resolving it (a stock, not a flow)', () => {
      const state = {
        ...createInitialState(),
        buildings: { ...createInitialState().buildings, fusionSun: 2 },
        resources: { ...createInitialState().resources, exotic: 1 },
      };
      totalLightOutput(state);
      expect(state.resources.exotic).toBe(1);
    });
  });
});
