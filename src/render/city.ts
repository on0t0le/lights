import { rect, svgEl } from '../svg';
import type { GameState } from '../state';

const TOWER_COUNT = 9;
const GROUND_Y = 220;
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

export function renderCity(svg: SVGSVGElement, _state: GameState, totalLight: number): void {
  const group = svgEl('g', { class: 'city' });
  const totalWidth = TOWER_COUNT * (TOWER_WIDTH + GAP) - GAP;
  const startX = (800 - totalWidth) / 2;
  const glow = glowOpacity(totalLight);

  for (let i = 0; i < TOWER_COUNT; i++) {
    const height = TOWER_HEIGHTS[i]!;
    const x = startX + i * (TOWER_WIDTH + GAP);
    const y = GROUND_Y - height;

    group.appendChild(
      rect({ x, y, width: TOWER_WIDTH, height, fill: '#26233a', stroke: '#42405e' })
    );

    const winWidth = 6;
    const winHeight = 8;
    const colGap = (TOWER_WIDTH - WINDOW_COLS * winWidth) / (WINDOW_COLS + 1);
    const rowGap = (height - WINDOW_ROWS * winHeight) / (WINDOW_ROWS + 1);

    for (let row = 0; row < WINDOW_ROWS; row++) {
      for (let col = 0; col < WINDOW_COLS; col++) {
        const wx = x + colGap + col * (winWidth + colGap);
        const wy = y + rowGap + row * (winHeight + rowGap);
        group.appendChild(
          rect({
            x: wx,
            y: wy,
            width: winWidth,
            height: winHeight,
            fill: '#ffe9a8',
            opacity: glow.toFixed(2),
          })
        );
      }
    }
  }

  svg.appendChild(group);
}
