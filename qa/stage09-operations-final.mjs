/**
 * Stage 09 - Rental Operations, the final integration suite.
 *
 * Eleven modules have their own harnesses and between them they cover the list
 * grammar, the drawer, the forms, the role gate and the money to a depth this
 * file has no business repeating. So it does not. It asks the four questions a
 * module suite cannot ask, because none of them fits inside one screen:
 *
 *   1. Is the product whole? Eleven routes, eleven sidebar entries, and the
 *      temporary build-state mechanism actually deleted rather than merely
 *      unused.
 *   2. Does the business run end to end through the real interface? One lead
 *      arrives on the website and leaves as a serviced vehicle, and every step
 *      is a click on the product with the store read back through a second
 *      page to see what the click left behind.
 *   3. Is the world still coherent afterwards? Every vehicle, every contract,
 *      every payment, every pointer, scanned rather than sampled.
 *   4. Is it still safe and still shaped like an application at every width
 *      and for every role, and does one reset put all of it back?
 *
 * The sequence is the centre of the file. Nothing in it calls a service, and
 * nothing in it raises a domain event by hand: the automation rules fire
 * because a visitor filled in a form, which is the only evidence that the
 * wiring between the screens and the workflow layer is real.
 *
 * Sections 2, 3, 4 and 8 need a route that only exists during a QA run:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09-operations-final.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host,
 * 3100 is this portfolio's production and 3000 is its development preview.
 *
 * Against production the reader-dependent sections print a SKIP line and the
 * rest still runs, so a green exit means the product is sound either way.
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const OPS = `${BASE}/demos/operations`;
const PROBE = `${BASE}/demos/qa-operations`;

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

const POLL = { polling: 100, timeout: 20000 };

/**
 * The eleven modules, in sidebar order.
 *
 * `root` is the element the route renders and `ready` is the first thing that
 * exists only once the screen has data. Both matter: every page ships a
 * Suspense fallback carrying the root class and `aria-busy`, so a root alone
 * would be satisfied by the skeleton the module replaces.
 */
const MODULES = [
  { id: "Overview", path: OPS, root: ".ops-overview", ready: ".ops-kpi__value" },
  { id: "Leads", path: `${OPS}/leads`, root: ".ops-leads", ready: ".ops-leads__count" },
  { id: "Customers", path: `${OPS}/customers`, root: ".ops-customers", ready: ".ops-leads__count" },
  { id: "Reservations", path: `${OPS}/reservations`, root: ".ops-reservations", ready: ".ops-leads__count" },
  { id: "Contracts", path: `${OPS}/contracts`, root: ".ops-contracts", ready: ".ops-leads__count" },
  { id: "Fleet", path: `${OPS}/fleet`, root: ".ops-vehicles", ready: ".ops-leads__count" },
  { id: "Maintenance", path: `${OPS}/maintenance`, root: ".ops-maintenance", ready: ".ops-leads__count" },
  { id: "Payments", path: `${OPS}/payments`, root: ".ops-payments", ready: ".ops-leads__count" },
  { id: "Automations", path: `${OPS}/automations`, root: ".ops-automations", ready: ".ops-rule__name" },
  { id: "Inbox", path: `${OPS}/inbox`, root: ".ops-inbox", ready: ".ops-convo__subject" },
  { id: "Reports", path: `${OPS}/reports`, root: ".ops-reports", ready: ".ops-panel__title" },
];
const MOD = Object.fromEntries(MODULES.map((m) => [m.id, m]));

/**
 * The frozen permission matrix, quoted rather than imported.
 *
 * A suite that read the table out of `permissions.ts` would agree with the
 * product by construction and prove nothing. This is the specification's own
 * wording, written out, so a change to the policy has to be a deliberate edit
 * in two places.
 */
const MATRIX = {
  Admin: {
    Overview: "r", Leads: "rw", Customers: "rw", Reservations: "rw", Contracts: "rw",
    Fleet: "rw", Maintenance: "rw", Payments: "rw", Automations: "rw", Inbox: "rw", Reports: "rw",
  },
  "Sales Agent": {
    Overview: "r", Leads: "rw", Customers: "rw", Reservations: "rw", Contracts: "r",
    Fleet: "none", Maintenance: "none", Payments: "none", Automations: "none", Inbox: "rw", Reports: "none",
  },
  "Fleet Coordinator": {
    Overview: "r", Leads: "none", Customers: "none", Reservations: "rw", Contracts: "r",
    Fleet: "rw", Maintenance: "rw", Payments: "none", Automations: "none", Inbox: "none", Reports: "none",
  },
  "Finance Analyst": {
    Overview: "r", Leads: "none", Customers: "r", Reservations: "none", Contracts: "r",
    Fleet: "none", Maintenance: "none", Payments: "rw", Automations: "none", Inbox: "none", Reports: "r",
  },
};
const ROLES = ["Admin", "Sales Agent", "Fleet Coordinator", "Finance Analyst"];
const mayView = (role, module) => MATRIX[role][module] !== "none";
const viewableCount = (role) => MODULES.filter((m) => mayView(role, m.id)).length;

/** The canonical seed, as counts. Section 8 restores exactly this. */
const CANONICAL = {
  leads: 48,
  customers: 32,
  vehicles: 24,
  reservations: 18,
  contracts: 14,
  payments: 26,
  maintenance: 10,
  conversations: 20,
  messages: 64,
  automation_rules: 5,
  automation_runs: 18,
  notifications: 22,
};

/** The marker every record this suite creates carries, so section 8 can hunt. */
const MARK = "QA Final Sequence";

const browser = await chromium.launch();

/* =====================================================================
   THE SHARED HARNESS

   Lifted from `stage09c42-contracts.mjs` unchanged wherever it applies: the
   same select settle, the same drawer close, the same capture. A second
   implementation of any of these would be a second set of flakes.
   ===================================================================== */

/** A context and a page on one module, with the screen confirmed to be up. */
async function fresh(viewport = { width: 1440, height: 900 }, mod = MOD.Leads) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(mod.path, { waitUntil: "networkidle" });
  await waitModule(page, mod);
  /* A brand new context can go several seconds without producing a frame, and
     until it does every rect reads stale and every transition reads unstarted.
     A throwaway capture forces one, cheaply, before anything is measured. */
  await page.screenshot({ type: "jpeg", quality: 20 });
  return { ctx, page, problems };
}

/** Either the module has data, or the role gate has replaced it. */
async function waitModule(page, mod) {
  await page
    .waitForFunction(
      (ready) =>
        Boolean(document.querySelector(ready)) ||
        Boolean(document.querySelector(".ops-unavailable")),
      mod.ready,
      POLL
    )
    .catch(() => {});
  await page.waitForTimeout(250);
}

/** Navigate an existing page to a module and wait for it to settle. */
async function visit(page, mod, query = "") {
  await page.goto(`${mod.path}${query}`, { waitUntil: "networkidle" });
  await waitModule(page, mod);
}

async function choose(page, trigger, value) {
  await page.click(trigger);
  await page.waitForSelector('[role="listbox"]', POLL);
  /* The listbox animates in. Let the entry transition finish before clicking,
     so the option is already still when Playwright starts waiting for it to be
     stable: on a loaded machine the frames are slow enough that the wait can
     otherwise outlive its timeout. */
  await page.waitForTimeout(200);
  await page.click(`[role="listbox"] [role="option"][data-value="${value}"]`);
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, POLL);
  await page.waitForTimeout(150);
}

const FORM_SELECT = (n) => `.ops-form .demo-select__trigger >> nth=${n}`;
const ROLE_SELECT = ".ops-role__select .demo-select__trigger";

const countOf = (page) => page.$eval(".ops-leads__count", (e) => e.textContent.trim()).catch(() => "-");
const textOf = (page, sel, d = "-") =>
  page.$eval(sel, (e) => e.textContent.trim()).catch(() => d);
const marksOf = (page) =>
  page.$$eval(".ops-detail__marks > *", (n) => n.map((e) => e.textContent.trim()));
const actionsOf = (page) =>
  page.$$eval(".ops-detail__buttons .ops-button", (n) => n.map((e) => e.textContent.trim()));
const countOfSel = (page, sel) => page.$$eval(sel, (n) => n.length);

