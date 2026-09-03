/**
 * Stage 09C4.4 - Operations Payments QA.
 *
 * The ledger, and the one module in the product whose most important value is
 * never written down. A payment record says Pending or Paid and nothing else.
 * **Overdue** is what `derivePaymentStatus` answers when the demo's logical
 * clock has passed a due date, so it is produced at read time, on every read,
 * and a reset or a change of clock cannot leave a stale flag behind (D-053).
 *
 * That single decision is what the two heaviest sections here are about.
 *
 * The first reads the store and the screen together and states the same fact
 * from both sides: no stored payment carries the word Overdue, and three rows
 * on the page carry it. Either half alone proves nothing. Together they are the
 * design.
 *
 * The second follows the consequence. A payment becomes late because time
 * passed, not because anything happened to it, so no mutation raises
 * `payment.overdue` and Rule 04 would never fire on its own. The module raises
 * the transition explicitly when it opens. What that section actually measures
 * is not that the rule fires: it is that opening the module twice does not fire
 * it twice, because the reconciliation skips a payment whose Finance
 * notification already exists. Idempotence is the assertion, and firing is only
 * how you get to it.
 *
 * The rest is the grammar the earlier modules settled and this one inherited:
 * the same list, the same drawer, the same URL contract for selection, the same
 * role gate. Those sections check the inheritance and spend their length on
 * what belongs to Payments alone: money formatting, the outstanding total, the
 * append-only drawer with no actions on it, the form that moves a contract
 * balance, and the vocabulary this module is careful not to use.
 *
 * Four of the sections need a route that only exists during a QA run:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c44-payments.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host,
 * 3100 is production and 3000 is the documented development preview.
 *
 * Against production those four sections skip themselves and the rest still
 * runs, so a green exit here means the screen is sound either way.
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const PAYMENTS = `${BASE}/demos/operations/payments`;
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

/**
 * A page on a module route, with its list rendered.
 *
 * Split from `fresh` because one section has to open the reader *before* the
 * product page exists: the module reconciles overdue payments the moment it
 * mounts, so a harness that navigated first would be measuring the world after
 * the effect it wants to observe.
 */
async function openProduct(ctx, path = PAYMENTS) {
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
  return { page, problems };
}

/** A context of its own, and a page on the Payments route inside it. */
async function fresh(viewport = { width: 1440, height: 900 }, path = PAYMENTS) {
  const ctx = await browser.newContext({ viewport });
  const { page, problems } = await openProduct(ctx, path);
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
const RECORD_BUTTON = ".ops-leads__toolbar .ops-button--primary";

const countOf = (page) => page.$eval(".ops-leads__count", (e) => e.textContent.trim());
const rowsOf = (page) => page.$$eval(".ops-leads__row", (n) => n.length);
const textOf = (page, sel, d = "-") =>
  page.$eval(sel, (e) => e.textContent.trim()).catch(() => d);
const marksOf = (page) =>
  page.$$eval(".ops-detail__marks > *", (n) => n.map((e) => e.textContent.trim()));
const actionsOf = (page) =>
  page.$$eval(".ops-detail__buttons .ops-button", (n) => n.map((e) => e.textContent.trim()));

/**
 * Cell text from the table only.
 *
 * The card list stays in the DOM at desktop width behind `display: none`, and
 * a payment's contract id and status pill appear on both. An unscoped count
 * would double every one of them and be wrong in a way that still looks like a
 * number.
 */
const cellsOf = (page, sel) =>
  page.$$eval(`.ops-leads__table ${sel}`, (n) => n.map((e) => e.textContent.trim()));

const countIn = (page, sel) => page.$$eval(sel, (n) => n.length);

/** The whole first row, which identifies it far better than a name alone. */
const firstRow = (page) =>
  page.$eval(".ops-leads__row", (e) => e.textContent.replace(/\s+/g, " ").trim());

/** The outstanding line beside the count, with its whitespace normalised. */
const summaryOf = (page) =>
  page
    .$eval(".ops-payments__summary", (e) => e.textContent.replace(/\s+/g, " ").trim())
    .catch(() => "");

/** The module's own polite region, not the shell's. */
const announcementOf = (page) =>
  page
    .$eval('.ops-payments > [role="status"]', (e) => e.textContent.trim())
    .catch(() => "");

/**
 * Wait until module entry has finished raising the overdue transition.
 *
 * Three events, each costing a job commit, an action commit and a run commit,
 * so the reconciliation is roughly two seconds of writes behind a page that
 * already looks finished. Any section that counts runs or notifications has to
 * let it land first or it is timing the machine rather than the product.
 */
const waitForReconcile = async (page) => {
  await page
    .waitForFunction(
      () =>
        /due date/.test(
          document.querySelector('.ops-payments > [role="status"]')?.textContent ?? ""
        ),
      null,
      POLL
    )
    .catch(() => {});
  await page.waitForTimeout(600);
};

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

/** The same, for the filter sheet and the record form, which share a variant. */
async function closeSheet(page) {
  if (!(await page.$(".ops-overlay--sheet"))) return;
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL);
  await page.waitForTimeout(250);
}

/** Everything modal, gone, which is the precondition for touching the chrome. */
async function closeOverlays(page) {
  await closeDrawer(page);
  await closeSheet(page);
}

/** One payment, opened by link, with the record confirmed to be in hand. */
async function openPayment(page, id) {
  await page.goto(`${PAYMENTS}?selected=${id}`, { waitUntil: "networkidle" });
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

/** Cents back to the dollars a person types into the amount field. */
const dollars = (cents) => (cents / 100).toFixed(2);

/** The three figures the record form prints above its fields. */
const balanceOf = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".ops-payments__balance-row")].map((row) => ({
      label: row.querySelector(".ops-payments__balance-label")?.textContent.trim() ?? "",
      value: row.querySelector(".ops-payments__balance-value")?.textContent.trim() ?? "",
    }))
  );

/* =====================================================================
   1. THE LIST
   ===================================================================== */

