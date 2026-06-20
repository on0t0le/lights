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
  /** Minimum owned count of a building required to buy this card, on top of `requires`. */
  requiresBuilding?: { id: BuildingId; count: number };
  /** Plain-language explanation of what this card does, shown on its card (ui/cards.ts) for cards whose effect isn't self-evident from the mechanical fields. */
  description?: string;
}

/**
 * One progression card per era, each requiring the previous era's card and
 * unlocking that era's secondary (power/production) building — together
 * they form the tech spine spanning Fire Age through Cosmic Age.
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
    description: 'Tame fire into a portable light - unlocks the Torch.',
  },
  oilExtraction: {
    id: 'oilExtraction',
    name: 'Oil Extraction',
    cost: 250,
    requires: ['fireMaking'],
    phase: 2,
    lumenMultiplier: 1.18,
    unlocks: ['oilLamp'],
    description: 'Refine crude oil into lamp fuel, brighter and steadier than open flame.',
  },
  gasDistribution: {
    id: 'gasDistribution',
    name: 'Gas Distribution',
    cost: 2000,
    requires: ['oilExtraction'],
    phase: 3,
    lumenMultiplier: 1.2,
    unlocks: ['gasWorks', 'gasLamp'],
    description: 'Pipe town gas to every lamp - unlocks Gas Works, which feeds your Gas Lamps fuel.',
  },
  electricLighting: {
    id: 'electricLighting',
    name: 'Electric Lighting',
    cost: 15000,
    requires: ['gasDistribution'],
    phase: 4,
    lumenMultiplier: 1.25,
    unlocks: ['powerPlant', 'incandescentBulb'],
    description: 'Harness electricity - unlocks the Power Plant, the first energy source for electric lights.',
  },
  highVoltageTransmission: {
    id: 'highVoltageTransmission',
    name: 'High Voltage Transmission',
    cost: 120000,
    requires: ['electricLighting'],
    phase: 5,
    lumenMultiplier: 1.3,
    unlocks: ['transformerStation', 'arcLamp'],
    description: 'Move power over long distances with minimal loss - unlocks the Transformer Station.',
  },
  semiconductorPhysics: {
    id: 'semiconductorPhysics',
    name: 'Semiconductor Physics',
    cost: 900000,
    requires: ['highVoltageTransmission'],
    phase: 6,
    lumenMultiplier: 1.35,
    unlocks: ['chipFactory', 'ledLamp'],
    description: 'Mass-produce semiconductors - unlocks the Chip Factory, which builds materials for everything that follows.',
  },
  nuclearEngineering: {
    id: 'nuclearEngineering',
    name: 'Nuclear Engineering',
    cost: 7000000,
    requires: ['semiconductorPhysics'],
    phase: 7,
    lumenMultiplier: 1.4,
    unlocks: ['nuclearReactor', 'nuclearLightGrid'],
    description: 'Split the atom for power - unlocks the Nuclear Reactor, a massive energy source for the grid.',
  },
  fusionContainment: {
    id: 'fusionContainment',
    name: 'Fusion Containment',
    cost: 50000000,
    requires: ['nuclearEngineering'],
    phase: 8,
    lumenMultiplier: 1.4,
    unlocks: ['fusionReactor', 'fusionSun'],
    description: 'Contain a sustained fusion reaction - unlocks the Fusion Reactor.',
  },
  coldFusionTheory: {
    id: 'coldFusionTheory',
    name: 'Cold Fusion Theory',
    cost: 400000000,
    requires: ['fusionContainment'],
    phase: 9,
    lumenMultiplier: 1.3,
    unlocks: ['compactFusionFactory', 'planetaryLightGrid'],
    description: 'Shrink fusion down to factory scale - unlocks the Compact Fusion Factory.',
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
    description: 'Leave the ground - unlocks the Space Elevator and the Orbital Mirror (which also needs the planet fully lit first).',
  },
  stellarEngineering: {
    id: 'stellarEngineering',
    name: 'Stellar Engineering',
    cost: 25000000000,
    requires: ['orbitalConstruction'],
    phase: 11,
    lumenMultiplier: 1.4,
    unlocks: ['asteroidMining', 'starReflector'],
    description: 'Engineer at stellar scale - unlocks Asteroid Mining for raw materials from space.',
  },
  megastructureEngineering: {
    id: 'megastructureEngineering',
    name: 'Megastructure Engineering',
    cost: 180000000000,
    requires: ['stellarEngineering'],
    phase: 12,
    lumenMultiplier: 1.4,
    unlocks: ['swarmFabricator', 'dysonSphere'],
    description: 'Build structures the size of orbits - unlocks the Swarm Fabricator, seed of the Dyson Sphere.',
  },
  interstellarLogistics: {
    id: 'interstellarLogistics',
    name: 'Interstellar Logistics',
    cost: 1500000000000,
    requires: ['megastructureEngineering'],
    phase: 13,
    lumenMultiplier: 1.3,
    unlocks: ['stellarConstructor', 'artificialStar'],
    description: 'Move materials and energy between star systems - unlocks the Stellar Constructor.',
  },
  blackHolePhysics: {
    id: 'blackHolePhysics',
    name: 'Black Hole Physics',
    cost: 12000000000000,
    requires: ['interstellarLogistics'],
    phase: 14,
    lumenMultiplier: 1.3,
    unlocks: ['blackHoleHarvester', 'galaxyNetwork'],
    description: 'Tap a black hole for power - unlocks the Black Hole Harvester.',
  },
  universalComputation: {
    id: 'universalComputation',
    name: 'Universal Computation',
    cost: 90000000000000,
    requires: ['blackHolePhysics'],
    phase: 15,
    lumenMultiplier: 1.2,
    unlocks: ['realityFoundry', 'cosmicBeacon'],
    description: 'Compute reality itself into being light - unlocks the Reality Foundry.',
  },
  artificialSleep: {
    id: 'artificialSleep',
    name: 'Artificial Sleep',
    cost: 1200000,
    requires: ['semiconductorPhysics'],
    phase: 6,
    description: 'Numbs the population to the glare of harsh lights and power plants - softens (but does not remove) their happiness penalty. Foreshadows Ending 1: a civilization numbed to the harm, not freed of it.',
  },
  eliminateShadows: {
    id: 'eliminateShadows',
    name: 'Eliminate Shadows',
    cost: 200000000000000,
    requires: ['universalComputation'],
    phase: 15,
    darknessDelta: -0.2,
    branch: 'eliminate',
    description: 'First step of the Eliminate branch: push back the dark corners. One of five cards that together fully eliminate darkness -> Infinite Light ending.',
  },
  illuminateOceans: {
    id: 'illuminateOceans',
    name: 'Illuminate Oceans',
    cost: 400000000000000,
    requires: ['eliminateShadows'],
    phase: 15,
    darknessDelta: -0.2,
    branch: 'eliminate',
    description: 'Light the ocean depths - another slice of darkness erased.',
  },
  illuminateNights: {
    id: 'illuminateNights',
    name: 'Illuminate Nights',
    cost: 800000000000000,
    requires: ['illuminateOceans'],
    phase: 15,
    darknessDelta: -0.2,
    branch: 'eliminate',
    description: 'Banish night itself - the sky never goes dark again.',
  },
  illuminateDeepSpace: {
    id: 'illuminateDeepSpace',
    name: 'Illuminate Deep Space',
    cost: 1600000000000000,
    requires: ['illuminateNights'],
    phase: 15,
    darknessDelta: -0.2,
    branch: 'eliminate',
    description: 'Push light out past the stars, into the empty space between them.',
  },
  blackHoleIllumination: {
    id: 'blackHoleIllumination',
    name: 'Black Hole Illumination',
    cost: 3200000000000000,
    requires: ['illuminateDeepSpace'],
    phase: 15,
    darknessDelta: -0.2, // brings the five Eliminate cards' total to -1: darkness fully eliminated -> Infinite Light ending
    branch: 'eliminate',
    description: 'The last dark thing in the universe, lit. Completes the Eliminate branch: darkness fully gone -> Infinite Light ending.',
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
    description: 'Choose to protect what darkness remains instead of erasing it. First step of the Preserve branch, toward the Balance ending.',
  },
  wonderStudies: {
    id: 'wonderStudies',
    name: 'Wonder Studies',
    cost: 1000000000000000,
    requires: ['darknessPreservation'],
    phase: 15,
    branch: 'preserve',
    description: 'Study why an unlit sky still matters. Bridges Darkness Preservation to the Balance ending.',
  },
  // The Balance ending's final card - the capstone of the Preserve chain.
  balancedUniverse: {
    id: 'balancedUniverse',
    name: 'Balanced Universe',
    cost: 2000000000000000,
    requires: ['wonderStudies'],
    phase: 15,
    darknessDelta: 0.5, // restores night/shadows/eclipses - the Balance ending
    branch: 'preserve',
    description: 'Commit to balance: restore the night, the shadows, the eclipses. The universe keeps some darkness on purpose.',
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
