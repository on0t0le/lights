/**
 * Compact thousands/millions formatting shared by every panel that shows
 * lumens/materials/costs, so "you have X" and a button's "costs Y" never
 * read as contradicting each other (the reported "400000 lumens couldn't
 * afford an 80000 cost" bug was a display/rounding mismatch, not a real
 * affordability bug — this is the fix: one formatter, used everywhere).
 */
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(1);
}