section("LIST - DESKTOP, ADMIN");
{
  const { ctx, page, problems } = await fresh();

  check("the route renders the module", (await page.$(".ops-payments")) !== null);
  check("26 payments are counted", (await countOf(page)) === "26 payments", await countOf(page));
  check("ten rows on the first page", (await rowsOf(page)) === 10, String(await rowsOf(page)));
  check(
    "the pager reads 1 to 10 of 26",
    /1.{1,3}10 of 26/.test(await textOf(page, ".ops-pager__range")),
    await textOf(page, ".ops-pager__range")
  );
  check(
    "across three pages",
    (await textOf(page, ".ops-pager__page")) === "Page 1 of 3",
    await textOf(page, ".ops-pager__page")
  );
  check("the console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));

  const columns = await page.$$eval(".ops-leads__table thead th", (n) =>
    n.map((e) => e.textContent.replace(/[^A-Za-z ]/g, "").trim())
  );
  check(
    "the columns are the accounting six",
    columns.join(",") === "Customer,Contract,Amount,Category,Due,Status",
    columns.join(",")
  );
  /* Contract and Category carry no sort: an id is a handle rather than a rank,
     and three categories are what the filter is for. */
  const sortable = await page.$$eval(".ops-leads__table thead .ops-th-sort", (n) =>
    n.map((e) => e.textContent.replace(/[^A-Za-z ]/g, "").trim())
  );
  check(
    "four columns sort and two do not",
    sortable.join(",") === "Customer,Amount,Due,Status",
    sortable.join(",")
  );
  const ariaSort = () =>
    page.$$eval(".ops-leads__table thead th", (n) =>
      n.map((e) => e.getAttribute("aria-sort") ?? "-")
    );
  check(
    "the default order is declared on the Due column",
    (await ariaSort()).join(",") === "none,-,none,-,ascending,none",
    (await ariaSort()).join(",")
  );

  /* The header buttons are the second way to sort, and they have to agree with
     the select rather than being decorative. */
  await page.click('.ops-leads__table thead .ops-th-sort:has-text("Amount")');
  await page.waitForTimeout(300);
  check(
    "clicking a column header moves the sort to it",
    (await ariaSort()).join(",") === "none,-,ascending,-,none,none",
    (await ariaSort()).join(",")
  );
  await page.click('.ops-leads__table thead .ops-th-sort:has-text("Due")');
  await page.waitForTimeout(300);

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

  check(
    "the toolbar offers the one write this module has",
    (await textOf(page, RECORD_BUTTON)) === "Record payment",
    await textOf(page, RECORD_BUTTON)
  );

  /* Money is the failure this list is most exposed to: a component that forgot
     the formatter prints `16500`, which looks like a plausible figure and is
     not one. */
  const amounts = await cellsOf(page, ".ops-payments__money");
  check("ten amounts on the page", amounts.length === 10, String(amounts.length));
  check(
    "every amount is currency and cents",
    amounts.every((a) => /^USD \d+\.\d{2}$/.test(a)),
    amounts.find((a) => !/^USD \d+\.\d{2}$/.test(a)) ?? ""
  );
  const bare = await page.$$eval(".ops-leads__table td, .ops-leads__table th", (n) =>
    n.map((e) => e.textContent.trim()).filter((t) => /^\d{3,}$/.test(t))
  );
  check("no cell is a bare cent count", bare.length === 0, bare.slice(0, 3).join(","));

  /* The status filter counts from the live rows and from the derived status.
     Counting `payment.status` would report Overdue as zero for ever. */
  const statusOptions = await optionsOf(page, FILTER(0));
  check(
    "the status filter carries live derived counts",
    statusOptions.includes("Overdue (3)") &&
      statusOptions.includes("Pending (5)") &&
      statusOptions.includes("Paid (18)"),
    statusOptions.join(" | ")
  );

  for (const [value, expected] of [
    ["Paid", "18 payments"],
    ["Pending", "5 payments"],
    ["Overdue", "3 payments"],
  ]) {
    await choose(page, FILTER(0), value);
    await page.waitForTimeout(250);
    check(`filtering by ${value} agrees with the menu`.slice(0, 58), (await countOf(page)) === expected, await countOf(page));
    const pills = await cellsOf(page, ".ops-pill");
    check(
      `and every ${value} row says so`.slice(0, 58),
      pills.length > 0 && pills.every((p) => p === value),
      pills.join(",")
    );
  }
  await choose(page, FILTER(0), "all");
  await page.waitForTimeout(200);

  for (const [value, expected] of [
    ["Rental", "18 payments"],
    ["Deposit", "6 payments"],
    ["Adjustment", "2 payments"],
  ]) {
    await choose(page, FILTER(1), value);
    await page.waitForTimeout(250);
    check(`the category filter finds the ${value} set`.slice(0, 58), (await countOf(page)) === expected, await countOf(page));
    const categories = await cellsOf(page, ".ops-payments__category");
    check(
      `and every row is a ${value}`.slice(0, 58),
      categories.every((c) => c === value),
      categories.join(",")
    );
  }
  await choose(page, FILTER(1), "all");
  await page.waitForTimeout(200);
  check("clearing both filters restores 26", (await countOf(page)) === "26 payments", await countOf(page));

  /* Sort. The default answers "what fell due longest ago", so every other
     choice has to move the top row. */
  const byDefault = await firstRow(page);
  for (const [value, label] of [
    ["due:desc", "latest due"],
    ["amount:desc", "highest amount"],
    ["customer:asc", "customer A to Z"],
    ["status:asc", "overdue first"],
  ]) {
    await choose(page, FILTER(2), value);
    await page.waitForTimeout(250);
    const now = await firstRow(page);
    check(`sorting by ${label} moves the top row`.slice(0, 58), now !== byDefault, now.slice(0, 46));
  }
  await choose(page, FILTER(2), "customer:asc");
  await page.waitForTimeout(250);
  const names = await cellsOf(page, ".ops-leads__name");
  check(
    "customer A to Z is alphabetical",
    names.join("|") === [...names].sort((a, b) => a.localeCompare(b)).join("|"),
    names.slice(0, 2).join(" / ")
  );
  await choose(page, FILTER(2), "status:asc");
  await page.waitForTimeout(250);
  check(
    "overdue first puts an Overdue row at the top",
    (await cellsOf(page, ".ops-pill"))[0] === "Overdue",
    (await cellsOf(page, ".ops-pill"))[0]
  );
  await choose(page, FILTER(2), "due:asc");
  await page.waitForTimeout(250);
  check("and the default order comes back", (await firstRow(page)) === byDefault);

  /* Search covers the two handles a person arrives holding, plus the payment's
     own id for the same reason the other modules allow it. */
  await page.fill(".ops-leads__search-input", names[0].slice(0, 7));
  await page.waitForTimeout(250);
  check("search matches a customer name", (await rowsOf(page)) >= 1, await countOf(page));
  await page.fill(".ops-leads__search-input", "contract_0001");
  await page.waitForTimeout(250);
  check("a contract id finds its four payments", (await countOf(page)) === "4 payments", await countOf(page));
  check(
    "and every row is filed against it",
    (await cellsOf(page, ".ops-payments__contract")).every((c) => c === "contract_0001"),
    (await cellsOf(page, ".ops-payments__contract")).join(",")
  );
  await page.fill(".ops-leads__search-input", "payment_0016");
  await page.waitForTimeout(250);
  check("a payment id finds its own row", (await countOf(page)) === "1 payment", await countOf(page));
  await page.fill(".ops-leads__search-input", "zzzz-nothing");
  await page.waitForTimeout(250);
  check("an empty result explains itself", (await page.$(".ops-leads__empty")) !== null);
  check(
    "in the module's own words",
    (await textOf(page, ".ops-leads__empty-text")) === "No payments match these filters.",
    await textOf(page, ".ops-leads__empty-text")
  );
  await page.click('.ops-leads__empty .ops-button:has-text("Clear filters")');
  await page.waitForTimeout(300);
  check("and clears from there", (await countOf(page)) === "26 payments", await countOf(page));

  await choose(page, PAGE_SIZE, "20");
  await page.waitForTimeout(250);
  check("20 rows per page fills the page", (await rowsOf(page)) === 20, String(await rowsOf(page)));
  check("over two pages", (await textOf(page, ".ops-pager__page")) === "Page 1 of 2");
  await choose(page, PAGE_SIZE, "10");
  await page.waitForTimeout(200);
  await page.click('.ops-pager__step:has-text("Next")');
  await page.waitForTimeout(250);
  await page.click('.ops-pager__step:has-text("Next")');
  await page.waitForTimeout(250);
  check("Next twice reaches page three", (await textOf(page, ".ops-pager__page")) === "Page 3 of 3");
  check("which holds the remaining six", (await rowsOf(page)) === 6, String(await rowsOf(page)));

  check("no native select survives", (await page.$$eval("select", (n) => n.length)) === 0);
  check("the list console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));

  await ctx.close();
}

/* =====================================================================
   2. THE OUTSTANDING SUMMARY

   A payments list is read to answer "how much is still owed", and the answer
   moves with the filters. The figure is checked by summing the rendered
   amounts here rather than trusting the total the screen printed beside them.
   ===================================================================== */

section("OUTSTANDING - THE FIGURE, AND ITS DENOMINATOR");
{
  const { ctx, page } = await fresh();

  const opening = await summaryOf(page);
  check(
    "the unfiltered list states what is owed",
    /^USD \d+\.\d{2} outstanding across 8 of 26 payments$/.test(opening),
    opening
  );
  /* Eight rather than twenty-six, because the sum was taken over the unsettled
     rows while the count line beside it reports every matched row. Naming both
     is what lets a reader see the two numbers answer different questions. */
  check("naming the eight it was summed over", /across 8 of 26/.test(opening), opening);

  await choose(page, FILTER(0), "Paid");
  await page.waitForTimeout(300);
  check("a settled filter has nothing to report", (await summaryOf(page)) === "Nothing outstanding", await summaryOf(page));
  check("and still counts its rows", (await countOf(page)) === "18 payments", await countOf(page));

  /* Deposits are settled on arrival in the canonical seed, so the category
     filter reaches the same sentence by a different route. */
  await choose(page, FILTER(0), "all");
  await page.waitForTimeout(200);
  await choose(page, FILTER(1), "Deposit");
  await page.waitForTimeout(300);
  check("every deposit is settled", (await summaryOf(page)) === "Nothing outstanding", await summaryOf(page));
  await choose(page, FILTER(1), "all");
  await page.waitForTimeout(200);

  await choose(page, FILTER(0), "Overdue");
  await page.waitForTimeout(300);
  const overdueSummary = await summaryOf(page);
  const overdueAmounts = await cellsOf(page, ".ops-payments__money");
  const summed = overdueAmounts.reduce((total, text) => total + (centsOf(text) ?? 0), 0);
  check("three payments are past due", overdueAmounts.length === 3, String(overdueAmounts.length));
  check(
    "and the summary is taken over all three",
    /across 3 of 3 payments$/.test(overdueSummary),
    overdueSummary
  );
  /* The arithmetic is done here so the screen is asked to agree with a figure
     it did not produce. */
  check(
    "the figure is the sum of the rows it names",
    centsOf(overdueSummary) === summed,
    `${centsOf(overdueSummary)} vs ${summed}`
  );

  await ctx.close();
}

/**
 * A reader onto the same store the screen is using.
 *
 * The probe route builds a runtime on the default adapter, which is the same
 * IndexedDB the Payments screen persists to, in the same browser context and
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
const readLedger = (reader) =>
  reader.evaluate(async () => {
    const rt = window.__qaRuntime;
    const [payments, contracts, runs, notes] = await Promise.all([
      rt.repository.all("payments"),
      rt.repository.all("contracts"),
      rt.repository.all("automation_runs"),
      rt.repository.all("notifications"),
    ]);
    const tally = (rows, read) =>
      rows.reduce((acc, r) => {
        const key = read(r);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
    return {
      payments: payments.map((p) => ({
        id: p.id,
        status: p.data.status,
        amount: p.data.amount,
        contractId: p.data.contractId,
        paidAt: p.data.paidAt ?? null,
      })),
      paymentTally: tally(payments, (p) => p.data.status),
      contracts: contracts.length,
      runs: runs.map((r) => ({ id: r.id, ruleId: r.data.ruleId, status: r.data.status })),
      notes: notes.map((n) => ({
        id: n.id,
        category: n.data.category,
        title: n.data.title,
        sourceEntityType: n.data.sourceEntityType,
        sourceEntityId: n.data.sourceEntityId,
      })),
    };
  });

/** One contract, as the store holds it. */
const contractOf = (reader, id) =>
  reader.evaluate(async (cid) => {
    const c = await window.__qaRuntime.repository.get("contracts", cid);
    if (!c) return null;
    return {
      status: c.data.status,
      totalAmount: c.data.totalAmount,
      paidAmount: c.data.paidAmount,
    };
  }, id);

/* =====================================================================
   3. OVERDUE IS DERIVED, NOT STORED

   The assertion this module exists to make. It is stated from both sides
   because either half alone is meaningless: a store with no Overdue record
   proves nothing if the screen never shows the word, and three Overdue pills
   prove nothing if the value was written down.
   ===================================================================== */

section("OVERDUE - DERIVED ON READ, ABSENT FROM THE STORE");
{
  const { ctx, page } = await fresh();
  await waitForReconcile(page);
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    const world = await readLedger(reader);
    check("the store holds 26 payments", world.payments.length === 26, String(world.payments.length));
    /* The stored union is two values. Not "no record happens to say Overdue"
       today: the word is not in the vocabulary the record can hold. */
    check(
      "no stored payment says Overdue",
      world.payments.every((p) => p.status !== "Overdue"),
      world.payments.filter((p) => p.status === "Overdue").map((p) => p.id).join(",")
    );
    check(
      "the stored split is Paid 18 and Pending 8",
      JSON.stringify(world.paymentTally) === JSON.stringify({ Paid: 18, Pending: 8 }),
      JSON.stringify(world.paymentTally)
    );

    await page.bringToFront();
    await choose(page, FILTER(0), "Overdue");
    await page.waitForTimeout(300);
    check("and the screen shows three anyway", (await countOf(page)) === "3 payments", await countOf(page));
    const pills = await cellsOf(page, ".ops-pill");
    check(
      "each one carrying the word",
      pills.length === 3 && pills.every((p) => p === "Overdue"),
      pills.join(",")
    );

    /* Named, because the three are a property of the seed and the clock rather
       than of whichever rows happen to sort first. */
    await choose(page, FILTER(0), "all");
    await page.waitForTimeout(200);
    await choose(page, PAGE_SIZE, "20");
    await page.waitForTimeout(200);
    await choose(page, FILTER(0), "Overdue");
    await page.waitForTimeout(300);
    const shown = [];
    for (const id of ["payment_0016", "payment_0018", "payment_0019"]) {
      await page.fill(".ops-leads__search-input", id);
      await page.waitForTimeout(250);
      shown.push(`${id}:${(await cellsOf(page, ".ops-pill"))[0] ?? "-"}`);
    }
    check(
      "the three late ones are 0016, 0018 and 0019",
      shown.join(" ") === "payment_0016:Overdue payment_0018:Overdue payment_0019:Overdue",
      shown.join(" ")
    );
    const stored = world.payments.filter((p) =>
      ["payment_0016", "payment_0018", "payment_0019"].includes(p.id)
    );
    check(
      "and all three are stored as Pending",
      stored.length === 3 && stored.every((p) => p.status === "Pending"),
      stored.map((p) => `${p.id}:${p.status}`).join(" ")
    );
    check(
      "with no paid date on any of them",
      stored.every((p) => p.paidAt === null),
      stored.map((p) => String(p.paidAt)).join(" ")
    );

    await ctx.close();
  }
}

/* =====================================================================
   4. RULE 04, THROUGH MODULE ENTRY

   Nothing happens to a payment when it becomes late except that time passes,
   so no mutation raises `payment.overdue` and Rule 04 would never fire. The
   module raises the transition when it opens.
   ===================================================================== */

section("RULE 04 - RAISED ON ENTRY, AND ONLY ONCE");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  /* The reader goes first here, and only here. The module reconciles the
     moment it mounts, so a harness that navigated before reading the store
     would be recording the world after the effect it wants to observe. */
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    const before = await readLedger(reader);
    check("the canonical seed holds 18 runs", before.runs.length === 18, String(before.runs.length));
    check("and 22 notifications", before.notes.length === 22, String(before.notes.length));
    check(
      "none of them is about a late payment yet",
      before.notes.filter((n) => n.category === "Finance" && n.title === "Payment overdue").length === 0,
      String(before.notes.filter((n) => n.title === "Payment overdue").length)
    );

    const { page, problems } = await openProduct(ctx);
    await page.bringToFront();
    await waitForReconcile(page);

    const said = await announcementOf(page);
    check("the module says what it raised", /3 payments? passed their due date/.test(said), said);
    check("and who was told", /Finance was notified/.test(said), said);

    const after = await readLedger(reader);
    const newRuns = after.runs.filter((r) => !before.runs.some((b) => b.id === r.id));
    const newNotes = after.notes.filter((n) => !before.notes.some((b) => b.id === n.id));

    check("three automation runs were written", newRuns.length === 3, String(newRuns.length));
    check(
      "all three are Rule 04",
      newRuns.every((r) => r.ruleId === "automation_rule_0004"),
      newRuns.map((r) => r.ruleId).join(",")
    );
    check(
      "and all three succeeded",
      newRuns.every((r) => r.status === "Success"),
      newRuns.map((r) => r.status).join(",")
    );
    check("three notifications were raised", newNotes.length === 3, String(newNotes.length));
    check(
      "every one of them is Finance",
      newNotes.every((n) => n.category === "Finance"),
      newNotes.map((n) => n.category).join(",")
    );
    check(
      "pointing at the three late payments",
      newNotes
        .map((n) => n.sourceEntityId)
        .sort()
        .join(",") === "payment_0016,payment_0018,payment_0019",
      newNotes.map((n) => n.sourceEntityId).join(",")
    );
    check(
      "as payments rather than as some other record",
      newNotes.every((n) => n.sourceEntityType === "payment"),
      newNotes.map((n) => n.sourceEntityType).join(",")
    );

    /* The half that matters. A reconciliation that fired twice would put two
       alerts in front of a finance analyst for one late payment, and the guard
       against that is not a flag on the run: it is that a payment with a
       Finance notification is never raised again. */
    await page.bringToFront();
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".ops-leads__count", POLL);
    await page.waitForTimeout(2000);

    const again = await readLedger(reader);
    check("reopening writes no further run", again.runs.length === after.runs.length, `${after.runs.length} then ${again.runs.length}`);
    check("and no second alert", again.notes.length === after.notes.length, `${after.notes.length} then ${again.notes.length}`);
    check(
      "the ledger itself was never touched",
      again.payments.length === 26 &&
        JSON.stringify(again.paymentTally) === JSON.stringify({ Paid: 18, Pending: 8 }),
      JSON.stringify(again.paymentTally)
    );
    check("the reconciliation console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));

    await ctx.close();
  }
}

