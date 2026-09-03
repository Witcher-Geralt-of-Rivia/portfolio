/**
 * Stage 09C4.3 - Operations Fleet and Maintenance QA.
 *
 * One suite for two modules, because they are one subject. A vehicle's status
 * is not typed anywhere: it is the cached derivation of what contracts,
 * reservations and work orders say about it, so the only way to prove the
 * Fleet register is honest is to move a work order through Maintenance and
 * watch the register change. Splitting these into two files would have left
 * every interesting assertion on the wrong side of the split.
 *
 * The assertion this batch turns on is that **completing a work order through
 * the product runs Rule 05**. 09C4.A proved the bare service wakes nothing and
 * the workflow wakes the rule; this proves the screen calls the workflow, by
 * reading what the completion left behind rather than what the component
 * imported.
 *
 * The second thing it exists to show is the frozen active-rental tension: a
 * work order may be opened on a vehicle that is out on a rental, the register
 * reads Maintenance from that moment, and the domain still refuses to start
 * the work. That refusal is shown on screen rather than hidden, and this suite
 * asserts the visitor can reach it.
 *
 * Both of those need a route that only exists during a QA run:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c43-fleet-maintenance.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host,
 * 3100 is production and 3000 is the documented development preview.
 *
 * Against production the reader-dependent sections skip themselves and the
 * suite still exits 0.
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const FLEET = `${BASE}/demos/operations/fleet`;
const MNT = `${BASE}/demos/operations/maintenance`;
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

/** A page on one of the two routes with the list rendered. */
async function fresh(viewport = { width: 1440, height: 900 }, path = FLEET) {
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

/**
 * Read what a select is offering, then commit a value to close it again.
 *
 * The status filters carry live counts in their labels, and a count that came
 * from a constant rather than from the rows on screen is exactly the defect
 * worth catching. Committing the value the control already holds leaves the
 * query untouched, so this reads without disturbing anything.
 */
async function optionsOf(page, trigger, commitValue) {
  await page.click(trigger);
  await page.waitForSelector('[role="listbox"]', POLL);
  await page.waitForTimeout(200);
  const labels = await page.$$eval('[role="listbox"] [role="option"]', (n) =>
    n.map((e) => e.textContent.replace(/\s+/g, " ").trim())
  );
  await page.click(`[role="listbox"] [role="option"][data-value="${commitValue}"]`);
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, POLL);
  await page.waitForTimeout(150);
  return labels;
}

/**
 * Choose an option by the words on it rather than by its value.
 *
 * The vehicle select in the work order form is keyed by record id, which is
 * the one thing a visitor never sees. Picking by asset code keeps the test
 * reading the product the way a person does, and hands the labels back so the
 * caller can assert what was on offer.
 */
async function chooseByLabel(page, trigger, startsWith) {
  await page.click(trigger);
  await page.waitForSelector('[role="listbox"]', POLL);
  await page.waitForTimeout(200);
  const labels = await page.$$eval('[role="listbox"] [role="option"]', (n) =>
    n.map((e) => e.textContent.replace(/\s+/g, " ").trim())
  );
  const value = await page.$$eval(
    '[role="listbox"] [role="option"]',
    (nodes, s) =>
      nodes.find((e) => e.textContent.trim().startsWith(s))?.getAttribute("data-value") ?? null,
    startsWith
  );
  if (value === null) await page.click('[role="listbox"] [role="option"]');
  else await page.click(`[role="listbox"] [role="option"][data-value="${value}"]`);
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, POLL);
  await page.waitForTimeout(150);
  return { value, labels };
}

const FILTER = (n) => `.ops-leads__filters .demo-select__trigger >> nth=${n}`;
const FORM_SELECT = (n) => `.ops-form .demo-select__trigger >> nth=${n}`;
const PAGE_SIZE = ".ops-pager__size .demo-select__trigger";
const ROLE_SELECT = ".ops-role__select .demo-select__trigger";

const countOf = (page) => page.$eval(".ops-leads__count", (e) => e.textContent.trim());
const rowsOf = (page) => page.$$eval(".ops-leads__row", (n) => n.length);
const textOf = (page, sel, d = "-") =>
  page.$eval(sel, (e) => e.textContent.trim()).catch(() => d);
