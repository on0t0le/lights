import { describe, expect, test } from 'vitest';
import { createInitialState, type GameState } from '../state';
import { mountBackground, updateBackground } from './background';

function buildScene(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
}

function stateWith(overrides: Partial<GameState>): GameState {
  return { ...createInitialState(), ...overrides };
}

function build(state: GameState, totalLight: number) {
  const svg = buildScene();
  const handle = mountBackground(svg);
  updateBackground(handle, state, totalLight);
  return { svg, handle };
}

const NOON = 0.5; // sunHeight > 0
const MIDNIGHT = 0; // sunHeight < 0

describe('updateBackground', () => {
  test('shows the sun at noon', () => {
    const { handle } = build(stateWith({ dayNightClock: NOON }), 0);
    expect(handle.sunGroup.style.display).not.toBe('none');
  });

  test('hides the sun at midnight', () => {
    const { handle } = build(stateWith({ dayNightClock: MIDNIGHT }), 0);
    expect(handle.sunGroup.style.display).toBe('none');
  });

  test('shows a crescent moon (via mask) at midnight', () => {
    const { handle, svg } = build(stateWith({ dayNightClock: MIDNIGHT }), 0);
    expect(handle.moonGroup.style.display).not.toBe('none');
    expect(svg.querySelector('mask')).not.toBeNull();
  });

  test('hides the moon at noon', () => {
    const { handle } = build(stateWith({ dayNightClock: NOON }), 0);
    expect(handle.moonGroup.style.display).toBe('none');
  });

  test('renders drifting clouds in Phase 1-2', () => {
    const { handle } = build(stateWith({ dayNightClock: NOON, tick: 0 }), 0);
    expect(handle.cloudPaths.length).toBeGreaterThan(0);
    expect(handle.cloudGroup.style.display).not.toBe('none');
  });

  test('cloudy season thickens the clouds', () => {
    const { handle: clear } = build(stateWith({ dayNightClock: NOON }), 0);
    const clearOpacity = Number(clear.cloudPaths[0]!.getAttribute('opacity'));

    const { handle: cloudy } = build(
      stateWith({ dayNightClock: NOON, activeEvent: { id: 'cloudySeason', ticksRemaining: 10 } }),
      0
    );
    const cloudyOpacity = Number(cloudy.cloudPaths[0]!.getAttribute('opacity'));

    expect(cloudyOpacity).toBeGreaterThan(clearOpacity);
  });

  test('lunar eclipse tints the moon differently than a normal night', () => {
    const { handle: normal } = build(stateWith({ dayNightClock: MIDNIGHT }), 0);
    const normalFill = normal.moonDisc.getAttribute('fill');

    const { handle: eclipse } = build(
      stateWith({ dayNightClock: MIDNIGHT, activeEvent: { id: 'lunarEclipse', ticksRemaining: 10 } }),
      0
    );
    const eclipseFill = eclipse.moonDisc.getAttribute('fill');

    expect(eclipseFill).not.toBe(normalFill);
  });

  test('lunar eclipse forces the moon to show even at noon', () => {
    const { handle } = build(
      stateWith({ dayNightClock: NOON, activeEvent: { id: 'lunarEclipse', ticksRemaining: 10 } }),
      0
    );
    expect(handle.moonGroup.style.display).not.toBe('none');
  });

  test('sun glow grows with total light', () => {
    const { handle: dim } = build(stateWith({ dayNightClock: NOON }), 10);
    const dimRadius = Number(dim.sunGlow.getAttribute('r'));

    const { handle: bright } = build(stateWith({ dayNightClock: NOON }), 10000);
    const brightRadius = Number(bright.sunGlow.getAttribute('r'));

    expect(brightRadius).toBeGreaterThan(dimRadius);
  });

  test('Orbital Age+ shows a fixed space sky with no sun, moon, or clouds', () => {
    const { handle } = build(stateWith({ phase: 10, dayNightClock: NOON }), 0);
    expect(handle.sunGroup.style.display).toBe('none');
    expect(handle.moonGroup.style.display).toBe('none');
    expect(handle.cloudGroup.style.display).toBe('none');
    expect(handle.starGroup.style.display).not.toBe('none');
  });

  test('terrestrial stars dim further as darkness falls, beyond the local night/light fade', () => {
    const { handle: natural } = build(stateWith({ dayNightClock: MIDNIGHT, darkness: 1 }), 0);
    const naturalOpacity = Number(natural.starCircles[0]!.getAttribute('opacity'));

    const { handle: dim } = build(stateWith({ dayNightClock: MIDNIGHT, darkness: 0.2 }), 0);
    const dimOpacity = Number(dim.starCircles[0]!.getAttribute('opacity'));

    expect(dimOpacity).toBeLessThan(naturalOpacity);
  });

  test('space-scene stars fade to invisible as darkness approaches zero', () => {
    const { handle } = build(stateWith({ phase: 10, dayNightClock: NOON, darkness: 0 }), 0);
    const opacity = Number(handle.starCircles[0]!.getAttribute('opacity'));
    expect(opacity).toBeCloseTo(0, 2);
  });

  test('space-scene sky washes bright as darkness approaches zero (universe permanently illuminated)', () => {
    const { handle: preserved } = build(stateWith({ phase: 10, dayNightClock: NOON, darkness: 1 }), 0);
    const preservedTop = preserved.skyTopStop.getAttribute('stop-color');

    const { handle: illuminated } = build(stateWith({ phase: 10, dayNightClock: NOON, darkness: 0 }), 0);
    const illuminatedTop = illuminated.skyTopStop.getAttribute('stop-color');

    expect(illuminatedTop).not.toBe(preservedTop);
  });
});
