import { rect, linearGradient, radialGradient, circle, path, svgEl, clear } from '../svg';
import { mix } from './color';
import type { GameState } from '../state';

const WIDTH = 800;
const HEIGHT = 300;
const STAR_COUNT = 40;
const HORIZON_Y = 260;

// Deterministic pseudo-random star positions so the sky doesn't reshuffle every render.
const STAR_SEEDS = Array.from({ length: STAR_COUNT }, (_, i) => {
  const x = (i * 197) % WIDTH;
  const y = (i * 53) % (HEIGHT * 0.6);
  const r = 0.5 + ((i * 31) % 10) / 10;
  return { x, y, r };
});

/** 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk (wraps at 1). */
function sunHeight(dayNightClock: number): number {
  return Math.sin((dayNightClock - 0.25) * Math.PI * 2);
}

/**
 * How visible stars are: bright at night, fade out as the sun rises and as
 * ambient light grows. City (Phase 2) light dwarfs Village light, so the
 * same `/ 50` falloff would never let stars fade gradually there - scale
 * the fade distance to the phase so City still reads as "stars gradually
 * disappear" (spec) rather than snapping instantly to invisible.
 */
function starVisibility(dayNightClock: number, totalLight: number, phase: number): number {
  const night = Math.max(0, -sunHeight(dayNightClock));
  const fadeDistance = phase >= 2 ? 2000 : 50;
  const lightFade = Math.max(0, 1 - totalLight / fadeDistance);
  return night * lightFade;
}

// Deterministic cloud shapes (spec: "Clouds: Bezier curves"). Each drifts
// horizontally at its own speed and wraps around the sky. `phase` spreads
// them across the canvas from tick 0, instead of all starting off-screen
// to the left and taking minutes of ticks to drift into view.
const CLOUD_SEEDS = [
  { baseY: 50, scale: 1, speed: 0.6, phase: 0 },
  { baseY: 90, scale: 0.7, speed: 0.4, phase: WIDTH / 3 },
  { baseY: 35, scale: 0.85, speed: 0.8, phase: (WIDTH * 2) / 3 },
];

/** A lumpy cloud built from overlapping bezier humps, centered at (cx, cy). */
function cloudPath(cx: number, cy: number, scale: number): string {
  const w = 70 * scale;
  const h = 22 * scale;
  const left = cx - w / 2;
  const right = cx + w / 2;
  return (
    `M ${left} ${cy} ` +
    `C ${left} ${cy - h}, ${left + w * 0.3} ${cy - h}, ${left + w * 0.35} ${cy} ` +
    `C ${left + w * 0.4} ${cy - h * 1.3}, ${left + w * 0.75} ${cy - h * 1.3}, ${left + w * 0.7} ${cy} ` +
    `C ${right} ${cy}, ${right} ${cy + h * 0.4}, ${left + w * 0.5} ${cy + h * 0.4} ` +
    `C ${left + w * 0.15} ${cy + h * 0.4}, ${left} ${cy + h * 0.2}, ${left} ${cy} Z`
  );
}

export function renderBackground(
  svg: SVGSVGElement,
  state: GameState,
  totalLight: number
): void {
  clear(svg);
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);

  const height = sunHeight(state.dayNightClock); // -1 (midnight) .. 1 (noon)
  // Continuous interpolation (not a hard day/night flip) so dawn and dusk
  // read as smooth gradients rather than snapping instantly.
  const dayness = Math.min(1, Math.max(0, (height + 1) / 2));
  const top = mix('#1a1330', '#6fa8dc', dayness);
  const bottom = mix('#2d1f4a', '#fce8b2', dayness);

  const defs = svgEl('defs', {});
  defs.appendChild(
    linearGradient('sky-gradient', [
      { offset: '0%', color: top },
      { offset: '100%', color: bottom },
    ], { x1: '0', y1: '0', x2: '0', y2: '1' })
  );

  // Sun: "circle with glow" (spec). Its glow blooms with totalLight, tying
  // the overexposure beat to the same brightness that washes out the stars.
  const isDay = height > 0;
  if (isDay) {
    const bloom = Math.min(1, totalLight / 5000);
    const glowRadius = 18 + bloom * 30;
    defs.appendChild(
      radialGradient('sun-glow', [
        { offset: '0%', color: '#fff8d8', opacity: 1 },
        { offset: '40%', color: '#ffe9a0', opacity: 0.8 },
        { offset: '100%', color: '#ffe9a0', opacity: 0 },
      ])
    );
    svg.appendChild(defs);
    svg.appendChild(rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: 'url(#sky-gradient)' }));

    const sunX = state.dayNightClock * WIDTH;
    const sunY = HORIZON_Y - height * 180;
    svg.appendChild(
      circle({
        class: 'sun',
        cx: sunX,
        cy: sunY,
        r: glowRadius,
        fill: 'url(#sun-glow)',
      })
    );
    svg.appendChild(circle({ cx: sunX, cy: sunY, r: 10 + bloom * 4, fill: '#fff8d8' }));
  } else {
    svg.appendChild(defs);
    svg.appendChild(rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: 'url(#sky-gradient)' }));
  }

  const visibility = starVisibility(state.dayNightClock, totalLight, state.phase);
  if (visibility > 0.01) {
    for (const star of STAR_SEEDS) {
      svg.appendChild(
        circle({
          cx: star.x,
          cy: star.y,
          r: star.r,
          fill: 'white',
          opacity: visibility.toFixed(2),
        })
      );
    }
  }

  // Moon: "circle with masks" (spec) - a white disc minus an offset dark
  // disc renders as a crescent. Arcs opposite the sun across the night sky.
  if (!isDay) {
    const moonClock = (state.dayNightClock + 0.5) % 1;
    const moonX = moonClock * WIDTH;
    const moonY = HORIZON_Y - sunHeight(moonClock) * 180;
    const moonRadius = 16;
    const maskId = 'moon-mask';
    const mask = svgEl('mask', { id: maskId });
    mask.appendChild(circle({ cx: moonX, cy: moonY, r: moonRadius, fill: 'white' }));
    // Offset just enough to carve a clearly readable crescent, not a sliver.
    mask.appendChild(circle({ cx: moonX + moonRadius * 0.7, cy: moonY, r: moonRadius * 0.92, fill: 'black' }));
    defs.appendChild(mask);

    const eclipsed = state.activeEvent?.id === 'lunarEclipse';
    svg.appendChild(
      circle({
        class: 'moon',
        cx: moonX,
        cy: moonY,
        r: moonRadius,
        fill: eclipsed ? '#7a2030' : '#e8e6f0',
        mask: `url(#${maskId})`,
      })
    );
  }

  // Clouds: "Bezier curves" (spec). Drift with tick, thicken during the
  // Cloudy Season event, and fade as the late-game wash washes out contrast.
  const cloudySeason = state.activeEvent?.id === 'cloudySeason';
  const baseOpacity = cloudySeason ? 0.75 : 0.3;
  for (const seed of CLOUD_SEEDS) {
    const driftX = (seed.phase + state.tick * seed.speed) % (WIDTH + 140);
    const cx = driftX - 70;
    svg.appendChild(
      path({
        class: 'cloud',
        d: cloudPath(cx, seed.baseY, seed.scale),
        fill: '#ffffff',
        opacity: baseOpacity.toFixed(2),
      })
    );
  }
}