/**
 * How many of these a visitor can actually see.
 *
 * React streams a suspended boundary as a placeholder plus the resolved tree in
 * a `<div hidden id="S:0">` staging node, and swaps them on the client. For a
 * moment after navigation, and occasionally for longer, a module root therefore
 * appears twice in the document while exactly one of them is on screen.
 *
 * Counting elements would make that a failure, and it is not one: it is how
 * streaming SSR works. Counting rendered boxes asks the question the assertion
 * actually means, which is whether the visitor is looking at one module.
 */
const visibleCount = (page, sel) =>
  page.$$eval(sel, (nodes) => nodes.filter((n) => n.getClientRects().length > 0).length);

/* `.ops-detail__title` exists while the drawer is still a skeleton, so it is
   never the thing to wait on: the id and the missing-record notice are. */
const waitForDetail = (page) =>
  page.waitForFunction(
    () =>
      Boolean(document.querySelector(".ops-detail__id")) ||
      Boolean(document.querySelector(".ops-detail__missing")),
    null,
    POLL
  );

/** The label and value pairs under one named drawer section. */
const factsOf = (page, title) =>
  page.evaluate((wanted) => {
    const sections = [...document.querySelectorAll(".ops-detail__section")];
    const hit = sections.find(
      (s) => s.querySelector(".ops-detail__section-title")?.textContent.trim() === wanted
    );
    if (!hit) return null;
    return [...hit.querySelectorAll(".ops-facts__row")].map((row) => ({
      label: row.querySelector(".ops-facts__label")?.textContent.trim() ?? "",
      value: row.querySelector(".ops-facts__value")?.textContent.trim() ?? "",
    }));
  }, title);

/** The note under one named panel heading, which is where the counts live. */
const panelNote = (page, title) =>
  page.evaluate((wanted) => {
    const panels = [...document.querySelectorAll(".ops-panel")];
    const hit = panels.find(
      (p) => p.querySelector(".ops-panel__title")?.textContent.trim() === wanted
    );
    return hit?.querySelector(".ops-panel__note")?.textContent.trim() ?? null;
  }, title);

/**
 * Close whatever overlay is up, and wait for it to be gone.
 *
 * Not politeness: every overlay in this product is a native modal `<dialog>`,
 * so the chrome behind it is genuinely inert and a click on the role select or
 * the reset button while one is open will sit there until it times out.
 */
async function closeOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.$(".ops-overlay");
    if (!open) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  await page
    .waitForFunction(() => !document.querySelector(".ops-overlay"), null, POLL)
    .catch(() => {});
  await page.waitForTimeout(200);
}

/** Confirm the dialog that is up, and wait for it to go. */
async function confirmDialog(page) {
  await page.waitForSelector(".ops-confirm", POLL);
  await page.waitForTimeout(250);
  await page.click(".ops-confirm .ops-button--primary");
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(400);
}

/* =====================================================================
   THE READER

   A second page on the probe route, in the same context and therefore the same
   origin and the same IndexedDB the product persists to. An existing database
   with a matching seed version is loaded rather than reseeded, so this observes
   exactly what the screens wrote: no hand-written events, no second source of
   data, and no service called on the harness's behalf.

   Two pages, one context: after touching the reader, `bringToFront()` on the
   product page is mandatory before the next interaction, or the click lands on
   a backgrounded tab and the wait outlives its timeout.
   ===================================================================== */

async function openReader(ctx) {
  const reader = await ctx.newPage();
  const res = await reader.goto(PROBE, { waitUntil: "networkidle" }).catch(() => null);
  if (!res || res.status() !== 200) {
    await reader.close();
    return null;
  }
  await reader.waitForFunction(() => Boolean(window.__opsProbe), null, POLL);
  await reader.evaluate(async () => {
    const P = window.__opsProbe;
    window.__qaRuntime = P.createDemoRuntime({ seed: P.buildOperationsSeed(), latency: "off" });
    await window.__qaRuntime.initialize();
  });
  return reader;
}

/** One collection, flattened. Records are `{id, data}` wrappers, always. */
const allOf = (reader, collection) =>
  reader.evaluate(
    (c) =>
      window.__qaRuntime.repository
        .all(c)
        .then((rows) => rows.map((r) => ({ id: r.id, data: r.data }))),
    collection
  );

const countsOf = (reader) =>
  reader.evaluate(async () => {
    const rt = window.__qaRuntime;
    const names = [
      "leads", "customers", "vehicles", "reservations", "contracts", "payments",
      "maintenance", "conversations", "messages", "automation_rules",
      "automation_runs", "notifications",
    ];
    const out = {};
    for (const n of names) out[n] = (await rt.repository.all(n)).length;
    return out;
  });

const clockOf = (reader) => reader.evaluate(() => window.__qaRuntime.now());

/**
 * Poll the store until the screen's write has landed.
 *
 * Better than a fixed sleep after every click: a commit that is slower than
 * the guess fails loudly and immediately rather than intermittently, and one
 * that is faster costs nothing. The last reading is returned either way, so a
 * failure reports what was actually there.
 */
async function until(read, ok, timeout = 15000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeout) {
    try {
      last = await read();
      if (ok(last)) return last;
    } catch {
      /* A navigation can tear the read down mid-flight. Try again. */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return last;
}

/** The fleet invariant, over whatever the screens have just written. */
const fleetDrift = (reader) =>
  reader.evaluate(async () => {
    const rt = window.__qaRuntime;
    const ops = window.__opsProbe.operations;
    const [vehicles, contracts, reservations, workOrders] = await Promise.all([
      rt.repository.all("vehicles"),
      rt.repository.all("contracts"),
      rt.repository.all("reservations"),
      rt.repository.all("maintenance"),
    ]);
    const drift = [];
    for (const v of vehicles) {
      const world = { vehicleId: v.id, contracts, reservations, workOrders };
      const status = ops.derive.deriveVehicleStatus(world);
      const links = ops.derive.deriveVehicleLinks(world);
      const same =
        v.data.status === status &&
        (v.data.currentContractId ?? null) === (links.currentContractId ?? null) &&
        (v.data.currentReservationId ?? null) === (links.currentReservationId ?? null) &&
        (v.data.activeMaintenanceId ?? null) === (links.activeMaintenanceId ?? null);
      if (!same) {
        drift.push(
          `${v.id} stored[${v.data.status},c=${v.data.currentContractId ?? "-"},r=${
            v.data.currentReservationId ?? "-"
          },m=${v.data.activeMaintenanceId ?? "-"}] derived[${status},c=${
            links.currentContractId ?? "-"
          },r=${links.currentReservationId ?? "-"},m=${links.activeMaintenanceId ?? "-"}]`
        );
      }
    }
    return drift;
  });

/* =====================================================================
   1. ELEVEN MODULES EXIST

   The first thing a visitor can check about a product that claims eleven
   screens, and the last thing a module suite can: each of those suites only
   ever loads its own route.
   ===================================================================== */

section("ELEVEN MODULES - EVERY ROUTE, AND NO BUILD STATE LEFT");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, MOD.Overview);

  for (const mod of MODULES) {
    await visit(page, mod);
    const root = await visibleCount(page, mod.root);
    const busy = await countOfSel(page, `${mod.root}[aria-busy="true"]`);
    const ready = await visibleCount(page, mod.ready);
    check(
      `${mod.id} renders its module root`.slice(0, 58),
      root === 1 && busy === 0 && ready > 0,
      `root ${root}, busy ${busy}, ready ${ready}`
    );
    /* The build-state mechanism is deleted, not merely unused: a module that
       had no screen used to render as a non-interactive label, and the class
       and the branch behind it are both gone. Asserted on every page, because
       the sidebar is rendered once per route. */
    check(
      `${mod.id} shows no pending sidebar entry`.slice(0, 58),
      (await countOfSel(page, ".ops-sidebar__item--pending")) === 0
    );
    const shapes = await page.$$eval(".ops-sidebar__list li > *", (n) =>
      n.map((e) => e.tagName)
    );
    check(
      `${mod.id} sidebar is links only`.slice(0, 58),
      shapes.length === 11 && shapes.every((t) => t === "A"),
      `${shapes.length} entries: ${[...new Set(shapes)].join(",")}`
    );
  }

  check("Admin is offered all eleven modules", (await countOfSel(page, ".ops-sidebar a")) === 11, String(await countOfSel(page, ".ops-sidebar a")));
  const labels = await page.$$eval(".ops-sidebar__label", (n) => n.map((e) => e.textContent.trim()));
  check(
    "in the specification's order",
    labels.join(",") === MODULES.map((m) => m.id).join(","),
    labels.join(",")
  );
  check("and the eleven routes console cleanly", problems.length === 0, problems.join(" | ").slice(0, 140));

  await ctx.close();
}

