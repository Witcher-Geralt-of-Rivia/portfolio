/**
 * Demo runtime — the persistence contract.
 *
 * Everything above this line in the dependency order talks to this interface
 * and never to IndexedDB. That is a hard architectural rule, and it is what
 * makes two things possible at once: a memory adapter that keeps a demo usable
 * when IndexedDB is unavailable, and a runtime that can be exercised in Node
 * by a QA harness with no browser at all.
 *
 * Both implementations must behave identically. The memory adapter is not a
 * simplified stand-in — a fallback that quietly relaxes atomicity or key
 * uniqueness would hide exactly the bugs it is meant to survive.
 */

import type { StoreName } from "../config";
import type { AuditEntry, DemoId, DemoMeta, DemoRecord, Job } from "../types";

/**
 * The rows a transaction intends to write, computed before it opens.
 *
 * IndexedDB transactions commit as soon as control returns to the event loop
 * with no request outstanding, so a transaction that stops to compute
 * something has already ended. Passing a finished write set avoids the problem
 * by construction rather than by careful sequencing.
 */
export type WriteSet = {
  records?: { put?: DemoRecord[]; delete?: { collection: string; id: string }[] };
  audit?: AuditEntry[];
  jobs?: { put?: Job[]; delete?: string[] };
  meta?: DemoMeta;
};

/**
 * The subset of a demo's data a reset replaces. Reset deletes only the named
 * demo's rows: the other two demos must be untouched, which is a guarantee the
 * QA harness asserts directly.
 */
export type ResetPayload = {
  demoId: DemoId;
  records: DemoRecord[];
  meta: DemoMeta;
  /**
   * Optional seeded audit history (D-052).
   *
   * A demo whose canonical dataset implies past state transitions can restore
   * that trail on reset, so an Activity panel is not empty on first visit.
   * Omitted, reset clears audit as it always did — the demos that seed no
   * history are unaffected.
   *
   * These are runtime `AuditEntry` rows. The runtime still does not learn what
   * the entries describe; a demo's own domain composes them.
   */
  audit?: AuditEntry[];
};

export interface DemoPersistenceAdapter {
  /** Which implementation this is, for the runtime's session-only indicator. */
  readonly mode: "indexeddb" | "memory";

  /** Open the database and create any missing stores. Safe to call twice. */
  initialize(): Promise<void>;

  /** Every record in one collection of one demo. */
  list(demoId: DemoId, collection: string): Promise<DemoRecord[]>;

  /** Every record in one demo, across all collections. */
  listAll(demoId: DemoId): Promise<DemoRecord[]>;

  get(demoId: DemoId, collection: string, id: string): Promise<DemoRecord | null>;

  /** Read a demo's bookkeeping row, or null if the demo has never been seeded. */
  getMeta(demoId: DemoId): Promise<DemoMeta | null>;

  listAudit(demoId: DemoId): Promise<AuditEntry[]>;

  listJobs(demoId: DemoId, status?: Job["status"]): Promise<Job[]>;

  /**
   * Commit a write set atomically. Either every row lands or none does.
   *
   * This is the only mutating entry point besides `resetDemo`, so there is
   * exactly one place where partial writes would have to be prevented.
   */
  commit(demoId: DemoId, writes: WriteSet): Promise<void>;

  /**
   * Replace one demo's data with its canonical seed, in a single transaction.
   *
   * The delete and the reseed belong together: a reset that clears the demo
   * and then fails to write the seed leaves a visitor looking at an empty
   * application with no way to recover except another reset.
   */
  resetDemo(payload: ResetPayload): Promise<void>;

  /** Release handles. Idempotent. */
  close(): void;
}

/**
 * Store keys.
 *
 * Composite keys carry the demo id in first position so every read is
 * naturally scoped to one demo and cross-demo leakage is a structural
 * impossibility rather than something the query layer has to remember.
 */
export const recordKey = (r: Pick<DemoRecord, "demoId" | "collection" | "id">) =>
  [r.demoId, r.collection, r.id] as const;

export const auditKey = (a: Pick<AuditEntry, "demoId" | "sequence">) =>
  [a.demoId, a.sequence] as const;

export const jobKey = (j: Pick<Job, "demoId" | "id">) => [j.demoId, j.id] as const;

/** The stores a write set touches, so a transaction requests no more than it needs. */
export function storesFor(writes: WriteSet): StoreName[] {
  const stores: StoreName[] = [];
  if (writes.records?.put?.length || writes.records?.delete?.length) stores.push("records");
  if (writes.audit?.length) stores.push("audit");
  if (writes.jobs?.put?.length || writes.jobs?.delete?.length) stores.push("jobs");
  if (writes.meta) stores.push("meta");
  return stores;
}

/** True when a write set would write nothing. */
export function isEmptyWriteSet(writes: WriteSet): boolean {
  return storesFor(writes).length === 0;
}
