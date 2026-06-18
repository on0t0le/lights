/**
 * Central game state. All mutation goes through pure functions in
 * game/ and systems/ — nothing here is mutated in place.
 */

export type ResourceId = 'lumens' | 'energy' | 'happiness' | 'contrast' | 'wonder';

export type BuildingId =
  | 'candle'
  | 'lantern'
  | 'streetlamp'
  | 'lighthouse'
  | 'powerPlant'
  | 'neonSign'
  | 'stadiumLights'
  | 'solarFarm'
  | 'fusionReactor'
  | 'orbitalMirror'
  | 'dysonSwarm'
  | 'whiteDwarfReactor'
  | 'stellarMirror';

export type ResearchId =
  | 'candleMaking'
  | 'streetElectricity'
  | 'leds'
  | 'fusionPower'
  | 'orbitalMirrors'
  | 'dysonSwarms'
  | 'artificialSleep'
  | 'blackHoleIllumination'
  | 'darknessPreservation'
  | 'wonderStudies'
  | 'balancedUniverse'
  | 'eliminateShadows'
  | 'illuminateOceans'
  | 'illuminateNights'
  | 'illuminateDeepSpace';

export type EventId =
  | 'birdMigration'
  | 'insomniaEpidemic'
  | 'meteorShower'
  | 'northernLights'
  | 'cloudySeason'
  | 'lunarEclipse';

export interface ActiveEvent {
  id: EventId;
  ticksRemaining: number;
}

export interface GameState {
  resources: Record<ResourceId, number>;
  /** Resources not yet revealed to the player (spec: contrast/wonder hidden until midgame). */
  hiddenResources: ResourceId[];
  buildings: Record<BuildingId, number>;
  /** Total ticks elapsed since game start. */
  tick: number;
  /** Position in the day/night cycle, 0 (dawn) to 1 (exclusive), wraps. */
  dayNightClock: number;
  /** Current game phase, 1 = Village. */
  phase: number;
  /** Purchased research card ids. */
  research: ResearchId[];
  /** Currently active random event, if any. */
  activeEvent: ActiveEvent | null;
  /** Ticks until the next event roll is allowed. */
  eventCooldownTicks: number;
  /** Automation priority sliders, 0..1, all neutral at 0.5. */
  priorities: Record<ResourceId, number>;
  /** Measurable darkness remaining, 1 (fully natural) to 0 (eliminated). Phase 5 target. */
  darkness: number;
  /** Which ending the player has locked in, if any. Never reverts once set. */
  ending: 'infiniteLight' | 'balance' | null;
}

export function createInitialState(): GameState {
  return {
    resources: {
      lumens: 5, // enough to light the first candle by hand
      energy: 0,
      happiness: 0.5,
      contrast: 0,
      wonder: 0,
    },
    hiddenResources: ['contrast', 'wonder'],
    buildings: {
      candle: 0,
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
    },
    tick: 0,
    dayNightClock: 0,
    phase: 1,
    research: [],
    activeEvent: null,
    eventCooldownTicks: 0,
    priorities: {
      lumens: 0.5,
      energy: 0.5,
      happiness: 0.5,
      contrast: 0.5,
      wonder: 0.5,
    },
    darkness: 1,
    ending: null,
  };
}
