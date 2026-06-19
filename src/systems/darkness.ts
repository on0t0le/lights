import type { GameState } from '../state';
import { researchDarknessDelta, hasPreserveResearch } from '../game/research';
import { lumenSuppressionRatio } from './automation';

/**
 * Lumens alone can never fully suppress darkness past this ceiling (issue
 * #4): without it, a player who lights up the universe enough could drift
 * to Infinite Light passively, silently locking out Balance. Capping it
 * means the ending is always a deliberate research finish (see endings.ts),
 * never an accidental byproduct of building lights.
 */
const MAX_LUMEN_SUPPRESSION = 0.9;

/** Preserve research holds darkness at this floor (resistance) instead of letting it clamp to 0 when suppression and/or Eliminate deltas would overshoot (issue #4). */
const PRESERVE_FLOOR = 0.3;

/**
 * Phase 7's "Remove Darkness" quantity: 1 = fully natural, 0 = eliminated.
 * Two independent forces move it: raw civilization brightness suppresses it,
 * capped at MAX_LUMEN_SUPPRESSION so light alone can never fully eliminate
 * it, and the Illuminate/Eliminate-Shadows research chain (negative
 * darknessDelta, summing to exactly -1) erodes it deliberately and fast. The
 * Darkness Preservation/Balanced Universe counter-branch (positive
 * darknessDelta) counters both, and once any Preserve card is owned, holds
 * darkness at PRESERVE_FLOOR rather than letting it clamp all the way to 0.
 */
export function computeDarkness(state: GameState): number {
  const suppression = Math.min(MAX_LUMEN_SUPPRESSION, lumenSuppressionRatio(state));
  const raw = 1 - suppression + researchDarknessDelta(state);
  const floor = hasPreserveResearch(state) ? PRESERVE_FLOOR : 0;
  return Math.min(1, Math.max(floor, raw));
}

export function applyDarkness(state: GameState): GameState {
  return { ...state, darkness: computeDarkness(state) };
}
