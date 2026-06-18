import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { buyBuilding } from '../game/buildings';
import { addResource } from '../game/resources';
import { tick } from './automation';

describe('tick', () => {
  test('produces lumens from owned buildings', () => {
    const state = buyBuilding(addResource(createInitialState(), 'lumens', 100), 'candle');
    const before = state.resources.lumens;
    const next = tick(state);
    expect(next.resources.lumens).toBeCloseTo(before + 0.2, 5);
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
    };
    const first = tick(state);
    const second = tick(first);
    expect(first.resources.energy).toBe(10);
    expect(second.resources.energy).toBe(10); // not 20 - this is a flow balance, not a stockpile
  });

  test('advances to Phase 2 once a Lighthouse has been built', () => {
    const state = {
      ...createInitialState(),
      buildings: { ...createInitialState().buildings, lighthouse: 1 },
    };
    const next = tick(state);
    expect(next.phase).toBe(2);
  });

  test('stays in Phase 1 without a Lighthouse', () => {
    const next = tick(createInitialState());
    expect(next.phase).toBe(1);
  });

  test('applies research lumen multiplier on top of building output', () => {
    const base = buyBuilding(addResource(createInitialState(), 'lumens', 100), 'candle');
    const state = { ...base, research: ['candleMaking' as const] };
    const before = state.resources.lumens;
    const next = tick(state);
    expect(next.resources.lumens).toBeCloseTo(before + 0.2 * 1.2, 5);
  });

  test('applies the lumens priority slider on top of building output', () => {
    const base = buyBuilding(addResource(createInitialState(), 'lumens', 100), 'candle');
    const state = { ...base, priorities: { ...base.priorities, lumens: 1 } };
    const before = state.resources.lumens;
    const next = tick(state);
    expect(next.resources.lumens).toBeCloseTo(before + 0.2 * 1.5, 5);
  });

  test('applies an active event\'s lumen productivity penalty', () => {
    const base = buyBuilding(addResource(createInitialState(), 'lumens', 100), 'candle');
    const state = { ...base, activeEvent: { id: 'insomniaEpidemic' as const, ticksRemaining: 5 } };
    const before = state.resources.lumens;
    const next = tick(state);
    expect(next.resources.lumens).toBeCloseTo(before + 0.2 * 0.7, 5);
  });
});
