import type { GameState } from '../state';
import { totalLightOutput } from './automation';
import { computeContrast, nightAmount } from './contrast';
import { activeEventEffect } from '../game/events';
import { happinessPriorityBonus } from './priorities';

/**
 * Caps how much sleep disruption can subtract from happiness. Only applies
 * from Phase 2 (City) onward - spec: "introduce sleep disruption" in City,
 * not Village. Phase 1 light stays under COMFORT_MAX anyway (see
 * automation.test.ts's greedy-playthrough regression), but the phase guard
 * makes the Phase 1 "more light is always better" promise explicit, not
 * just incidental.
 */
const SLEEP_DISRUPTION_SCALE = 0.5;

/**
 * Spec: "Artificial Sleep" research foreshadows Ending 1's "population
 * enters permanent artificial sleep" - it numbs the player to the
 * insomnia problem rather than solving it.
 */
const ARTIFICIAL_SLEEP_MULTIPLIER = 0.4;

/**
 * Bright nights cost happiness - worse when contrast (preserved darkness)
 * is already depleted. Zero by day, zero below Phase 2, zero at low light.
 * Artificial Sleep research (Phase 3+) dampens the penalty without
 * removing it.
 */
function sleepDisruptionPenalty(state: GameState): number {
  if (state.phase < 2) {
    return 0;
  }
  const night = nightAmount(state.dayNightClock);
  if (night === 0) {
    return 0;
  }
  const light = totalLightOutput(state);
  const brightness = Math.min(1, light / COMFORT_MAX);
  const contrast = computeContrast(state);
  const penalty = SLEEP_DISRUPTION_SCALE * night * brightness * (1 - contrast);
  return state.research.includes('artificialSleep') ? penalty * ARTIFICIAL_SLEEP_MULTIPLIER : penalty;
}

/**
 * Spec: Phase 3 (Planet) introduces "wildlife disruption" as a new problem
 * alongside energy demand and insomnia. Scales with overexposure, same
 * shape as sleep disruption, but independent of time of day - wildlife
 * doesn't get a reprieve at noon the way sleepers do.
 */
const WILDLIFE_DISRUPTION_SCALE = 0.3;

function wildlifeDisruptionPenalty(state: GameState): number {
  if (state.phase < 3) {
    return 0;
  }
  const brightness = Math.min(1, totalLightOutput(state) / COMFORT_MAX);
  return WILDLIFE_DISRUPTION_SCALE * brightness;
}

/** Below this much light, the village is too dark and happiness suffers. */
export const COMFORT_MIN = 5;
/**
 * Above this much light, happiness starts dropping again (overexposure).
 * Set high relative to Phase 1 building output so the player experiences
 * "more light is always better" before this knee becomes reachable.
 */
export const COMFORT_MAX = 5000;

export function computeHappiness(light: number): number {
  if (light < COMFORT_MIN) {
    // Ramps from a dim baseline up to full comfort as light approaches COMFORT_MIN.
    return Math.max(0, 0.2 * (light / COMFORT_MIN));
  }
  if (light <= COMFORT_MAX) {
    return 1;
  }
  const overBy = light - COMFORT_MAX;
  return Math.max(0, 1 - overBy / COMFORT_MAX);
}

export function applyHappiness(state: GameState): GameState {
  const base = computeHappiness(totalLightOutput(state));
  const penalty =
    sleepDisruptionPenalty(state) + wildlifeDisruptionPenalty(state) + activeEventEffect(state).happinessPenalty;
  const happiness = Math.min(1, Math.max(0, base - penalty + happinessPriorityBonus(state)));
  return {
    ...state,
    resources: {
      ...state.resources,
      happiness,
    },
  };
}
