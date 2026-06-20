import type { BuildingId, GameState } from '../state';
import { canAfford, spendResource } from './resources';
import { isBuildingUnlocked } from '../systems/progression';

export interface BuildingDef {
  name: string;
  baseCost: number;
  /** Cost multiplier applied per unit already owned. */
  costGrowth: number;
  lumensPerUnit: number;
  /** Energy consumed per unit per tick; 0 for buildings that don't need power. */
  energyConsumedPerUnit: number;
  /** Energy produced per unit per tick; 0 for buildings that don't generate power. */
  energyProducedPerUnit: number;
  /** Fuel consumed per unit per tick (stockpile draw); 0 if the building doesn't burn fuel. */
  fuelConsumedPerUnit: number;
  /** Fuel produced per unit per tick (accumulates as a stockpile); 0 if it doesn't refine fuel. */
  fuelProducedPerUnit: number;
  /** Materials produced per unit per tick (accumulates, unlike the energy flow balance). */
  materialsPerUnit: number;
  /**
   * Exotic matter reserve required per unit, owned (a capability gate, not a
   * per-tick draw): 0 if it doesn't need exotic matter. Lights compare the
   * total reserve required by everything they own against the stockpile
   * (automation.ts's resolveExotic) - the stockpile is never spent, it's the
   * installed capability backing these lights.
   */
  exoticRequiredPerUnit: number;
  /** Exotic matter produced per unit per tick (accumulates as a stockpile); 0 if it doesn't harvest any. */
  exoticProducedPerUnit: number;
  /** One-time materials cost to build one unit; 0 for buildings that only cost lumens. */
  materialCost: number;
  /** Which era unlocks this building's slot in the catalog. See state.ts's ERAS. */
  phase: number;
  /** Lumens deducted per owned unit per tick (a late-game sink); 0 for buildings with no upkeep. */
  maintenancePerUnit: number;
  /**
   * Happiness contributed per owned unit (systems/happiness.ts sums these).
   * Positive for gentle/ambient lights, negative for harsh lights and every
   * power/production building — the tension the player balances: brighter
   * and more powerful almost always costs happiness, which in turn throttles
   * lumen production (automation.ts's tick()).
   */
  happinessPerUnit: number;
}

