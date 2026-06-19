import { describe, expect, test, beforeEach } from 'vitest';
import { createInitialState, hiddenForEra } from '../state';
import { addResource } from './resources';
import { BUILDINGS } from './buildings';
import {
  serialize,
  deserialize,
  saveToLocalStorage,
  loadFromLocalStorage,
  SAVE_KEY,
} from './save';

describe('serialize / deserialize', () => {
  test('round-trips a game state', () => {
    const state = addResource(createInitialState(), 'lumens', 42);
    const json = serialize(state);
    const restored = deserialize(json);
    expect(restored).toEqual(state);
  });

  test('rejects a payload with no recognizable version', () => {
    expect(() => deserialize('{"foo":"bar"}')).toThrow();
  });

  test('rejects a payload whose state is missing required shape', () => {
    expect(() => deserialize('{"version":1,"state":{"resources":"not-an-object"}}')).toThrow();
    expect(() => deserialize('{"version":1,"state":{}}')).toThrow();
  });

  test('serializes at the current save version', () => {
    const json = serialize(createInitialState());
    expect((JSON.parse(json) as { version: number }).version).toBe(9);
  });

  test('migrates a v1 save (5-resource, pre-15-era), backfilling every current building key to 0', () => {
    const v1 = JSON.stringify({
      version: 1,
      state: {
        resources: { lumens: 5, energy: 0, happiness: 0.5, contrast: 0, wonder: 0 },
        hiddenResources: ['contrast', 'wonder'],
        buildings: { candle: 2 },
        tick: 10,
        dayNightClock: 0.1,
        phase: 1,
      },
    });
    const restored = deserialize(v1);
    for (const id of Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]) {
      expect(restored.buildings[id]).toBeGreaterThanOrEqual(0);
    }
    expect(restored.buildings.candle).toBe(2);
    // v1's old phase 1 (Village) snaps to era 3 (Gas Age) - the nearest
    // equivalent era under V7_TO_V15_PHASE_REMAP.
    expect(restored.phase).toBe(3);
    // Old saves never had materials, fuel, or exotic at all - backfilled to 0.
    expect(restored.resources.materials).toBe(0);
    expect(restored.resources.fuel).toBe(0);
    expect(restored.resources.exotic).toBe(0);
  });

  test('migrates a v1 save missing phase, defaulting to phase 1 before remapping to era 3', () => {
    const v1 = JSON.stringify({
      version: 1,
      state: {
        resources: { lumens: 5, energy: 0, happiness: 0.5, contrast: 0, wonder: 0 },
        hiddenResources: ['contrast', 'wonder'],
        buildings: { candle: 2 },
        tick: 10,
        dayNightClock: 0.1,
      },
    });
    const restored = deserialize(v1);
    expect(restored.phase).toBe(3);
  });

  test('migrates a v2 save missing research/events, backfilling neutral defaults', () => {
    const v2 = JSON.stringify({
      version: 2,
      state: {
        resources: { lumens: 5, energy: 0, happiness: 0.5, contrast: 0, wonder: 0 },
        hiddenResources: ['contrast', 'wonder'],
        buildings: { candle: 2, powerPlant: 0 },
        tick: 10,
        dayNightClock: 0.1,
        phase: 2,
      },
    });
    const restored = deserialize(v2);
    expect(restored.research).toEqual([]);
    expect(restored.activeEvent).toBeNull();
    expect(restored.eventCooldownTicks).toBe(0);
  });

  // Pre-v6 saves used a 5-phase scheme; v6 inserted two phases, so an old
  // phase 3 (old Planet) became post-v6 phase 5 - and v8's 15-era rebuild
  // then snaps that post-v6 phase 5 on to era 10 (V7_TO_V15_PHASE_REMAP).
  // Both remaps chain for a save this old.
  test('chains the pre-v6 and v7->v15 phase remaps for a very old save', () => {
    const v3 = JSON.stringify({
      version: 3,
      state: {
        resources: { lumens: 5, energy: 0, happiness: 0.5, contrast: 0, wonder: 0 },
        hiddenResources: ['wonder'],
        buildings: { candle: 5 },
        tick: 100,
        dayNightClock: 0.3,
        phase: 3, // old Planet (pre-v6 scheme)
        research: ['candleMaking'],
        activeEvent: null,
        eventCooldownTicks: 0,
      },
    });
    const restored = deserialize(v3);
    expect(restored.phase).toBe(10); // pre-v6 phase 3 -> post-v6 phase 5 -> era 10
    expect(restored.darkness).toBe(1);
    expect(restored.ending).toBeNull();
  });

  test('remaps a v7 save\'s old endgame phase (7, Remove Darkness) to era 15, where the fork now lives', () => {
    const v7 = JSON.stringify({
      version: 7,
      state: { ...createInitialState(), phase: 7 },
    });
    const restored = deserialize(v7);
    expect(restored.phase).toBe(15);
  });

  test('a migrated save\'s hiddenResources always matches hiddenForEra of its (possibly remapped) phase', () => {
    const v7 = JSON.stringify({
      version: 7,
      state: { ...createInitialState(), phase: 5 }, // -> remaps to era 10
    });
    const restored = deserialize(v7);
    expect(restored.hiddenResources.sort()).toEqual(hiddenForEra(restored.phase).sort());
  });

  test('migrates an older save missing a current building key, backfilling it to 0', () => {
    const initial = createInitialState();
    const { cosmicBeacon, ...rest } = initial.buildings;
    const v7 = JSON.stringify({
      version: 7,
      state: { ...initial, buildings: rest },
    });
    const restored = deserialize(v7);
    expect(restored.buildings.cosmicBeacon).toBe(0);
  });

  // Issue #7: phaseSince didn't exist before v9's era dwell lock. Defaulting
  // it to 0 always satisfies MIN_ERA_TICKS immediately (tick is always >= 0),
  // so an old save never gets stuck unable to advance its era.
  test('migrates an older save missing phaseSince, defaulting it to 0', () => {
    const { phaseSince, ...rest } = createInitialState();
    const v8 = JSON.stringify({ version: 8, state: rest });
    const restored = deserialize(v8);
    expect(restored.phaseSince).toBe(0);
  });
});

describe('localStorage round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('saveToLocalStorage then loadFromLocalStorage restores the state', () => {
    const state = addResource(createInitialState(), 'lumens', 7);
    saveToLocalStorage(state);
    expect(loadFromLocalStorage()).toEqual(state);
  });

  test('loadFromLocalStorage returns null when nothing is saved', () => {
    expect(loadFromLocalStorage()).toBeNull();
  });

  test('saves under the documented key', () => {
    saveToLocalStorage(createInitialState());
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
  });

  test('falls back to null instead of throwing when the saved payload is corrupted', () => {
    localStorage.setItem(SAVE_KEY, '{"version":1,"state":{}}');
    expect(loadFromLocalStorage()).toBeNull();
  });
});