/* =====================================================================
   2. THE FULL BUSINESS SEQUENCE, THROUGH THE REAL UI

   One lead, walked from the website form to a serviced vehicle, entirely by
   clicking the product. Every assertion between the steps is read from the
   store through the reader rather than from the page that made the change: a
   screen that printed the right word while writing the wrong record would pass
   any check made against itself.

   The context this opens is kept alive. Sections 3, 4 and 8 are questions
   about the world this sequence leaves behind, and a fresh context would be a
   fresh IndexedDB with a fresh seed, which is to say a different world.
   ===================================================================== */

section("THE BUSINESS SEQUENCE - LEAD TO SERVICED VEHICLE");

let seqCtx = null;
let seqPage = null;
let seqReader = null;
let seqProblems = [];
/** What the sequence made, for the sections that come after it. */
const made = {};

{
  const opened = await fresh({ width: 1440, height: 900 }, MOD.Leads);
  seqCtx = opened.ctx;
  seqPage = opened.page;
  seqProblems = opened.problems;
  seqReader = await openReader(seqCtx);

  if (!seqReader) {
    console.log("  SKIP  probe route absent (expected against production)");
  } else {
    const runsBefore = await allOf(seqReader, "automation_runs");
    const notesBefore = await allOf(seqReader, "notifications");
    check("the world starts at 18 automation runs", runsBefore.length === 18, String(runsBefore.length));

    /* ---- a. A website lead arrives ------------------------------------ */
    await seqPage.bringToFront();
    await seqPage.click(".ops-leads__toolbar .ops-button--primary");
    await seqPage.waitForSelector(".ops-form", POLL);
    await seqPage.waitForTimeout(300);
    await seqPage.fill(".ops-form .ops-input", MARK);
    await choose(seqPage, FORM_SELECT(0), "Website");
    await seqPage.click(".ops-form button[type=submit]");
    await waitForDetail(seqPage);
    await seqPage.waitForTimeout(400);

    const leadId = await textOf(seqPage, ".ops-detail__id");
    made.leadId = leadId;
    const leads = await until(
      () => allOf(seqReader, "leads"),
      (rows) => rows.some((l) => l.id === leadId)
    );
    const lead = leads.find((l) => l.id === leadId) ?? null;
    check("a. the form wrote a lead", lead !== null, leadId);
    check("a. named as it was typed", lead?.data.displayName === MARK, lead?.data.displayName ?? "");
    check("a. from the website", lead?.data.source === "Website", lead?.data.source ?? "");
    /* Rule 01 is the whole reason the source matters: a website lead is
       assigned to a sales agent without anyone choosing one. */
    check("a. Rule 01 gave it an owner", Boolean(lead?.data.assignedActorId), String(lead?.data.assignedActorId));
    const runsA = await until(
      () => allOf(seqReader, "automation_runs"),
      (rows) => rows.length > runsBefore.length
    );
    const newA = runsA.slice(runsBefore.length);
    check("a. one run was recorded", newA.length === 1, String(newA.length));
    check("a. by Rule 01", newA[0]?.data.ruleId === "automation_rule_0001", newA[0]?.data.ruleId ?? "");
    check("a. and it succeeded", newA[0]?.data.status === "Success", newA[0]?.data.status ?? "");

    /* ---- b. It qualifies ---------------------------------------------- */
    await seqPage.bringToFront();
    await choose(seqPage, ".ops-detail__actions .demo-select__trigger >> nth=0", "Qualified");
    const qualified = await until(
      () => allOf(seqReader, "leads"),
      (rows) => rows.find((l) => l.id === leadId)?.data.stage === "Qualified"
    );
    const bLead = qualified.find((l) => l.id === leadId);
    check("b. the stage control moved the lead", bLead?.data.stage === "Qualified", bLead?.data.stage ?? "");
    check("b. Rule 02 scheduled the follow-up", Boolean(bLead?.data.nextFollowUpAt), String(bLead?.data.nextFollowUpAt));
    const runsB = await until(
      () => allOf(seqReader, "automation_runs"),
      (rows) => rows.length > runsA.length
    );
    check(
      "b. through a run of Rule 02",
      runsB.slice(runsA.length).some((r) => r.data.ruleId === "automation_rule_0002" && r.data.status === "Success"),
      runsB.slice(runsA.length).map((r) => r.data.ruleId).join(",")
    );

    /* ---- c. It becomes a customer -------------------------------------- */
    await seqPage.bringToFront();
    await seqPage.click('.ops-detail__buttons .ops-button:has-text("Convert to customer")');
    await confirmDialog(seqPage);
    const customers = await until(
      () => allOf(seqReader, "customers"),
      (rows) => rows.some((c) => c.data.sourceLeadId === leadId)
    );
    const customer = customers.find((c) => c.data.sourceLeadId === leadId) ?? null;
    made.customerId = customer?.id ?? null;
    check("c. a customer was created from the lead", customer !== null, String(customer?.id));
    check("c. carrying the lead's name", customer?.data.displayName === MARK, customer?.data.displayName ?? "");
    const cLead = (await allOf(seqReader, "leads")).find((l) => l.id === leadId);
    check("c. and the lead points back at it", cLead?.data.convertedCustomerId === customer?.id, String(cLead?.data.convertedCustomerId));
    check("c. closed at Won", cLead?.data.stage === "Won", cLead?.data.stage ?? "");

    /* ---- d. A booking, confirmed onto a vehicle ------------------------ */
    const clock = await clockOf(seqReader);
    const at = (days) =>
      new Date(Date.parse(clock) + days * 86400000).toISOString().slice(0, 16);

    await seqPage.bringToFront();
    await visit(seqPage, MOD.Reservations);
    await seqPage.click(".ops-leads__toolbar .ops-button--primary");
    await seqPage.waitForSelector(".ops-form", POLL);
    await seqPage.waitForTimeout(300);
    await choose(seqPage, FORM_SELECT(0), made.customerId);
    /* Utility is the class with the most spare capacity in the seed, and the
       dates are a month out, so the booking never fails for want of a machine
       and the run stays deterministic. */
    await choose(seqPage, FORM_SELECT(1), "Utility");
    await seqPage.fill('.ops-form input[type="datetime-local"] >> nth=0', at(30));
    await seqPage.fill('.ops-form input[type="datetime-local"] >> nth=1', at(34));
    await seqPage.fill(".ops-form .ops-textarea", `${MARK}: the integration run`);
    await seqPage.click(".ops-form button[type=submit]");
    await waitForDetail(seqPage);
    await seqPage.waitForTimeout(400);

    const reservationId = await textOf(seqPage, ".ops-detail__id");
    made.reservationId = reservationId;
    const drafted = await until(
      () => allOf(seqReader, "reservations"),
      (rows) => rows.some((r) => r.id === reservationId)
    );
    const draft = drafted.find((r) => r.id === reservationId);
    check("d. the booking was written as a draft", draft?.data.status === "Draft", draft?.data.status ?? "");
    check("d. for the new customer", draft?.data.customerId === made.customerId, draft?.data.customerId ?? "");
    /* A draft holds nothing. The vehicle is chosen at confirmation, against
       eligibility over the dates, and not a moment earlier. */
    check("d. holding no vehicle yet", !draft?.data.vehicleId, String(draft?.data.vehicleId));

    await seqPage.bringToFront();
    await seqPage.click('.ops-detail__buttons .ops-button:has-text("Confirm reservation")');
    await seqPage.waitForSelector(".ops-overlay--sheet", POLL);
    await seqPage.waitForSelector(".ops-vehicle-option", POLL);
    await seqPage.waitForTimeout(300);
    const offered = await countOfSel(seqPage, ".ops-vehicle-option");
    check("d. the sheet offers the free vehicles", offered > 0, `${offered} offered`);
    await seqPage.click(".ops-vehicle-option >> nth=0");
    await seqPage.click(".ops-overlay--sheet .ops-sheet__foot .ops-button--primary");
    await seqPage
      .waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL)
      .catch(() => {});
    await seqPage.waitForTimeout(400);

    const confirmed = await until(
      () => allOf(seqReader, "reservations"),
      (rows) => rows.find((r) => r.id === reservationId)?.data.status === "Confirmed"
    );
    const booking = confirmed.find((r) => r.id === reservationId);
    made.vehicleId = booking?.data.vehicleId ?? null;
    check("d. confirming holds a vehicle", Boolean(made.vehicleId), String(made.vehicleId));
    const runsD = await until(
      () => allOf(seqReader, "automation_runs"),
      (rows) => rows.some((r) => r.data.ruleId === "automation_rule_0003" && !runsB.some((p) => p.id === r.id))
    );
    check(
      "d. Rule 03 ran on the confirmation",
      runsD.filter((r) => !runsB.some((p) => p.id === r.id)).some((r) => r.data.ruleId === "automation_rule_0003" && r.data.status === "Success"),
      runsD.filter((r) => !runsB.some((p) => p.id === r.id)).map((r) => r.data.ruleId).join(",")
    );
    const convos = await allOf(seqReader, "conversations");
    const thread = convos.find(
      (c) => c.data.subjectType === "Customer" && c.data.subjectId === made.customerId
    );
    check("d. a conversation carries the customer", Boolean(thread), String(thread?.id));
    check("d. and is unread", thread?.data.unread === true, String(thread?.data.unread));
    const messages = await allOf(seqReader, "messages");
    const system = messages.filter(
      (m) => m.data.conversationId === thread?.id && m.data.authorType === "System"
    );
    check("d. with a System message on it", system.length >= 1, `${system.length} system messages`);
    const dVehicle = await until(
      () => allOf(seqReader, "vehicles"),
      (rows) => rows.find((v) => v.id === made.vehicleId)?.data.status === "Reserved"
    );
    const held = dVehicle.find((v) => v.id === made.vehicleId);
    made.assetCode = held?.data.assetCode ?? null;
    check("d. the vehicle reads Reserved", held?.data.status === "Reserved", held?.data.status ?? "");
    check("d. pointing at the booking", held?.data.currentReservationId === reservationId, String(held?.data.currentReservationId));

    /* ---- e. Converted to a pending contract ---------------------------- */
    await seqPage.bringToFront();
    await seqPage.click('.ops-detail__buttons .ops-button:has-text("Convert to contract")');
    await confirmDialog(seqPage);
    const contracts = await until(
      () => allOf(seqReader, "contracts"),
      (rows) => rows.some((c) => c.data.reservationId === reservationId)
    );
    const contract = contracts.find((c) => c.data.reservationId === reservationId) ?? null;
    made.contractId = contract?.id ?? null;
    check("e. a contract names the booking", contract !== null, String(contract?.id));
    check("e. and starts Pending", contract?.data.status === "Pending", contract?.data.status ?? "");
    const eVehicle = await until(
      () => allOf(seqReader, "vehicles"),
      (rows) => rows.find((v) => v.id === made.vehicleId)?.data.status === "Available"
    );
    /* Available, and deliberately so. Converting ends the reservation's hold
       and a pending contract does not take one: capacity is held by
       activation, the way it was held by confirmation and not by a draft. */
    check(
      "e. a pending contract holds nothing",
      eVehicle.find((v) => v.id === made.vehicleId)?.data.status === "Available",
      eVehicle.find((v) => v.id === made.vehicleId)?.data.status ?? ""
    );

    /* ---- f. Activated, and the vehicle goes out ------------------------ */
    await seqPage.bringToFront();
    await visit(seqPage, MOD.Contracts, `?selected=${made.contractId}`);
    await waitForDetail(seqPage);
    await seqPage.waitForTimeout(300);
    check("f. the contract opens by link", (await textOf(seqPage, ".ops-detail__id")) === made.contractId, await textOf(seqPage, ".ops-detail__id"));
    check(
      "f. a pending contract offers activate and cancel",
      (await actionsOf(seqPage)).join(" | ") === "Activate contract | Cancel contract",
      (await actionsOf(seqPage)).join(" | ")
    );
    await seqPage.click('.ops-detail__buttons .ops-button:has-text("Activate contract")');
    await confirmDialog(seqPage);
    const active = await until(
      () => allOf(seqReader, "contracts"),
      (rows) => rows.find((c) => c.id === made.contractId)?.data.status === "Active"
    );
    check("f. activation lands", active.find((c) => c.id === made.contractId)?.data.status === "Active", active.find((c) => c.id === made.contractId)?.data.status ?? "");
    const fVehicle = await until(
      () => allOf(seqReader, "vehicles"),
      (rows) => rows.find((v) => v.id === made.vehicleId)?.data.status === "Rented"
    );
    const out = fVehicle.find((v) => v.id === made.vehicleId);
    check("f. the vehicle goes out on hire", out?.data.status === "Rented", out?.data.status ?? "");
    check("f. pointing at the contract", out?.data.currentContractId === made.contractId, String(out?.data.currentContractId));

    /* ---- g. Money against the contract -------------------------------- */
    const paidBefore = active.find((c) => c.id === made.contractId)?.data.paidAmount ?? 0;
    await seqPage.bringToFront();
    await visit(seqPage, MOD.Payments);
    await seqPage.click(".ops-leads__toolbar .ops-button--primary");
    await seqPage.waitForSelector(".ops-form", POLL);
    await seqPage.waitForTimeout(300);
    await choose(seqPage, FORM_SELECT(0), made.contractId);
    await seqPage.fill(".ops-form .ops-input", "50.00");
    await seqPage.click(".ops-form button[type=submit]");
    await seqPage
      .waitForFunction(() => !document.querySelector(".ops-form"), null, POLL)
      .catch(() => {});
    const payments = await until(
      () => allOf(seqReader, "payments"),
      (rows) => rows.some((p) => p.data.contractId === made.contractId)
    );
    const payment = payments.find((p) => p.data.contractId === made.contractId) ?? null;
    made.paymentId = payment?.id ?? null;
    check("g. a payment was written", payment !== null, String(payment?.id));
    check("g. for the amount that was typed", payment?.data.amount === 5000, String(payment?.data.amount));
    check("g. stored as Paid", payment?.data.status === "Paid", payment?.data.status ?? "");
    const paidAfter = await until(
      () => allOf(seqReader, "contracts"),
      (rows) => rows.find((c) => c.id === made.contractId)?.data.paidAmount === paidBefore + 5000
    );
    check(
      "g. the contract balance moved by exactly that",
      paidAfter.find((c) => c.id === made.contractId)?.data.paidAmount === paidBefore + 5000,
      `${paidAfter.find((c) => c.id === made.contractId)?.data.paidAmount} vs ${paidBefore + 5000}`
    );
    /* Opening Payments as a role that writes reconciles the overdue set, which
       is the only path in the product that raises `payment.overdue`. Rule 04
       is proved by having walked in here, not by a call. */
    const runsG = await until(
      () => allOf(seqReader, "automation_runs"),
      (rows) => rows.some((r) => r.data.ruleId === "automation_rule_0004")
    );
    /* A delta, not a total. The canonical seed already carries three Rule 04
       runs of its own (`seed_event_0004`, `_0009`, `_0014`), so asserting a
       total of three would have been asserting that the reconciliation did
       nothing. Three MORE is the claim: payment_0016, _0018 and _0019 are the
       overdue set at the base clock. */
    /* Counted by their source event rather than by rule id. The seed's three
       Rule 04 runs carry `seed_event_*`; only the reconciliation writes
       `reconcile_*`, so this counts what walking into the module produced and
       nothing else. */
    const overdueRuns = runsG.filter(
      (r) =>
        r.data.ruleId === "automation_rule_0004" &&
        String(r.data.sourceEventId).startsWith("reconcile_")
    );
    check(
      "g. and Rule 04 woke on the overdue set",
      overdueRuns.length === 3,
      `${overdueRuns.length} raised, ${runsG.filter((r) => r.data.ruleId === "automation_rule_0004").length} in total`
    );
    check(
      "g. once for each payment the clock had passed",
      overdueRuns
        .map((r) => String(r.data.sourceEventId).replace(/^reconcile_/, "").replace(/_\d+$/, ""))
        .sort()
        .join(",") === "payment_0016,payment_0018,payment_0019",
      overdueRuns.map((r) => r.data.sourceEventId).join(",")
    );

    /* ---- h. Completed, and the vehicle comes back ---------------------- */
    await seqPage.bringToFront();
    await visit(seqPage, MOD.Contracts, `?selected=${made.contractId}`);
    await waitForDetail(seqPage);
    await seqPage.waitForTimeout(300);
    await seqPage.click('.ops-detail__buttons .ops-button:has-text("Complete contract")');
    await confirmDialog(seqPage);
    const completed = await until(
      () => allOf(seqReader, "contracts"),
      (rows) => rows.find((c) => c.id === made.contractId)?.data.status === "Completed"
    );
    check("h. completion lands", completed.find((c) => c.id === made.contractId)?.data.status === "Completed", completed.find((c) => c.id === made.contractId)?.data.status ?? "");
    const hVehicle = await until(
      () => allOf(seqReader, "vehicles"),
      (rows) => rows.find((v) => v.id === made.vehicleId)?.data.status === "Available"
    );
    const back = hVehicle.find((v) => v.id === made.vehicleId);
    check("h. the vehicle comes back to the fleet", back?.data.status === "Available", back?.data.status ?? "");
    check("h. and the contract pointer is gone", !back?.data.currentContractId, String(back?.data.currentContractId));
    /* A finished agreement is a record, not a control panel: every action is
       withdrawn once there is nothing left to do to it. */
    check("h. a completed contract offers nothing", (await countOfSel(seqPage, ".ops-detail__buttons")) === 0);

    /* ---- i. The register agrees with the store -------------------------- */
    await seqPage.bringToFront();
    await visit(seqPage, MOD.Fleet, `?selected=${made.vehicleId}`);
    await waitForDetail(seqPage);
    await seqPage.waitForTimeout(400);
    const stored = (await allOf(seqReader, "vehicles")).find((v) => v.id === made.vehicleId);
    const shown = await factsOf(seqPage, "Vehicle");
    const fact = (label) => shown?.find((f) => f.label === label)?.value ?? "";
    const odometer = await seqReader.evaluate(
      (km) => window.__opsProbe.operations.fleetList.formatOdometer(km),
      stored.data.odometerKm
    );
    check("i. the drawer opens the right vehicle", (await textOf(seqPage, ".ops-detail__id")) === made.vehicleId, await textOf(seqPage, ".ops-detail__id"));
    check("i. headed by its asset code", (await textOf(seqPage, ".ops-detail__title")) === stored.data.assetCode, await textOf(seqPage, ".ops-detail__title"));
    check("i. showing the stored status", (await marksOf(seqPage)).includes(stored.data.status), (await marksOf(seqPage)).join(" "));
    check("i. the stored class", fact("Class") === stored.data.vehicleClass, `${fact("Class")} vs ${stored.data.vehicleClass}`);
    check("i. the stored model", fact("Model") === stored.data.modelLabel, `${fact("Model")} vs ${stored.data.modelLabel}`);
    check("i. and the stored odometer, formatted", fact("Odometer") === odometer, `${fact("Odometer")} vs ${odometer}`);

    /* ---- j. Into the workshop and out again ---------------------------- */
    await seqPage.bringToFront();
    await visit(seqPage, MOD.Maintenance);
    await seqPage.click(".ops-leads__toolbar .ops-button--primary");
    await seqPage.waitForSelector(".ops-form", POLL);
    await seqPage.waitForTimeout(300);
    await choose(seqPage, FORM_SELECT(0), made.vehicleId);
    await seqPage.fill(".ops-form .ops-textarea", `${MARK}: service after the rental`);
    await seqPage.click(".ops-form button[type=submit]");
    await waitForDetail(seqPage);
    await seqPage.waitForTimeout(400);
    const workOrderId = await textOf(seqPage, ".ops-detail__id");
    made.workOrderId = workOrderId;
    const openedWork = await until(
      () => allOf(seqReader, "maintenance"),
      (rows) => rows.some((w) => w.id === workOrderId)
    );
    check("j. the work order was written", openedWork.some((w) => w.id === workOrderId), workOrderId);
    check(
      "j. and takes the vehicle out of service",
      (await until(
        () => allOf(seqReader, "vehicles"),
        (rows) => rows.find((v) => v.id === made.vehicleId)?.data.status === "Maintenance"
      )).find((v) => v.id === made.vehicleId)?.data.status === "Maintenance"
    );

    await seqPage.bringToFront();
    await seqPage.click('.ops-detail__buttons .ops-button:has-text("Start work")');
    await confirmDialog(seqPage);
    const started = await until(
      () => allOf(seqReader, "maintenance"),
      (rows) => rows.find((w) => w.id === workOrderId)?.data.status === "In Progress"
    );
    check("j. starting is stamped", Boolean(started.find((w) => w.id === workOrderId)?.data.startedAt));

    await seqPage.bringToFront();
    await seqPage.click('.ops-detail__buttons .ops-button:has-text("Complete work")');
    await confirmDialog(seqPage);
    const finished = await until(
      () => allOf(seqReader, "maintenance"),
      (rows) => rows.find((w) => w.id === workOrderId)?.data.status === "Completed"
    );
    check("j. completion lands", finished.find((w) => w.id === workOrderId)?.data.status === "Completed", finished.find((w) => w.id === workOrderId)?.data.status ?? "");
    const runsJ = await until(
      () => allOf(seqReader, "automation_runs"),
      (rows) => rows.some((r) => r.data.ruleId === "automation_rule_0005" && !runsBefore.some((p) => p.id === r.id))
    );
    check(
      "j. Rule 05 ran on the completion",
      runsJ.some((r) => r.data.ruleId === "automation_rule_0005" && r.data.status === "Success" && !runsBefore.some((p) => p.id === r.id))
    );
    const notesJ = await until(
      () => allOf(seqReader, "notifications"),
      (rows) => rows.some((n) => n.data.sourceEntityId === workOrderId)
    );
    const raised = notesJ.find((n) => n.data.sourceEntityId === workOrderId);
    check("j. raising a Maintenance notification", raised?.data.category === "Maintenance", raised?.data.category ?? "");
    check("j. for the Fleet Coordinator", raised?.data.actorRole === "Fleet Coordinator", String(raised?.data.actorRole));
    check("j. and the vehicle is free again", (await until(
      () => allOf(seqReader, "vehicles"),
      (rows) => rows.find((v) => v.id === made.vehicleId)?.data.status === "Available"
    )).find((v) => v.id === made.vehicleId)?.data.status === "Available");
    check(
      "j. more notifications exist than before",
      notesJ.length > notesBefore.length,
      `${notesBefore.length} to ${notesJ.length}`
    );

    /* ---- k. The reports have moved ------------------------------------- */
    await seqPage.bringToFront();
    await visit(seqPage, MOD.Reports);
    await seqPage.waitForTimeout(400);
    const contractNote = await panelNote(seqPage, "Contract status and value");
    const paymentNote = await panelNote(seqPage, "Payment status");
    /* The canonical figures are 14 contracts and 26 payments. One rental ran
       and one payment was taken, so both have to have moved: a reports screen
       that reads a cached count would still be printing the seed. */
    check("k. Reports counts 15 contracts", contractNote === "15 contracts in the period", String(contractNote));
    check("k. and 27 payments", paymentNote === "27 payments in the period", String(paymentNote));
    check("k. the fleet snapshot still counts 24", (await panelNote(seqPage, "Fleet utilisation")) === "24 vehicles", String(await panelNote(seqPage, "Fleet utilisation")));

    /* ---- l. The rules have a history ----------------------------------- */
    await visit(seqPage, MOD.Automations);
    await seqPage.waitForTimeout(400);
    const shownRuns = await seqPage.$$eval(".ops-runs__item .ops-runs__rule", (n) =>
      n.map((e) => e.textContent.trim())
    );
    for (const name of [
      "New website lead assignment",
      "Qualified lead follow-up",
      "Reservation confirmation message",
      "Overdue payment alert",
      "Maintenance completion notice",
    ]) {
      check(`l. the feed shows ${name}`.slice(0, 58), shownRuns.includes(name), shownRuns.slice(0, 3).join(" | "));
    }
    const tally = await seqReader.evaluate(async () => {
      const runs = await window.__qaRuntime.repository.all("automation_runs");
      const t = { Success: 0, Skipped: 0, Failed: 0 };
      for (const r of runs) t[r.data.status] += 1;
      return t;
    });
    const runsNote = await panelNote(seqPage, "Recent runs");
    check(
      "l. and the tally agrees with the store",
      (runsNote ?? "").startsWith(`${tally.Success} succeeded, ${tally.Skipped} skipped, ${tally.Failed} failed`),
      `${runsNote} vs ${JSON.stringify(tally)}`
    );

    check("the whole sequence consoled cleanly", seqProblems.length === 0, seqProblems.join(" | ").slice(0, 140));
  }
}