/* =====================================================================
   5 and 6. RECORDING A PAYMENT, AND THE CONTRACT THAT FOLLOWS

   One context, because the second half is about what the first half left
   behind. Recording is the only write this module has, and its whole effect is
   that a contract balance moves.
   ===================================================================== */

section("RECORD - THE FORM, ITS REFUSALS AND ITS EFFECT");
{
  const { ctx, page } = await fresh();
  await waitForReconcile(page);
  const reader = await openReader(ctx);
  await page.bringToFront();

  await page.click(RECORD_BUTTON);
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(400);

  const labels = await page.$$eval(".ops-form .ops-field__label", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("the form asks three things", labels.join(",") === "Contract,Amount,Category", labels.join(","));
  check("and nothing else", labels.length === 3, String(labels.length));
  check(
    "two of them through the approved select",
    (await countIn(page, ".ops-form .demo-select__trigger")) === 2,
    String(await countIn(page, ".ops-form .demo-select__trigger"))
  );
  check("and one through a text input", (await countIn(page, ".ops-form .ops-input")) === 1);
  /* A rental product is exactly where a card field would look natural, so the
     absence is asserted where the form is open rather than only on the list. */
  check("no field asks for an instrument", (await countIn(page, '.ops-form input[type="password"]')) === 0);

  const block = await balanceOf(page);
  check(
    "the balance is stated before the fields",
    block.map((r) => r.label).join(",") === "Contract total,Already paid,Remaining balance",
    block.map((r) => r.label).join(",")
  );
  const total = centsOf(block[0]?.value);
  const paid = centsOf(block[1]?.value);
  const remaining = centsOf(block[2]?.value);
  check("each figure is money", [total, paid, remaining].every((v) => v !== null), block.map((r) => r.value).join(" "));
  /* The subtraction belongs to the selector, so the harness does it here and
     asks the screen to agree rather than reading the answer back. */
  check(
    "and what is left is the total less what was taken",
    remaining === total - paid,
    `${remaining} vs ${total} - ${paid}`
  );

  const option = await textOf(page, ".ops-form .demo-select__value", "");
  const contractId = (/contract_\d{4}/.exec(option) ?? [""])[0];
  check("the contract option names its record", /^contract_\d{4}$/.test(contractId), option);
  check("and the balance it can still take", centsOf(option) === remaining, option);

  const errors = () => countIn(page, ".ops-form .ops-field__error");
  const amountHint = () => countIn(page, ".ops-form label.ops-field .ops-field__hint");
  const submitDisabled = () =>
    page.$eval('.ops-form button[type="submit"]', (e) => e.disabled);

  /* An empty field a visitor has not reached yet is not a mistake they have
     made, so it is a hint. The refusal is real either way. */
  check("an untouched amount shows a hint", (await amountHint()) === 1, String(await amountHint()));
  check("and no error", (await errors()) === 0, String(await errors()));
  check("while submit stays disabled", await submitDisabled());

  await page.fill(".ops-form .ops-input", "12.345");
  await page.waitForTimeout(250);
  check("a third decimal place is an error", (await errors()) === 1, String(await errors()));
  check(
    "and the sentence says what money is",
    /at most two decimal places/.test(await textOf(page, ".ops-form .ops-field__error", "")),
    await textOf(page, ".ops-form .ops-field__error", "")
  );
  check("the hint gives way to it", (await amountHint()) === 0);
  check("submit is still refused", await submitDisabled());

  await page.fill(".ops-form .ops-input", "0.00");
  await page.waitForTimeout(250);
  check(
    "zero is refused in the module's own words",
    /greater than zero/.test(await textOf(page, ".ops-form .ops-field__error", "")),
    await textOf(page, ".ops-form .ops-field__error", "")
  );

  await page.fill(".ops-form .ops-input", dollars(remaining + 100));
  await page.waitForTimeout(250);
  const overError = await textOf(page, ".ops-form .ops-field__error", "");
  check("more than the balance is refused", overError.length > 0, overError.slice(0, 48));
  /* Stating the ceiling beside the input is what turns a refusal into
     something the visitor could have avoided. */
  check("and the refusal names the balance", overError.includes(block[2].value), overError.slice(0, 64));
  check("submit is refused with it", await submitDisabled());

  const cents = Math.max(1, Math.floor(remaining / 2));
  const beforeRecord = reader ? await contractOf(reader, contractId) : null;
  await page.bringToFront();
  await page.fill(".ops-form .ops-input", dollars(cents));
  await page.waitForTimeout(300);
  check("a partial payment is accepted", (await errors()) === 0);
  check("and submit opens", !(await submitDisabled()));

  await page.click('.ops-form button[type="submit"]');
  await page
    .waitForFunction(() => !document.querySelector(".ops-form"), null, POLL)
    .catch(() => {});
  await page.waitForFunction(
    () => document.querySelector(".ops-leads__count")?.textContent?.trim() === "27 payments",
    null,
    POLL
  );
  await page.waitForTimeout(600);

  check("the list grows to 27", (await countOf(page)) === "27 payments", await countOf(page));
  const confirmation = await announcementOf(page);
  check("the confirmation names the amount", confirmation.includes(`USD ${dollars(cents)}`), confirmation);
  check("and the agreement it was filed against", confirmation.includes(contractId), confirmation);
  /* The new payment is settled on arrival, so what is outstanding is unchanged
     while the denominator moves. */
  check(
    "the outstanding figure keeps its eight and gains a denominator",
    /across 8 of 27 payments$/.test(await summaryOf(page)),
    await summaryOf(page)
  );

  section("THE CONTRACT FOLLOWS - SPEC WORKFLOW W3");
  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    const afterRecord = await contractOf(reader, contractId);
    check(
      "the contract's paid amount rose by exactly the cents recorded",
      afterRecord.paidAmount === beforeRecord.paidAmount + cents,
      `${beforeRecord.paidAmount} + ${cents} vs ${afterRecord.paidAmount}`
    );
    /* What a contract is worth is a function of its rate and its period. A
       payment is not allowed to touch it. */
    check(
      "and what the contract is worth did not move",
      afterRecord.totalAmount === beforeRecord.totalAmount,
      `${beforeRecord.totalAmount} vs ${afterRecord.totalAmount}`
    );

    const ledger = await readLedger(reader);
    check("27 payments are stored", ledger.payments.length === 27, String(ledger.payments.length));
    const written = ledger.payments.find((p) => p.id === "payment_0027") ?? {};
    check("the new record takes the next id", Boolean(written.id), String(written.id));
    check("it is against the same contract", written.contractId === contractId, String(written.contractId));
    check("for the cents that were typed", written.amount === cents, `${written.amount} vs ${cents}`);
    check("stored as Paid", written.status === "Paid", written.status);
    check("and stamped with when", Boolean(written.paidAt), String(written.paidAt));
    check("the contract count is untouched", ledger.contracts === 14, String(ledger.contracts));

    /* The crossing. Contracts is a different module reading the same records,
       and it has to show the movement without being told about it. */
    await page.bringToFront();
    await page.goto(`${CONTRACTS}?selected=${contractId}`, { waitUntil: "networkidle" });
    await waitForDetail(page);
    await page.waitForTimeout(500);
    const money = await factsOf(page, "Money");
    const value = (label) => centsOf(money?.find((f) => f.label === label)?.value ?? "");
    check("the contract drawer opens on the same record", (await textOf(page, ".ops-detail__id")) === contractId, await textOf(page, ".ops-detail__id"));
    check("its Paid figure is the new one", value("Paid") === afterRecord.paidAmount, `${value("Paid")} vs ${afterRecord.paidAmount}`);
    check(
      "and the remaining balance came down by the same cents",
      value("Remaining balance") === remaining - cents,
      `${value("Remaining balance")} vs ${remaining - cents}`
    );
    check(
      "with the total unchanged",
      value("Total") === beforeRecord.totalAmount,
      `${value("Total")} vs ${beforeRecord.totalAmount}`
    );

    await ctx.close();
  }
}

