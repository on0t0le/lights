import type { GameState } from '../state';
import { totalLightOutput } from './automation';
import { nightAmount } from './daynight';
import { activeEventEffect } from '../game/events';

/** Ambient sources scale to roughly the same "felt" magnitude as the event bonuses below. */
const AMBIENT_WONDER_SCALE = 0.05;

/** Above this much light, stars are fully washed out and contribute no wonder. */
const STAR_VISIBILITY_SCALE = 5000; // "this is a lot of light" reference point

/**
 * How visible the stars are right now: 1 in true darkness, fading to 0 as
 * total light approaches STAR_VISIBILITY_SCALE. Mirrors the spec's "Stars
 * gradually disappear" (City) / "Stars disappear" (overexposure) language.
 */
function starsVisible(state: GameState): number {
  return Math.max(0, 1 - totalLightOutput(state) / STAR_VISIBILITY_SCALE);
}

/**
 * Peaks at dawn and dusk (sun crossing the horizon) - the spec's "sunsets".
 * `sunHeight` mirrors contrast.ts's nightAmount: 0 at the horizon, +-1 at
 * noon/midnight. The peak is narrow so it reads as a moment, not half the day.
 */
function twilightAmount(dayNightClock: number): number {
  const sunHeight = Math.sin((dayNightClock - 0.25) * Math.PI * 2);
  return Math.max(0, 1 - Math.abs(sunHeight) * 4);
}

/**
 * Ambient wonder from moonlight (night), sunsets (twilight), and visible
 * stars - none of it requires an event. Spec: wonder "cannot exist without
 * darkness", so this is meaningless once state.darkness reaches 0 (see
 * computeWonderYield, which multiplies the whole thing by darkness).
 */
function ambientWonder(state: GameState): number {
  const moonlight = nightAmount(state.dayNightClock);
  const twilight = twilightAmount(state.dayNightClock);
  const stars = starsVisible(state);
  return ((moonlight + twilight + stars) / 3) * AMBIENT_WONDER_SCALE;
}

/**
 * Wonder produced this tick. Spec: produced by sunsets/moonlight/campfires/
 * stars/eclipses (eclipses arrive via random events' wonderBonus), and
 * "without darkness, wonder production becomes zero" - hence the final
 * multiply by state.darkness, which gates ambient sources *and* events alike.
 */
export function computeWonderYield(state: GameState): number {
  const raw = ambientWonder(state) + activeEventEffect(state).wonderBonus;
  return raw * state.darkness;
}

/**
 * Wonder accumulates (spec Ending 2: "Wonder grows infinitely") rather than
 * being a per-tick gauge like contrast or happiness.
 */
export function applyWonder(state: GameState): GameState {
  return {
    ...state,
    resources: {
      ...state.resources,
      wonder: state.resources.wonder + computeWonderYield(state),
    },
  };
}
