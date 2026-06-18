import type { BuildingId, GameState, ResearchId } from '../state';
import { canAfford, spendResource } from './resources';

export interface ResearchCard {
  id: ResearchId;
  name: string;
  cost: number;
  requires: ResearchId[];
  /** Phase that must be reached before this card can appear. */
  phase: number;
  /** Multiplies lumen production when purchased (compounds across cards). */
  lumenMultiplier?: number;
  /** Unlocks these buildings regardless of their normal count-based prerequisite. */
  unlocks?: BuildingId[];
  /**
   * Shifts `state.darkness` when purchased: negative eliminates darkness
   * (Phase 5's "Remove Darkness" research), positive restores/preserves it
   * (the Balance-ending branch). Neutral (no field) for cards that don't
   * touch darkness at all.
   */
  darknessDelta?: number;
}

/**
 * Full spec catalog (Candle Making through Balanced Universe). Cards with
 * phase >= 3 are defined but never surface in availableResearch() yet -
 * Phase 3+ systems (Planet, Space, Remove Darkness) aren't implemented.
 */
export const RESEARCH: Record<ResearchId, ResearchCard> = {
  candleMaking: { id: 'candleMaking', name: 'Candle Making', cost: 40, requires: [], phase: 1, lumenMultiplier: 1.2 },
  streetElectricity: {
    id: 'streetElectricity',
    name: 'Street Electricity',
    cost: 600,
    requires: ['candleMaking'],
    phase: 1,
    lumenMultiplier: 1.15,
    unlocks: ['streetlamp'],
  },
  leds: { id: 'leds', name: 'LEDs', cost: 5000, requires: ['streetElectricity'], phase: 2, lumenMultiplier: 1.5 },
  fusionPower: {
    id: 'fusionPower',
    name: 'Fusion Power',
    cost: 40000,
    requires: ['leds'],
    phase: 3,
    lumenMultiplier: 1.4,
    unlocks: ['fusionReactor'],
  },
  orbitalMirrors: {
    id: 'orbitalMirrors',
    name: 'Orbital Mirrors',
    cost: 120000,
    requires: ['fusionPower'],
    phase: 3,
    lumenMultiplier: 1.5,
    unlocks: ['orbitalMirror'],
  },
  // Phase 4 (Space): all three Phase 4 buildings - including Dyson Swarm
  // itself - stay locked until this card is bought, so the building (and
  // its swarm-ring visual) can never appear before the research does.
  dysonSwarms: {
    id: 'dysonSwarms',
    name: 'Dyson Swarms',
    cost: 350000,
    requires: ['orbitalMirrors'],
    phase: 4,
    lumenMultiplier: 1.4,
    unlocks: ['dysonSwarm', 'whiteDwarfReactor', 'stellarMirror'],
  },
  // Reduces the Phase 3 insomnia/sleep-disruption penalty (happiness.ts) -
  // foreshadows the spec's Ending 1 ("population enters permanent artificial sleep").
  artificialSleep: { id: 'artificialSleep', name: 'Artificial Sleep', cost: 60000, requires: ['leds'], phase: 3 },
  // Phase 5 (Remove Darkness): each Illuminate card chips away a named slice
  // of the world's darkness; Black Hole Illumination finishes the job
  // (spec: "eventually only black holes remain dark").
  eliminateShadows: {
    id: 'eliminateShadows',
    name: 'Eliminate Shadows',
    cost: 300000,
    requires: ['dysonSwarms'],
    phase: 5,
    darknessDelta: -0.2,
  },
  illuminateOceans: {
    id: 'illuminateOceans',
    name: 'Illuminate Oceans',
    cost: 600000,
    requires: ['eliminateShadows'],
    phase: 5,
    darknessDelta: -0.2,
  },
  illuminateNights: {
    id: 'illuminateNights',
    name: 'Illuminate Nights',
    cost: 1200000,
    requires: ['illuminateOceans'],
    phase: 5,
    darknessDelta: -0.2,
  },
  illuminateDeepSpace: {
    id: 'illuminateDeepSpace',
    name: 'Illuminate Deep Space',
    cost: 2500000,
    requires: ['illuminateNights'],
    phase: 5,
    darknessDelta: -0.2,
  },
  blackHoleIllumination: {
    id: 'blackHoleIllumination',
    name: 'Black Hole Illumination',
    cost: 5000000,
    requires: ['illuminateDeepSpace'],
    phase: 5,
    darknessDelta: -0.2, // brings the four Illuminate cards' total to -1: darkness fully eliminated
  },
  // Alternate branch: instead of eliminating the rest, the player chooses to
  // preserve it - the path toward Ending 2 (Balance) rather than Ending 1.
  darknessPreservation: {
    id: 'darknessPreservation',
    name: 'Darkness Preservation',
    cost: 800000,
    requires: ['artificialSleep'],
    phase: 5,
    darknessDelta: 0.3,
  },
  wonderStudies: {
    id: 'wonderStudies',
    name: 'Wonder Studies',
    cost: 1500000,
    requires: ['darknessPreservation'],
    phase: 5,
  },
  balancedUniverse: {
    id: 'balancedUniverse',
    name: 'Balanced Universe',
    cost: 3000000,
    requires: ['wonderStudies'],
    phase: 5,
    darknessDelta: 0.5, // restores night/clouds/shadows/eclipses - the Balance ending
  },
};

export function availableResearch(state: GameState): ResearchCard[] {
  return (Object.values(RESEARCH) as ResearchCard[]).filter(
    (card) =>
      card.phase <= state.phase &&
      !state.research.includes(card.id) &&
      card.requires.every((id) => state.research.includes(id))
  );
}

/** Buys `id` if it's currently available and affordable. Returns `state` unchanged otherwise. */
export function buyResearch(state: GameState, id: ResearchId): GameState {
  const card = RESEARCH[id];
  const isAvailable = availableResearch(state).some((c) => c.id === id);
  if (!isAvailable || !canAfford(state, 'lumens', card.cost)) {
    return state;
  }
  const spent = spendResource(state, 'lumens', card.cost);
  return { ...spent, research: [...spent.research, id] };
}

/** Product of all purchased cards' lumenMultiplier; 1 (neutral) with no research. */
export function researchLumenMultiplier(state: GameState): number {
  return state.research.reduce((mult, id) => mult * (RESEARCH[id].lumenMultiplier ?? 1), 1);
}

/** True if any purchased research card unlocks `buildingId`, independent of count-based prereqs. */
export function isUnlockedByResearch(state: GameState, buildingId: BuildingId): boolean {
  return state.research.some((id) => RESEARCH[id].unlocks?.includes(buildingId) ?? false);
}

/** Sum of all purchased cards' darknessDelta; 0 (neutral) with no relevant research. */
export function researchDarknessDelta(state: GameState): number {
  return state.research.reduce((sum, id) => sum + (RESEARCH[id].darknessDelta ?? 0), 0);
}
