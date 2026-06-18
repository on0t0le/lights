import type { GameState } from '../state';

/**
 * All five automation priority sliders (spec: "Automation" - "Allow
 * priority sliders: Lumens, Energy, Happiness, Contrast, Wonder.
 * Optimization becomes the main gameplay."). Each is read by the system
 * that owns the resource it biases: automation.ts (lumens, energy),
 * happiness.ts (happiness), contrast.ts (contrast), wonder.ts (wonder).
 */

/** Range 0.5 (slider=0) to 1.5 (slider=1); neutral default (0.5) is exactly 1. */
export function lumenPriorityMultiplier(state: GameState): number {
  return 0.5 + state.priorities.lumens;
}

/** Range 0.5 (slider=0) to 1.5 (slider=1); neutral default (0.5) is exactly 1. */
export function energyPriorityMultiplier(state: GameState): number {
  return 0.5 + state.priorities.energy;
}

/** Small capped bonus, scaling 0 (slider=0) to 0.2 (slider=1); neutral default (0.5) is exactly 0. */
const HAPPINESS_BONUS_SCALE = 0.4;

export function happinessPriorityBonus(state: GameState): number {
  return Math.max(0, (state.priorities.happiness - 0.5) * HAPPINESS_BONUS_SCALE);
}

/** Small capped bonus, scaling 0 (slider=0) to 0.2 (slider=1); neutral default (0.5) is exactly 0. */
const CONTRAST_BONUS_SCALE = 0.4;

export function contrastPriorityBonus(state: GameState): number {
  return Math.max(0, (state.priorities.contrast - 0.5) * CONTRAST_BONUS_SCALE);
}

/** Range 0.5 (slider=0) to 1.5 (slider=1); neutral default (0.5) is exactly 1. */
export function wonderPriorityMultiplier(state: GameState): number {
  return 0.5 + state.priorities.wonder;
}
