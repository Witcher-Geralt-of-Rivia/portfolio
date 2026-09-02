/**
 * Stage 09C3.2 - Operations Customers QA.
 *
 * The same two layers as the Leads suite. The DOMAIN part drives the real
 * bundled services through the QA probe, because the rules this stage settled
 * (an edit audits every field that moved, an archive is refused while a rental
 * is live) must hold whether or not a screen remembers to ask. The UI part
 * drives the product, including the parts of it that depend on which role is
 * selected.
 *
 * Both need a route that only exists during a QA run:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c32-customers.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host
 * and 3100 is this portfolio's live production.
 *
 * Against production the domain section is skipped automatically, because the
 * probe route is not deployed:
 *
 *   QA_BASE=https://intelligent-systems-lab.duckdns.org node qa/stage09c32-customers.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const CUSTOMERS = `${BASE}/demos/operations/customers`;
const PROBE = `${BASE}/demos/qa-operations`;

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

/* Playwright polls on requestAnimationFrame by default and this application
   schedules no frames at rest, so every wait states its own interval. */
const POLL = { polling: 100, timeout: 20000 };

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

const browser = await chromium.launch();

/** A page on the Customers route with the list rendered and the seed untouched. */
async function freshCustomers(viewport = { width: 1440, height: 900 }, path = CUSTOMERS) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__count", POLL);
  await page.waitForFunction(
    () => document.querySelector(".ops-leads__count")?.textContent.trim() !== "",
    null,
    POLL
  );
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll(".ops-leads__row").length > 0 ||
        document.querySelectorAll(".ops-leadcard").length > 0,
      null,
      POLL
    )
    .catch(() => {});
  return { ctx, page, problems };
}

/**
 * Wait for the drawer to actually hold a record.
 *
 * It opens before the customer is read, so `.ops-detail__title` is present
 * while the content is still arriving. The id only exists once the record is
 * in hand, and the unavailable panel is the other settled outcome.
 */
const waitForDetail = (page) =>
  page.waitForFunction(
    () =>
      Boolean(document.querySelector(".ops-detail__id")) ||
      Boolean(document.querySelector(".ops-detail__missing")),
    null,
    POLL
  );

/** Choose a value from one of the product's custom selects. */
async function choose(page, trigger, value) {
  await page.click(trigger);
  await page.waitForSelector('[role="listbox"]', POLL);
  await page.click(`[role="listbox"] [role="option"][data-value="${value}"]`);
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, POLL);
  await page.waitForTimeout(120);
}

/** The filter triggers, in toolbar order: status, segment, sort. */
const FILTER = (n) => `.ops-leads__filters .demo-select__trigger >> nth=${n}`;
const PAGE_SIZE = ".ops-pager__size .demo-select__trigger";
const ROLE_SELECT = ".ops-role__select .demo-select__trigger";

const countOf = (page) => page.$eval(".ops-leads__count", (e) => e.textContent.trim());
const namesOf = (page) =>
  page.$$eval(".ops-leads__name", (n) => n.map((e) => e.textContent.trim()));
const columnsOf = (page) =>
  page.$$eval(".ops-customers__table thead th", (n) => n.map((e) => e.textContent.replace(/[^A-Za-z ]/g, "").trim()));

/* =====================================================================
   1. DOMAIN - the rules hold without a screen
   ===================================================================== */

/** Filled by the domain section, read by the UI section if it ran. */
let blockedCustomer = null;

