/**
 * Demo runtime: IndexedDB persistence.
 *
 * A small typed wrapper over the native API. No library: the required surface
 * is four stores, five indexes, one transaction shape and one upgrade path,
 * and that is less code than the adapter that would wrap a dependency.
 *
 * Two IndexedDB behaviours shape the design here and are worth stating,
 * because both are quiet failures rather than errors:
 *
 *   1. A transaction commits as soon as control returns to the event loop with
 *      no request outstanding. Anything awaited mid-transaction that is not an
 *      IndexedDB request (a fetch, a timer, even an already-resolved promise
 *      in some engines) ends the transaction early and the rest of the writes
 *      land outside it, or throw. `commit` therefore takes a finished write
 *      set and issues every request synchronously before awaiting completion.
 *
 *   2. `onupgradeneeded` is the only place stores and indexes can be created.
 *      It must add what is missing and touch nothing else. Deleting the
 *      database on upgrade would be the easy way to guarantee a valid schema
 *      and would also throw away a visitor's demo state on every release.
 */

import {
  DEMO_DB_NAME,
  INDEX,
  RUNTIME_SCHEMA_VERSION,
  STORE,
  type StoreName,
} from "../config";
import type { AuditEntry, DemoId, DemoMeta, DemoRecord, Job } from "../types";
import { DemoError } from "../types";
import {
  isEmptyWriteSet,
  storesFor,
  type DemoPersistenceAdapter,
  type ResetPayload,
  type WriteSet,
} from "./adapter";

/** True when this environment can be asked for a database at all. */
export function indexedDbAvailable(): boolean {
  return typeof globalThis !== "undefined" && typeof globalThis.indexedDB !== "undefined";
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new DemoError("UNAVAILABLE", request.error?.message ?? "IndexedDB request failed."));
  });
}

/**
 * Resolves when the transaction commits, rejects if it aborts or errors.
 *
 * Awaiting the transaction rather than the last request is what makes
 * atomicity observable: a caller that sees this resolve knows every write in
 * the set is durable.
 */
function transactionAsPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(new DemoError("UNAVAILABLE", tx.error?.message ?? "Transaction aborted."));
    tx.onerror = () =>
      reject(new DemoError("UNAVAILABLE", tx.error?.message ?? "Transaction failed."));
  });
}

/**
 * Every key belonging to one demo, as a range.
 *
 * The three keyed stores all put `demoId` first in a composite key, so one
 * range covers a whole demo. The bounds rely on IndexedDB's key ordering: an
 * array sorts after every string, and an array sorts after any shorter array
 * sharing its prefix. So `[demoId]` falls below `[demoId, collection, id]`,
 * and `[demoId, []]` rises above every such key while stopping short of the
 * next demo. That is what makes a demo's rows deletable in one request without
 * touching another demo's.
 */
function demoKeyRange(demoId: DemoId): IDBKeyRange {
  return IDBKeyRange.bound([demoId], [demoId, []], false, true);
}

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE.records)) {
    const records = db.createObjectStore(STORE.records, {
      keyPath: ["demoId", "collection", "id"],
    });
    records.createIndex(INDEX.recordsByDemo, "demoId", { unique: false });
    records.createIndex(INDEX.recordsByDemoCollection, ["demoId", "collection"], {
      unique: false,
    });
  }

  if (!db.objectStoreNames.contains(STORE.meta)) {
    db.createObjectStore(STORE.meta, { keyPath: "demoId" });
  }

  if (!db.objectStoreNames.contains(STORE.audit)) {
    const audit = db.createObjectStore(STORE.audit, { keyPath: ["demoId", "sequence"] });
    audit.createIndex(INDEX.auditByDemo, "demoId", { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE.jobs)) {
    const jobs = db.createObjectStore(STORE.jobs, { keyPath: ["demoId", "id"] });
    jobs.createIndex(INDEX.jobsByDemo, "demoId", { unique: false });
    jobs.createIndex(INDEX.jobsByDemoStatus, ["demoId", "status"], { unique: false });
  }
}

