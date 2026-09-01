/**
 * Demo runtime — fixed configuration.
 *
 * Every database name, version number and store name lives here. Scattering
 * them through the persistence code is how an upgrade path quietly diverges
 * from the schema it is supposed to be upgrading.
 */

/**
 * One database for all three demos, with isolation enforced by the `demoId`
 * component of every key rather than by separate databases. A single database
 * means one upgrade path to reason about; per-demo databases would multiply
 * the migration surface by three for no benefit at this scale.
 */
export const DEMO_DB_NAME = "portfolio-demo-runtime";

/**
 * Runtime schema version 1 — frozen.
 *
 * This is the IndexedDB database version and governs stores and indexes only.
 * It is deliberately separate from a demo's `seedVersion`, which governs the
 * canonical dataset: adding a store must not discard a visitor's demo state,
 * and changing a demo's seed data must not force a database upgrade on the
 * other two demos.
 */
export const RUNTIME_SCHEMA_VERSION = 1;

export const STORE = {
  records: "records",
  meta: "meta",
  audit: "audit",
  jobs: "jobs",
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

export const STORE_NAMES: readonly StoreName[] = [
  STORE.records,
  STORE.meta,
  STORE.audit,
  STORE.jobs,
];

/**
 * Index names, kept beside the store definitions they belong to.
 *
 * Datasets here are tens to low hundreds of records per collection, so these
 * exist to make the common reads direct rather than to optimise anything.
 */
export const INDEX = {
  recordsByDemo: "by_demo",
  recordsByDemoCollection: "by_demo_collection",
  auditByDemo: "by_demo",
  jobsByDemo: "by_demo",
  jobsByDemoStatus: "by_demo_status",
} as const;

/**
 * Deterministic latency for the mock service boundary.
 *
 * Product UI should behave as though calls cross an application service
 * boundary, because that is what shapes real interface work: pending states,
 * disabled buttons, optimistic or pessimistic updates. These are the base
 * values; `async-service.ts` varies each operation within a small band by
 * hashing its name, so different calls feel different without any randomness.
 */
export const LATENCY_MS = {
  read: 100,
  mutation: 160,
  command: 220,
} as const;

/** Upper bound of each band. Read lands in 100-140ms, and so on. */
export const LATENCY_SPREAD_MS = {
  read: 40,
  mutation: 60,
  command: 80,
} as const;

export type LatencyKind = keyof typeof LATENCY_MS;

/**
 * Channel used to tell other tabs of the same origin that a demo changed.
 * Only an invalidation signal travels over it, never record data.
 */
export const BROADCAST_CHANNEL_NAME = "portfolio-demo-runtime";

/**
 * localStorage key for a demo's simulated role. Namespaced per demo so
 * switching role in one product cannot alter another.
 */
export function roleStorageKey(demoId: string): string {
  return `portfolio-demo:${demoId}:role`;
}

/**
 * Revision of a demo sitting in its canonical, freshly-seeded state.
 *
 * Reset returns to exactly this value, so `revision > 0` is a reliable
 * answer to "has the visitor changed anything?".
 */
export const CANONICAL_REVISION = 0;
