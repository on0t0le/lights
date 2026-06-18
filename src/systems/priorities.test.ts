import { describe, expect, test } from 'vitest';
import { createInitialState } from '../state';
import { priorityMultiplier, priorityShare } from './priorities';

describe('priorityMultiplier', () => {
  test('is exactly 1 for every resource at the neutral default (all sliders equal)', () => {
    const state = createInitialState();
    expect(priorityMultiplier(state, 'lumens')).toBe(1);
    expect(priorityMultiplier(state, 'energy')).toBe(1);
    expect(priorityMultiplier(state, 'happiness')).toBe(1);
  });

  test('favoring one resource raises its multiplier above 1', () => {
    const base = createInitialState();
    const state = { ...base, priorities: { ...base.priorities, lumens: 1 } };
    expect(priorityMultiplier(state, 'lumens')).toBeGreaterThan(1);
  });

  test('favoring one resource is a real tradeoff: it lowers another visible resource\'s multiplier', () => {
    const base = createInitialState();
    const state = { ...base, priorities: { ...base.priorities, lumens: 1 } };
    expect(priorityMultiplier(state, 'energy')).toBeLessThan(1);
  });

  test('lowering one resource is the mirror tradeoff: it raises the others', () => {
    const base = createInitialState();
    const state = { ...base, priorities: { ...base.priorities, lumens: 0 } };
    expect(priorityMultiplier(state, 'lumens')).toBeLessThan(1);
    expect(priorityMultiplier(state, 'energy')).toBeGreaterThan(1);
  });

  test('hidden resources (not yet shown to the player) keep a neutral multiplier by default', () => {
    const state = createInitialState();
    expect(state.hiddenResources).toContain('wonder');
    expect(priorityMultiplier(state, 'wonder')).toBe(1);
  });

  test('allocating among only the resources currently visible, ignoring hidden ones', () => {
    // Phase 1: contrast/wonder are hidden, so only lumens/energy/happiness share the pool.
    const base = createInitialState();
    const allUp = { ...base, priorities: { ...base.priorities, lumens: 1, energy: 1 } };
    // lumens and energy both favored equally -> still tied with each other, both above happiness.
    expect(priorityMultiplier(allUp, 'lumens')).toBeCloseTo(priorityMultiplier(allUp, 'energy'), 5);
    expect(priorityMultiplier(allUp, 'lumens')).toBeGreaterThan(priorityMultiplier(allUp, 'happiness'));
  });
});

describe('priorityShare', () => {
  test('shares among visible resources sum to 1', () => {
    const base = createInitialState();
    const state = { ...base, priorities: { ...base.priorities, lumens: 0.8, energy: 0.3 } };
    const total =
      priorityShare(state, 'lumens') + priorityShare(state, 'energy') + priorityShare(state, 'happiness');
    expect(total).toBeCloseTo(1, 5);
  });
});
