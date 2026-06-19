import { describe, expect, test } from 'vitest';
import { createInitialState, ERAS, FINAL_ERA, hiddenForEra } from './state';
import { buildingCost } from './game/buildings';

describe('createInitialState', () => {
  // Bug found by manually running the app: with 0 starting lumens and a
  // Campfire costing 5, the player could never afford anything and the game
  // was permanently stuck. The camp must start with enough lumens to light
  // the very first campfire by hand.
  test('starts with enough lumens to afford the first campfire', () => {
    const state = createInitialState();
    expect(state.resources.lumens).toBeGreaterThanOrEqual(buildingCost('campfire', 0));
  });

  test('starts with no research, no active event', () => {
    const state = createInitialState();
    expect(state.research).toEqual([]);
    expect(state.activeEvent).toBeNull();
    expect(state.eventCooldownTicks).toBe(0);
  });

  // Issue #3: wonder is visible from era 1 (it already accumulates early -
  // it was only ever the UI hiding it), unlike fuel/materials/exotic which
  // genuinely don't matter yet.
  test('starts in era 1 with fuel, materials, and exotic hidden, but wonder visible', () => {
    const state = createInitialState();
    expect(state.phase).toBe(1);
    expect(state.hiddenResources.sort()).toEqual(['exotic', 'fuel', 'materials']);
  });

  test('starts with phaseSince at zero', () => {
    expect(createInitialState().phaseSince).toBe(0);
  });
});

describe('ERAS', () => {
  test('defines exactly 15 eras, Fire Age through Cosmic Age, numbered 1..15', () => {
    expect(ERAS).toHaveLength(15);
    expect(FINAL_ERA).toBe(15);
    expect(ERAS.map((era) => era.id)).toEqual([...Array(15)].map((_, i) => i + 1));
    expect(ERAS[0]!.name).toBe('Fire Age');
    expect(ERAS[14]!.name).toBe('Cosmic Age');
  });

  test('every era has a distinct designated light source forming the win chain', () => {
    const lightSources = ERAS.map((era) => era.lightSource);
    expect(new Set(lightSources).size).toBe(lightSources.length);
  });
});

describe('hiddenForEra', () => {
  test('reveals fuel, materials, and exotic in staged order as eras advance; wonder is never hidden', () => {
    expect(hiddenForEra(1).sort()).toEqual(['exotic', 'fuel', 'materials']);
    expect(hiddenForEra(3).sort()).toEqual(['exotic', 'materials']);
    expect(hiddenForEra(7).sort()).toEqual(['exotic']);
    expect(hiddenForEra(8)).toEqual([]);
    expect(hiddenForEra(11)).toEqual([]);
  });
});
