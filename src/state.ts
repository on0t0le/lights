/**
 * Central game state. All mutation goes through pure functions in
 * game/ and systems/ — nothing here is mutated in place.
 */

export type ResourceId = 'lumens' | 'energy' | 'materials' | 'happiness' | 'wonder' | 'fuel' | 'exotic';

export type BuildingId =
  | 'campfire'
  | 'torch'
  | 'candle'
  | 'oilLamp'
  | 'gasLamp'
  | 'gasWorks'
  | 'incandescentBulb'
  | 'powerPlant'
  | 'arcLamp'
  | 'transformerStation'
  | 'ledLamp'
  | 'chipFactory'
  | 'nuclearLightGrid'
  | 'nuclearReactor'
  | 'fusionSun'
  | 'fusionReactor'
  | 'planetaryLightGrid'
  | 'compactFusionFactory'
  | 'orbitalMirror'
  | 'spaceElevator'
  | 'starReflector'
  | 'asteroidMining'
  | 'dysonSphere'
  | 'swarmFabricator'
  | 'artificialStar'
  | 'stellarConstructor'
  | 'galaxyNetwork'
  | 'blackHoleHarvester'
  | 'cosmicBeacon'
  | 'realityFoundry';

export type ResearchId =
  | 'fireMaking'
  | 'oilExtraction'
  | 'gasDistribution'
  | 'electricLighting'
  | 'highVoltageTransmission'
  | 'semiconductorPhysics'
  | 'nuclearEngineering'
  | 'fusionContainment'
  | 'coldFusionTheory'
  | 'orbitalConstruction'
  | 'stellarEngineering'
  | 'megastructureEngineering'
  | 'interstellarLogistics'
  | 'blackHolePhysics'
  | 'universalComputation'
  | 'artificialSleep'
  | 'eliminateShadows'
  | 'illuminateOceans'
  | 'illuminateNights'
  | 'illuminateDeepSpace'
  | 'blackHoleIllumination'
  | 'darknessPreservation'
  | 'wonderStudies'
  | 'balancedUniverse';

export type EventId =
  | 'birdMigration'
  | 'insomniaEpidemic'
  | 'meteorShower'
  | 'northernLights'
  | 'cloudySeason'
  | 'lunarEclipse'
  | 'lightPollutionComplaints'
  | 'solarFlare'
  | 'gammaRayBurst'
  | 'cosmicDust';

export interface ActiveEvent {
  id: EventId;
  ticksRemaining: number;
}

/**
 * One era of civilization, from the spec's Fire Age -> Cosmic Age arc. Each
 * era pairs a settlement name with the designated light source that forms
 * the unbroken win-condition chain (Campfire -> ... -> Cosmic Beacon). See
 * systems/progression.ts's ERA_TRIGGERS for how a civilization advances
 * from one era to the next.
 */
export interface EraDef {
  id: number;
  name: string;
  settlement: string;
  lightSource: BuildingId;
}

export const ERAS: EraDef[] = [
  { id: 1, name: 'Fire Age', settlement: 'Camp', lightSource: 'campfire' },
  { id: 2, name: 'Lamp Age', settlement: 'Hamlet', lightSource: 'candle' },
  { id: 3, name: 'Gas Age', settlement: 'Village', lightSource: 'gasLamp' },
  { id: 4, name: 'Electric Age', settlement: 'Town', lightSource: 'incandescentBulb' },
  { id: 5, name: 'Industrial Illumination', settlement: 'City', lightSource: 'arcLamp' },
  { id: 6, name: 'LED Age', settlement: 'Metropolis', lightSource: 'ledLamp' },
  { id: 7, name: 'Nuclear Age', settlement: 'Megacity', lightSource: 'nuclearLightGrid' },
  { id: 8, name: 'Fusion Age', settlement: 'Arcology', lightSource: 'fusionSun' },
  { id: 9, name: 'Cold Fusion Age', settlement: 'Planet City', lightSource: 'planetaryLightGrid' },
  { id: 10, name: 'Orbital Age', settlement: 'Orbital Civilization', lightSource: 'orbitalMirror' },
  { id: 11, name: 'Stellar Age', settlement: 'Stellar Civilization', lightSource: 'starReflector' },
  { id: 12, name: 'Dyson Age', settlement: 'Dyson Civilization', lightSource: 'dysonSphere' },
  { id: 13, name: 'Interstellar Age', settlement: 'Interstellar Empire', lightSource: 'artificialStar' },
  { id: 14, name: 'Galactic Age', settlement: 'Galactic Civilization', lightSource: 'galaxyNetwork' },
  { id: 15, name: 'Cosmic Age', settlement: 'Cosmic Civilization', lightSource: 'cosmicBeacon' },
];