/**
 * Each era contributes exactly two buildings: a light source (the
 * win-condition chain building named in state.ts's ERAS, generally buyable
 * as soon as the era is reached) and a secondary power/production building
 * (generally research-gated — see progression.ts — and the building whose
 * ownership or research card triggers advancement to the next era).
 *
 * Inputs are staged the same way resources reveal (state.ts's hiddenForEra):
 * eras 1-2 are free (no energy grid yet); eras 3-7 run on energy, refined
 * from fuel (Gas Age's Gas Works produces fuel; the era 4/5/7 power plants
 * burn it to generate energy that era 3-7 lights consume); eras 8-15 run
 * directly on exotic matter, harvested by each era's secondary building.
 * Materials accumulate from the LED and Nuclear Age secondaries and pay the
 * one-time megastructure cost every Orbital Age+ building carries instead
 * of a per-tick draw — mirroring how today's space tier already trades
 * per-tick energy for a one-time materials cost.
 */
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  // Era 1 — Fire Age (Camp).
  campfire: {
    name: 'Campfire',
    baseCost: 5,
    costGrowth: 1.13,
    lumensPerUnit: 0.5,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 1,
    happinessPerUnit: 0.001,
  },
  // Research-gated (Fire Making) — see progression.ts. Owning one triggers
  // the Fire Age -> Lamp Age advance.
  torch: {
    name: 'Torch',
    baseCost: 25,
    costGrowth: 1.18,
    lumensPerUnit: 1.5,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 1,
    happinessPerUnit: 0.0008,
  },
  // Era 2 — Lamp Age (Hamlet).
  candle: {
    name: 'Candle',
    baseCost: 40,
    costGrowth: 1.13,
    lumensPerUnit: 2.5,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 2,
    happinessPerUnit: 0.001,
  },
  // Research-gated (Oil Extraction). Owning one triggers Lamp Age -> Gas
  // Age, which also reveals fuel.
  oilLamp: {
    name: 'Oil Lamp',
    baseCost: 200,
    costGrowth: 1.18,
    lumensPerUnit: 6,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 2,
    happinessPerUnit: 0.0012,
  },
  // Era 3 — Gas Age (Village). Burns fuel piped straight from Gas Works -
  // not energy, which doesn't exist yet (the first generator, Power Plant,
  // is Electric Age). This keeps Gas Age self-contained: build a gas lamp
  // any time, it just sits idle/dim until a Gas Works is feeding it fuel.
  gasLamp: {
    name: 'Gas Lamp',
    baseCost: 300,
    costGrowth: 1.13,
    lumensPerUnit: 12,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 1,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 3,
    happinessPerUnit: -0.003,
  },
  // Research-gated (Gas Distribution). The first fuel refinery — owning one
  // triggers Gas Age -> Electric Age.
  gasWorks: {
    name: 'Gas Works',
    baseCost: 1500,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 5,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 3,
    happinessPerUnit: -0.004,
  },
  // Era 4 — Electric Age (Town).
  incandescentBulb: {
    name: 'Incandescent Bulb',
    baseCost: 2500,
    costGrowth: 1.13,
    lumensPerUnit: 60,
    energyConsumedPerUnit: 3,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 4,
    happinessPerUnit: -0.004,
  },
  // Research-gated (Electric Lighting). Burns fuel to generate energy.
  // Owning one triggers Electric Age -> Industrial Illumination.
  powerPlant: {
    name: 'Power Plant',
    baseCost: 12500,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 10,
    fuelConsumedPerUnit: 1,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 4,
    happinessPerUnit: -0.01,
  },
  // Era 5 — Industrial Illumination (City).
  arcLamp: {
    name: 'Arc Lamp',
    baseCost: 20000,
    costGrowth: 1.13,
    lumensPerUnit: 300,
    energyConsumedPerUnit: 9,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 5,
    happinessPerUnit: -0.006,
  },
  // Research-gated (High Voltage Transmission). Owning one triggers
  // Industrial Illumination -> LED Age.
  transformerStation: {
    name: 'Transformer Station',
    baseCost: 100000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 60,
    fuelConsumedPerUnit: 3,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 5,
    happinessPerUnit: -0.014,
  },
  // Era 6 — LED Age (Metropolis). First materials production.
  ledLamp: {
    name: 'LED Lamp',
    baseCost: 150000,
    costGrowth: 1.13,
    lumensPerUnit: 1500,
    energyConsumedPerUnit: 27,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 6,
    happinessPerUnit: -0.008,
  },
  // Research-gated (Semiconductor Physics). Owning one triggers LED Age ->
  // Nuclear Age, which also reveals materials.
  chipFactory: {
    name: 'Chip Factory',
    baseCost: 750000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 2,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 6,
    happinessPerUnit: -0.01,
  },
  // Era 7 — Nuclear Age (Megacity).
  nuclearLightGrid: {
    name: 'Nuclear Light Grid',
    baseCost: 1200000,
    costGrowth: 1.13,
    lumensPerUnit: 7500,
    energyConsumedPerUnit: 81,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 7,
    happinessPerUnit: -0.012,
  },
  // Research-gated (Nuclear Engineering). Owning one triggers Nuclear Age ->
  // Fusion Age, which also reveals exotic matter.
  nuclearReactor: {
    name: 'Nuclear Reactor',
    baseCost: 6000000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 2000,
    fuelConsumedPerUnit: 9,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 5,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 7,
    happinessPerUnit: -0.02,
  },
  // Era 8 — Fusion Age (Arcology). Runs directly on exotic matter from here on.
  fusionSun: {
    name: 'Fusion Sun',
    baseCost: 9000000,
    costGrowth: 1.13,
    lumensPerUnit: 37500,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 0.5,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 8,
    happinessPerUnit: -0.015,
  },
  // Research-gated (Fusion Containment). First exotic matter harvester.
  // Owning one triggers Fusion Age -> Cold Fusion Age.
  fusionReactor: {
    name: 'Fusion Reactor',
    baseCost: 45000000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 8,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 1,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 8,
    happinessPerUnit: -0.018,
  },
  // Era 9 — Cold Fusion Age (Planet City).
  planetaryLightGrid: {
    name: 'Planetary Light Grid',
    baseCost: 70000000,
    costGrowth: 1.13,
    lumensPerUnit: 190000,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 1.5,
    exoticProducedPerUnit: 0,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 9,
    happinessPerUnit: -0.018,
  },
  // Research-gated (Cold Fusion Theory). Owning one triggers Cold Fusion Age
  // -> Orbital Age.
  compactFusionFactory: {
    name: 'Compact Fusion Factory',
    baseCost: 350000000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 24,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 3,
    materialCost: 0,
  maintenancePerUnit: 0,
    phase: 9,
    happinessPerUnit: -0.016,
  },
  // Era 10 — Orbital Age (Orbital Civilization). Every building from here on
  // pays a one-time materials cost (a megastructure build) instead of a
  // per-tick draw, mirroring how today's space tier already works. Orbital
  // Mirror keeps its existing special unlock rule — see progression.ts —
  // requiring its research AND a fully-lit civilization, not just ownership
  // counts, so the player can't leave the ground until Cold Fusion Age is lit.
  orbitalMirror: {
    name: 'Orbital Mirror',
    baseCost: 500000000,
    costGrowth: 1.2,
    lumensPerUnit: 940000,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 4.5,
    exoticProducedPerUnit: 0,
    materialCost: 500,
  maintenancePerUnit: 47000,
    phase: 10,
    happinessPerUnit: -0.02,
  },
  // Research-gated (Orbital Construction). Owning one triggers Orbital Age
  // -> Stellar Age.
  spaceElevator: {
    name: 'Space Elevator',
    baseCost: 2500000000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 72,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 9,
    materialCost: 500,
  maintenancePerUnit: 0,
    phase: 10,
    happinessPerUnit: -0.02,
  },
  // Era 11 — Stellar Age (Stellar Civilization).
  starReflector: {
    name: 'Star Reflector',
    baseCost: 4000000000,
    costGrowth: 1.2,
    lumensPerUnit: 4700000,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 13.5,
    exoticProducedPerUnit: 0,
    materialCost: 1500,
  maintenancePerUnit: 235000,
    phase: 11,
    happinessPerUnit: -0.022,
  },
  // Research-gated (Stellar Engineering). Owning one triggers Stellar Age ->
  // Dyson Age.
  asteroidMining: {
    name: 'Asteroid Mining',
    baseCost: 20000000000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 216,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 27,
    materialCost: 1500,
  maintenancePerUnit: 0,
    phase: 11,
    happinessPerUnit: -0.018,
  },
  // Era 12 — Dyson Age (Dyson Civilization).
  dysonSphere: {
    name: 'Dyson Sphere',
    baseCost: 30000000000,
    costGrowth: 1.2,
    lumensPerUnit: 23000000,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 40.5,
    exoticProducedPerUnit: 0,
    materialCost: 4000,
  maintenancePerUnit: 1150000,
    phase: 12,
    happinessPerUnit: -0.025,
  },
  // Research-gated (Megastructure Engineering). Owning one triggers Dyson
  // Age -> Interstellar Age.
  swarmFabricator: {
    name: 'Swarm Fabricator',
    baseCost: 150000000000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 648,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 81,
    materialCost: 4000,
  maintenancePerUnit: 0,
    phase: 12,
    happinessPerUnit: -0.022,
  },
  // Era 13 — Interstellar Age (Interstellar Empire).
  artificialStar: {
    name: 'Artificial Star',
    baseCost: 250000000000,
    costGrowth: 1.2,
    lumensPerUnit: 120000000,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 121.5,
    exoticProducedPerUnit: 0,
    materialCost: 10000,
  maintenancePerUnit: 6000000,
    phase: 13,
    happinessPerUnit: -0.027,
  },
  // Research-gated (Interstellar Logistics). Owning one triggers
  // Interstellar Age -> Galactic Age.
  stellarConstructor: {
    name: 'Stellar Constructor',
    baseCost: 1200000000000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 1944,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 243,
    materialCost: 10000,
  maintenancePerUnit: 0,
    phase: 13,
    happinessPerUnit: -0.024,
  },
  // Era 14 — Galactic Age (Galactic Civilization).
  galaxyNetwork: {
    name: 'Galaxy Network',
    baseCost: 2000000000000,
    costGrowth: 1.2,
    lumensPerUnit: 590000000,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 364.5,
    exoticProducedPerUnit: 0,
    materialCost: 25000,
  maintenancePerUnit: 29500000,
    phase: 14,
    happinessPerUnit: -0.03,
  },
  // Research-gated (Black Hole Physics). Owning one triggers Galactic Age ->
  // Cosmic Age.
  blackHoleHarvester: {
    name: 'Black Hole Harvester',
    baseCost: 9000000000000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 5832,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 729,
    materialCost: 25000,
  maintenancePerUnit: 0,
    phase: 14,
    happinessPerUnit: -0.028,
  },
  // Era 15 — Cosmic Age (Cosmic Civilization). The final era: the endgame
  // eliminate/preserve research branch (game/research.ts) decides whether
  // the civilization's darkness reaches zero or is deliberately preserved.
  cosmicBeacon: {
    name: 'Cosmic Beacon',
    baseCost: 15000000000000,
    costGrowth: 1.2,
    lumensPerUnit: 2900000000,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 0,
    exoticRequiredPerUnit: 1093.5,
    exoticProducedPerUnit: 0,
    materialCost: 60000,
  maintenancePerUnit: 145000000,
    phase: 15,
    happinessPerUnit: -0.032,
  },
  // Research-gated (Universal Computation), the prerequisite for the
  // endgame branch. Has no further era to trigger — Cosmic Age is the end.
  realityFoundry: {
    name: 'Reality Foundry',
    baseCost: 70000000000000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    fuelConsumedPerUnit: 0,
    fuelProducedPerUnit: 0,
    materialsPerUnit: 17496,
    exoticRequiredPerUnit: 0,
    exoticProducedPerUnit: 2187,
    materialCost: 60000,
  maintenancePerUnit: 0,
    phase: 15,
    happinessPerUnit: -0.03,
  },
};

