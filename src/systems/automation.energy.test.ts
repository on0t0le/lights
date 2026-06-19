import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { addResource } from '../game/resources';
import { resolveEnergy, totalLightOutput } from './automation';

function withBuildings(overrides: Partial<ReturnType<typeof createInitialState>['buildings']>) {
  const state = createInitialState();
  return { ...state, buildings: { ...state.buildings, ...overrides } };
}

/** Power Plants burn fuel (see resolveFuel) - tests that exercise them need a stockpile to draw from. */
function withFuel(state: ReturnType<typeof createInitialState>, amount: number) {
  return addResource(state, 'fuel', amount);
}

describe('resolveEnergy', () => {
  test('no buildings: no production, no consumption, ratio trivially 1', () => {
    const result = resolveEnergy(createInitialState());
    expect(result).toEqual({
      energyProduced: 0,
      energyConsumed: 0,
      energyRatio: 1,
      consumersActive: true,
      energySurplus: 0,
    });
  });

  test('Power Plants with fuel to burn and no consumers leave a full surplus', () => {
    const state = withFuel(withBuildings({ powerPlant: 2 }), 100);
    const result = resolveEnergy(state);
    expect(result.energyProduced).toBe(20);
    expect(result.energyRatio).toBe(1);
    expect(result.consumersActive).toBe(true);
    expect(result.energySurplus).toBe(20);
  });

  test('Power Plants with no fuel produce no energy at all', () => {
    const state = withBuildings({ powerPlant: 2 }); // fuel stockpile is 0
    const result = resolveEnergy(state);
    expect(result.energyProduced).toBe(0);
  });

  // Issue #1: an energy deficit dims output proportionally instead of
  // shutting every consumer off — no power at all is the zero-ratio edge of
  // that same curve.
  test('consumers with no Power Plant go into full deficit: ratio zero, no surplus', () => {
    const state = withBuildings({ gasLamp: 3 });
    const result = resolveEnergy(state);
    expect(result.energyConsumed).toBe(3);
    expect(result.energyRatio).toBe(0);
    expect(result.consumersActive).toBe(false);
    expect(result.energySurplus).toBe(0);
  });

  test('a partial deficit yields a fractional ratio, not a hard idle', () => {
    const state = withFuel(withBuildings({ powerPlant: 1, gasLamp: 6 }), 100); // 10 produced, 6 consumed
    const result = resolveEnergy(state);
    expect(result.energyRatio).toBe(1);
    // Bump consumption above production to see the brownout ratio.
    const overloaded = { ...state, buildings: { ...state.buildings, gasLamp: 30 } }; // 30 consumed, 10 produced
    const overloadedResult = resolveEnergy(overloaded);
    expect(overloadedResult.energyRatio).toBeCloseTo(10 / 30, 5);
    expect(overloadedResult.consumersActive).toBe(false);
    expect(overloadedResult.energySurplus).toBe(0);
  });

  test('Power Plant covering consumers stays active with leftover surplus', () => {
    const state = withFuel(withBuildings({ powerPlant: 1, gasLamp: 3 }), 100);
    const result = resolveEnergy(state);
    expect(result.energyRatio).toBe(1);
    expect(result.consumersActive).toBe(true);
    expect(result.energySurplus).toBe(7); // 10 produced - 3 consumed
  });
});

describe('totalLightOutput with energy gating', () => {
  test('a full energy deficit dims energy-consuming lights to zero', () => {
    const state = withBuildings({ gasLamp: 3 }); // no power plant -> ratio 0
    expect(totalLightOutput(state)).toBe(0);
  });

  test('consumers covered by Power Plants contribute their full light', () => {
    const state = withFuel(withBuildings({ powerPlant: 1, gasLamp: 3 }), 100);
    expect(totalLightOutput(state)).toBe(36); // 12/unit * 3
  });

  test('a partial deficit dims energy-consuming lights proportionally, not to zero', () => {
    const state = withFuel(withBuildings({ powerPlant: 1, gasLamp: 30 }), 100); // 10 produced, 30 consumed -> ratio 1/3
    expect(totalLightOutput(state)).toBeCloseTo(12 * 30 * (10 / 30), 5);
  });

  test('non-consumer buildings always contribute light regardless of energy state', () => {
    const state = withBuildings({ campfire: 2, gasLamp: 3 }); // gasLamp deficit, campfire unaffected
    expect(totalLightOutput(state)).toBeCloseTo(1, 5);
  });

  // Reported bug: an energy-consuming light should not work without power -
  // unlike Campfire (0 energy upkeep), it must dim to dark with no power.
  test('Incandescent Bulb contributes no light without a Power Plant', () => {
    const state = withBuildings({ incandescentBulb: 4 });
    expect(totalLightOutput(state)).toBe(0);
  });

  test('Incandescent Bulb lights up once enough Power Plants (with fuel) cover its upkeep', () => {
    const state = withFuel(withBuildings({ powerPlant: 2, incandescentBulb: 4 }), 100);
    expect(totalLightOutput(state)).toBe(240); // 60/unit * 4
  });
});
