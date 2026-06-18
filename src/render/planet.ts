// Phase 3 (Planet) renderer - Earth as circles/glowing regions, shrinking
// dark areas. See docs/specification.md "Phase 3: Planet": "Earth
// represented by circles and glowing regions. Dark areas become smaller."
import { rect, circle, svgEl } from '../svg';
import type { GameState } from '../state';

const WIDTH = 800;
const HEIGHT = 300;
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

export function renderPlanet(svg: SVGSVGElement, _state: GameState, totalLight: number): void {
  const group = svgEl('g', { class: 'planet' });
  const lit = litFraction(totalLight);

  const clipId = 'planet-clip';
  const defs = svgEl('defs', {});
  const clipPath = svgEl('clipPath', { id: clipId });
  clipPath.appendChild(circle({ cx: CENTER_X, cy: CENTER_Y, r: RADIUS }));
  defs.appendChild(clipPath);
  group.appendChild(defs);

  // Base globe: dark ocean/landmass, slowly replaced by the lit overlay below.
  group.appendChild(
    circle({ cx: CENTER_X, cy: CENTER_Y, r: RADIUS, fill: '#1c2a3a', stroke: '#34506b' })
  );

  // Lit overlay grows from one edge across the disc as totalLight rises -
  // the dark portion still showing through the clip is "the dark area"
  // shrinking (spec).
  group.appendChild(
    rect({
      x: CENTER_X - RADIUS,
      y: CENTER_Y - RADIUS,
      width: lit * RADIUS * 2,
      height: RADIUS * 2,
      fill: '#3a5f3f',
      opacity: '0.9',
      'clip-path': `url(#${clipId})`,
    })
  );

  // Glowing regions (city lights): only the ones inside the currently-lit
  // band are visible, and they brighten further as totalLight climbs.
  const glowOpacity = Math.min(1, 0.3 + totalLight / FULL_LIGHT_SCALE);
  const litEdgeX = CENTER_X - RADIUS + lit * RADIUS * 2;
  for (const region of REGIONS) {
    if (region.x > litEdgeX) {
      continue;
    }
    group.appendChild(
      circle({ cx: region.x, cy: region.y, r: region.r, fill: '#ffe9a8', opacity: glowOpacity.toFixed(2) })
    );
  }

  svg.appendChild(group);
}
