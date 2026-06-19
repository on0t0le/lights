// Phase 4 (Space) renderer - a small orbital system: a central star with
// planets of distinct types orbiting it, an outer asteroid belt, and Dyson
// swarm shells around the star itself once they're built. See
// docs/specification.md "Phase 4: Space": "Everything represented by
// circles ... Dyson swarms represented by dashed rings ... Everything
// symbolic." background.ts already draws the starfield behind this scene.
import { circle, ellipse, radialGradient, svgEl } from '../svg';
import type { GameState } from '../state';
import { WIDTH, HEIGHT } from './geometry';

const STAR_X = WIDTH / 2;
const STAR_Y = HEIGHT / 2;
const STAR_RADIUS = 16;

type PlanetType = 'rocky' | 'gasGiant' | 'ringed';

interface PlanetSeed {
  orbitRx: number;
  orbitRy: number;
  baseAngle: number;
  speed: number;
  radius: number;
  type: PlanetType;
  color: string;
}

/** Deterministic planet seeds - one of each notable type, sizes/orbits spread so they read clearly. */
const PLANET_SEEDS: PlanetSeed[] = [
  { orbitRx: 60, orbitRy: 20, baseAngle: 0.4, speed: 0.012, radius: 7, type: 'rocky', color: '#9a7a63' },
  { orbitRx: 105, orbitRy: 34, baseAngle: 2.1, speed: 0.008, radius: 11, type: 'rocky', color: '#5b7fa6' },
  { orbitRx: 150, orbitRy: 48, baseAngle: 4.0, speed: 0.005, radius: 17, type: 'gasGiant', color: '#caa46b' },
  { orbitRx: 195, orbitRy: 62, baseAngle: 1.2, speed: 0.0035, radius: 14, type: 'ringed', color: '#c9b98f' },
  { orbitRx: 240, orbitRy: 76, baseAngle: 5.3, speed: 0.0025, radius: 20, type: 'gasGiant', color: '#7e6fae' },
];

/** Deterministic asteroid-belt positions on a wide outer orbit. */
const ASTEROID_COUNT = 24;
const ASTEROID_ORBIT_RX = 300;
const ASTEROID_ORBIT_RY = 90;
const ASTEROIDS = Array.from({ length: ASTEROID_COUNT }, (_, i) => {
  const angle = (i / ASTEROID_COUNT) * Math.PI * 2 + ((i * 37) % 10) / 10;
  const jitter = 0.85 + ((i * 13) % 10) / 50; // shrinks/grows the orbit slightly per asteroid
  return {
    angle,
    rx: ASTEROID_ORBIT_RX * jitter,
    ry: ASTEROID_ORBIT_RY * jitter,
    r: 1 + (i % 3),
  };
});

/** How many Dyson swarm shells to draw - capped so the DOM stays small at huge owned counts. */
const MAX_SWARM_RINGS = 6;

interface PlanetRefs {
  seed: PlanetSeed;
  group: SVGGElement;
  body: SVGCircleElement;
}

export interface UniverseHandle {
  root: SVGGElement;
  planets: PlanetRefs[];
  swarmRings: SVGCircleElement[];
}

function buildPlanet(seed: PlanetSeed): PlanetRefs {
  const group = svgEl('g', { class: `planet planet-${seed.type}` });
  const body = circle({ cx: 0, cy: 0, r: seed.radius, fill: seed.color, stroke: '#00000033' });

  if (seed.type === 'gasGiant') {
    // Banded look: a couple of darker translucent stripes layered over the body, clipped by an invisible band.
    group.appendChild(body);
    for (const band of [-0.4, 0.1, 0.5]) {
      group.appendChild(
        ellipse({
          cx: 0,
          cy: seed.radius * band,
          rx: seed.radius * 0.95,
          ry: seed.radius * 0.18,
          fill: '#00000022',
        })
      );
    }
  } else if (seed.type === 'ringed') {
    // The ring is part of this planet's identity (Saturn-like), drawn behind the body - distinct from Dyson swarm shells.
    group.appendChild(
      ellipse({ cx: 0, cy: 0, rx: seed.radius * 1.9, ry: seed.radius * 0.5, fill: 'none', stroke: '#d8cba8', 'stroke-width': 2 })
    );
    group.appendChild(body);
  } else {
    group.appendChild(body);
  }

  return { seed, group, body };
}

export function mountUniverse(svg: SVGSVGElement): UniverseHandle {
  const root = svgEl('g', { class: 'universe' });

  const defs = svgEl('defs', {});
  defs.appendChild(
    radialGradient('star-glow', [
      { offset: '0%', color: '#fff6da', opacity: 1 },
      { offset: '45%', color: '#ffd27f', opacity: 0.6 },
      { offset: '100%', color: '#ffd27f', opacity: 0 },
    ])
  );
  root.appendChild(defs);

  // Faint orbit guides so the layout reads as a solar system, not scattered circles.
  for (const seed of PLANET_SEEDS) {
    root.appendChild(
      ellipse({
        cx: STAR_X,
        cy: STAR_Y,
        rx: seed.orbitRx,
        ry: seed.orbitRy,
        fill: 'none',
        stroke: '#ffffff22',
      })
    );
  }

  root.appendChild(circle({ cx: STAR_X, cy: STAR_Y, r: STAR_RADIUS * 2.4, fill: 'url(#star-glow)' }));
  root.appendChild(circle({ cx: STAR_X, cy: STAR_Y, r: STAR_RADIUS, fill: '#fff6da' }));

  const swarmRings = Array.from({ length: MAX_SWARM_RINGS }, (_, i) => {
    const ring = circle({
      cx: STAR_X,
      cy: STAR_Y,
      r: STAR_RADIUS + 14 + i * 9,
      fill: 'none',
      stroke: '#ffd27f',
      'stroke-width': 1.5,
      'stroke-dasharray': '4 3',
      opacity: 0,
    });
    root.appendChild(ring);
    return ring;
  });

  for (const asteroid of ASTEROIDS) {
    const x = STAR_X + Math.cos(asteroid.angle) * asteroid.rx;
    const y = STAR_Y + Math.sin(asteroid.angle) * asteroid.ry;
    root.appendChild(circle({ cx: x, cy: y, r: asteroid.r, fill: '#8a8a8a' }));
  }

  const planets = PLANET_SEEDS.map((seed) => {
    const refs = buildPlanet(seed);
    root.appendChild(refs.group);
    return refs;
  });

  svg.appendChild(root);
  return { root, planets, swarmRings };
}

export function updateUniverse(handle: UniverseHandle, state: GameState, _totalLight: number): void {
  for (const planet of handle.planets) {
    const angle = planet.seed.baseAngle + state.tick * planet.seed.speed;
    const x = STAR_X + Math.cos(angle) * planet.seed.orbitRx;
    const y = STAR_Y + Math.sin(angle) * planet.seed.orbitRy;
    planet.group.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)})`);
  }

  // Dyson sphere shells around the star (research-gated - see systems/progression.ts -
  // so they can never appear before Megastructure Engineering is actually bought).
  const swarmCount = Math.min(MAX_SWARM_RINGS, state.buildings.dysonSphere);
  handle.swarmRings.forEach((ring, i) => {
    ring.setAttribute('opacity', i < swarmCount ? '1' : '0');
  });
}
