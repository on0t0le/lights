import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { resolveEnergy, totalLightOutput } from './automation';

function withBuildings(overrides: Partial<ReturnType<typeof createInitialState>['buildings']>) {
  const state = createInitialState();
  return { ...state, buildings: { ...state.buildings, ...overrides } };
}

describe('resolveEnergy', () => {
  test('no buildings: no production, no consumption, consumers trivially active', () => {
    const result = resolveEnergy(createInitialState());
    expect(result).toEqual({
      energyProduced: 0,
      energyConsumed: 0,
      consumersActive: true,
      energySurplus: 0,
    });
  });

  test('Power Plants with no consumers leave a full surplus', () => {
    const state = withBuildings({ powerPlant: 2 });
    const result = resolveEnergy(state);
    expect(result.energyProduced).toBe(20);
    expect(result.consumersActive).toBe(true);
    expect(result.energySurplus).toBe(20);
  });

  test('consumers with no Power Plant go into deficit and idle', () => {
    const state = withBuildings({ neonSign: 3 });
    const result = resolveEnergy(state);
    expect(result.energyConsumed).toBe(6);
    expect(result.consumersActive).toBe(false);
    expect(result.energySurplus).toBe(0);
  });

  test('Power Plant covering consumers stays active with leftover surplus', () => {
    const state = withBuildings({ powerPlant: 1, neonSign: 3 });
    const result = resolveEnergy(state);
    expect(result.consumersActive).toBe(true);
    expect(result.energySurplus).toBe(4); // 10 produced - 6 consumed
  });
});

describe('totalLightOutput with energy gating', () => {
  test('idle consumers (energy deficit) contribute no light', () => {
    const state = withBuildings({ neonSign: 3 }); // no power plant -> deficit
    expect(totalLightOutput(state)).toBe(0);
  });

  test('consumers covered by Power Plants contribute their light', () => {
    const state = withBuildings({ powerPlant: 1, neonSign: 3 });
    expect(totalLightOutput(state)).toBe(45); // 15/unit * 3
  });

  test('non-consumer buildings always contribute light regardless of energy state', () => {
    const state = withBuildings({ candle: 2, neonSign: 3 }); // neonSign idle, candle unaffected
    expect(totalLightOutput(state)).toBeCloseTo(0.4, 5);
  });
});
