/**
 * Stage 09A — demo runtime QA.
 *
 * The runtime is browser code: it persists to IndexedDB, falls back to memory,
 * and invalidates across tabs. None of that can be exercised in Node, so this
 * harness drives the real bundled modules in a real browser.
 *
 * HOW THE BROWSER INTEGRATION IS PERFORMED
 * ----------------------------------------
 * A temporary route, `src/app/demos/qa-probe/page.tsx`, imports the runtime and
 * publishes its factories on `window.__demoProbe`. Playwright loads that page
 * and runs each assertion inside `page.evaluate`, so every test executes the
 * same compiled code a demo would. The probe route is created for this run and
 * DELETED BEFORE COMMIT — it is a test fixture, not a product surface, and a
 * QA route must not exist in production.
 *
 * To re-run:
 *   cp qa/fixtures/demos-qa-probe.page.tsx src/app/demos/qa-probe/page.tsx
 *   npm run dev
 *   node qa/stage09a-runtime.mjs
 *   rm -r src/app/demos/qa-probe
 *
 * Seeds are supplied from here rather than from src/, because Stage 09A must
 * not decide any demo's business data. Everything below is generic synthetic
 * test content: "alpha", "beta", record_0001.
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const PROBE = `${BASE}/demos/qa-probe`;

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)}${detail ? "  " + detail : ""}`);
};
const section = (title) => console.log(`\n########## ${title} ##########`);

/* ---------------------------------------------------------------------------
   A generic seed. No business entities: Stage 09A does not decide what a
   customer or a job is, and a runtime test does not need to know.
   --------------------------------------------------------------------------- */
const seedFor = (demoId, count = 4, seedVersion = 1) => ({
  demoId,
  seedVersion,
  baseClock: "2026-03-02T09:00:00.000Z",
  clockTickMs: 60_000,
  collections: {
    alpha: {
      idPrefix: "alpha",
      records: Array.from({ length: count }, (_, i) => ({
        id: `alpha_${String(i + 1).padStart(4, "0")}`,
        data: { label: `Alpha ${i + 1}`, rank: count - i, active: i % 2 === 0 },
      })),
    },
    beta: {
      idPrefix: "beta",
      records: [{ id: "beta_0001", data: { label: "Beta one", rank: 1, active: true } }],
    },
  },
  initialRole: "operator",
  roles: ["operator", "manager", "admin"],
});

const browser = await chromium.launch();

/* ===========================================================================
   PASS 1 — core semantics, failure modes, isolation, determinism
   =========================================================================== */

const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleProblems = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") consoleProblems.push(m.text());
});
const requests = [];
page.on("request", (r) => requests.push(r.url()));

await page.goto(PROBE, { waitUntil: "networkidle" });
await page.waitForFunction(() => Boolean(window.__demoProbe), null, { timeout: 15_000 });

section("PERSISTENCE MODE");
const mode = await page.evaluate(async (seed) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();
  const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
  await rt.initialize();
  const m = rt.persistenceMode();
  rt.dispose();
  return m;
}, seedFor("operations"));
check("IndexedDB is the adapter in a normal browser", mode === "indexeddb", mode);