section("DOMAIN - SEED, AUDIT AND GUARDS");
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
      const ops = P.operations;
      const admin = ops.contextAs(rt, "Admin");
      const sales = ops.contextAs(rt, "Sales Agent");
      const finance = ops.contextAs(rt, "Finance Analyst");
      const fleet = ops.contextAs(rt, "Fleet Coordinator");
      const code = async (fn) => {
        try {
          await fn();
          return "no-error";
        } catch (e) {
          return P.isDemoError(e) ? e.code : "unknown";
        }
      };
      const message = async (fn) => {
        try {
          await fn();
          return "";
        } catch (e) {
          return e && e.message ? e.message : "";
        }
      };

      const seeded = await rt.repository.all("customers");
      const contracts = await rt.repository.all("contracts");
      const reservations = await rt.repository.all("reservations");

      /* A customer the domain must refuse to archive, named here so the UI
         section can drive the same refusal through the product. */
      const activeContract = contracts.find((c) => c.data.status === "Active");
      const blocked = seeded.find((c) => c.id === activeContract?.data.customerId);

      /* --- create ---------------------------------------------------- */
      const created = await ops.customers.createCustomer(admin, {
        displayName: "  QA Customer  ",
        segment: "Business",
        notes: "Created by the QA harness.",
      });
      const createEntry = (await rt.listAudit()).find(
        (e) => e.entityId === created.id && e.action === "customer.created"
      );

      const blankName = await code(() =>
        ops.customers.createCustomer(admin, { displayName: "   ", segment: "Standard" })
      );
      const financeCreate = await code(() =>
        ops.customers.createCustomer(finance, { displayName: "QA Finance", segment: "Standard" })
      );
      const fleetCreate = await code(() =>
        ops.customers.createCustomer(fleet, { displayName: "QA Fleet", segment: "Standard" })
      );
      const salesCreate = await code(() =>
        ops.customers.createCustomer(sales, { displayName: "QA Sales", segment: "Standard" })
      );

      /* --- update audits every field that moved ---------------------- */
      const renamed = await ops.customers.updateCustomer(admin, created.id, {
        displayName: "QA Customer Renamed",
        notes: "Rewritten by the QA harness.",
        segment: "Frequent",
        status: "Inactive",
      });
      const renameEntry = (await rt.listAudit()).find(
        (e) => e.entityId === created.id && e.action === "customer.updated"
      );
      const renameFields = (renameEntry?.changes ?? []).map((c) => c.field).sort();

      /* Resubmitting the same values must write nothing. */
      const auditBefore = (await rt.listAudit()).length;
      await ops.customers.updateCustomer(admin, created.id, {
        displayName: "QA Customer Renamed",
        notes: "Rewritten by the QA harness.",
        segment: "Frequent",
        status: "Inactive",
      });
      const auditAfter = (await rt.listAudit()).length;

      const missingUpdate = await code(() =>
        ops.customers.updateCustomer(admin, "cus-does-not-exist", { status: "Active" })
      );
      const financeUpdate = await code(() =>
        ops.customers.updateCustomer(finance, created.id, { status: "Active" })
      );
      const emptyRename = await code(() =>
        ops.customers.updateCustomer(admin, created.id, { displayName: "  " })
      );

      /* --- archive guards -------------------------------------------- */
      const blockedId = activeContract?.data.customerId ?? "cus-001";
      const contractRefusal = await message(() =>
        ops.customers.archiveCustomer(admin, blockedId)
      );
      const contractCode = await code(() => ops.customers.archiveCustomer(admin, blockedId));

      const confirmed = reservations.find(
        (r) =>
          r.data.status === "Confirmed" &&
          !contracts.some(
            (c) => c.data.customerId === r.data.customerId && c.data.status === "Active"
          )
      );
      const reservationRefusal = confirmed
        ? await message(() => ops.customers.archiveCustomer(admin, confirmed.data.customerId))
        : "";

      const archived = await ops.customers.archiveCustomer(admin, created.id);
      const twice = await code(() => ops.customers.archiveCustomer(admin, created.id));
      const financeArchive = await code(() => ops.customers.archiveCustomer(finance, "cus-002"));

      /* --- selectors -------------------------------------------------- */
      const all = await rt.repository.all("customers");
      const L = ops.customersList;
      const q = (patch) => L.selectCustomerList(all, { ...L.DEFAULT_CUSTOMER_QUERY, ...patch });

      const unfiltered = q({});
      const byName = q({ sort: "name", direction: "asc" });
      const byNameDesc = q({ sort: "name", direction: "desc" });
      const activeOnly = q({ status: "Active" });
      const business = q({ segment: "Business" });
      const searchMiss = q({ search: "zzzzz-no-such-customer" });
      const searchName = q({ search: all[0].data.displayName.slice(0, 6) });
      const overPage = q({ page: 99 });
      const bigPage = q({ pageSize: 50 });

      const R = ops.customerRelations;
      const counts = R.selectCustomerCounts(contracts, reservations);
      const contractCustomer = activeContract?.data.customerId ?? "";
      const convertedRecord = all.find((c) => c.data.sourceLeadId);
      const relations = R.selectCustomerRelations({
        customer: convertedRecord,
        leads: await rt.repository.all("leads"),
        reservations,
        contracts,
        payments: await rt.repository.all("payments"),
        conversations: await rt.repository.all("conversations"),
        vehicles: await rt.repository.all("vehicles"),
        audit: await rt.listAudit(),
        now: rt.now(),
      });

      return {
        seededTotal: seeded.length,
        converted: seeded.filter((c) => c.data.sourceLeadId).length,
        seededArchived: seeded.filter((c) => c.data.archived).length,
        unnamed: seeded.filter((c) => !c.data.displayName.trim()).length,
        createdName: created.data.displayName,
        createdStatus: created.data.status,
        createdArchived: created.data.archived,
        createEntry: Boolean(createEntry),
        createSummary: createEntry?.summary ?? "",
        blankName,
        financeCreate,
        fleetCreate,
        salesCreate,
        renamedName: renamed.data.displayName,
        renameFields,
        noopWrote: auditAfter - auditBefore,
        missingUpdate,
        financeUpdate,
        emptyRename,
        contractRefusal,
        contractCode,
        reservationRefusal,
        archivedFlag: archived.data.archived,
        archivedStatus: archived.data.status,
        twice,
        financeArchive,
        blockedId: blocked?.id ?? null,
        blockedName: blocked?.data.displayName ?? null,
        listTotal: unfiltered.total,
        listPage: unfiltered.items.length,
        listPageCount: unfiltered.pageCount,
        firstByName: byName.items[0]?.data.displayName ?? "",
        lastByName: byNameDesc.items[0]?.data.displayName ?? "",
        activeOnly: activeOnly.items.every((c) => c.data.status === "Active"),
        businessOnly: business.items.every((c) => c.data.segment === "Business"),
        searchMiss: searchMiss.total,
        searchHit: searchName.total,
        overPage: overPage.page,
        bigPage: bigPage.items.length,
        countsSize: counts.size,
        contractCount: counts.get(contractCustomer)?.contracts ?? 0,
        relationLead: relations.sourceLead?.id ?? null,
        relationLeadIsSource: relations.sourceLead?.id === convertedRecord.data.sourceLeadId,
        relationActivity: Array.isArray(relations.activity),
      };
    });

    blockedCustomer = out.blockedId ? { id: out.blockedId, name: out.blockedName } : null;

    check("seed holds 32 customers", out.seededTotal === 32, String(out.seededTotal));
    check("exactly 6 carry a source lead", out.converted === 6, String(out.converted));
    check("no seeded customer is archived", out.seededArchived === 0, String(out.seededArchived));
    check("every seeded customer is named", out.unnamed === 0, String(out.unnamed));

    check("create trims the name", out.createdName === "QA Customer", out.createdName);
    check("create defaults to Active", out.createdStatus === "Active", out.createdStatus);
    check("a new customer is not archived", out.createdArchived === false);
    check("create writes an audit entry", out.createEntry);
    check("the entry names the customer", out.createSummary.includes("QA Customer"));
    check("a blank name is refused", out.blankName === "VALIDATION", out.blankName);
    check("read-only Finance cannot create", out.financeCreate === "FORBIDDEN", out.financeCreate);
    check("Fleet cannot create", out.fleetCreate === "FORBIDDEN", out.fleetCreate);
    check("Sales can create", out.salesCreate === "no-error", out.salesCreate);

    check("the rename lands", out.renamedName === "QA Customer Renamed", out.renamedName);
    check(
      "the edit audits every field that moved",
      out.renameFields.join(",") === "displayName,notes,segment,status",
      out.renameFields.join(",")
    );
    check("an unchanged resubmit writes nothing", out.noopWrote === 0, String(out.noopWrote));
    check("editing a missing customer is NOT_FOUND", out.missingUpdate === "NOT_FOUND", out.missingUpdate);
    check("read-only Finance cannot edit", out.financeUpdate === "FORBIDDEN", out.financeUpdate);
    check("renaming to blank is refused", out.emptyRename === "VALIDATION", out.emptyRename);

    check("an active contract blocks archiving", out.contractCode === "CONFLICT", out.contractCode);
    check(
      "the refusal says why",
      /active contract/i.test(out.contractRefusal),
      out.contractRefusal
    );
    check(
      "a confirmed reservation blocks archiving",
      out.reservationRefusal === "" || /confirmed reservation/i.test(out.reservationRefusal),
      out.reservationRefusal || "no such customer in seed"
    );
    check("archiving sets the flag", out.archivedFlag === true);
    check("archiving sets Inactive", out.archivedStatus === "Inactive", out.archivedStatus);
    check("archiving twice is a conflict", out.twice === "CONFLICT", out.twice);
    check("read-only Finance cannot archive", out.financeArchive === "FORBIDDEN", out.financeArchive);

    /* 32 seeded plus the one Sales created, less the archived QA record. */
    check("the list excludes archived customers", out.listTotal === 33, String(out.listTotal));
    check("a page holds ten", out.listPage === 10, String(out.listPage));
    check("33 over 10 is four pages", out.listPageCount === 4, String(out.listPageCount));
    check(
      "name ascending and descending are opposite ends",
      out.firstByName !== "" && out.firstByName !== out.lastByName,
      `${out.firstByName} / ${out.lastByName}`
    );
    check("the status filter holds", out.activeOnly);
    check("the segment filter holds", out.businessOnly);
    check("a search with no match returns none", out.searchMiss === 0, String(out.searchMiss));
    check("a search on a real name matches", out.searchHit >= 1, String(out.searchHit));
    check("a page past the end clamps", out.overPage === 4, String(out.overPage));
    check("a larger page size returns more", out.bigPage === 33, String(out.bigPage));

    check("counts are derived per customer", out.countsSize > 0, String(out.countsSize));
    check("the blocked customer has a contract", out.contractCount >= 1, String(out.contractCount));
    check("a converted customer resolves its lead", out.relationLead !== null, String(out.relationLead));
    check("and resolves the right one", out.relationLeadIsSource);
    check("relations carry an activity trail", out.relationActivity);
  }

  await ctx.close();
}

