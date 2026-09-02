/**
 * Demo runtime: composition root.
 *
 * Owns a single demo's persistence, clock, counters, revision, audit sequence
 * and job queue, and is the only module that writes. Everything a product does
 * to its data goes through `commit`, which is what makes atomicity, audit
 * sequencing, deterministic ids and cross-tab invalidation a single concern
 * rather than five things every domain service has to remember.
 *
 * Nothing here knows what a lead or a lesson is. Domain services are built on
 * top; the runtime sees records, collections and plans.
 *
 * On multi-tab writes: each tab holds its own copy of the demo's metadata and
 * re-reads it when another tab announces a change. Two tabs mutating in the
 * same instant is last-writer-wins. That is the honest limit of a frontend-only
 * demo with no server to arbitrate, and it is not presented as anything else.
 */

import {
  createAsyncService,
  type AsyncService,
  type LatencyMode,
} from "./async-service";
import { buildAuditEntry, type AuditDraft } from "./audit";
import { createBroadcastLink, type BroadcastLink, type InvalidationReason } from "./broadcast";
import { createClock, now as clockNow, offsetFrom, type DemoClock } from "./clock";
import { CANONICAL_REVISION, RUNTIME_SCHEMA_VERSION } from "./config";
import { createConnectivity, type Connectivity } from "./connectivity";
import { createEventBus, type EventBus } from "./events";
import { countersFromSeed, formatId, nextId as allocate, sequenceId } from "./ids";
import {
  DEFAULT_MAX_ATTEMPTS,
  isTerminal,
  nextJobStatus,
  type JobHandlerRegistry,
  type ProcessReport,
} from "./jobs";
import type { DemoPersistenceAdapter, WriteSet } from "./persistence/adapter";
import { createIndexedDbAdapter, indexedDbAvailable } from "./persistence/indexed-db";
import { createMemoryAdapter } from "./persistence/memory";
import { createRepository, type DemoRepository } from "./repository";
import { createSession, type DemoSession } from "./session";
import {
  DemoError,
  type AuditEntry,
  type CollectionName,
  type DemoId,
  type DemoMeta,
  type DemoRecord,
  type DemoSeed,
  type DomainEvent,
  type Job,
  type MutationOp,
  type MutationResult,
  type PersistenceMode,
  type RuntimeStatus,
} from "./types";

/* =====================================================================
   MUTATION AUTHORING
   ===================================================================== */

/**
 * What a domain service is given while it builds a change.
 *
 * Ids and timestamps come from here rather than from module state, so they are
 * allocated against a scratch copy of the demo's metadata. If the builder
 * throws, or persistence rejects the write, the real counters and clock are
 * untouched and no id is silently burnt.
 */
export type MutationContext = {
  /** Current logical instant, after any ticks this mutation has taken. */
  now(): string;
  /** Advance the logical clock and return the new instant. */
  tick(by?: number): string;
  /** Next deterministic id in a collection, e.g. `customer_0007`. */
  nextId(collection: CollectionName, prefix: string): string;
  /** Who the audit trail should credit: the current simulated role. */
  readonly actor: string;
  /** Build a fully-formed record, stamped with the logical clock. */
  record<T>(collection: CollectionName, id: string, data: T, previous?: DemoRecord<T>): DemoRecord<T>;
};

export type MutationDraft<T> = {
  ops: MutationOp[];
  events?: Omit<DomainEvent, "id" | "demoId" | "occurredAt">[];
  /** What `commit` should return to the caller. */
  data: T;
};

export type MutationBuilder<T> = (ctx: MutationContext) => MutationDraft<T>;

/* =====================================================================
   RUNTIME
   ===================================================================== */

export type DemoRuntimeOptions = {
  seed: DemoSeed;
  /** Test harnesses pass "instant" to remove the boundary delay. */
  latency?: LatencyMode;
  /** Injected by QA to force the memory path, or to supply a fake database. */
  adapter?: DemoPersistenceAdapter;
  /** Set false in a harness that is testing a single tab in isolation. */
  broadcast?: boolean;
};

