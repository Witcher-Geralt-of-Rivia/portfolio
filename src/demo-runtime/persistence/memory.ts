/**
 * Demo runtime: in-memory persistence.
 *
 * Used when IndexedDB cannot be opened: a private window with storage
 * disabled, a browser that refuses the database, a quota failure. The demo
 * stays fully usable for the rest of the session, and the shell says so
 * plainly rather than implying that changes will survive a reload.
 *
 * It is also what lets the runtime be tested in Node, where there is no
 * IndexedDB at all.
 *
 * Parity with the IndexedDB adapter is a requirement, not an aspiration. Two
 * behaviours in particular are easy to get wrong here and are implemented
 * deliberately:
 *
 *   1. Stored values are structurally cloned on the way in and on the way out.
 *      IndexedDB serialises, so a caller cannot reach back into the database
 *      through a reference it kept. A memory adapter that hands out live
 *      objects would let a UI bug mutate "persisted" state invisibly, and that
 *      bug would then not reproduce in the IndexedDB path.
 *
 *   2. `commit` is all-or-nothing. Writes are staged into copies and swapped
 *      in only once every operation has been applied without throwing.
 */

import type { DemoId, DemoMeta, DemoRecord, AuditEntry, Job } from "../types";
import { DemoError } from "../types";
import {
  isEmptyWriteSet,
  type DemoPersistenceAdapter,
  type ResetPayload,
  type WriteSet,
} from "./adapter";

type Tables = {
  records: Map<string, DemoRecord>;
  meta: Map<string, DemoMeta>;
  audit: Map<string, AuditEntry>;
  jobs: Map<string, Job>;
};

/* Composite key for the Map that stands in for an IndexedDB keyPath.
   The separator must be a character that cannot appear in a demo id,
   collection name or entity id, or two different key tuples could
   collapse onto one entry: the memory adapter would then lose a record
   that IndexedDB keeps, and the two would no longer behave identically. */
const KEY_SEPARATOR = "\u001f";

const key = (...parts: (string | number)[]) => parts.join(KEY_SEPARATOR);

function emptyTables(): Tables {
  return { records: new Map(), meta: new Map(), audit: new Map(), jobs: new Map() };
}

/**
 * `structuredClone` is available in every browser that supports the rest of
 * this runtime and in Node 17+. The JSON fallback exists only so a very old
 * environment degrades rather than throwing; it is never the expected path.
 */
