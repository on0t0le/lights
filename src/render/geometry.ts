/**
 * Shared canvas geometry. Every renderer (background + the four phase
 * scenes) draws onto the same `viewBox`, so they all need to agree on
 * where the ground is - otherwise buildings drawn by one renderer "float"
 * above the horizon drawn by another (see settlement.ts).
 */
export const WIDTH = 800;
export const HEIGHT = 300;
/** Where background.ts's sky meets the ground. */
export const HORIZON_Y = 260;
/** Baseline every Phase 1-2 building sits on - matches the horizon exactly. */
export const GROUND_Y = HORIZON_Y;
