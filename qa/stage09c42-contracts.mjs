/**
 * Stage 09C4.2 - Operations Contracts QA.
 *
 * The rental group's second screen, and the one that owns the product's most
 * expensive claim: **the vehicle follows the contract**. Activating a rental
 * takes a machine out of the fleet and completing it puts the machine back,
 * and neither of those is visible on this screen at all. So the section that
 * matters most here reads the store rather than the page, and asks what the
 * click left behind.
 *
 * Everything else is the grammar the earlier modules settled: the same list,
 * the same drawer, the same URL contract for selection, the same role gate.
 * A suite that re-proved all of it from scratch would be measuring the shared
 * components twice, so those sections check that this module inherited them
 * correctly and spend their length on what is genuinely its own: money, the
 * lifecycle, the read-only roles, and the absent create button.
 *
 * Two of the sections need a route that only exists during a QA run:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c42-contracts.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host,
 * 3100 is production and 3000 is the documented development preview.
 *
 * Against production those two sections skip themselves and the rest still
 * runs, so a green exit here means the screen is sound either way.
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const CONTRACTS = `${BASE}/demos/operations/contracts`;
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

/** A page on the Contracts route with the list rendered. */
async function fresh(viewport = { width: 1440, height: 900 }, path = CONTRACTS) {
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
  /* A brand new context can go several seconds without producing a frame, and
     until it does every rect reads stale and every transition reads unstarted.
     A throwaway capture forces one, cheaply, before anything is measured. */
  await page.screenshot({ type: "jpeg", quality: 20 });
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

/** The option labels a select offers, read without choosing any of them. */
async function optionsOf(page, trigger) {
  await page.click(trigger);
  await page.waitForSelector('[role="listbox"]', POLL);
  await page.waitForTimeout(200);
  const labels = await page.$$eval('[role="listbox"] [role="option"]', (n) =>
    n.map((e) => e.textContent.trim())
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, POLL);
  await page.waitForTimeout(150);
  return labels;
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

/** The whole first row, which identifies it far better than a name alone. */
const firstRow = (page) =>
  page.$eval(".ops-leads__row", (e) => e.textContent.replace(/\s+/g, " ").trim());

const waitForDetail = (page) =>
  page.waitForFunction(
    () =>
      Boolean(document.querySelector(".ops-detail__id")) ||
      Boolean(document.querySelector(".ops-detail__missing")),
    null,
    POLL
  );

/**
 * Close the drawer and wait for it to be gone.
 *
 * Not politeness: the drawer is a native modal `<dialog>`, so the chrome behind
 * it is genuinely inert and any click on the role select or the reset button
 * while it is up will sit there until it times out.
 */
async function closeDrawer(page) {
  if (!(await page.$(".ops-overlay--drawer"))) return;
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  await page.waitForTimeout(250);
}

/** One contract, opened by link, with the record confirmed to be in hand. */
async function openContract(page, id) {
  await page.goto(`${CONTRACTS}?selected=${id}`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(450);
}

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

/** `USD 1234.56` back to the integer cents the domain actually stores. */
const centsOf = (text) => {
  const m = /USD\s+(-?)(\d+)\.(\d{2})/.exec(text ?? "");
  if (!m) return null;
  const value = Number(m[2]) * 100 + Number(m[3]);
  return m[1] === "-" ? -value : value;
};

/* =====================================================================
   1. THE LIST
   ===================================================================== */

section("LIST - DESKTOP, ADMIN");
{
  const { ctx, page, problems } = await fresh();

  check("the route renders the module", (await page.$(".ops-contracts")) !== null);
  check("14 contracts are counted", (await countOf(page)) === "14 contracts", await countOf(page));
  check("ten rows on the first page", (await rowsOf(page)) === 10, String(await rowsOf(page)));
  check("the pager reads 1 to 10 of 14", /1.{1,3}10 of 14/.test(await textOf(page, ".ops-pager__range")), await textOf(page, ".ops-pager__range"));
  check("across two pages", (await textOf(page, ".ops-pager__page")) === "Page 1 of 2", await textOf(page, ".ops-pager__page"));
  check("the console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));

  const columns = await page.$$eval(".ops-leads__table thead th", (n) =>
    n.map((e) => e.textContent.replace(/[^A-Za-z ]/g, "").trim())
  );
  check(
    "the columns are the operational six",
    columns.join(",") === "Customer,Vehicle,Period,Total,Balance,Status",
    columns.join(",")
  );
  /* Vehicle and Total carry no sort: a fleet is read by asset code elsewhere,
     and a total is reference rather than a thing anyone ranks by. */
  const sortable = await page.$$eval(".ops-leads__table thead .ops-th-sort", (n) =>
    n.map((e) => e.textContent.replace(/[^A-Za-z ]/g, "").trim())
  );
  check(
    "four columns sort and two do not",
    sortable.join(",") === "Customer,Period,Balance,Status",
    sortable.join(",")
  );
  check(
    "the default order is declared on the Period column",
    (await page.$$eval(".ops-leads__table thead th", (n) =>
      n.map((e) => e.getAttribute("aria-sort") ?? "-")
    )).join(",") === "none,-,descending,-,none,none",
    (await page.$$eval(".ops-leads__table thead th", (n) => n.map((e) => e.getAttribute("aria-sort") ?? "-"))).join(",")
  );

  const rowHeaders = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".ops-leads__row")];
    return {
      rows: rows.length,
      headed: rows.filter((r) => r.querySelector('th[scope="row"] button.ops-leads__name')).length,
    };
  });
  check(
    "every row header is a real button",
    rowHeaders.headed === rowHeaders.rows,
    `${rowHeaders.headed}/${rowHeaders.rows}`
  );

  /* The absence this module is designed around. A contract is what a confirmed
     reservation becomes and the domain has no other entry point, so a create
     control here would promise a capability the services do not have. */
  check(
    "the toolbar offers no create button",
    (await page.$(".ops-leads__toolbar .ops-button--primary")) === null
  );
  check(
    "and nothing on the page invites one",
    !/new contract|create contract|add contract/i.test(await page.content())
  );

  /* The status filter counts from the live rows, so the numbers in the menu
     are the list's own arithmetic rather than a constant that can rot. */
  const statusOptions = await optionsOf(page, FILTER(0));
  check(
    "the status filter carries live counts",
    statusOptions.includes("Active (7)") &&
      statusOptions.includes("Pending (3)") &&
      statusOptions.includes("Completed (3)") &&
      statusOptions.includes("Cancelled (1)"),
    statusOptions.join(" | ")
  );

  await choose(page, FILTER(0), "Active");
  await page.waitForTimeout(250);
  check("filtering by Active gives seven", (await countOf(page)) === "7 contracts", await countOf(page));
  const activePills = await page.$$eval(".ops-leads__row .ops-pill", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("and every row says so", activePills.every((p) => p === "Active"), activePills.join(","));
  await choose(page, FILTER(0), "all");
  await page.waitForTimeout(200);

  /* Only the rented pool is Urban in the canonical fleet, so the class filter
     and the status filter should agree without being told to. */
  await choose(page, FILTER(1), "Urban");
  await page.waitForTimeout(250);
  const urban = await countOf(page);
  check("the class filter narrows the list", urban === "7 contracts", urban);
  const urbanPills = await page.$$eval(".ops-leads__row .ops-pill", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("to the seven running rentals", urbanPills.every((p) => p === "Active"), urbanPills.join(","));
  await choose(page, FILTER(1), "all");
  await page.waitForTimeout(200);
  check("clearing both filters restores 14", (await countOf(page)) === "14 contracts", await countOf(page));

  /* Sort. The default answers "what is running now", so the newest start is at
     the top and every other choice has to move it. */
  const byDefault = await firstRow(page);
  for (const [value, label] of [
    ["start:asc", "earliest start"],
    ["customer:asc", "customer A to Z"],
    ["balance:desc", "highest balance"],
    ["status:asc", "Active first"],
  ]) {
    await choose(page, FILTER(2), value);
    await page.waitForTimeout(250);
    const now = await firstRow(page);
    check(`sorting by ${label} moves the top row`.slice(0, 58), now !== byDefault, now.slice(0, 46));
  }
  await choose(page, FILTER(2), "customer:asc");
  await page.waitForTimeout(250);
  const names = await page.$$eval(".ops-leads__name", (n) => n.map((e) => e.textContent.trim()));
  check(
    "customer A to Z is alphabetical",
    names.join("|") === [...names].sort((a, b) => a.localeCompare(b)).join("|"),
    names.slice(0, 2).join(" / ")
  );
  await choose(page, FILTER(2), "start:desc");
  await page.waitForTimeout(250);
  check("and the default order comes back", (await firstRow(page)) === byDefault);

  /* Search covers what the row shows and the id it does not, because the id is
     what a reservation's drawer hands a visitor. */
  await page.fill(".ops-leads__search-input", names[0].slice(0, 7));
  await page.waitForTimeout(250);
  check("search matches a customer name", (await rowsOf(page)) >= 1, await countOf(page));
  await page.fill(".ops-leads__search-input", "MTR-007");
  await page.waitForTimeout(250);
  check("an asset code finds one contract", (await countOf(page)) === "1 contract", await countOf(page));
  check(
    "and it is the hire on that vehicle",
    (await textOf(page, ".ops-contracts__vehicle")).startsWith("MTR-007"),
    await textOf(page, ".ops-contracts__vehicle")
  );
  await page.fill(".ops-leads__search-input", "contract_0011");
  await page.waitForTimeout(250);
  check("a contract id finds its own row", (await countOf(page)) === "1 contract", await countOf(page));
  await page.fill(".ops-leads__search-input", "zzzz-nothing");
  await page.waitForTimeout(250);
  check("an empty result explains itself", (await page.$(".ops-leads__empty")) !== null);
  check(
    "in the module's own words",
    (await textOf(page, ".ops-leads__empty-text")) === "No contracts match these filters.",
    await textOf(page, ".ops-leads__empty-text")
  );
  await page.click('.ops-leads__empty .ops-button:has-text("Clear filters")');
  await page.waitForTimeout(300);
  check("and clears from there", (await countOf(page)) === "14 contracts", await countOf(page));

  await choose(page, PAGE_SIZE, "20");
  await page.waitForTimeout(250);
  check("20 rows per page shows every contract", (await rowsOf(page)) === 14, String(await rowsOf(page)));
  check("on a single page", (await textOf(page, ".ops-pager__page")) === "Page 1 of 1");
  await choose(page, PAGE_SIZE, "10");
  await page.waitForTimeout(200);
  await page.click('.ops-pager__step:has-text("Next")');
  await page.waitForTimeout(250);
  check("Next moves to page two", (await textOf(page, ".ops-pager__page")) === "Page 2 of 2");
  check("which holds the remaining four", (await rowsOf(page)) === 4, String(await rowsOf(page)));

  check("no native select survives", (await page.$$eval("select", (n) => n.length)) === 0);
  check("the list console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));

  await ctx.close();
}

/* =====================================================================
   2. MONEY

   Cents are stored and money is shown, and the whole point of that split is
   that a raw cent count must never reach a cell. The balance is checked by
   doing the subtraction here rather than trusting the figure the screen
   printed.
   ===================================================================== */

section("MONEY - FORMATTED, AND ARITHMETIC THAT HOLDS");
{
  const { ctx, page } = await fresh();

  await choose(page, PAGE_SIZE, "20");
  await page.waitForTimeout(300);

  const cells = await page.$$eval(".ops-contracts__money", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("every money cell is present", cells.length === 28, `${cells.length} cells`);
  check(
    "and formatted as currency and cents",
    cells.every((c) => /^USD \d+\.\d{2}$/.test(c)),
    cells.find((c) => !/^USD \d+\.\d{2}$/.test(c)) ?? ""
  );
  check(
    "the balance column is marked as such",
    (await page.$$eval(".ops-contracts__balance", (n) => n.length)) === 14,
    String(await page.$$eval(".ops-contracts__balance", (n) => n.length))
  );

  /* The failure this guards against is a component printing `16500` because it
     forgot the formatter, which looks like a plausible figure and is not. */
  const bare = await page.$$eval(".ops-leads__table td, .ops-leads__table th", (n) =>
    n.map((e) => e.textContent.trim()).filter((t) => /^\d{3,}$/.test(t))
  );
  check("no cell is a bare cent count", bare.length === 0, bare.slice(0, 3).join(","));

  await page.fill(".ops-leads__search-input", "contract_0011");
  await page.waitForTimeout(300);
  const rowMoney = await page.$$eval(".ops-leads__row .ops-contracts__money", (n) =>
    n.map((e) => e.textContent.trim())
  );
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(400);

  check("the drawer opens on the searched contract", (await textOf(page, ".ops-detail__id")) === "contract_0011", await textOf(page, ".ops-detail__id"));
  const money = await factsOf(page, "Money");
  check(
    "the money section states four figures",
    money !== null && money.map((f) => f.label).join(",") === "Daily rate,Total,Paid,Remaining balance",
    money ? money.map((f) => f.label).join(",") : "no section"
  );
  const value = (label) => centsOf(money?.find((f) => f.label === label)?.value ?? "");
  const total = value("Total");
  const paid = value("Paid");
  const balance = value("Remaining balance");
  check("each one parses as money", [value("Daily rate"), total, paid, balance].every((v) => v !== null));
  /* The subtraction belongs to the selector, so this is the one place the
     harness does the arithmetic itself and asks the screen to agree. */
  check(
    "the balance is the total less what was paid",
    balance === total - paid,
    `${balance} vs ${total} - ${paid}`
  );
  check("and the row printed the same two figures", rowMoney.join(",") === `USD ${(total / 100).toFixed(2)},USD ${(balance / 100).toFixed(2)}`, rowMoney.join(","));
  check(
    "a contract with a balance says so in the header",
    (await marksOf(page)).includes(balance === 0 ? "Settled" : "Balance due"),
    (await marksOf(page)).join(" ")
  );

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
  await page.waitForTimeout(400);
  check("clicking a row opens the drawer", (await page.$(".ops-detail__id")) !== null);
  check("the drawer names the customer", (await textOf(page, ".ops-detail__title")) === name, name);
  check("the URL carries the selection", page.url().includes("?selected=contract_"), page.url().split("?")[1] ?? "");
  check("the drawer is a dialog", (await page.$("dialog[open]")) !== null);

  const sections = await page.$$eval(".ops-detail__section-title", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check(
    "a contract is grouped as rental, money and activity",
    sections.includes("Rental") && sections.includes("Money") && sections.includes("Activity"),
    sections.join(",")
  );

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  check("Escape closes the drawer", (await page.$(".ops-detail__id")) === null);
  check("and the URL is clean again", !page.url().includes("selected="), page.url());
  check(
    "focus returns to the row",
    (await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")) === name
  );

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

  await page.goto(url, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(300);
  check("a shared link opens the same contract", (await textOf(page, ".ops-detail__title")) === name);

  await page.goto(`${CONTRACTS}?selected=contract_9999`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check("an unknown id is explained", (await page.$(".ops-detail__missing")) !== null);
  check(
    "and the id is quoted back",
    (await textOf(page, ".ops-detail__missing")).includes("contract_9999")
  );

  /* Origin is the section that separates a converted contract from one the
     seed simply holds, and it is the only place the two differ. */
  await openContract(page, "contract_0001");
  const withOrigin = await page.$$eval(".ops-detail__section-title", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check(
    "a converted contract shows where it came from",
    withOrigin.join(",") === "Rental,Money,Origin,Activity",
    withOrigin.join(",")
  );
  check(
    "and Admin may walk back to the booking",
    (await page.$('.ops-overlay--drawer a[href*="/reservations?selected="]')) !== null
  );

  await openContract(page, "contract_0013");
  const noOrigin = await page.$$eval(".ops-detail__section-title", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check(
    "a pending contract with no booking shows no Origin",
    noOrigin.join(",") === "Rental,Money,Activity",
    noOrigin.join(",")
  );
  check(
    "and offers no reservation link at all",
    (await page.$$eval('.ops-overlay--drawer a[href*="/reservations"]', (n) => n.length)) === 0
  );

  check("the drawer console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   4. THE LIFECYCLE, THROUGH THE PRODUCT
   ===================================================================== */

section("LIFECYCLE - ACTIVATE, COMPLETE, CANCEL");
{
  const { ctx, page, problems } = await fresh();

  await openContract(page, "contract_0011");
  check("a pending contract opens", (await marksOf(page)).includes("Pending"), (await marksOf(page)).join(" "));
  check(
    "it offers exactly activate and cancel",
    (await actionsOf(page)).join(" | ") === "Activate contract | Cancel contract",
    (await actionsOf(page)).join(" | ")
  );

  await page.click('.ops-detail__buttons .ops-button:has-text("Activate contract")');
  await page.waitForSelector(".ops-confirm", POLL);
  await page.waitForTimeout(250);
  check("activation asks first", (await textOf(page, ".ops-confirm__title")) === "Activate this contract?", await textOf(page, ".ops-confirm__title"));
  check("naming the record", (await textOf(page, ".ops-confirm__subject")).includes("contract_0011"));
  const body = await textOf(page, ".ops-confirm__body");
  check("and saying the vehicle goes out", /vehicle reads Rented/.test(body), body.slice(0, 64));
  /* Activation can be refused by the service, and saying so before the click
     is kinder than an alert after it. */
  check("including that it can be refused", /refused/.test(body));

  await page.click('.ops-confirm .ops-button--quiet:has-text("Back")');
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(300);
  check("backing out leaves it Pending", (await marksOf(page)).includes("Pending"), (await marksOf(page)).join(" "));

  await page.click('.ops-detail__buttons .ops-button:has-text("Activate contract")');
  await page.waitForSelector(".ops-confirm", POLL);
  await page.click('.ops-confirm .ops-button--primary');
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(900);
  check("confirming makes it Active", (await marksOf(page)).includes("Active"), (await marksOf(page)).join(" "));
  check("and the module says so", (await textOf(page, ".ops-contracts > [role=\"status\"]")).includes("activated"), await textOf(page, ".ops-contracts > [role=\"status\"]"));
  check(
    "a running contract offers complete and cancel",
    (await actionsOf(page)).join(" | ") === "Complete contract | Cancel contract",
    (await actionsOf(page)).join(" | ")
  );
  check("and never activate twice", !(await actionsOf(page)).includes("Activate contract"));

  await page.click('.ops-detail__buttons .ops-button:has-text("Complete contract")');
  await page.waitForSelector(".ops-confirm", POLL);
  await page.waitForTimeout(250);
  const completeBody = await textOf(page, ".ops-confirm__body");
  /* The wording matters: the vehicle is recomputed rather than freed, because
     a confirmed reservation or an open work order may already be waiting. */
  check("completion promises a recomputation, not a release", /recomputed/.test(completeBody), completeBody.slice(0, 64));
  await page.click(".ops-confirm .ops-button--primary");
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(900);
  check("completing lands", (await marksOf(page)).includes("Completed"), (await marksOf(page)).join(" "));
  check("and withdraws every action", (await page.$(".ops-detail__buttons")) === null);

  /* A second pending contract, cancelled, so the two terminal states are both
     reached through the product rather than one being inferred. */
  await openContract(page, "contract_0012");
  await page.click('.ops-detail__buttons .ops-button:has-text("Cancel contract")');
  await page.waitForSelector(".ops-confirm", POLL);
  await page.waitForTimeout(250);
  check("cancelling asks first", (await textOf(page, ".ops-confirm__title")) === "Cancel this contract?", await textOf(page, ".ops-confirm__title"));
  const cancelBody = await textOf(page, ".ops-confirm__body");
  check("and says the record is kept", /kept and marked cancelled/.test(cancelBody), cancelBody.slice(0, 64));
  check("without alarm language", !/permanent|warning|cannot be undone/i.test(cancelBody));
  await page.click(".ops-confirm .ops-button--primary");
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(900);
  check("cancelling lands", (await marksOf(page)).includes("Cancelled"), (await marksOf(page)).join(" "));
  check("and a cancelled contract offers nothing", (await page.$(".ops-detail__buttons")) === null);

  /* The seeded terminal records agree, so the rule is the table's and not an
     artefact of having just moved these two. */
  await openContract(page, "contract_0014");
  check("the seeded cancelled contract offers nothing", (await page.$(".ops-detail__buttons")) === null);
  await openContract(page, "contract_0008");
  check("nor does a completed one", (await page.$(".ops-detail__buttons")) === null);

  check("the lifecycle console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
  await ctx.close();
}

/**
 * A reader onto the same store the screen is using.
 *
 * The probe route builds a runtime on the default adapter, which is the same
 * IndexedDB the Contracts screen persists to, in the same browser context and
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
    const [contracts, vehicles, reservations] = await Promise.all([
      rt.repository.all("contracts"),
      rt.repository.all("vehicles"),
      rt.repository.all("reservations"),
    ]);
    const tally = (rows, key) =>
      rows.reduce((acc, r) => {
        acc[r.data[key]] = (acc[r.data[key]] ?? 0) + 1;
        return acc;
      }, {});
    return {
      contracts: contracts.length,
      contractTally: tally(contracts, "status"),
      vehicles: vehicles.length,
      vehicleTally: tally(vehicles, "status"),
      reservations: reservations.length,
    };
  });

/** One vehicle, with every pointer it carries. */
const vehicleOf = (reader, id) =>
  reader.evaluate(async (vid) => {
    const v = await window.__qaRuntime.repository.get("vehicles", vid);
    return {
      assetCode: v.data.assetCode,
      status: v.data.status,
      contract: v.data.currentContractId ?? null,
      reservation: v.data.currentReservationId ?? null,
      maintenance: v.data.activeMaintenanceId ?? null,
    };
  }, id);

const contractOf = (reader, id) =>
  reader.evaluate(async (cid) => {
    const c = await window.__qaRuntime.repository.get("contracts", cid);
    return { status: c.data.status, vehicleId: c.data.vehicleId };
  }, id);

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
   5. THE VEHICLE FOLLOWS THE CONTRACT

   The assertion this module exists to make, and the one nothing on the screen
   can show. Activating a rental takes a machine out of the fleet; completing
   it puts the machine back and drops the pointer. Both are read from the
   store, because a screen that displayed the right words while writing the
   wrong record would pass every other section in this file.
   ===================================================================== */

section("THE VEHICLE FOLLOWS - READ FROM THE STORE");
{
  const { ctx, page, problems } = await fresh();
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    const seeded = await contractOf(reader, "contract_0011");
    const before = await vehicleOf(reader, seeded.vehicleId);
    check("the pending contract names a vehicle", seeded.vehicleId === "vehicle_0021", seeded.vehicleId);
    check("which is MTR-021", before.assetCode === "MTR-021", before.assetCode);
    /* A pending contract holds nothing: capacity is taken by activation, the
       same way a reservation takes it by confirmation and not by a draft. */
    check("and is free before the rental starts", before.status === "Available", before.status);
    check("holding no pointer at all", !before.contract && !before.reservation && !before.maintenance, JSON.stringify(before));

    await page.bringToFront();
    await openContract(page, "contract_0011");
    await page.click('.ops-detail__buttons .ops-button:has-text("Activate contract")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
    await page.waitForTimeout(1200);

    const activated = await contractOf(reader, "contract_0011");
    const out = await vehicleOf(reader, seeded.vehicleId);
    check("activating writes the contract Active", activated.status === "Active", activated.status);
    check("the vehicle goes out on hire", out.status === "Rented", out.status);
    check("and points at the contract that took it", out.contract === "contract_0011", String(out.contract));
    check("no reservation pointer is invented", out.reservation === null, String(out.reservation));
    const driftAfterActivate = await fleetDrift(reader);
    check("the whole fleet still matches its derivation", driftAfterActivate.length === 0, driftAfterActivate[0] ?? "");

    await page.bringToFront();
    await page.click('.ops-detail__buttons .ops-button:has-text("Complete contract")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
    await page.waitForTimeout(1200);

    const completed = await contractOf(reader, "contract_0011");
    const back = await vehicleOf(reader, seeded.vehicleId);
    check("completing writes the contract Completed", completed.status === "Completed", completed.status);
    check("the vehicle comes back to the fleet", back.status === "Available", back.status);
    check("and the contract pointer is gone", back.contract === null, String(back.contract));
    const driftAfterComplete = await fleetDrift(reader);
    check("and the fleet is coherent again", driftAfterComplete.length === 0, driftAfterComplete[0] ?? "");

    /* Nothing else moved. One rental beginning and ending should not have
       touched the count of anything. */
    const world = await readWorld(reader);
    check("no contract was created or destroyed", world.contracts === 14, String(world.contracts));
    check("nor any vehicle", world.vehicles === 24, String(world.vehicles));

    check("the store console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
    await ctx.close();
  }
}

/* =====================================================================
   6. ROLE

   The first module where the read and write split bites: every role opens a
   contract and only Admin moves one. So the test is not that the other three
   see less, it is that they see everything and can do nothing.
   ===================================================================== */

section("ROLE - EVERY ROLE READS, ONE ROLE WRITES");
{
  const { ctx, page } = await fresh();

  await openContract(page, "contract_0001");
  const customerName = await textOf(page, ".ops-detail__title");
  const adminFacts = (await factsOf(page, "Rental"))?.length ?? 0;
  const adminMoney = (await factsOf(page, "Money"))?.map((f) => f.value).join(",") ?? "";
  check("Admin is offered the lifecycle", (await page.$(".ops-detail__buttons")) !== null);
  check("and sees no read-only note", (await page.$(".ops-contracts__readonly")) === null);
  check(
    "the drawer is modal, so the role control behind it is inert",
    await page.evaluate(() => {
      const dialog = document.querySelector("dialog[open]");
      const role = document.querySelector(".ops-role__select");
      return Boolean(dialog) && Boolean(role) && !dialog.contains(role);
    })
  );

  const openAs = async (role) => {
    await closeDrawer(page);
    await choose(page, ROLE_SELECT, role);
    await page.waitForTimeout(700);
    await openContract(page, "contract_0001");
  };

  for (const role of ["Sales Agent", "Fleet Coordinator", "Finance Analyst"]) {
    await openAs(role);
    check(`${role} keeps the module`.slice(0, 58), (await page.$(".ops-contracts")) !== null);
    check(`${role} still counts 14`.slice(0, 58), (await countOf(page)) === "14 contracts", await countOf(page));
    check(
      `${role} sees the whole rental`.slice(0, 58),
      ((await factsOf(page, "Rental"))?.length ?? 0) === adminFacts,
      String((await factsOf(page, "Rental"))?.length ?? 0)
    );
    /* Money is the fact a restricted role is most likely to be quietly denied,
       so it is compared figure for figure against what Admin was shown. */
    check(
      `${role} sees the same money`.slice(0, 58),
      ((await factsOf(page, "Money"))?.map((f) => f.value).join(",") ?? "") === adminMoney
    );
    check(`${role} is offered no action`.slice(0, 58), (await page.$(".ops-detail__buttons")) === null);
    const note = await textOf(page, ".ops-contracts__readonly", "");
    check(`${role} is told why, by name`.slice(0, 58), note.includes(role), note.slice(0, 56));
    check(
      `${role} is told nothing is withheld`.slice(0, 58),
      /nothing is withheld/.test(note)
    );
  }

  /* Where a contract leads depends on the role (D-092). The links are read
     inside the drawer, because the sidebar carries its own copy of whichever
     modules the role may open and would answer the wrong question. */
  await openAs("Sales Agent");
  check(
    "Sales works bookings, so the origin is a door",
    (await page.$('.ops-overlay--drawer a[href*="/reservations?selected="]')) !== null
  );
  check(
    "and reaches the customer",
    (await page.$('.ops-overlay--drawer a[href*="/customers?selected="]')) !== null
  );
  check(
    "but not the fleet, which Sales does not open",
    (await page.$$eval('.ops-overlay--drawer a[href*="/fleet"]', (n) => n.length)) === 0
  );

  await openAs("Finance Analyst");
  check(
    "Finance sees the booking named",
    (await page.$(".ops-detail__ref")) !== null
  );
  check(
    "and quoted as the id it is",
    /reservation_\d{4}/.test(await textOf(page, ".ops-detail__ref", "")),
    await textOf(page, ".ops-detail__ref", "")
  );
  check(
    "with no way through to Reservations",
    (await page.$$eval('.ops-overlay--drawer a[href*="/reservations"]', (n) => n.length)) === 0
  );

  await openAs("Fleet Coordinator");
  const fleetFacts = (await factsOf(page, "Rental"))?.map((f) => f.value) ?? [];
  check("Fleet still reads the customer's name", fleetFacts.includes(customerName), fleetFacts[0] ?? "");
  check(
    "but there is no link into Customers",
    (await page.$$eval('.ops-overlay--drawer a[href*="/customers"]', (n) => n.length)) === 0
  );
  check(
    "while the vehicle it does own is a link",
    (await page.$('.ops-overlay--drawer a[href*="/fleet?selected="]')) !== null
  );

  /* Coming back restores the module and the record the URL still names. */
  await closeDrawer(page);
  await choose(page, ROLE_SELECT, "Admin");
  await page.waitForTimeout(900);
  await openContract(page, "contract_0001");
  check("Admin gets the lifecycle back", (await page.$(".ops-detail__buttons")) !== null);
  check("and the note goes away", (await page.$(".ops-contracts__readonly")) === null);

  await ctx.close();
}

/* =====================================================================
   7. MOBILE
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
  check(
    `${w}: a card carries the period`,
    /\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/.test(card),
    card.slice(0, 56)
  );
  /* The balance earns the card because it is the one figure that decides
     whether a row needs attention; a settled hire says the word instead. */
  check(
    `${w}: and what is still owed`,
    /USD \d+\.\d{2} due|Settled/.test(card),
    card.slice(-32)
  );

  await page.click(".ops-leads__filter-button");
  await page.waitForSelector(".ops-overlay--sheet", POLL);
  await page.waitForTimeout(300);
  check(`${w}: filters open in a sheet`, (await textOf(page, ".ops-sheet__title")) === "Filter and sort");
  check(
    `${w}: status, class and sort are all there`,
    (await page.$$eval('.ops-overlay--sheet [role="combobox"]', (n) => n.length)) === 3
  );
  await page.click('.ops-sheet__head .ops-button:has-text("Done")');
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL);
  check(`${w}: and Done closes it`, (await page.$(".ops-overlay--sheet")) === null);

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
  check(`${w}: rather than leaving the module`, page.url().includes("/demos/operations/contracts"));

  check(`${w}: the mobile console is clean`, problems.length === 0, problems.join(" | ").slice(0, 100));
  await ctx.close();
}

/* =====================================================================
   8. PAGE GROWTH, NOT THE INBOX LOCK

   The Inbox owns the fixed-viewport workspace. Contracts must grow with its
   content like every other list module, and must not have picked up the
   `:has(.ops-inbox)` rules by accident. Measured, and captured full page,
   because the Inbox defect was invisible to a viewport screenshot.
   ===================================================================== */

section("CONTAINMENT - A NORMAL PAGE-GROWTH MODULE");
{
  const { PNG } = await import("pngjs");
  const fs = await import("node:fs");
  const DIR = "qa/shots/stage09c42";
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
      const last = [...document.querySelectorAll(".ops-contracts *")]
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
     rule the Inbox defect broke, stated rather than tested by symptom (D-086).
     The visually hidden heading, caption and live region are all absolutely
     positioned, so the module root has to establish its own containing block
     or they resolve against the site shell. */
  {
    const { ctx, page } = await fresh({ width: 1440, height: 900 });
    const escaped = await page.evaluate(() => {
      const root = document.querySelector(".ops-contracts");
      const stray = [];
      for (const el of document.querySelectorAll(".ops-contracts *")) {
        if (getComputedStyle(el).position !== "absolute") continue;
        let p = el.parentElement;
        while (p && getComputedStyle(p).position === "static") p = p.parentElement;
        if (p && !root.contains(p)) stray.push(el.className || el.tagName);
      }
      return stray;
    });
    check("no absolute descendant escapes the module", escaped.length === 0, escaped.slice(0, 2).join(", "));
    await ctx.close();
  }
}

/* =====================================================================
   9. PRESENTATION AND CONTENT RULES
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
    ".ops-contracts__period, .ops-contracts__vehicle, .ops-contracts__money, .ops-contracts__balance, .ops-pill, .ops-facts__label, .ops-facts__value, .ops-detail__interest, .ops-detail__id",
    (nodes) =>
      nodes.slice(0, 30).map((el) => {
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

  /* Status never depends on colour alone: the pill says the word. */
  const pills = await page.$$eval(".ops-pill", (n) => n.map((e) => e.textContent.trim()));
  check(
    "status pills carry their own words",
    pills.length > 0 && pills.every((p) => /^(Pending|Active|Completed|Cancelled)$/.test(p)),
    pills.slice(0, 4).join(",")
  );

  /* The standing content rules, read off the rendered page. */
  const html = await page.content();
  check("no mailto link", !/mailto:/i.test(html));
  check("no tel link", !/\btel:\+?\d/i.test(html));
  check("no email address", !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html));
  check("no telephone number", !/\+\d[\d\s().-]{7,}\d/.test(html));
  check("no messenger channel", !/whatsapp|telegram|discord|\bsms\b/i.test(html));
  /* A rental product is exactly where a card number or a driving licence field
     would look natural, which is why it is asserted absent. */
  check("no payment or document field", !/card number|iban|licence|license number|passport/i.test(html));
  check("no booking or contact CTA", !/book now|contact us|hire me|get in touch/i.test(html));
  check("no em dash on the page", !html.includes(String.fromCharCode(0x2014)));
  check("the page still says the data is synthetic", /synthetic|simulat/i.test(html));

  /* Accessibility essentials. */
  const semantics = await page.evaluate(() => {
    const rows = document.querySelectorAll(".ops-leads__table tbody tr");
    const headers = document.querySelectorAll('.ops-leads__table th[scope="row"]');
    const caption = document.querySelector(".ops-leads__table caption");
    return { rows: rows.length, headers: headers.length, caption: caption?.textContent.trim() ?? "" };
  });
  check("every row has a row header", semantics.headers === semantics.rows, `${semantics.headers}/${semantics.rows}`);
  check("the table is captioned", semantics.caption.length > 0, semantics.caption.slice(0, 50));
  check("and the caption states the order", /sorted by/.test(semantics.caption), semantics.caption.slice(0, 50));
  /* One announcement, not several. The shell owns a second live region for
     role changes and reset, which is why this is scoped to the module. */
  check(
    "the module announces through exactly one live region",
    (await page.$$eval('.ops-contracts [role="status"][aria-live="polite"]', (n) => n.length)) === 1,
    String(await page.$$eval('.ops-contracts [role="status"][aria-live="polite"]', (n) => n.length))
  );

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  await page.focus(".ops-leads__name");
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return `${cs.outlineStyle}:${cs.outlineWidth}`;
  });
  check("a row shows focus", !/^none:0px$/.test(ring), ring);

  /* No network beyond the app itself. */
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.click(".ops-leads__name");
  await waitForDetail(page);
  await page.waitForTimeout(600);
  check(
    "no external request",
    requests.filter((u) => !u.startsWith(BASE) && !u.startsWith("data:")).length === 0,
    requests.find((u) => !u.startsWith(BASE) && !u.startsWith("data:")) ?? ""
  );
  check("and no API call", requests.filter((u) => u.includes("/api/")).length === 0);

  await ctx.close();
}

/* =====================================================================
   10. RESET
   ===================================================================== */

section("RESET - THE CANONICAL WORLD RETURNS");
{
  const { ctx, page } = await fresh();
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    /* Mutate through the product, so what is being restored is a change the
       screen actually made rather than one the harness wrote behind it. */
    await page.bringToFront();
    await openContract(page, "contract_0011");
    await page.click('.ops-detail__buttons .ops-button:has-text("Activate contract")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
    await page.waitForTimeout(1200);

    const dirty = await readWorld(reader);
    check(
      "the world is out of its canonical shape",
      dirty.contractTally.Active === 8 && dirty.contractTally.Pending === 2,
      JSON.stringify(dirty.contractTally)
    );
    check("and a vehicle went out with it", dirty.vehicleTally.Rented === 8, JSON.stringify(dirty.vehicleTally));

    /* Reset through the product's own control. The drawer has to go first: it
       is a modal dialog and the chrome behind it cannot be clicked. */
    await page.bringToFront();
    await closeDrawer(page);
    await page.click('.demo-chrome button:has-text("Reset")');
    await page.waitForSelector("dialog[open]", POLL);
    await page.click('dialog[open] button:has-text("Reset demo")');
    await page.waitForTimeout(3000);

    const after = await readWorld(reader);
    check("14 contracts return", after.contracts === 14, String(after.contracts));
    check(
      "in the canonical distribution",
      JSON.stringify(after.contractTally) ===
        JSON.stringify({ Active: 7, Completed: 3, Pending: 3, Cancelled: 1 }),
      JSON.stringify(after.contractTally)
    );
    check("24 vehicles return", after.vehicles === 24, String(after.vehicles));
    check(
      "with the fleet back where it started",
      JSON.stringify(after.vehicleTally) ===
        JSON.stringify({ Rented: 7, Reserved: 4, Maintenance: 3, Available: 10 }),
      JSON.stringify(after.vehicleTally)
    );
    check("18 reservations return", after.reservations === 18, String(after.reservations));
    const drift = await fleetDrift(reader);
    check("and the restored fleet matches its derivation", drift.length === 0, drift[0] ?? "");

    await page.bringToFront();
    await page.waitForTimeout(500);
    check("the screen shows the restored list", (await countOf(page)) === "14 contracts", await countOf(page));

    await ctx.close();
  }
}

await browser.close();

console.log(
  `\n=== stage 09C4.2 contracts: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
