import type { GameState, ResourceId } from '../state';

export function addResource(state: GameState, id: ResourceId, amount: number): GameState {
  return {
    ...state,
    resources: {
      ...state.resources,
      [id]: state.resources[id] + amount,
    },
  };
}

export function spendResource(state: GameState, id: ResourceId, amount: number): GameState {
  const next = Math.max(0, state.resources[id] - amount);
  return {
    ...state,
    resources: {
      ...state.resources,
      [id]: next,
    },
  };
}

export function canAfford(state: GameState, id: ResourceId, cost: number): boolean {
  return state.resources[id] >= cost;
}
