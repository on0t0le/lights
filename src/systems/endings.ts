import type { GameState } from '../state';

const EPSILON = 1e-6;

/**
 * Decides whether the player has locked in an ending this tick. Sticky:
 * once `state.ending` is set it's never re-evaluated or reverted.
 *
 * Ending 2 (Balance) takes priority - it's an explicit research purchase
 * (Balanced Universe) that restores darkness/contrast/wonder, so it should
 * win even if some past tick briefly satisfied Ending 1's all-zero condition.
 *
 * Ending 1 (Infinite Light) - spec: "Player removes all darkness. Contrast
 * reaches zero. Wonder reaches zero." - triggers once both darkness and
 * contrast bottom out, as long as the player hasn't taken the Balance path.
 */
export function resolveEnding(state: GameState): GameState {
  if (state.ending) {
    return state;
  }
  if (state.research.includes('balancedUniverse')) {
    return { ...state, ending: 'balance' };
  }
  if (state.darkness <= EPSILON && state.resources.contrast <= EPSILON) {
    return { ...state, ending: 'infiniteLight' };
  }
  return state;
}
