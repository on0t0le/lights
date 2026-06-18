import { rect, path, svgEl } from '../svg';
import type { GameState } from '../state';

const HOUSE_COUNT = 7;
const GROUND_Y = 220;
const HOUSE_WIDTH = 70;
const HOUSE_HEIGHT = 60;
const GAP = 30;

/** Window glow opacity scales with total light - more buildings, brighter windows. */
function glowOpacity(totalLight: number): number {
  return Math.min(1, 0.1 + totalLight / 20);
}

export function renderVillage(svg: SVGSVGElement, _state: GameState, totalLight: number): void {
  const group = svgEl('g', { class: 'village' });
  const totalWidth = HOUSE_COUNT * (HOUSE_WIDTH + GAP) - GAP;
  const startX = (800 - totalWidth) / 2;
  const glow = glowOpacity(totalLight);

  for (let i = 0; i < HOUSE_COUNT; i++) {
    const x = startX + i * (HOUSE_WIDTH + GAP);
    const y = GROUND_Y - HOUSE_HEIGHT;

    group.appendChild(
      rect({ x, y, width: HOUSE_WIDTH, height: HOUSE_HEIGHT, fill: '#3a2f4f', stroke: '#5a4d77' })
    );
    group.appendChild(
      path({
        d: `M ${x - 5} ${y} L ${x + HOUSE_WIDTH / 2} ${y - 25} L ${x + HOUSE_WIDTH + 5} ${y} Z`,
        fill: '#2a2240',
      })
    );
    group.appendChild(
      rect({
        x: x + HOUSE_WIDTH / 2 - 8,
        y: y + 18,
        width: 16,
        height: 16,
        fill: '#ffd97a',
        opacity: glow.toFixed(2),
      })
    );
  }

  svg.appendChild(group);
}
