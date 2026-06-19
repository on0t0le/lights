import type { BuildingId, GameState, ResearchId } from '../state';
import { canAfford, spendResource } from './resources';

export interface ResearchCard {
  id: ResearchId;
  name: string;
  cost: number;
  requires: ResearchId[];
  /** Era that must be reached before this card can appear. See state.ts's ERAS. */
  phase: number;
  /** Multiplies lumen production when purchased (compounds across cards). */
  lumenMultiplier?: number;
  /** Unlocks these buildings regardless of their normal count-based prerequisite. */
  unlocks?: BuildingId[];
  /**
   * Shifts `state.darkness` when purchased: negative eliminates darkness
   * (the Cosmic Age's "Remove Darkness" branch), positive restores/preserves
   * it (the Balance-ending branch). Neutral (no field) for cards that don't
   * touch darkness at all.
   */
  darknessDelta?: number;
  /**
   * Which endgame branch this card belongs to (Cosmic Age only) - shown on
   * the card (ui/cards.ts) so the two paths read as distinct choices instead
   * of one undifferentiated research list.
   */
  branch?: 'eliminate' | 'preserve';
  /** Minimum accumulated wonder required to buy this card, on top of `requires`. */
  wonderRequired?: number;
  /** Minimum owned count of a building required to buy this card, on top of `requires`. */
  requiresBuilding?: { id: BuildingId; count: number };
}

/**
 * One progression card per era, each requiring the previous era's card and
 * unlocking that era's secondary (power/production) building — together
 * they form the tech spine spanning Fire Age through Cosmic Age. Artificial
 * Sleep softens (doesn't remove) the happiness hit from harsh lights and
 * power plants (happiness.ts) - foreshadows Ending 1's "population enters
 * permanent artificial sleep": numbed to the harm, not freed of it.
 *
 * The Cosmic Age (15) ends in two mutually exclusive-in-spirit branches,
 * tagged so the UI (ui/cards.ts) can label them. Eliminate chips away a
 * named slice of the world's darkness per card, ending at exactly -1 (fully
 * eliminated) once Black Hole Illumination is bought - see darkness.ts,
 * which sums these deltas with no other source of erosion. Preserve instead
 * protects what's left, culminating in Balanced Universe.
 */