/* =====================================================================
   3. ALL FIVE RULES ARE PROVEN BY THAT SEQUENCE

   Not one of these runs came from a direct `processEvents` call, and not one
   came from a service invoked by this harness. Rules 01, 02, 03 and 05 fired
   because a form was submitted or a lifecycle button was pressed, and Rule 04
   fired because a visitor opened the Payments module, which is the only place
   in the product that raises `payment.overdue`. That is the whole claim: the
   automation layer is wired to the screens, not to the test.
   ===================================================================== */

section("FIVE RULES - EVERY ONE FIRED FROM A CLICK");
{
  if (!seqReader) {
    console.log("  SKIP  probe route absent (the sequence did not run)");
  } else {
    const runs = await allOf(seqReader, "automation_runs");
    /* The seed stops at automation_run_0018, so anything past it is this
       session's own work. */
    const number = (id) => Number(id.slice(id.lastIndexOf("_") + 1));
    const produced = runs.filter((r) => number(r.id) > 18);
    check("the sequence produced runs of its own", produced.length >= 7, `${produced.length} new runs`);

    for (const [rule, why] of [
      ["automation_rule_0001", "a website lead was created"],
      ["automation_rule_0002", "a lead was qualified"],
      ["automation_rule_0003", "a reservation was confirmed"],
      ["automation_rule_0004", "the Payments module was opened"],
      ["automation_rule_0005", "a work order was completed"],
    ]) {
      const hits = produced.filter((r) => r.data.ruleId === rule);
      check(`${rule} ran because ${why}`.slice(0, 58), hits.length >= 1, `${hits.length} runs`);
      check(
        `and every ${rule} run succeeded`.slice(0, 58),
        hits.length > 0 && hits.every((r) => r.data.status === "Success"),
        hits.map((r) => r.data.status).join(",")
      );
    }

    check(
      "no run names a rule that does not exist",
      produced.every((r) => /^automation_rule_000[1-5]$/.test(r.data.ruleId)),
      produced.map((r) => r.data.ruleId).join(",")
    );
    check(
      "every run carries the event that woke it",
      produced.every((r) => typeof r.data.sourceEventId === "string" && r.data.sourceEventId.length > 0)
    );
  }
}

