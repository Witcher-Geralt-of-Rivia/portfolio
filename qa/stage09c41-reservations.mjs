/**
 * Stage 09C4.1 - Operations Reservations QA.
 *
 * Two layers, as every module suite here has. The DOMAIN part measures the
 * seed and sets up the one state the product cannot reach on its own. The UI
 * part drives the screen.
 *
 * The assertion this module exists to make is that **confirming through the
 * product runs Rule 03**. 09C4.0 proved the bare service does not, and proved
 * the workflow does; this proves the screen uses the workflow, by looking at
 * what the confirmation left behind rather than at what it imported.
 *
 * Both parts need a route that only exists during a QA run:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c41-reservations.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host,
 * 3100 is production and 3000 is the documented development preview.
 *
 * Against production the domain sections skip themselves.
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const RES = `${BASE}/demos/operations/reservations`;
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

const browser = await chromium.launch();

/** A page on the Reservations route with the list rendered. */
async function fresh(viewport = { width: 1440, height: 900 }, path = RES) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__count", POLL);
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll(".ops-leads__row").length > 0 ||
        document.querySelectorAll(".ops-leadcard").length > 0 ||
        Boolean(document.querySelector(".ops-unavailable")),
      null,
      POLL
    )
    .catch(() => {});
  return { ctx, page, problems };
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

const FILTER = (n) => `.ops-leads__filters .demo-select__trigger >> nth=${n}`;
const PAGE_SIZE = ".ops-pager__size .demo-select__trigger";
const ROLE_SELECT = ".ops-role__select .demo-select__trigger";

const countOf = (page) => page.$eval(".ops-leads__count", (e) => e.textContent.trim());
const rowsOf = (page) => page.$$eval(".ops-leads__row", (n) => n.length);
const textOf = (page, sel, d = "-") =>
  page.$eval(sel, (e) => e.textContent.trim()).catch(() => d);
const marksOf = (page) =>
  page.$$eval(".ops-detail__marks > *", (n) => n.map((e) => e.textContent.trim()));
const actionsOf = (page) =>
  page.$$eval(".ops-detail__buttons .ops-button", (n) => n.map((e) => e.textContent.trim()));

const waitForDetail = (page) =>
  page.waitForFunction(
    () =>
      Boolean(document.querySelector(".ops-detail__id")) ||
      Boolean(document.querySelector(".ops-detail__missing")),
    null,
    POLL
  );

/* =====================================================================
   1. DOMAIN - the seed, measured
   ===================================================================== */

section("DOMAIN - THE SEEDED RESERVATIONS");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(PROBE, { waitUntil: "networkidle" }).catch(() => null);

  if (!res || res.status() !== 200) {
    console.log("  SKIP  probe route absent (expected against production)");
  } else {
    await page.waitForFunction(() => Boolean(window.__opsProbe), null, POLL);

    const out = await page.evaluate(async () => {
      const P = window.__opsProbe;
      const rt = P.createDemoRuntime({
        seed: P.buildOperationsSeed(),
        latency: "off",
        broadcast: false,
        adapter: P.createMemoryAdapter(),
      });
      await rt.initialize();
      const reservations = await rt.repository.all("reservations");
      const tally = (key, value) => reservations.filter((r) => r.data[key] === value).length;

      const draft = reservations.find((r) => r.data.status === "Draft");
      const confirmed = reservations.find((r) => r.data.status === "Confirmed");
      const converted = reservations.find((r) => r.data.status === "Converted");
      const cancelled = reservations.find((r) => r.data.status === "Cancelled");

      return {
        total: reservations.length,
        status: {
          Draft: tally("status", "Draft"),
          Confirmed: tally("status", "Confirmed"),
          Converted: tally("status", "Converted"),
          Cancelled: tally("status", "Cancelled"),
        },
        klass: {
          Urban: tally("vehicleClass", "Urban"),
          Touring: tally("vehicleClass", "Touring"),
          Utility: tally("vehicleClass", "Utility"),
        },
        withVehicle: reservations.filter((r) => r.data.vehicleId).length,
        withoutVehicle: reservations.filter((r) => !r.data.vehicleId).length,
        draftsHoldNoVehicle: reservations
          .filter((r) => r.data.status === "Draft")
          .every((r) => !r.data.vehicleId),
        ids: {
          draft: draft?.id ?? null,
          confirmed: confirmed?.id ?? null,
          converted: converted?.id ?? null,
          cancelled: cancelled?.id ?? null,
        },
      };
    });

    check("the seed holds 18 reservations", out.total === 18, String(out.total));
    check(
      "status distribution is 4 / 4 / 7 / 3",
      out.status.Draft === 4 &&
        out.status.Confirmed === 4 &&
        out.status.Converted === 7 &&
        out.status.Cancelled === 3,
      JSON.stringify(out.status)
    );
    check(
      "every reservation carries a class",
      out.klass.Urban + out.klass.Touring + out.klass.Utility === 18,
      JSON.stringify(out.klass)
    );
    check(
      "fourteen hold a vehicle and four do not",
      out.withVehicle === 14 && out.withoutVehicle === 4,
      `${out.withVehicle} / ${out.withoutVehicle}`
    );
    /* The seed already models what D-091 decided: a draft holds nothing. */
    check("no draft holds a vehicle", out.draftsHoldNoVehicle);
  }

  await ctx.close();
}

/* =====================================================================
   2. THE LIST
   ===================================================================== */

