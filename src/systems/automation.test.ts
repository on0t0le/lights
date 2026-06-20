import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { buyBuilding } from '../game/buildings';
import { addResource } from '../game/resources';
import { tick } from './automation';

/** Happiness 1 isolates lumen-multiplier tests from the happiness-gating mechanic (tested separately below). */
function withFullHappiness<T extends ReturnType<typeof createInitialState>>(state: T): T {
  return { ...state, resources: { ...state.resources, happiness: 1 } };
}

describe('tick', () => {
  test('produces lumens from owned buildings', () => {
    const state = withFullHappiness(buyBuilding(addResource(createInitialState(), 'lumens', 100), 'campfire'));
    const before = state.resources.lumens;
    const next = tick(state);
    expect(next.resources.lumens).toBeCloseTo(before + 0.5, 5);
  });

  test('happiness scales lumen production convexly but floors at half output, not zero', () => {
    const built = buyBuilding(addResource(createInitialState(), 'lumens', 100), 'campfire');
    const state = { ...built, resources: { ...built.resources, happiness: 0.5 } };
    const before = state.resources.lumens;
    const next = tick(state);
    // 0.5 + 0.5 * 0.5**1.5 ≈ 0.6768 - softer than the old exponent-2 curve
    // (issue #5: happiness² punished mid-low happiness too harshly), but
    // still convex, and a misery spiral can no longer zero out production.
    expect(next.resources.lumens).toBeCloseTo(before + 0.5 * (0.5 + 0.5 * 0.5 ** 1.5), 5);
  });

  test('zero happiness still produces half output, not zero, even with buildings owned', () => {
    const built = buyBuilding(addResource(createInitialState(), 'lumens', 100), 'campfire');
    const state = { ...built, resources: { ...built.resources, happiness: 0 } };
    const next = tick(state);
    // 0.5 + 0.5 * 0**1.5 = 0.5
    expect(next.resources.lumens).toBeCloseTo(state.resources.lumens + 0.5 * 0.5, 5);
  });

  test('does nothing extra when no buildings are owned', () => {
    const state = createInitialState();
    const next = tick(state);
    expect(next.resources.lumens).toBe(state.resources.lumens);
  });

  test('advances the tick counter by 1', () => {
    const state = createInitialState();
    const next = tick(state);
    expect(next.tick).toBe(state.tick + 1);
  });

  test('advances the day/night clock and wraps at 1', () => {
    const state = { ...createInitialState(), dayNightClock: 0.999 };
    const next = tick(state, 0.01);
    expect(next.dayNightClock).toBeCloseTo(0.009, 5);
  });

  test('sets energy to the current surplus, not a running total', () => {
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, powerPlant: 1 },
      resources: { ...createInitialState().resources, fuel: 100 }, // Power Plant burns fuel - see resolveFuel
    };
    const first = tick(state);
    const second = tick(first);
    expect(first.resources.energy).toBe(10);
    expect(second.resources.energy).toBe(10); // not 20 - this is a flow balance, not a stockpile
  });

  test('Gas Works refines fuel into a stockpile that accumulates across ticks', () => {
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, gasWorks: 1 },
    };
    const first = tick(state);
    const second = tick(first);
    expect(first.resources.fuel).toBe(5);
    expect(second.resources.fuel).toBe(10); // unlike energy, fuel is a stockpile
  });

  test('advances to Lamp Age once Fire Making research is bought AND a Torch is owned', () => {
    const state = {
      ...createInitialState(),
      tick: 9999, // past the era dwell lock (issue #7), see progression.ts's MIN_ERA_TICKS
      phaseSince: 0,
      research: ['fireMaking' as const],
      buildings: { ...createInitialState().buildings, torch: 1 },
    };
    const next = tick(state);
    expect(next.phase).toBe(2);
  });

  test('stays in Fire Age with Fire Making research bought but no Torch owned', () => {
    const state = { ...createInitialState(), research: ['fireMaking' as const] };
    const next = tick(state);
    expect(next.phase).toBe(1);
  });

  test('stays in Fire Age without owning a Torch or Fire Making research', () => {
    const next = tick(createInitialState());
    expect(next.phase).toBe(1);
  });

  test('applies research lumen multiplier on top of building output', () => {
    const base = withFullHappiness(buyBuilding(addResource(createInitialState(), 'lumens', 100), 'campfire'));
    const state = { ...base, research: ['fireMaking' as const] };
    const before = state.resources.lumens;
    const next = tick(state);
    expect(next.resources.lumens).toBeCloseTo(before + 0.5 * 1.2, 5);
  });

  test('applies an active event\'s lumen productivity penalty', () => {
    const base = withFullHappiness(buyBuilding(addResource(createInitialState(), 'lumens', 100), 'campfire'));
    const state = { ...base, activeEvent: { id: 'insomniaEpidemic' as const, ticksRemaining: 5 } };
    const before = state.resources.lumens;
    const next = tick(state);
    expect(next.resources.lumens).toBeCloseTo(before + 0.5 * 0.7, 5);
  });

  // Issue #2: materials are no longer just a megastructure savings account -
  // a stockpile raises lumen output everywhere, log-scaled so it's a steady
  // nudge rather than a runaway multiplier.
  test('materials stockpile raises lumen output via a log efficiency bonus', () => {
    const built = withFullHappiness(buyBuilding(addResource(createInitialState(), 'lumens', 100), 'campfire'));
    const state = { ...built, resources: { ...built.resources, materials: 999 } };
    const before = state.resources.lumens;
    const next = tick(state);
    // materialsEfficiency = 1 + 0.04 * log10(1 + 999) = 1 + 0.04 * 3 = 1.12
    expect(next.resources.lumens).toBeCloseTo(before + 0.5 * 1.12, 5);
  });

  // Issue #9: late-game megastructures (era 10+) carry an upkeep cost in
  // lumens per owned unit, so unchecked building eventually plateaus instead
  // of running away forever - the lumens sink deducts after production but
  // never drives the stockpile negative.
  test('maintenance upkeep on owned megastructures subtracts from net lumens', () => {
    const state = {
      ...createInitialState(),
      resources: { ...createInitialState().resources, lumens: 1_000_000_000, happiness: 1, exotic: 9 },
      buildings: { ...createInitialState().buildings, orbitalMirror: 2 },
    };
    const before = state.resources.lumens;
    const next = tick(state);
    const grossLumens = 940000 * 2 * (0.5 + 0.5 * 1 ** 1.5);
    const maintenance = 47000 * 2;
    expect(next.resources.lumens).toBeCloseTo(before + grossLumens - maintenance, 5);
  });

  test('maintenance upkeep never drives lumens negative', () => {
    const state = {
      ...createInitialState(),
      resources: { ...createInitialState().resources, lumens: 1, happiness: 1, exotic: 4.5 },
      buildings: { ...createInitialState().buildings, orbitalMirror: 1 },
    };
    const next = tick(state);
    expect(next.resources.lumens).toBeGreaterThanOrEqual(0);
  });
});