/* =====================================================================
   4. WORLD INVARIANTS

   The whole store, after everything the sequence did to it. Every rule stated
   here is one the domain claims about itself, checked over every record rather
   than over the handful the sequence touched: the value of this section is the
   vehicle nobody thought to look at and the contract nobody opened.
   ===================================================================== */

section("WORLD INVARIANTS - THE ENTIRE STORE, AFTER THE RUN");
{
  if (!seqReader) {
    console.log("  SKIP  probe route absent (the sequence did not run)");
  } else {
    const report = await seqReader.evaluate(async (collectionFor) => {
      const rt = window.__qaRuntime;
      const ops = window.__opsProbe.operations;
      const names = [
        "leads", "customers", "vehicles", "reservations", "contracts", "payments",
        "maintenance", "conversations", "messages", "automation_rules",
        "automation_runs", "notifications",
      ];
      const store = {};
      for (const n of names) store[n] = await rt.repository.all(n);
      const now = rt.now();

      const vehicles = [];
      for (const v of store.vehicles) {
        const world = {
          vehicleId: v.id,
          contracts: store.contracts,
          reservations: store.reservations,
          workOrders: store.maintenance,
        };
        const status = ops.derive.deriveVehicleStatus(world);
        const links = ops.derive.deriveVehicleLinks(world);
        const same =
          v.data.status === status &&
          (v.data.currentContractId ?? null) === (links.currentContractId ?? null) &&
          (v.data.currentReservationId ?? null) === (links.currentReservationId ?? null) &&
          (v.data.activeMaintenanceId ?? null) === (links.activeMaintenanceId ?? null);
        if (!same) {
          vehicles.push(
            `${v.id} stored[${v.data.status},c=${v.data.currentContractId ?? "-"},r=${
              v.data.currentReservationId ?? "-"
            },m=${v.data.activeMaintenanceId ?? "-"}] derived[${status},c=${
              links.currentContractId ?? "-"
            },r=${links.currentReservationId ?? "-"},m=${links.activeMaintenanceId ?? "-"}]`
          );
        }
      }

      const totals = [];
      const paid = [];
      const overpaid = [];
      for (const c of store.contracts) {
        const expected = ops.derive.contractTotalCents(
          c.data.dailyRate,
          c.data.startAt,
          c.data.endAt
        );
        if (c.data.totalAmount !== expected) {
          totals.push(`${c.id} stored ${c.data.totalAmount} vs computed ${expected}`);
        }
        const settled = store.payments
          .filter((p) => p.data.contractId === c.id && p.data.status === "Paid")
          .reduce((sum, p) => sum + p.data.amount, 0);
        if (c.data.paidAmount !== settled) {
          paid.push(`${c.id} paidAmount ${c.data.paidAmount} vs payments ${settled}`);
        }
        if (c.data.paidAmount > c.data.totalAmount) {
          overpaid.push(`${c.id} paid ${c.data.paidAmount} of ${c.data.totalAmount}`);
        }
      }

      const storedOverdue = store.payments
        .filter((p) => p.data.status === "Overdue")
        .map((p) => p.id);
      const effective = { Paid: 0, Pending: 0, Overdue: 0 };
      for (const p of store.payments) {
        effective[ops.derive.derivePaymentStatus(p.data, now)] += 1;
      }

      const links = [];
      for (const r of store.reservations) {
        if (!r.data.convertedContractId) continue;
        const c = store.contracts.find((row) => row.id === r.data.convertedContractId);
        if (!c) links.push(`${r.id} names a contract that does not exist`);
        else if (c.data.reservationId !== r.id) {
          links.push(`${r.id} to ${c.id}, which names ${c.data.reservationId ?? "nothing"}`);
        }
      }
      for (const c of store.contracts) {
        if (!c.data.reservationId) continue;
        const r = store.reservations.find((row) => row.id === c.data.reservationId);
        if (!r) links.push(`${c.id} names a reservation that does not exist`);
        else if (r.data.convertedContractId !== c.id) {
          links.push(`${c.id} from ${r.id}, which names ${r.data.convertedContractId ?? "nothing"}`);
        }
      }

      /* Message ids are allocated in commit order, so id order is the order
         the world made them. A timeline whose sent times disagree with that is
         a thread that would render out of sequence. */
      const timeline = [];
      const byConversation = new Map();
      for (const m of store.messages) {
        const list = byConversation.get(m.data.conversationId) ?? [];
        list.push(m);
        byConversation.set(m.data.conversationId, list);
      }
      for (const [conversationId, list] of byConversation) {
        const ordered = [...list].sort((a, b) => a.id.localeCompare(b.id));
        for (let i = 1; i < ordered.length; i++) {
          if (Date.parse(ordered[i].data.sentAt) < Date.parse(ordered[i - 1].data.sentAt)) {
            timeline.push(`${conversationId}: ${ordered[i].id} predates ${ordered[i - 1].id}`);
          }
        }
        if (!store.conversations.some((c) => c.id === conversationId)) {
          timeline.push(`${conversationId} has messages but does not exist`);
        }
      }

      const orphanRuns = store.automation_runs
        .filter((r) => !store.automation_rules.some((rule) => rule.id === r.data.ruleId))
        .map((r) => `${r.id} names ${r.data.ruleId}`);

      const orphanNotes = [];
      for (const n of store.notifications) {
        const { sourceEntityType: type, sourceEntityId: id } = n.data;
        if (!id) continue;
        const collection = collectionFor[type];
        if (!collection) {
          orphanNotes.push(`${n.id} has an unknown source type ${type}`);
          continue;
        }
        if (!store[collection].some((row) => row.id === id)) {
          orphanNotes.push(`${n.id} names ${id}, absent from ${collection}`);
        }
      }

      return {
        vehicles, totals, paid, overpaid, storedOverdue, effective,
        links, timeline, orphanRuns, orphanNotes,
        counts: Object.fromEntries(names.map((n) => [n, store[n].length])),
      };
    }, {
      lead: "leads", customer: "customers", vehicle: "vehicles",
      reservation: "reservations", contract: "contracts", payment: "payments",
      maintenance: "maintenance", conversation: "conversations", message: "messages",
      automation_rule: "automation_rules", automation_run: "automation_runs",
    });

    check("every vehicle equals its own derivation", report.vehicles.length === 0, report.vehicles[0] ?? "");
    check("every contract total is rate times days", report.totals.length === 0, report.totals[0] ?? "");
    check("every paid amount is the sum of its payments", report.paid.length === 0, report.paid[0] ?? "");
    check("no contract is overpaid", report.overpaid.length === 0, report.overpaid[0] ?? "");
    /* Overdue is derived on every read and never written, which is what keeps
       a payment from disagreeing with the demo's own clock. */
    check("no payment stores Overdue", report.storedOverdue.length === 0, report.storedOverdue.join(","));
    check(
      "every payment resolves to one of the three states",
      report.effective.Paid + report.effective.Pending + report.effective.Overdue === report.counts.payments,
      JSON.stringify(report.effective)
    );
    check("every conversion points both ways", report.links.length === 0, report.links[0] ?? "");
    check("every thread is a coherent timeline", report.timeline.length === 0, report.timeline[0] ?? "");
    check("every run names a rule that exists", report.orphanRuns.length === 0, report.orphanRuns[0] ?? "");
    check("every notification names a record that exists", report.orphanNotes.length === 0, report.orphanNotes[0] ?? "");

    /* The screen has to agree with the derivation, not merely be consistent
       with itself. The pills are scoped to the table because the mobile card
       list stays in the DOM at desktop width and would double every count. */
    await seqPage.bringToFront();
    await visit(seqPage, MOD.Payments);
    await choose(seqPage, ".ops-pager__size .demo-select__trigger", "20");
    await seqPage.waitForTimeout(300);
    const pills = [];
    pills.push(
      ...(await seqPage.$$eval(".ops-leads__table .ops-pill", (n) => n.map((e) => e.textContent.trim())))
    );
    await seqPage.click('.ops-pager__step:has-text("Next")');
    await seqPage.waitForTimeout(400);
    pills.push(
      ...(await seqPage.$$eval(".ops-leads__table .ops-pill", (n) => n.map((e) => e.textContent.trim())))
    );
    const shown = { Paid: 0, Pending: 0, Overdue: 0 };
    for (const p of pills) if (p in shown) shown[p] += 1;
    check(
      "the Payments screen shows the derived split",
      JSON.stringify(shown) === JSON.stringify(report.effective),
      `${JSON.stringify(shown)} vs ${JSON.stringify(report.effective)}`
    );
  }
}