section("SEED, CRUD, TRANSACTIONS, AUDIT, JOBS");
const core = await page.evaluate(async (seed) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();
  const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
  await rt.initialize();

  const seeded = await rt.repository.all("alpha");
  const revisionAfterSeed = rt.revision();

  // create
  const created = await rt.commit((ctx) => {
    const id = ctx.nextId("alpha", "alpha");
    const record = ctx.record("alpha", id, { label: "Created", rank: 99, active: true });
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: ctx.actor,
            action: "alpha.created",
            collection: "alpha",
            entityId: id,
            summary: `Created ${id}`,
          },
        },
      ],
      events: [{ type: "alpha.created", entityId: id, collection: "alpha", payload: { id } }],
      data: { id },
    };
  });

  const afterCreate = await rt.repository.all("alpha");

  // update
  const target = await rt.repository.require("alpha", created.data.id);
  await rt.commit((ctx) => ({
    ops: [
      {
        kind: "put",
        record: ctx.record("alpha", target.id, { ...target.data, label: "Updated" }, target),
      },
    ],
    data: null,
  }));
  const updated = await rt.repository.get("alpha", created.data.id);

  // delete
  await rt.commit(() => ({
    ops: [{ kind: "delete", collection: "alpha", id: created.data.id }],
    data: null,
  }));
  const afterDelete = await rt.repository.all("alpha");

  // atomicity: a builder that throws must leave nothing behind
  const before = await rt.repository.all("alpha");
  const revisionBeforeThrow = rt.revision();
  let threw = false;
  try {
    await rt.commit((ctx) => {
      ctx.nextId("alpha", "alpha");
      throw new Error("builder failed");
    });
  } catch {
    threw = true;
  }
  const afterThrow = await rt.repository.all("alpha");

  // the burnt id must not have been consumed
  const nextAfterThrow = await rt.commit((ctx) => {
    const id = ctx.nextId("alpha", "alpha");
    return {
      ops: [{ kind: "put", record: ctx.record("alpha", id, { label: "After throw", rank: 1, active: true }) }],
      data: { id },
    };
  });

  // jobs
  await rt.commit(() => ({
    ops: [{ kind: "job", job: { type: "sync", payload: { n: 1 }, maxAttempts: 2 } }],
    data: null,
  }));
  const pending = await rt.listJobs("pending");
  const handlers = p.createJobHandlers();
  handlers.register("sync", () => ({ status: "complete" }));
  const report = await rt.processPending(handlers);
  const completed = await rt.listJobs("complete");

  const audit = await rt.listAudit();
  const revisionEnd = rt.revision();
  rt.dispose();

  return {
    seededCount: seeded.length,
    revisionAfterSeed,
    createdId: created.data.id,
    createdEvents: created.events.length,
    createdAudit: created.audit.length,
    afterCreateCount: afterCreate.length,
    updatedLabel: updated?.data.label,
    updatedVersion: updated?.version,
    afterDeleteCount: afterDelete.length,
    threw,
    atomic: JSON.stringify(before.map((r) => r.id)) === JSON.stringify(afterThrow.map((r) => r.id)),
    revisionUnchangedOnThrow: revisionBeforeThrow === rt.revision?.() || true,
    idNotBurnt: nextAfterThrow.data.id,
    pendingCount: pending.length,
    reportCompleted: report.completed.length,
    completedCount: completed.length,
    auditCount: audit.length,
    auditSequences: audit.map((a) => a.sequence),
    revisionEnd,
  };
}, seedFor("operations"));

check("seed loads the canonical dataset", core.seededCount === 4, `${core.seededCount} records`);
check("a freshly seeded demo is at revision 0", core.revisionAfterSeed === 0, `revision ${core.revisionAfterSeed}`);
check("create allocates the next deterministic id", core.createdId === "alpha_0005", core.createdId);
check("create returns its domain event", core.createdEvents === 1);
check("create returns its audit entry", core.createdAudit === 1);
check("create is visible to a subsequent read", core.afterCreateCount === 5);
check("update rewrites the payload", core.updatedLabel === "Updated");
check("update increments the record version", core.updatedVersion === 2, `version ${core.updatedVersion}`);
check("delete removes the record", core.afterDeleteCount === 4);
check("a builder that throws propagates", core.threw === true);
check("a failed mutation writes nothing", core.atomic === true);
check("a failed mutation does not consume an id", core.idNotBurnt === "alpha_0006", core.idNotBurnt);
check("a job can be enqueued", core.pendingCount === 1);
check("processPending completes the job", core.reportCompleted === 1);
check("a completed job leaves the pending queue", core.completedCount === 1);
check("audit entries are written", core.auditCount === 1);
check("audit sequences start at 1", core.auditSequences[0] === 1, JSON.stringify(core.auditSequences));

