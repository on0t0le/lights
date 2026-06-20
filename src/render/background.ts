import { rect, linearGradient, radialGradient, circle, path, svgEl } from '../svg';
import { mix } from './color';
import type { GameState } from '../state';
import { WIDTH, HEIGHT, HORIZON_Y } from './geometry';
import { FULL_LIGHT_SCALE } from '../systems/automation';

const STAR_COUNT = 40;

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
 * ambient light grows. The City bucket (Gas Age..Cold Fusion Age, eras 3-9)
 * runs far brighter than the Village (Fire/Lamp Age), so the same `/ 50`
 * falloff would never let stars fade gradually there - scale the fade
 * distance to the bucket so City still reads as "stars gradually disappear"
 * (spec) rather than snapping instantly to invisible.
 */
function starVisibility(dayNightClock: number, totalLight: number, phase: number): number {
  const night = Math.max(0, -sunHeight(dayNightClock));
  const fadeDistance = phase >= 3 ? 200_000 : 50;
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

export interface BackgroundHandle {
  skyTopStop: SVGStopElement;
  skyBottomStop: SVGStopElement;
  sunGlowStop: SVGRadialGradientElement;
  sunGroup: SVGGElement;
  sunGlow: SVGCircleElement;
  sunCore: SVGCircleElement;
  starGroup: SVGGElement;
  starCircles: SVGCircleElement[];
  moonGroup: SVGGElement;
  moonMaskInner: SVGCircleElement;
  moonDisc: SVGCircleElement;
  cloudGroup: SVGGElement;
  cloudPaths: SVGPathElement[];
}

/** Builds the entire background scene once. Only attributes are patched after this (see updateBackground). */
export function mountBackground(svg: SVGSVGElement): BackgroundHandle {
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  // Default preserveAspectRatio ("xMidYMid meet") letterboxes when the
  // element's aspect ratio doesn't match the 800x300 viewBox; "slice" fills
  // the element instead, so the sky always covers the full width.
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

  const defs = svgEl('defs', {});
  const skyGradient = linearGradient(
    'sky-gradient',
    [
      { offset: '0%', color: '#1a1330' },
      { offset: '100%', color: '#2d1f4a' },
    ],
    { x1: '0', y1: '0', x2: '0', y2: '1' }
  );
  const [skyTopStop, skyBottomStop] = skyGradient.children as unknown as [SVGStopElement, SVGStopElement];
  defs.appendChild(skyGradient);

  const sunGlowStop = radialGradient('sun-glow', [
    { offset: '0%', color: '#fff8d8', opacity: 1 },
    { offset: '40%', color: '#ffe9a0', opacity: 0.8 },
    { offset: '100%', color: '#ffe9a0', opacity: 0 },
  ]);
  defs.appendChild(sunGlowStop);

  const moonMaskInner = circle({ cx: 0, cy: 0, r: 0, fill: 'black' });
  const mask = svgEl('mask', { id: 'moon-mask' });
  mask.appendChild(circle({ cx: 0, cy: 0, r: 16, fill: 'white', class: 'moon-mask-outer' }));
  mask.appendChild(moonMaskInner);
  defs.appendChild(mask);

  svg.appendChild(defs);
  svg.appendChild(rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: 'url(#sky-gradient)' }));

  const starGroup = svgEl('g', { class: 'stars' });
  const starCircles = STAR_SEEDS.map((star) => {
    const el = circle({ cx: star.x, cy: star.y, r: star.r, fill: 'white', opacity: 0 });
    starGroup.appendChild(el);
    return el;
  });
  svg.appendChild(starGroup);

  const sunGroup = svgEl('g', { class: 'sun-group' });
  const sunGlow = circle({ class: 'sun', cx: 0, cy: 0, r: 18, fill: 'url(#sun-glow)' });
  const sunCore = circle({ cx: 0, cy: 0, r: 10, fill: '#fff8d8' });
  sunGroup.append(sunGlow, sunCore);
  svg.appendChild(sunGroup);

  const moonGroup = svgEl('g', { class: 'moon-group' });
  const moonDisc = circle({ class: 'moon', cx: 0, cy: 0, r: 16, fill: '#e8e6f0', mask: 'url(#moon-mask)' });
  moonGroup.appendChild(moonDisc);
  svg.appendChild(moonGroup);

  const cloudGroup = svgEl('g', { class: 'clouds' });
  const cloudPaths = CLOUD_SEEDS.map((seed) => {
    const el = path({ class: 'cloud', d: cloudPath(0, seed.baseY, seed.scale), fill: '#ffffff', opacity: 0 });
    cloudGroup.appendChild(el);
    return el;
  });
  svg.appendChild(cloudGroup);

  return {
    skyTopStop,
    skyBottomStop,
    sunGlowStop,
    sunGroup,
    sunGlow,
    sunCore,
    starGroup,
    starCircles,
    moonGroup,
    moonMaskInner,
    moonDisc,
    cloudGroup,
    cloudPaths,
  };
}

/**
 * Patches the already-mounted background for this tick. Nothing is created
 * or destroyed here - that's the whole point (see main.ts's render loop).
 */