export type DemoRuntime = {
  readonly demoId: DemoId;
  readonly repository: DemoRepository;
  readonly session: DemoSession;
  readonly connectivity: Connectivity;
  readonly events: EventBus;
  readonly service: AsyncService;

  status(): RuntimeStatus;
  persistenceMode(): PersistenceMode;
  /** Populated when initialization failed outright. */
  error(): DemoError | null;

  initialize(): Promise<void>;

  /** Current demo revision. `0` means canonical, freshly-seeded state. */
  revision(): number;
  /** Notified whenever the revision changes, including from another tab. */
  subscribe(listener: () => void): () => void;

  commit<T>(build: MutationBuilder<T>): Promise<MutationResult<T>>;

  listAudit(): Promise<AuditEntry[]>;
  listJobs(status?: Job["status"]): Promise<Job[]>;
  processPending(handlers: JobHandlerRegistry): Promise<ProcessReport>;

  reset(): Promise<void>;

  /** Current logical instant. Synthetic; never a real-world event time. */
  now(): string;

  dispose(): void;
};

function seedRecords(seed: DemoSeed, clock: DemoClock): DemoRecord[] {
  const created = clockNow(clock);
  const records: DemoRecord[] = [];
  for (const [collection, definition] of Object.entries(seed.collections)) {
    for (const row of definition.records) {
      records.push({
        demoId: seed.demoId,
        collection,
        id: row.id,
        data: row.data,
        createdAt: created,
        updatedAt: created,
        version: 1,
      });
    }
  }
  return records;
}

/**
 * Seeded audit rows, numbered from 1 in the order the seed lists them.
 *
 * The sequence is assigned here rather than by the seed so that
 * `meta.auditSequence` and the stored rows cannot disagree, and so the first
 * entry a visitor's own action writes continues the same run of numbers.
 */
function seedAudit(seed: DemoSeed): AuditEntry[] {
  return (seed.audit ?? []).map((entry, i) => ({
    ...entry,
    demoId: seed.demoId,
    sequence: i + 1,
  }));
}

function seedMeta(seed: DemoSeed): DemoMeta {
  const seeded: Record<CollectionName, string[]> = {};
  for (const [collection, definition] of Object.entries(seed.collections)) {
    seeded[collection] = definition.records.map((r) => r.id);
  }
  return {
    demoId: seed.demoId,
    seedVersion: seed.seedVersion,
    runtimeSchemaVersion: RUNTIME_SCHEMA_VERSION,
    baseClock: seed.baseClock,
    clockTicks: 0,
    counters: { ...countersFromSeed(seeded), ...(seed.counters ?? {}) },
    revision: CANONICAL_REVISION,
    /* Continue past the seeded history, so the visitor's first audited action
       is entry 64 rather than a collision with entry 1. */
    auditSequence: seed.audit?.length ?? 0,
    jobCounter: 0,
  };
}

