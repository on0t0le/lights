// Phase 3 (Planet) renderer - Earth as circles/glowing regions, shrinking
// dark areas. See docs/specification.md "Phase 3: Planet": "Earth
// represented by circles and glowing regions. Dark areas become smaller."
import { circle, svgEl } from '../svg';
import type { GameState } from '../state';
import { WIDTH, HEIGHT } from './geometry';
import { FULL_LIGHT_SCALE } from '../systems/automation';

const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const RADIUS = 110;

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
  glowOverlay: SVGCircleElement;
  regions: SVGCircleElement[];
  coverageLabel: SVGTextElement;
}

export function mountPlanet(svg: SVGSVGElement): PlanetHandle {
  const root = svgEl('g', { class: 'planet' });

  // Base globe: dark ocean/landmass, brightened uniformly by the glow
  // overlay below as light grows - "more sources of light -> the whole
  // planet gets brighter", not a band sweeping left-to-right.
  root.appendChild(circle({ cx: CENTER_X, cy: CENTER_Y, r: RADIUS, fill: '#1c2a3a', stroke: '#34506b' }));

  const glowOverlay = circle({ cx: CENTER_X, cy: CENTER_Y, r: RADIUS, fill: '#3a5f3f', opacity: 0 });
  root.appendChild(glowOverlay);

  // Glowing regions (city lights): all visible at once, brightening together
  // as totalLight climbs - the dark areas shrink by the globe reading
  // brighter overall, not by a wipe revealing them left to right.
  const regions = REGIONS.map((region) => {
    const el = circle({ cx: region.x, cy: region.y, r: region.r, fill: '#ffe9a8', opacity: 0 });
    root.appendChild(el);
    return el;
  });

  const coverageLabel = svgEl('text', {
    x: String(CENTER_X),
    y: String(CENTER_Y + RADIUS + 24),
    'text-anchor': 'middle',
    fill: '#cdd6e0',
    'font-size': '14',
  }) as SVGTextElement;
  root.appendChild(coverageLabel);

  svg.appendChild(root);
  return { root, glowOverlay, regions, coverageLabel };
}

export function updatePlanet(handle: PlanetHandle, _state: GameState, totalLight: number): void {
  const lit = litFraction(totalLight);
  handle.glowOverlay.setAttribute('opacity', (lit * 0.9).toFixed(2));

  const glowOpacity = Math.min(1, 0.15 + lit);
  for (const region of handle.regions) {
    region.setAttribute('opacity', glowOpacity.toFixed(2));
  }

  handle.coverageLabel.textContent = `Coverage: ${Math.round(lit * 100)}%`;
}