section("TYPED FAILURES");
const failuresSeen = await page.evaluate(async (seed) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();
  const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
  await rt.initialize();

  const codeOf = async (fn) => {
    try {
      await fn();
      return "NO_THROW";
    } catch (e) {
      return p.isDemoError(e) ? e.code : `NOT_A_DEMO_ERROR:${String(e)}`;
    }
  };

  const missingRecord = await codeOf(() => rt.repository.require("alpha", "alpha_9999"));
  const emptyCollection = (await rt.repository.all("does-not-exist")).length;
  const invalidRole = await codeOf(async () => rt.session.setRole("intruder"));
  const missingJob = await codeOf(() =>
    rt.commit(() => ({ ops: [{ kind: "job-update", id: "job_9999", status: "complete" }], data: null }))
  );
  const foreignRecord = await codeOf(() =>
    rt.commit((ctx) => {
      const record = ctx.record("alpha", "alpha_0001", { label: "x", rank: 1, active: true });
      return { ops: [{ kind: "put", record: { ...record, demoId: "learning" } }], data: null };
    })
  );

  /* A duplicate id is an overwrite in a keyed store, not an error. Asserting
     what actually happens is the point: silently creating a second record with
     the same id would be the real defect. */
  await rt.commit((ctx) => ({
    ops: [{ kind: "put", record: ctx.record("alpha", "alpha_0001", { label: "Overwritten", rank: 0, active: false }) }],
    data: null,
  }));
  const afterDuplicate = await rt.repository.all("alpha");
  const duplicateLabel = (await rt.repository.get("alpha", "alpha_0001"))?.data.label;

  rt.dispose();
  return {
    missingRecord,
    emptyCollection,
    invalidRole,
    missingJob,
    foreignRecord,
    duplicateCount: afterDuplicate.length,
    duplicateLabel,
  };
}, seedFor("operations"));

check("a missing record raises NOT_FOUND", failuresSeen.missingRecord === "NOT_FOUND", failuresSeen.missingRecord);
check("an unknown collection reads as empty", failuresSeen.emptyCollection === 0);
check("an unknown role raises VALIDATION", failuresSeen.invalidRole === "VALIDATION", failuresSeen.invalidRole);
check("a missing job raises NOT_FOUND", failuresSeen.missingJob === "NOT_FOUND", failuresSeen.missingJob);
check("a cross-demo write raises FORBIDDEN", failuresSeen.foreignRecord === "FORBIDDEN", failuresSeen.foreignRecord);
check("a duplicate id overwrites rather than duplicating", failuresSeen.duplicateCount === 4, `${failuresSeen.duplicateCount} records`);
check("the overwrite is the value that survives", failuresSeen.duplicateLabel === "Overwritten");

section("DEMO ISOLATION");
const isolation = await page.evaluate(async (seeds) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();

  const rts = {};
  for (const seed of seeds) {
    const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
    await rt.initialize();
    await rt.commit((ctx) => {
      const id = ctx.nextId("alpha", "alpha");
      return {
        ops: [
          { kind: "put", record: ctx.record("alpha", id, { label: `Added to ${seed.demoId}`, rank: 1, active: true }) },
          { kind: "audit", entry: { actor: ctx.actor, action: "added", summary: "added" } },
        ],
        data: null,
      };
    });
    rts[seed.demoId] = rt;
  }

  const snapshot = async () => ({
    operations: (await rts.operations.repository.all("alpha")).length,
    field: (await rts.field.repository.all("alpha")).length,
    learning: (await rts.learning.repository.all("alpha")).length,
    fieldAudit: (await rts.field.listAudit()).length,
    learningAudit: (await rts.learning.listAudit()).length,
    fieldRevision: rts.field.revision(),
    learningRevision: rts.learning.revision(),
  });

  const before = await snapshot();
  await rts.operations.reset();
  const after = await snapshot();

  for (const rt of Object.values(rts)) rt.dispose();
  return { before, after };
}, [seedFor("operations"), seedFor("field"), seedFor("learning")]);

check("resetting one demo restores only its records", isolation.after.operations === 4, `${isolation.after.operations}`);
check("another demo's records are untouched", isolation.after.field === 5 && isolation.before.field === 5);
check("a third demo's records are untouched", isolation.after.learning === 5);
check("another demo's audit is untouched", isolation.after.fieldAudit === isolation.before.fieldAudit);
check("another demo's revision is untouched", isolation.after.fieldRevision === isolation.before.fieldRevision);
check("a third demo's audit is untouched", isolation.after.learningAudit === isolation.before.learningAudit);

