import type { GameState, ResourceId } from '../state';

/**
 * Allocation model for the five priority sliders (spec: "Automation" -
 * "Allow priority sliders: Lumens, Energy, Happiness, Contrast, Wonder.
 * Optimization becomes the main gameplay."). Sliders hold *relative*
 * weights, not independent 0..1 knobs: the value of each slider only
 * matters compared to the others, like budget shares. Each system that
 * owns a resource (automation.ts, happiness.ts, contrast.ts, wonder.ts)
 * multiplies its output by `priorityMultiplier`, so favoring one resource
 * necessarily comes at the expense of the rest - the actual tradeoff the
 * spec calls for, instead of five independent dials that didn't interact.
 */

/** The priority resources currently shown to the player (a resource hidden from the UI keeps its default weight). */
function visiblePriorityIds(state: GameState): ResourceId[] {
  return (Object.keys(state.priorities) as ResourceId[]).filter((id) => !state.hiddenResources.includes(id));
}

/** `resource`'s share of the pool, 0..1, among the currently visible priority resources. Neutral (all equal) is `1 / visibleCount`. */
export function priorityShare(state: GameState, resource: ResourceId): number {
  const visible = visiblePriorityIds(state);
  const sum = visible.reduce((total, id) => total + state.priorities[id], 0);
  if (sum <= 0) {
    return visible.length > 0 ? 1 / visible.length : 0;
  }
  return state.priorities[resource] / sum;
}

/**
 * Multiplier applied to `resource`'s production: `priorityShare * visibleCount`.
 * Neutral (every visible slider equal) is exactly 1, same as before sliders
 * existed. Favor one resource and its multiplier rises above 1 while every
 * other visible resource's multiplier drops below 1 - they're drawn from
 * the same pool.
 */
export function priorityMultiplier(state: GameState, resource: ResourceId): number {
  const visibleCount = visiblePriorityIds(state).length;
  if (visibleCount === 0) {
    return 1;
  }
  return priorityShare(state, resource) * visibleCount;
}