export function buildingCost(id: BuildingId, owned: number): number {
  const def = BUILDINGS[id];
  return def.baseCost * Math.pow(def.costGrowth, owned);
}

/** One-time materials cost to buy the next unit; 0 for buildings that only cost lumens. */
export function buildingMaterialCost(id: BuildingId): number {
  return BUILDINGS[id].materialCost;
}

export function lumenOutput(id: BuildingId, owned: number): number {
  return BUILDINGS[id].lumensPerUnit * owned;
}

export function energyUpkeep(id: BuildingId, owned: number): number {
  return BUILDINGS[id].energyConsumedPerUnit * owned;
}

export function energyProduction(id: BuildingId, owned: number): number {
  return BUILDINGS[id].energyProducedPerUnit * owned;
}

/** Fuel drawn from the stockpile this tick by owned units (see automation.ts's tick()). */
export function fuelUpkeep(id: BuildingId, owned: number): number {
  return BUILDINGS[id].fuelConsumedPerUnit * owned;
}

/** Fuel produced this tick by owned units (accumulates — see automation.ts's tick()). */
export function fuelProduction(id: BuildingId, owned: number): number {
  return BUILDINGS[id].fuelProducedPerUnit * owned;
}

/** Materials produced this tick by owned units (accumulates — see automation.ts's tick()). */
export function materialsProduction(id: BuildingId, owned: number): number {
  return BUILDINGS[id].materialsPerUnit * owned;
}