export function createIndexedDbAdapter(
  databaseName: string = DEMO_DB_NAME
): DemoPersistenceAdapter {
  let db: IDBDatabase | null = null;

  const handle = (): IDBDatabase => {
    if (!db) throw new DemoError("UNAVAILABLE", "Persistence has not been initialized.");
    return db;
  };

  const readAll = async <T>(
    store: StoreName,
    index: string,
    query: IDBValidKey | IDBKeyRange
  ): Promise<T[]> => {
    const tx = handle().transaction(store, "readonly");
    const request = tx.objectStore(store).index(index).getAll(query);
    const [rows] = await Promise.all([
      requestAsPromise<T[]>(request),
      transactionAsPromise(tx),
    ]);
    return rows;
  };

  return {
    mode: "indexeddb",

    async initialize() {
      if (db) return;
      if (!indexedDbAvailable()) {
        throw new DemoError("UNAVAILABLE", "This browser exposes no IndexedDB.");
      }

      db = await new Promise<IDBDatabase>((resolve, reject) => {
        let request: IDBOpenDBRequest;
        try {
          request = globalThis.indexedDB.open(databaseName, RUNTIME_SCHEMA_VERSION);
        } catch (cause) {
          reject(
            new DemoError(
              "UNAVAILABLE",
              cause instanceof Error ? cause.message : "IndexedDB refused to open."
            )
          );
          return;
        }

        request.onupgradeneeded = () => upgrade(request.result);
        request.onsuccess = () => {
          const opened = request.result;
          /* Another tab asking for a newer schema must not be blocked by this
             one holding the old version open. */
          opened.onversionchange = () => opened.close();
          resolve(opened);
        };
        request.onerror = () =>
          reject(
            new DemoError(
              "UNAVAILABLE",
              request.error?.message ?? "IndexedDB refused to open."
            )
          );
        request.onblocked = () =>
          reject(
            new DemoError(
              "UNAVAILABLE",
              "Another tab is holding an older version of the demo database open."
            )
          );
      });
    },

    async list(demoId: DemoId, collection: string) {
      return readAll<DemoRecord>(
        STORE.records,
        INDEX.recordsByDemoCollection,
        IDBKeyRange.only([demoId, collection])
      );
    },

    async listAll(demoId: DemoId) {
      return readAll<DemoRecord>(
        STORE.records,
        INDEX.recordsByDemo,
        IDBKeyRange.only(demoId)
      );
    },

    async get(demoId: DemoId, collection: string, id: string) {
      const tx = handle().transaction(STORE.records, "readonly");
      const request = tx.objectStore(STORE.records).get([demoId, collection, id]);
      const [row] = await Promise.all([
        requestAsPromise<DemoRecord | undefined>(request),
        transactionAsPromise(tx),
      ]);
      return row ?? null;
    },

    async getMeta(demoId: DemoId) {
      const tx = handle().transaction(STORE.meta, "readonly");
      const request = tx.objectStore(STORE.meta).get(demoId);
      const [row] = await Promise.all([
        requestAsPromise<DemoMeta | undefined>(request),
        transactionAsPromise(tx),
      ]);
      return row ?? null;
    },

    async listAudit(demoId: DemoId) {
      const rows = await readAll<AuditEntry>(
        STORE.audit,
        INDEX.auditByDemo,
        IDBKeyRange.only(demoId)
      );
      return rows.sort((a, b) => a.sequence - b.sequence);
    },

    async listJobs(demoId: DemoId, status?: Job["status"]) {
      const rows = status
        ? await readAll<Job>(
            STORE.jobs,
            INDEX.jobsByDemoStatus,
            IDBKeyRange.only([demoId, status])
          )
        : await readAll<Job>(STORE.jobs, INDEX.jobsByDemo, IDBKeyRange.only(demoId));
      return rows.sort((a, b) => a.id.localeCompare(b.id));
    },

    async commit(demoId: DemoId, writes: WriteSet) {
      if (isEmptyWriteSet(writes)) return;
      const stores = storesFor(writes);
      const tx = handle().transaction(stores, "readwrite");

      /* Every request is issued here, synchronously, before the first await.
         Nothing between these lines may yield to the event loop. */
      if (writes.records) {
        const store = tx.objectStore(STORE.records);
        for (const r of writes.records.put ?? []) {
          if (r.demoId !== demoId) {
            tx.abort();
            throw new DemoError(
              "FORBIDDEN",
              `A write for demo "${demoId}" carried a record belonging to "${r.demoId}".`,
              r.id
            );
          }
          store.put(r);
        }
        for (const d of writes.records.delete ?? []) {
          store.delete([demoId, d.collection, d.id]);
        }
      }

      if (writes.audit?.length) {
        const store = tx.objectStore(STORE.audit);
        for (const a of writes.audit) {
          if (a.demoId !== demoId) {
            tx.abort();
            throw new DemoError(
              "FORBIDDEN",
              `A write for demo "${demoId}" carried an audit entry belonging to "${a.demoId}".`
            );
          }
          store.put(a);
        }
      }

      if (writes.jobs) {
        const store = tx.objectStore(STORE.jobs);
        for (const j of writes.jobs.put ?? []) {
          if (j.demoId !== demoId) {
            tx.abort();
            throw new DemoError(
              "FORBIDDEN",
              `A write for demo "${demoId}" carried a job belonging to "${j.demoId}".`,
              j.id
            );
          }
          store.put(j);
        }
        for (const id of writes.jobs.delete ?? []) {
          store.delete([demoId, id]);
        }
      }

      if (writes.meta) {
        if (writes.meta.demoId !== demoId) {
          tx.abort();
          throw new DemoError(
            "FORBIDDEN",
            `A write for demo "${demoId}" carried metadata belonging to "${writes.meta.demoId}".`
          );
        }
        tx.objectStore(STORE.meta).put(writes.meta);
      }

      await transactionAsPromise(tx);
    },

    async resetDemo(payload: ResetPayload) {
      const { demoId } = payload;
      const tx = handle().transaction(
        [STORE.records, STORE.meta, STORE.audit, STORE.jobs],
        "readwrite"
      );

      /* Clearing and reseeding share one transaction. A reset that emptied the
         demo and then failed to write the seed would leave a visitor with an
         application containing nothing and no obvious way back.

         The deletes are keyed ranges rather than cursors, and that is the whole
         correctness argument. A cursor walk issues a fresh request per step, so
         its deletes are queued AFTER any puts made in the same transaction and
         would remove the seed that was just written. Requests are processed in
         the order they are made, so issuing every delete synchronously before
         the first put is what actually orders the purge ahead of the reseed. */
      tx.objectStore(STORE.records).delete(demoKeyRange(demoId));
      tx.objectStore(STORE.audit).delete(demoKeyRange(demoId));
      tx.objectStore(STORE.jobs).delete(demoKeyRange(demoId));

      const records = tx.objectStore(STORE.records);
      for (const r of payload.records) {
        if (r.demoId !== demoId) {
          tx.abort();
          throw new DemoError(
            "FORBIDDEN",
            `Reset of "${demoId}" was given a record belonging to "${r.demoId}".`,
            r.id
          );
        }
        records.put(r);
      }

      /* Seeded audit history (D-052), issued after the purge and before the
         await, so it lands inside the same transaction and after the range
         delete that cleared the store. */
      if (payload.audit?.length) {
        const audit = tx.objectStore(STORE.audit);
        for (const a of payload.audit) {
          if (a.demoId !== demoId) {
            tx.abort();
            throw new DemoError(
              "FORBIDDEN",
              `Reset of "${demoId}" was given an audit entry belonging to "${a.demoId}".`
            );
          }
          audit.put(a);
        }
      }

      tx.objectStore(STORE.meta).put(payload.meta);

      await transactionAsPromise(tx);
    },

    close() {
      db?.close();
      db = null;
    },
  };
}

/**
 * Delete the whole demo database. Not used by the application (a visitor's
 * reset is always scoped to one demo), but kept for QA teardown so a harness
 * can start from nothing.
 */
export function deleteDemoDatabase(databaseName: string = DEMO_DB_NAME): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!indexedDbAvailable()) return resolve();
    const request = globalThis.indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () =>
      reject(new DemoError("UNAVAILABLE", request.error?.message ?? "Could not delete database."));
  });
}
