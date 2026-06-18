import type { BuildingId, GameState } from '../state';
import { BUILDINGS } from '../game/buildings';
import { isUnlockedByResearch } from '../game/research';

/**
 * Owning this many of the prerequisite building unlocks the next one.
 * `null` means no count prerequisite (open as soon as the phase is
 * reached); `'researchOnly'` means there's no count prerequisite either,
 * but - unlike `null` - the building stays locked unless a research card's
 * `unlocks` field names it (see isUnlockedByResearch).
 */
const UNLOCK_REQUIREMENT: Record<
  BuildingId,
  { requires: BuildingId; count: number } | null | 'researchOnly'
> = {
  candle: null,
  lantern: { requires: 'candle', count: 3 },
  streetlamp: { requires: 'lantern', count: 3 },
  lighthouse: { requires: 'streetlamp', count: 3 },
  powerPlant: null,
  neonSign: { requires: 'powerPlant', count: 3 },
  stadiumLights: { requires: 'neonSign', count: 3 },
  // Phase 3 (Planet): Solar Farm opens the phase like Power Plant did for
  // City; Fusion Reactor and Orbital Mirror are gated by research instead
  // of a count prerequisite.
  solarFarm: null,
  fusionReactor: 'researchOnly',
  orbitalMirror: 'researchOnly',
  // Phase 4 (Space): the Dyson Swarm itself, plus White Dwarf Reactor and
  // Stellar Mirror, are all gated by the Dyson Swarms research card - it
  // would otherwise be possible to own (and see swarm rings for) a Dyson
  // Swarm before ever researching it.
  dysonSwarm: 'researchOnly',
  whiteDwarfReactor: 'researchOnly',
  stellarMirror: 'researchOnly',
};

export function isBuildingUnlocked(state: GameState, id: BuildingId): boolean {
  if (state.phase < BUILDINGS[id].phase) {
    return false;
  }
  if (isUnlockedByResearch(state, id)) {
    return true;
  }
  const requirement = UNLOCK_REQUIREMENT[id];
  if (requirement === 'researchOnly') {
    return false;
  }
  if (!requirement) {
    return true;
  }
  return state.buildings[requirement.requires] >= requirement.count;
}

export function currentPhase(state: GameState): number {
  return state.phase;
}

/**
 * Advances Phase 1 -> 2 once the player owns their first Lighthouse, and
 * Phase 2 -> 3 once they own their first Stadium Lights. Never regresses.
 * Spec: contrast is "hidden until midgame" - reveal it on entering Phase 3
 * (Planet), the game's midgame; wonder stays hidden until later.
 */
export function advancePhase(state: GameState): GameState {
  if (state.phase === 1 && state.buildings.lighthouse >= 1) {
    return { ...state, phase: 2 };
  }
  if (state.phase === 2 && state.buildings.stadiumLights >= 1) {
    return {
      ...state,
      phase: 3,
      hiddenResources: state.hiddenResources.filter((id) => id !== 'contrast'),
    };
  }
  // Phase 4 (Space): triggered by the first Orbital Mirror. Spec: wonder is
  // the "Final Resource" - reveal it here, the game's late-game entry point.
  if (state.phase === 3 && state.buildings.orbitalMirror >= 1) {
    return {
      ...state,
      phase: 4,
      hiddenResources: state.hiddenResources.filter((id) => id !== 'wonder'),
    };
  }
  // Phase 5 (Remove Darkness): triggered by owning the first Dyson Swarm, or
  // by having purchased the Dyson Swarms research card outright.
  if (state.phase === 4 && (state.buildings.dysonSwarm >= 1 || state.research.includes('dysonSwarms'))) {
    return { ...state, phase: 5 };
  }
  return state;
}