function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryAdapter(): DemoPersistenceAdapter {
  let tables = emptyTables();
  let open = false;

  const assertOpen = () => {
    if (!open) {
      throw new DemoError("UNAVAILABLE", "Persistence has not been initialized.");
    }
  };

  return {
    mode: "memory",

    async initialize() {
      open = true;
    },

    async list(demoId: DemoId, collection: string) {
      assertOpen();
      const out: DemoRecord[] = [];
      for (const r of tables.records.values()) {
        if (r.demoId === demoId && r.collection === collection) out.push(clone(r));
      }
      return out;
    },

    async listAll(demoId: DemoId) {
      assertOpen();
      const out: DemoRecord[] = [];
      for (const r of tables.records.values()) {
        if (r.demoId === demoId) out.push(clone(r));
      }
      return out;
    },

    async get(demoId: DemoId, collection: string, id: string) {
      assertOpen();
      const hit = tables.records.get(key(demoId, collection, id));
      return hit ? clone(hit) : null;
    },

    async getMeta(demoId: DemoId) {
      assertOpen();
      const hit = tables.meta.get(key(demoId));
      return hit ? clone(hit) : null;
    },

    async listAudit(demoId: DemoId) {
      assertOpen();
      const out: AuditEntry[] = [];
      for (const a of tables.audit.values()) {
        if (a.demoId === demoId) out.push(clone(a));
      }
      return out.sort((x, y) => x.sequence - y.sequence);
    },

    async listJobs(demoId: DemoId, status?: Job["status"]) {
      assertOpen();
      const out: Job[] = [];
      for (const j of tables.jobs.values()) {
        if (j.demoId !== demoId) continue;
        if (status && j.status !== status) continue;
        out.push(clone(j));
      }
      return out.sort((x, y) => x.id.localeCompare(y.id));
    },

    async commit(demoId: DemoId, writes: WriteSet) {
      assertOpen();
      if (isEmptyWriteSet(writes)) return;

      /* Stage into copies. Nothing observable changes until every operation
         has succeeded, which is how the IndexedDB path behaves when a
         transaction aborts. */
      const staged: Tables = {
        records: new Map(tables.records),
        meta: new Map(tables.meta),
        audit: new Map(tables.audit),
        jobs: new Map(tables.jobs),
      };

      for (const r of writes.records?.put ?? []) {
        if (r.demoId !== demoId) {
          throw new DemoError(
            "FORBIDDEN",
            `A write for demo "${demoId}" carried a record belonging to "${r.demoId}".`,
            r.id
          );
        }
        staged.records.set(key(r.demoId, r.collection, r.id), clone(r));
      }

      for (const d of writes.records?.delete ?? []) {
        staged.records.delete(key(demoId, d.collection, d.id));
      }

      for (const a of writes.audit ?? []) {
        if (a.demoId !== demoId) {
          throw new DemoError(
            "FORBIDDEN",
            `A write for demo "${demoId}" carried an audit entry belonging to "${a.demoId}".`
          );
        }
        staged.audit.set(key(a.demoId, a.sequence), clone(a));
      }

      for (const j of writes.jobs?.put ?? []) {
        if (j.demoId !== demoId) {
          throw new DemoError(
            "FORBIDDEN",
            `A write for demo "${demoId}" carried a job belonging to "${j.demoId}".`,
            j.id
          );
        }
        staged.jobs.set(key(j.demoId, j.id), clone(j));
      }

      for (const id of writes.jobs?.delete ?? []) {
        staged.jobs.delete(key(demoId, id));
      }

      if (writes.meta) {
        if (writes.meta.demoId !== demoId) {
          throw new DemoError(
            "FORBIDDEN",
            `A write for demo "${demoId}" carried metadata belonging to "${writes.meta.demoId}".`
          );
        }
        staged.meta.set(key(writes.meta.demoId), clone(writes.meta));
      }

      tables = staged;
    },

    async resetDemo(payload: ResetPayload) {
      assertOpen();
      const { demoId } = payload;

      const staged: Tables = {
        records: new Map(),
        meta: new Map(tables.meta),
        audit: new Map(),
        jobs: new Map(),
      };

      /* Carry over every other demo untouched. Reset is scoped to one demo;
         resetting Operations must leave Field and Learning exactly as they
         were, including their revisions. */
      for (const [k, r] of tables.records) if (r.demoId !== demoId) staged.records.set(k, r);
      for (const [k, a] of tables.audit) if (a.demoId !== demoId) staged.audit.set(k, a);
      for (const [k, j] of tables.jobs) if (j.demoId !== demoId) staged.jobs.set(k, j);

      for (const r of payload.records) {
        if (r.demoId !== demoId) {
          throw new DemoError(
            "FORBIDDEN",
            `Reset of "${demoId}" was given a record belonging to "${r.demoId}".`,
            r.id
          );
        }
        staged.records.set(key(r.demoId, r.collection, r.id), clone(r));
      }

      /* Seeded audit history, written into the same staged commit as the
         records so a reset is still all-or-nothing. */
      for (const a of payload.audit ?? []) {
        if (a.demoId !== demoId) {
          throw new DemoError(
            "FORBIDDEN",
            `Reset of "${demoId}" was given an audit entry belonging to "${a.demoId}".`
          );
        }
        staged.audit.set(key(a.demoId, a.sequence), clone(a));
      }
      staged.meta.set(key(demoId), clone(payload.meta));

      tables = staged;
    },

    close() {
      open = false;
      tables = emptyTables();
    },
  };
}
