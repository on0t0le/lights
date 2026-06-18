import { rect, path, svgEl } from '../svg';
import type { GameState } from '../state';
import { WIDTH, GROUND_Y } from './geometry';

const HOUSE_COUNT = 7;
const HOUSE_WIDTH = 70;
const HOUSE_HEIGHT = 60;
const GAP = 30;

/** Window glow opacity scales with total light - more buildings, brighter windows. */
function glowOpacity(totalLight: number): number {
  return Math.min(1, 0.1 + totalLight / 20);
}

export interface VillageHandle {
  root: SVGGElement;
  windows: SVGRectElement[];
}

/** Houses are static once placed (geometry.GROUND_Y is shared with background.ts's horizon). Only window glow animates. */
export function mountVillage(svg: SVGSVGElement): VillageHandle {
  const root = svgEl('g', { class: 'village' });
  const totalWidth = HOUSE_COUNT * (HOUSE_WIDTH + GAP) - GAP;
  const startX = (WIDTH - totalWidth) / 2;
  const windows: SVGRectElement[] = [];

  for (let i = 0; i < HOUSE_COUNT; i++) {
    const x = startX + i * (HOUSE_WIDTH + GAP);
    const y = GROUND_Y - HOUSE_HEIGHT;

    root.appendChild(rect({ x, y, width: HOUSE_WIDTH, height: HOUSE_HEIGHT, fill: '#3a2f4f', stroke: '#5a4d77' }));
    root.appendChild(
      path({
        d: `M ${x - 5} ${y} L ${x + HOUSE_WIDTH / 2} ${y - 25} L ${x + HOUSE_WIDTH + 5} ${y} Z`,
        fill: '#2a2240',
      })
    );
    const window = rect({
      x: x + HOUSE_WIDTH / 2 - 8,
      y: y + 18,
      width: 16,
      height: 16,
      fill: '#ffd97a',
      opacity: 0,
    });
    root.appendChild(window);
    windows.push(window);
  }

  svg.appendChild(root);
  return { root, windows };
}

export function updateVillage(handle: VillageHandle, _state: GameState, totalLight: number): void {
  const glow = glowOpacity(totalLight).toFixed(2);
  for (const window of handle.windows) {
    window.setAttribute('opacity', glow);
  }
}
