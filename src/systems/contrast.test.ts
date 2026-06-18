import { describe, expect, test } from 'vitest';
import { computeContrast, applyContrast } from './contrast';
import { createInitialState } from '../state';

describe('computeContrast', () => {
  test('is at its highest at midnight with no ambient light', () => {
    const state = { ...createInitialState(), dayNightClock: 0 }; // midnight
    expect(computeContrast(state)).toBeCloseTo(1, 5);
  });

  test('is zero at noon regardless of light', () => {
    const state = { ...createInitialState(), dayNightClock: 0.5 }; // noon
    expect(computeContrast(state)).toBe(0);
  });

  test('is consumed by brightness: more total light means less contrast at night', () => {
    const dark = { ...createInitialState(), dayNightClock: 0 };
    const lit = {
      ...createInitialState(),
      dayNightClock: 0,
      buildings: { ...createInitialState().buildings, lighthouse: 3 },
    };
    expect(computeContrast(lit)).toBeLessThan(computeContrast(dark));
  });

  test('never goes negative or above 1', () => {
    const state = {
      ...createInitialState(),
      dayNightClock: 0,
      buildings: { ...createInitialState().buildings, lighthouse: 1000 },
    };
    const value = computeContrast(state);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });

  test('an active Cloudy Season event adds a contrast bonus', () => {
    const state = {
      ...createInitialState(),
      dayNightClock: 0,
      buildings: { ...createInitialState().buildings, lighthouse: 3 },
      activeEvent: { id: 'cloudySeason' as const, ticksRemaining: 5 },
    };
    const baseline = { ...state, activeEvent: null };
    expect(computeContrast(state)).toBeGreaterThan(computeContrast(baseline));
  });

  test('stays capped at 1 even with a contrast bonus active', () => {
    const state = { ...createInitialState(), dayNightClock: 0, activeEvent: { id: 'cloudySeason' as const, ticksRemaining: 5 } };
    expect(computeContrast(state)).toBeLessThanOrEqual(1);
  });

  test('is zero once darkness has been fully eliminated, even at midnight', () => {
    const state = { ...createInitialState(), dayNightClock: 0, darkness: 0 };
    expect(computeContrast(state)).toBe(0);
  });

  test('scales down proportionally to partial darkness', () => {
    const full = { ...createInitialState(), dayNightClock: 0, darkness: 1 };
    const half = { ...createInitialState(), dayNightClock: 0, darkness: 0.5 };
    expect(computeContrast(half)).toBeCloseTo(computeContrast(full) * 0.5, 5);
  });
});

describe('applyContrast', () => {
  test('sets resources.contrast from computeContrast', () => {
    const state = { ...createInitialState(), dayNightClock: 0 };
    const next = applyContrast(state);
    expect(next.resources.contrast).toBe(computeContrast(state));
  });
});
