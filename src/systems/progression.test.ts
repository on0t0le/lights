import { describe, expect, test } from 'vitest';
import { isBuildingUnlocked, isBuildingVisible, currentPhase, advancePhase } from './progression';
import { createInitialState, type ResourceId } from '../state';

describe('isBuildingUnlocked', () => {
  test('a light source is buyable as soon as its era is reached, no research needed', () => {
    expect(isBuildingUnlocked(createInitialState(), 'campfire')).toBe(true);
  });

  test('a secondary building stays locked without its era research card', () => {
    expect(isBuildingUnlocked(createInitialState(), 'torch')).toBe(false);
  });

  test('a secondary building unlocks once its era research card is bought', () => {
    const state = { ...createInitialState(), research: ['fireMaking' as const] };
    expect(isBuildingUnlocked(state, 'torch')).toBe(true);
  });

  test('every building stays locked before its era is reached, even with later research', () => {
    const state = { ...createInitialState(), phase: 1, research: ['fireMaking' as const, 'oilExtraction' as const] };
    expect(isBuildingUnlocked(state, 'oilLamp')).toBe(false); // requires era 2
  });

  // Issue #8: the Orbital Mirror's leave-the-ground gate is tied to how lit
  // the planet's night sky reads (automation.ts's planetLitFraction, a log
  // ramp off totalLightOutput), not a bare arbitrary lumen number - it reads
  // as a civilization milestone rather than an arbitrary threshold.
  test('Orbital Mirror requires Orbital Construction research AND a fully-lit civilization', () => {
    const dimState = {
      ...createInitialState(),
      phase: 10,
      research: ['orbitalConstruction' as const],
    };
    expect(isBuildingUnlocked(dimState, 'orbitalMirror')).toBe(false); // research alone isn't enough

    const litState = {
      ...dimState,
      buildings: { ...dimState.buildings, torch: 700_000_000_000_000 }, // well past the lit threshold
    };
    expect(isBuildingUnlocked(litState, 'orbitalMirror')).toBe(true);
  });

  test('a fully-lit civilization without the research still leaves Orbital Mirror locked', () => {
    const state = {
      ...createInitialState(),
      phase: 10,
      buildings: { ...createInitialState().buildings, torch: 700_000_000_000_000 },
    };
    expect(isBuildingUnlocked(state, 'orbitalMirror')).toBe(false);
  });

  test('Space Elevator (the other Orbital Construction unlock) has no fully-lit requirement', () => {
    const state = { ...createInitialState(), phase: 10, research: ['orbitalConstruction' as const] };
    expect(isBuildingUnlocked(state, 'spaceElevator')).toBe(true);
  });
});

// Reported request: once on Electric lights, candles/campfires are pointless
// clutter in the buy list. Light sources hide once they're OBSOLETE_GAP (2)
// eras behind; secondaries never hide (they're the supply chain, not a
// cosmetic light pick).
describe('isBuildingVisible', () => {
  test('the current era light source is visible', () => {
    expect(isBuildingVisible({ ...createInitialState(), phase: 3 }, 'gasLamp')).toBe(true);
  });

  test('the previous era light source is still visible (one era lag is fine)', () => {
    expect(isBuildingVisible({ ...createInitialState(), phase: 3 }, 'candle')).toBe(true);
  });

  test('a light source two or more eras behind is hidden', () => {
    expect(isBuildingVisible({ ...createInitialState(), phase: 4 }, 'campfire')).toBe(false);
    expect(isBuildingVisible({ ...createInitialState(), phase: 4 }, 'candle')).toBe(false);
  });

  test('secondary (production) buildings stay visible no matter how far behind they are', () => {
    const state = { ...createInitialState(), phase: 7, research: ['gasDistribution' as const] };
    expect(isBuildingVisible(state, 'gasWorks')).toBe(true);
  });

  test('an obsolete light is still unlocked, just not visible (owned units keep producing)', () => {
    const state = { ...createInitialState(), phase: 4 };
    expect(isBuildingUnlocked(state, 'campfire')).toBe(true);
    expect(isBuildingVisible(state, 'campfire')).toBe(false);
  });
});

describe('currentPhase', () => {
  test('returns the state\'s phase', () => {
    expect(currentPhase({ ...createInitialState(), phase: 7 })).toBe(7);
  });
});

