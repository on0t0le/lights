/**
 * How dark it currently is, from the day/night clock alone: 0 at noon, 1 at
 * midnight. Used by events.ts for night-only event gating.
 */
export function nightAmount(dayNightClock: number): number {
  // Mirrors render/background.ts's sunHeight: 0 = midnight, 0.5 = noon.
  const sunHeight = Math.sin((dayNightClock - 0.25) * Math.PI * 2);
  return Math.max(0, -sunHeight);
}

/**
 * How light it currently is, from the day/night clock alone: 0 at midnight,
 * 1 at noon. Mirror of nightAmount, for events.ts's day-only event gating
 * and continuous expiry (a day event must not survive into night, and
 * vice versa).
 */
export function dayAmount(dayNightClock: number): number {
  const sunHeight = Math.sin((dayNightClock - 0.25) * Math.PI * 2);
  return Math.max(0, sunHeight);
}