export function updateBackground(handle: BackgroundHandle, state: GameState, totalLight: number): void {
  // Orbital Age+ (eras 10-15, Planet/Universe scenes): we're off the
  // ground, so a terrestrial day/night sky with a sun and moon crossing it
  // makes no sense - they used to render *underneath* the opaque
  // planet/universe scene anyway, never actually visible while still
  // animating every tick. Space gets a fixed dark sky plus the same star
  // field, nothing else.
  if (state.phase >= 10) {
    // Darkness now actively falls as the civilization over-illuminates (see
    // systems/darkness.ts); as it approaches 0 the sky itself washes bright,
    // reading as "the universe permanently illuminated" rather than just a
    // fixed dark backdrop with dimmer stars.
    handle.skyTopStop.setAttribute('stop-color', mix('#05030d', '#cfd8ff', 1 - state.darkness));
    handle.skyBottomStop.setAttribute('stop-color', mix('#0c0a1a', '#eef2ff', 1 - state.darkness));
    handle.sunGroup.style.display = 'none';
    handle.moonGroup.style.display = 'none';
    handle.cloudGroup.style.display = 'none';
    handle.starGroup.style.display = '';
    const visibility = Math.min(1, Math.max(0, 1 - totalLight / FULL_LIGHT_SCALE) * state.darkness + 0.15 * state.darkness);
    for (const star of handle.starCircles) {
      star.setAttribute('opacity', visibility.toFixed(2));
    }
    return;
  }

  const height = sunHeight(state.dayNightClock); // -1 (midnight) .. 1 (noon)
  // Continuous interpolation (not a hard day/night flip) so dawn and dusk
  // read as smooth gradients rather than snapping instantly.
  const dayness = Math.min(1, Math.max(0, (height + 1) / 2));
  handle.skyTopStop.setAttribute('stop-color', mix('#1a1330', '#6fa8dc', dayness));
  handle.skyBottomStop.setAttribute('stop-color', mix('#2d1f4a', '#fce8b2', dayness));

  // Sun: "circle with glow" (spec). Its glow blooms with totalLight, tying
  // the overexposure beat to the same brightness that washes out the stars.
  const isDay = height > 0;
  handle.sunGroup.style.display = isDay ? '' : 'none';
  if (isDay) {
    const bloom = Math.min(1, totalLight / 200_000);
    const glowRadius = 18 + bloom * 30;
    const sunX = state.dayNightClock * WIDTH;
    const sunY = HORIZON_Y - height * 180;
    handle.sunGlow.setAttribute('cx', String(sunX));
    handle.sunGlow.setAttribute('cy', String(sunY));
    handle.sunGlow.setAttribute('r', String(glowRadius));
    handle.sunCore.setAttribute('cx', String(sunX));
    handle.sunCore.setAttribute('cy', String(sunY));
    handle.sunCore.setAttribute('r', String(10 + bloom * 4));
  }

  // Multiplied by darkness (systems/darkness.ts) on top of the local night/
  // light fade, so over-illuminating the universe dims stars even during a
  // dark local night - the felt consequence of the dynamic darkness model.
  // No display:none toggle here (issue #5 - reported background blink):
  // popping the whole group in/out right at the 0.01 threshold reads as a
  // flicker. Opacity alone fades stars out smoothly; near-zero opacity is
  // visually indistinguishable from `display:none` anyway.
  const visibility = starVisibility(state.dayNightClock, totalLight, state.phase) * state.darkness;
  for (const star of handle.starCircles) {
    star.setAttribute('opacity', visibility.toFixed(2));
  }

  // Moon: "circle with masks" (spec) - a white disc minus an offset dark
  // disc renders as a crescent. Arcs opposite the sun across the night sky.
  // Stays visible through a Lunar Eclipse even if the night-only gate would
  // otherwise have hidden it, so the eclipse is reliably shown when active.
  const eclipsed = state.activeEvent?.id === 'lunarEclipse';
  const showMoon = !isDay || eclipsed;
  handle.moonGroup.style.display = showMoon ? '' : 'none';
  if (showMoon) {
    const moonClock = (state.dayNightClock + 0.5) % 1;
    const moonX = moonClock * WIDTH;
    const moonY = HORIZON_Y - sunHeight(moonClock) * 180;
    const moonRadius = 16;
    handle.moonDisc.setAttribute('cx', String(moonX));
    handle.moonDisc.setAttribute('cy', String(moonY));
    // Offset just enough to carve a clearly readable crescent, not a sliver.
    handle.moonMaskInner.setAttribute('cx', String(moonX + moonRadius * 0.7));
    handle.moonMaskInner.setAttribute('cy', String(moonY));
    handle.moonMaskInner.setAttribute('r', String(moonRadius * 0.92));
    handle.moonDisc.setAttribute('fill', eclipsed ? '#7a2030' : '#e8e6f0');
  }

  // Clouds: "Bezier curves" (spec). Drift with tick, thicken during the
  // Cloudy Season event, and fade as the late-game wash washes out contrast.
  const cloudySeason = state.activeEvent?.id === 'cloudySeason';
  const baseOpacity = cloudySeason ? 0.75 : 0.3;
  handle.cloudGroup.style.display = '';
  CLOUD_SEEDS.forEach((seed, i) => {
    const driftX = (seed.phase + state.tick * seed.speed) % (WIDTH + 140);
    const cx = driftX - 70;
    const el = handle.cloudPaths[i]!;
    el.setAttribute('d', cloudPath(cx, seed.baseY, seed.scale));
    el.setAttribute('opacity', baseOpacity.toFixed(2));
  });
}
