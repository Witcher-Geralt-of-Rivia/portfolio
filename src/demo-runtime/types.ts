/**
 * Demo runtime — shared type contracts.
 *
 * This module is the base of the demo platform's dependency order. It imports
 * nothing and is safe to load on the server; every other runtime module builds
 * on it. See `docs/DEMO_PLATFORM.md`.
 *
 * The runtime deliberately knows nothing about any product domain. It knows
 * records, collections, events, audit entries, jobs, roles, a clock and a
 * persistence adapter. It does not know what a lead, a vehicle, a technician
 * or a lesson is — those belong to each demo's own domain layer, which is
 * built on top of this. Keeping that boundary is what allows three unrelated
 * products to share one runtime.
 */

/* =====================================================================
   1. DEMO IDENTITY
   ===================================================================== */

/**
 * The three planned demonstrations. These are internal route identities, not
 * product brand names; see `demo-registry.ts`.
 */
export const DEMO_IDS = ["operations", "field", "learning"] as const;

export type DemoId = (typeof DEMO_IDS)[number];

export function isDemoId(value: unknown): value is DemoId {
  return typeof value === "string" && (DEMO_IDS as readonly string[]).includes(value);
}

/**
 * A collection is a named bucket of records within one demo — the runtime's
 * equivalent of a table. It is a plain string because the runtime must not
 * enumerate domain entities; each demo declares its own collection names.
 */
export type CollectionName = string;

/* =====================================================================
   2. ERRORS
   ===================================================================== */

/**
 * Application-level failure kinds.
 *
 * Deliberately not HTTP status codes. Nothing here crosses a network, and
 * modelling local failures as 404/409 would import a transport vocabulary
 * that does not apply. A future UI adapter may map these onto familiar
 * presentation states, but the domain speaks in its own terms.
 */
export type DemoErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAVAILABLE";

export class DemoError extends Error {
  readonly code: DemoErrorCode;
  /** Optional machine-readable detail: the field, id or store at fault. */
  readonly detail?: string;

  constructor(code: DemoErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "DemoError";
    this.code = code;
    this.detail = detail;
  }
}

export function isDemoError(value: unknown): value is DemoError {
  return value instanceof DemoError;
}

/* =====================================================================
   3. RECORDS
   ===================================================================== */

/**
 * One stored entity.
 *
 * `data` carries the domain payload; every other field is runtime bookkeeping.
 * `version` increments on each update so a future domain layer can detect a
 * stale write without the runtime having to understand the payload.
 *
 * Timestamps are ISO strings produced by the demo clock, never by
 * `Date.now()`. They are synthetic logical times, not real-world event times.
 */
export type DemoRecord<T = unknown> = {
  demoId: DemoId;
  collection: CollectionName;
  id: string;
  data: T;
  createdAt: string;
  updatedAt: string;
  version: number;
};

/* =====================================================================
   4. DOMAIN EVENTS
   ===================================================================== */

export type DomainEvent<T = unknown> = {
  id: string;
  demoId: DemoId;
  type: string;
  entityId?: string;
  collection?: CollectionName;
  occurredAt: string;
  payload: T;
};

export type DomainEventListener = (event: DomainEvent) => void;

/* =====================================================================
   5. AUDIT
   ===================================================================== */

/**
 * A meaningful business mutation, not a UI interaction.
 *
 * The distinction matters: an audit trail that records "tab clicked" is a
 * telemetry dump, and reading it teaches nobody anything about the system.
 * Audit entries are written explicitly by domain workflows, never harvested
 * automatically from events.
 */
export type AuditEntry = {
  demoId: DemoId;
  /** Monotonic within a demo, starting at 1. Doubles as the store key. */
  sequence: number;
  actor: string;
  action: string;
  collection?: CollectionName;
  entityId?: string;
  occurredAt: string;
  summary: string;
  /** Field-level before/after, when a workflow chooses to record it. */
  changes?: AuditChange[];
};

export type AuditChange = {
  field: string;
  from: string | null;
  to: string | null;
};

/* =====================================================================
   6. JOBS
   ===================================================================== */

export type JobStatus = "pending" | "processing" | "complete" | "failed";

/**
 * A unit of deferred work.
 *
 * There is no worker process and no timer. Jobs move only when a workflow
 * asks the queue to move them, which is what keeps the runtime idle-quiet and
 * every sequence reproducible. See `jobs.ts`.
 */
export type Job<T = unknown> = {
  demoId: DemoId;
  id: string;
  type: string;
  status: JobStatus;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  /** Set when status is "failed". */
  error?: string;
};

/* =====================================================================
   7. RUNTIME METADATA
   ===================================================================== */

/**
 * Per-demo bookkeeping held in the `meta` store.
 *
 * `revision` is the single value React and other tabs watch. `counters` and
 * `clockTicks` are what make reset reproducible: restoring them restores the
 * exact ids and timestamps the next mutations will produce.
 */
