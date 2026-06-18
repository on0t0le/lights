import { describe, expect, test } from 'vitest';
import { computeHappiness, COMFORT_MIN, COMFORT_MAX, applyHappiness } from './happiness';
import { createInitialState } from '../state';
import { buyBuilding, BUILDINGS, buildingCost } from '../game/buildings';
import { addResource } from '../game/resources';
import { tick, totalLightOutput } from './automation';
import type { BuildingId } from '../state';

describe('computeHappiness', () => {
  test('total darkness (no light) gives low happiness', () => {
    expect(computeHappiness(0)).toBeLessThan(0.3);
  });

  test('light within the comfortable band gives max happiness', () => {
    const midComfort = (COMFORT_MIN + COMFORT_MAX) / 2;
    expect(computeHappiness(midComfort)).toBe(1);
  });

  test('light far above the comfortable band reduces happiness (overexposure)', () => {
    expect(computeHappiness(COMFORT_MAX * 10)).toBeLessThan(0.3);
  });

  test('never returns a value outside [0, 1]', () => {
    expect(computeHappiness(COMFORT_MAX * 1000)).toBeGreaterThanOrEqual(0);
    expect(computeHappiness(0)).toBeLessThanOrEqual(1);
  });
});

describe('applyHappiness', () => {
  test('sets resources.happiness from current building light output', () => {
    const state = buyBuilding(addResource(createInitialState(), 'lumens', 100), 'candle');
    const next = applyHappiness(state);
    expect(next.resources.happiness).toBe(computeHappiness(0.2));
  });

  test('Phase 1 is unaffected by sleep disruption even at night with high light', () => {
    const state = {
      ...createInitialState(),
      phase: 1 as const,
      dayNightClock: 0, // midnight
      buildings: { ...createInitialState().buildings, lighthouse: 50 },
    };
    const next = applyHappiness(state);
    expect(next.resources.happiness).toBe(computeHappiness(totalLightOutput(state)));
  });

  test('Phase 2 at night with high light suffers a sleep disruption penalty', () => {
    const state = {
      ...createInitialState(),
      phase: 2 as const,
      dayNightClock: 0, // midnight
      buildings: { ...createInitialState().buildings, lighthouse: 50 },
    };
    const next = applyHappiness(state);
    expect(next.resources.happiness).toBeLessThan(computeHappiness(totalLightOutput(state)));
  });

  test('Phase 2 at noon (no night) has no sleep disruption penalty', () => {
    const state = {
      ...createInitialState(),
      phase: 2 as const,
      dayNightClock: 0.5, // noon
      buildings: { ...createInitialState().buildings, lighthouse: 50 },
    };
    const next = applyHappiness(state);
    expect(next.resources.happiness).toBe(computeHappiness(totalLightOutput(state)));
  });

  test('greedy Phase 1 play never reaches the overexposure knee', () => {
    let state = createInitialState();
    const ids = Object.keys(BUILDINGS) as BuildingId[];

    for (let i = 0; i < 20000; i++) {
      state = tick(state);
      // Greedily buy whatever's cheapest and affordable, every tick.
      let bought = true;
      while (bought) {
        bought = false;
        const affordable = ids
          .filter((id) => buildingCost(id, state.buildings[id]) <= state.resources.lumens)
          .sort((a, b) => buildingCost(a, state.buildings[a]) - buildingCost(b, state.buildings[b]));
        const cheapest = affordable[0];
        if (cheapest !== undefined) {
          const next = buyBuilding(state, cheapest);
          if (next !== state) {
            state = next;
            bought = true;
          }
        }
      }
    }

    expect(totalLightOutput(state)).toBeLessThan(COMFORT_MAX);
  });

  test('an active Bird Migration Disrupted event reduces happiness', () => {
    // 12 candles -> 2.4 light, mid-ramp (between 0 and COMFORT_MIN): base happiness
    // is neither floored at 0 nor capped at 1, leaving room for the penalty to show.
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, candle: 12 },
      activeEvent: { id: 'birdMigration' as const, ticksRemaining: 5 },
    };
    const next = applyHappiness(state);
    const baseline = applyHappiness({ ...state, activeEvent: null });
    expect(next.resources.happiness).toBeLessThan(baseline.resources.happiness);
  });

  test('Phase 2 has no wildlife disruption penalty even at high brightness', () => {
    const state = {
      ...createInitialState(),
      phase: 2 as const,
      dayNightClock: 0.5, // noon, so sleep disruption stays out of the picture
      buildings: { ...createInitialState().buildings, lighthouse: 50, stadiumLights: 50 },
    };
    const next = applyHappiness(state);
    expect(next.resources.happiness).toBe(computeHappiness(totalLightOutput(state)));
  });

  test('Phase 3 at high brightness suffers a wildlife disruption penalty', () => {
    const state = {
      ...createInitialState(),
      phase: 3 as const,
      dayNightClock: 0.5, // noon
      buildings: { ...createInitialState().buildings, lighthouse: 50, stadiumLights: 50, orbitalMirror: 50 },
    };
    const next = applyHappiness(state);
    expect(next.resources.happiness).toBeLessThan(computeHappiness(totalLightOutput(state)));
  });

  test('Artificial Sleep research reduces the Phase 3 sleep disruption penalty', () => {
    const state = {
      ...createInitialState(),
      phase: 3 as const,
      dayNightClock: 0, // midnight
      buildings: { ...createInitialState().buildings, lighthouse: 50 },
    };
    const withResearch = { ...state, research: ['artificialSleep' as const] };
    const without = applyHappiness(state);
    const withIt = applyHappiness(withResearch);
    expect(withIt.resources.happiness).toBeGreaterThan(without.resources.happiness);
  });

  test('a higher happiness priority slider raises happiness', () => {
    // 12 candles -> 2.4 light, mid-ramp: base happiness sits under 1, leaving room for the bonus to show.
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, candle: 12 },
      priorities: { ...createInitialState().priorities, happiness: 1 },
    };
    const next = applyHappiness(state);
    const baseline = applyHappiness({ ...state, priorities: createInitialState().priorities });
    expect(next.resources.happiness).toBeGreaterThan(baseline.resources.happiness);
  });
});