export const FINAL_ERA = ERAS.length;

/**
 * Resources not yet revealed to the player default to hidden until the
 * civilization's era makes them relevant: fuel arrives with the Gas Age
 * (era 3), materials with the Nuclear Age (era 7, its stockpile feeds the
 * one-time megastructure costs from the Orbital Age on), and exotic matter
 * with the Fusion Age (era 8). Wonder is visible from the very start (issue
 * #3): it already accumulates from era 1 and gives a weak lumen bonus
 * (automation.ts), so hiding it until era 11 just hid a meter the player
 * was already earning toward.
 */
export function hiddenForEra(phase: number): ResourceId[] {
  const hidden: ResourceId[] = [];
  if (phase < 3) hidden.push('fuel');
  if (phase < 7) hidden.push('materials');
  if (phase < 8) hidden.push('exotic');
  return hidden;
}

export interface GameState {
  resources: Record<ResourceId, number>;
  hiddenResources: ResourceId[];
  buildings: Record<BuildingId, number>;
  /** Total ticks elapsed since game start. */
  tick: number;
  /** Position in the day/night cycle, 0 (dawn) to 1 (exclusive), wraps. */
  dayNightClock: number;
  /** Current era, 1 = Fire Age .. FINAL_ERA = Cosmic Age. */
  phase: number;
  /** Purchased research card ids. */
  research: ResearchId[];
  /** Currently active random event, if any. */
  activeEvent: ActiveEvent | null;
  /** Ticks until the next event roll is allowed. */
  eventCooldownTicks: number;
  /** Measurable darkness remaining, 1 (fully natural) to 0 (eliminated). Final-era target. */
  darkness: number;
  /** Which ending the player has locked in, if any. Never reverts once set. */
  ending: 'infiniteLight' | 'balance' | null;
  /** Tick at which the current era began — progression.ts requires MIN_ERA_TICKS to elapse before advancing again (issue #7). */
  phaseSince: number;
}

export function createInitialState(): GameState {
  return {
    resources: {
      lumens: 5, // enough to light the first campfire by hand
      energy: 0,
      materials: 0,
      happiness: 0.5,
      wonder: 0,
      fuel: 0,
      exotic: 0,
    },
    hiddenResources: hiddenForEra(1),
    buildings: {
      campfire: 0,
      torch: 0,
      candle: 0,
      oilLamp: 0,
      gasLamp: 0,
      gasWorks: 0,
      incandescentBulb: 0,
      powerPlant: 0,
      arcLamp: 0,
      transformerStation: 0,
      ledLamp: 0,
      chipFactory: 0,
      nuclearLightGrid: 0,
      nuclearReactor: 0,
      fusionSun: 0,
      fusionReactor: 0,
      planetaryLightGrid: 0,
      compactFusionFactory: 0,
      orbitalMirror: 0,
      spaceElevator: 0,
      starReflector: 0,
      asteroidMining: 0,
      dysonSphere: 0,
      swarmFabricator: 0,
      artificialStar: 0,
      stellarConstructor: 0,
      galaxyNetwork: 0,
      blackHoleHarvester: 0,
      cosmicBeacon: 0,
      realityFoundry: 0,
    },
    tick: 0,
    dayNightClock: 0,
    phase: 1,
    research: [],
    activeEvent: null,
    eventCooldownTicks: 0,
    darkness: 1,
    ending: null,
    phaseSince: 0,
  };
}
