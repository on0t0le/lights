/**
 * Small one-shot animated SVG scenes mounted into the ending overlay
 * (see main.ts's rebuildEndingOverlay). Unlike background.ts, these never
 * get patched per-frame - they're built once when an ending fires and the
 * motion is entirely CSS-driven (@keyframes in styles.css), since the
 * overlay is a terminal screen, not part of the live render loop.
 *
 * The two scenes are deliberately opposite reads of the same star field:
 * - infiniteLight: stars wink out one by one as a blinding white bloom
 *   swallows the sky - the felt cost of "winning" by erasing darkness.
 * - balance: the same stars twinkle and stay, under a breathing crescent
 *   moon and a lamp that only shines because it casts a shadow.
 */
import { svgEl, rect, circle, ellipse, radialGradient } from '../svg';
import { WIDTH, HEIGHT } from './geometry';
import { STAR_SEEDS } from './background';
import type { GameState } from '../state';

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildSvgRoot(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.classList.add('ending-scene');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  return svg;
}

function buildInfiniteLightScene(): SVGSVGElement {
  const svg = buildSvgRoot();

  const defs = svgEl('defs', {});
  const bloomGradient = radialGradient('ending-bloom-glow', [
    { offset: '0%', color: '#ffffff', opacity: 1 },
    { offset: '60%', color: '#fffaf0', opacity: 1 },
    { offset: '100%', color: '#fffaf0', opacity: 0 },
  ]);
  defs.appendChild(bloomGradient);
  svg.appendChild(defs);

  svg.appendChild(rect({ class: 'ending-sky', x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: '#05030d' }));

  const starGroup = svgEl('g', { class: 'ending-stars-wink' });
  STAR_SEEDS.forEach((star, i) => {
    const el = circle({ cx: star.x, cy: star.y, r: star.r, fill: 'white' });
    el.style.setProperty('--star-i', String(i));
    starGroup.appendChild(el);
  });
  svg.appendChild(starGroup);

  // Grows from the screen's center, scaling up via CSS transform so the
  // gradient itself never needs per-frame radius math.
  const bloom = circle({
    class: 'ending-bloom',
    cx: WIDTH / 2,
    cy: HEIGHT / 2,
    r: WIDTH,
    fill: 'url(#ending-bloom-glow)',
  });
  svg.appendChild(bloom);

  return svg;
}

function buildBalanceScene(): SVGSVGElement {
  const svg = buildSvgRoot();

  const defs = svgEl('defs', {});
  const moonMaskInner = circle({ cx: WIDTH * 0.78 + 11, cy: 70, r: 14.7, fill: 'black' });
  const moonMask = svgEl('mask', { id: 'ending-moon-mask' });
  moonMask.appendChild(circle({ cx: WIDTH * 0.78, cy: 70, r: 16, fill: 'white' }));
  moonMask.appendChild(moonMaskInner);
  defs.appendChild(moonMask);

  const lampGlow = radialGradient('ending-lamp-glow', [
    { offset: '0%', color: '#ffe9a0', opacity: 0.9 },
    { offset: '100%', color: '#ffe9a0', opacity: 0 },
  ]);
  defs.appendChild(lampGlow);
  svg.appendChild(defs);

  svg.appendChild(rect({ class: 'ending-sky', x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: '#150f28' }));

  const starGroup = svgEl('g', { class: 'ending-stars-twinkle' });
  STAR_SEEDS.forEach((star, i) => {
    const el = circle({ cx: star.x, cy: star.y, r: star.r, fill: 'white' });
    el.style.setProperty('--star-i', String(i));
    starGroup.appendChild(el);
  });
  svg.appendChild(starGroup);

  const moonGroup = svgEl('g', { class: 'ending-moon' });
  moonGroup.appendChild(
    circle({ cx: WIDTH * 0.78, cy: 70, r: 16, fill: '#e8e6f0', mask: 'url(#ending-moon-mask)' })
  );
  svg.appendChild(moonGroup);

  // The lamp casts a shadow on the ground - the literal "things shine
  // because something else does not" beat. Glow + post are one group so
  // they breathe together; the shadow is fixed (the thing made dark).
  const lampX = WIDTH * 0.32;
  const groundY = 230;
  const lampGroup = svgEl('g', { class: 'ending-lamp' });
  lampGroup.appendChild(circle({ class: 'ending-lamp-bulb', cx: lampX, cy: groundY - 60, r: 36, fill: 'url(#ending-lamp-glow)' }));
  lampGroup.appendChild(rect({ x: lampX - 2, y: groundY - 60, width: 4, height: 60, fill: '#3a3050' }));
  lampGroup.appendChild(circle({ cx: lampX, cy: groundY - 60, r: 5, fill: '#ffe9a0' }));
  svg.appendChild(lampGroup);

  svg.appendChild(
    ellipse({
      class: 'ending-shadow',
      cx: lampX + 50,
      cy: groundY,
      rx: 46,
      ry: 10,
      fill: '#05030d',
    })
  );

  return svg;
}

export function buildEndingScene(ending: NonNullable<GameState['ending']>): SVGSVGElement {
  return ending === 'infiniteLight' ? buildInfiniteLightScene() : buildBalanceScene();
}
