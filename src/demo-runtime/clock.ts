/**
 * Demo runtime: deterministic logical clock.
 *
 * Every timestamp a demo displays comes from here. None comes from
 * `Date.now()`.
 *
 * The reason is reproducibility. A demo whose audit trail is stamped with the
 * real time produces a different dataset on every visit, so a screenshot taken
 * today cannot be compared with one taken tomorrow, a QA assertion about "the
 * third audit entry" is untestable, and Reset does not actually restore the
 * state it claims to restore. A logical clock fixes all three: the same seed
 * plus the same number of mutations always yields the same timestamps.
 *
 * These are synthetic times. They are not real-world event times and must
 * never be presented as though they were.
 */

/**
 * A clock is a base instant plus a count of elapsed ticks. Both persist with
 * the demo's metadata, so a reload resumes exactly where it left off and a
 * reset returns to tick zero.
 */
export type DemoClock = {
  readonly baseClock: string;
  readonly tickMs: number;
  /** Ticks elapsed since `baseClock`. */
  ticks: number;
};

export function createClock(baseClock: string, tickMs: number, ticks = 0): DemoClock {
  const base = Date.parse(baseClock);
  if (Number.isNaN(base)) {
    throw new Error(`Demo clock base "${baseClock}" is not a parseable ISO timestamp.`);
  }
  if (!Number.isFinite(tickMs) || tickMs <= 0) {
    throw new Error(`Demo clock tick must be a positive number of milliseconds, received ${tickMs}.`);
  }
  return { baseClock, tickMs, ticks };
}

/**
 * The current logical instant, as an ISO string.
 *
 * Milliseconds are truncated to whole seconds so timestamps read like
 * business events rather than like machine samples.
 */
export function now(clock: DemoClock): string {
  const ms = Date.parse(clock.baseClock) + clock.ticks * clock.tickMs;
  return new Date(Math.floor(ms / 1000) * 1000).toISOString();
}

/**
 * Advance the clock and return the new instant.
 *
 * A mutation advances it by one tick by default. Workflows that want visible
 * separation between the steps of one operation may advance further.
 */
export function tick(clock: DemoClock, by = 1): string {
  if (!Number.isInteger(by) || by < 0) {
    throw new Error(`Clock tick count must be a non-negative integer, received ${by}.`);
  }
  clock.ticks += by;
  return now(clock);
}

/** Restore the clock to its canonical seed position. */
export function resetClock(clock: DemoClock): void {
  clock.ticks = 0;
}

/**
 * A time offset from the clock's current position, without moving it.
 *
 * Seed data uses this to lay out a plausible history ("this record was
 * created two days before the demo's base instant") while staying entirely
 * deterministic.
 */
export function offsetFrom(instant: string, ms: number): string {
  const t = Date.parse(instant);
  if (Number.isNaN(t)) {
    throw new Error(`Cannot offset from "${instant}": not a parseable ISO timestamp.`);
  }
  return new Date(Math.floor((t + ms) / 1000) * 1000).toISOString();
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