export type DemoMeta = {
  demoId: DemoId;
  seedVersion: number;
  runtimeSchemaVersion: number;
  /** Canonical base time for this demo, from its seed. */
  baseClock: string;
  /** Logical ticks elapsed since `baseClock`. */
  clockTicks: number;
  /** Next id number per collection, e.g. `{ customer: 12 }`. */
  counters: Record<CollectionName, number>;
  /** 0 means canonical seeded state; any higher value means the visitor changed something. */
  revision: number;
  /** Highest audit sequence written so far. */
  auditSequence: number;
  /** Next job number, so job ids stay deterministic too. */
  jobCounter: number;
};

/* =====================================================================
   8. SEED CONTRACT
   ===================================================================== */

export type SeedRecord<T = unknown> = {
  id: string;
  data: T;
};

export type SeedCollection = {
  /** Id prefix for this collection, e.g. "customer" -> customer_0001. */
  idPrefix: string;
  records: SeedRecord[];
};

/**
 * Everything a demo needs to be restored to its canonical state.
 *
 * A seed is data, not code: it must contain no function, no generated value
 * and nothing derived from the wall clock, because reset replays it verbatim
 * and two resets have to produce byte-identical state.
 */
export type DemoSeed = {
  demoId: DemoId;
  /** Bump only when the canonical dataset changes shape or content. */
  seedVersion: number;
  /** ISO timestamp the demo's logical clock starts from. */
  baseClock: string;
  /** Milliseconds the logical clock advances per tick. */
  clockTickMs: number;
  collections: Record<CollectionName, SeedCollection>;
  /** Optional overrides; any collection absent here starts after its seeded records. */
  counters?: Record<CollectionName, number>;
  initialRole: string;
  /** Roles the demo offers in its role switcher. */
  roles: readonly string[];
};

/* =====================================================================
   9. QUERY
   ===================================================================== */

export type SortDirection = "asc" | "desc";

/**
 * A small, typed query description.
 *
 * Not a query language and not an index planner. Demo collections hold tens
 * to low hundreds of records, so the repository reads a collection and filters
 * it in memory; building anything cleverer would be engineering for a scale
 * that will never arrive.
 */
export type QuerySpec<T> = {
  /** Applied first. Return true to keep the record. */
  where?: (data: T, record: DemoRecord<T>) => boolean;
  /** Case-insensitive substring match across the named fields. */
  search?: { term: string; fields: readonly (keyof T & string)[] };
  sort?: { field: keyof T & string; direction?: SortDirection };
  /** 1-based. Omitted means "every match". */
  page?: number;
  pageSize?: number;
};

export type QueryResult<T> = {
  items: DemoRecord<T>[];
  /** Matches before pagination. */
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/* =====================================================================
   10. MUTATION PLANS
   ===================================================================== */

/**
 * One persistence operation inside a plan.
 */
export type MutationOp =
  | { kind: "put"; record: DemoRecord }
  | { kind: "delete"; collection: CollectionName; id: string }
  | { kind: "audit"; entry: Omit<AuditEntry, "sequence" | "demoId" | "occurredAt"> }
  | { kind: "job"; job: Omit<Job, "demoId" | "createdAt" | "updatedAt" | "id" | "attempts" | "status"> & { id?: string } }
  | { kind: "job-update"; id: string; status: JobStatus; error?: string; attempts?: number };

/**
 * A complete change, computed before anything is written.
 *
 * Domain services build a plan from pure data and hand it to the runtime,
 * which commits every operation in one persistence transaction. Computing
 * first and writing second is what makes atomicity achievable at all: an
 * IndexedDB transaction closes as soon as control returns to the event loop
 * without a pending request, so a transaction that pauses to think has
 * already committed half its work.
 */
export type MutationPlan = {
  ops: MutationOp[];
  events?: Omit<DomainEvent, "id" | "demoId" | "occurredAt">[];
  /** Logical ticks to advance the clock by. Defaults to one. */
  ticks?: number;
};

export type MutationResult<T = unknown> = {
  data: T;
  events: DomainEvent[];
  audit: AuditEntry[];
  revision: number;
};

/* =====================================================================
   11. SESSION AND CONNECTIVITY
   ===================================================================== */

/**
 * Simulated application role.
 *
 * This is an interaction simulation, not a security boundary. Nothing is
 * authenticated, nothing is authorised, and every record remains readable in
 * browser storage regardless of the selected role. Never describe it as RBAC.
 */
export type SessionState = {
  activeRole: string;
  activeActorId: string;
};

/**
 * Connectivity the visitor controls, so a demo can show what an application
 * does when the network goes away. It is not `navigator.onLine` and never
 * consults it: the point is a deliberate, reproducible offline state.
 */
export type ConnectivityState = "online" | "offline";

/* =====================================================================
   12. RUNTIME STATUS
   ===================================================================== */

export type PersistenceMode = "indexeddb" | "memory";

export type RuntimeStatus = "initializing" | "ready" | "error";
