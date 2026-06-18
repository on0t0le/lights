import type { BuildingId, GameState } from '../state';
import { BUILDINGS, energyProduction, energyUpkeep, lumenOutput } from '../game/buildings';
import { addResource } from '../game/resources';
import { researchLumenMultiplier } from '../game/research';
import { activeEventEffect } from '../game/events';
import { lumenPriorityMultiplier, energyPriorityMultiplier } from './priorities';
import { advancePhase } from './progression';

const DEFAULT_DAY_LENGTH = 1 / 120; // one full day/night cycle per 120 ticks

export interface EnergyResolution {
  energyProduced: number;
  energyConsumed: number;
  /** False when consumption exceeds production: all energy-consuming buildings sit idle. */
  consumersActive: boolean;
  /** Energy actually flowing this tick (no storage buffer — this is a live balance, not a stockpile). */
  energySurplus: number;
}

/**
 * Resolves this tick's energy balance. Phase 2 introduces buildings that
 * consume energy (Neon Sign, Stadium Lights) alongside ones that produce it
 * (Power Plant). There's no battery: if consumption would exceed production,
 * every consumer idles for the tick instead of partially running.
 */
export function resolveEnergy(state: GameState): EnergyResolution {
  let energyProduced = 0;
  let energyConsumed = 0;
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
    const owned = state.buildings[id];
    energyProduced += energyProduction(id, owned);
    energyConsumed += energyUpkeep(id, owned);
  }
  energyProduced *= energyPriorityMultiplier(state);

  const consumersActive = energyConsumed <= energyProduced;
  const energySurplus = consumersActive ? energyProduced - energyConsumed : energyProduced;

  return { energyProduced, energyConsumed, consumersActive, energySurplus };
}

/** Total ambient light currently produced by all owned buildings. Idle (energy-starved) consumers contribute none. */
export function totalLightOutput(state: GameState): number {
  const { consumersActive } = resolveEnergy(state);
  let lumens = 0;
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
    if (BUILDINGS[id].energyConsumedPerUnit > 0 && !consumersActive) {
      continue;
    }
    lumens += lumenOutput(id, state.buildings[id]);
  }
  return lumens;
}

/**
 * Advances the simulation by one tick: produces resources from buildings,
 * resolves the energy balance, advances the day/night clock, and checks
 * phase progression. `dayStep` lets callers control cycle speed (used by
 * tests); production-line callers can rely on the default.
 */
export function tick(state: GameState, dayStep: number = DEFAULT_DAY_LENGTH): GameState {
  let next = state;

  const lumenMultiplier =
    researchLumenMultiplier(state) * lumenPriorityMultiplier(state) * activeEventEffect(state).lumenProductivityMult;
  const lumens = totalLightOutput(state) * lumenMultiplier;
  if (lumens !== 0) {
    next = addResource(next, 'lumens', lumens);
  }

  const { energySurplus } = resolveEnergy(state);

  next = advancePhase({
    ...next,
    tick: next.tick + 1,
    dayNightClock: (next.dayNightClock + dayStep) % 1,
    resources: { ...next.resources, energy: energySurplus },
  });

  return next;
}
