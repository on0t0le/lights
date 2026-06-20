import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { addResource } from '../game/resources';
import { resolveEnergy, resolveFuel, totalLightOutput } from './automation';

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
    const state = withBuildings({ incandescentBulb: 3 }); // 3 energy/unit
    const result = resolveEnergy(state);
    expect(result.energyConsumed).toBe(9);
    expect(result.energyRatio).toBe(0);
    expect(result.consumersActive).toBe(false);
    expect(result.energySurplus).toBe(0);
  });

  test('a partial deficit yields a fractional ratio, not a hard idle', () => {
    const state = withFuel(withBuildings({ powerPlant: 1, incandescentBulb: 3 }), 100); // 10 produced, 9 consumed
    const result = resolveEnergy(state);
    expect(result.energyRatio).toBe(1);
    // Bump consumption above production to see the brownout ratio.
    const overloaded = { ...state, buildings: { ...state.buildings, incandescentBulb: 10 } }; // 30 consumed, 10 produced
    const overloadedResult = resolveEnergy(overloaded);
    expect(overloadedResult.energyRatio).toBeCloseTo(10 / 30, 5);
    expect(overloadedResult.consumersActive).toBe(false);
    expect(overloadedResult.energySurplus).toBe(0);
  });

  test('Power Plant covering consumers stays active with leftover surplus', () => {
    const state = withFuel(withBuildings({ powerPlant: 1, incandescentBulb: 3 }), 100);
    const result = resolveEnergy(state);
    expect(result.energyRatio).toBe(1);
    expect(result.consumersActive).toBe(true);
    expect(result.energySurplus).toBe(1); // 10 produced - 9 consumed
  });
});

describe('totalLightOutput with energy gating', () => {
  test('a full energy deficit dims energy-consuming lights to zero', () => {
    const state = withBuildings({ incandescentBulb: 3 }); // no power plant -> ratio 0
    expect(totalLightOutput(state)).toBe(0);
  });

  test('consumers covered by Power Plants contribute their full light', () => {
    const state = withFuel(withBuildings({ powerPlant: 1, incandescentBulb: 3 }), 100);
    expect(totalLightOutput(state)).toBe(180); // 60/unit * 3
  });

  test('a partial deficit dims energy-consuming lights proportionally, not to zero', () => {
    const state = withFuel(withBuildings({ powerPlant: 1, incandescentBulb: 10 }), 100); // 10 produced, 30 consumed -> ratio 1/3
    expect(totalLightOutput(state)).toBeCloseTo(60 * 10 * (10 / 30), 5);
  });

  test('non-consumer buildings always contribute light regardless of energy state', () => {
    const state = withBuildings({ campfire: 2, incandescentBulb: 3 }); // incandescentBulb deficit, campfire unaffected
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

  // Reported bug: a fuel shortfall used to hard-idle every burner at once
  // (resolveFuel's old binary `active`), causing power generation to
  // oscillate on/off as the stockpile drained and refilled. Fuel now dims
  // proportionally, like energy and exotic matter.
  describe('fuel brownout (gas lamps and power plants share the fuel stockpile)', () => {
    test('a Gas Lamp with no fuel at all produces no light', () => {
      const state = withBuildings({ gasLamp: 5 }); // no Gas Works, no stockpile
      expect(totalLightOutput(state)).toBe(0);
    });

    test('a Gas Lamp fed by a Gas Works lights up at full strength', () => {
      const state = withFuel(withBuildings({ gasWorks: 1, gasLamp: 5 }), 100);
      expect(totalLightOutput(state)).toBe(60); // 12/unit * 5
    });

    test('a partial fuel shortfall dims fuel-consuming lights proportionally, not to zero', () => {
      // gasWorks produces 5 fuel/tick; 20 gas lamps demand 20 fuel/tick -> ratio 1/4 once the stockpile is gone.
      const state = withBuildings({ gasWorks: 1, gasLamp: 20 });
      const fuel = resolveFuel(state);
      expect(fuel.fuelRatio).toBeCloseTo(5 / 20, 5);
      expect(totalLightOutput(state)).toBeCloseTo(12 * 20 * (5 / 20), 5);
    });

    test('an excess of Power Plants past Gas Works output degrades smoothly instead of cutting off', () => {
      // 1 Gas Works makes 5 fuel/tick; 2 Power Plants demand 2 fuel/tick each = 4/tick, still covered.
      const covered = withBuildings({ gasWorks: 1, powerPlant: 2 });
      expect(resolveFuel(covered).fuelRatio).toBe(1);
      // Add enough Power Plants to outstrip production: 10 Power Plants demand 10 fuel/tick > 5 produced.
      const overloaded = withBuildings({ gasWorks: 1, powerPlant: 10 });
      const result = resolveFuel(overloaded);
      expect(result.fuelRatio).toBeGreaterThan(0);
      expect(result.fuelRatio).toBeLessThan(1);
    });
  });
});