/* =====================================================================
   5. THE ROLE WALKTHROUGH

   Four roles, eleven routes, forty-four answers, compared against the matrix
   written out at the top of this file rather than read from the product.

   The second question is the one a per-module suite cannot ask: when a role
   loses a module, the records it was reading must be gone from the document,
   not merely hidden. So every name harvested from a route under one role is
   hunted for in the page source when the next role cannot open it.
   ===================================================================== */

section("ROLES - THE FROZEN MATRIX, AND NO STALE FRAME");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, MOD.Overview);
  /** Record names last seen at each route, so a lost module can be searched. */
  const seenAt = new Map();

  for (const role of ROLES) {
    await closeOverlays(page);
    if (role !== "Admin") {
      await choose(page, ROLE_SELECT, role);
      await page.waitForTimeout(700);
    }

    for (const mod of MODULES) {
      await visit(page, mod);
      const allowed = mayView(role, mod.id);
      const root = await visibleCount(page, mod.root);
      const gate = await visibleCount(page, ".ops-unavailable");

      if (allowed) {
        check(
          `${role} opens ${mod.id}`.slice(0, 58),
          root === 1 && gate === 0 && (await visibleCount(page, mod.ready)) > 0,
          `root ${root}, gate ${gate}`
        );
        const names = await page.$$eval(".ops-leads__name", (n) =>
          n.slice(0, 3).map((e) => e.textContent.trim()).filter((t) => t.length > 3)
        );
        if (names.length > 0) seenAt.set(mod.id, names);
      } else {
        check(`${role} is refused ${mod.id}`.slice(0, 58), gate === 1 && root === 0, `root ${root}, gate ${gate}`);
        const words = await textOf(page, ".ops-unavailable__text", "");
        check(`and told so by name at ${mod.id}`.slice(0, 58), words.includes(role), words.slice(0, 52));
        /* Nothing is called security, because nothing here is authenticated. */
        check(
          `without calling it access control at ${mod.id}`.slice(0, 58),
          !/unauthori[sz]ed|access denied|permission denied|forbidden/i.test(words),
          words.slice(0, 52)
        );
        const stale = seenAt.get(mod.id) ?? [];
        const html = await page.content();
        const leaked = stale.filter((name) => html.includes(name));
        check(
          `no record survives the gate at ${mod.id}`.slice(0, 58),
          leaked.length === 0,
          leaked.join(", ")
        );
      }
    }

    const links = await countOfSel(page, ".ops-sidebar a");
    check(
      `${role} is offered exactly its own modules`.slice(0, 58),
      links === viewableCount(role),
      `${links} links, expected ${viewableCount(role)}`
    );
    const offered = await page.$$eval(".ops-sidebar__label", (n) => n.map((e) => e.textContent.trim()));
    check(
      `${role} is offered nothing it cannot open`.slice(0, 58),
      offered.every((label) => mayView(role, label)),
      offered.join(",")
    );
  }

  /* Back to Admin, so the context ends where it started. */
  await closeOverlays(page);
  await choose(page, ROLE_SELECT, "Admin");
  await page.waitForTimeout(700);
  await visit(page, MOD.Leads);
  check("Admin comes back to the whole product", (await countOfSel(page, ".ops-sidebar a")) === 11, String(await countOfSel(page, ".ops-sidebar a")));
  check("the role walkthrough consoled cleanly", problems.length === 0, problems.join(" | ").slice(0, 140));

  await ctx.close();
}