export function createDemoRuntime(options: DemoRuntimeOptions): DemoRuntime {
  const { seed } = options;
  const demoId = seed.demoId;

  let adapter: DemoPersistenceAdapter =
    options.adapter ?? (indexedDbAvailable() ? createIndexedDbAdapter() : createMemoryAdapter());
  let status: RuntimeStatus = "initializing";
  let failure: DemoError | null = null;
  let meta: DemoMeta = seedMeta(seed);
  let clock: DemoClock = createClock(seed.baseClock, seed.clockTickMs, 0);

  const events = createEventBus(demoId);
  const session = createSession(demoId, seed.roles, seed.initialRole);
  const connectivity = createConnectivity();
  const service = createAsyncService(options.latency ?? "interactive");
  const link: BroadcastLink =
    options.broadcast === false ? createBroadcastLink("__disabled__") : createBroadcastLink();

  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const announce = (reason: InvalidationReason) => {
    if (options.broadcast === false) return;
    link.post({ demoId, revision: meta.revision, reason });
  };

  /* Another tab changed this demo. Re-read the metadata so this tab's clock,
     counters and revision resume from the shared truth rather than from a
     stale local copy, then wake the React subscribers so they re-query. */
  const unlinkBroadcast = link.subscribe(async (message) => {
    if (message.demoId !== demoId) return;
    if (message.revision === meta.revision) return;
    try {
      const stored = await adapter.getMeta(demoId);
      if (stored) {
        meta = stored;
        clock = createClock(stored.baseClock, seed.clockTickMs, stored.clockTicks);
      }
    } catch {
      /* A failed re-read leaves this tab on its own copy; the next local
         mutation will reconcile. Not worth surfacing to the visitor. */
    }
    notify();
  });

  const applySeed = async (reason: InvalidationReason) => {
    clock = createClock(seed.baseClock, seed.clockTickMs, 0);
    const fresh = seedMeta(seed);
    await adapter.resetDemo({
      demoId,
      records: seedRecords(seed, clock),
      meta: fresh,
      audit: seedAudit(seed),
    });
    meta = fresh;
    announce(reason);
    notify();
  };

  /* Rebound if `initialize` falls back to the memory adapter, so the
     repository always reads through whichever adapter actually opened. */
  let repositoryRef = createRepository(adapter, demoId);

  const runtime: DemoRuntime = {
    demoId,
    get repository() {
      return repositoryRef;
    },
    session,
    connectivity,
    events,
    service,

    status: () => status,
    persistenceMode: () => adapter.mode,
    error: () => failure,

    async initialize() {
      if (status === "ready") return;
      try {
        await adapter.initialize();
      } catch (cause) {
        /* IndexedDB refused. A private window, blocked site data or a quota
           failure should not take the demo down: fall back to memory, keep
           the application fully usable for this session, and let the shell
           tell the visitor that changes will not survive a reload. */
        if (adapter.mode === "indexeddb") {
          try {
            adapter.close();
          } catch {
            /* Nothing was open. */
          }
          adapter = createMemoryAdapter();
          repositoryRef = createRepository(adapter, demoId);
          try {
            await adapter.initialize();
          } catch (memoryCause) {
            status = "error";
            failure =
              memoryCause instanceof DemoError
                ? memoryCause
                : new DemoError("UNAVAILABLE", "No persistence is available.");
            throw failure;
          }
        } else {
          status = "error";
          failure =
            cause instanceof DemoError
              ? cause
              : new DemoError("UNAVAILABLE", "No persistence is available.");
          throw failure;
        }
      }

      const stored = await adapter.getMeta(demoId);

      if (!stored) {
        await applySeed("seed");
      } else if (stored.seedVersion !== seed.seedVersion) {
        /* The canonical dataset changed shape between releases. Keeping the
           old rows would mean a demo built from two incompatible versions of
           the truth, so this demo, and only this demo, returns to canonical
           state. See docs/DEMO_PLATFORM.md, "Release compatibility". */
        await applySeed("reset");
      } else {
        meta = { ...stored, runtimeSchemaVersion: RUNTIME_SCHEMA_VERSION };
        clock = createClock(stored.baseClock, seed.clockTickMs, stored.clockTicks);
      }

      status = "ready";
      failure = null;
    },

    revision: () => meta.revision,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async commit<T>(build: MutationBuilder<T>): Promise<MutationResult<T>> {
      if (status !== "ready") {
        throw new DemoError("UNAVAILABLE", "The demo runtime is not ready.");
      }

      /* Scratch copies. Everything the builder allocates lands here first, so
         a builder that throws leaves the demo exactly as it was. */
      const draftMeta: DemoMeta = { ...meta, counters: { ...meta.counters } };
      const draftClock = createClock(meta.baseClock, seed.clockTickMs, meta.clockTicks);
      let ticked = false;

      const ctx: MutationContext = {
        now: () => clockNow(draftClock),
        tick(by = 1) {
          draftClock.ticks += by;
          ticked = true;
          return clockNow(draftClock);
        },
        nextId(collection, prefix) {
          return allocate(draftMeta.counters, collection, prefix);
        },
        actor: session.getState().activeActorId,
        record<R>(collection: CollectionName, id: string, data: R, previous?: DemoRecord<R>) {
          const at = clockNow(draftClock);
          return {
            demoId,
            collection,
            id,
            data,
            createdAt: previous?.createdAt ?? at,
            updatedAt: at,
            version: (previous?.version ?? 0) + 1,
          };
        },
      };

      const drafted = build(ctx);

      /* A mutation always advances the logical clock, so two successive
         changes never share a timestamp and an audit trail reads in order. */
      if (!ticked) draftClock.ticks += 1;
      const occurredAt = clockNow(draftClock);

      const writes: WriteSet = {};
      const audit: AuditEntry[] = [];
      const jobs: Job[] = [];

      for (const op of drafted.ops) {
        if (op.kind === "put") {
          (writes.records ??= {}).put = [...(writes.records.put ?? []), op.record];
        } else if (op.kind === "delete") {
          (writes.records ??= {}).delete = [
            ...(writes.records.delete ?? []),
            { collection: op.collection, id: op.id },
          ];
        } else if (op.kind === "audit") {
          draftMeta.auditSequence += 1;
          audit.push(
            buildAuditEntry(demoId, draftMeta.auditSequence, occurredAt, op.entry as AuditDraft)
          );
        } else if (op.kind === "job") {
          draftMeta.jobCounter += 1;
          const id = op.job.id ?? formatId("job", draftMeta.jobCounter);
          jobs.push({
            demoId,
            id,
            type: op.job.type,
            status: "pending",
            payload: op.job.payload,
            attempts: 0,
            maxAttempts: op.job.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            createdAt: occurredAt,
            updatedAt: occurredAt,
          });
        } else {
          const existing = await adapter.listJobs(demoId);
          const target = existing.find((j) => j.id === op.id);
          if (!target) {
            throw new DemoError("NOT_FOUND", `No job with id "${op.id}".`, op.id);
          }
          jobs.push({
            ...target,
            status: op.status,
            attempts: op.attempts ?? target.attempts,
            error: op.error,
            updatedAt: occurredAt,
          });
        }
      }

      if (audit.length) writes.audit = audit;
      if (jobs.length) (writes.jobs ??= {}).put = jobs;

      draftMeta.clockTicks = draftClock.ticks;
      draftMeta.revision = meta.revision + 1;
      writes.meta = draftMeta;

      await adapter.commit(demoId, writes);

      /* Persisted. Only now does the runtime adopt the scratch state. */
      meta = draftMeta;
      clock = draftClock;

      const domainEvents: DomainEvent[] = (drafted.events ?? []).map((e, i) => ({
        ...e,
        id: sequenceId("evt", demoId, meta.revision * 100 + i),
        demoId,
        occurredAt,
      }));

      events.publishAll(domainEvents);
      announce("mutation");
      notify();

      return { data: drafted.data, events: domainEvents, audit, revision: meta.revision };
    },

    async listAudit() {
      return adapter.listAudit(demoId);
    },

    async listJobs(jobStatus) {
      return adapter.listJobs(demoId, jobStatus);
    },

    async processPending(handlers) {
      const pending = await adapter.listJobs(demoId, "pending");
      const report: ProcessReport = {
        processed: 0,
        completed: [],
        failed: [],
        retried: [],
        skipped: [],
      };

      for (const job of pending) {
        const handler = handlers.get(job.type);
        if (!handler) {
          report.skipped.push(job.id);
          continue;
        }

        const outcome = await handler(job);
        const next = nextJobStatus(job, outcome);
        const error = outcome.status === "complete" ? undefined : outcome.error;

        await runtime.commit(() => ({
          ops: [
            {
              kind: "job-update",
              id: job.id,
              status: next,
              error,
              attempts: job.attempts + 1,
            },
          ],
          data: null,
        }));

        report.processed += 1;
        if (next === "complete") report.completed.push(job.id);
        else if (isTerminal(next)) report.failed.push(job.id);
        else report.retried.push(job.id);
      }

      return report;
    },

    async reset() {
      if (status !== "ready") {
        throw new DemoError("UNAVAILABLE", "The demo runtime is not ready.");
      }
      await applySeed("reset");
      session.resetRole();
      connectivity.set("online");
    },

    now: () => clockNow(clock),

    dispose() {
      unlinkBroadcast();
      link.close();
      listeners.clear();
      adapter.close();
      status = "initializing";
    },
  };

  return runtime;
}

/** Re-exported so seed authors can lay out a plausible history deterministically. */
export { offsetFrom };
