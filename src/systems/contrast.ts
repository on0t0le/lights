import type { GameState } from '../state';
import { totalLightOutput } from './automation';
import { activeEventEffect } from '../game/events';
import { contrastPriorityBonus } from './priorities';

/**
 * Higher means brightness eats into contrast faster; chosen so Phase 1
 * light levels barely dent it (contrast stays felt at night) while Phase 2
 * City light levels drive it toward zero (spec: "consumed by excessive
 * brightness").
 */
const BRIGHTNESS_SCALE = 200;

/**
 * How dark it currently is, from the day/night clock alone: 0 at noon, 1 at
 * midnight. Exported - happiness.ts reuses it for sleep disruption.
 */
export function nightAmount(dayNightClock: number): number {
  // Mirrors render/background.ts's sunHeight: 0 = midnight, 0.5 = noon.
  const sunHeight = Math.sin((dayNightClock - 0.25) * Math.PI * 2);
  return Math.max(0, -sunHeight);
}

/**
 * Contrast is produced by night (spec also lists shadows/clouds/eclipses,
 * not yet modeled) and consumed by excessive brightness. Stays hidden from
 * the player (see state.hiddenResources) but drives happiness under the
 * hood - the player feels its absence before they ever see the number.
 * Scaled by state.darkness (Phase 5's measurable quantity): contrast needs
 * darkness to exist at all, so eliminating darkness eliminates contrast too,
 * mirroring the spec's Ending 1 ("contrast reaches zero").
 */
export function computeContrast(state: GameState): number {
  const night = nightAmount(state.dayNightClock);
  if (night === 0 || state.darkness === 0) {
    return 0;
  }
  const totalLight = totalLightOutput(state);
  const base = night / (1 + totalLight / BRIGHTNESS_SCALE);
  const withBonuses = base + activeEventEffect(state).contrastBonus + contrastPriorityBonus(state);
  return Math.min(1, withBonuses * state.darkness);
}

export function applyContrast(state: GameState): GameState {
  return {
    ...state,
    resources: {
      ...state.resources,
      contrast: computeContrast(state),
    },
  };
}
