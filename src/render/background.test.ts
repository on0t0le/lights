import { describe, expect, test } from 'vitest';
import { createInitialState, type GameState } from '../state';
import { renderBackground } from './background';

function buildScene(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
}

function stateWith(overrides: Partial<GameState>): GameState {
  return { ...createInitialState(), ...overrides };
}

const NOON = 0.5; // sunHeight > 0
const MIDNIGHT = 0; // sunHeight < 0

describe('renderBackground', () => {
  test('renders a sun at noon', () => {
    const svg = buildScene();
    renderBackground(svg, stateWith({ dayNightClock: NOON }), 0);
    expect(svg.querySelector('.sun')).not.toBeNull();
  });

  test('omits the sun at midnight', () => {
    const svg = buildScene();
    renderBackground(svg, stateWith({ dayNightClock: MIDNIGHT }), 0);
    expect(svg.querySelector('.sun')).toBeNull();
  });

  test('renders a crescent moon (via mask) at midnight', () => {
    const svg = buildScene();
    renderBackground(svg, stateWith({ dayNightClock: MIDNIGHT }), 0);
    expect(svg.querySelector('.moon')).not.toBeNull();
    expect(svg.querySelector('mask')).not.toBeNull();
  });

  test('omits the moon at noon', () => {
    const svg = buildScene();
    renderBackground(svg, stateWith({ dayNightClock: NOON }), 0);
    expect(svg.querySelector('.moon')).toBeNull();
  });

  test('renders drifting clouds', () => {
    const svg = buildScene();
    renderBackground(svg, stateWith({ dayNightClock: NOON, tick: 0 }), 0);
    expect(svg.querySelectorAll('.cloud').length).toBeGreaterThan(0);
  });

  test('cloudy season thickens the clouds', () => {
    const clear = buildScene();
    renderBackground(clear, stateWith({ dayNightClock: NOON }), 0);
    const clearOpacity = Number(clear.querySelector('.cloud')!.getAttribute('opacity'));

    const cloudy = buildScene();
    renderBackground(
      cloudy,
      stateWith({ dayNightClock: NOON, activeEvent: { id: 'cloudySeason', ticksRemaining: 10 } }),
      0
    );
    const cloudyOpacity = Number(cloudy.querySelector('.cloud')!.getAttribute('opacity'));

    expect(cloudyOpacity).toBeGreaterThan(clearOpacity);
  });

  test('lunar eclipse tints the moon differently than a normal night', () => {
    const normal = buildScene();
    renderBackground(normal, stateWith({ dayNightClock: MIDNIGHT }), 0);
    const normalFill = normal.querySelector('.moon')!.getAttribute('fill');

    const eclipse = buildScene();
    renderBackground(
      eclipse,
      stateWith({ dayNightClock: MIDNIGHT, activeEvent: { id: 'lunarEclipse', ticksRemaining: 10 } }),
      0
    );
    const eclipseFill = eclipse.querySelector('.moon')!.getAttribute('fill');

    expect(eclipseFill).not.toBe(normalFill);
  });

  test('sun glow grows with total light', () => {
    const dim = buildScene();
    renderBackground(dim, stateWith({ dayNightClock: NOON }), 10);
    const dimRadius = Number(dim.querySelector('.sun')!.getAttribute('r'));

    const bright = buildScene();
    renderBackground(bright, stateWith({ dayNightClock: NOON }), 10000);
    const brightRadius = Number(bright.querySelector('.sun')!.getAttribute('r'));

    expect(brightRadius).toBeGreaterThan(dimRadius);
  });
});