/* =====================================================================
   6. THE WHOLE PRODUCT AT SEVEN WIDTHS

   Every module in this product grows with its content except one. The Inbox
   owns a fixed-viewport workspace and scrolls inside its own panels, and the
   defect that made it worth measuring was invisible to a viewport screenshot:
   twenty absolutely positioned spans escaped the clipping box and gave the
   document two thousand pixels of overflow with nothing painted in it. So the
   measurement is a full-page capture, and the Inbox gets its own threshold
   rather than being exempted from one.
   ===================================================================== */

section("SHAPE - EIGHT MODULES AT SEVEN WIDTHS");
{
  const { PNG } = await import("pngjs");
  const fs = await import("node:fs");
  const DIR = "qa/shots/stage09final";
  fs.mkdirSync(DIR, { recursive: true });

  /** The portfolio's flat foundation colour, which must not show through. */
  const BACKDROP = [247, 247, 251];
  const isBackdrop = (r, g, b) =>
    Math.abs(r - BACKDROP[0]) <= 2 && Math.abs(g - BACKDROP[1]) <= 2 && Math.abs(b - BACKDROP[2]) <= 2;

  /**
   * A full-page capture, and how much of its bottom is bare backdrop.
   *
   * Sampled down the middle column: the application paints a surface there at
   * every height it occupies, so a run of backdrop pixels means the document
   * extends past the product.
   */
  const capture = async (page, name) => {
    const file = `${DIR}/${name}.png`;
    /* A generous timeout. Eight modules at seven widths is fifty-six full-page
       captures, and on a loaded machine one of them will outlive Playwright's
       default thirty seconds for no reason worth failing a suite over. */
    await page.screenshot({ path: file, fullPage: true, timeout: 120000 });
    const png = PNG.sync.read(fs.readFileSync(file));
    let trailing = 0;
    for (let y = png.height - 1; y >= 0; y--) {
      const i = (png.width * y + (png.width >> 1)) << 2;
      if (!isBackdrop(png.data[i], png.data[i + 1], png.data[i + 2])) break;
      trailing += 1;
    }
    return { width: png.width, height: png.height, trailing };
  };

  const SHAPES = ["Overview", "Leads", "Reservations", "Contracts", "Fleet", "Payments", "Reports", "Inbox"].map(
    (id) => MOD[id]
  );

  for (const [w, h] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [1024, 768],
    [768, 1024],
    [430, 932],
    [390, 844],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();

    for (const mod of SHAPES) {
      await visit(page, mod);
      /* Force a frame before measuring: a context that has not painted reports
         stale rects and unstarted transitions. */
      await page.screenshot({ type: "jpeg", quality: 20, timeout: 120000 });
      const m = await page.evaluate(() => ({
        body: document.body.scrollHeight,
        client: document.documentElement.clientHeight,
        inner: window.innerHeight,
        hOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      const shot = await capture(page, `${mod.id.toLowerCase()}-${w}x${h}`);
      const tag = `${mod.id} ${w}x${h}`;

      check(`${tag}: no horizontal overflow`.slice(0, 58), m.hOver <= 0, String(m.hOver));

      if (mod.id === "Inbox") {
        /* The viewport-locked module: one viewport tall, to the pixel, and a
           full-page capture no taller than the viewport it was taken in. */
        check(
          `${tag}: the document is one viewport tall`.slice(0, 58),
          Math.abs(m.body - m.client) <= 2,
          `body ${m.body} vs client ${m.client}`
        );
        check(
          `${tag}: and the capture is too`.slice(0, 58),
          Math.abs(shot.height - h) <= 2,
          `${shot.width}x${shot.height}`
        );
        check(
          `${tag}: no backdrop below the product`.slice(0, 58),
          shot.trailing <= 2,
          `${shot.trailing}px of backdrop`
        );
      } else {
        check(
          `${tag}: no backdrop below the product`.slice(0, 58),
          shot.trailing <= 24,
          `${shot.trailing}px of backdrop in a ${shot.height}px capture`
        );
      }
    }

    await ctx.close();
  }
}

/* =====================================================================
   7. CONTENT AND SAFETY ACROSS ALL ELEVEN

   The standing rules, read off the rendered page of every module rather than
   the one a given suite happened to own. A rental product is exactly where a
   card number, a driving licence field or a booking CTA would look natural,
   which is why each of them is asserted absent on all eleven screens.
   ===================================================================== */

section("CONTENT AND SAFETY - ALL ELEVEN MODULES");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, MOD.Overview);
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  const EM_DASH = String.fromCharCode(0x2014);

  for (const mod of MODULES) {
    await visit(page, mod);
    const html = await page.content();
    const bad = [];
    if (/mailto:/i.test(html)) bad.push("mailto");
    if (/\btel:\+?\d/i.test(html)) bad.push("tel link");
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html)) bad.push("email address");
    if (/\+\d[\d\s().-]{7,}\d/.test(html)) bad.push("telephone");
    if (/whatsapp|telegram|discord|\bsms\b/i.test(html)) bad.push("messenger");
    if (/book now|contact us|hire me|get in touch|request a quote/i.test(html)) bad.push("contact CTA");
    if (/card number|iban|sort code|bank account|\bcvv\b|licence number|license number|passport/i.test(html)) {
      bad.push("payment or document field");
    }
    if (html.includes(EM_DASH)) bad.push("em dash");
    check(`${mod.id} carries none of the banned content`.slice(0, 58), bad.length === 0, bad.join(", "));
    check(
      `${mod.id} still discloses that the data is synthetic`.slice(0, 58),
      /synthetic/i.test(html),
      ""
    );
  }

  const external = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:"));
  check("no external request across the whole visit", external.length === 0, external[0] ?? "");
  check("and no API call anywhere", requests.filter((u) => u.includes("/api/")).length === 0, requests.find((u) => u.includes("/api/")) ?? "");
  check("the eleven-module visit consoled cleanly", problems.length === 0, problems.join(" | ").slice(0, 140));

  await ctx.close();
}

