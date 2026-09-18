/**
 * A small seeded PRNG so the synthetic dataset is identical on every launch.
 *
 * Determinism is the point: a screenshot taken today has to match the one taken
 * next week, and a bug reproduced on one machine has to reproduce on another.
 * Nothing here is cryptographic and nothing here should ever reach production —
 * this module exists only to feed the synthetic source.
 */
export class Rng {
  private state: number;

  constructor(seed: number | string) {
    this.state =
      typeof seed === "number" ? seed >>> 0 : Rng.hashString(seed) >>> 0;
    // A zero state would lock mulberry32 in place.
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  private static hashString(value: string): number {
    // FNV-1a, 32-bit.
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /** mulberry32 — float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max), rounded to `decimals`. */
  float(min: number, max: number, decimals = 2): number {
    const value = min + this.next() * (max - min);
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: empty list");
    return items[this.int(0, items.length - 1)] as T;
  }

  /** `count` distinct items, or all of them when the pool is smaller. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const taken: T[] = [];
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i += 1) {
      taken.push(...pool.splice(this.int(0, pool.length - 1), 1));
    }
    return taken;
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** A weighted pick: `[value, weight]` pairs. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1]![0];
  }
}
