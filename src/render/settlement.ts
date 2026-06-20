import { rect, path, svgEl } from '../svg';
import type { GameState } from '../state';
import { WIDTH, GROUND_Y } from './geometry';

/** Vertical size of one storey, used to derive a building's floor count (and so its window-row count) from its height. */
const FLOOR_H = 22;
/** Below this height a building reads as a pitched-roof house (one warm window); at or above, it's a flat-topped tower with a window grid. */
const TOWER_HEIGHT_THRESHOLD = 90;

/**
 * Deterministic pseudo-random fraction in [0, 1) - a fixed seed always
 * produces the same layout, so the settlement doesn't reshuffle every
 * render (matches village.ts/city.ts's old TOWER_HEIGHTS approach, just
 * generalized to any seed instead of a hardcoded array).
 */
function seededFraction(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface BuildingLayout {
  x: number;
  width: number;
  height: number;
  floors: number;
}

/**
 * One settlement, one look per era 1-9 (reported request: huts -> houses ->
 * skyline, not a single jump from village to skyscrapers). `count` and
 * `maxHeight` both grow with `phase`, so each era reads as visibly denser
 * and taller than the last; per-building height is a seeded fraction of
 * that era's max, so buildings vary in height within an era without
 * reshuffling between renders.
 */
function settlementLayout(phase: number): BuildingLayout[] {
  const count = Math.min(11, 4 + phase);
  const maxHeight = 40 + phase * 18; // era 1 ~58 (huts) .. era 9 ~202 (skyline)
  const width = phase >= 5 ? 56 : 70; // denser eras pack slightly narrower buildings to fit more in
  const gap = phase >= 5 ? 16 : 26;
  const totalWidth = count * (width + gap) - gap;
  const startX = (WIDTH - totalWidth) / 2;

  const buildings: BuildingLayout[] = [];
  for (let i = 0; i < count; i++) {
    const frac = 0.4 + 0.6 * seededFraction(phase * 100 + i);
    const height = Math.round(maxHeight * frac);
    const floors = Math.max(1, Math.round(height / FLOOR_H));
    buildings.push({ x: startX + i * (width + gap), width, height, floors });
  }
  return buildings;
}

/**
 * Window-glow brightness ramp, tuned per era so windows read as lit across
 * the era's own total-light range — eras 1-9 span many orders of magnitude
 * (village.ts used a /20 divisor, city.ts /200_000), so a single fixed
 * divisor would leave early eras blown-out white or late eras permanently
 * dark. Scales geometrically between those two reference points across
 * phases 1-9.
 */
function glowDivisor(phase: number): number {
  const t = Math.min(1, Math.max(0, (phase - 1) / 8));
  return 20 * Math.pow(200_000 / 20, t);
}

export interface SettlementHandle {
  root: SVGGElement;
  windows: SVGRectElement[];
  phase: number;
}

/** Buildings are static once placed (geometry.GROUND_Y is shared with background.ts's horizon). Only window glow animates. */
export function mountSettlement(svg: SVGSVGElement, phase: number): SettlementHandle {
  const root = svgEl('g', { class: 'settlement' });
  const windows: SVGRectElement[] = [];

  for (const building of settlementLayout(phase)) {
    const { x, width, height } = building;
    const y = GROUND_Y - height;
    const isTower = height >= TOWER_HEIGHT_THRESHOLD;

    root.appendChild(rect({ x, y, width, height, fill: isTower ? '#26233a' : '#3a2f4f', stroke: isTower ? '#42405e' : '#5a4d77' }));

    if (isTower) {
      const windowCols = width >= 65 ? 3 : 2;
      const winWidth = 6;
      const winHeight = 8;
      const colGap = (width - windowCols * winWidth) / (windowCols + 1);
      const rowGap = (height - building.floors * winHeight) / (building.floors + 1);
      for (let row = 0; row < building.floors; row++) {
        for (let col = 0; col < windowCols; col++) {
          const wx = x + colGap + col * (winWidth + colGap);
          const wy = y + rowGap + row * (winHeight + rowGap);
          const window = rect({ x: wx, y: wy, width: winWidth, height: winHeight, fill: '#ffe9a8', opacity: 0 });
          root.appendChild(window);
          windows.push(window);
        }
      }
    } else {
      // Pitched roof, one warm window per floor - the "house" look from
      // village.ts, generalized to 2+ floors for the denser mid-game eras.
      root.appendChild(
        path({
          d: `M ${x - 5} ${y} L ${x + width / 2} ${y - 25} L ${x + width + 5} ${y} Z`,
          fill: '#2a2240',
        })
      );
      for (let floor = 0; floor < building.floors; floor++) {
        const wy = y + height - (floor + 1) * FLOOR_H + (FLOOR_H - 16) / 2;
        const window = rect({ x: x + width / 2 - 8, y: wy, width: 16, height: 16, fill: '#ffd97a', opacity: 0 });
        root.appendChild(window);
        windows.push(window);
      }
    }
  }

  svg.appendChild(root);
  return { root, windows, phase };
}

export function updateSettlement(handle: SettlementHandle, _state: GameState, totalLight: number): void {
  const glow = Math.min(1, 0.1 + totalLight / glowDivisor(handle.phase)).toFixed(2);
  for (const window of handle.windows) {
    window.setAttribute('opacity', glow);
  }
}