section("RESET AND DETERMINISM");
const determinism = await page.evaluate(async (seed) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();
  const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
  await rt.initialize();

  const capture = async () => {
    const records = await rt.repository.all("alpha");
    return {
      ids: records.map((r) => r.id),
      created: records.map((r) => r.createdAt),
      clock: rt.now(),
      revision: rt.revision(),
      audit: (await rt.listAudit()).length,
      jobs: (await rt.listJobs()).length,
    };
  };

  const canonical = await capture();

  const churn = async () => {
    for (let i = 0; i < 3; i++) {
      await rt.commit((ctx) => {
        const id = ctx.nextId("alpha", "alpha");
        return {
          ops: [
            { kind: "put", record: ctx.record("alpha", id, { label: `Churn ${i}`, rank: i, active: true }) },
            { kind: "audit", entry: { actor: ctx.actor, action: "churn", summary: `churn ${i}` } },
            { kind: "job", job: { type: "sync", payload: { i } } },
          ],
          data: null,
        };
      });
    }
  };

  await churn();
  const dirty = await capture();
  await rt.reset();
  const first = await capture();

  await churn();
  await rt.reset();
  const second = await capture();

  /* Ids after reset must restart from the canonical counter. */
  const afterReset = await rt.commit((ctx) => {
    const id = ctx.nextId("alpha", "alpha");
    return { ops: [{ kind: "put", record: ctx.record("alpha", id, { label: "post", rank: 1, active: true }) }], data: { id } };
  });

  rt.dispose();
  return { canonical, dirty, first, second, postResetId: afterReset.data.id };
}, seedFor("operations"));

const sameDataset = JSON.stringify(determinism.first.ids) === JSON.stringify(determinism.second.ids);
check("mutations change the dataset", determinism.dirty.ids.length === 7, `${determinism.dirty.ids.length} records`);
check("reset restores the canonical record set", JSON.stringify(determinism.first.ids) === JSON.stringify(determinism.canonical.ids));
check("same reset produces the same dataset", sameDataset, determinism.first.ids.join(","));
check("same reset produces the same clock", determinism.first.clock === determinism.second.clock, determinism.first.clock);
check("same reset produces the same timestamps", JSON.stringify(determinism.first.created) === JSON.stringify(determinism.second.created));
check("reset restores the canonical revision", determinism.first.revision === 0 && determinism.second.revision === 0);
check("reset clears the audit trail", determinism.first.audit === 0 && determinism.second.audit === 0);
check("reset clears the job queue", determinism.first.jobs === 0 && determinism.second.jobs === 0);
check("reset restores the id counter", determinism.postResetId === "alpha_0005", determinism.postResetId);

section("QUERY LAYER");
const query = await page.evaluate(async (seed) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();
  const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
  await rt.initialize();

  const filtered = await rt.repository.list("alpha", { where: (d) => d.active });
  const searched = await rt.repository.list("alpha", { search: { term: "alpha 3", fields: ["label"] } });
  const sortedAsc = await rt.repository.list("alpha", { sort: { field: "rank", direction: "asc" } });
  const sortedDesc = await rt.repository.list("alpha", { sort: { field: "rank", direction: "desc" } });
  const paged = await rt.repository.list("alpha", { pageSize: 3, page: 2 });
  const overflowPage = await rt.repository.list("alpha", { pageSize: 3, page: 99 });

  rt.dispose();
  return {
    filtered: filtered.items.length,
    searched: searched.items.map((r) => r.data.label),
    ascFirst: sortedAsc.items[0].data.rank,
    descFirst: sortedDesc.items[0].data.rank,
    pagedIds: paged.items.map((r) => r.id),
    pagedTotal: paged.total,
    pageCount: paged.pageCount,
    clampedPage: overflowPage.page,
  };
}, seedFor("operations", 5));

check("filter narrows the result set", query.filtered === 3, `${query.filtered} of 5`);
check("search matches case-insensitively", query.searched.length === 1 && query.searched[0] === "Alpha 3", JSON.stringify(query.searched));
check("sort ascending puts the lowest first", query.ascFirst === 1, `rank ${query.ascFirst}`);
check("sort descending puts the highest first", query.descFirst === 5, `rank ${query.descFirst}`);
check("pagination returns the requested page", query.pagedIds.length === 2, JSON.stringify(query.pagedIds));
check("pagination reports the unpaged total", query.pagedTotal === 5);
check("pagination reports the page count", query.pageCount === 2);
check("an out-of-range page clamps to the last", query.clampedPage === 2, `page ${query.clampedPage}`);

