// Phase 3 (Planet) renderer - Earth as circles/glowing regions, shrinking
// dark areas. See docs/specification.md "Phase 3: Planet": "Earth
// represented by circles and glowing regions. Dark areas become smaller."
import { rect, circle, svgEl } from '../svg';
import type { GameState } from '../state';
import { WIDTH, HEIGHT } from './geometry';

const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const RADIUS = 110;

/** How much light it takes for the globe to read as fully lit. */
const FULL_LIGHT_SCALE = 8000;

/** Deterministic glowing-region positions inside the globe (city-light clusters). */
const REGION_COUNT = 14;
const REGIONS = Array.from({ length: REGION_COUNT }, (_, i) => {
  const angle = (i / REGION_COUNT) * Math.PI * 2;
  const dist = RADIUS * (0.3 + ((i * 37) % 10) / 20);
  return {
    x: CENTER_X + Math.cos(angle) * dist,
    y: CENTER_Y + Math.sin(angle) * dist,
    r: 2 + ((i * 13) % 4),
  };
});

/** Fraction of the globe currently lit, 0 (fully dark) .. 1 (fully lit). */
function litFraction(totalLight: number): number {
  return Math.min(1, totalLight / FULL_LIGHT_SCALE);
}

export interface PlanetHandle {
  root: SVGGElement;
  litOverlay: SVGRectElement;
  regions: { el: SVGCircleElement; x: number }[];
}

export function mountPlanet(svg: SVGSVGElement): PlanetHandle {
  const root = svgEl('g', { class: 'planet' });

  const clipId = 'planet-clip';
  const defs = svgEl('defs', {});
  const clipPath = svgEl('clipPath', { id: clipId });
  clipPath.appendChild(circle({ cx: CENTER_X, cy: CENTER_Y, r: RADIUS }));
  defs.appendChild(clipPath);
  root.appendChild(defs);

  // Base globe: dark ocean/landmass, slowly replaced by the lit overlay below.
  root.appendChild(circle({ cx: CENTER_X, cy: CENTER_Y, r: RADIUS, fill: '#1c2a3a', stroke: '#34506b' }));

  // Lit overlay grows from one edge across the disc as totalLight rises -
  // the dark portion still showing through the clip is "the dark area"
  // shrinking (spec).
  const litOverlay = rect({
    x: CENTER_X - RADIUS,
    y: CENTER_Y - RADIUS,
    width: 0,
    height: RADIUS * 2,
    fill: '#3a5f3f',
    opacity: '0.9',
    'clip-path': `url(#${clipId})`,
  });
  root.appendChild(litOverlay);

  // Glowing regions (city lights): only the ones inside the currently-lit
  // band are visible, and they brighten further as totalLight climbs.
  const regions = REGIONS.map((region) => {
    const el = circle({ cx: region.x, cy: region.y, r: region.r, fill: '#ffe9a8', opacity: 0 });
    root.appendChild(el);
    return { el, x: region.x };
  });

  svg.appendChild(root);
  return { root, litOverlay, regions };
}

export function updatePlanet(handle: PlanetHandle, _state: GameState, totalLight: number): void {
  const lit = litFraction(totalLight);
  handle.litOverlay.setAttribute('width', String(lit * RADIUS * 2));

  const glowOpacity = Math.min(1, 0.3 + totalLight / FULL_LIGHT_SCALE);
  const litEdgeX = CENTER_X - RADIUS + lit * RADIUS * 2;
  for (const region of handle.regions) {
    region.el.setAttribute('opacity', region.x <= litEdgeX ? glowOpacity.toFixed(2) : '0');
  }
}
