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
  /** Which phase unlocks this building's slot in the catalog (spec: Village=1, City=2, Planet=3, Space=4). */
  phase: 1 | 2 | 3 | 4;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  candle: {
    name: 'Candle',
    baseCost: 5,
    costGrowth: 1.12,
    lumensPerUnit: 0.2,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    phase: 1,
  },
  lantern: {
    name: 'Lantern',
    baseCost: 30,
    costGrowth: 1.14,
    lumensPerUnit: 1,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    phase: 1,
  },
  // Energy upkeep is 0 for all Village buildings: spec introduces energy
  // consumption in Phase 2 (City), once Power Plants exist to supply it.
  streetlamp: {
    name: 'Streetlamp',
    baseCost: 200,
    costGrowth: 1.16,
    lumensPerUnit: 6,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    phase: 1,
  },
  lighthouse: {
    name: 'Lighthouse',
    baseCost: 1500,
    costGrowth: 1.18,
    lumensPerUnit: 40,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 0,
    phase: 1,
  },
  // Phase 2 (City): generation and consumption enter the picture together —
  // Power Plant supplies what Neon Sign / Stadium Lights demand.
  powerPlant: {
    name: 'Power Plant',
    baseCost: 4000,
    costGrowth: 1.15,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 10,
    phase: 2,
  },
  neonSign: {
    name: 'Neon Sign',
    baseCost: 2500,
    costGrowth: 1.15,
    lumensPerUnit: 15,
    energyConsumedPerUnit: 2,
    energyProducedPerUnit: 0,
    phase: 2,
  },
  stadiumLights: {
    name: 'Stadium Lights',
    baseCost: 12000,
    costGrowth: 1.2,
    lumensPerUnit: 80,
    energyConsumedPerUnit: 8,
    energyProducedPerUnit: 0,
    phase: 2,
  },
  // Phase 3 (Planet): the energy economy scales up by an order of magnitude
  // - Solar Farm and Fusion Reactor supply the power Orbital Mirror demands.
  solarFarm: {
    name: 'Solar Farm',
    baseCost: 25000,
    costGrowth: 1.15,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 40,
    phase: 3,
  },
  fusionReactor: {
    name: 'Fusion Reactor',
    baseCost: 80000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 150,
    phase: 3,
  },
  orbitalMirror: {
    name: 'Orbital Mirror',
    baseCost: 150000,
    costGrowth: 1.2,
    lumensPerUnit: 400,
    energyConsumedPerUnit: 20,
    energyProducedPerUnit: 0,
    phase: 3,
  },
  // Phase 4 (Space): Stellar Engineering. White Dwarf Reactor supplies the
  // power Dyson Swarm / Stellar Mirror demand, another order of magnitude up.
  whiteDwarfReactor: {
    name: 'White Dwarf Reactor',
    baseCost: 400000,
    costGrowth: 1.18,
    lumensPerUnit: 0,
    energyConsumedPerUnit: 0,
    energyProducedPerUnit: 600,
    phase: 4,
  },
  dysonSwarm: {
    name: 'Dyson Swarm',
    baseCost: 250000,
    costGrowth: 1.16,
    lumensPerUnit: 1500,
    energyConsumedPerUnit: 80,
    energyProducedPerUnit: 0,
    phase: 4,
  },
  stellarMirror: {
    name: 'Stellar Mirror',
    baseCost: 900000,
    costGrowth: 1.2,
    lumensPerUnit: 5000,
    energyConsumedPerUnit: 200,
    energyProducedPerUnit: 0,
    phase: 4,
  },
};

export function buildingCost(id: BuildingId, owned: number): number {
  const def = BUILDINGS[id];
  return def.baseCost * Math.pow(def.costGrowth, owned);
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

/** Buys one unit of `id` if affordable. Returns `state` unchanged otherwise. */
export function buyBuilding(state: GameState, id: BuildingId): GameState {
  if (!isBuildingUnlocked(state, id)) {
    return state;
  }
  const cost = buildingCost(id, state.buildings[id]);
  if (!canAfford(state, 'lumens', cost)) {
    return state;
  }
  const spent = spendResource(state, 'lumens', cost);
  return {
    ...spent,
    buildings: {
      ...spent.buildings,
      [id]: spent.buildings[id] + 1,
    },
  };
}
