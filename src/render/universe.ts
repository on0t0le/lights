// Phase 4 (Space) renderer - universe map of stars/planets/asteroids as
// circles, Dyson swarms as dashed rings. See docs/specification.md
// "Phase 4: Space": "Everything represented by circles ... Dyson swarms
// represented by dashed rings ... Everything symbolic."
import { circle, svgEl } from '../svg';
import type { GameState } from '../state';

const WIDTH = 800;
const HEIGHT = 300;

/** Deterministic star-field positions, mirroring background.ts's approach. */
const STAR_COUNT = 60;
const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  x: (i * 137) % WIDTH,
  y: (i * 71) % HEIGHT,
  r: 0.6 + ((i * 13) % 4) * 0.3,
}));

/** Deterministic planet/asteroid positions, spread across the map. */
const PLANET_COUNT = 5;
const PLANETS = Array.from({ length: PLANET_COUNT }, (_, i) => ({
  x: (i + 0.5) * (WIDTH / PLANET_COUNT),
  y: HEIGHT * 0.55 + Math.sin(i) * 40,
  r: 10 + (i % 3) * 4,
}));

const ASTEROID_COUNT = 20;
const ASTEROIDS = Array.from({ length: ASTEROID_COUNT }, (_, i) => ({
  x: (i * 97) % WIDTH,
  y: HEIGHT * 0.8 + ((i * 31) % 30),
  r: 1 + (i % 3),
}));

/** How many Dyson swarm rings to draw - capped so the DOM stays small at huge owned counts. */
const MAX_SWARM_RINGS = 6;

export function renderUniverse(svg: SVGSVGElement, state: GameState, totalLight: number): void {
  const group = svgEl('g', { class: 'universe' });

  // Stars fade as ambient light washes them out (same "overexposure" beat
  // as background.ts's Phase 1-2 stars, at Phase 4 scale) and as Phase 5's
  // darkness elimination removes the contrast that makes them visible.
  const starOpacity = Math.min(1, Math.max(0, 1 - totalLight / 2_000_000) * state.darkness + 0.1);
  for (const star of STARS) {
    group.appendChild(
      circle({ cx: star.x, cy: star.y, r: star.r, fill: '#ffffff', opacity: starOpacity.toFixed(2) })
    );
  }

  for (const planet of PLANETS) {
    group.appendChild(circle({ cx: planet.x, cy: planet.y, r: planet.r, fill: '#5b7fa6', stroke: '#9fc1e0' }));
  }

  for (const asteroid of ASTEROIDS) {
    group.appendChild(circle({ cx: asteroid.x, cy: asteroid.y, r: asteroid.r, fill: '#8a8a8a' }));
  }

  const swarmCount = Math.min(MAX_SWARM_RINGS, state.buildings.dysonSwarm);
  for (let i = 0; i < swarmCount; i++) {
    const planet = PLANETS[i % PLANETS.length]!;
    group.appendChild(
      circle({
        cx: planet.x,
        cy: planet.y,
        r: planet.r + 12,
        fill: 'none',
        stroke: '#ffd27f',
        'stroke-width': 1.5,
        'stroke-dasharray': '4 3',
      })
    );
  }

  svg.appendChild(group);
}