describe('advancePhase', () => {
  // Eras require a minimum number of ticks before they can advance (issue
  // #7), so every fixture below grants enough dwell time via phaseSince.
  function withDwellTime<T extends ReturnType<typeof createInitialState>>(state: T): T {
    return { ...state, tick: 9999, phaseSince: 0 };
  }

  test('stays in Fire Age with no Torch and no Fire Making research', () => {
    const next = advancePhase(withDwellTime(createInitialState()));
    expect(next.phase).toBe(1);
  });

  test('advances Fire Age -> Lamp Age once Fire Making research is bought AND a Torch is owned', () => {
    const state = withDwellTime({
      ...createInitialState(),
      research: ['fireMaking' as const],
      buildings: { ...createInitialState().buildings, torch: 1 },
    });
    expect(advancePhase(state).phase).toBe(2);
  });

  test('stays in Fire Age with Fire Making research bought but no Torch owned', () => {
    const state = withDwellTime({ ...createInitialState(), research: ['fireMaking' as const] });
    expect(advancePhase(state).phase).toBe(1);
  });

  test('stays in Fire Age with a Torch owned but Fire Making research not recorded as bought', () => {
    // Artificial state (Torch is normally research-gated to buy) that
    // exercises the AND requirement directly: owning the secondary building
    // alone, without the era's research card, no longer advances the era.
    const state = withDwellTime({ ...createInitialState(), buildings: { ...createInitialState().buildings, torch: 1 } });
    expect(advancePhase(state).phase).toBe(1);
  });

  test('advancing Lamp Age -> Gas Age reveals fuel', () => {
    const state = withDwellTime({
      ...createInitialState(),
      phase: 2,
      hiddenResources: ['fuel', 'materials', 'exotic'] as ResourceId[],
      research: ['oilExtraction' as const],
      buildings: { ...createInitialState().buildings, oilLamp: 1 },
    });
    const next = advancePhase(state);
    expect(next.phase).toBe(3);
    expect(next.hiddenResources.sort()).toEqual(['exotic', 'materials']);
  });

  test('advancing LED Age -> Nuclear Age reveals materials', () => {
    const state = withDwellTime({
      ...createInitialState(),
      phase: 6,
      hiddenResources: ['materials', 'exotic'] as ResourceId[],
      research: ['semiconductorPhysics' as const],
      buildings: { ...createInitialState().buildings, chipFactory: 1 },
    });
    const next = advancePhase(state);
    expect(next.phase).toBe(7);
    expect(next.hiddenResources.sort()).toEqual(['exotic']);
  });

  test('advancing Nuclear Age -> Fusion Age reveals exotic matter', () => {
    const state = withDwellTime({
      ...createInitialState(),
      phase: 7,
      hiddenResources: ['exotic'] as ResourceId[],
      research: ['nuclearEngineering' as const],
      buildings: { ...createInitialState().buildings, nuclearReactor: 1 },
    });
    const next = advancePhase(state);
    expect(next.phase).toBe(8);
    expect(next.hiddenResources).toEqual([]);
  });

  test('advances every remaining era through Galactic Age -> Cosmic Age', () => {
    const state = withDwellTime({
      ...createInitialState(),
      phase: 14,
      research: ['blackHolePhysics' as const],
      buildings: { ...createInitialState().buildings, blackHoleHarvester: 1 },
    });
    expect(advancePhase(state).phase).toBe(15);
  });

  test('Cosmic Age (the final era) never advances further', () => {
    const state = withDwellTime({ ...createInitialState(), phase: 15, research: ['universalComputation' as const] });
    expect(advancePhase(state).phase).toBe(15);
  });

  test('does not mutate the original state', () => {
    const state = withDwellTime({
      ...createInitialState(),
      research: ['fireMaking' as const],
      buildings: { ...createInitialState().buildings, torch: 1 },
    });
    advancePhase(state);
    expect(state.phase).toBe(1);
  });

  // Issue #7: minimum era exposure - even with the research+building trigger
  // otherwise satisfied, an era can't be skipped through in a single tick.
  describe('minimum era exposure', () => {
    test('blocks advancing before the minimum dwell time has elapsed', () => {
      const state = {
        ...createInitialState(),
        tick: 1,
        phaseSince: 0,
        research: ['fireMaking' as const],
        buildings: { ...createInitialState().buildings, torch: 1 },
      };
      expect(advancePhase(state).phase).toBe(1);
    });

    test('allows advancing once the minimum dwell time has elapsed', () => {
      const state = {
        ...createInitialState(),
        tick: 9999,
        phaseSince: 0,
        research: ['fireMaking' as const],
        buildings: { ...createInitialState().buildings, torch: 1 },
      };
      expect(advancePhase(state).phase).toBe(2);
    });

    test('records phaseSince as the advancing tick on a successful advance', () => {
      const state = {
        ...createInitialState(),
        tick: 9999,
        phaseSince: 0,
        research: ['fireMaking' as const],
        buildings: { ...createInitialState().buildings, torch: 1 },
      };
      expect(advancePhase(state).phaseSince).toBe(9999);
    });

    test('leaves phaseSince untouched when the era does not advance', () => {
      const state = { ...createInitialState(), tick: 1, phaseSince: 0 };
      expect(advancePhase(state).phaseSince).toBe(0);
    });
  });
});