/* =====================================================================
   7. VOCABULARY

   This module is accounting-state simulation and its wording is load-bearing.
   "Record payment" is the whole vocabulary and it is accurate, because
   recording is all that happens: no provider is contacted, no instrument is
   asked for, and nothing here processes anything.
   ===================================================================== */

section("VOCABULARY - A LEDGER, NOT A TERMINAL");
{
  const { ctx, page } = await fresh();

  const FORBIDDEN =
    /charge|process card|pay now|card number|iban|cvv|bank account|sort code|payment provider/i;

  const list = await page.content();
  check("the list uses none of the terminal words", !FORBIDDEN.test(list), (FORBIDDEN.exec(list) ?? [""])[0]);

  await openPayment(page, "payment_0016");
  const drawer = await page.content();
  check("nor does the drawer", !FORBIDDEN.test(drawer), (FORBIDDEN.exec(drawer) ?? [""])[0]);
  await closeDrawer(page);

  await page.click(RECORD_BUTTON);
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(400);
  const form = await page.content();
  check("nor the form that writes money", !FORBIDDEN.test(form), (FORBIDDEN.exec(form) ?? [""])[0]);
  /* The positive half. The form says what it is doing instead of leaving the
     visitor to assume. */
  check(
    "which says plainly what it writes",
    /synthetic accounting record/.test(await textOf(page, ".ops-form .ops-payments__note", "")),
    (await textOf(page, ".ops-form .ops-payments__note", "")).slice(0, 56)
  );
  check(
    "and that nothing leaves the browser",
    /nothing leaves this browser/.test(await textOf(page, ".ops-form .ops-payments__note", ""))
  );
  check(
    "the one button is Record payment",
    (await textOf(page, '.ops-form button[type="submit"]')) === "Record payment",
    await textOf(page, '.ops-form button[type="submit"]')
  );

  await ctx.close();
}