const allOf = (page, sel) =>
  page.$$eval(sel, (n) => n.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const marksOf = (page) =>
  page.$$eval(".ops-detail__marks > *", (n) => n.map((e) => e.textContent.trim()));
const actionsOf = (page) =>
  page.$$eval(".ops-detail__buttons .ops-button", (n) => n.map((e) => e.textContent.trim()));

/** The drawer's facts as a label to value map, which is how a person reads it. */
const factsOf = (page) =>
  page.$$eval(".ops-detail__body .ops-facts__row", (rows) => {
    const out = {};
    for (const row of rows) {
      const label = row.querySelector(".ops-facts__label")?.textContent.trim() ?? "";
      const value = row.querySelector(".ops-facts__value")?.textContent.trim() ?? "";
      if (label && !(label in out)) out[label] = value;
    }
    return out;
  });

/** What a form's selects are currently showing, in document order. */
const formValues = (page) => allOf(page, ".ops-form .demo-select__value");

const waitForDetail = (page) =>
  page.waitForFunction(
    () =>
      Boolean(document.querySelector(".ops-detail__id")) ||
      Boolean(document.querySelector(".ops-detail__missing")),
    null,
    POLL
  );

/**
 * Close whatever modal is up, and wait for it to be gone.
 *
 * The overlays are native `<dialog>` elements opened with `showModal()`, so
 * the chrome behind them is genuinely inert: clicking the role control or the
 * reset button while one is open does not time out because the element is
 * missing, it times out because the browser refuses the click. Every role
 * switch and every reset in this suite goes through here first.
 */
async function closeOverlay(page) {
  if (!(await page.$("dialog[open]"))) return;
  await page.keyboard.press("Escape");
  await page
    .waitForFunction(() => !document.querySelector("dialog[open]"), null, POLL)
    .catch(() => {});
  await page.waitForTimeout(250);
}

/** A frame, forced. Headless contexts starve until something asks to paint. */
const settle = async (page) => {
  await page.screenshot({ type: "jpeg", quality: 20 });
  await page.waitForTimeout(120);
};

/* =====================================================================
   1. THE FLEET LIST
   ===================================================================== */

section("FLEET - THE REGISTER");
{
  const { ctx, page, problems } = await fresh();

  check("the route renders the module", (await page.$(".ops-vehicles")) !== null);
  /* `.ops-fleet` belongs to the Overview donut. If it turns up here the two
     screens have collided and the register has the legend's layout. */
  check("and not the Overview's fleet donut", (await page.$(".ops-fleet")) === null);
  check("24 vehicles are counted", (await countOf(page)) === "24 vehicles", await countOf(page));
  check("ten rows on the first page", (await rowsOf(page)) === 10, String(await rowsOf(page)));
  check("the console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));

  const columns = await page.$$eval(".ops-vehicles .ops-leads__table thead th", (n) =>
    n.map((e) => e.textContent.replace(/[^A-Za-z ]/g, "").trim())
  );
  check(
    "the columns are the register's six",
    columns.join(",") === "Asset,Model,Class,Status,Odometer,Assignment",
    columns.join(",")
  );

  check(
    "the row header is the asset code",
    /^MTR-\d{3}$/.test(await textOf(page, ".ops-leads__name")),
    await textOf(page, ".ops-leads__name")
  );
  check(
    "the default order starts at MTR-001",
    (await textOf(page, ".ops-leads__name")) === "MTR-001",
    await textOf(page, ".ops-leads__name")
  );
  check(
    "no raw record id reaches the table",
    !/vehicle_|contract_|reservation_|maintenance_/.test(
      await page.$eval(".ops-vehicles .ops-leads__table", (e) => e.textContent)
    )
  );

  /* Every odometer is grouped and suffixed, on every row rather than the one
     the eye happens to land on: a single unformatted reading is the defect. */
  const odos = await allOf(page, ".ops-vehicles__odo");
  check(
    "every odometer reads as grouped kilometres",
    odos.length === 10 && odos.every((o) => /^[\d,]+ km$/.test(o)),
    odos.slice(0, 2).join(" / ")
  );

  /* The counts in the status filter come from the rows, not from a constant. */
  const statusOptions = await optionsOf(page, FILTER(0), "all");
  check(
    "the status filter carries live counts",
    statusOptions.join(",") ===
      "All statuses,Available (10),Reserved (4),Rented (7),Maintenance (3)",
    statusOptions.join(",")
  );

  await choose(page, FILTER(0), "Maintenance");
  await page.waitForTimeout(250);
  check("filtering by status runs", (await rowsOf(page)) === 3, await countOf(page));
  check(
    "and every row agrees with the filter",
    (await allOf(page, ".ops-leads__row .ops-pill")).every((p) => p === "Maintenance")
  );

  /* An occupied machine says who has it; a free one says Free rather than
     leaving a blank cell that reads as missing data. */
  await choose(page, FILTER(0), "Rented");
  await page.waitForTimeout(250);
  const rented = await allOf(page, ".ops-vehicles__assignment");
  check("seven vehicles are out", rented.length === 7, String(rented.length));
  check(
    "a rented vehicle names the person who has it",
    rented.every((a) => /^Out with \S+ \S+/.test(a) && !/Unknown customer|customer_/.test(a)),
    rented[0] ?? ""
  );

  await choose(page, FILTER(0), "Available");
  await page.waitForTimeout(250);
  check("ten vehicles are free", (await rowsOf(page)) === 10, await countOf(page));
  const free = await allOf(page, ".ops-leads__unassigned");
  check("and each of them reads Free", free.length === 10 && free.every((f) => f === "Free"), free[0] ?? "");
  await choose(page, FILTER(0), "all");

  await choose(page, FILTER(1), "Utility");
  await page.waitForTimeout(250);
  const utility = await allOf(page, ".ops-vehicles__model");
  check("filtering by class runs", utility.length === 7, await countOf(page));
  check("and the class is uniform", utility.every((m) => m === "Cargo 150"), utility[0] ?? "");
  await choose(page, FILTER(1), "all");
  check("clearing both filters restores 24", (await countOf(page)) === "24 vehicles");

  /* Search covers the two things written on a machine: its code and its
     model. The record id is deliberately not searchable. */
  await page.fill(".ops-leads__search-input", "MTR-018");
  await page.waitForTimeout(250);
  check("an asset code finds exactly one vehicle", (await rowsOf(page)) === 1, await countOf(page));
  check("and it is the right one", (await textOf(page, ".ops-leads__name")) === "MTR-018");

  await page.fill(".ops-leads__search-input", "Cargo");
  await page.waitForTimeout(250);
  check("a model finds its whole class", (await rowsOf(page)) === 7, await countOf(page));

  await page.fill(".ops-leads__search-input", "zzzz-nothing");
  await page.waitForTimeout(250);
  check("an empty result explains itself", (await page.$(".ops-leads__empty")) !== null);
  check(
    "in the module's own words",
    (await textOf(page, ".ops-leads__empty-text")) === "No vehicles match these filters.",
    await textOf(page, ".ops-leads__empty-text")
  );
  await page.click(".ops-leads__empty .ops-button");
  await page.waitForTimeout(250);
  check("and clears from there", (await countOf(page)) === "24 vehicles");

  /* Pagination is the shared control, not a fork. */
  const range = await textOf(page, ".ops-pager__range");
  check("the pager reads 1 to 10 of 24", /1.{1,3}10 of 24/.test(range), range);
  check("in three pages", (await textOf(page, ".ops-pager__page")) === "Page 1 of 3");
  await page.click('.ops-pager__step:has-text("Next")');
  await page.waitForTimeout(250);
  check("Next moves to page two", (await textOf(page, ".ops-pager__page")) === "Page 2 of 3");
  await choose(page, PAGE_SIZE, "20");
  await page.waitForTimeout(250);
  check("20 rows per page fits the fleet in two", (await rowsOf(page)) === 20, String(await rowsOf(page)));
  check("and says so", (await textOf(page, ".ops-pager__page")) === "Page 1 of 2");
  await choose(page, PAGE_SIZE, "10");

  /* Four sorts, each asked for the one thing it changes: the top row. */
  const firstAsset = () => textOf(page, ".ops-leads__name");
  await choose(page, FILTER(2), "asset:desc");
  await page.waitForTimeout(250);
  check("asset code reversed starts at MTR-024", (await firstAsset()) === "MTR-024", await firstAsset());

  await choose(page, FILTER(2), "odometer:desc");
  await page.waitForTimeout(250);
  check("the highest odometer is on top", (await firstAsset()) === "MTR-024", await firstAsset());
  check(
    "and reads as the highest in the seed",
    (await textOf(page, ".ops-vehicles__odo")) === "11,491 km",
    await textOf(page, ".ops-vehicles__odo")
  );

  await choose(page, FILTER(2), "status:desc");
  await page.waitForTimeout(250);
  check(
    "available first puts a free machine on top",
    (await textOf(page, ".ops-leads__row .ops-pill")) === "Available",
    await textOf(page, ".ops-leads__row .ops-pill")
  );
  check("which is MTR-015", (await firstAsset()) === "MTR-015", await firstAsset());

  await choose(page, FILTER(2), "model:asc");
  await page.waitForTimeout(250);
  check(
    "model A to Z starts at Cargo 150",
    (await textOf(page, ".ops-vehicles__model")) === "Cargo 150",
    await textOf(page, ".ops-vehicles__model")
  );

  await choose(page, FILTER(2), "asset:asc");
  await page.waitForTimeout(250);
  check("and the default comes back", (await firstAsset()) === "MTR-001", await firstAsset());

  check("no native select survives", (await page.$$eval("select", (n) => n.length)) === 0);
  await ctx.close();
}

/* =====================================================================
   2. THE VEHICLE DRAWER, AND WHERE IT LEADS

   The section this module exists for. A vehicle's status is a cache of what
   other records say about it, so the drawer has to show the record that put it
   there rather than restating the status in longer words.
   ===================================================================== */

section("FLEET - DETAIL AND CROSS-LINKS");
{
  const { ctx, page, problems } = await fresh();

  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(350);
  check("clicking a row opens the drawer", (await page.$(".ops-detail__id")) !== null);
  check("the drawer is titled by the asset code", (await textOf(page, ".ops-detail__title")) === "MTR-001");
  check("the URL carries the selection", page.url().includes("selected=vehicle_"), page.url().split("?")[1] ?? "");
  check("the drawer is a dialog", (await page.$("dialog[open]")) !== null);

  const sections = await allOf(page, ".ops-detail__section-title");
  check(
    "it groups the machine, its state and its history",
    sections.join(",") === "Vehicle,Current state,Activity",
    sections.join(",")
  );
  const marks = await marksOf(page);
  check(
    "the marks carry status, model and class",
    marks.length === 3 && marks[0] === "Rented" && marks[2] === "Urban",
    marks.join(" | ")
  );
  const facts = await factsOf(page);
  check("the odometer is stated in the drawer too", /^[\d,]+ km$/.test(facts.Odometer ?? ""), facts.Odometer ?? "");
  check("and the service area", (facts["Service area"] ?? "").length > 0, facts["Service area"] ?? "");
  /* The rule stated on screen, so nobody looks for the control that sets it. */
  check(
    "the drawer says the status is derived",
    /derived from the reservation, contract and work order/.test(
      await page.$eval(".ops-detail__body", (e) => e.textContent)
    )
  );

  /* MTR-001 is Rented, which means an Active contract names it. */
  check(
    "a rented vehicle links to its contract",
    (await page.$('.ops-facts__value a[href*="/contracts?selected="]')) !== null
  );
  check("and offers no other relationship", (await page.$$eval(".ops-facts__value a", (n) => n.length)) === 1);
  check("no lifecycle control is offered here", (await actionsOf(page)).join(",") === "Edit vehicle");

  /* Escape, Back and Forward, and the focus that comes back with them. */
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  check("Escape closes the drawer", (await page.$(".ops-detail__id")) === null);
  check("and the URL is clean again", !page.url().includes("selected="), page.url());
  check(
    "focus returns to the row",
    (await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")) === "MTR-001"
  );

  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(300);
  const deepLink = page.url();
  await page.goBack();
  await page.waitForTimeout(400);
  check("Back closes the drawer", (await page.$(".ops-detail__id")) === null);
  await page.goForward();
  await waitForDetail(page);
  await page.waitForTimeout(300);
  check("Forward reopens it", (await page.$(".ops-detail__id")) !== null);

  await page.goto(deepLink, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(300);
  check("a shared link opens the same vehicle", (await textOf(page, ".ops-detail__title")) === "MTR-001");

  await page.goto(`${FLEET}?selected=vehicle_9999`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check("an unknown id is explained", (await page.$(".ops-detail__missing")) !== null);
  check("and the id is quoted back", (await textOf(page, ".ops-detail__missing")).includes("vehicle_9999"));

  /* The other three states, each reached the way a visitor reaches it. */
  const open = async (assetCode) => {
    await closeOverlay(page);
    await page.fill(".ops-leads__search-input", assetCode);
    await page.waitForTimeout(300);
    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(400);
  };

  await page.goto(FLEET, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__count", POLL);

  await open("MTR-008");
  check("MTR-008 is Reserved", (await marksOf(page))[0] === "Reserved", (await marksOf(page)).join(" "));
  check(
    "and links to the reservation holding it",
    (await page.$('.ops-facts__value a[href*="/reservations?selected="]')) !== null
  );

  await open("MTR-024");
  check("MTR-024 is Available", (await marksOf(page))[0] === "Available", (await marksOf(page)).join(" "));
  check(
    "and says plainly that nothing points at it",
    /Nothing points at it/.test(await page.$eval(".ops-detail__body", (e) => e.textContent))
  );
  check("with no relationship link at all", (await page.$$eval(".ops-facts__value a", (n) => n.length)) === 0);

  await open("MTR-012");
  check("MTR-012 is in the workshop", (await marksOf(page))[0] === "Maintenance", (await marksOf(page)).join(" "));
  const workLink = await page.$('.ops-facts__value a[href*="/maintenance?selected="]');
  check("and links to the work order that put it there", workLink !== null);

  /* Follow it. The register and the queue are two views of one fact, and the
     link is the claim that they agree; clicking it is the only way to check. */
  if (workLink) {
    await workLink.click();
    await page.waitForSelector(".ops-maintenance", POLL);
    await waitForDetail(page);
    await page.waitForTimeout(500);
    check("the link lands in Maintenance", (await page.$(".ops-maintenance")) !== null);
    check(
      "with the work order open",
      (await textOf(page, ".ops-detail__id")) === "maintenance_0001",
      await textOf(page, ".ops-detail__id")
    );
    check(
      "and the drawer names the same machine",
      (await textOf(page, ".ops-detail__title")).startsWith("MTR-012"),
      await textOf(page, ".ops-detail__title")
    );
  }

  check("the cross-link console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
  await ctx.close();
}

/* =====================================================================
   3. ADDING A VEHICLE

   Three fields, because a vehicle has exactly three things a person knows
   about it. The other four stored fields are the cached derivation, and the
   asset code is issued rather than chosen.
   ===================================================================== */

section("FLEET - CREATING A VEHICLE");
{
  const { ctx, page, problems } = await fresh();

  await page.click('.ops-button--primary:has-text("New vehicle")');
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(300);

  const fields = await allOf(page, ".ops-form .ops-field__label");
  check(
    "the form asks for the class, the model and the odometer",
    fields.join(",") === "Vehicle class,Model,Odometer,Asset code",
    fields.join(",")
  );
  check("there is no status control", !fields.includes("Status"), fields.join(","));
  check(
    "and only two selects, so nothing writes a derived field",
    (await page.$$eval(".ops-form .demo-select__trigger", (n) => n.length)) === 2
  );
  /* The asset code is a hint before it exists and a fact afterwards, never an
     input: a code somebody typed would collide with the one the system issues. */
  check(
    "the asset code is not asked for",
    (await page.$$eval(".ops-form input", (n) => n.length)) === 1 &&
      (await page.$(".ops-vehicles__code")) === null
  );
  check(
    "it is explained as issued by the system",
    (await allOf(page, ".ops-form .ops-field__hint")).join(" ").includes("issued by the system")
  );

  /* The class and the model are one decision in two controls. */
  const touring = await optionsOf(page, FORM_SELECT(1), "Metro 125");
  check("Urban offers only its own models", touring.join(",") === "Metro 125,Urban 125,City 160", touring.join(","));

  await choose(page, FORM_SELECT(0), "Touring");
  await page.waitForTimeout(200);
  const touringModels = await optionsOf(page, FORM_SELECT(1), "Trail 200");
  check("Touring re-offers the touring models", touringModels.join(",") === "Tour 250,Trail 200", touringModels.join(","));
  check("and the model moved with the class", (await formValues(page))[1] === "Trail 200", (await formValues(page)).join(" | "));

  await choose(page, FORM_SELECT(0), "Utility");
  await page.waitForTimeout(250);
  check(
    "a class the model does not belong to re-homes it",
    (await formValues(page))[1] === "Cargo 150",
    (await formValues(page)).join(" | ")
  );
  const utilityModels = await optionsOf(page, FORM_SELECT(1), "Cargo 150");
  check("and offers nothing outside the class", utilityModels.join(",") === "Cargo 150", utilityModels.join(","));

  /* The three refusals, said before the round trip rather than after it. */
  await page.fill('.ops-form input[type="number"]', "-5");
  await page.waitForTimeout(250);
  check("a negative odometer is refused", (await page.$(".ops-field__error")) !== null);
  check(
    "and submitting is impossible",
    (await page.$eval('.ops-form button[type="submit"]', (e) => e.disabled)) === true
  );
  await page.fill('.ops-form input[type="number"]', "10.5");
  await page.waitForTimeout(250);
  check("a fractional reading is refused too", (await page.$(".ops-field__error")) !== null);
  check(
    "and still cannot be submitted",
    (await page.$eval('.ops-form button[type="submit"]', (e) => e.disabled)) === true
  );

  await page.fill('.ops-form input[type="number"]', "1200");
  await page.waitForTimeout(250);
  check("a whole number clears the refusal", (await page.$(".ops-field__error")) === null);

  await page.click('.ops-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
  await waitForDetail(page);
  await page.waitForTimeout(600);

  check("creating opens the new record", (await page.$(".ops-detail__id")) !== null);
  check(
    "with the next asset code in the series",
    (await textOf(page, ".ops-detail__title")) === "MTR-025",
    await textOf(page, ".ops-detail__title")
  );
  const created = await marksOf(page);
  check("a new vehicle is Available", created[0] === "Available", created.join(" | "));
  check("and carries the class it was given", created[2] === "Utility", created.join(" | "));
  check(
    "the odometer is what was typed",
    (await factsOf(page)).Odometer === "1,200 km",
    (await factsOf(page)).Odometer ?? ""
  );
  check(
    "the announcement names the issued code",
    (await textOf(page, '.ops-vehicles [role="status"][aria-live="polite"]')).includes("MTR-025"),
    await textOf(page, '.ops-vehicles [role="status"][aria-live="polite"]')
  );

  await closeOverlay(page);
  check("the register grows to 25", (await countOf(page)) === "25 vehicles", await countOf(page));

  /* A second one, because the interesting part of an allocation rule is what
     it does the second time. */
  await page.click('.ops-button--primary:has-text("New vehicle")');
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(300);
  await page.fill('.ops-form input[type="number"]', "0");
  await page.waitForTimeout(200);
  await page.click('.ops-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
  await waitForDetail(page);
  await page.waitForTimeout(600);
  check("the second is MTR-026", (await textOf(page, ".ops-detail__title")) === "MTR-026", await textOf(page, ".ops-detail__title"));
  check("zero kilometres is a legal reading", (await factsOf(page)).Odometer === "0 km", (await factsOf(page)).Odometer ?? "");

  await closeOverlay(page);
  check("and the register reaches 26", (await countOf(page)) === "26 vehicles", await countOf(page));
  check("the create console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));

  await ctx.close();
}

/* =====================================================================
   4. EDITING A VEHICLE
   ===================================================================== */

section("FLEET - EDITING A VEHICLE");
{
  const { ctx, page, problems } = await fresh();

  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check("MTR-001 opens Rented", (await marksOf(page))[0] === "Rented", (await marksOf(page)).join(" "));

  await page.click('.ops-detail__buttons .ops-button:has-text("Edit vehicle")');
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(300);

  /* The code is fixed for the life of the machine, so it is shown as a fact
     rather than offered as a control. A code that moved would make every
     worksheet quoting it wrong. */
  check("the asset code is shown as static text", (await page.$(".ops-field__static")) !== null);
  check("reading the vehicle's own code", (await textOf(page, ".ops-vehicles__code")) === "MTR-001");
  check(
    "and there is still only the odometer input",
    (await page.$$eval(".ops-form input", (n) => n.length)) === 1
  );

  await page.fill('.ops-form input[type="number"]', "48200");
  await page.waitForTimeout(200);
  await page.click('.ops-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
  await page.waitForTimeout(700);

  check(
    "the new reading lands in the open drawer",
    (await factsOf(page)).Odometer === "48,200 km",
    (await factsOf(page)).Odometer ?? ""
  );
  /* The edit touched what the machine is, not what it is doing. */
  check("the vehicle is still Rented", (await marksOf(page))[0] === "Rented", (await marksOf(page)).join(" "));
  check(
    "and still points at its contract",
    (await page.$('.ops-facts__value a[href*="/contracts?selected="]')) !== null
  );
  check(
    "the announcement names the vehicle",
    (await textOf(page, '.ops-vehicles [role="status"][aria-live="polite"]')).includes("MTR-001")
  );

  /* An incoherent pair cannot be submitted because it cannot be held: the
     class change re-homes the model in the same event, so the only pairs the
     form can offer are pairs the service accepts. Checked by looking at what
     the model select contains after each change rather than by trying to
     submit something the control will not let a person assemble. */
  await page.click('.ops-detail__buttons .ops-button:has-text("Edit vehicle")');
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(300);
  check("editing opens on the vehicle's own pair", (await formValues(page)).slice(0, 2).join(" | ") === "Urban | Metro 125", (await formValues(page)).join(" | "));

  await choose(page, FORM_SELECT(0), "Utility");
  await page.waitForTimeout(250);
  const utility = await optionsOf(page, FORM_SELECT(1), "Cargo 150");
  check("switching to Utility leaves only its model", utility.join(",") === "Cargo 150", utility.join(","));
  check("and the form is holding it", (await formValues(page))[1] === "Cargo 150", (await formValues(page)).join(" | "));

  await choose(page, FORM_SELECT(0), "Touring");
  await page.waitForTimeout(250);
  const touring = await optionsOf(page, FORM_SELECT(1), "Tour 250");
  check("switching again re-homes it once more", touring.join(",") === "Tour 250,Trail 200", touring.join(","));
  check(
    "so no pair the service refuses can be assembled",
    touring.includes((await formValues(page))[1]),
    (await formValues(page)).join(" | ")
  );

  await page.click('.ops-form .ops-button--quiet:has-text("Cancel")');
  await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
  await page.waitForTimeout(400);
  check("cancelling leaves the vehicle as it was", (await marksOf(page))[2] === "Urban", (await marksOf(page)).join(" "));

  check("the edit console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
  await ctx.close();
}

/* =====================================================================
   5. THE MAINTENANCE LIST

   Same grammar, different subject. The one thing this list must never do is
   look like an incident board: High means before the others, not emergency.
   ===================================================================== */

section("MAINTENANCE - THE QUEUE");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, MNT);

  check("the route renders the module", (await page.$(".ops-maintenance")) !== null);
  check("10 work orders are counted", (await countOf(page)) === "10 work orders", await countOf(page));
  check("all ten fit one page", (await rowsOf(page)) === 10, String(await rowsOf(page)));
  check("so the pager offers no second page", (await textOf(page, ".ops-pager__page")) === "Page 1 of 1");
  check("the console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));

  const columns = await page.$$eval(".ops-maintenance .ops-leads__table thead th", (n) =>
    n.map((e) => e.textContent.replace(/[^A-Za-z ]/g, "").trim())
  );
  check(
    "the columns are the coordinator's six",
    columns.join(",") === "Vehicle,Type,Priority,Status,Opened,Summary",
    columns.join(",")
  );

  check(
    "a row is headed by the machine, not by an id",
    /^MTR-\d{3} /.test(await textOf(page, ".ops-maintenance__vehicle")),
    await textOf(page, ".ops-maintenance__vehicle")
  );
  check(
    "the newest work order is on top by default",
    (await textOf(page, ".ops-maintenance__vehicle")).startsWith("MTR-013"),
    await textOf(page, ".ops-maintenance__vehicle")
  );

  const statusOptions = await optionsOf(page, FILTER(0), "all");
  check(
    "the status filter carries live counts",
    statusOptions.join(",") === "All statuses,Open (2),In Progress (1),Completed (6),Cancelled (1)",
    statusOptions.join(",")
  );

  await choose(page, FILTER(0), "Open");
  await page.waitForTimeout(250);
  check("filtering by status runs", (await rowsOf(page)) === 2, await countOf(page));
  await choose(page, FILTER(0), "all");

  /* Priority is a word first and a colour second.

     Scoped to the table. The mobile card list renders the same chip and is
     `display: none` at this width but still in the document, so an unscoped
     `.ops-prio` counts every row twice and the number means nothing. */
  const TABLE_PRIO = ".ops-leads__table .ops-prio";
  await choose(page, FILTER(1), "High");
  await page.waitForTimeout(250);
  const high = await allOf(page, TABLE_PRIO);
  check("filtering by priority runs", high.length === 3, `${high.length} rows, ${await countOf(page)}`);
  check("and every chip says High", high.every((p) => p === "High"), high.join(","));
  await choose(page, FILTER(1), "all");

  const priorities = await allOf(page, TABLE_PRIO);
  check(
    "every priority carries its own word",
    priorities.length === 10 && priorities.every((p) => ["Routine", "Soon", "High"].includes(p)),
    `${priorities.length}: ${priorities.slice(0, 3).join(",")}`
  );

  /**
   * Nothing in the module reaches for an alarm colour.
   *
   * Stated as a property of the pixels rather than as a list of hex values,
   * because the point is not which three greys were chosen: it is that none of
   * the three is the saturated red that would turn a routine inspection queue
   * into an incident board.
   */
  const tones = await page.$$eval(".ops-prio", (nodes) =>
    nodes.map((e) => getComputedStyle(e).color)
  );
  const parse = (s) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);
  const alarming = tones.filter((t) => {
    const [r, g, b] = parse(t);
    return r > 180 && g < 80 && b < 80;
  });
  check("no priority chip is a saturated red", alarming.length === 0, alarming[0] ?? "");
  check("and the three steps are three distinct tones", new Set(tones).size === 3, [...new Set(tones)].join(" "));

  const html = await page.content();
  check("no alarm vocabulary on the page", !/urgent|critical|emergency|immediately/i.test(html));

  /* Search covers the machine and the line someone wrote about it. */
  await page.fill(".ops-leads__search-input", "MTR-013");
  await page.waitForTimeout(250);
  check("an asset code finds its work order", (await rowsOf(page)) === 1, await countOf(page));

  await page.fill(".ops-leads__search-input", "Brake");
  await page.waitForTimeout(250);
  check("summary text is searchable", (await rowsOf(page)) === 2, await countOf(page));
  check(
    "and the matches say so",
    (await allOf(page, ".ops-maintenance__summary")).every((s) => /Brake/.test(s))
  );

  await page.fill(".ops-leads__search-input", "zzzz-nothing");
  await page.waitForTimeout(250);
  check(
    "an empty result explains itself",
    (await textOf(page, ".ops-leads__empty-text")) === "No work orders match these filters.",
    await textOf(page, ".ops-leads__empty-text")
  );
  await page.click(".ops-leads__empty .ops-button");
  await page.waitForTimeout(250);
  check("and clears from there", (await countOf(page)) === "10 work orders");

  /* Three sorts, each asked for the top row. */
  await choose(page, FILTER(2), "priority:desc");
  await page.waitForTimeout(250);
  check("High first puts a High chip on top", (await textOf(page, ".ops-prio")) === "High", await textOf(page, ".ops-prio"));

  await choose(page, FILTER(2), "vehicle:asc");
  await page.waitForTimeout(250);
  check(
    "vehicle order starts at the lowest code",
    (await textOf(page, ".ops-maintenance__vehicle")).startsWith("MTR-012"),
    await textOf(page, ".ops-maintenance__vehicle")
  );

  await choose(page, FILTER(2), "opened:asc");
  await page.waitForTimeout(250);
  check(
    "oldest first reverses the default",
    (await textOf(page, ".ops-maintenance__vehicle")).startsWith("MTR-020"),
    await textOf(page, ".ops-maintenance__vehicle")
  );

  await choose(page, FILTER(2), "status:asc");
  await page.waitForTimeout(250);
  check(
    "in progress first surfaces the live job",
    (await textOf(page, ".ops-leads__row .ops-pill")) === "In Progress",
    await textOf(page, ".ops-leads__row .ops-pill")
  );

  /* The drawer, in passing: the queue's own detail geometry. */
  await choose(page, FILTER(2), "opened:desc");
  await page.waitForTimeout(250);
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check("a row opens the work order", (await textOf(page, ".ops-detail__id")) === "maintenance_0002", await textOf(page, ".ops-detail__id"));
  const sections = await allOf(page, ".ops-detail__section-title");
  check("the drawer groups the job, the note and the history", sections.join(",") === "Work order,Summary,Activity", sections.join(","));
  const marks = await marksOf(page);
  check("the marks carry status, priority and type", marks.join(" | ") === "Open | Soon | Preventive", marks.join(" | "));
  check("the summary is shown in full", (await textOf(page, ".ops-maintenance__body")).length > 0);
  check(
    "the vehicle is a link into the register",
    (await page.$('.ops-facts__value a[href*="/fleet?selected="]')) !== null
  );
  check(
    "an open order offers starting and cancelling",
    (await actionsOf(page)).join(",") === "Start work,Cancel work order",
    (await actionsOf(page)).join(",")
  );
  /* MTR-013 is in the workshop, not out on a rental, so there is nothing to
     warn about and the note is correctly absent. */
  check("and no rental note, because there is no rental", (await page.$(".ops-maintenance__note")) === null);

  await page.goto(`${MNT}?selected=maintenance_9999`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check("an unknown id is explained", (await page.$(".ops-detail__missing")) !== null);
  check("and quoted back", (await textOf(page, ".ops-detail__missing")).includes("maintenance_9999"));

  await ctx.close();
}

/* =====================================================================
   6. OPENING A WORK ORDER
   ===================================================================== */

section("MAINTENANCE - CREATING A WORK ORDER");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, MNT);

  await page.click('.ops-button--primary:has-text("New work order")');
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(300);

  const fields = await allOf(page, ".ops-form .ops-field__label");
  check(
    "the form asks for the machine, the job and the line about it",
    fields.join(",") === "Vehicle,Type,Priority,Summary",
    fields.join(",")
  );
  /* A new work order is Open, and the service sets it. A control that appeared
     to choose the status would be describing a decision the caller does not
     get to make. */
  check("there is no status field", !fields.includes("Status"), fields.join(","));
  check(
    "and three selects, one per choice",
    (await page.$$eval(".ops-form .demo-select__trigger", (n) => n.length)) === 3
  );

  check(
    "a blank summary keeps the button disabled",
    (await page.$eval('.ops-form button[type="submit"]', (e) => e.disabled)) === true
  );

  const vehicles = await chooseByLabel(page, FORM_SELECT(0), "MTR-020");
  check("the vehicle select offers the whole fleet", vehicles.labels.length === 24, String(vehicles.labels.length));
  check(
    "each one labelled by asset code and model",
    vehicles.labels.every((l) => /^MTR-\d{3} \S/.test(l)),
    vehicles.labels[0] ?? ""
  );
  check("and it opens on the lowest code", vehicles.labels[0].startsWith("MTR-001"), vehicles.labels[0] ?? "");

  await choose(page, FORM_SELECT(1), "Repair");
  await choose(page, FORM_SELECT(2), "Soon");
  await page.fill(".ops-textarea", "QA: fairing bracket replaced");
  await page.waitForTimeout(250);
  check(
    "a summary enables the button",
    (await page.$eval('.ops-form button[type="submit"]', (e) => e.disabled)) === false
  );

  await page.click('.ops-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
  await waitForDetail(page);
  await page.waitForTimeout(700);

  check("creating opens the new record", (await page.$(".ops-detail__id")) !== null);
  const marks = await marksOf(page);
  check("it opens as Open", marks[0] === "Open", marks.join(" | "));
  check("with the priority and type chosen", marks.slice(1).join(" | ") === "Soon | Repair", marks.join(" | "));
  check(
    "on the vehicle chosen",
    (await textOf(page, ".ops-detail__title")).startsWith("MTR-020"),
    await textOf(page, ".ops-detail__title")
  );
  check("and keeps the summary", (await textOf(page, ".ops-maintenance__body")) === "QA: fairing bracket replaced");
  check(
    "the announcement names the machine",
    (await textOf(page, '.ops-maintenance [role="status"][aria-live="polite"]')).includes("MTR-020"),
    await textOf(page, '.ops-maintenance [role="status"][aria-live="polite"]')
  );

  await closeOverlay(page);
  check("the queue grows to 11", (await countOf(page)) === "11 work orders", await countOf(page));
  check("the create console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));

  await ctx.close();
}

/**
 * A reader onto the same store the screen is using.
 *
 * The probe route builds a runtime on the default adapter, which is the same
 * IndexedDB the two screens persist to, in the same browser context and
 * therefore the same origin. An existing database with a matching seed version
 * is loaded rather than reseeded, so this observes exactly what the product
 * wrote: no hand-written events, no second source of data.
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
    const [runs, notes, workOrders, vehicles, contracts] = await Promise.all([
      rt.repository.all("automation_runs"),
      rt.repository.all("notifications"),
      rt.repository.all("maintenance"),
      rt.repository.all("vehicles"),
      rt.repository.all("contracts"),
    ]);
    const tally = (rows) =>
      rows.reduce((acc, r) => {
        acc[r.data.status] = (acc[r.data.status] ?? 0) + 1;
        return acc;
      }, {});
    const lastRun = runs[runs.length - 1];
    const lastNote = notes[notes.length - 1];
    return {
      runs: runs.length,
      lastRunRule: lastRun?.data.ruleId ?? null,
      lastRunStatus: lastRun?.data.status ?? null,
      notifications: notes.length,
      lastNoteCategory: lastNote?.data.category ?? null,
      lastNoteRole: lastNote?.data.actorRole ?? null,
      lastNoteSource: lastNote?.data.sourceEntityId ?? null,
      lastNoteType: lastNote?.data.sourceEntityType ?? null,
      workOrders: workOrders.length,
      workStatus: tally(workOrders),
      vehicles: vehicles.length,
      vehicleStatus: tally(vehicles),
      contracts: contracts.length,
    };
  });

/** One record, read back from the store the screen just wrote to. */
const recordOf = (reader, collection, id) =>
  reader.evaluate(
    async ([c, i]) => {
      const record = await window.__qaRuntime.repository.get(c, i).catch(() => null);
      return record ? record.data : null;
    },
    [collection, id]
  );

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
   7. RULE 05 THROUGH THE PRODUCT

   The assertion this batch turns on. 09C4.A proved the bare service wakes
   nothing and the workflow wakes Rule 05; this proves the screen uses the
   workflow, by looking at what a completion left behind rather than at what
   the component imported. A screen calling the bare service would close the
   work order, free the vehicle, pass every domain assertion, and leave the
   fleet notification unwritten.
   ===================================================================== */

section("RULE 05 - ONE VISITOR ACTION");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, MNT);
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    const before = await readWorld(reader);
    check("the seed holds 10 work orders", before.workOrders === 10, String(before.workOrders));
    check("18 automation runs", before.runs === 18, String(before.runs));
    check("and 22 notifications", before.notifications === 22, String(before.notifications));

    /* The one In Progress job, found the way a coordinator finds it. */
    await page.bringToFront();
    await choose(page, FILTER(0), "In Progress");
    await page.waitForTimeout(350);
    check("one job is running", (await rowsOf(page)) === 1, await countOf(page));

    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(450);
    const workOrderId = await textOf(page, ".ops-detail__id");
    const vehicleLabel = await textOf(page, ".ops-detail__title");
    check(
      "and it offers completion",
      (await actionsOf(page)).join(",") === "Complete work,Cancel work order",
      (await actionsOf(page)).join(",")
    );

    await page.click('.ops-detail__buttons .ops-button:has-text("Complete work")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.waitForTimeout(300);
    check("completion asks first", (await textOf(page, ".ops-confirm__title")) === "Complete this work order?");
    check(
      "and says the status is recomputed rather than simply freed",
      /recomputed rather than simply freed/.test(await textOf(page, ".ops-confirm__body"))
    );
    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
    await page.waitForTimeout(1200);

    const after = await readWorld(reader);
    const work = await recordOf(reader, "maintenance", workOrderId);

    /* Every one of these is a consequence of that single click. */
    check("an AutomationRun is written", after.runs === before.runs + 1, `${before.runs} to ${after.runs}`);
    check("it is Rule 05", after.lastRunRule === "automation_rule_0005", String(after.lastRunRule));
    check("and it succeeded", after.lastRunStatus === "Success", String(after.lastRunStatus));
    check(
      "one notification is raised",
      after.notifications === before.notifications + 1,
      `${before.notifications} to ${after.notifications}`
    );
    check("in the Maintenance category", after.lastNoteCategory === "Maintenance", String(after.lastNoteCategory));
    check("addressed to the Fleet Coordinator", after.lastNoteRole === "Fleet Coordinator", String(after.lastNoteRole));
    check(
      "and pointing at the work order that raised it",
      after.lastNoteSource === workOrderId,
      `${after.lastNoteSource} vs ${workOrderId}`
    );
    check("the work order is Completed", work?.status === "Completed", String(work?.status));
    check("and stamped with when", Boolean(work?.completedAt));

    const vehicle = await recordOf(reader, "vehicles", work?.vehicleId ?? "");
    check("the vehicle leaves the workshop", vehicle?.status !== "Maintenance", String(vehicle?.status));
    check("and drops its work order pointer", (vehicle?.activeMaintenanceId ?? null) === null, String(vehicle?.activeMaintenanceId));

    const drift = await fleetDrift(reader);
    check("the fleet still matches its derivation", drift.length === 0, drift[0] ?? "");

    /* And the screen the visitor is still looking at agrees. */
    await page.bringToFront();
    await page.waitForTimeout(300);
    check("the drawer shows the closed job", (await marksOf(page))[0] === "Completed", (await marksOf(page)).join(" "));
    check("with no action left to take", (await page.$(".ops-detail__buttons")) === null);
    check(
      "and the machine it named is the one released",
      vehicle !== null && vehicleLabel.startsWith(vehicle.assetCode),
      `${vehicleLabel} vs ${vehicle?.assetCode}`
    );

    check("the Rule 05 console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
    await ctx.close();
  }
}

/* =====================================================================
   8. THE ACTIVE-RENTAL CONFLICT, FROM THE SCREEN

   The frozen tension, driven entirely through the product. A work order may be
   opened on a vehicle somebody is currently driving, the register reads
   Maintenance from that moment, and the domain still refuses to start the
   work. The refusal is shown rather than hidden: hiding the control would
   leave a visitor unable to discover the rule the module exists to
   demonstrate.
   ===================================================================== */

section("MAINTENANCE - WORK ON A RENTED VEHICLE");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, MNT);

  await page.click('.ops-button--primary:has-text("New work order")');
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(300);
  await chooseByLabel(page, FORM_SELECT(0), "MTR-001");
  await page.fill(".ops-textarea", "QA: opened while the vehicle is out");
  await page.waitForTimeout(200);
  await page.click('.ops-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
  await waitForDetail(page);
  await page.waitForTimeout(700);

  const workOrderId = await textOf(page, ".ops-detail__id");
  check("opening the order is allowed", (await marksOf(page))[0] === "Open", (await marksOf(page)).join(" "));
  check(
    "on the rented machine",
    (await textOf(page, ".ops-detail__title")).startsWith("MTR-001"),
    await textOf(page, ".ops-detail__title")
  );

  /* The drawer states the rule before anyone tries it. */
  check("the drawer explains the rental", (await page.$(".ops-maintenance__note")) !== null);
  const note = await textOf(page, ".ops-maintenance__note");
  check("naming the active rental", /out on an active rental/.test(note), note.slice(0, 60));
  check("and saying what the open order already does", /Maintenance in the fleet register/.test(note));

  /* The register, read as a second opinion. One fact, two screens. */
  await closeOverlay(page);
  await page.goto(FLEET, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__count", POLL);
  await page.fill(".ops-leads__search-input", "MTR-001");
  await page.waitForTimeout(350);
  check(
    "the register now shows the vehicle as Maintenance",
    (await textOf(page, ".ops-leads__row .ops-pill")) === "Maintenance",
    await textOf(page, ".ops-leads__row .ops-pill")
  );
  check(
    "and says which job holds it",
    /work order/.test(await textOf(page, ".ops-vehicles__assignment")),
    await textOf(page, ".ops-vehicles__assignment")
  );

  /* Now the refusal, reached on purpose. */
  await page.goto(`${MNT}?selected=${workOrderId}`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(500);
  check("starting is still offered", (await actionsOf(page)).includes("Start work"), (await actionsOf(page)).join(","));

  await page.click('.ops-detail__buttons .ops-button:has-text("Start work")');
  await page.waitForSelector(".ops-confirm", POLL);
  await page.waitForTimeout(300);
  await page.click(".ops-confirm .ops-button--primary");
  await page.waitForSelector(".ops-confirm .ops-alert", POLL);
  await page.waitForTimeout(400);

  check("the dialog stays open", (await page.$(".ops-confirm")) !== null);
  const alert = await textOf(page, ".ops-confirm .ops-alert");
  check("carrying the service's own refusal", alert.includes("MTR-001"), alert.slice(0, 70));
  check("which names the active rental", /active rental/.test(alert), alert.slice(0, 70));
  check("and does not shout about it", !/error|failed|warning/i.test(alert), alert.slice(0, 70));

  await page.click('.ops-confirm .ops-button--quiet:has-text("Back")');
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(500);
  check("the work order is still Open", (await marksOf(page))[0] === "Open", (await marksOf(page)).join(" "));
  check("and still offers to start", (await actionsOf(page)).includes("Start work"));

  check("the conflict console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
  await ctx.close();
}

/* =====================================================================
   9. ROLE

   Two roles keep the vehicles, two do not, and a closed module is contained
   rather than redirected: sending someone elsewhere hides both that the module
   exists and that their role is why it is shut.
   ===================================================================== */

section("ROLE - WHO KEEPS THE VEHICLES");
{
  const { ctx, page } = await fresh();

  const worksFleet = async (role) => {
    check(`${role} may add a vehicle`, (await page.$('.ops-button--primary:has-text("New vehicle")')) !== null);
    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(400);
    check(`${role} may edit one`, (await actionsOf(page)).includes("Edit vehicle"), (await actionsOf(page)).join(","));
    await closeOverlay(page);
  };

  const worksMaintenance = async (role) => {
    await page.goto(MNT, { waitUntil: "networkidle" });
    await page.waitForSelector(".ops-leads__count", POLL);
    await page.waitForTimeout(300);
    check(`${role} may open work`, (await page.$('.ops-button--primary:has-text("New work order")')) !== null);
    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(400);
    check(
      `${role} may move a work order`,
      (await actionsOf(page)).some((a) => /Start work|Complete work/.test(a)),
      (await actionsOf(page)).join(",")
    );
    await closeOverlay(page);
  };

  /* The drawer is a real modal, so the role control behind it cannot be
     reached while one is open. Every switch below closes first. */
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check(
    "the drawer is modal, so the chrome behind it is inert",
    await page.evaluate(() => {
      const dialog = document.querySelector("dialog[open]");
      const role = document.querySelector(".ops-role__select");
      return Boolean(dialog) && Boolean(role) && !dialog.contains(role);
    })
  );
  await closeOverlay(page);

  await worksFleet("Admin");
  await worksMaintenance("Admin");

  await page.goto(FLEET, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__count", POLL);
  await choose(page, ROLE_SELECT, "Fleet Coordinator");
  await page.waitForTimeout(800);
  check("Fleet Coordinator keeps the register", (await page.$(".ops-vehicles")) !== null);
  await worksFleet("Fleet Coordinator");
  await worksMaintenance("Fleet Coordinator");

  /* The two roles that do not, on both routes. */
  for (const role of ["Sales Agent", "Finance Analyst"]) {
    await page.goto(FLEET, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await closeOverlay(page);
    await choose(page, ROLE_SELECT, role);
    await page.waitForTimeout(900);

    check(`${role} is told the register is closed`, (await page.$(".ops-unavailable")) !== null);
    check(`${role}: no vehicle row survives`, (await page.$(".ops-leads__row, .ops-leadcard")) === null);
    check(`${role}: no drawer survives`, (await page.$(".ops-detail__id")) === null);
    check(`${role}: no asset code is left on the page`, !(await page.content()).includes("MTR-0"));
    const closed = await textOf(page, ".ops-unavailable__text");
    check(`${role}: the reason names the role`, closed.includes(role), closed.slice(0, 70));
    check(`${role}: and no create button`, (await page.$('.ops-button--primary:has-text("New vehicle")')) === null);

    /* A direct link under the closed role shows the same contained state. */
    await page.goto(`${FLEET}?selected=vehicle_0001`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    check(`${role}: a deep link is contained too`, (await page.$(".ops-unavailable")) !== null);
    check(`${role}: with no vehicle data at all`, (await page.$(".ops-leads__row, .ops-detail__id")) === null);

    await page.goto(MNT, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    check(`${role} is told the queue is closed`, (await page.$(".ops-unavailable")) !== null);
    check(`${role}: no work order row survives`, (await page.$(".ops-leads__row, .ops-leadcard")) === null);
    check(`${role}: no summary text is left`, !(await page.content()).includes("Brake pads"));
    const closedQueue = await textOf(page, ".ops-unavailable__text");
    check(`${role}: the queue reason names the role`, closedQueue.includes(role), closedQueue.slice(0, 70));
  }

  /* Coming back restores both modules. */
  await page.goto(FLEET, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await choose(page, ROLE_SELECT, "Admin");
  await page.waitForTimeout(900);
  check("Admin gets the register back", (await page.$(".ops-vehicles")) !== null);
  check("with its rows", (await rowsOf(page)) === 10, String(await rowsOf(page)));

  await ctx.close();
}

/* =====================================================================
   10. MOBILE
   ===================================================================== */

section("MOBILE");
for (const mod of [
  { name: "fleet", root: ".ops-vehicles", path: FLEET, create: "New vehicle" },
  { name: "maintenance", root: ".ops-maintenance", path: MNT, create: "New work order" },
]) {
  for (const [w, h] of [
    [390, 844],
    [360, 800],
  ]) {
    const { ctx, page, problems } = await fresh({ width: w, height: h }, mod.path);
    const tag = `${mod.name} ${w}`;
    await settle(page);

    const shown = (sel) =>
      page.$eval(sel, (e) => getComputedStyle(e).display !== "none").catch(() => false);

    check(`${tag}: the table is put away`, !(await shown(".ops-leads__table-wrap")));
    check(`${tag}: cards take over`, (await page.$$eval(".ops-leadcard", (n) => n.length)) === 10);
    check(
      `${tag}: nothing overflows sideways`,
      (await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )) <= 0
    );

    await page.click(".ops-leads__filter-button");
    await page.waitForSelector(".ops-overlay--sheet", POLL);
    await page.waitForTimeout(300);
    check(`${tag}: filters open in a sheet`, (await page.$(".ops-sheet__title")) !== null);
    check(
      `${tag}: with all three controls`,
      (await page.$$eval('.ops-overlay--sheet [role="combobox"]', (n) => n.length)) === 3
    );
    await page.click('.ops-sheet__head .ops-button:has-text("Done")');
    await page.waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL);

    await page.click(".ops-leadcard");
    await waitForDetail(page);
    await page.waitForTimeout(450);
    check(`${tag}: a card opens the drawer`, (await page.$(".ops-detail__id")) !== null);
    const width = await page.$eval(".ops-overlay--drawer", (e) => e.getBoundingClientRect().width);
    check(`${tag}: the drawer fits`, width <= w, String(Math.round(width)));
    check(
      `${tag}: and its content does not overflow`,
      (await page.evaluate(() => {
        const el = document.querySelector(".ops-detail__body");
        return el ? el.scrollWidth - el.clientWidth : 0;
      })) <= 1
    );

    /* Browser Back closes the drawer rather than leaving the demo. */
    await page.goBack();
    await page.waitForTimeout(500);
    check(`${tag}: Back returns to the list`, (await page.$(".ops-detail__id")) === null);
    check(`${tag}: rather than leaving the module`, page.url().includes(`/demos/operations/${mod.name}`));

    /* The form is the tallest sheet either module opens, so it is the one that
       decides whether a phone can finish the job. */
    await page.click(`.ops-button--primary:has-text("${mod.create}")`);
    await page.waitForSelector(".ops-form", POLL);
    await page.waitForTimeout(400);
    const sheet = await page.$eval(".ops-overlay--sheet", (e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, bottom: r.bottom };
    });
    check(
      `${tag}: the create sheet fits the viewport`,
      sheet.left >= -1 && sheet.right <= w + 1,
      `${Math.round(sheet.left)}..${Math.round(sheet.right)}`
    );
    check(
      `${tag}: with its submit button reachable`,
      await page.$eval(
        '.ops-form button[type="submit"]',
        (e) => e.getBoundingClientRect().bottom <= window.innerHeight + 1
      )
    );
    check(
      `${tag}: and the form does not scroll sideways`,
      (await page.evaluate(() => {
        const el = document.querySelector(".ops-sheet__body");
        return el ? el.scrollWidth - el.clientWidth : 0;
      })) <= 1
    );

    check(`${tag}: the mobile console is clean`, problems.length === 0, problems.join(" | ").slice(0, 100));
    await ctx.close();
  }
}

/* =====================================================================
   11. CONTAINMENT

   The Inbox owns the fixed-viewport workspace. Both of these modules must grow
   with their content like Leads, Customers and Reservations, and must not have
   picked up the `:has(.ops-inbox)` rules by accident. Measured, and captured
   full page, because the Inbox defect was invisible to a viewport screenshot.
   ===================================================================== */

section("CONTAINMENT - TWO NORMAL PAGE-GROWTH MODULES");
{
  const { PNG } = await import("pngjs");
  const fs = await import("node:fs");
  const DIR = "qa/shots/stage09c43";
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

  for (const mod of [
    { name: "fleet", root: ".ops-vehicles", path: FLEET },
    { name: "maintenance", root: ".ops-maintenance", path: MNT },
  ]) {
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
      const { ctx, page } = await fresh({ width: w, height: h }, mod.path);
      await settle(page);

      const m = await page.evaluate((root) => {
        const shell = document.querySelector(".demo-shell");
        const content = document.querySelector(".ops-content");
        const last = [...document.querySelectorAll(`${root} *`)]
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
      }, mod.root);
      const shot = await capture(page, `${mod.name}-${w}x${h}`);
      const tag = `${mod.name} ${w}x${h}`;

      check(`${tag}: no horizontal overflow`, m.hOver <= 0, String(m.hOver));
      /* The Inbox pins the shell and clips the content; these modules must do
         neither, or they have silently inherited the wrong treatment. */
      check(
        `${tag}: the content scrolls with the page`,
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
        `${tag}: the document ends where its content does`,
        m.body - floor < 60,
        `body ${m.body}, content ends ${m.lastContentBottom}, viewport ${m.client}`
      );
      check(
        `${tag}: no band of portfolio background below it`,
        shot.trailing <= 24,
        `${shot.trailing}px of backdrop in a ${shot.height}px capture`
      );

      await ctx.close();
    }

    /* No absolutely positioned descendant may escape the module: this is the
       rule the Inbox defect broke, stated rather than tested by symptom. Both
       roots carry `position: relative` for exactly this reason, since the
       visually hidden heading, the search label and the table caption are all
       absolutely positioned. */
    const { ctx, page } = await fresh({ width: 1440, height: 900 }, mod.path);
    const escaped = await page.evaluate((rootSelector) => {
      const root = document.querySelector(rootSelector);
      let count = 0;
      for (const el of document.querySelectorAll(`${rootSelector} *`)) {
        if (getComputedStyle(el).position !== "absolute") continue;
        let p = el.parentElement;
        while (p && getComputedStyle(p).position === "static") p = p.parentElement;
        if (p && !root.contains(p)) count += 1;
      }
      return count;
    }, mod.root);
    check(`${mod.name}: no absolute descendant escapes the module`, escaped === 0, `${escaped} escaped`);
    await ctx.close();
  }
}

/* =====================================================================
   12. PRESENTATION AND CONTENT RULES
   ===================================================================== */

section("PRESENTATION - CONTRAST, FOCUS AND CONTENT");
for (const mod of [
  {
    name: "fleet",
    root: ".ops-vehicles",
    path: FLEET,
    text:
      ".ops-vehicles__asset, .ops-vehicles__model, .ops-vehicles__odo, .ops-vehicles__assignment, .ops-pill, .ops-facts__value, .ops-leads__unassigned",
    caption: /Vehicles, sorted by/,
  },
  {
    name: "maintenance",
    root: ".ops-maintenance",
    path: MNT,
    text:
      ".ops-maintenance__vehicle, .ops-maintenance__type, .ops-maintenance__summary, .ops-prio, .ops-pill, .ops-facts__value, .ops-maintenance__body",
    caption: /Work orders, sorted by/,
  },
]) {
  const { ctx, page } = await fresh({ width: 1440, height: 900 }, mod.path);
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(450);

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

  const samples = await page.$$eval(mod.text, (nodes) =>
    nodes.slice(0, 200).map((el) => {
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
    check(`${mod.name} contrast ${s.label}`.slice(0, 58), r >= 4.5, r.toFixed(2));
  }
  check(`${mod.name}: the worst contrast still passes`, worst.r >= 4.5, `${worst.r.toFixed(2)} ${worst.label}`);

  /* Status never depends on colour alone. */
  const pills = await allOf(page, ".ops-pill");
  check(
    `${mod.name}: status pills carry their own words`,
    pills.length > 0 && pills.every((p) => /^[A-Za-z ]+$/.test(p)),
    pills.slice(0, 3).join(",")
  );

  /* Accessibility essentials. */
  const semantics = await page.evaluate((root) => {
    const rows = document.querySelectorAll(`${root} .ops-leads__table tbody tr`);
    const headers = document.querySelectorAll(`${root} .ops-leads__table th[scope="row"]`);
    const caption = document.querySelector(`${root} .ops-leads__table caption`);
    const live = document.querySelectorAll(`${root} [role="status"][aria-live="polite"]`);
    return {
      rows: rows.length,
      headers: headers.length,
      caption: caption?.textContent.replace(/\s+/g, " ").trim() ?? "",
      live: live.length,
    };
  }, mod.root);
  check(`${mod.name}: every row has a row header`, semantics.headers === semantics.rows, `${semantics.headers}/${semantics.rows}`);
  check(`${mod.name}: the table is captioned`, mod.caption.test(semantics.caption), semantics.caption.slice(0, 50));
  check(`${mod.name}: exactly one polite live region`, semantics.live === 1, String(semantics.live));

  await closeOverlay(page);
  await page.focus(".ops-leads__name");
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return `${cs.outlineStyle}:${cs.outlineWidth}`;
  });
  check(`${mod.name}: a row shows focus`, !/^none:0px$/.test(ring), ring);

  /* The standing content rules, read off the rendered page. */
  const html = await page.content();
  check(`${mod.name}: no mailto link`, !/mailto:/i.test(html));
  check(`${mod.name}: no tel link`, !/\btel:\+?\d/i.test(html));
  check(`${mod.name}: no email address`, !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html));
  check(`${mod.name}: no telephone number`, !/\+\d[\d\s().-]{7,}\d/.test(html));
  check(`${mod.name}: no messenger channel`, !/whatsapp|telegram|discord|\bsms\b/i.test(html));
  check(`${mod.name}: no payment or document field`, !/card number|iban|licence|license number|passport/i.test(html));
  check(`${mod.name}: no booking or contact CTA`, !/book now|contact us|hire me|get in touch/i.test(html));
  check(`${mod.name}: no em dash on the page`, !html.includes(String.fromCharCode(0x2014)));
  check(`${mod.name}: the page says the data is synthetic`, /synthetic|simulat/i.test(html));

  /* No network beyond the app itself. */
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(700);
  check(
    `${mod.name}: no external request`,
    requests.filter((u) => !u.startsWith(BASE) && !u.startsWith("data:")).length === 0,
    requests.find((u) => !u.startsWith(BASE) && !u.startsWith("data:")) ?? ""
  );
  check(`${mod.name}: and no API call`, requests.filter((u) => u.includes("/api/")).length === 0);

  await ctx.close();
}

/* =====================================================================
   13. RESET

   Last, because it is the promise the whole demo rests on: whatever a visitor
   did, the canonical world comes back. The MTR-025 and MTR-026 created earlier
   in this suite are gone after a reset, and correctly so: reset restores the
   canonical seed rather than replaying what happened on top of it.
   ===================================================================== */

section("RESET - THE CANONICAL WORLD RETURNS");
{
  const { ctx, page } = await fresh({ width: 1440, height: 900 }, MNT);
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    /* A realistic sequence across both modules, all through the product: a new
       machine, a new job on it, and that job finished. */
    await page.bringToFront();
    await page.click('.ops-button--primary:has-text("New work order")');
    await page.waitForSelector(".ops-form", POLL);
    await page.waitForTimeout(300);
    await chooseByLabel(page, FORM_SELECT(0), "MTR-022");
    await page.fill(".ops-textarea", "QA reset sequence");
    await page.click('.ops-form button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
    await waitForDetail(page);
    await page.waitForTimeout(700);
    await page.click('.ops-detail__buttons .ops-button:has-text("Start work")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
    await page.waitForTimeout(900);
    await page.click('.ops-detail__buttons .ops-button:has-text("Complete work")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
    await page.waitForTimeout(1200);

    await page.bringToFront();
    await closeOverlay(page);
    await page.goto(FLEET, { waitUntil: "networkidle" });
    await page.waitForSelector(".ops-leads__count", POLL);
    await page.click('.ops-button--primary:has-text("New vehicle")');
    await page.waitForSelector(".ops-form", POLL);
    await page.waitForTimeout(300);
    await page.fill('.ops-form input[type="number"]', "77");
    await page.click('.ops-form button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
    await waitForDetail(page);
    await page.waitForTimeout(700);

    const dirty = await readWorld(reader);
    check("the sequence mutated the world", dirty.vehicles === 25 && dirty.workOrders === 11, `${dirty.vehicles} vehicles, ${dirty.workOrders} work orders`);
    check("and it ran a rule on the way", dirty.runs === 19, String(dirty.runs));

    /* Reset through the product's own control. */
    await page.bringToFront();
    await closeOverlay(page);
    await page.click('.demo-chrome button:has-text("Reset")');
    await page.waitForSelector("dialog[open]", POLL);
    await page.click('dialog[open] button:has-text("Reset demo")');
    await page.waitForTimeout(3000);

    const after = await readWorld(reader);
    check("24 vehicles return", after.vehicles === 24, String(after.vehicles));
    check(
      "in the canonical distribution",
      JSON.stringify(after.vehicleStatus) ===
        JSON.stringify({ Rented: 7, Reserved: 4, Maintenance: 3, Available: 10 }),
      JSON.stringify(after.vehicleStatus)
    );
    check("10 work orders return", after.workOrders === 10, String(after.workOrders));
    check(
      "in their canonical distribution",
      JSON.stringify(after.workStatus) ===
        JSON.stringify({ Open: 2, "In Progress": 1, Completed: 6, Cancelled: 1 }),
      JSON.stringify(after.workStatus)
    );
    check("18 automation runs return", after.runs === 18, String(after.runs));
    check("22 notifications return", after.notifications === 22, String(after.notifications));
    check("14 contracts return", after.contracts === 14, String(after.contracts));
    const drift = await fleetDrift(reader);
    check("and the restored fleet matches its derivation", drift.length === 0, drift[0] ?? "");

    /* The register on screen agrees with the store behind it. */
    await page.bringToFront();
    await page.goto(FLEET, { waitUntil: "networkidle" });
    await page.waitForSelector(".ops-leads__count", POLL);
    await page.waitForTimeout(400);
    check("the register reads 24 again", (await countOf(page)) === "24 vehicles", await countOf(page));
    await page.fill(".ops-leads__search-input", "MTR-025");
    await page.waitForTimeout(300);
    check("and the vehicles this suite added are gone", (await page.$(".ops-leads__empty")) !== null);

    await ctx.close();
  }
}

await browser.close();

console.log(
  `\n=== stage 09C4.3 fleet and maintenance: ${
    failures === 0 ? "ALL PASS" : failures + " FAILED"
  } (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
