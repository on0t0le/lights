import { describe, expect, test } from 'vitest';
import { createInitialState } from './state';
import { buildingCost } from './game/buildings';

describe('createInitialState', () => {
  // Bug found by manually running the app: with 0 starting lumens and a
  // Candle costing 5, the player could never afford anything and the game
  // was permanently stuck. The village must start with enough lumens to
  // light the very first candle by hand.
  test('starts with enough lumens to afford the first candle', () => {
    const state = createInitialState();
    expect(state.resources.lumens).toBeGreaterThanOrEqual(buildingCost('candle', 0));
  });

  test('starts with no research, no active event, and neutral priorities', () => {
    const state = createInitialState();
    expect(state.research).toEqual([]);
    expect(state.activeEvent).toBeNull();
    expect(state.eventCooldownTicks).toBe(0);
    expect(state.priorities).toEqual({
      lumens: 0.5,
      energy: 0.5,
      happiness: 0.5,
      contrast: 0.5,
      wonder: 0.5,
    });
  });
});
