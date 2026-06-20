import type { GameState } from '../state';

/**
 * Decides whether the player has locked in an ending this tick. Sticky:
 * once `state.ending` is set it's never re-evaluated or reverted.
 *
 * Both endings are explicit capstone research purchases (issue #5/#10), not
 * passive side-effects of darkness math - darkness.ts's lumen suppression
 * is capped well short of zero (see MAX_LUMEN_SUPPRESSION there), so neither
 * ending can be reached or locked out by building lights alone.
 *
 * Ending 2 (Balance, the "Preserve" branch) takes priority - it's an
 * explicit research purchase (Balanced Universe) that restores darkness,
 * so it should win even if both capstones are technically owned.
 *
 * Ending 1 (Infinite Light, the "Eliminate" branch) fires once Black Hole
 * Illumination - the capstone at the end of the five-card Illuminate chain
 * (darkness.ts sums exactly -1 across those cards) - is purchased.
 */
export function resolveEnding(state: GameState): GameState {
  if (state.ending) {
    return state;
  }
  if (state.research.includes('balancedUniverse')) {
    return { ...state, ending: 'balance' };
  }
  if (state.research.includes('blackHoleIllumination')) {
    return { ...state, ending: 'infiniteLight' };
  }
  return state;
}
