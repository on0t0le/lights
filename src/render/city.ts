import { rect, svgEl } from '../svg';
import type { GameState } from '../state';
import { WIDTH, GROUND_Y } from './geometry';

const TOWER_COUNT = 9;
const TOWER_WIDTH = 50;
const GAP = 18;
const WINDOW_ROWS = 5;
const WINDOW_COLS = 3;

// Deterministic per-tower height so the skyline doesn't reshuffle every render.
const TOWER_HEIGHTS = Array.from({ length: TOWER_COUNT }, (_, i) => 70 + ((i * 53) % 110));

/** Window glow opacity scales with total light - the City runs far brighter than the Village. */
function glowOpacity(totalLight: number): number {
  return Math.min(1, 0.1 + totalLight / 500);
}

export interface CityHandle {
  root: SVGGElement;
  windows: SVGRectElement[];
}

/** Towers are static once placed (geometry.GROUND_Y is shared with background.ts's horizon). Only window glow animates. */
export function mountCity(svg: SVGSVGElement): CityHandle {
  const root = svgEl('g', { class: 'city' });
  const totalWidth = TOWER_COUNT * (TOWER_WIDTH + GAP) - GAP;
  const startX = (WIDTH - totalWidth) / 2;
  const windows: SVGRectElement[] = [];

  for (let i = 0; i < TOWER_COUNT; i++) {
    const height = TOWER_HEIGHTS[i]!;
    const x = startX + i * (TOWER_WIDTH + GAP);
    const y = GROUND_Y - height;

    root.appendChild(rect({ x, y, width: TOWER_WIDTH, height, fill: '#26233a', stroke: '#42405e' }));

    const winWidth = 6;
    const winHeight = 8;
    const colGap = (TOWER_WIDTH - WINDOW_COLS * winWidth) / (WINDOW_COLS + 1);
    const rowGap = (height - WINDOW_ROWS * winHeight) / (WINDOW_ROWS + 1);

    for (let row = 0; row < WINDOW_ROWS; row++) {
      for (let col = 0; col < WINDOW_COLS; col++) {
        const wx = x + colGap + col * (winWidth + colGap);
        const wy = y + rowGap + row * (winHeight + rowGap);
        const window = rect({ x: wx, y: wy, width: winWidth, height: winHeight, fill: '#ffe9a8', opacity: 0 });
        root.appendChild(window);
        windows.push(window);
      }
    }
  }

  svg.appendChild(root);
  return { root, windows };
}

export function updateCity(handle: CityHandle, _state: GameState, totalLight: number): void {
  const glow = glowOpacity(totalLight).toFixed(2);
  for (const window of handle.windows) {
    window.setAttribute('opacity', glow);
  }
}
