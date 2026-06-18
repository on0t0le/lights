import type { EventId, GameState } from '../state';

export interface EventEffect {
  happinessPenalty: number;
  lumenProductivityMult: number;
  contrastBonus: number;
  wonderBonus: number;
}

export const NEUTRAL_EFFECT: EventEffect = {
  happinessPenalty: 0,
  lumenProductivityMult: 1,
  contrastBonus: 0,
  wonderBonus: 0,
};

export interface EventDef {
  id: EventId;
  title: string;
  description: string;
  phase: number;
  /** Relative likelihood among eligible events when a roll succeeds. */
  weight: number;
  durationTicks: number;
  effect: Partial<EventEffect>;
}

/** Spec's six random events. All currently phase 1-2 eligible. */
export const EVENTS: Record<EventId, EventDef> = {
  birdMigration: {
    id: 'birdMigration',
    title: 'Bird Migration Disrupted',
    description: 'Artificial light has thrown off the migration.',
    phase: 1,
    weight: 1,
    durationTicks: 30,
    effect: { happinessPenalty: 0.2 },
  },
  insomniaEpidemic: {
    id: 'insomniaEpidemic',
    title: 'Insomnia Epidemic',
    description: 'Sleepless nights are dragging down productivity.',
    phase: 2,
    weight: 1,
    durationTicks: 30,
    effect: { lumenProductivityMult: 0.7 },
  },
  meteorShower: {
    id: 'meteorShower',
    title: 'Meteor Shower',
    description: 'Streaks of light cross the night sky.',
    phase: 1,
    weight: 1,
    durationTicks: 20,
    effect: { wonderBonus: 0.1 },
  },
  northernLights: {
    id: 'northernLights',
    title: 'Northern Lights',
    description: 'The sky glows with colour.',
    phase: 1,
    weight: 1,
    durationTicks: 20,
    effect: { wonderBonus: 0.1 },
  },
  cloudySeason: {
    id: 'cloudySeason',
    title: 'Cloudy Season',
    description: 'Clouds soften the brightness below.',
    phase: 1,
    weight: 1,
    durationTicks: 40,
    effect: { contrastBonus: 0.1 },
  },
  lunarEclipse: {
    id: 'lunarEclipse',
    title: 'Total Lunar Eclipse',
    description: 'The moon vanishes into shadow.',
    phase: 2,
    weight: 1,
    durationTicks: 15,
    effect: { wonderBonus: 0.3 },
  },
};

/** Ticks of guaranteed quiet between one event ending and the next being rollable. */
const COOLDOWN_TICKS = 60;
/** Chance per tick, once off cooldown, that an eligible event is rolled. */
const ROLL_CHANCE = 0.02;

function eligibleEvents(state: GameState): EventDef[] {
  return Object.values(EVENTS).filter((event) => event.phase <= state.phase);
}

function pickWeighted(events: EventDef[], rng: () => number): EventDef {
  const totalWeight = events.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * totalWeight;
  for (const event of events) {
    roll -= event.weight;
    if (roll <= 0) {
      return event;
    }
  }
  // Floating-point edge case: roll exhausted the list without dropping below
  // 0 (e.g. rng() returned exactly 1). Fall back to the last eligible event.
  const last = events[events.length - 1];
  if (!last) {
    throw new Error('pickWeighted: events must be non-empty');
  }
  return last;
}

/** Merges the active event's effect over neutral defaults; neutral when no event is active. */
export function activeEventEffect(state: GameState): EventEffect {
  if (!state.activeEvent) {
    return NEUTRAL_EFFECT;
  }
  return { ...NEUTRAL_EFFECT, ...EVENTS[state.activeEvent.id].effect };
}

/**
 * Advances event lifecycle by one tick: counts down an active event to
 * expiry (then starts a cooldown), or - once off cooldown - rolls for a new
 * eligible event. `rng` is injected for deterministic tests; production
 * callers pass `Math.random`.
 */
export function tickEvents(state: GameState, rng: () => number): GameState {
  if (state.activeEvent) {
    const ticksRemaining = state.activeEvent.ticksRemaining - 1;
    if (ticksRemaining <= 0) {
      return { ...state, activeEvent: null, eventCooldownTicks: COOLDOWN_TICKS };
    }
    return { ...state, activeEvent: { ...state.activeEvent, ticksRemaining } };
  }

  if (state.eventCooldownTicks > 0) {
    return { ...state, eventCooldownTicks: state.eventCooldownTicks - 1 };
  }

  const eligible = eligibleEvents(state);
  if (eligible.length === 0 || rng() >= ROLL_CHANCE) {
    return state;
  }

  const chosen = pickWeighted(eligible, rng);
  return { ...state, activeEvent: { id: chosen.id, ticksRemaining: chosen.durationTicks } };
}
