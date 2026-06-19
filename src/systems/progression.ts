import type { BuildingId, GameState, ResearchId, ResourceId } from '../state';
import { ERAS, FINAL_ERA, hiddenForEra } from '../state';
import { BUILDINGS } from '../game/buildings';
import { isUnlockedByResearch } from '../game/research';
import { planetLitFraction } from './automation';

/** Era dwell lock (issue #7): minimum ticks a civilization must spend in an era before it can advance again, even once the trigger is otherwise satisfied. */
const MIN_ERA_TICKS = 50;

/** Fraction of planetLitFraction (issue #8) the previous era's civilization must reach before the Orbital Mirror leaves the ground. */
const ORBITAL_LIT_THRESHOLD = 0.6;

/** Each era's secondary (power/production) building — see game/buildings.ts. */
const SECONDARY_BUILDING: Record<number, BuildingId> = {
  1: 'torch',
  2: 'oilLamp',
  3: 'gasWorks',
  4: 'powerPlant',
  5: 'transformerStation',
  6: 'chipFactory',
  7: 'nuclearReactor',
  8: 'fusionReactor',
  9: 'compactFusionFactory',
  10: 'spaceElevator',
  11: 'asteroidMining',
  12: 'swarmFabricator',
  13: 'stellarConstructor',
  14: 'blackHoleHarvester',
  15: 'realityFoundry',
};

/** Each era's progression research card — see game/research.ts. */
const ERA_RESEARCH: Record<number, ResearchId> = {
  1: 'fireMaking',
  2: 'oilExtraction',
  3: 'gasDistribution',
  4: 'electricLighting',
  5: 'highVoltageTransmission',
  6: 'semiconductorPhysics',
  7: 'nuclearEngineering',
  8: 'fusionContainment',
  9: 'coldFusionTheory',
  10: 'orbitalConstruction',
  11: 'stellarEngineering',
  12: 'megastructureEngineering',
  13: 'interstellarLogistics',
  14: 'blackHolePhysics',
  15: 'universalComputation',
};

/**
 * Light sources are buyable as soon as their era is reached (no count
 * prerequisite); secondary buildings are research-gated by that era's
 * progression card, so the building (and any visual it unlocks) can never
 * appear before the research does.
 */
const UNLOCK_REQUIREMENT: Record<BuildingId, null | 'researchOnly'> = ERAS.reduce(
  (acc, era) => {
    acc[era.lightSource] = null;
    acc[SECONDARY_BUILDING[era.id]!] = 'researchOnly';
    return acc;
  },
  {} as Record<BuildingId, null | 'researchOnly'>
);

export function isBuildingUnlocked(state: GameState, id: BuildingId): boolean {
  if (state.phase < BUILDINGS[id].phase) {
    return false;
  }
  // Orbital Mirror is the gateway to the Orbital Age: it requires the
  // Orbital Construction research card AND the previous era's
  // civilization being fully lit, so the player can't leave the ground
  // without first covering Cold Fusion Age in light. This bypasses the
  // generic isUnlockedByResearch short-circuit below, which would
  // otherwise unlock it from research alone.
  if (id === 'orbitalMirror') {
    return isUnlockedByResearch(state, id) && planetLitFraction(state) >= ORBITAL_LIT_THRESHOLD;
  }
  if (isUnlockedByResearch(state, id)) {
    return true;
  }
  return UNLOCK_REQUIREMENT[id] !== 'researchOnly';
}

export function currentPhase(state: GameState): number {
  return state.phase;
}

function ownsEraSecondary(state: GameState, era: number): boolean {
  return state.buildings[SECONDARY_BUILDING[era]!] >= 1;
}

interface EraTrigger {
  /** True once the civilization is ready to advance past this era. */
  test: (state: GameState) => boolean;
  /** Resources to reveal (un-hide) on advancing past this era. */
  reveal?: ResourceId[];
}

