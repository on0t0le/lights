import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { tickEvents, activeEventEffect, NEUTRAL_EFFECT } from './events';

describe('activeEventEffect', () => {
  test('returns neutral effect when no event is active', () => {
    expect(activeEventEffect(createInitialState())).toEqual(NEUTRAL_EFFECT);
  });

  test('returns the active event\'s effect', () => {
    const state = { ...createInitialState(), activeEvent: { id: 'birdMigration' as const, ticksRemaining: 5 } };
    expect(activeEventEffect(state).happinessPenalty).toBeGreaterThan(0);
  });
});

describe('tickEvents', () => {
  test('does nothing while on cooldown, even if rng would roll an event', () => {
    const state = { ...createInitialState(), eventCooldownTicks: 10 };
    const next = tickEvents(state, () => 0); // rng=0 would always "win" a roll
    expect(next.activeEvent).toBeNull();
    expect(next.eventCooldownTicks).toBe(9);
  });

  test('rolls a new eligible event off cooldown when rng favors it', () => {
    const state = { ...createInitialState(), eventCooldownTicks: 0 };
    const next = tickEvents(state, () => 0); // rng=0 always rolls
    expect(next.activeEvent).not.toBeNull();
  });

  test('never rolls an event beyond the current phase', () => {
    const state = createInitialState(); // phase 1
    const next = tickEvents(state, () => 0);
    if (next.activeEvent) {
      expect(['birdMigration', 'meteorShower', 'northernLights', 'cloudySeason']).toContain(next.activeEvent.id);
    }
  });

  test('does not roll when rng disfavors it', () => {
    const state = createInitialState();
    const next = tickEvents(state, () => 0.999999);
    expect(next.activeEvent).toBeNull();
    expect(next.eventCooldownTicks).toBe(0);
  });

  test('counts down an active event and clears it with a cooldown when it expires', () => {
    const state = { ...createInitialState(), activeEvent: { id: 'birdMigration' as const, ticksRemaining: 1 } };
    const next = tickEvents(state, () => 1); // rng doesn't matter while an event is active
    expect(next.activeEvent).toBeNull();
    expect(next.eventCooldownTicks).toBeGreaterThan(0);
  });

  test('decrements ticksRemaining without clearing while still active', () => {
    const state = { ...createInitialState(), activeEvent: { id: 'birdMigration' as const, ticksRemaining: 3 } };
    const next = tickEvents(state, () => 1);
    expect(next.activeEvent).toEqual({ id: 'birdMigration', ticksRemaining: 2 });
  });
});