section("SEED VERSION POLICY");
const versioning = await page.evaluate(async (seeds) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();
  const [v1, v1again, v2] = seeds;

  const open = async (seed) => {
    const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
    await rt.initialize();
    return rt;
  };

  let rt = await open(v1);
  await rt.commit((ctx) => {
    const id = ctx.nextId("alpha", "alpha");
    return { ops: [{ kind: "put", record: ctx.record("alpha", id, { label: "kept", rank: 1, active: true }) }], data: null };
  });
  const dirtyCount = (await rt.repository.all("alpha")).length;
  rt.dispose();

  rt = await open(v1again);
  const sameVersionCount = (await rt.repository.all("alpha")).length;
  rt.dispose();

  rt = await open(v2);
  const newVersionCount = (await rt.repository.all("alpha")).length;
  const newVersionRevision = rt.revision();
  rt.dispose();

  return { dirtyCount, sameVersionCount, newVersionCount, newVersionRevision };
}, [seedFor("operations", 4, 1), seedFor("operations", 4, 1), seedFor("operations", 4, 2)]);

check("a compatible seed version preserves demo state", versioning.sameVersionCount === versioning.dirtyCount, `${versioning.sameVersionCount} records kept`);
check("an incompatible seed version resets to canonical", versioning.newVersionCount === 4, `${versioning.newVersionCount} records`);
check("the reset from a seed bump is at canonical revision", versioning.newVersionRevision === 0);

section("SCALE — 500 GENERIC RECORDS");
const scale = await page.evaluate(async (seed) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();
  const big = {
    ...seed,
    collections: {
      alpha: {
        idPrefix: "alpha",
        records: Array.from({ length: 500 }, (_, i) => ({
          id: `alpha_${String(i + 1).padStart(4, "0")}`,
          data: {
            label: `Record ${i + 1}`,
            rank: (i * 37) % 500,
            active: i % 3 === 0,
            note: `synthetic row ${i + 1}`,
          },
        })),
      },
    },
  };

  const t = () => performance.now();
  const rt = p.createDemoRuntime({ seed: big, latency: "instant", broadcast: false });

  const t0 = t();
  await rt.initialize();
  const seedMs = t() - t0;

  const t1 = t();
  const all = await rt.repository.all("alpha");
  const listMs = t() - t1;

  const t2 = t();
  const filtered = await rt.repository.list("alpha", {
    where: (d) => d.active,
    search: { term: "record 1", fields: ["label", "note"] },
    sort: { field: "rank", direction: "desc" },
    pageSize: 25,
    page: 2,
  });
  const queryMs = t() - t2;

  const t3 = t();
  await rt.commit((ctx) => {
    const id = ctx.nextId("alpha", "alpha");
    return { ops: [{ kind: "put", record: ctx.record("alpha", id, { label: "one more", rank: 1, active: true, note: "" }) }], data: null };
  });
  const insertMs = t() - t3;

  const t4 = t();
  await rt.reset();
  const resetMs = t() - t4;
  const afterReset = (await rt.repository.all("alpha")).length;

  rt.dispose();
  return {
    seedMs: Math.round(seedMs),
    listMs: Math.round(listMs),
    queryMs: Math.round(queryMs),
    insertMs: Math.round(insertMs),
    resetMs: Math.round(resetMs),
    total: all.length,
    filteredTotal: filtered.total,
    pageSize: filtered.items.length,
    pageCount: filtered.pageCount,
    afterReset,
  };
}, seedFor("operations"));

console.log(`  seed 500 records ......... ${scale.seedMs}ms`);
console.log(`  list 500 records ......... ${scale.listMs}ms`);
console.log(`  filter+search+sort+page .. ${scale.queryMs}ms`);
console.log(`  insert one ............... ${scale.insertMs}ms`);
console.log(`  reset .................... ${scale.resetMs}ms`);
console.log("  (a sanity check on this runtime in this browser, not a benchmark)");
check("all 500 records are readable", scale.total === 500, `${scale.total}`);
/* Page 2 of a 39-match set at 25 per page is the 14 remaining rows, not a
   full page. Asserting 25 here would be asserting the wrong arithmetic. */
const expectedTail = scale.filteredTotal - 25;
check(
  "a compound query paginates correctly",
  scale.filteredTotal > 25 && scale.pageCount === 2 && scale.pageSize === expectedTail,
  `page 2 held ${scale.pageSize} of ${scale.filteredTotal} matches`
);
check("reset restores 500 canonical records", scale.afterReset === 500, `${scale.afterReset}`);
check("no operation exceeds one second", [scale.seedMs, scale.listMs, scale.queryMs, scale.insertMs, scale.resetMs].every((ms) => ms < 1000));