/**
 * One trigger per era: a civilization advances once it has purchased that
 * era's research card AND owns its era's secondary building. Requiring both
 * (rather than either) means a player can't skip past an era having only
 * engaged with one half of it — e.g. buying the research card alone used to
 * advance the era without ever building the secondary that defines it. Note
 * that secondaries are themselves research-gated to buy (isUnlockedByResearch
 * in this file), so in practice owning the secondary already implies the
 * research was bought — the AND mainly closes the "research-only" skip.
 * A few transitions also reveal a previously hidden resource (state.ts's
 * hiddenForEra), staged to when that resource starts mattering: fuel with
 * the Gas Age, materials with the Nuclear Age, exotic matter with the Fusion
 * Age. Wonder is visible from the very start (issue #3) and is never staged
 * here.
 */
function boughtEraResearch(state: GameState, era: number): boolean {
  return state.research.includes(ERA_RESEARCH[era]!);
}

const ERA_TRIGGERS: Record<number, EraTrigger> = {
  1: { test: (s) => ownsEraSecondary(s, 1) && boughtEraResearch(s, 1) },
  2: { test: (s) => ownsEraSecondary(s, 2) && boughtEraResearch(s, 2), reveal: ['fuel'] },
  3: { test: (s) => ownsEraSecondary(s, 3) && boughtEraResearch(s, 3) },
  4: { test: (s) => ownsEraSecondary(s, 4) && boughtEraResearch(s, 4) },
  5: { test: (s) => ownsEraSecondary(s, 5) && boughtEraResearch(s, 5) },
  6: { test: (s) => ownsEraSecondary(s, 6) && boughtEraResearch(s, 6), reveal: ['materials'] },
  7: { test: (s) => ownsEraSecondary(s, 7) && boughtEraResearch(s, 7), reveal: ['exotic'] },
  8: { test: (s) => ownsEraSecondary(s, 8) && boughtEraResearch(s, 8) },
  9: { test: (s) => ownsEraSecondary(s, 9) && boughtEraResearch(s, 9) },
  10: { test: (s) => ownsEraSecondary(s, 10) && boughtEraResearch(s, 10) },
  11: { test: (s) => ownsEraSecondary(s, 11) && boughtEraResearch(s, 11) },
  12: { test: (s) => ownsEraSecondary(s, 12) && boughtEraResearch(s, 12) },
  13: { test: (s) => ownsEraSecondary(s, 13) && boughtEraResearch(s, 13) },
  14: { test: (s) => ownsEraSecondary(s, 14) && boughtEraResearch(s, 14) },
  // Era 15 (Cosmic Age) is the final era — no further advance, just the
  // eliminate/preserve endgame branch (systems/endings.ts).
};

/**
 * Advances through the fifteen eras (Fire Age -> ... -> Cosmic Age), each
 * triggered by owning that era's secondary building AND buying its research
 * card — never regresses. See hiddenForEra's staged resource reveals, kept
 * in sync with ERA_TRIGGERS's `reveal` fields. Also enforces MIN_ERA_TICKS
 * (issue #7): a civilization must dwell in an era for a minimum stretch
 * before it can advance again, even once the trigger is otherwise satisfied
 * — this keeps a sudden resource windfall from skipping straight through
 * several eras in one tick.
 */
export function advancePhase(state: GameState): GameState {
  if (state.phase >= FINAL_ERA) {
    return state;
  }
  if (state.tick - state.phaseSince < MIN_ERA_TICKS) {
    return state;
  }
  const trigger = ERA_TRIGGERS[state.phase];
  if (!trigger || !trigger.test(state)) {
    return state;
  }
  const nextPhase = state.phase + 1;
  if (!trigger.reveal || trigger.reveal.length === 0) {
    return { ...state, phase: nextPhase, phaseSince: state.tick };
  }
  const stillHidden = hiddenForEra(nextPhase);
  return {
    ...state,
    phase: nextPhase,
    phaseSince: state.tick,
    hiddenResources: state.hiddenResources.filter((id) => stillHidden.includes(id)),
  };
}
