import { describe, expect, test, beforeEach } from 'vitest';
import { createInitialState } from '../state';
import { addResource } from './resources';
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
    expect((JSON.parse(json) as { version: number }).version).toBe(4);
  });

  test('migrates a v1 save missing the Phase 2 building keys, backfilling them to 0', () => {
    const v1 = JSON.stringify({
      version: 1,
      state: {
        resources: { lumens: 5, energy: 0, happiness: 0.5, contrast: 0, wonder: 0 },
        hiddenResources: ['contrast', 'wonder'],
        buildings: { candle: 2, lantern: 0, streetlamp: 0, lighthouse: 0 },
        tick: 10,
        dayNightClock: 0.1,
        phase: 1,
      },
    });
    const restored = deserialize(v1);
    expect(restored.buildings).toEqual({
      candle: 2,
      lantern: 0,
      streetlamp: 0,
      lighthouse: 0,
      powerPlant: 0,
      neonSign: 0,
      stadiumLights: 0,
      solarFarm: 0,
      fusionReactor: 0,
      orbitalMirror: 0,
      dysonSwarm: 0,
      whiteDwarfReactor: 0,
      stellarMirror: 0,
    });
  });

  test('migrates a v1 save missing phase, defaulting to Phase 1', () => {
    const v1 = JSON.stringify({
      version: 1,
      state: {
        resources: { lumens: 5, energy: 0, happiness: 0.5, contrast: 0, wonder: 0 },
        hiddenResources: ['contrast', 'wonder'],
        buildings: { candle: 2, lantern: 0, streetlamp: 0, lighthouse: 0 },
        tick: 10,
        dayNightClock: 0.1,
      },
    });
    const restored = deserialize(v1);
    expect(restored.phase).toBe(1);
  });

  test('migrates a v2 save missing research/events/priorities, backfilling neutral defaults', () => {
    const v2 = JSON.stringify({
      version: 2,
      state: {
        resources: { lumens: 5, energy: 0, happiness: 0.5, contrast: 0, wonder: 0 },
        hiddenResources: ['contrast', 'wonder'],
        buildings: { candle: 2, lantern: 0, streetlamp: 0, lighthouse: 0, powerPlant: 0, neonSign: 0, stadiumLights: 0 },
        tick: 10,
        dayNightClock: 0.1,
        phase: 1,
      },
    });
    const restored = deserialize(v2);
    expect(restored.research).toEqual([]);
    expect(restored.activeEvent).toBeNull();
    expect(restored.eventCooldownTicks).toBe(0);
    expect(restored.priorities).toEqual({
      lumens: 0.5,
      energy: 0.5,
      happiness: 0.5,
      contrast: 0.5,
      wonder: 0.5,
    });
  });

  test('migrates a pre-Phase-4 (v3) save missing darkness/ending and Phase 3/4 building keys, defaulting cleanly', () => {
    const v3 = JSON.stringify({
      version: 3,
      state: {
        resources: { lumens: 5, energy: 0, happiness: 0.5, contrast: 0, wonder: 0 },
        hiddenResources: ['wonder'],
        buildings: {
          candle: 5,
          lantern: 3,
          streetlamp: 0,
          lighthouse: 0,
          powerPlant: 0,
          neonSign: 0,
          stadiumLights: 0,
        },
        tick: 100,
        dayNightClock: 0.3,
        phase: 3,
        research: ['candleMaking'],
        activeEvent: null,
        eventCooldownTicks: 0,
        priorities: {
          lumens: 0.5,
          energy: 0.5,
          happiness: 0.5,
          contrast: 0.5,
          wonder: 0.5,
        },
      },
    });
    const restored = deserialize(v3);
    expect(restored.buildings).toMatchObject({
      solarFarm: 0,
      fusionReactor: 0,
      orbitalMirror: 0,
      dysonSwarm: 0,
      whiteDwarfReactor: 0,
      stellarMirror: 0,
    });
    expect(restored.darkness).toBe(1);
    expect(restored.ending).toBeNull();
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