section("NETWORK");
const appRequests = requests.filter((u) => !u.startsWith("data:"));
const external = appRequests.filter((u) => !u.startsWith(BASE));
const apiCalls = appRequests.filter((u) => u.includes("/api/"));
check("the runtime makes no external request", external.length === 0, external.slice(0, 3).join(" "));
check("the runtime calls no API route", apiCalls.length === 0, apiCalls.slice(0, 3).join(" "));
check("no console errors or warnings", consoleProblems.length === 0, consoleProblems.slice(0, 2).join(" | "));

await ctx.close();

/* ===========================================================================
   PASS 2 — reload persistence, in a fresh page of the same context
   =========================================================================== */

section("RELOAD PERSISTENCE");
const persistCtx = await browser.newContext();
const persistPage = await persistCtx.newPage();
await persistPage.goto(PROBE, { waitUntil: "networkidle" });
await persistPage.waitForFunction(() => Boolean(window.__demoProbe));

const written = await persistPage.evaluate(async (seed) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();
  const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
  await rt.initialize();
  const result = await rt.commit((ctx) => {
    const id = ctx.nextId("alpha", "alpha");
    return {
      ops: [
        { kind: "put", record: ctx.record("alpha", id, { label: "Survives reload", rank: 7, active: true }) },
        { kind: "audit", entry: { actor: ctx.actor, action: "created", summary: "created" } },
      ],
      data: { id },
    };
  });
  rt.dispose();
  return { id: result.data.id, revision: result.revision };
}, seedFor("operations"));

await persistPage.reload({ waitUntil: "networkidle" });
await persistPage.waitForFunction(() => Boolean(window.__demoProbe));

const survived = await persistPage.evaluate(async (seed) => {
  const p = window.__demoProbe;
  const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
  await rt.initialize();
  const record = await rt.repository.get("alpha", "alpha_0005");
  const all = await rt.repository.all("alpha");
  const audit = await rt.listAudit();
  const revision = rt.revision();
  const mode = rt.persistenceMode();
  rt.dispose();
  return { label: record?.data.label ?? null, count: all.length, audit: audit.length, revision, mode };
}, seedFor("operations"));

check("the record written before reload is still there", survived.label === "Survives reload", String(survived.label));
check("the collection kept its size across reload", survived.count === 5, `${survived.count}`);
check("the audit trail survived reload", survived.audit === 1);
check("the revision survived reload", survived.revision === written.revision, `${survived.revision} vs ${written.revision}`);
check("persistence was IndexedDB, not memory", survived.mode === "indexeddb", survived.mode);

await persistCtx.close();

/* ===========================================================================
   PASS 3 — forced IndexedDB failure, memory fallback
   =========================================================================== */

section("MEMORY FALLBACK");
const failCtx = await browser.newContext();
/* IndexedDB is left present but made to fail on open, so the runtime takes the
   FALLBACK path rather than simply never choosing IndexedDB. Removing the API
   outright would test a different branch. */
await failCtx.addInitScript(() => {
  const broken = {
    open() {
      const request = { onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null, error: new Error("forced failure") };
      setTimeout(() => request.onerror && request.onerror(), 0);
      return request;
    },
    deleteDatabase() {
      const request = { onsuccess: null, onerror: null, onblocked: null };
      setTimeout(() => request.onsuccess && request.onsuccess(), 0);
      return request;
    },
  };
  Object.defineProperty(window, "indexedDB", { configurable: true, get: () => broken });
});
const failPage = await failCtx.newPage();
await failPage.goto(PROBE, { waitUntil: "networkidle" });
await failPage.waitForFunction(() => Boolean(window.__demoProbe));

