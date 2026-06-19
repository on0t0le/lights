import type { BuildingId, GameState } from '../state';
import { hiddenForEra } from '../state';
import { BUILDINGS } from './buildings';

export const SAVE_KEY = 'lights-save';
const SAVE_VERSION = 9;

/**
 * v5 and earlier used a 5-phase scheme (Village/City/Planet/Space/Remove
 * Darkness = 1-5); v6 inserts Mega City and Megalopolis between City and
 * Planet, so old phase numbers 3+ need to shift up two. Phases 1-2
 * (Village/City) are unaffected - their triggers (Lighthouse, Power Plant)
 * didn't move relative to phase number.
 */
const PRE_V6_PHASE_REMAP: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 6, 5: 7 };

/**
 * v7 used the post-v6 7-phase scheme (Village..Remove Darkness = 1-7); v8's
 * 15-era rebuild snaps each old phase to its nearest equivalent new era. Old
 * phase 7 (Remove Darkness, the old endgame fork) lands at era 15 (Cosmic
 * Age), where the fork now lives.
 */
const V7_TO_V15_PHASE_REMAP: Record<number, number> = { 1: 3, 2: 5, 3: 6, 4: 7, 5: 10, 6: 11, 7: 15 };

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
 * every new era's buildings default to 0 on any older save without needing
 * a migration entry each time.
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
  let phase = state.phase ?? 1;
  if (fromVersion < 6) {
    phase = PRE_V6_PHASE_REMAP[phase] ?? phase;
  }
  if (fromVersion < 8) {
    phase = V7_TO_V15_PHASE_REMAP[phase] ?? phase;
  }
  return {
    ...state,
    buildings,
    resources: {
      ...state.resources,
      materials: state.resources.materials ?? 0,
      fuel: state.resources.fuel ?? 0,
      exotic: state.resources.exotic ?? 0,
    },
    // Recomputed from the (possibly remapped) phase rather than trusting an
    // old save's hiddenResources list, which used an earlier phase scheme.
    hiddenResources: hiddenForEra(phase),
    phase,
    research: state.research ?? [],
    activeEvent: state.activeEvent ?? null,
    eventCooldownTicks: state.eventCooldownTicks ?? 0,
    darkness: state.darkness ?? 1,
    ending: state.ending ?? null,
    // v9 added the era dwell lock (issue #7); defaulting to 0 always
    // satisfies MIN_ERA_TICKS immediately, so an old save never gets stuck.
    phaseSince: state.phaseSince ?? 0,
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

export function clearLocalStorage(): void {
  localStorage.removeItem(SAVE_KEY);
}
