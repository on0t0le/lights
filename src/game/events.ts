import type { EventId, GameState } from '../state';
import { nightAmount, dayAmount } from '../systems/daynight';

export interface EventEffect {
  happinessPenalty: number;
  lumenProductivityMult: number;
}

export const NEUTRAL_EFFECT: EventEffect = {
  happinessPenalty: 0,
  lumenProductivityMult: 1,
};

export interface EventDef {
  id: EventId;
  title: string;
  description: string;
  /** Phase this event first becomes eligible in. */
  phase: number;
  /** Last phase this event can still roll in - inclusive. Undefined = no upper bound. */
  maxPhase?: number;
  /**
   * Restricts this event to a half of the day/night cycle (systems/
   * daynight.ts's nightAmount/dayAmount > 0). Undefined = any time. Checked
   * both at roll time and every tick while active, so e.g. a meteor shower
   * rolled just before dawn can't bleed into daylight - it's force-ended
   * the moment the clock crosses over (see tickEvents).
   */
  timeOfDay?: 'day' | 'night';
  /** Relative likelihood among eligible events when a roll succeeds. */
  weight: number;
  durationTicks: number;
  effect: Partial<EventEffect>;
}

/**
 * Random events. Earth/sky events (migration, meteors, eclipses, clouds) are
 * bounded to eras 1-9 (Fire Age..Cold Fusion Age) - they stop making sense
 * once the player is off the ground (Orbital Age onward). Night-sky events
 * additionally only roll while it's actually night, not whenever the sun's
 * up. Space events (era 10+) take over once the player is in orbit.
 */
export const EVENTS: Record<EventId, EventDef> = {
  // --- Any time of day (Fire Age..Cold Fusion Age, era 1-9) ---
  birdMigration: {
    id: 'birdMigration',
    title: 'Bird Migration Disrupted',
    description: 'Artificial light has thrown off the migration.',
    phase: 1,
    maxPhase: 9,
    weight: 1,
    durationTicks: 30,
    effect: { happinessPenalty: 0.2 },
  },
  // Early-era event that drops happiness for reasons unrelated to power
  // plants or harsh lights - so the happiness mechanic is visibly in play
  // (and recoverable) before any industrial buildings exist.
  lightPollutionComplaints: {
    id: 'lightPollutionComplaints',
    title: 'Light Pollution Complaints',
    description: "Neighbors can't sleep with all these lights on.",
    phase: 1,
    maxPhase: 3,
    weight: 1,
    durationTicks: 25,
    effect: { happinessPenalty: 0.15 },
  },
  insomniaEpidemic: {
    id: 'insomniaEpidemic',
    title: 'Insomnia Epidemic',
    description: 'Sleepless nights are dragging down productivity.',
    phase: 2,
    maxPhase: 9,
    weight: 1,
    durationTicks: 30,
    effect: { lumenProductivityMult: 0.7 },
  },
  cloudySeason: {
    id: 'cloudySeason',
    title: 'Cloudy Season',
    description: 'Thick clouds roll in, dimming the view.',
    phase: 1,
    maxPhase: 9,
    weight: 1,
    durationTicks: 40,
    effect: { lumenProductivityMult: 0.9 },
  },
  // --- Night only (Fire Age..Cold Fusion Age, era 1-9) ---
  meteorShower: {
    id: 'meteorShower',
    title: 'Meteor Shower',
    description: 'Streaks of light cross the night sky.',
    phase: 1,
    maxPhase: 9,
    timeOfDay: 'night',
    weight: 1,
    durationTicks: 20,
    effect: { lumenProductivityMult: 1.05 },
  },
  northernLights: {
    id: 'northernLights',
    title: 'Northern Lights',
    description: 'The sky glows with colour.',
    phase: 1,
    maxPhase: 9,
    timeOfDay: 'night',
    weight: 1,
    durationTicks: 20,
    effect: { lumenProductivityMult: 1.05 },
  },
  lunarEclipse: {
    id: 'lunarEclipse',
    title: 'Total Lunar Eclipse',
    description: 'The moon vanishes into shadow.',
    phase: 2,
    maxPhase: 9,
    timeOfDay: 'night',
    weight: 1,
    durationTicks: 15,
    effect: { lumenProductivityMult: 1.1 },
  },
  // --- Era 10+ (Orbital Age on): the earth/sky events above no longer make
  // sense once the player is off the ground - these take their place. Any time. ---
  solarFlare: {
    id: 'solarFlare',
    title: 'Solar Flare',
    description: 'A burst of radiation overloads the grid.',
    phase: 10,
    weight: 1,
    durationTicks: 20,
    effect: { lumenProductivityMult: 0.75 },
  },
  gammaRayBurst: {
    id: 'gammaRayBurst',
    title: 'Gamma-Ray Burst',
    description: 'A distant cataclysm briefly outshines every star.',
    phase: 10,
    weight: 1,
    durationTicks: 15,
    effect: { lumenProductivityMult: 1.1 },
  },
  cosmicDust: {
    id: 'cosmicDust',
    title: 'Cosmic Dust Cloud',
    description: 'Fine dust drifts past, scattering starlight.',
    phase: 10,
    weight: 1,
    durationTicks: 25,
    effect: { lumenProductivityMult: 1.05 },
  },
};

/** Ticks of guaranteed quiet between one event ending and the next being rollable. */
const COOLDOWN_TICKS = 150;
/** Chance per tick, once off cooldown, that an eligible event is rolled. */
const ROLL_CHANCE = 0.008;

/** True if `event`'s timeOfDay (if any) matches the clock right now. */
function matchesTimeOfDay(event: EventDef, dayNightClock: number): boolean {
  if (event.timeOfDay === 'night') return nightAmount(dayNightClock) > 0;
  if (event.timeOfDay === 'day') return dayAmount(dayNightClock) > 0;
  return true;
}

function eligibleEvents(state: GameState): EventDef[] {
  return Object.values(EVENTS).filter((event) => {
    if (state.phase < event.phase) return false;
    if (event.maxPhase !== undefined && state.phase > event.maxPhase) return false;
    if (!matchesTimeOfDay(event, state.dayNightClock)) return false;
    return true;
  });
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

/**
 * Human-readable summary of an event's mechanical effect, for the event
 * card (ui/cards.ts) - so the player can see what an event *does*, not just
 * its flavor text. Only non-neutral fields are listed.
 */
export function effectSummary(effect: Partial<EventEffect>): string {
  const parts: string[] = [];
  if (effect.happinessPenalty) {
    parts.push(`Happiness -${Math.round(effect.happinessPenalty * 100)}%`);
  }
  if (effect.lumenProductivityMult !== undefined && effect.lumenProductivityMult !== 1) {
    const pct = Math.round((effect.lumenProductivityMult - 1) * 100);
    parts.push(`Lumen production ${pct >= 0 ? '+' : ''}${pct}%`);
  }
  return parts.join(' · ');
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
    // Force-end the moment the clock crosses out of the event's half of the
    // day/night cycle - durationTicks alone can't guarantee a night event
    // (e.g. a 20-tick meteor shower) won't bleed into daylight if it was
    // rolled close to dawn.
    if (!matchesTimeOfDay(EVENTS[state.activeEvent.id], state.dayNightClock)) {
      return { ...state, activeEvent: null, eventCooldownTicks: COOLDOWN_TICKS };
    }
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