/* =====================================================================
   8. RESET RESTORES EVERYTHING

   Last, and in the sequence's own context, because that is the only world in
   this file that has anything to restore: every other section closed a context
   and with it the IndexedDB it seeded. What is being reset here is a rental
   that ran, a customer that was converted, a payment that was taken and a work
   order that was closed, all of them written by the product.
   ===================================================================== */

section("RESET - THE CANONICAL WORLD RETURNS");
{
  if (!seqCtx) {
    console.log("  SKIP  no context survived the sequence");
  } else if (!seqReader) {
    /* Without the probe the store cannot be read, but the control itself can
       still be exercised and the lists still count what came back. */
    await seqPage.bringToFront();
    await closeOverlays(seqPage);
    await seqPage.click('.demo-chrome button:has-text("Reset")');
    await seqPage.waitForSelector("dialog[open]", POLL);
    await seqPage.click('dialog[open] button:has-text("Reset demo")');
    await seqPage.waitForTimeout(3000);
    await visit(seqPage, MOD.Contracts);
    check("14 contracts return", (await countOf(seqPage)) === "14 contracts", await countOf(seqPage));
    await visit(seqPage, MOD.Leads);
    check("48 leads return", (await countOf(seqPage)) === "48 leads", await countOf(seqPage));
    console.log("  SKIP  the store checks need the probe route");
    await seqCtx.close();
  } else {
    const dirty = await countsOf(seqReader);
    check(
      "the world is out of its canonical shape",
      dirty.contracts === 15 && dirty.payments === 27 && dirty.leads === 49,
      JSON.stringify({ c: dirty.contracts, p: dirty.payments, l: dirty.leads })
    );

    await seqPage.bringToFront();
    await closeOverlays(seqPage);
    await seqPage.click('.demo-chrome button:has-text("Reset")');
    await seqPage.waitForSelector("dialog[open]", POLL);
    await seqPage.click('dialog[open] button:has-text("Reset demo")');
    const after = await until(
      () => countsOf(seqReader),
      (c) => c.contracts === CANONICAL.contracts && c.leads === CANONICAL.leads,
      25000
    );

    for (const [name, expected] of Object.entries(CANONICAL)) {
      check(`${expected} ${name.replace("_", " ")} return`.slice(0, 58), after[name] === expected, String(after[name]));
    }

    const drift = await fleetDrift(seqReader);
    check("the restored fleet matches its derivation", drift.length === 0, drift[0] ?? "");
    const fleet = await allOf(seqReader, "vehicles");
    const tally = fleet.reduce((acc, v) => {
      acc[v.data.status] = (acc[v.data.status] ?? 0) + 1;
      return acc;
    }, {});
    check(
      "with the canonical fleet distribution",
      JSON.stringify(tally) === JSON.stringify({ Rented: 7, Reserved: 4, Maintenance: 3, Available: 10 }),
      JSON.stringify(tally)
    );

    const rules = await allOf(seqReader, "automation_rules");
    check("all five rules are enabled again", rules.length === 5 && rules.every((r) => r.data.enabled === true), rules.map((r) => `${r.id}:${r.data.enabled}`).join(" "));

    /* Nothing this suite made may outlive the reset. Hunted by the marker
       every created record carries, and by the ids the sequence recorded. */
    const survivors = [];
    for (const collection of ["leads", "customers", "reservations", "contracts", "payments", "maintenance"]) {
      const rows = await allOf(seqReader, collection);
      for (const row of rows) {
        if (JSON.stringify(row.data).includes(MARK)) survivors.push(`${collection}/${row.id}`);
      }
    }
    for (const [collection, id] of [
      ["leads", made.leadId],
      ["customers", made.customerId],
      ["reservations", made.reservationId],
      ["contracts", made.contractId],
      ["payments", made.paymentId],
      ["maintenance", made.workOrderId],
    ]) {
      if (!id) continue;
      const rows = await allOf(seqReader, collection);
      if (rows.some((r) => r.id === id)) survivors.push(`${collection}/${id}`);
    }
    check("no record this suite created survives", survivors.length === 0, survivors.slice(0, 3).join(", "));

    await seqPage.bringToFront();
    await visit(seqPage, MOD.Contracts);
    check("and the screen shows the restored list", (await countOf(seqPage)) === "14 contracts", await countOf(seqPage));

    await seqCtx.close();
  }
}

await browser.close();

console.log(
  `\n=== stage 09 operations final: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