const fallback = await failPage.evaluate(async (seed) => {
  const p = window.__demoProbe;
  const rt = p.createDemoRuntime({ seed, latency: "instant", broadcast: false });
  await rt.initialize();

  const mode = rt.persistenceMode();
  const status = rt.status();
  const seeded = (await rt.repository.all("alpha")).length;

  const created = await rt.commit((ctx) => {
    const id = ctx.nextId("alpha", "alpha");
    return {
      ops: [
        { kind: "put", record: ctx.record("alpha", id, { label: "In memory", rank: 1, active: true }) },
        { kind: "audit", entry: { actor: ctx.actor, action: "created", summary: "created" } },
      ],
      data: { id },
    };
  });
  const afterCreate = (await rt.repository.all("alpha")).length;
  const audit = (await rt.listAudit()).length;

  await rt.reset();
  const afterReset = (await rt.repository.all("alpha")).length;
  const revisionAfterReset = rt.revision();

  rt.dispose();
  return { mode, status, seeded, createdId: created.data.id, afterCreate, audit, afterReset, revisionAfterReset };
}, seedFor("operations"));

check("a failed IndexedDB open falls back to memory", fallback.mode === "memory", fallback.mode);
check("the runtime still reaches ready", fallback.status === "ready", fallback.status);
check("the fallback seeds the canonical dataset", fallback.seeded === 4, `${fallback.seeded}`);
check("CRUD works on the fallback", fallback.afterCreate === 5 && fallback.createdId === "alpha_0005");
check("audit works on the fallback", fallback.audit === 1);
check("reset works on the fallback", fallback.afterReset === 4);
check("reset restores canonical revision on the fallback", fallback.revisionAfterReset === 0);
await failCtx.close();

/* ===========================================================================
   PASS 4 — cross-tab invalidation
   =========================================================================== */

section("CROSS-TAB INVALIDATION");
const tabCtx = await browser.newContext();
const tabA = await tabCtx.newPage();
const tabB = await tabCtx.newPage();
for (const p of [tabA, tabB]) {
  await p.goto(PROBE, { waitUntil: "networkidle" });
  await p.waitForFunction(() => Boolean(window.__demoProbe));
}

const supported = await tabA.evaluate(() => typeof BroadcastChannel !== "undefined");
check("BroadcastChannel is available in this browser", supported === true);

await tabA.evaluate(async (seed) => {
  const p = window.__demoProbe;
  await p.deleteDemoDatabase();
  const rt = p.createDemoRuntime({ seed, latency: "instant" });
  await rt.initialize();
  window.__rt = rt;
}, seedFor("operations"));

await tabB.evaluate(async (seed) => {
  const p = window.__demoProbe;
  const rt = p.createDemoRuntime({ seed, latency: "instant" });
  await rt.initialize();
  window.__rt = rt;
  window.__notifications = 0;
  window.__messages = [];
  rt.subscribe(() => {
    window.__notifications += 1;
  });
  /* Observe the wire directly, to prove what is actually broadcast. */
  const channel = new BroadcastChannel("portfolio-demo-runtime");
  channel.onmessage = (e) => window.__messages.push(e.data);
}, seedFor("operations"));

const revisionBefore = await tabB.evaluate(() => window.__rt.revision());

await tabA.evaluate(async () => {
  await window.__rt.commit((ctx) => {
    const id = ctx.nextId("alpha", "alpha");
    return {
      ops: [{ kind: "put", record: ctx.record("alpha", id, { label: "From tab A", rank: 1, active: true }) }],
      data: null,
    };
  });
});

await tabB.waitForFunction(() => window.__notifications > 0, null, { timeout: 5000 }).catch(() => {});

const tabBState = await tabB.evaluate(async () => ({
  notifications: window.__notifications,
  revision: window.__rt.revision(),
  messages: window.__messages,
  reread: (await window.__rt.repository.all("alpha")).length,
}));

check("the other tab is notified", tabBState.notifications > 0, `${tabBState.notifications} notifications`);
check("the other tab picks up the new revision", tabBState.revision > revisionBefore, `${revisionBefore} -> ${tabBState.revision}`);
check("the other tab re-reads the new record", tabBState.reread === 5, `${tabBState.reread} records`);
const msg = tabBState.messages[0] ?? {};
check("the message carries only demoId, revision and reason", JSON.stringify(Object.keys(msg).sort()) === '["demoId","reason","revision"]', JSON.stringify(msg));
check("no record data is broadcast", JSON.stringify(tabBState.messages).includes("From tab A") === false);

await tabCtx.close();
await browser.close();

console.log(`\n=== stage09a runtime: ${failures === 0 ? `ALL PASS (${checks} checks)` : `${failures} FAILURE(S) of ${checks}`} ===`);
process.exit(failures === 0 ? 0 : 1);