export const RESEARCH: Record<ResearchId, ResearchCard> = {
  fireMaking: {
    id: 'fireMaking',
    name: 'Fire Making',
    cost: 30,
    requires: [],
    phase: 1,
    lumenMultiplier: 1.2,
    unlocks: ['torch'],
  },
  oilExtraction: {
    id: 'oilExtraction',
    name: 'Oil Extraction',
    cost: 250,
    requires: ['fireMaking'],
    phase: 2,
    lumenMultiplier: 1.18,
    unlocks: ['oilLamp'],
  },
  gasDistribution: {
    id: 'gasDistribution',
    name: 'Gas Distribution',
    cost: 2000,
    requires: ['oilExtraction'],
    phase: 3,
    lumenMultiplier: 1.2,
    unlocks: ['gasWorks'],
  },
  electricLighting: {
    id: 'electricLighting',
    name: 'Electric Lighting',
    cost: 15000,
    requires: ['gasDistribution'],
    phase: 4,
    lumenMultiplier: 1.25,
    unlocks: ['powerPlant'],
  },
  highVoltageTransmission: {
    id: 'highVoltageTransmission',
    name: 'High Voltage Transmission',
    cost: 120000,
    requires: ['electricLighting'],
    phase: 5,
    lumenMultiplier: 1.3,
    unlocks: ['transformerStation'],
  },
  semiconductorPhysics: {
    id: 'semiconductorPhysics',
    name: 'Semiconductor Physics',
    cost: 900000,
    requires: ['highVoltageTransmission'],
    phase: 6,
    lumenMultiplier: 1.35,
    unlocks: ['chipFactory'],
  },
  nuclearEngineering: {
    id: 'nuclearEngineering',
    name: 'Nuclear Engineering',
    cost: 7000000,
    requires: ['semiconductorPhysics'],
    phase: 7,
    lumenMultiplier: 1.4,
    unlocks: ['nuclearReactor'],
  },
  fusionContainment: {
    id: 'fusionContainment',
    name: 'Fusion Containment',
    cost: 50000000,
    requires: ['nuclearEngineering'],
    phase: 8,
    lumenMultiplier: 1.4,
    unlocks: ['fusionReactor'],
  },
  coldFusionTheory: {
    id: 'coldFusionTheory',
    name: 'Cold Fusion Theory',
    cost: 400000000,
    requires: ['fusionContainment'],
    phase: 9,
    lumenMultiplier: 1.3,
    unlocks: ['compactFusionFactory'],
  },
  // Orbital Construction unlocks both Orbital Age buildings, but Orbital
  // Mirror keeps its existing special unlock rule (progression.ts): research
  // AND a fully-lit civilization, so the player can't leave the ground
  // without first covering Cold Fusion Age in light.
  orbitalConstruction: {
    id: 'orbitalConstruction',
    name: 'Orbital Construction',
    cost: 3000000000,
    requires: ['coldFusionTheory'],
    phase: 10,
    lumenMultiplier: 1.5,
    unlocks: ['orbitalMirror', 'spaceElevator'],
  },
  stellarEngineering: {
    id: 'stellarEngineering',
    name: 'Stellar Engineering',
    cost: 25000000000,
    requires: ['orbitalConstruction'],
    phase: 11,
    lumenMultiplier: 1.4,
    unlocks: ['asteroidMining'],
  },
  megastructureEngineering: {
    id: 'megastructureEngineering',
    name: 'Megastructure Engineering',
    cost: 180000000000,
    requires: ['stellarEngineering'],
    phase: 12,
    lumenMultiplier: 1.4,
    unlocks: ['swarmFabricator'],
  },
  interstellarLogistics: {
    id: 'interstellarLogistics',
    name: 'Interstellar Logistics',
    cost: 1500000000000,
    requires: ['megastructureEngineering'],
    phase: 13,
    lumenMultiplier: 1.3,
    unlocks: ['stellarConstructor'],
  },
  blackHolePhysics: {
    id: 'blackHolePhysics',
    name: 'Black Hole Physics',
    cost: 12000000000000,
    requires: ['interstellarLogistics'],
    phase: 14,
    lumenMultiplier: 1.3,
    unlocks: ['blackHoleHarvester'],
  },
  universalComputation: {
    id: 'universalComputation',
    name: 'Universal Computation',
    cost: 90000000000000,
    requires: ['blackHolePhysics'],
    phase: 15,
    lumenMultiplier: 1.2,
    unlocks: ['realityFoundry'],
  },
  artificialSleep: {
    id: 'artificialSleep',
    name: 'Artificial Sleep',
    cost: 1200000,
    requires: ['semiconductorPhysics'],
    phase: 6,
  },
  eliminateShadows: {
    id: 'eliminateShadows',
    name: 'Eliminate Shadows',
    cost: 200000000000000,
    requires: ['universalComputation'],
    phase: 15,
    darknessDelta: -0.2,
    branch: 'eliminate',
  },
  illuminateOceans: {
    id: 'illuminateOceans',
    name: 'Illuminate Oceans',
    cost: 400000000000000,
    requires: ['eliminateShadows'],
    phase: 15,
    darknessDelta: -0.2,
    branch: 'eliminate',
  },
  illuminateNights: {
    id: 'illuminateNights',
    name: 'Illuminate Nights',
    cost: 800000000000000,
    requires: ['illuminateOceans'],
    phase: 15,
    darknessDelta: -0.2,
    branch: 'eliminate',
  },
  illuminateDeepSpace: {
    id: 'illuminateDeepSpace',
    name: 'Illuminate Deep Space',
    cost: 1600000000000000,
    requires: ['illuminateNights'],
    phase: 15,
    darknessDelta: -0.2,
    branch: 'eliminate',
  },
  blackHoleIllumination: {
    id: 'blackHoleIllumination',
    name: 'Black Hole Illumination',
    cost: 3200000000000000,
    requires: ['illuminateDeepSpace'],
    phase: 15,
    darknessDelta: -0.2, // brings the five Eliminate cards' total to -1: darkness fully eliminated -> Infinite Light ending
    branch: 'eliminate',
  },
  // Preserve branch: instead of eliminating the rest, the player chooses to
  // protect it - the path toward Ending 2 (Balance) rather than Ending 1.
  darknessPreservation: {
    id: 'darknessPreservation',
    name: 'Darkness Preservation',
    cost: 500000000000000,
    requires: ['artificialSleep', 'universalComputation'],
    phase: 15,
    darknessDelta: 0.3,
    branch: 'preserve',
  },
  wonderStudies: {
    id: 'wonderStudies',
    name: 'Wonder Studies',
    cost: 1000000000000000,
    requires: ['darknessPreservation'],
    phase: 15,
    branch: 'preserve',
  },
  // The Balance ending's final card - also requires having actually
  // accumulated wonder (not just the research chain), so the player has to
  // have been nurturing darkness/wonder, not just unlocking cards in order.
  balancedUniverse: {
    id: 'balancedUniverse',
    name: 'Balanced Universe',
    cost: 2000000000000000,
    requires: ['wonderStudies'],
    phase: 15,
    darknessDelta: 0.5, // restores night/shadows/eclipses - the Balance ending
    branch: 'preserve',
    wonderRequired: 50,
  },
};

/** Materials' research-cost discount (issue #2): cost / (1 + MAT_RESEARCH_K * log10(1 + materials)). */
const MAT_RESEARCH_K = 0.1;

/** A card's lumen cost after the materials discount — the actual price `buyResearch` charges. */
export function researchCost(state: GameState, id: ResearchId): number {
  const discount = 1 + MAT_RESEARCH_K * Math.log10(1 + state.resources.materials);
  return RESEARCH[id].cost / discount;
}

export function availableResearch(state: GameState): ResearchCard[] {
  return (Object.values(RESEARCH) as ResearchCard[]).filter(
    (card) =>
      card.phase <= state.phase &&
      !state.research.includes(card.id) &&
      card.requires.every((id) => state.research.includes(id)) &&
      state.resources.wonder >= (card.wonderRequired ?? 0) &&
      (!card.requiresBuilding || state.buildings[card.requiresBuilding.id] >= card.requiresBuilding.count)
  );
}

/** Buys `id` if it's currently available and affordable. Returns `state` unchanged otherwise. */
export function buyResearch(state: GameState, id: ResearchId): GameState {
  const cost = researchCost(state, id);
  const isAvailable = availableResearch(state).some((c) => c.id === id);
  if (!isAvailable || !canAfford(state, 'lumens', cost)) {
    return state;
  }
  const spent = spendResource(state, 'lumens', cost);
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

/** True once any Preserve-branch card has been purchased — darkness.ts uses this to hold darkness at a floor instead of additively overshooting (issue #4). */
export function hasPreserveResearch(state: GameState): boolean {
  return state.research.some((id) => RESEARCH[id].branch === 'preserve');
}
