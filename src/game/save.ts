import type { BuildingId, GameState, ResourceId } from '../state';
import { BUILDINGS } from './buildings';

export const SAVE_KEY = 'lights-save';
const SAVE_VERSION = 4;

/** Neutral priority slider defaults, used when backfilling pre-v3 saves. */
const NEUTRAL_PRIORITIES: Record<ResourceId, number> = {
  lumens: 0.5,
  energy: 0.5,
  happiness: 0.5,
  contrast: 0.5,
  wonder: 0.5,
};

interface SavePayload {
  version: number;
  state: GameState;
}

export function serialize(state: GameState): string {
  const payload: SavePayload = { version: SAVE_VERSION, state };
  return JSON.stringify(payload);
}

export function deserialize(json: string): GameState {
  const parsed = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null || typeof parsed.version !== 'number') {
    throw new Error('Unrecognized save format: missing version');
  }
  const state = parsed.state;
  if (
    typeof state !== 'object' ||
    state === null ||
    typeof state.resources !== 'object' ||
    state.resources === null ||
    typeof state.buildings !== 'object' ||
    state.buildings === null
  ) {
    throw new Error('Unrecognized save format: malformed state');
  }
  return migrate(state as GameState, parsed.version);
}

/**
 * Backfills fields added in later save versions so older saves still load
 * cleanly. Building keys are backfilled generically from the current
 * BUILDINGS catalog (BuildingId), rather than a fixed per-version list, so
 * every new phase's buildings (Phase 3's solarFarm/fusionReactor/
 * orbitalMirror, Phase 4's dysonSwarm/whiteDwarfReactor/stellarMirror, ...)
 * default to 0 on any older save without needing a migration entry each time.
 */
function migrate(state: GameState, fromVersion: number): GameState {
  if (fromVersion >= SAVE_VERSION) {
    return state;
  }
  const buildings = { ...state.buildings };
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
    if (!(id in buildings)) {
      buildings[id] = 0;
    }
  }
  return {
    ...state,
    buildings,
    phase: state.phase ?? 1,
    research: state.research ?? [],
    activeEvent: state.activeEvent ?? null,
    eventCooldownTicks: state.eventCooldownTicks ?? 0,
    priorities: state.priorities ?? NEUTRAL_PRIORITIES,
    darkness: state.darkness ?? 1,
    ending: state.ending ?? null,
  };
}

export function saveToLocalStorage(state: GameState): void {
  localStorage.setItem(SAVE_KEY, serialize(state));
}

export function loadFromLocalStorage(): GameState | null {
  const json = localStorage.getItem(SAVE_KEY);
  if (json === null) {
    return null;
  }
  try {
    return deserialize(json);
  } catch {
    return null;
  }
}