/** Exotic matter reserve required by owned units — a capability gate, not a per-tick draw (see automation.ts's resolveExotic). */
export function exoticRequired(id: BuildingId, owned: number): number {
  return BUILDINGS[id].exoticRequiredPerUnit * owned;
}

/** Exotic matter produced this tick by owned units (accumulates — see automation.ts's tick()). */
export function exoticProduction(id: BuildingId, owned: number): number {
  return BUILDINGS[id].exoticProducedPerUnit * owned;
}

/** Lumens deducted per tick by owned units — a late-game sink (see automation.ts's tick()). */
export function maintenanceUpkeep(id: BuildingId, owned: number): number {
  return BUILDINGS[id].maintenancePerUnit * owned;
}

/** Happiness contributed per unit (systems/happiness.ts sums this across owned buildings). */
export function buildingHappinessDelta(id: BuildingId): number {
  return BUILDINGS[id].happinessPerUnit;
}

/** Buys one unit of `id` if affordable (lumens and, for megastructure-tier buildings, materials). Returns `state` unchanged otherwise. */
export function buyBuilding(state: GameState, id: BuildingId): GameState {
  if (!isBuildingUnlocked(state, id)) {
    return state;
  }
  const cost = buildingCost(id, state.buildings[id]);
  const materialCost = buildingMaterialCost(id);
  if (!canAfford(state, 'lumens', cost) || !canAfford(state, 'materials', materialCost)) {
    return state;
  }
  const spentLumens = spendResource(state, 'lumens', cost);
  const spent = materialCost > 0 ? spendResource(spentLumens, 'materials', materialCost) : spentLumens;
  return {
    ...spent,
    buildings: {
      ...spent.buildings,
      [id]: spent.buildings[id] + 1,
    },
  };
}
