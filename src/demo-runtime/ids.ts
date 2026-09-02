/**
 * Demo runtime: deterministic identifiers.
 *
 * Entity ids are a monotonic counter per demo and collection, formatted as
 * `customer_0001`, `job_0002` and so on.
 *
 * `crypto.randomUUID()` is deliberately not used for canonical entities. A
 * random id means the same reset produces a different dataset, which breaks
 * reproducible screenshots, makes a QA assertion about a specific record
 * impossible to write, and turns any documented example id into a lie. A
 * readable sequential id is also simply better for a demonstration: a visitor
 * can see that `customer_0007` is the seventh customer.
 *
 * Counters persist with the demo's metadata, so ids keep ascending across a
 * reload and return to their canonical starting point on reset.
 */

import type { CollectionName } from "./types";

/** Width of the numeric suffix. Four digits covers every demo's scale. */
const PAD = 4;

export function formatId(prefix: string, value: number): string {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Id counter must be a positive integer, received ${value}.`);
  }
  return `${prefix}_${String(value).padStart(PAD, "0")}`;
}

/**
 * A counter set, one entry per collection.
 *
 * The stored number is the next value to hand out, so a freshly seeded
 * collection of six records leaves its counter at 7.
 */
export type Counters = Record<CollectionName, number>;

export function nextId(
  counters: Counters,
  collection: CollectionName,
  prefix: string
): string {
  const next = counters[collection] ?? 1;
  counters[collection] = next + 1;
  return formatId(prefix, next);
}

/** Read the next value without consuming it. */
export function peekCounter(counters: Counters, collection: CollectionName): number {
  return counters[collection] ?? 1;
}

/**
 * The numeric part of an id produced by `formatId`, or null if the id does not
 * have that shape. Used when rebuilding counters from seeded records.
 */
export function idSequence(id: string): number | null {
  const at = id.lastIndexOf("_");
  if (at < 1 || at === id.length - 1) return null;
  const tail = id.slice(at + 1);
  if (!/^\d+$/.test(tail)) return null;
  const n = Number(tail);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Counters implied by a set of seeded ids: one past the highest sequence seen
 * in each collection. A seed may override these explicitly, which is how a
 * demo can leave a deliberate gap in its id range.
 */
export function countersFromSeed(
  seeded: Record<CollectionName, readonly string[]>
): Counters {
  const counters: Counters = {};
  for (const [collection, ids] of Object.entries(seeded)) {
    let highest = 0;
    for (const id of ids) {
      const n = idSequence(id);
      if (n !== null && n > highest) highest = n;
    }
    counters[collection] = highest + 1;
  }
  return counters;
}

/**
 * Deterministic id for a runtime-generated artefact that is not a domain
 * entity: a domain event, for instance, where the sequence number is already
 * unique within the demo and the id only has to be stable and readable.
 */
export function sequenceId(prefix: string, demoId: string, sequence: number): string {
  return `${prefix}_${demoId}_${String(sequence).padStart(PAD, "0")}`;
}