/* =====================================================================
   2. THE LIST
   ===================================================================== */

section("LIST - DESKTOP, ADMIN");
{
  const { ctx, page, problems } = await freshCustomers();

  check("the route renders the module", (await page.$(".ops-customers")) !== null);
  check("32 customers are counted", (await countOf(page)) === "32 customers", await countOf(page));
  check("the console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));

  const columns = await columnsOf(page);
  check(
    "Admin sees every column",
    columns.join(",") === "Customer,Status,Segment,Origin,Contracts,Reservations,Updated",
    columns.join(",")
  );

  const rows = await page.$$eval(".ops-leads__row", (n) => n.length);
  check("ten rows on the first page", rows === 10, String(rows));

  const range = await page.$eval(".ops-pager__range", (e) => e.textContent.trim());
  check("the range reads 1 to 10 of 32", /1.{1,3}10 of 32/.test(range), range);
  const pageLabel = await page.$eval(".ops-pager__page", (e) => e.textContent.trim());
  check("the page reads 1 of 4", pageLabel === "Page 1 of 4", pageLabel);

  /* --- search ------------------------------------------------------- */
  const firstName = (await namesOf(page))[0];
  await page.fill(".ops-leads__search-input", firstName.slice(0, 8));
  await page.waitForTimeout(200);
  const narrowed = await countOf(page);
  check("search narrows the list", narrowed !== "32 customers", narrowed);
  const narrowedNames = await namesOf(page);
  check(
    "and every row matches",
    narrowedNames.every((n) => n.toLowerCase().includes(firstName.slice(0, 8).toLowerCase())),
    narrowedNames.slice(0, 2).join(" / ")
  );

  await page.fill(".ops-leads__search-input", "zzzz-nothing-here");
  await page.waitForTimeout(200);
  check("an empty result explains itself", (await page.$(".ops-leads__empty")) !== null);
  await page.click(".ops-leads__empty .ops-button");
  await page.waitForTimeout(200);
  check("clearing filters restores the list", (await countOf(page)) === "32 customers");

  /* --- filters ------------------------------------------------------ */
  await choose(page, FILTER(0), "Inactive");
  const inactive = await countOf(page);
  check("the status filter runs", inactive !== "32 customers", inactive);
  const pills = await page.$$eval(".ops-leads__row .ops-pill", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("and every row is Inactive", pills.every((p) => p === "Inactive"), pills.join(","));
  await choose(page, FILTER(0), "all");

  await choose(page, FILTER(1), "Business");
  const segments = await page.$$eval(".ops-customers__segment", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check("the segment filter runs", segments.length > 0 && segments.every((s) => s === "Business"), segments.join(","));
  await choose(page, FILTER(1), "all");
  check("clearing both filters restores 32", (await countOf(page)) === "32 customers");

  /* --- sort --------------------------------------------------------- */
  await choose(page, FILTER(2), "name:asc");
  const asc = await namesOf(page);
  await choose(page, FILTER(2), "name:desc");
  const desc = await namesOf(page);
  check("name ascending is sorted", asc.join("|") === [...asc].sort((a, b) => a.localeCompare(b)).join("|"));
  check("descending reverses it", asc[0] !== desc[0], `${asc[0]} / ${desc[0]}`);

  const header = await page.$(".ops-customers__table th .ops-th-sort");
  await header.click();
  await page.waitForTimeout(200);
  const sorted = await page.$eval(
    '.ops-customers__table th[aria-sort]:not([aria-sort="none"])',
    (e) => e.textContent.trim()
  );
  check("a header sorts and says so", sorted.length > 0, sorted);

  /* --- pagination --------------------------------------------------- */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__row", POLL);
  const firstPage = await namesOf(page);
  await page.click('.ops-pager__step:has-text("Next")');
  await page.waitForTimeout(250);
  const secondPage = await namesOf(page);
  check("Next moves to page two", (await page.$eval(".ops-pager__page", (e) => e.textContent.trim())) === "Page 2 of 4");
  check("and the rows change", firstPage[0] !== secondPage[0], `${firstPage[0]} / ${secondPage[0]}`);
  await page.click('.ops-pager__step:has-text("Previous")');
  await page.waitForTimeout(250);
  check("Previous comes back", (await namesOf(page))[0] === firstPage[0]);

  const prevDisabled = await page.$eval('.ops-pager__step:has-text("Previous")', (e) => e.disabled);
  check("Previous is disabled on page one", prevDisabled === true);

  await choose(page, PAGE_SIZE, "20");
  await page.waitForTimeout(250);
  const bigRows = await page.$$eval(".ops-leads__row", (n) => n.length);
  check("20 rows per page is honoured", bigRows === 20, String(bigRows));
  const bigRange = await page.$eval(".ops-pager__range", (e) => e.textContent.trim());
  check("the range follows", /1.{1,3}20 of 32/.test(bigRange), bigRange);
  await choose(page, PAGE_SIZE, "10");

  /* --- no native select anywhere ------------------------------------ */
  const natives = await page.$$eval("select", (n) => n.length);
  check("no native select survives", natives === 0, String(natives));
  const combos = await page.$$eval('[role="combobox"]', (n) => n.length);
  check("the custom selects are comboboxes", combos >= 4, String(combos));

  await ctx.close();
}

/* =====================================================================
   3. THE DRAWER
   ===================================================================== */

section("DETAIL - SELECTION, URL AND CONTENT");
{
  const { ctx, page, problems } = await freshCustomers();

  const name = (await namesOf(page))[0];
  await page.click(".ops-leads__name >> nth=0");
  await waitForDetail(page);
  check("clicking a row opens the drawer", (await page.$(".ops-detail__id")) !== null);
  check("the drawer names the customer", (await page.$eval(".ops-detail__title", (e) => e.textContent.trim())) === name);
  check("the URL carries the selection", page.url().includes("selected="), page.url().split("?")[1] ?? "");
  check("the drawer is a dialog", (await page.$('dialog[open]')) !== null);

  const titles = await page.$$eval(".ops-relation__title", (n) => n.map((e) => e.textContent.trim()));
  check(
    "Admin sees every relationship group",
    titles.join(",") === "Lead origin,Reservations,Contracts,Payments,Conversations",
    titles.join(",")
  );
  check("the overview lists facts", (await page.$$eval(".ops-facts__row", (n) => n.length)) === 5);
  check("activity is present", (await page.$(".ops-activity, .ops-empty")) !== null);
  check("edit and archive are offered", (await page.$$eval(".ops-detail__buttons .ops-button", (n) => n.length)) === 2);

  /* Escape closes and focus returns to the row that opened it. */
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  check("Escape closes the drawer", (await page.$(".ops-detail__id")) === null);
  check("and the URL is clean again", !page.url().includes("selected="), page.url());
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  check("focus returns to the row", focused === name, focused);

  /* A deep link opens the record directly. */
  const third = (await namesOf(page))[2];
  await page.click(".ops-leads__name >> nth=2");
  await waitForDetail(page);
  const url = page.url();
  await page.goto(url, { waitUntil: "networkidle" });
  await waitForDetail(page);
  check("a shared link opens the same customer", (await page.$eval(".ops-detail__title", (e) => e.textContent.trim())) === third, third);

  /* An id that does not exist says so rather than showing an empty drawer. */
  await page.goto(`${CUSTOMERS}?selected=cus-999`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  check("an unknown id is explained", (await page.$(".ops-detail__missing")) !== null);
  const missingText = await page.$eval(".ops-detail__missing", (e) => e.textContent);
  check("and the id is quoted back", missingText.includes("cus-999"), missingText.slice(0, 60));

  check("the drawer console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   4. MUTATIONS THROUGH THE PRODUCT
   ===================================================================== */

section("MUTATIONS - CREATE, EDIT AND ARCHIVE");
{
  const { ctx, page, problems } = await freshCustomers();

  /* --- create ------------------------------------------------------- */
  await page.click('.ops-button--primary:has-text("New customer")');
  await page.waitForSelector(".ops-form", POLL);
  check("the form opens", (await page.$(".ops-sheet__title")) !== null);
  const submitDisabled = await page.$eval('.ops-form button[type="submit"]', (e) => e.disabled);
  check("submit waits for a name", submitDisabled === true);

  await page.fill(".ops-form .ops-input", "QA Screen Customer");
  await choose(page, ".ops-form .demo-select__trigger >> nth=0", "Frequent");
  await page.fill(".ops-textarea", "Written through the product by QA.");
  await page.click('.ops-form button[type="submit"]');
  await waitForDetail(page);
  check(
    "creating opens the new record",
    (await page.$eval(".ops-detail__title", (e) => e.textContent.trim())) === "QA Screen Customer"
  );
  const marks = await page.$$eval(".ops-detail__marks span", (n) => n.map((e) => e.textContent.trim()));
  check("the segment stuck", marks.includes("Frequent"), marks.join(","));
  check("the notes stuck", (await page.$eval(".ops-customers__notes", (e) => e.textContent)).includes("Written through the product"));
  check("it is an established customer", marks.includes("Established customer"), marks.join(","));

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  check("the list grows to 33", (await countOf(page)) === "33 customers", await countOf(page));

  /* --- edit --------------------------------------------------------- */
  await page.fill(".ops-leads__search-input", "QA Screen Customer");
  await page.waitForTimeout(220);
  await page.click(".ops-leads__name >> nth=0");
  await waitForDetail(page);
  const activityBefore = await page.$$eval(".ops-activity__item", (n) => n.length);
  await page.click('.ops-detail__buttons .ops-button:has-text("Edit")');
  await page.waitForSelector(".ops-form", POLL);
  await page.fill(".ops-form .ops-input", "QA Screen Renamed");
  await page.click('.ops-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
  await page.waitForTimeout(250);
  check(
    "the edit lands in the open drawer",
    (await page.$eval(".ops-detail__title", (e) => e.textContent.trim())) === "QA Screen Renamed"
  );
  const activityAfter = await page.$$eval(".ops-activity__item", (n) => n.length);
  check("and the activity records it", activityAfter > activityBefore, `${activityBefore} to ${activityAfter}`);
  const summary = await page.$eval(".ops-activity__summary", (e) => e.textContent);
  check("the entry says what happened", /updated/i.test(summary), summary);

  /* --- archive ------------------------------------------------------ */
  await page.click('.ops-detail__buttons .ops-button:has-text("Archive")');
  await page.waitForSelector(".ops-confirm", POLL);
  check("archiving asks first", (await page.$(".ops-confirm__title")) !== null);
  const confirmBody = await page.$eval(".ops-confirm__body", (e) => e.textContent);
  check("the dialog states the rule", /active contract/i.test(confirmBody), confirmBody.slice(0, 70));
  await page.click('.ops-confirm .ops-button--quiet:has-text("Cancel")');
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  check("cancel leaves the customer alone", (await page.$(".ops-detail__id")) !== null);

  await page.click('.ops-detail__buttons .ops-button:has-text("Archive")');
  await page.waitForSelector(".ops-confirm", POLL);
  await page.click('.ops-confirm .ops-button--primary');
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(300);
  check("archiving closes the drawer", (await page.$(".ops-detail__id")) === null);
  await page.fill(".ops-leads__search-input", "");
  await page.waitForTimeout(250);
  check("and the list is back to 32", (await countOf(page)) === "32 customers", await countOf(page));

  /* A refusal must show the service's own words, not a generic conflict. */
  if (blockedCustomer) {
    await page.goto(`${CUSTOMERS}?selected=${blockedCustomer.id}`, { waitUntil: "networkidle" });
    await waitForDetail(page);
    await page.click('.ops-detail__buttons .ops-button:has-text("Archive")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForSelector(".ops-confirm .ops-alert", POLL);
    const alert = await page.$eval(".ops-confirm .ops-alert", (e) => e.textContent.trim());
    check("a blocked archive is refused in words", /active contract/i.test(alert), alert);
    check("and the dialog stays open to be read", (await page.$(".ops-confirm")) !== null);
    check("the customer is still there", (await page.$(".ops-detail__id")) !== null);
    await page.click('.ops-confirm .ops-button--quiet:has-text("Cancel")');
  } else {
    console.log("  SKIP  blocked customer unknown (domain section did not run)");
  }

  check("the mutation console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
  await ctx.close();
}

/* =====================================================================
   5. ROLE
   ===================================================================== */

section("ROLE - WHAT EACH ONE SEES");
{
  const { ctx, page } = await freshCustomers();

  /* Sales Agent: everything Admin sees except Payments, which it cannot open. */
  await choose(page, ROLE_SELECT, "Sales Agent");
  await page.waitForTimeout(350);
  const salesColumns = await columnsOf(page);
  check(
    "Sales keeps every column",
    salesColumns.join(",") === "Customer,Status,Segment,Origin,Contracts,Reservations,Updated",
    salesColumns.join(",")
  );
  check("Sales may create", (await page.$('.ops-button--primary:has-text("New customer")')) !== null);
  await page.click(".ops-leads__name >> nth=0");
  await waitForDetail(page);
  const salesTitles = await page.$$eval(".ops-relation__title", (n) => n.map((e) => e.textContent.trim()));
  check(
    "Sales sees no Payments group",
    salesTitles.join(",") === "Lead origin,Reservations,Contracts,Conversations",
    salesTitles.join(",")
  );
  check("Sales may edit", (await page.$$eval(".ops-detail__buttons .ops-button", (n) => n.length)) === 2);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);

  /* Finance Analyst: read-only, and blind to Reservations. */
  await choose(page, ROLE_SELECT, "Finance Analyst");
  await page.waitForTimeout(350);
  const financeColumns = await columnsOf(page);
  check(
    "Finance loses the Reservations column",
    financeColumns.join(",") === "Customer,Status,Segment,Origin,Contracts,Updated",
    financeColumns.join(",")
  );
  check("Finance cannot create", (await page.$('.ops-button--primary:has-text("New customer")')) === null);
  await page.click(".ops-leads__name >> nth=0");
  await waitForDetail(page);
  const financeTitles = await page.$$eval(".ops-relation__title", (n) => n.map((e) => e.textContent.trim()));
  check(
    "Finance sees Contracts and Payments, in that order",
    financeTitles.join(",") === "Contracts,Payments",
    financeTitles.join(",")
  );
  check("Finance is offered no write action", (await page.$(".ops-detail__buttons")) === null);
  const financeLinks = await page.$$eval(".ops-relation__list a, .ops-relation__line a", (n) => n.length);
  check("and no link into Leads", financeLinks === 0, String(financeLinks));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);

  /* Fleet Coordinator: the module is not theirs at all. */
  await choose(page, ROLE_SELECT, "Fleet Coordinator");
  await page.waitForTimeout(350);
  check("Fleet is told the module is closed", (await page.$(".ops-unavailable")) !== null);
  check("and sees no customer table", (await page.$(".ops-customers__table")) === null);
  check("and no customer names", (await page.$$eval(".ops-leads__name, .ops-leadcard", (n) => n.length)) === 0);
  const closed = await page.$eval(".ops-unavailable__text", (e) => e.textContent);
  check("the reason names the role", /Fleet Coordinator/.test(closed), closed.slice(0, 60));

  await ctx.close();
}

/* =====================================================================
   6. MOBILE
   ===================================================================== */

section("MOBILE - 390 WIDE");
{
  const { ctx, page, problems } = await freshCustomers({ width: 390, height: 844 });

  const tableShown = await page.$eval(".ops-leads__table-wrap", (e) => getComputedStyle(e).display);
  check("the table is put away", tableShown === "none", tableShown);
  const cards = await page.$$eval(".ops-leadcard", (n) => n.length);
  check("cards take over", cards === 10, String(cards));

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check("nothing overflows sideways", overflow <= 0, String(overflow));

  const filterVisible = await page.$eval(".ops-leads__filter-button", (e) => getComputedStyle(e).display);
  check("the Filters button is offered", filterVisible !== "none", filterVisible);
  await page.click(".ops-leads__filter-button");
  await page.waitForSelector(".ops-overlay--sheet", POLL);
  check("it opens a sheet", (await page.$(".ops-sheet__title")) !== null);
  await choose(page, ".ops-overlay--sheet .demo-select__trigger >> nth=0", "Inactive");
  const sheetResult = await page.$eval(".ops-sheet__result", (e) => e.textContent.trim());
  check("the sheet counts as you filter", /customers?$/.test(sheetResult), sheetResult);
  await page.click('.ops-sheet__head .ops-button:has-text("Done")');
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL);
  const mobilePills = await page.$$eval(".ops-leadcard .ops-pill", (n) => n.map((e) => e.textContent.trim()));
  check("the filter applied", mobilePills.length > 0 && mobilePills.every((p) => p === "Inactive"), mobilePills.join(","));

  await page.click(".ops-leadcard >> nth=0");
  await waitForDetail(page);
  check("a card opens the drawer", (await page.$(".ops-detail__id")) !== null);
  const drawerBox = await page.$eval(".ops-overlay--drawer", (e) => e.getBoundingClientRect().width);
  check("the drawer fits the viewport", drawerBox <= 390, String(Math.round(drawerBox)));
  const drawerOverflow = await page.evaluate(() => {
    const el = document.querySelector(".ops-detail__body");
    return el ? el.scrollWidth - el.clientWidth : 0;
  });
  check("and its content does not overflow", drawerOverflow <= 1, String(drawerOverflow));

  check("the mobile console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

section("RESPONSIVE - NO SIDEWAYS SCROLL");
for (const width of [360, 414, 768, 1024, 1440]) {
  const { ctx, page } = await freshCustomers({ width, height: 900 });
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check(`no horizontal overflow at ${width}`, over <= 0, String(over));
  await ctx.close();
}

/* =====================================================================
   7. PRESENTATION AND CONTENT RULES
   ===================================================================== */

section("PRESENTATION - CONTRAST, FOCUS AND CONTENT");
{
  const { ctx, page } = await freshCustomers();

  /* Every translucent layer composited, as the browser does it. */
  const samples = await page.$$eval(
    ".ops-customers__table .ops-pill, .ops-customers__segment, .ops-customers__origin, .ops-customers__count, .ops-leads__date",
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
        return {
          label: el.className,
          color: getComputedStyle(el).color,
          size: parseFloat(getComputedStyle(el).fontSize),
          weight: getComputedStyle(el).fontWeight,
          stack,
        };
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
  for (const s of samples) {
    const bg = composite(s.stack);
    const r = ratio(rgb(s.color), bg);
    const large = s.size >= 24 || (s.size >= 18.66 && Number(s.weight) >= 700);
    const floor = large ? 3 : 4.5;
    if (r < worst.r) worst = { r, label: s.label };
    check(`contrast ${s.label.split(" ")[0]}`.slice(0, 58), r >= floor, r.toFixed(2));
  }
  check("the worst contrast still passes", worst.r >= 4.5, `${worst.r.toFixed(2)} ${worst.label}`);

  /* Focus must be visible on the controls this module introduced. */
  await page.keyboard.press("Tab");
  const focusRing = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "none";
    const cs = getComputedStyle(el);
    return `${cs.outlineStyle}:${cs.outlineWidth}:${cs.boxShadow}`;
  });
  check("the first tab stop shows focus", !/^none:0px:none$/.test(focusRing), focusRing.slice(0, 40));

  await page.focus(".ops-leads__filters .demo-select__trigger");
  const selectRing = await page.evaluate(() => {
    const el = document.querySelector(".ops-leads__filters .demo-select__trigger");
    const cs = getComputedStyle(el);
    const wrap = el.closest(".demo-select") ?? el;
    return `${cs.outlineStyle}${cs.boxShadow}${getComputedStyle(wrap).boxShadow}`;
  });
  check("a focused select is marked", !/^none(none)+$/.test(selectRing.replace(/\s/g, "")), selectRing.slice(0, 50));

  /* The standing content rules, checked on the rendered page rather than in
     the source: no contact route out of this portfolio, and no em dash. */
  const html = await page.content();
  check("no mailto link", !/mailto:/i.test(html));
  check("no tel link", !/\btel:\+?\d/i.test(html));
  check("no email address", !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html));
  check("no telephone number", !/\+\d[\d\s().-]{7,}\d/.test(html));
  check("no messenger handle", !/whatsapp|telegram|discord/i.test(html));
  check("no hire or contact CTA", !/hire me|let.s talk|contact us|book a call/i.test(html));
  check("no em dash on the page", !html.includes(String.fromCharCode(0x2014)));

  /* The demo must stay honest about what it is. */
  const provenance = await page.$eval(".demo-provenance, .ops-provenance, body", (e) => e.textContent);
  check("the page still says the data is synthetic", /synthetic|simulat/i.test(provenance));

  const tableSemantics = await page.evaluate(() => {
    const rows = document.querySelectorAll(".ops-customers__table tbody tr");
    const headers = document.querySelectorAll('.ops-customers__table th[scope="row"]');
    const caption = document.querySelector(".ops-customers__table caption");
    return { rows: rows.length, headers: headers.length, caption: caption?.textContent.trim() ?? "" };
  });
  check("every row has a row header", tableSemantics.headers === tableSemantics.rows, `${tableSemantics.headers}/${tableSemantics.rows}`);
  check("the table is captioned", tableSemantics.caption.length > 0, tableSemantics.caption.slice(0, 50));

  const live = await page.$$eval("[aria-live]", (n) => n.length);
  check("changes are announced politely", live >= 2, String(live));

  await ctx.close();
}

/* =====================================================================
   8. KEYBOARD
   ===================================================================== */

section("KEYBOARD - THE MODULE IS OPERABLE WITHOUT A MOUSE");
{
  const { ctx, page } = await freshCustomers();

  const trigger = ".ops-leads__filters .demo-select__trigger";
  await page.focus(trigger);
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="listbox"]', POLL);
  check("Enter opens a select", (await page.$('[role="listbox"]')) !== null);
  const activeDescendant = await page.$eval(trigger, (e) => e.getAttribute("aria-activedescendant"));
  check("the trigger points at the active option", Boolean(activeDescendant), String(activeDescendant));
  const keepsFocus = await page.evaluate(
    () => document.activeElement?.getAttribute("role") === "combobox"
  );
  check("focus stays on the trigger", keepsFocus);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, POLL);
  await page.waitForTimeout(200);
  check("Enter commits the choice", (await countOf(page)) !== "32 customers", await countOf(page));

  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="listbox"]', POLL);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, POLL);
  check("Escape abandons the menu", (await page.$('[role="listbox"]')) === null);
  check("and focus is still on the trigger", await page.evaluate(() => document.activeElement?.getAttribute("role") === "combobox"));

  await ctx.close();
}

await browser.close();

console.log(`\n=== stage 09C3.2 customers: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`);
process.exit(failures === 0 ? 0 : 1);