section("LIST - DESKTOP, ADMIN");
{
  const { ctx, page, problems } = await fresh();

  check("the route renders the module", (await page.$(".ops-reservations")) !== null);
  check("18 reservations are counted", (await countOf(page)) === "18 reservations", await countOf(page));
  check("ten rows on the first page", (await rowsOf(page)) === 10, String(await rowsOf(page)));
  check("the console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));

  const columns = await page.$$eval(".ops-reservations__table thead th", (n) =>
    n.map((e) => e.textContent.replace(/[^A-Za-z ]/g, "").trim())
  );
  check(
    "the columns are the operational six",
    columns.join(",") === "Customer,Rental period,Class,Vehicle,Status,Updated",
    columns.join(",")
  );

  const first = await page.$eval(".ops-leads__row", (e) => ({
    customer: e.querySelector(".ops-leads__name")?.textContent.trim() ?? "",
    period: e.querySelector(".ops-reservations__period")?.textContent.trim() ?? "",
    vehicle: e.querySelector(".ops-reservations__vehicle")?.textContent.trim() ?? "",
  }));
  check("a row names its customer", first.customer.length > 0 && !/customer_/.test(first.customer), first.customer);
  check("and shows explicit dates", /\d{4}-\d{2}-\d{2}/.test(first.period), first.period);
  check("no raw id is displayed in the table", !/reservation_|vehicle_/.test(await page.$eval(".ops-reservations__table", (e) => e.textContent)));

  /* An unassigned draft says so rather than rendering an empty cell. */
  await choose(page, FILTER(0), "Draft");
  await page.waitForTimeout(250);
  check("the status filter runs", (await rowsOf(page)) === 4, String(await rowsOf(page)));
  const unassigned = await page.$$eval(".ops-reservations__vehicle", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("an unassigned draft says so", unassigned.every((v) => v === "Not assigned"), unassigned.join(","));
  await choose(page, FILTER(0), "all");

  await choose(page, FILTER(1), "Urban");
  const urbanClasses = await page.$$eval(".ops-reservations__class", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("the class filter runs", urbanClasses.length > 0 && urbanClasses.every((c) => c === "Urban"), urbanClasses.join(","));
  await choose(page, FILTER(1), "all");
  check("clearing both filters restores 18", (await countOf(page)) === "18 reservations");

  /* Sort: earliest first is the default, and latest reverses it. */
  const firstStart = await page.$eval(".ops-reservations__period time", (e) => e.textContent.trim());
  await choose(page, FILTER(2), "start:desc");
  await page.waitForTimeout(250);
  const lastStart = await page.$eval(".ops-reservations__period time", (e) => e.textContent.trim());
  check("the default is the earliest start", firstStart <= lastStart, `${firstStart} / ${lastStart}`);
  check("and the sort reverses it", firstStart !== lastStart, `${firstStart} / ${lastStart}`);
  await choose(page, FILTER(2), "customer:asc");
  await page.waitForTimeout(250);
  const names = await page.$$eval(".ops-leads__name", (n) => n.map((e) => e.textContent.trim()));
  check(
    "customer A to Z is alphabetical",
    names.join("|") === [...names].sort((a, b) => a.localeCompare(b)).join("|"),
    names.slice(0, 2).join(" / ")
  );
  await choose(page, FILTER(2), "start:asc");

  /* Search covers the customer, the vehicle and the notes. */
  const searchName = names[0];
  await page.fill(".ops-leads__search-input", searchName.slice(0, 7));
  await page.waitForTimeout(250);
  check("search matches a customer name", (await rowsOf(page)) >= 1, await countOf(page));
  await page.fill(".ops-leads__search-input", "MTR-0");
  await page.waitForTimeout(250);
  check("search matches an assigned vehicle", (await rowsOf(page)) >= 1, await countOf(page));
  await page.fill(".ops-leads__search-input", "zzzz-nothing");
  await page.waitForTimeout(250);
  check("an empty result explains itself", (await page.$(".ops-leads__empty")) !== null);
  check(
    "in the module's own words",
    (await textOf(page, ".ops-leads__empty-text")) === "No reservations match these filters.",
    await textOf(page, ".ops-leads__empty-text")
  );
  await page.click(".ops-leads__empty .ops-button");
  await page.waitForTimeout(250);
  check("and clears from there", (await countOf(page)) === "18 reservations");

  /* Pagination is the shared control, not a fork. */
  const range = await textOf(page, ".ops-pager__range");
  check("the pager reads 1 to 10 of 18", /1.{1,3}10 of 18/.test(range), range);
  await page.click('.ops-pager__step:has-text("Next")');
  await page.waitForTimeout(250);
  check("Next moves to page two", (await textOf(page, ".ops-pager__page")) === "Page 2 of 2");
  check("which holds the remaining eight", (await rowsOf(page)) === 8, String(await rowsOf(page)));
  await choose(page, PAGE_SIZE, "20");
  await page.waitForTimeout(250);
  check("20 rows per page shows every reservation", (await rowsOf(page)) === 18, String(await rowsOf(page)));
  await choose(page, PAGE_SIZE, "10");

  check("no native select survives", (await page.$$eval("select", (n) => n.length)) === 0);

  await ctx.close();
}

/* =====================================================================
   3. SELECTION AND THE DRAWER
   ===================================================================== */

section("DETAIL - SELECTION, URL AND CONTENT");
{
  const { ctx, page, problems } = await fresh();

  const name = await page.$eval(".ops-leads__name", (e) => e.textContent.trim());
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(350);
  check("clicking a row opens the drawer", (await page.$(".ops-detail__id")) !== null);
  check("the drawer names the customer", (await textOf(page, ".ops-detail__title")) === name, name);
  check("the URL carries the selection", page.url().includes("selected=reservation_"), page.url().split("?")[1] ?? "");
  check("the drawer is a dialog", (await page.$("dialog[open]")) !== null);

  const sections = await page.$$eval(".ops-detail__section-title", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check(
    "the drawer groups booking, vehicle, notes and activity",
    sections.includes("Booking") &&
      sections.includes("Vehicle") &&
      sections.includes("Notes") &&
      sections.includes("Activity"),
    sections.join(",")
  );

  /* Escape closes and focus returns to the row that opened it. */
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  check("Escape closes the drawer", (await page.$(".ops-detail__id")) === null);
  check("and the URL is clean again", !page.url().includes("selected="), page.url());
  check(
    "focus returns to the row",
    (await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")) === name
  );

  /* Back and Forward. */
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(300);
  const url = page.url();
  await page.goBack();
  await page.waitForTimeout(400);
  check("Back closes the drawer", (await page.$(".ops-detail__id")) === null);
  await page.goForward();
  await waitForDetail(page);
  await page.waitForTimeout(300);
  check("Forward reopens it", (await page.$(".ops-detail__id")) !== null);

  /* A deep link, and an id that does not exist. */
  await page.goto(url, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(300);
  check("a shared link opens the same reservation", (await textOf(page, ".ops-detail__title")) === name);

  await page.goto(`${RES}?selected=reservation_9999`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check("an unknown id is explained", (await page.$(".ops-detail__missing")) !== null);
  check(
    "and the id is quoted back",
    (await textOf(page, ".ops-detail__missing")).includes("reservation_9999")
  );

  check("the drawer console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   4. THE LIFECYCLE, THROUGH THE PRODUCT
   ===================================================================== */

section("LIFECYCLE - CREATE, EDIT, CONFIRM, CONVERT");
{
  const { ctx, page, problems } = await fresh();

  /* --- create ------------------------------------------------------- */
  await page.click('.ops-button--primary:has-text("New reservation")');
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(300);
  const fields = await page.$$eval(".ops-form .ops-field__label", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check(
    "the form asks for exactly the five approved fields",
    fields.join(",") === "Customer,Vehicle class,Start,End,Notes",
    fields.join(",")
  );
  /* D-091: no vehicle at draft time, and the form says why. */
  check(
    "there is no vehicle selector on it",
    !fields.some((f) => /^Vehicle$/.test(f)) && (await page.$$eval(".ops-form .ops-vehicle-option", (n) => n.length)) === 0
  );
  check(
    "and it says where the vehicle is chosen",
    (await page.$$eval(".ops-form .ops-field__hint", (n) => n.map((e) => e.textContent).join(" "))).includes(
      "chosen when the reservation is confirmed"
    )
  );

  await choose(page, ".ops-form .demo-select__trigger >> nth=1", "Touring");
  await page.fill('.ops-form input[type="datetime-local"] >> nth=0', "2026-10-01T09:00");
  await page.fill('.ops-form input[type="datetime-local"] >> nth=1', "2026-09-30T09:00");
  await page.waitForTimeout(250);
  check(
    "an end before the start is refused before submitting",
    (await page.$eval('.ops-form button[type="submit"]', (e) => e.disabled)) === true
  );
  check("and the field says why", (await page.$(".ops-field__error")) !== null);

  await page.fill('.ops-form input[type="datetime-local"] >> nth=1', "2026-10-05T09:00");
  await page.fill(".ops-textarea", "QA readiness booking");
  await page.waitForTimeout(200);
  await page.click('.ops-form button[type="submit"]');
  await waitForDetail(page);
  await page.waitForTimeout(600);
  check("creating opens the new record", (await page.$(".ops-detail__id")) !== null);
  const createdId = await textOf(page, ".ops-detail__id");
  check("as a Draft", (await marksOf(page)).includes("Draft"), (await marksOf(page)).join(" "));
  check("with the chosen class", (await marksOf(page)).includes("Touring"));
  check("and no vehicle", (await marksOf(page)).includes("No vehicle yet"));
  check("the notes are kept", (await textOf(page, ".ops-customers__notes")) === "QA readiness booking");

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  check("the list grows to 19", (await countOf(page)) === "19 reservations", await countOf(page));

  /* --- edit --------------------------------------------------------- */
  await page.goto(`${RES}?selected=${createdId}`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(400);
  await page.click('.ops-detail__buttons .ops-button:has-text("Edit")');
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(300);
  check(
    "editing shows the customer as a fact, not a control",
    (await page.$(".ops-field__static")) !== null
  );
  await page.fill(".ops-textarea", "QA readiness booking, amended");
  await page.click('.ops-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
  await page.waitForTimeout(500);
  check(
    "the edit lands in the open drawer",
    (await textOf(page, ".ops-customers__notes")) === "QA readiness booking, amended"
  );

  /* --- confirm ------------------------------------------------------ */
  await page.click('.ops-detail__buttons .ops-button:has-text("Confirm reservation")');
  await page.waitForSelector(".ops-vehicle-choice, .ops-confirm-res__none", POLL);
  await page.waitForTimeout(500);
  const facts = await page.$$eval(".ops-confirm-res__facts .ops-facts__value", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("the confirmation states customer, period and class", facts.length === 3, facts.join(" | "));
  check("it offers eligible vehicles", (await page.$$eval(".ops-vehicle-option", (n) => n.length)) > 0);
  check(
    "each option carries its operational identity",
    /MTR-\d{3} /.test(await textOf(page, ".ops-vehicle-option__name")),
    await textOf(page, ".ops-vehicle-option__name")
  );
  check(
    "confirming waits for a choice",
    (await page.$eval(".ops-sheet__foot .ops-button--primary", (e) => e.disabled)) === true
  );

  const chosenLabel = await textOf(page, ".ops-vehicle-option__name");
  await page.click(".ops-vehicle-option__input");
  await page.waitForTimeout(200);
  await page.click(".ops-sheet__foot .ops-button--primary");
  await page.waitForFunction(() => !document.querySelector(".ops-vehicle-choice"), null, POLL);
  await page.waitForTimeout(900);

  check("the reservation becomes Confirmed", (await marksOf(page)).includes("Confirmed"), (await marksOf(page)).join(" "));
  check("and holds a vehicle", (await marksOf(page)).includes("Vehicle assigned"));
  const vehicleFacts = await page.$$eval(".ops-detail__section:nth-of-type(2) .ops-facts__value", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("the drawer names it", vehicleFacts[0] === chosenLabel, `${vehicleFacts[0]} vs ${chosenLabel}`);
  check(
    "the announcement names it too",
    (await textOf(page, '[role="status"]')).includes(chosenLabel.split(" ")[0]),
    await textOf(page, '[role="status"]')
  );
  check("Edit is withdrawn once confirmed", !(await actionsOf(page)).includes("Edit"), (await actionsOf(page)).join(" | "));
  check("and Convert is offered", (await actionsOf(page)).includes("Convert to contract"));

  /* --- convert ------------------------------------------------------ */
  await page.click('.ops-detail__buttons .ops-button:has-text("Convert to contract")');
  await page.waitForSelector(".ops-confirm", POLL);
  const body = await textOf(page, ".ops-confirm__body");
  check("conversion asks first", (await page.$(".ops-confirm__title")) !== null);
  check("and says the contract starts Pending", /Pending/.test(body), body.slice(0, 70));
  check("without implying the rental has started", /does not start yet/.test(body));
  await page.click(".ops-confirm .ops-button--primary");
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(900);

  check("the reservation becomes Converted", (await marksOf(page)).includes("Converted"), (await marksOf(page)).join(" "));
  check("the contract is referenced", /contract_\d{4}/.test(await textOf(page, ".ops-detail__ref", "")), await textOf(page, ".ops-detail__ref", ""));
  check(
    "and it is not a link, because Contracts is not built",
    (await page.$$eval(".ops-detail__ref", (n) => n.map((e) => e.tagName))).every((t) => t !== "A")
  );
  check("no lifecycle action remains", (await page.$(".ops-detail__buttons")) === null);

  check("the lifecycle console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
  await ctx.close();
}

/**
 * A reader onto the same store the screen is using.
 *
 * The probe route builds a runtime on the default adapter, which is the same
 * IndexedDB the Reservations screen persists to, in the same browser context
 * and therefore the same origin. An existing database with a matching seed
 * version is loaded rather than reseeded, so this observes exactly what the
 * product wrote: no hand-written events, no second source of data.
 */
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

/** Re-read after the screen has written, since the runtime caches nothing. */
const readWorld = (reader) =>
  reader.evaluate(async () => {
    const rt = window.__qaRuntime;
    const [runs, messages, conversations, reservations, contracts, vehicles] = await Promise.all([
      rt.repository.all("automation_runs"),
      rt.repository.all("messages"),
      rt.repository.all("conversations"),
      rt.repository.all("reservations"),
      rt.repository.all("contracts"),
      rt.repository.all("vehicles"),
    ]);
    return {
      runs: runs.length,
      rule03: runs.filter((r) => r.data.ruleId === "automation_rule_0003").length,
      lastRunStatus: runs.length ? runs[runs.length - 1].data.status : "none",
      messages: messages.length,
      systemMessages: messages.filter((m) => m.data.authorType === "System").length,
      lastSystemBody:
        messages.filter((m) => m.data.authorType === "System").slice(-1)[0]?.data.body ?? "",
      conversations: conversations.length,
      unreadConversations: conversations.filter((c) => c.data.unread).length,
      reservations: reservations.length,
      contracts: contracts.length,
      vehicles: vehicles.length,
    };
  });

/** The fleet invariant, over the store the screen just wrote to. */
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
      if (
        v.data.status !== status ||
        v.data.currentContractId !== links.currentContractId ||
        v.data.currentReservationId !== links.currentReservationId ||
        v.data.activeMaintenanceId !== links.activeMaintenanceId
      ) {
        drift.push(`${v.id} stored ${v.data.status} vs derived ${status}`);
      }
    }
    return drift;
  });

/* =====================================================================
   5. RULE 03 THROUGH THE PRODUCT

   The assertion this module exists to make. 09C4.0 proved the bare service
   wakes nothing and the workflow wakes Rule 03; this proves the screen uses
   the workflow, by looking at what a confirmation left behind rather than at
   what the component imported.
   ===================================================================== */

section("RULE 03 - ONE VISITOR ACTION");
{
  const { ctx, page, problems } = await fresh();
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    const before = await readWorld(reader);

    /* A seeded draft, confirmed entirely through the interface. One click. */
    await page.bringToFront();
    await choose(page, FILTER(0), "Draft");
    await page.waitForTimeout(300);
    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(400);

    await page.click('.ops-detail__buttons .ops-button:has-text("Confirm reservation")');
    await page.waitForSelector(".ops-vehicle-choice", POLL);
    await page.waitForTimeout(400);
    await page.click(".ops-vehicle-option__input");
    await page.click(".ops-sheet__foot .ops-button--primary");
    await page.waitForFunction(() => !document.querySelector(".ops-vehicle-choice"), null, POLL);
    await page.waitForTimeout(1200);

    const after = await readWorld(reader);

    /* Every one of these is a consequence of that single click. */
    check("an AutomationRun is written", after.runs === before.runs + 1, `${before.runs} to ${after.runs}`);
    check("it is Rule 03", after.rule03 === before.rule03 + 1, `${before.rule03} to ${after.rule03}`);
    check("and it succeeded", after.lastRunStatus === "Success", after.lastRunStatus);
    check(
      "a System message is appended",
      after.systemMessages === before.systemMessages + 1,
      `${before.systemMessages} to ${after.systemMessages}`
    );
    check(
      "which says what happened",
      /reservation confirmed/i.test(after.lastSystemBody),
      after.lastSystemBody
    );
    check(
      "a conversation is left unread",
      after.unreadConversations > before.unreadConversations,
      `${before.unreadConversations} to ${after.unreadConversations}`
    );
    check(
      "the message count rose by exactly one",
      after.messages === before.messages + 1,
      `${before.messages} to ${after.messages}`
    );

    /* And the vehicle the screen just assigned agrees with its derivation. */
    const drift = await fleetDrift(reader);
    check("the fleet still matches its derivation", drift.length === 0, drift[0] ?? "");

    /* The screen offers a way to read the message, for a role that can. */
    await page.bringToFront();
    check(
      "the drawer links to the conversation",
      (await page.$('.ops-facts__value a:has-text("Open conversation")')) !== null
    );

    check("the Rule 03 console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
    await ctx.close();
  }
}

/* =====================================================================
   6. CONVERSION, AND THE VEHICLE IT RELEASES
   ===================================================================== */

section("CONVERSION - THE 09C4.0 INVARIANT, SEEN FROM THE SCREEN");
{
  const { ctx, page } = await fresh();
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    await page.bringToFront();
    await choose(page, FILTER(0), "Confirmed");
    await page.waitForTimeout(300);
    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(400);
    const reservationId = await textOf(page, ".ops-detail__id");

    const beforeContracts = (await readWorld(reader)).contracts;

    await page.bringToFront();
    await page.click('.ops-detail__buttons .ops-button:has-text("Convert to contract")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
    await page.waitForTimeout(1000);

    const linked = await reader.evaluate(async (id) => {
      const rt = window.__qaRuntime;
      const reservation = await rt.repository.get("reservations", id);
      const contracts = await rt.repository.all("contracts");
      const contract = contracts.find((c) => c.id === reservation.data.convertedContractId);
      return {
        status: reservation.data.status,
        convertedContractId: reservation.data.convertedContractId ?? null,
        contractExists: Boolean(contract),
        contractStatus: contract?.data.status ?? null,
        contractReservationId: contract?.data.reservationId ?? null,
        contracts: contracts.length,
      };
    }, reservationId);

    check("the reservation is Converted", linked.status === "Converted", linked.status);
    check("it names its contract", linked.convertedContractId !== null, String(linked.convertedContractId));
    check("the contract exists", linked.contractExists);
    check("and starts Pending", linked.contractStatus === "Pending", String(linked.contractStatus));
    check(
      "and points back at the reservation",
      linked.contractReservationId === reservationId,
      `${linked.contractReservationId} vs ${reservationId}`
    );
    check("one contract was created", linked.contracts === beforeContracts + 1, `${beforeContracts} to ${linked.contracts}`);

    /* The regression 09C4.0 fixed, observed from the product this time. */
    const drift = await fleetDrift(reader);
    check("no vehicle is left stale by the conversion", drift.length === 0, drift[0] ?? "");

    await ctx.close();
  }
}

/* =====================================================================
   7. WHEN NOTHING IS FREE
   ===================================================================== */

section("NO ELIGIBLE VEHICLE");
{
  const { ctx, page } = await fresh();
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    /**
     * Make one class genuinely unavailable, deterministically.
     *
     * Every vehicle of the class goes into the workshop through the real
     * service, which is what a fleet with nothing spare actually looks like.
     * The seed is not edited, and the whole store is reset afterwards.
     */
    const setup = await reader.evaluate(async () => {
      const rt = window.__qaRuntime;
      const ops = window.__opsProbe.operations;
      const admin = ops.contextAs(rt, "Admin");
      const vehicles = await rt.repository.all("vehicles");
      const utility = vehicles.filter((v) => v.data.vehicleClass === "Utility");
      for (const v of utility) {
        const workOrders = await rt.repository.all("maintenance");
        const busy = workOrders.some(
          (w) =>
            w.data.vehicleId === v.id &&
            (w.data.status === "Open" || w.data.status === "In Progress")
        );
        if (!busy) {
          await ops.maintenance.createMaintenance(admin, {
            vehicleId: v.id,
            type: "Inspection",
            priority: "Routine",
            summary: "QA: whole class in the workshop",
          });
        }
      }
      const customers = await rt.repository.all("customers");
      const draft = await ops.reservations.createReservation(admin, {
        customerId: customers[0].id,
        vehicleClass: "Utility",
        startAt: rt.now(),
        endAt: new Date(Date.parse(rt.now()) + 3 * 86400000).toISOString(),
        notes: "QA: nothing free",
      });
      return { draftId: draft.id, utility: utility.length };
    });

    check("a whole class was taken out of service", setup.utility > 0, `${setup.utility} utility vehicles`);

    await page.bringToFront();
    await page.goto(`${RES}?selected=${setup.draftId}`, { waitUntil: "networkidle" });
    await waitForDetail(page);
    await page.waitForTimeout(600);
    await page.click('.ops-detail__buttons .ops-button:has-text("Confirm reservation")');
    await page.waitForSelector(".ops-confirm-res__none, .ops-vehicle-choice", POLL);
    await page.waitForTimeout(500);

    check("no vehicle choice is offered", (await page.$(".ops-vehicle-choice")) === null);
    check("the state explains itself", (await page.$(".ops-confirm-res__none")) !== null);
    const title = await textOf(page, ".ops-confirm-res__none-title");
    check("naming the class", /Utility/.test(title), title);
    check(
      "confirming is impossible",
      (await page.$eval(".ops-sheet__foot .ops-button--primary", (e) => e.disabled)) === true
    );
    check("and no override is offered", !/confirm anyway|override/i.test(await page.content()));

    const untouched = await reader.evaluate(async (id) => {
      const r = await window.__qaRuntime.repository.get("reservations", id);
      return { status: r.data.status, vehicle: r.data.vehicleId ?? null };
    }, setup.draftId);
    check(
      "the reservation is left alone",
      untouched.status === "Draft" && untouched.vehicle === null,
      JSON.stringify(untouched)
    );

    await ctx.close();
  }
}

/* =====================================================================
   8. CANCELLING
   ===================================================================== */

section("CANCEL");
{
  const { ctx, page } = await fresh();

  await choose(page, FILTER(0), "Draft");
  await page.waitForTimeout(300);
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(400);

  await page.click('.ops-detail__buttons .ops-button:has-text("Cancel reservation")');
  await page.waitForSelector(".ops-confirm", POLL);
  check("cancelling asks first", (await textOf(page, ".ops-confirm__title")) === "Cancel this reservation?");
  const body = await textOf(page, ".ops-confirm__body");
  check("and says what happens to the vehicle", /back to the fleet/.test(body), body.slice(0, 60));
  check("without alarm language", !/permanent|warning|cannot be undone/i.test(body));

  await page.click('.ops-confirm .ops-button--quiet:has-text("Back")');
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  check("backing out leaves it alone", (await marksOf(page)).includes("Draft"));

  await page.click('.ops-detail__buttons .ops-button:has-text("Cancel reservation")');
  await page.waitForSelector(".ops-confirm", POLL);
  await page.click(".ops-confirm .ops-button--primary");
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(800);
  check("cancelling lands", (await marksOf(page)).includes("Cancelled"), (await marksOf(page)).join(" "));
  check("and withdraws every action", (await page.$(".ops-detail__buttons")) === null);

  /* A converted reservation offers no cancel at all, because the domain
     refuses it: the interface does not render a control the service says no
     to. */
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  await choose(page, FILTER(0), "Converted");
  await page.waitForTimeout(300);
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check("a converted reservation offers no actions", (await page.$(".ops-detail__buttons")) === null);

  await ctx.close();
}

/* =====================================================================
   9. ROLE
   ===================================================================== */

section("ROLE - WHO WORKS RESERVATIONS");
{
  const { ctx, page } = await fresh();

  /* The record every role will be pointed at, and the customer it belongs to.
     Read once with the drawer open, then closed again: the drawer is a modal
     dialog, so the chrome behind it is genuinely inert and a visitor cannot
     reach the role control while it is up. Switching roles through it would
     be testing something no one can do. */
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(400);
  const reservationId = await textOf(page, ".ops-detail__id");
  const customerName = await textOf(page, ".ops-detail__title");
  check(
    "the drawer is modal, so the chrome behind it is inert",
    await page.evaluate(() => {
      const dialog = document.querySelector("dialog[open]");
      const role = document.querySelector(".ops-role__select");
      return Boolean(dialog) && Boolean(role) && !dialog.contains(role);
    })
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);

  check("Admin may create", (await page.$('.ops-button--primary:has-text("New reservation")')) !== null);

  const openAs = async (role) => {
    await choose(page, ROLE_SELECT, role);
    await page.waitForTimeout(700);
    await page.goto(`${RES}?selected=${reservationId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
  };

  /* Admin reaches the customer. */
  await page.goto(`${RES}?selected=${reservationId}`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check(
    "Admin reaches the customer",
    (await page.$('.ops-facts__value a[href*="/customers?selected="]')) !== null
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  /* Sales Agent: the same module and the same customer link. */
  await openAs("Sales Agent");
  check("Sales keeps the module", (await page.$(".ops-reservations")) !== null);
  check("and may create", (await page.$('.ops-button--primary:has-text("New reservation")')) !== null);
  check(
    "and reaches the customer",
    (await page.$('.ops-facts__value a[href*="/customers?selected="]')) !== null
  );

  /* Fleet Coordinator works reservations but cannot open Customers, so the
     name is there and the way through is not (D-092). */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await openAs("Fleet Coordinator");
  check("Fleet keeps the module", (await page.$(".ops-reservations")) !== null);
  check("and may create", (await page.$('.ops-button--primary:has-text("New reservation")')) !== null);
  const fleetFacts = await page.$$eval(".ops-facts__value", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("the customer name is still shown", fleetFacts.includes(customerName), fleetFacts[0] ?? "");
  check(
    "but there is no link into Customers",
    (await page.$$eval('a[href*="/customers"]', (n) => n.length)) === 0
  );
  check(
    "and none into the Inbox",
    (await page.$$eval('a[href*="/inbox"]', (n) => n.length)) === 0
  );

  /* Finance Analyst cannot open the module at all. */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await choose(page, ROLE_SELECT, "Finance Analyst");
  await page.waitForTimeout(800);
  check("Finance is told the module is closed", (await page.$(".ops-unavailable")) !== null);
  check("no reservation row survives", (await page.$(".ops-leads__row, .ops-leadcard")) === null);
  check("no drawer survives", (await page.$(".ops-detail__id")) === null);
  check("and no customer name is left on the page", !(await page.content()).includes(customerName));
  const closed = await textOf(page, ".ops-unavailable__text");
  check("the reason names the role", /Finance Analyst/.test(closed), closed.slice(0, 60));

  /* A direct link under the closed role shows the same contained state. */
  await page.goto(`${RES}?selected=${reservationId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  check("a direct link shows the contained state", (await page.$(".ops-unavailable")) !== null);
  check("with no reservation data at all", (await page.$(".ops-leads__row, .ops-detail__id")) === null);

  /* Coming back restores the module and the URL-selected record. */
  await choose(page, ROLE_SELECT, "Admin");
  await page.waitForTimeout(900);
  check("Admin gets it back", (await page.$(".ops-reservations")) !== null);
  await waitForDetail(page).catch(() => {});
  await page.waitForTimeout(400);
  check("with the selected reservation reopened", (await page.$(".ops-detail__id")) !== null);

  await ctx.close();
}

/* =====================================================================
   10. MOBILE
   ===================================================================== */

section("MOBILE");
for (const [w, h] of [
  [390, 844],
  [360, 800],
]) {
  const { ctx, page, problems } = await fresh({ width: w, height: h });

  const shown = (sel) =>
    page.$eval(sel, (e) => getComputedStyle(e).display !== "none").catch(() => false);

  check(`${w}: the table is put away`, !(await shown(".ops-leads__table-wrap")));
  check(`${w}: cards take over`, (await page.$$eval(".ops-leadcard", (n) => n.length)) === 10);
  check(
    `${w}: nothing overflows sideways`,
    (await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )) <= 0
  );

  const card = await page.$eval(".ops-leadcard", (e) => e.textContent.replace(/\s+/g, " ").trim());
  check(`${w}: a card carries enough to choose by`, /\d{4}-\d{2}-\d{2}/.test(card) && /Urban|Touring|Utility/.test(card), card.slice(0, 60));

  await page.click(".ops-leads__filter-button");
  await page.waitForSelector(".ops-overlay--sheet", POLL);
  check(`${w}: filters open in a sheet`, (await page.$(".ops-sheet__title")) !== null);
  check(
    `${w}: status, class and sort are all there`,
    (await page.$$eval('.ops-overlay--sheet [role="combobox"]', (n) => n.length)) === 3
  );
  await page.click('.ops-sheet__head .ops-button:has-text("Done")');
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL);

  await page.click(".ops-leadcard");
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check(`${w}: a card opens the drawer`, (await page.$(".ops-detail__id")) !== null);
  const width = await page.$eval(".ops-overlay--drawer", (e) => e.getBoundingClientRect().width);
  check(`${w}: the drawer fits`, width <= w, String(Math.round(width)));
  check(
    `${w}: and its content does not overflow`,
    (await page.evaluate(() => {
      const el = document.querySelector(".ops-detail__body");
      return el ? el.scrollWidth - el.clientWidth : 0;
    })) <= 1
  );

  /* Browser Back closes the drawer rather than leaving the demo. */
  await page.goBack();
  await page.waitForTimeout(500);
  check(`${w}: Back returns to the list`, (await page.$(".ops-detail__id")) === null);
  check(`${w}: rather than leaving the module`, page.url().includes("/demos/operations/reservations"));

  /* The confirmation sheet has to fit too. */
  await choose(page, FILTER(0), "Draft").catch(async () => {
    await page.click(".ops-leads__filter-button");
    await page.waitForSelector(".ops-overlay--sheet", POLL);
    await choose(page, '.ops-overlay--sheet .demo-select__trigger >> nth=0', "Draft");
    await page.click('.ops-sheet__head .ops-button:has-text("Done")');
  });
  await page.waitForTimeout(400);
  await page.click(".ops-leadcard");
  await waitForDetail(page);
  await page.waitForTimeout(400);
  await page.click('.ops-detail__buttons .ops-button:has-text("Confirm reservation")');
  await page.waitForSelector(".ops-vehicle-choice, .ops-confirm-res__none", POLL);
  await page.waitForTimeout(400);
  const sheet = await page.$eval(".ops-overlay--sheet", (e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width };
  });
  check(`${w}: the confirmation sheet fits the viewport`, sheet.left >= -1 && sheet.right <= w + 1, `${Math.round(sheet.left)}..${Math.round(sheet.right)}`);
  check(
    `${w}: with the action reachable`,
    (await page.$eval(".ops-sheet__foot .ops-button--primary", (e) => e.getBoundingClientRect().bottom <= window.innerHeight + 1))
  );

  check(`${w}: the mobile console is clean`, problems.length === 0, problems.join(" | ").slice(0, 100));
  await ctx.close();
}

/* =====================================================================
   11. PAGE GROWTH, NOT THE INBOX LOCK

   The Inbox owns the fixed-viewport workspace. Reservations must grow with
   its content like Leads and Customers, and must not have picked up the
   `:has(.ops-inbox)` rules by accident. Measured, and captured full page,
   because the Inbox defect was invisible to a viewport screenshot.
   ===================================================================== */

section("CONTAINMENT - A NORMAL PAGE-GROWTH MODULE");
{
  const { PNG } = await import("pngjs");
  const fs = await import("node:fs");
  const DIR = "qa/shots/stage09c41";
  fs.mkdirSync(DIR, { recursive: true });

  /** The portfolio's flat foundation colour, which must not show through. */
  const BACKDROP = [247, 247, 251];
  const isBackdrop = (r, g, b) =>
    Math.abs(r - BACKDROP[0]) <= 2 && Math.abs(g - BACKDROP[1]) <= 2 && Math.abs(b - BACKDROP[2]) <= 2;

  const capture = async (page, name) => {
    const file = `${DIR}/${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const png = PNG.sync.read(fs.readFileSync(file));
    let trailing = 0;
    for (let y = png.height - 1; y >= 0; y--) {
      const i = (png.width * y + (png.width >> 1)) << 2;
      if (!isBackdrop(png.data[i], png.data[i + 1], png.data[i + 2])) break;
      trailing += 1;
    }
    return { width: png.width, height: png.height, trailing };
  };

  for (const [w, h] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [1024, 768],
    [768, 1024],
    [430, 932],
    [390, 844],
    [360, 800],
  ]) {
    const { ctx, page } = await fresh({ width: w, height: h });
    const m = await page.evaluate(() => {
      const shell = document.querySelector(".demo-shell");
      const content = document.querySelector(".ops-content");
      const last = [...document.querySelectorAll(".ops-reservations *")]
        .map((el) => el.getBoundingClientRect().bottom + window.scrollY)
        .reduce((a, b) => Math.max(a, b), 0);
      return {
        body: document.body.scrollHeight,
        client: document.documentElement.clientHeight,
        hOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        contentOverflowY: getComputedStyle(content).overflowY,
        shellCss: getComputedStyle(shell).height,
        lastContentBottom: Math.round(last),
      };
    });
    const shot = await capture(page, `list-${w}x${h}`);

    check(`${w}x${h}: no horizontal overflow`, m.hOver <= 0, String(m.hOver));
    /* The Inbox pins the shell and clips the content; this module must do
       neither, or it has silently inherited the wrong treatment. */
    check(
      `${w}x${h}: the content scrolls with the page, not inside itself`,
      m.contentOverflowY === "auto",
      m.contentOverflowY
    );
    /* The document ends where the content does, or at the viewport, whichever
       is lower down: the shell keeps `min-height: 100dvh`, so a short list on
       a tall screen legitimately leaves app surface below the last row. What
       must never appear there is portfolio background, which the capture
       check below is what actually proves. */
    const floor = Math.max(m.lastContentBottom, m.client);
    check(
      `${w}x${h}: the document ends where its content does`,
      m.body - floor < 60,
      `body ${m.body}, content ends ${m.lastContentBottom}, viewport ${m.client}`
    );
    check(
      `${w}x${h}: no band of portfolio background below the product`,
      shot.trailing <= 24,
      `${shot.trailing}px of backdrop in a ${shot.height}px capture`
    );

    await ctx.close();
  }

  /* No absolutely positioned descendant may escape the module: this is the
     rule the Inbox defect broke, stated rather than tested by symptom. */
  {
    const { ctx, page } = await fresh({ width: 1440, height: 900 });
    const escaped = await page.evaluate(() => {
      const root = document.querySelector(".ops-reservations");
      let count = 0;
      for (const el of document.querySelectorAll(".ops-reservations *")) {
        if (getComputedStyle(el).position !== "absolute") continue;
        let p = el.parentElement;
        while (p && getComputedStyle(p).position === "static") p = p.parentElement;
        if (p && !root.contains(p)) count += 1;
      }
      return count;
    });
    check("no absolute descendant escapes the module", escaped === 0, `${escaped} escaped`);
    await ctx.close();
  }
}

/* =====================================================================
   12. PRESENTATION AND CONTENT RULES
   ===================================================================== */

section("PRESENTATION - CONTRAST, FOCUS AND CONTENT");
{
  const { ctx, page } = await fresh();
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(400);

  const lum = (c) => {
    const f = c.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const rgb = (s) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);

  const samples = await page.$$eval(
    ".ops-reservations__period, .ops-reservations__class, .ops-reservations__vehicle, .ops-pill, .ops-facts__value, .ops-detail__ref",
    (nodes) =>
      nodes.slice(0, 24).map((el) => {
        const stack = [];
        let node = el;
        while (node) {
          const bg = getComputedStyle(node).backgroundColor;
          stack.push(bg);
          if (/rgba?\([^)]*,\s*1\)/.test(bg) || /^rgb\(/.test(bg)) break;
          node = node.parentElement;
        }
        const cs = getComputedStyle(el);
        return { label: el.className.split(" ")[0], color: cs.color, size: parseFloat(cs.fontSize), stack };
      })
  );
  const composite = (stack) => {
    let out = [255, 255, 255];
    for (const layer of [...stack].reverse()) {
      const parts = (layer.match(/[\d.]+/g) ?? []).map(Number);
      if (parts.length < 3) continue;
      const alpha = parts.length > 3 ? parts[3] : 1;
      out = [0, 1, 2].map((i) => parts[i] * alpha + out[i] * (1 - alpha));
    }
    return out;
  };
  let worst = { r: 99, label: "" };
  const seen = new Set();
  for (const s of samples) {
    const key = `${s.label}|${s.color}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = ratio(rgb(s.color), composite(s.stack));
    if (r < worst.r) worst = { r, label: s.label };
    check(`contrast ${s.label}`.slice(0, 58), r >= 4.5, r.toFixed(2));
  }
  check("the worst contrast still passes", worst.r >= 4.5, `${worst.r.toFixed(2)} ${worst.label}`);

  /* Status never depends on colour alone. */
  const pills = await page.$$eval(".ops-pill", (n) => n.map((e) => e.textContent.trim()));
  check(
    "status pills carry their own words",
    pills.every((p) => /^(Draft|Confirmed|Converted|Cancelled|[A-Za-z ]+)$/.test(p)),
    pills.slice(0, 3).join(",")
  );

  /* The standing content rules, read off the rendered page. */
  const html = await page.content();
  check("no mailto link", !/mailto:/i.test(html));
  check("no tel link", !/\btel:\+?\d/i.test(html));
  check("no email address", !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html));
  check("no telephone number", !/\+\d[\d\s().-]{7,}\d/.test(html));
  check("no messenger channel", !/whatsapp|telegram|discord|\bsms\b/i.test(html));
  check("no payment or document field", !/card number|iban|licence|license number|passport/i.test(html));
  check("no booking or contact CTA", !/book now|contact us|hire me|get in touch/i.test(html));
  check("no em dash on the page", !html.includes(String.fromCharCode(0x2014)));
  check("the page still says the data is synthetic", /synthetic|simulat/i.test(html));

  /* Accessibility essentials. */
  const semantics = await page.evaluate(() => {
    const rows = document.querySelectorAll(".ops-reservations__table tbody tr");
    const headers = document.querySelectorAll('.ops-reservations__table th[scope="row"]');
    const caption = document.querySelector(".ops-reservations__table caption");
    return { rows: rows.length, headers: headers.length, caption: caption?.textContent.trim() ?? "" };
  });
  check("every row has a row header", semantics.headers === semantics.rows, `${semantics.headers}/${semantics.rows}`);
  check("the table is captioned", semantics.caption.length > 0, semantics.caption.slice(0, 50));
  check(
    "changes are announced politely",
    (await page.$$eval('[role="status"][aria-live="polite"]', (n) => n.length)) >= 1
  );

  await page.focus(".ops-leads__name");
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return `${cs.outlineStyle}:${cs.outlineWidth}`;
  });
  check("a row shows focus", !/^none:0px$/.test(ring), ring);

  /* No network beyond the app itself. */
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  check(
    "no external request",
    requests.filter((u) => !u.startsWith(BASE) && !u.startsWith("data:")).length === 0
  );
  check("and no API call", requests.filter((u) => u.includes("/api/")).length === 0);

  await ctx.close();
}

/* =====================================================================
   13. RESET
   ===================================================================== */

section("RESET - THE CANONICAL WORLD RETURNS");
{
  const { ctx, page } = await fresh();
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    /* A realistic sequence, all through the product. */
    await page.bringToFront();
    await page.click('.ops-button--primary:has-text("New reservation")');
    await page.waitForSelector(".ops-form", POLL);
    await page.fill('.ops-form input[type="datetime-local"] >> nth=0', "2026-11-01T09:00");
    await page.fill('.ops-form input[type="datetime-local"] >> nth=1', "2026-11-04T09:00");
    await page.fill(".ops-textarea", "QA reset sequence");
    await page.click('.ops-form button[type="submit"]');
    await waitForDetail(page);
    await page.waitForTimeout(700);
    await page.click('.ops-detail__buttons .ops-button:has-text("Confirm reservation")');
    await page.waitForSelector(".ops-vehicle-choice", POLL);
    await page.waitForTimeout(400);
    await page.click(".ops-vehicle-option__input");
    await page.click(".ops-sheet__foot .ops-button--primary");
    await page.waitForFunction(() => !document.querySelector(".ops-vehicle-choice"), null, POLL);
    await page.waitForTimeout(1000);

    const dirty = await readWorld(reader);
    check("the sequence mutated the world", dirty.reservations === 19, String(dirty.reservations));

    /* Reset through the product's own control. */
    await page.bringToFront();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.click('.demo-chrome button:has-text("Reset")');
    await page.waitForSelector("dialog[open]", POLL);
    await page.click('dialog[open] button:has-text("Reset demo")');
    await page.waitForTimeout(3000);

    const after = await readWorld(reader);
    check("18 reservations return", after.reservations === 18, String(after.reservations));
    check("14 contracts return", after.contracts === 14, String(after.contracts));
    check("24 vehicles return", after.vehicles === 24, String(after.vehicles));
    check("20 conversations return", after.conversations === 20, String(after.conversations));
    check("64 messages return", after.messages === 64, String(after.messages));
    check("18 automation runs return", after.runs === 18, String(after.runs));
    check("6 unread conversations return", after.unreadConversations === 6, String(after.unreadConversations));
    const drift = await fleetDrift(reader);
    check("and the restored fleet matches its derivation", drift.length === 0, drift[0] ?? "");

    await ctx.close();
  }
}

await browser.close();

console.log(
  `\n=== stage 09C4.1 reservations: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
