import { describe, expect, test } from 'vitest';
import { computeWonderYield, applyWonder } from './wonder';
import { createInitialState } from '../state';

describe('computeWonderYield', () => {
  test('is positive at midnight with full darkness (ambient moonlight/stars)', () => {
    const state = { ...createInitialState(), dayNightClock: 0 };
    expect(computeWonderYield(state)).toBeGreaterThan(0);
  });

  test('an active Meteor Shower event adds to the ambient yield', () => {
    const state = { ...createInitialState(), dayNightClock: 0, activeEvent: { id: 'meteorShower' as const, ticksRemaining: 5 } };
    const baseline = { ...state, activeEvent: null };
    expect(computeWonderYield(state)).toBeGreaterThan(computeWonderYield(baseline));
  });

  test('is exactly zero once darkness has been fully eliminated, even at midnight with an active event', () => {
    const state = {
      ...createInitialState(),
      dayNightClock: 0,
      darkness: 0,
      activeEvent: { id: 'meteorShower' as const, ticksRemaining: 5 },
    };
    expect(computeWonderYield(state)).toBe(0);
  });

  test('scales down proportionally to partial darkness', () => {
    const full = { ...createInitialState(), dayNightClock: 0, darkness: 1 };
    const half = { ...createInitialState(), dayNightClock: 0, darkness: 0.5 };
    expect(computeWonderYield(half)).toBeCloseTo(computeWonderYield(full) * 0.5, 5);
  });

  test('stars contribute less wonder as total light rises', () => {
    const dim = { ...createInitialState(), dayNightClock: 0 };
    const bright = {
      ...createInitialState(),
      dayNightClock: 0,
      buildings: { ...createInitialState().buildings, lighthouse: 100 },
    };
    expect(computeWonderYield(bright)).toBeLessThan(computeWonderYield(dim));
  });
});

describe('applyWonder', () => {
  test('accumulates onto resources.wonder rather than overwriting it', () => {
    const state = { ...createInitialState(), dayNightClock: 0, resources: { ...createInitialState().resources, wonder: 5 } };
    const next = applyWonder(state);
    expect(next.resources.wonder).toBeCloseTo(5 + computeWonderYield(state));
  });

  test('does not mutate the original state', () => {
    const state = { ...createInitialState(), dayNightClock: 0 };
    applyWonder(state);
    expect(state.resources.wonder).toBe(0);
  });

  test('stays at the prior total once darkness is fully eliminated', () => {
    const state = {
      ...createInitialState(),
      dayNightClock: 0,
      darkness: 0,
      resources: { ...createInitialState().resources, wonder: 7 },
    };
    expect(applyWonder(state).resources.wonder).toBe(7);
  });
});
