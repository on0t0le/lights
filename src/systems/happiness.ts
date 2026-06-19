import type { BuildingId, GameState } from '../state';
import { BUILDINGS, buildingHappinessDelta } from '../game/buildings';
import { activeEventEffect } from '../game/events';

/** Happiness with no buildings owned and no events active - the neutral starting point. */
export const BASE_HAPPINESS = 0.5;

/**
 * Spec: "Artificial Sleep" research foreshadows Ending 1's "population
 * enters permanent artificial sleep" - it numbs the population to the harm
 * harsh lights and power plants do, rather than removing the harm. Modeled
 * by softening (not zeroing) every negative per-building contribution.
 * Mild on purpose (close to 1): a heavy enough industrial base must still be
 * able to drive happiness toward 0 even with this research bought - a 0.4
 * multiplier here used to let cheap early lights' cumulative positive sum
 * permanently outweigh late-game industry, flooring happiness around 0.14
 * no matter how much more was bought (the reported "can't decrease
 * happiness" bug).
 */
const ARTIFICIAL_SLEEP_MULTIPLIER = 0.85;

/**
 * Sum of every owned building's happiness contribution. Gentle/ambient
 * lights (candle..lighthouse) are positive; harsh lights and every power
 * plant are negative - "any power plant should drop happiness" is the rule
 * buildings.ts encodes per-building. Artificial Sleep research softens the
 * negative side only, once purchased.
 */
function buildingHappinessTotal(state: GameState): number {
  let total = 0;
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
    const delta = buildingHappinessDelta(id) * state.buildings[id];
    if (delta < 0 && state.research.includes('artificialSleep')) {
      total += delta * ARTIFICIAL_SLEEP_MULTIPLIER;
    } else {
      total += delta;
    }
  }
  return total;
}

/**
 * Happiness is the balance the player chases: brighter, more powerful
 * buildings push it down (and down throttles lumen production - see
 * automation.ts's tick()), gentle lights and a quiet population push it
 * back up. Explicit and legible - the number on each building's buy button
 * (ui/buttons.ts) is exactly what feeds into this sum.
 */
export function computeHappiness(state: GameState): number {
  const raw = BASE_HAPPINESS + buildingHappinessTotal(state) - activeEventEffect(state).happinessPenalty;
  return Math.min(1, Math.max(0, raw));
}

export function applyHappiness(state: GameState): GameState {
  return {
    ...state,
    resources: {
      ...state.resources,
      happiness: computeHappiness(state),
    },
  };
}
