/**
 * Deterministic PRNG so the demo dataset is reproducible across runs.
 * Seeded sales history is what the forecaster and credit scorer learn from,
 * so it must be identical on every `prisma db seed`.
 */
export function makeRng(seed = 20260101) {
  let s = seed >>> 0;
  return function rng(): number {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const int = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

export const float = (rng: Rng, min: number, max: number): number =>
  rng() * (max - min) + min;

export const pick = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];

export const chance = (rng: Rng, p: number): boolean => rng() < p;

export const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;
