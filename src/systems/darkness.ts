import type { GameState } from '../state';
import { totalLightOutput } from './automation';
import { researchDarknessDelta } from '../game/research';

/**
 * How much raw light it takes to meaningfully dent darkness on its own,
 * independent of research. Set far above anything reachable in Phase 1-3 so
 * darkness stays at its 1 baseline until Phase 4/5 light levels (Dyson
 * Swarm, Stellar Mirror) arrive - mirrors contrast.ts's BRIGHTNESS_SCALE,
 * just at a much later-game order of magnitude.
 */
const BRIGHTNESS_DARKNESS_SCALE = 2_000_000;

/**
 * Phase 5's "Remove Darkness" quantity: 1 = fully natural, 0 = eliminated.
 * Driven primarily by the Illuminate-and-Eliminate-Shadows research chain
 * (negative darknessDelta) and the Darkness Preservation/Balanced Universe
 * counter-branch (positive darknessDelta), with a small contribution from
 * raw overexposure at very high total light.
 */
export function computeDarkness(state: GameState): number {
  const lightErosion = totalLightOutput(state) / BRIGHTNESS_DARKNESS_SCALE;
  const value = 1 + researchDarknessDelta(state) - lightErosion;
  return Math.min(1, Math.max(0, value));
}

export function applyDarkness(state: GameState): GameState {
  return { ...state, darkness: computeDarkness(state) };
}