/* =====================================================================
   8. SELECTION AND THE DRAWER
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
  check("the URL carries the selection", page.url().includes("?selected=payment_"), page.url().split("?")[1] ?? "");
  check("the drawer is a dialog", (await page.$("dialog[open]")) !== null);

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
  check("a shared link opens the same payment", (await textOf(page, ".ops-detail__title")) === name);

  await page.goto(`${PAYMENTS}?selected=payment_9999`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForTimeout(400);
  check("an unknown id is explained", (await page.$(".ops-detail__missing")) !== null);
  check(
    "and the id is quoted back",
    (await textOf(page, ".ops-detail__missing")).includes("payment_9999")
  );

  /* An overdue payment, because it is the only record on which the stored and
     effective values disagree, and that disagreement is the module. */
  await openPayment(page, "payment_0016");
  const sections = await page.$$eval(".ops-detail__section-title", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check(
    "a payment is grouped as payment, status and activity",
    sections.join(",") === "Payment,Status,Activity",
    sections.join(",")
  );

  const marks = await marksOf(page);
  check("the header carries the effective status", marks.includes("Overdue"), marks.join(" "));
  check("its category", marks.some((m) => /^(Rental|Deposit|Adjustment)$/.test(m)), marks.join(" "));
  check("and whether the money is down yet", marks.includes("Awaiting payment"), marks.join(" "));

  const status = await factsOf(page, "Status");
  check(
    "the Status section prints both values",
    status !== null && status.map((f) => f.label).join(",") === "Stored,Effective",
    status ? status.map((f) => f.label).join(",") : "no section"
  );
  check(
    "and they are allowed to disagree",
    status?.find((f) => f.label === "Stored")?.value === "Pending" &&
      status?.find((f) => f.label === "Effective")?.value === "Overdue",
    status?.map((f) => `${f.label}=${f.value}`).join(" ") ?? ""
  );
  const note = await textOf(page, ".ops-payments__note", "");
  check("with the sentence that explains why", /Overdue is worked out on every read/.test(note), note.slice(0, 60));
  check("naming the clock it is compared against", /demo/.test(note) && /clock/.test(note));

  const facts = await factsOf(page, "Payment");
  check(
    "the payment section states the seven facts",
    facts?.map((f) => f.label).join(",") ===
      "Customer,Contract,Amount,Category,Due date,Paid date,Updated",
    facts?.map((f) => f.label).join(",") ?? ""
  );
  check(
    "an unsettled payment has no paid date",
    facts?.find((f) => f.label === "Paid date")?.value === "Not recorded",
    facts?.find((f) => f.label === "Paid date")?.value ?? ""
  );

  /* Both roles that open Payments also open Customers and Contracts, so both
     relationships are doors here and the id-only fallback is unreachable
     through the product (D-092). */
  check(
    "Admin may walk through to the customer",
    (await page.$('.ops-overlay--drawer a[href*="/customers?selected="]')) !== null
  );
  check(
    "and to the contract the payment belongs to",
    (await page.$('.ops-overlay--drawer a[href*="/contracts?selected="]')) !== null
  );
  check("so no id is left merely quoted", (await page.$(".ops-detail__ref")) === null);

  /* The absence this drawer is designed around. The ledger is append-only: the
     domain has no update and no delete for a single payment, and a balance
     moves by recording another one. A button here would be a promise the
     services cannot keep. */
  check("a payment offers no actions at all", (await page.$(".ops-detail__buttons")) === null);
  check("and none are hiding elsewhere in it", (await actionsOf(page)).length === 0);

  check("the drawer console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   9. ROLE

   Two roles work this module and two do not open it at all. A Sales Agent
   works the pipeline and a Fleet Coordinator works the vehicles, and neither
   has any business in the ledger, so the module is closed rather than shown
   inert.
   ===================================================================== */

section("ROLE - TWO WORK THE LEDGER, TWO NEVER SEE IT");
{
  const { ctx, page } = await fresh();

  check(
    "the sidebar offers Admin all eleven modules",
    (await countIn(page, ".ops-sidebar a")) === 11,
    String(await countIn(page, ".ops-sidebar a"))
  );
  /* The build-state mechanism is gone, so a pending item is not merely absent
     from this role's navigation: the class does not exist any more. */
  check("and no module is left marked pending", (await countIn(page, ".ops-sidebar__item--pending")) === 0);

  for (const role of ["Finance Analyst", "Admin"]) {
    await closeOverlays(page);
    await choose(page, ROLE_SELECT, role);
    await page.waitForTimeout(900);
    check(`${role} keeps the module`.slice(0, 58), (await page.$(".ops-payments")) !== null);
    check(`${role} counts 26`.slice(0, 58), (await countOf(page)) === "26 payments", await countOf(page));
    check(`${role} may record`.slice(0, 58), (await page.$(RECORD_BUTTON)) !== null);
    check(
      `${role} still reads the outstanding total`.slice(0, 58),
      /outstanding across 8 of 26/.test(await summaryOf(page)),
      await summaryOf(page)
    );
  }

  for (const role of ["Sales Agent", "Fleet Coordinator"]) {
    await closeOverlays(page);
    await choose(page, ROLE_SELECT, role);
    await page.waitForTimeout(900);
    check(`${role} is closed out`.slice(0, 58), (await page.$(".ops-unavailable")) !== null);
    check(`${role} loses the module root`.slice(0, 58), (await page.$(".ops-payments")) === null);
    const text = await textOf(page, ".ops-unavailable__text", "");
    check(`${role} is told why, by name`.slice(0, 58), text.includes(role), text.slice(0, 56));
    check(
      `${role} is told which roles do open it`.slice(0, 58),
      /Admin or Finance Analyst/.test(text),
      text.slice(0, 56)
    );
    check(`${role} sees no row`.slice(0, 58), (await countIn(page, ".ops-leads__row")) === 0);
    check(`${role} sees no card`.slice(0, 58), (await countIn(page, ".ops-leadcard")) === 0);
    check(`${role} is offered no create`.slice(0, 58), (await page.$(RECORD_BUTTON)) === null);
    /* Contained rather than redirected, and containment has to be complete:
       no figure and no id may be left behind on the page. */
    const content = await page.$eval(".ops-content", (e) => e.textContent);
    check(`${role} keeps no payment id`.slice(0, 58), !/payment_\d{4}/.test(content));
    check(`${role} keeps no money on screen`.slice(0, 58), !/USD \d/.test(content));
    check(
      `${role} loses Payments from the sidebar`.slice(0, 58),
      (await countIn(page, '.ops-sidebar a[href$="/payments"]')) === 0
    );
  }

  await closeOverlays(page);
  await choose(page, ROLE_SELECT, "Admin");
  await page.waitForTimeout(900);
  check("Admin gets the ledger back", (await countOf(page)) === "26 payments", await countOf(page));
  check("and the create button with it", (await page.$(RECORD_BUTTON)) !== null);

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
  check(`${w}: cards take over`, (await countIn(page, ".ops-leadcard")) === 10);
  check(
    `${w}: nothing overflows sideways`,
    (await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )) <= 0
  );

  const card = await page.$eval(".ops-leadcard", (e) => e.textContent.replace(/\s+/g, " ").trim());
  check(`${w}: a card carries the contract`, /contract_\d{4}/.test(card), card.slice(0, 48));
  /* The amount and the status together are the decision a person makes between
     two rows; everything else about a payment is reference. */
  check(`${w}: the amount`, /USD \d+\.\d{2}/.test(card), card.slice(0, 48));
  check(`${w}: and when it fell due`, /Due \d{4}-\d{2}-\d{2}/.test(card), card.slice(-28));

  await page.click(".ops-leads__filter-button");
  await page.waitForSelector(".ops-overlay--sheet", POLL);
  await page.waitForTimeout(300);
  check(`${w}: filters open in a sheet`, (await textOf(page, ".ops-sheet__title")) === "Filter and sort");
  check(
    `${w}: status, category and sort are all there`,
    (await countIn(page, '.ops-overlay--sheet [role="combobox"]')) === 3
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
  check(`${w}: rather than leaving the module`, page.url().includes("/demos/operations/payments"));

  await page.click(RECORD_BUTTON);
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(400);
  const sheet = await page.evaluate(() => {
    const dialog = document.querySelector(".ops-overlay--sheet");
    const submit = document.querySelector('.ops-form button[type="submit"]');
    const body = document.querySelector(".ops-sheet__body");
    return {
      width: dialog.getBoundingClientRect().width,
      submitTop: submit.getBoundingClientRect().top,
      submitBottom: submit.getBoundingClientRect().bottom,
      bodyOverflow: body ? body.scrollWidth - body.clientWidth : 0,
    };
  });
  check(`${w}: the record sheet fits the phone`, sheet.width <= w, String(Math.round(sheet.width)));
  /* Reachable without a hunt: the footer is pinned, so the one button that
     commits the change is on screen the moment the sheet opens. */
  check(
    `${w}: its submit is on screen`,
    sheet.submitTop >= 0 && sheet.submitBottom <= h + 1,
    `${Math.round(sheet.submitTop)} to ${Math.round(sheet.submitBottom)} in ${h}`
  );
  check(`${w}: and the body does not overflow sideways`, sheet.bodyOverflow <= 1, String(sheet.bodyOverflow));
  await closeSheet(page);

  check(`${w}: the mobile console is clean`, problems.length === 0, problems.join(" | ").slice(0, 100));
  await ctx.close();
}

/* =====================================================================
   11. PAGE GROWTH, NOT THE INBOX LOCK

   The Inbox owns the fixed-viewport workspace. Payments must grow with its
   content like every other list module, and must not have picked up the
   `:has(.ops-inbox)` rules by accident. Measured, and captured full page,
   because the Inbox defect was invisible to a viewport screenshot.
   ===================================================================== */

section("CONTAINMENT - A NORMAL PAGE-GROWTH MODULE");
{
  const { PNG } = await import("pngjs");
  const fs = await import("node:fs");
  const DIR = "qa/shots/stage09c44";
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
      const last = [...document.querySelectorAll(".ops-payments *")]
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
     The visually hidden heading and the live region are both absolutely
     positioned, so the module root has to establish its own containing block
     or they resolve against the site shell. */
  {
    const { ctx, page } = await fresh({ width: 1440, height: 900 });
    const escaped = await page.evaluate(() => {
      const root = document.querySelector(".ops-payments");
      const stray = [];
      for (const el of document.querySelectorAll(".ops-payments *")) {
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
   12. PRESENTATION AND CONTENT RULES
   ===================================================================== */

section("PRESENTATION - CONTRAST, FOCUS AND CONTENT");
{
  const { ctx, page } = await fresh();
  await openPayment(page, "payment_0016");

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

  /* Scoped to the table and the drawer. The card list is still in the DOM
     behind `display: none` at this width, and sampling it would measure type
     nobody can see. */
  const samples = await page.$$eval(
    ".ops-leads__table .ops-payments__money, .ops-leads__table .ops-payments__contract," +
      ".ops-leads__table .ops-payments__category, .ops-leads__table .ops-leads__date," +
      ".ops-leads__table .ops-pill, .ops-payments__summary, .ops-payments__summary strong," +
      ".ops-payments__note, .ops-detail__marks .ops-pill, .ops-facts__label," +
      ".ops-facts__value, .ops-detail__interest, .ops-detail__id",
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

  /* Status never depends on colour alone: the pill says the word. Overdue is
     peach rather than red, because a late payment is an ordinary thing for a
     finance analyst to work through and not an incident. */
  await closeDrawer(page);
  await choose(page, PAGE_SIZE, "20");
  await page.waitForTimeout(300);
  const pills = await cellsOf(page, ".ops-pill");
  check(
    "every status pill carries its own word",
    pills.length === 20 && pills.every((p) => /^(Paid|Pending|Overdue)$/.test(p)),
    pills.slice(0, 4).join(",")
  );
  check(
    "and the tone is a second reading of it",
    (await page.$$eval(".ops-leads__table .ops-pill", (n) =>
      n.every((e) => /ops-pill--(mint|slate|peach)/.test(e.className))
    ))
  );

  /* The standing content rules, read off the rendered page. */
  const html = await page.content();
  check("no mailto link", !/mailto:/i.test(html));
  check("no tel link", !/\btel:\+?\d/i.test(html));
  check("no email address", !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html));
  check("no telephone number", !/\+\d[\d\s().-]{7,}\d/.test(html));
  check("no messenger channel", !/whatsapp|telegram|discord|\bsms\b/i.test(html));
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
  check("and the caption states the order", /sorted by due date/.test(semantics.caption), semantics.caption.slice(0, 50));
  /* One announcement, not several. The shell owns a second live region for
     role changes and reset, which is why this is scoped to the module. */
  check(
    "the module announces through exactly one live region",
    (await countIn(page, '.ops-payments [role="status"][aria-live="polite"]')) === 1,
    String(await countIn(page, '.ops-payments [role="status"][aria-live="polite"]'))
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
   13. RESET

   Last, because it is the only section that has to be sure nothing after it
   depends on what it destroyed. What is restored here is a change the product
   actually made: a payment recorded through the form, and the three
   automation runs and three notifications the module raised on entry.
   ===================================================================== */

section("RESET - THE CANONICAL LEDGER RETURNS");
{
  const { ctx, page } = await fresh();
  await waitForReconcile(page);
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    await page.bringToFront();
    await page.click(RECORD_BUTTON);
    await page.waitForSelector(".ops-form", POLL);
    await page.waitForTimeout(400);
    const block = await balanceOf(page);
    const remaining = centsOf(block[2]?.value) ?? 0;
    await page.fill(".ops-form .ops-input", dollars(Math.max(1, Math.floor(remaining / 3))));
    await page.waitForTimeout(300);
    await page.click('.ops-form button[type="submit"]');
    await page.waitForFunction(
      () => document.querySelector(".ops-leads__count")?.textContent?.trim() === "27 payments",
      null,
      POLL
    );
    await page.waitForTimeout(700);

    const dirty = await readLedger(reader);
    check("the ledger is out of its canonical shape", dirty.payments.length === 27, String(dirty.payments.length));
    check("with the recorded payment in it", dirty.payments.some((p) => p.id === "payment_0027"));
    check("and the module's own runs alongside", dirty.runs.length === 21, String(dirty.runs.length));
    check("and its notifications", dirty.notes.length === 25, String(dirty.notes.length));

    /* Reset through the product's own control. Every overlay has to go first:
       they are modal dialogs and the chrome behind them cannot be clicked. */
    await page.bringToFront();
    await closeOverlays(page);
    await page.click('.demo-chrome button:has-text("Reset")');
    await page.waitForSelector("dialog[open]", POLL);
    await page.click('dialog[open] button:has-text("Reset demo")');
    await page.waitForTimeout(3000);

    const after = await readLedger(reader);
    check("26 payments return", after.payments.length === 26, String(after.payments.length));
    check(
      "in the canonical stored split",
      JSON.stringify(after.paymentTally) === JSON.stringify({ Paid: 18, Pending: 8 }),
      JSON.stringify(after.paymentTally)
    );
    check("the recorded payment is gone", !after.payments.some((p) => p.id === "payment_0027"));
    check("14 contracts return", after.contracts === 14, String(after.contracts));
    check("18 automation runs return", after.runs.length === 18, String(after.runs.length));
    check("22 notifications return", after.notes.length === 22, String(after.notes.length));
    /* The three Finance alerts the module raised are gone with them, which is
       what makes a second entry raise them again rather than skip them. */
    check(
      "and no overdue alert survives the reset",
      after.notes.filter((n) => n.title === "Payment overdue").length === 0,
      String(after.notes.filter((n) => n.title === "Payment overdue").length)
    );

    await page.bringToFront();
    await page.waitForTimeout(600);
    check("the screen shows the restored ledger", (await countOf(page)) === "26 payments", await countOf(page));
    check(
      "and the outstanding figure is canonical again",
      /outstanding across 8 of 26 payments$/.test(await summaryOf(page)),
      await summaryOf(page)
    );

    await ctx.close();
  }
}

await browser.close();

console.log(
  `\n=== stage 09C4.4 payments: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
