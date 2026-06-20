import type { GameState } from '../state';
import { mix } from '../render/color';

/**
 * Shifts the interface from warm/soft (Village) toward washed-out/sterile
 * (spec's "UI Evolution" - Mid Game: "increasing glow ... less contrast").
 * Implemented as CSS custom property values rather than markup changes, so
 * later phases (Planet/Space/Remove Darkness) can keep extending the same
 * knob instead of rewriting styles.
 */
const MID_GAME_LIGHT_SCALE = 5000; // "this is a lot of light" reference point

/**
 * Late-game wash references Orbital Age+ light levels - far beyond
 * MID_GAME_LIGHT_SCALE and on the same order as automation.ts's
 * FULL_LIGHT_SCALE - so the interface keeps sliding toward "almost white
 * ... buttons blend together" (spec, Late Game) rather than capping out the
 * moment the city scene ends.
 */
const LATE_GAME_LIGHT_SCALE = 50_000_000;

export function applyTheme(state: GameState, totalLight: number): void {
  const root = document.documentElement;

  if (state.phase < 3) {
    root.style.removeProperty('--shadow-strength');
    root.style.removeProperty('--bg-sky-bottom');
    root.classList.remove('phase-city', 'phase-sterile', 'ending-balance');
    return;
  }

  root.classList.add('phase-city');

  // Ending 2 (Balance) reverses the wash: spec - "the interface becomes
  // beautiful again." Pin wash at 0 and bail out before the sterile class
  // can apply, regardless of how much light is still on the board.
  if (state.ending === 'balance') {
    root.classList.add('ending-balance');
    root.classList.remove('phase-sterile');
    root.style.setProperty('--shadow-strength', '1');
    root.style.setProperty('--bg-sky-bottom', '#2d1f4a');
    return;
  }
  root.classList.remove('ending-balance');

  const midWash = Math.min(1, totalLight / MID_GAME_LIGHT_SCALE);
  const lateWash = Math.min(1, totalLight / LATE_GAME_LIGHT_SCALE);
  // Late wash kicks in from Orbital Age (10) onward - Gas Age..Cold Fusion
  // Age (3-9) are still mid-game in feel even though they're past Lamp Age.
  const wash = state.phase >= 10 ? lateWash : midWash;
  // Shadows weaken and the sky desaturates toward white as brightness climbs.
  root.style.setProperty('--shadow-strength', (1 - wash).toFixed(2));
  root.style.setProperty('--bg-sky-bottom', mix('#2d1f4a', '#e8e4f0', wash));

  // Spec, Late Game: "Almost white interface. Buttons blend together...
  // Everything feels sterile." Reserve this for Orbital Age onward, deep
  // into the late-game wash, past Ending 1's threshold of "completely white".
  root.classList.toggle('phase-sterile', state.phase >= 10 && lateWash > 0.85);
}
