import { describe, expect, test } from 'vitest';
import { isBuildingUnlocked, currentPhase, advancePhase } from './progression';
import { createInitialState } from '../state';

describe('isBuildingUnlocked', () => {
  test('candle is unlocked from the start', () => {
    expect(isBuildingUnlocked(createInitialState(), 'candle')).toBe(true);
  });

  test('lantern is locked until enough candles are owned', () => {
    const state = createInitialState();
    expect(isBuildingUnlocked(state, 'lantern')).toBe(false);
    const withCandles = { ...state, buildings: { ...state.buildings, candle: 3 } };
    expect(isBuildingUnlocked(withCandles, 'lantern')).toBe(true);
  });

  test('streetlamp is locked until enough lanterns are owned', () => {
    const state = createInitialState();
    expect(isBuildingUnlocked(state, 'streetlamp')).toBe(false);
    const withLanterns = { ...state, buildings: { ...state.buildings, lantern: 3 } };
    expect(isBuildingUnlocked(withLanterns, 'streetlamp')).toBe(true);
  });

  test('lighthouse is locked until enough streetlamps are owned', () => {
    const state = createInitialState();
    expect(isBuildingUnlocked(state, 'lighthouse')).toBe(false);
    const withStreetlamps = { ...state, buildings: { ...state.buildings, streetlamp: 3 } };
    expect(isBuildingUnlocked(withStreetlamps, 'lighthouse')).toBe(true);
  });

  test('Phase 2 buildings are locked while still in Phase 1, regardless of building counts', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, lighthouse: 99 } };
    expect(isBuildingUnlocked(state, 'powerPlant')).toBe(false);
    expect(isBuildingUnlocked(state, 'neonSign')).toBe(false);
    expect(isBuildingUnlocked(state, 'stadiumLights')).toBe(false);
  });

  test('Power Plant unlocks immediately on entering Phase 2, no prerequisite count', () => {
    const state = { ...createInitialState(), phase: 2 };
    expect(isBuildingUnlocked(state, 'powerPlant')).toBe(true);
  });

  test('Neon Sign is locked in Phase 2 until enough Power Plants are owned', () => {
    const state = { ...createInitialState(), phase: 2 };
    expect(isBuildingUnlocked(state, 'neonSign')).toBe(false);
    const withPlants = { ...state, buildings: { ...state.buildings, powerPlant: 3 } };
    expect(isBuildingUnlocked(withPlants, 'neonSign')).toBe(true);
  });

  test('Stadium Lights is locked in Phase 2 until enough Neon Signs are owned', () => {
    const state = { ...createInitialState(), phase: 2 };
    expect(isBuildingUnlocked(state, 'stadiumLights')).toBe(false);
    const withSigns = { ...state, buildings: { ...state.buildings, neonSign: 3 } };
    expect(isBuildingUnlocked(withSigns, 'stadiumLights')).toBe(true);
  });
});

describe('isBuildingUnlocked with research', () => {
  test('Streetlamp unlocks via Street Electricity research even without enough lanterns', () => {
    const state = { ...createInitialState(), research: ['streetElectricity' as const] };
    expect(isBuildingUnlocked(state, 'streetlamp')).toBe(true);
  });
});

describe('isBuildingUnlocked for Phase 3', () => {
  test('Phase 3 buildings are locked while still in Phase 2', () => {
    const state = { ...createInitialState(), phase: 2 as const };
    expect(isBuildingUnlocked(state, 'solarFarm')).toBe(false);
    expect(isBuildingUnlocked(state, 'fusionReactor')).toBe(false);
    expect(isBuildingUnlocked(state, 'orbitalMirror')).toBe(false);
  });

  test('Solar Farm unlocks immediately on entering Phase 3, no prerequisite count', () => {
    const state = { ...createInitialState(), phase: 3 as const };
    expect(isBuildingUnlocked(state, 'solarFarm')).toBe(true);
  });

  test('Fusion Reactor stays locked in Phase 3 until Fusion Power research is purchased', () => {
    const state = { ...createInitialState(), phase: 3 as const };
    expect(isBuildingUnlocked(state, 'fusionReactor')).toBe(false);
    const withResearch = { ...state, research: ['fusionPower' as const] };
    expect(isBuildingUnlocked(withResearch, 'fusionReactor')).toBe(true);
  });

  test('Orbital Mirror stays locked in Phase 3 until Orbital Mirrors research is purchased', () => {
    const state = { ...createInitialState(), phase: 3 as const };
    expect(isBuildingUnlocked(state, 'orbitalMirror')).toBe(false);
    const withResearch = { ...state, research: ['orbitalMirrors' as const] };
    expect(isBuildingUnlocked(withResearch, 'orbitalMirror')).toBe(true);
  });
});

describe('isBuildingUnlocked for Phase 4', () => {
  test('Phase 4 buildings are locked while still in Phase 3', () => {
    const state = { ...createInitialState(), phase: 3 as const };
    expect(isBuildingUnlocked(state, 'dysonSwarm')).toBe(false);
    expect(isBuildingUnlocked(state, 'whiteDwarfReactor')).toBe(false);
    expect(isBuildingUnlocked(state, 'stellarMirror')).toBe(false);
  });

  test('Dyson Swarm unlocks immediately on entering Phase 4, no prerequisite count', () => {
    const state = { ...createInitialState(), phase: 4 as const };
    expect(isBuildingUnlocked(state, 'dysonSwarm')).toBe(true);
  });

  test('White Dwarf Reactor and Stellar Mirror stay locked in Phase 4 until Dyson Swarms research is purchased', () => {
    const state = { ...createInitialState(), phase: 4 as const };
    expect(isBuildingUnlocked(state, 'whiteDwarfReactor')).toBe(false);
    expect(isBuildingUnlocked(state, 'stellarMirror')).toBe(false);
    const withResearch = { ...state, research: ['dysonSwarms' as const] };
    expect(isBuildingUnlocked(withResearch, 'whiteDwarfReactor')).toBe(true);
    expect(isBuildingUnlocked(withResearch, 'stellarMirror')).toBe(true);
  });
});

describe('currentPhase', () => {
  test('returns the phase recorded on state', () => {
    expect(currentPhase(createInitialState())).toBe(1);
  });
});

describe('advancePhase', () => {
  test('stays in Phase 1 with no Lighthouse owned', () => {
    expect(advancePhase(createInitialState()).phase).toBe(1);
  });

  test('advances to Phase 2 once the first Lighthouse is owned', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, lighthouse: 1 } };
    expect(advancePhase(state).phase).toBe(2);
  });

  test('does not regress to Phase 1 once already in Phase 2', () => {
    const state = { ...createInitialState(), phase: 2 };
    expect(advancePhase(state).phase).toBe(2);
  });

  test('does not mutate the original state', () => {
    const state = { ...createInitialState(), buildings: { ...createInitialState().buildings, lighthouse: 1 } };
    advancePhase(state);
    expect(state.phase).toBe(1);
  });

  test('advances to Phase 3 once the first Stadium Lights is owned', () => {
    const state = {
      ...createInitialState(),
      phase: 2 as const,
      buildings: { ...createInitialState().buildings, stadiumLights: 1 },
    };
    expect(advancePhase(state).phase).toBe(3);
  });

  test('does not regress to Phase 2 once already in Phase 3', () => {
    const state = { ...createInitialState(), phase: 3 as const };
    expect(advancePhase(state).phase).toBe(3);
  });

  // Spec: contrast is "hidden until midgame" - Phase 3 (Planet) is midgame.
  test('reveals contrast on advancing to Phase 3, but wonder stays hidden', () => {
    const state = {
      ...createInitialState(),
      phase: 2 as const,
      buildings: { ...createInitialState().buildings, stadiumLights: 1 },
    };
    const next = advancePhase(state);
    expect(next.hiddenResources).not.toContain('contrast');
    expect(next.hiddenResources).toContain('wonder');
  });

  test('does not touch hiddenResources when not transitioning to Phase 3', () => {
    const state = createInitialState();
    expect(advancePhase(state).hiddenResources).toEqual(state.hiddenResources);
  });

  test('advances to Phase 4 once the first Orbital Mirror is owned, and reveals wonder', () => {
    const state = {
      ...createInitialState(),
      phase: 3 as const,
      buildings: { ...createInitialState().buildings, orbitalMirror: 1 },
    };
    const next = advancePhase(state);
    expect(next.phase).toBe(4);
    expect(next.hiddenResources).not.toContain('wonder');
  });

  test('does not regress to Phase 3 once already in Phase 4', () => {
    const state = { ...createInitialState(), phase: 4 as const };
    expect(advancePhase(state).phase).toBe(4);
  });

  test('advances to Phase 5 once the first Dyson Swarm is owned', () => {
    const state = {
      ...createInitialState(),
      phase: 4 as const,
      buildings: { ...createInitialState().buildings, dysonSwarm: 1 },
    };
    expect(advancePhase(state).phase).toBe(5);
  });

  test('advances to Phase 5 once Dyson Swarms research is purchased, even with no Dyson Swarm owned', () => {
    const state = { ...createInitialState(), phase: 4 as const, research: ['dysonSwarms' as const] };
    expect(advancePhase(state).phase).toBe(5);
  });

  test('does not regress to Phase 4 once already in Phase 5', () => {
    const state = { ...createInitialState(), phase: 5 as const };
    expect(advancePhase(state).phase).toBe(5);
  });
});
