/**
 * Stage 09C3.1 — Operations Leads QA.
 *
 * Two layers, one suite.
 *
 * The DOMAIN part drives the real bundled services through the QA probe, and
 * exists because the rules this stage added — automations that actually fire,
 * guards on archived and converted leads, an audited edit — must hold whether
 * or not a screen remembers to ask. The UI part drives the product.
 *
 * Both need a route that only exists during a QA run:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c31-leads.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host
 * and 3100 is this portfolio's live production.
 *
 * Against production the domain section is skipped automatically, because the
 * probe route is not deployed:
 *
 *   QA_BASE=https://intelligent-systems-lab.duckdns.org node qa/stage09c31-leads.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const LEADS = `${BASE}/demos/operations/leads`;
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

/** A page on the Leads route with the list rendered and the seed untouched. */
async function freshLeads(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(LEADS, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__count", POLL);
  await page.waitForFunction(
    () => document.querySelector(".ops-leads__count")?.textContent !== " ",
    null,
    POLL
  );
  /* The count settles a beat before the rows commit, and a section that reads
     rows immediately would occasionally see none. Wait for what is actually
     being measured. */
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
 * Wait for the detail to actually hold a record.
 *
 * The drawer opens before the record is read — it shows a skeleton so a click
 * is never ignored — so `.ops-detail__title` is present while the content is
 * still arriving. The id only exists once the lead is in hand, and the
 * unavailable panel is the other settled outcome.
 */
const waitForDetail = (page) =>
  page.waitForFunction(
    () =>
      Boolean(document.querySelector(".ops-detail__id")) ||
      Boolean(document.querySelector(".ops-detail__missing")),
    null,
    POLL
  );

const countOf = (page) => page.$eval(".ops-leads__count", (e) => e.textContent.trim());
const badgeOf = (page) =>
  page.evaluate(() => document.querySelector(".ops-notify__badge")?.textContent ?? "0");

/* =====================================================================
   1. DOMAIN — the rules hold without a screen
   ===================================================================== */

section("DOMAIN — AUTOMATIONS AND GUARDS");
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
      const code = async (fn) => {
        try {
          await fn();
          return "no-error";
        } catch (e) {
          return P.isDemoError(e) ? e.code : "unknown";
        }
      };

      const seeded = await rt.repository.all("leads");
      const archivedSeeds = seeded.filter((l) => l.data.archived).length;

      /* Rule 01 — a website lead is assigned, and nothing else is. */
      const before = (await rt.repository.all("automation_runs")).length;
      const web = await ops.leadWorkflows.createLeadWorkflow(admin, {
        displayName: "QA Website",
        source: "Website",
        vehicleInterest: "Urban",
        priority: "High",
      });
      const webLead = await rt.repository.get("leads", web.result.id);
      const ref = await ops.leadWorkflows.createLeadWorkflow(admin, {
        displayName: "QA Referral",
        source: "Referral",
        vehicleInterest: "Touring",
        priority: "Normal",
      });
      const refLead = await rt.repository.get("leads", ref.result.id);

      /* Rule 02 — qualifying schedules the follow-up two logical days out,
         measured from the automation's own clock rather than from any earlier
         timestamp. */
      await ops.leadWorkflows.changeLeadStageWorkflow(admin, ref.result.id, "Contacted");
      const qual = await ops.leadWorkflows.changeLeadStageWorkflow(
        admin,
        ref.result.id,
        "Qualified"
      );
      const qualLead = await rt.repository.get("leads", ref.result.id);
      const runs = await rt.repository.all("automation_runs");
      const rule02Run = runs
        .filter((r) => r.data.ruleId === "automation_rule_0002")
        .sort((a, b) => b.data.completedAt.localeCompare(a.data.completedAt))[0];
      /* Anchored on the run record, which is written by a *second* commit
         after the rule has acted — and every commit advances the logical
         clock by one tick. So the honest expectation is the offset minus one
         tick, computed from the domain's own constants rather than from a
         number typed into this file. */
      const followUpOffset =
        qualLead.data.nextFollowUpAt && rule02Run
          ? Date.parse(qualLead.data.nextFollowUpAt) - Date.parse(rule02Run.data.completedAt)
          : null;
      const expectedOffset = ops.FOLLOW_UP_OFFSET_MS - ops.OPERATIONS_CLOCK_TICK_MS;

      /* Editing is audited, and changing the source does not re-run Rule 01. */
      const ownerBeforeEdit = refLead.data.assignedActorId;
      await ops.leads.updateLead(admin, ref.result.id, {
        displayName: "QA Referral Edited",
        source: "Website",
        priority: "High",
      });
      const edited = await rt.repository.get("leads", ref.result.id);
      const audit = await rt.listAudit();
      const editEntries = audit.filter(
        (a) => a.entityId === ref.result.id && a.action === "lead.updated"
      );

      /* Guards. */
      const archived = await ops.leads.createLead(admin, {
        displayName: "QA Archive Target",
        source: "Referral",
        vehicleInterest: "Utility",
        priority: "Low",
      });
      await ops.leads.archiveLead(admin, archived.id);

      const guards = {
        stageOnArchived: await code(() =>
          ops.leads.changeLeadStage(admin, archived.id, "Contacted")
        ),
        assignOnArchived: await code(() => ops.leads.assignLead(admin, archived.id, null)),
        editOnArchived: await code(() =>
          ops.leads.updateLead(admin, archived.id, { priority: "High" })
        ),
        archiveTwice: await code(() => ops.leads.archiveLead(admin, archived.id)),
        stageToWon: await code(() =>
          ops.leads.changeLeadStage(admin, web.result.id, "Won")
        ),
      };

      /* Conversion, then the second attempt the UI hides but the domain still
         has to refuse. */
      const conv = await ops.leads.convertLeadToCustomer(admin, web.result.id);
      const convertedLead = await rt.repository.get("leads", web.result.id);
      const customer = await rt.repository.get("customers", conv.customer.id);
      const convertTwice = await code(() =>
        ops.leads.convertLeadToCustomer(admin, web.result.id)
      );
      const stageAfterConvert = await code(() =>
        ops.leads.changeLeadStage(admin, web.result.id, "Contacted")
      );

      /* Role enforcement is the domain's, not a hidden button's. */
      const fleet = ops.contextAs(rt, "Fleet Coordinator");
      const finance = ops.contextAs(rt, "Finance Analyst");
      const sales = ops.contextAs(rt, "Sales Agent");
      const roles = {
        fleetCreate: await code(() =>
          ops.leads.createLead(fleet, {
            displayName: "X",
            source: "Website",
            vehicleInterest: "Urban",
            priority: "Low",
          })
        ),
        financeStage: await code(() =>
          ops.leads.changeLeadStage(finance, "lead_0001", "Contacted")
        ),
        salesCreate: await code(async () => {
          await ops.leads.createLead(sales, {
            displayName: "QA Sales",
            source: "Referral",
            vehicleInterest: "Urban",
            priority: "Low",
          });
        }),
      };

      /* The list selector is the one place ordering and matching happen. */
      const all = await rt.repository.all("leads");
      const L = ops.leadsList;
      const def = L.selectLeadList(all, L.DEFAULT_LEAD_QUERY);
      const desc = def.items.map((r) => r.data.lastActivityAt);
      const sortedDesc = desc.every((v, i) => i === 0 || desc[i - 1] >= v);
      const byStage = L.selectLeadList(all, {
        ...L.DEFAULT_LEAD_QUERY,
        sort: "stage",
        direction: "asc",
        pageSize: 0,
      });
      const stageOrder = byStage.items.map((r) => r.data.stage);
      const stageRank = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
      const stageMonotonic = stageOrder.every(
        (s, i) => i === 0 || stageRank.indexOf(stageOrder[i - 1]) <= stageRank.indexOf(s)
      );
      const archivedHidden = def.items.every((r) => !r.data.archived);
      const owners = L.ownerOptions(await rt.repository.all("actors"), all);

      return {
        seededLeads: seeded.length,
        archivedSeeds,
        websiteOwner: webLead.data.assignedActorId,
        websiteOutcomes: web.outcomes.map((o) => `${o.ruleId}:${o.status}`),
        referralOwner: refLead.data.assignedActorId,
        referralOutcomes: ref.outcomes.length,
        qualOutcomes: qual.outcomes.map((o) => `${o.ruleId}:${o.status}`),
        followUpOffset,
        expectedOffset,
        followUpDays: qualLead.data.nextFollowUpAt
          ? (Date.parse(qualLead.data.nextFollowUpAt) - Date.parse(rule02Run.data.startedAt)) / 86400000
          : null,
        runsAdded: runs.length - before,
        editedSource: edited.data.source,
        editedOwner: edited.data.assignedActorId,
        ownerBeforeEdit,
        editAudits: editEntries.length,
        editChanges: editEntries[0]?.changes?.map((c) => c.field) ?? [],
        guards,
        convertedStage: convertedLead.data.stage,
        convertedLink: convertedLead.data.convertedCustomerId,
        customerBackLink: customer?.data.sourceLeadId,
        convertTwice,
        stageAfterConvert,
        roles,
        sortedDesc,
        stageMonotonic,
        archivedHidden,
        owners: owners.map((o) => o.name),
      };
    });

    check("the seed holds 48 leads", out.seededLeads === 48, String(out.seededLeads));
    check("no seeded lead is archived", out.archivedSeeds === 0, `${out.archivedSeeds} archived`);

    check("Rule 01 assigns a website lead", out.websiteOwner === "actor_0002", String(out.websiteOwner));
    check("Rule 01 records a successful run",
      out.websiteOutcomes.includes("automation_rule_0001:Success"), out.websiteOutcomes.join(","));
    check("a non-website lead is left unassigned", out.referralOwner === null, String(out.referralOwner));
    check("a non-website lead wakes no rule", out.referralOutcomes === 0, String(out.referralOutcomes));

    check("Rule 02 runs on qualification",
      out.qualOutcomes.includes("automation_rule_0002:Success"), out.qualOutcomes.join(","));
    check("the follow-up is exactly two logical days out",
      out.followUpOffset === out.expectedOffset,
      `${out.followUpOffset} ms, expected ${out.expectedOffset}`);
    check("the follow-up lands on the second day, not a rounded guess",
      out.followUpDays !== null && Math.abs(out.followUpDays - 2) < 0.001,
      `${out.followUpDays} days`);

    check("editing records an audit entry", out.editAudits === 1, String(out.editAudits));
    check("the audit names only the fields that moved",
      out.editChanges.includes("source") && out.editChanges.includes("displayName") &&
        !out.editChanges.includes("vehicleInterest"),
      out.editChanges.join(","));
    check("the source can be corrected", out.editedSource === "Website");
    /* The rule is triggered by lead.created.website, and an edit emits no
       event at all, so re-describing a lead cannot re-run the assignment. */
    check("changing the source does not re-run Rule 01",
      out.editedOwner === out.ownerBeforeEdit, `${out.ownerBeforeEdit} -> ${out.editedOwner}`);

    check("an archived lead cannot change stage", out.guards.stageOnArchived === "CONFLICT", out.guards.stageOnArchived);
    check("an archived lead cannot be reassigned", out.guards.assignOnArchived === "CONFLICT", out.guards.assignOnArchived);
    check("an archived lead cannot be edited", out.guards.editOnArchived === "CONFLICT", out.guards.editOnArchived);
    check("a lead cannot be archived twice", out.guards.archiveTwice === "CONFLICT", out.guards.archiveTwice);
    check("Won cannot be chosen as a stage", out.guards.stageToWon === "CONFLICT", out.guards.stageToWon);

    check("conversion moves the lead to Won", out.convertedStage === "Won", out.convertedStage);
    check("conversion links both directions",
      Boolean(out.convertedLink) && out.customerBackLink !== undefined,
      `${out.convertedLink} <-> ${out.customerBackLink}`);
    check("a second conversion is refused", out.convertTwice === "CONFLICT", out.convertTwice);
    check("a converted lead cannot change stage", out.stageAfterConvert === "CONFLICT", out.stageAfterConvert);

    check("Fleet Coordinator cannot create a lead", out.roles.fleetCreate === "FORBIDDEN", out.roles.fleetCreate);
    check("Finance Analyst cannot change a stage", out.roles.financeStage === "FORBIDDEN", out.roles.financeStage);
    check("Sales Agent can create a lead", out.roles.salesCreate === "no-error", out.roles.salesCreate);

    check("the default sort is last activity, descending", out.sortedDesc);
    check("sorting by stage follows the pipeline, not the alphabet", out.stageMonotonic);
    check("archived leads are excluded from the list", out.archivedHidden);
    check("owner options derive to the CRM owners only",
      out.owners.length === 1 && out.owners[0] === "Avery Chen", out.owners.join(","));
  }
  await ctx.close();
}

/* =====================================================================
   2. THE LIST
   ===================================================================== */

section("LIST");
{
  const { ctx, page, problems } = await freshLeads();

  check("the route renders the Leads module", (await countOf(page)) === "48 leads", await countOf(page));
  const shell = await page.evaluate(() => ({
    title: document.querySelector(".ops-topbar__title")?.textContent,
    context: document.querySelector(".ops-topbar__sub")?.textContent,
    active: [...document.querySelectorAll('[aria-current="page"]')].map((e) => e.textContent.trim()),
    disclosure: document.querySelector(".demo-disclosure")?.textContent ?? "",
    mains: document.querySelectorAll("main").length,
    h1: [...document.querySelectorAll("h1")].map((e) => e.textContent.trim()),
  }));
  check("the top bar names the module", shell.title === "Leads", String(shell.title));
  check("the top bar carries its own context line", shell.context === "CRM pipeline", String(shell.context));
  check("the sidebar marks Leads current", shell.active.includes("Leads"), shell.active.join(","));
  check("the demo disclosure is present",
    shell.disclosure.includes("INTERACTIVE ENGINEERING DEMO") && shell.disclosure.includes("SYNTHETIC DATA"));
  check("exactly one main landmark", shell.mains === 1, String(shell.mains));
  check("exactly one h1", shell.h1.length === 1, shell.h1.join("|"));

  const table = await page.evaluate(() => ({
    columns: [...document.querySelectorAll(".ops-leads__table thead th")].map((e) =>
      e.textContent.replace(/[▾▴⁚]/g, "").trim()
    ),
    scopes: [...document.querySelectorAll(".ops-leads__table thead th")].every(
      (e) => e.getAttribute("scope") === "col"
    ),
    rowHeaders: [...document.querySelectorAll(".ops-leads__row th")].every(
      (e) => e.getAttribute("scope") === "row"
    ),
    rows: document.querySelectorAll(".ops-leads__row").length,
    nameButtons: document.querySelectorAll(".ops-leads__name").length,
    idsShown: /lead_\d{4}/.test(document.querySelector(".ops-leads__table")?.textContent ?? ""),
    ariaSort: [...document.querySelectorAll(".ops-leads__table thead th")].map((e) =>
      e.getAttribute("aria-sort")
    ),
  }));

  check("the eight canonical columns are present",
    table.columns.join("|") ===
      "Lead|Source|Interest|Stage|Owner|Priority|Last activity|Next follow-up",
    table.columns.join("|"));
  check("every column header is scope=col", table.scopes);
  check("every row header is scope=row", table.rowHeaders);
  check("the first page holds ten rows", table.rows === 10, String(table.rows));
  check("each row opens through a real control, not a row click",
    table.nameButtons === table.rows, `${table.nameButtons} buttons`);
  check("no entity id is shown as a column", !table.idsShown);
  check("only the sorted column carries aria-sort",
    table.ariaSort.filter((v) => v === "descending" || v === "ascending").length === 1,
    table.ariaSort.join(","));

  check("no console errors on the list", problems.length === 0, problems.slice(0, 2).join(" | "));
  await ctx.close();
}

/* =====================================================================
   3. SEARCH, FILTERS, SORT, PAGING
   ===================================================================== */

section("SEARCH AND FILTERS");
{
  const { ctx, page } = await freshLeads();
  const settle = async (expected) => {
    await page
      .waitForFunction(
        (want) => document.querySelector(".ops-leads__count")?.textContent.trim() === want,
        expected,
        POLL
      )
      .catch(() => {});
    return countOf(page);
  };

  await page.fill(".ops-leads__search-input", "alina");
  check("search matches a name, case-insensitively", (await settle("3 leads")) === "3 leads", await countOf(page));

  await page.fill(".ops-leads__search-input", "   ALINA   ");
  check("search trims and ignores case", (await settle("3 leads")) === "3 leads", await countOf(page));

  await page.fill(".ops-leads__search-input", "Touring");
  const interest = await settle("");
  check("search matches the vehicle interest", Number(interest.split(" ")[0]) > 0, interest);

  await page.fill(".ops-leads__search-input", "zzzzzz");
  await settle("0 leads");
  const empty = await page.evaluate(() => ({
    text: document.querySelector(".ops-leads__empty-text")?.textContent ?? "",
    clear: Boolean(document.querySelector(".ops-leads__empty .ops-button")),
  }));
  check("no matches states so plainly", empty.text === "No leads match these filters.", empty.text);
  check("the empty state offers to clear the filters", empty.clear);

  await page.click(".ops-leads__empty .ops-button");
  check("clearing from the empty state restores the list", (await settle("48 leads")) === "48 leads", await countOf(page));

  /* The seed's own distribution, asserted through the product. */
  const stages = { New: 12, Contacted: 10, Qualified: 9, Proposal: 7, Won: 6, Lost: 4 };
  for (const [stage, expected] of Object.entries(stages)) {
    await page.selectOption(".ops-leads__filters .ops-control__select >> nth=0", stage);
    const got = await settle(`${expected} leads`);
    check(`stage ${stage} matches the seeded distribution`, got === `${expected} leads`, got);
  }
  await page.selectOption(".ops-leads__filters .ops-control__select >> nth=0", "all");
  await settle("48 leads");

  await page.selectOption(".ops-leads__filters .ops-control__select >> nth=1", "Website");
  const website = await countOf(page);
  await page.selectOption(".ops-leads__filters .ops-control__select >> nth=2", "unassigned");
  const both = await settle("0 leads");
  check("filters combine", both === "0 leads", `${website} website, then unassigned -> ${both}`);

  await page.click(".ops-link-button");
  check("Clear filters resets every control", (await settle("48 leads")) === "48 leads", await countOf(page));
  const controls = await page.evaluate(() => ({
    search: document.querySelector(".ops-leads__search-input")?.value,
    selects: [...document.querySelectorAll(".ops-leads__filters .ops-control__select")].slice(0, 3).map((s) => s.value),
  }));
  check("Clear filters empties the search box", controls.search === "", String(controls.search));
  check("Clear filters returns each filter to All",
    controls.selects.join(",") === "all,all,all", controls.selects.join(","));

  await ctx.close();
}

section("SORT");
{
  const { ctx, page } = await freshLeads();
  const names = () => page.$$eval(".ops-leads__name", (es) => es.map((e) => e.textContent));

  /* One control now: the field and its direction are a single option, so the
     old "pick a field, then toggle a mystery square" dance is gone. */
  const sortBy = async (key, direction) => {
    await page.selectOption(".ops-leads__filters .ops-control__select >> nth=3", `${key}:${direction}`);
    await page.waitForTimeout(150);
    return names();
  };

  const asc = await sortBy("name", "asc");
  const sortedAsc = [...asc].sort((a, b) => a.localeCompare(b));
  check("sorting by name ascending is alphabetical", asc.join("|") === sortedAsc.join("|"), asc[0]);

  const desc = await sortBy("name", "desc");
  check("reversing the direction reverses the order",
    desc[0] !== asc[0] && desc[0] >= asc[0], `${asc[0]} vs ${desc[0]}`);

  /* Every exposed sort must produce a stable, repeatable page. */
  for (const key of ["lastActivity", "nextFollowUp", "stage", "priority", "created"]) {
    const first = await sortBy(key, "asc");
    const again = await sortBy(key, "asc");
    check(`sorting by ${key} is deterministic`, first.join("|") === again.join("|"));
  }

  /* A lead with nothing scheduled is not "the soonest". */
  await sortBy("nextFollowUp", "asc");
  const followAsc = await page.$$eval(".ops-leads__row .ops-leads__date:last-child", (es) =>
    es.map((e) => e.textContent.trim())
  );
  check("leads with no follow-up sort last, not first",
    followAsc[0] !== "—", followAsc.slice(0, 3).join(","));

  await ctx.close();
}

section("PAGINATION");
{
  const { ctx, page } = await freshLeads();
  const ids = () => page.$$eval(".ops-leads__name", (es) => es.map((e) => e.textContent));

  const p1 = await ids();
  check("the default page size is ten", p1.length === 10, String(p1.length));
  check("the range reads correctly", (await page.$eval(".ops-pager__range", (e) => e.textContent)) === "1–10 of 48");
  check("Previous is disabled on the first page",
    await page.$eval(".ops-pager__step", (e) => e.disabled));

  await page.click(".ops-pager__step >> nth=1");
  await page.waitForTimeout(200);
  const p2 = await ids();
  check("Next advances the page",
    (await page.$eval(".ops-pager__page", (e) => e.textContent)) === "Page 2 of 5");
  check("no record appears on two pages", p1.every((n, i) => n !== p2[i] || p1.join() !== p2.join()));
  check("the second page is a different set", p1.join("|") !== p2.join("|"));

  await page.click(".ops-pager__step >> nth=0");
  await page.waitForTimeout(200);
  check("Previous returns to the first page", (await ids()).join("|") === p1.join("|"));

  await page.selectOption(".ops-pager__size .ops-control__select", "20");
  await page.waitForTimeout(200);
  check("the page size can be raised to twenty",
    (await ids()).length === 20, String((await ids()).length));
  check("the page count follows the size",
    (await page.$eval(".ops-pager__page", (e) => e.textContent)) === "Page 1 of 3");

  await page.click(".ops-pager__step >> nth=1");
  await page.waitForTimeout(200);
  await page.selectOption(".ops-leads__filters .ops-control__select >> nth=0", "Lost");
  await page.waitForTimeout(250);
  check("changing a filter returns to page one",
    (await page.$eval(".ops-pager__page", (e) => e.textContent)).startsWith("Page 1"),
    await page.$eval(".ops-pager__page", (e) => e.textContent));

  /* Every record is reachable and none is duplicated across the whole set. */
  await page.click(".ops-link-button");
  await page.waitForTimeout(200);
  await page.selectOption(".ops-pager__size .ops-control__select", "10");
  await page.waitForTimeout(200);
  const seen = [];
  for (let i = 0; i < 5; i += 1) {
    seen.push(...(await ids()));
    if (i < 4) {
      await page.click(".ops-pager__step >> nth=1");
      await page.waitForTimeout(180);
    }
  }
  check("paging visits all forty-eight rows", seen.length === 48, String(seen.length));

  await ctx.close();
}

/* =====================================================================
   4. SELECTION AND THE URL
   ===================================================================== */

section("URL SELECTION");
{
  const { ctx, page } = await freshLeads();

  await page.click(".ops-leads__name >> nth=0");
  await page.waitForSelector(".ops-overlay--drawer", POLL);
  await waitForDetail(page);
  const opened = await page.evaluate(() => ({
    search: location.search,
    title: document.querySelector(".ops-detail__title")?.textContent,
    id: document.querySelector(".ops-detail__id")?.textContent,
    modal: document.querySelector(".ops-overlay--drawer")?.matches(":modal"),
    focused: document.activeElement?.className ?? "",
  }));
  check("selecting a row puts the record in the URL",
    /^\?selected=lead_\d{4}$/.test(opened.search), opened.search);
  check("the drawer is a real modal", opened.modal === true);
  check("the drawer shows the record's id beside the name",
    opened.id === opened.search.replace("?selected=", ""), `${opened.id}`);
  check("focus moves into the drawer",
    opened.focused.includes("ops-detail__title"), opened.focused);

  await page.goBack();
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  check("Back closes the detail", (await page.evaluate(() => location.search)) === "");

  await page.goForward();
  await page.waitForSelector(".ops-overlay--drawer", POLL);
  check("Forward reopens it", (await page.evaluate(() => location.search)) === opened.search);

  await page.click(".ops-detail__head .ops-icon-button");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  await page.waitForTimeout(250);
  check("closing returns focus to the row that opened it",
    (await page.evaluate(() => document.activeElement?.className ?? "")).includes("ops-leads__name"),
    await page.evaluate(() => document.activeElement?.className ?? ""));

  await ctx.close();
}

section("DEEP LINKS");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${LEADS}?selected=lead_0007`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  check("a valid deep link opens that record",
    (await page.$eval(".ops-detail__id", (e) => e.textContent)) === "lead_0007");

  await page.goto(`${LEADS}?selected=lead_9999`, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-overlay--drawer", POLL);
  await waitForDetail(page);
  const missing = await page.evaluate(() => ({
    title: document.querySelector(".ops-detail__title")?.textContent,
    body: document.querySelector(".ops-detail__missing")?.textContent ?? "",
    dismiss: Boolean(document.querySelector(".ops-detail__body .ops-button")),
  }));
  check("an unknown id states so rather than crashing",
    missing.title === "Lead unavailable", String(missing.title));
  check("the unavailable state names the id it could not find",
    missing.body.includes("lead_9999"));
  check("the unavailable state can be dismissed", missing.dismiss);

  await page.click(".ops-detail__body .ops-button");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  check("dismissing removes the stale selection from the URL",
    (await page.evaluate(() => location.search)) === "");
  check("the list is usable afterwards",
    (await page.$$eval(".ops-leads__row", (es) => es.length)) === 10);

  await ctx.close();
}

/* =====================================================================
   5. DETAIL CONTENT
   ===================================================================== */

section("DETAIL");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${LEADS}?selected=lead_0003`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForSelector(".ops-brief__summary", POLL);

  const detail = await page.evaluate(() => ({
    sections: [...document.querySelectorAll(".ops-detail__section-title")].map((e) => e.textContent),
    facts: [...document.querySelectorAll(".ops-facts__label")].map((e) => e.textContent),
    assist: document.querySelector(".ops-assist")?.textContent,
    summary: document.querySelector(".ops-brief__summary")?.textContent ?? "",
    action: document.querySelector(".ops-brief__action-value")?.textContent ?? "",
    stageOptions: [...document.querySelectorAll(".ops-detail__actions select")][0]
      ? [...document.querySelectorAll(".ops-detail__actions select")[0].options].map((o) => o.value)
      : [],
    buttons: [...document.querySelectorAll(".ops-detail__buttons button")].map((e) =>
      e.textContent.trim()
    ),
    width: Math.round(document.querySelector(".ops-overlay--drawer").getBoundingClientRect().width),
  }));

  check("the detail has exactly three sections",
    detail.sections.join("|") === "Overview|Lead brief|Activity", detail.sections.join("|"));
  check("the overview states the seven canonical facts",
    ["Source", "Vehicle interest", "Owner", "Stage", "Created", "Last activity", "Next follow-up"]
      .every((f) => detail.facts.includes(f)), detail.facts.join(","));
  check("the brief is labelled as local", detail.assist === "ASSIST / LOCAL", String(detail.assist));
  check("the brief has a summary", detail.summary.length > 20, detail.summary.slice(0, 50));
  check("the brief recommends an action", detail.action.length > 0, detail.action);
  check("Won is not offered as a stage",
    !detail.stageOptions.includes("Won"), detail.stageOptions.join(","));
  check("the drawer offers Edit, Convert and Archive",
    detail.buttons.includes("Edit") && detail.buttons.includes("Archive"), detail.buttons.join(","));
  check("the drawer leaves the table visible",
    detail.width >= 400 && detail.width <= 500, `${detail.width}px`);

  const text = await page.$eval(".ops-overlay--drawer", (e) => e.innerText);
  for (const [name, re] of Object.entries({
    email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    telephone: /[+]?\d[\d\s().-]{7,}\d/,
    brand: /\b(honda|yamaha|suzuki|kawasaki|ducati|harley|vespa|piaggio|ktm)\b/i,
  })) {
    const hit = text.match(re);
    check(`the detail carries no ${name}`, hit === null, hit ? hit[0] : "");
  }

  await ctx.close();
}

/* =====================================================================
   6. MUTATIONS THROUGH THE PRODUCT
   ===================================================================== */

section("CREATE");
{
  const { ctx, page, problems } = await freshLeads();
  const badgeBefore = await badgeOf(page);

  await page.click(".ops-leads__lead-row .ops-button--primary");
  await page.waitForSelector(".ops-form", POLL);
  const fields = await page.evaluate(() => ({
    labels: [...document.querySelectorAll(".ops-form .ops-field__label")].map((e) => e.textContent),
    hasStage: [...document.querySelectorAll(".ops-form .ops-field__label")].some(
      (e) => e.textContent === "Stage"
    ),
    submitDisabled: document.querySelector('.ops-form button[type="submit"]').disabled,
  }));
  check("the create form takes exactly four fields",
    fields.labels.join("|") === "Lead name|Source|Vehicle interest|Priority", fields.labels.join("|"));
  check("stage is not chosen at creation", !fields.hasStage);
  check("the submit button is inert until the lead has a name", fields.submitDisabled);

  await page.fill(".ops-form input.ops-input", "QA Website Lead");
  await page.selectOption(".ops-form select >> nth=0", "Website");
  await page.selectOption(".ops-form select >> nth=1", "Touring");
  await page.selectOption(".ops-form select >> nth=2", "High");
  await page.click('.ops-form button[type="submit"]');

  await page.waitForSelector(".ops-overlay--drawer", POLL);
  await waitForDetail(page);
  await page.waitForTimeout(400);
  const created = await page.evaluate(() => ({
    count: document.querySelector(".ops-leads__count")?.textContent.trim(),
    title: document.querySelector(".ops-detail__title")?.textContent,
    facts: [...document.querySelectorAll(".ops-facts__value")].map((e) => e.textContent),
    activity: [...document.querySelectorAll(".ops-activity__summary")].map((e) => e.textContent),
  }));

  check("the new lead appears in the count", created.count === "49 leads", String(created.count));
  check("the new lead's detail opens as confirmation", created.title === "QA Website Lead");
  check("a new lead starts at New", created.facts[3] === "New", created.facts[3]);
  check("Rule 01 assigned it", created.facts[2] === "Avery Chen", created.facts[2]);
  check("the badge rose by the automation's notification",
    Number(await badgeOf(page)) === Number(badgeBefore) + 1,
    `${badgeBefore} -> ${await badgeOf(page)}`);
  check("the activity records the creation and the automation",
    created.activity.some((a) => /created from Website/.test(a)) &&
      created.activity.some((a) => /by automation/.test(a)),
    created.activity.join(" | "));
  check("the activity is newest first",
    /by automation/.test(created.activity[0]), created.activity[0]);

  /* A source that wakes no rule must not be quietly assigned to look tidy. */
  await page.click(".ops-detail__head .ops-icon-button");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  await page.click(".ops-leads__lead-row .ops-button--primary");
  await page.waitForSelector(".ops-form", POLL);
  await page.fill(".ops-form input.ops-input", "QA Walk-in Lead");
  await page.selectOption(".ops-form select >> nth=0", "Walk-in");
  await page.click('.ops-form button[type="submit"]');
  await page.waitForSelector(".ops-overlay--drawer", POLL);
  await waitForDetail(page);
  await page.waitForTimeout(400);
  const nonWeb = await page.evaluate(() => ({
    owner: [...document.querySelectorAll(".ops-facts__value")][2]?.textContent,
    count: document.querySelector(".ops-leads__count")?.textContent.trim(),
  }));
  check("a walk-in lead is left unassigned", nonWeb.owner === "Unassigned", String(nonWeb.owner));
  check("it still joins the list", nonWeb.count === "50 leads", String(nonWeb.count));

  check("no console errors while creating", problems.length === 0, problems.slice(0, 2).join(" | "));
  await ctx.close();
}

section("EDIT, STAGE AND ASSIGNMENT");
{
  const { ctx, page } = await freshLeads();
  await page.goto(`${LEADS}?selected=lead_0002`, { waitUntil: "networkidle" });
  await waitForDetail(page);

  await page.click(".ops-detail__buttons button >> nth=0");
  await page.waitForSelector(".ops-form", POLL);
  const editFields = await page.evaluate(() => ({
    labels: [...document.querySelectorAll(".ops-form .ops-field__label")].map((e) => e.textContent),
    name: document.querySelector(".ops-form input.ops-input")?.value,
  }));
  check("the edit form is prefilled", (editFields.name ?? "").length > 0, editFields.name);
  check("the edit form offers name, source, interest and priority",
    editFields.labels.join("|") === "Lead name|Source|Vehicle interest|Priority",
    editFields.labels.join("|"));

  await page.fill(".ops-form input.ops-input", "QA Renamed Lead");
  await page.selectOption(".ops-form select >> nth=2", "Low");
  await page.click('.ops-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector(".ops-form"), null, POLL);
  await page.waitForTimeout(400);
  check("the edit is reflected in the detail",
    (await page.$eval(".ops-detail__title", (e) => e.textContent)) === "QA Renamed Lead");
  const editedActivity = await page.$$eval(".ops-activity__summary", (es) => es.map((e) => e.textContent));
  check("the edit appears in the activity",
    editedActivity.some((a) => /updated/i.test(a)), editedActivity[0] ?? "");

  /* Qualifying is where Rule 02 has to fire through the product. */
  const badgeBefore = await badgeOf(page);
  await page.selectOption(".ops-detail__actions select >> nth=0", "Qualified");
  await page.waitForFunction(
    () => [...document.querySelectorAll(".ops-facts__value")][3]?.textContent === "Qualified",
    null,
    POLL
  );
  await page.waitForTimeout(500);
  const qualified = await page.evaluate(() => ({
    stage: [...document.querySelectorAll(".ops-facts__value")][3]?.textContent,
    followUp: [...document.querySelectorAll(".ops-facts__value")][6]?.textContent,
    activity: [...document.querySelectorAll(".ops-activity__summary")].map((e) => e.textContent),
  }));
  check("the stage change lands", qualified.stage === "Qualified", String(qualified.stage));
  check("Rule 02 schedules the follow-up two days out",
    qualified.followUp === "In 2 days", String(qualified.followUp));
  check("qualifying raises a notification",
    Number(await badgeOf(page)) > Number(badgeBefore), `${badgeBefore} -> ${await badgeOf(page)}`);
  check("the stage change is audited",
    qualified.activity.some((a) => /moved from .* to Qualified/.test(a)), qualified.activity[0]);

  /* Assignment is a dedicated control, not part of the edit form. */
  await page.selectOption(".ops-detail__actions select >> nth=1", "unassigned");
  await page.waitForFunction(
    () => [...document.querySelectorAll(".ops-facts__value")][2]?.textContent === "Unassigned",
    null,
    POLL
  );
  check("the owner can be cleared", true, "Unassigned");
  const ownerOptions = await page.$$eval(".ops-detail__actions select >> nth=1 >> option", (os) =>
    os.map((o) => o.textContent)
  );
  check("only CRM owners are offered",
    ownerOptions.join("|") === "Unassigned|Avery Chen", ownerOptions.join("|"));

  await ctx.close();
}

section("CONVERT AND ARCHIVE");
{
  const { ctx, page } = await freshLeads();
  await page.goto(`${LEADS}?selected=lead_0005`, { waitUntil: "networkidle" });
  await waitForDetail(page);

  await page.click(".ops-detail__buttons .ops-button--primary");
  await page.waitForSelector(".ops-confirm", POLL);
  const confirm = await page.evaluate(() => ({
    title: document.querySelector(".ops-confirm__title")?.textContent,
    body: document.querySelector(".ops-confirm__body")?.textContent,
    subject: document.querySelector(".ops-confirm__subject")?.textContent ?? "",
    buttons: [...document.querySelectorAll(".ops-confirm__actions button")].map((e) => e.textContent.trim()),
  }));
  check("conversion asks first", confirm.title === "Convert this lead to a customer?", String(confirm.title));
  check("the confirmation says what will happen",
    confirm.body === "A customer record will be created and the lead will move to Won.");
  check("the confirmation names the record and its id",
    confirm.subject.includes("lead_0005"), confirm.subject.trim());
  check("the confirmation offers Cancel and Convert lead",
    confirm.buttons.join("|") === "Cancel|Convert lead", confirm.buttons.join("|"));

  await page.click(".ops-confirm__actions button >> nth=0");
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  check("Cancel leaves the lead alone",
    (await page.$eval(".ops-facts__value >> nth=3", (e) => e.textContent)) !== "Won");

  await page.click(".ops-detail__buttons .ops-button--primary");
  await page.waitForSelector(".ops-confirm", POLL);
  await page.click(".ops-confirm .ops-button--primary");
  await page.waitForFunction(() => !document.querySelector(".ops-confirm"), null, POLL);
  await page.waitForTimeout(600);
  const converted = await page.evaluate(() => ({
    stage: [...document.querySelectorAll(".ops-facts__value")][3]?.textContent,
    labels: [...document.querySelectorAll(".ops-facts__label")].map((e) => e.textContent),
    customer: [...document.querySelectorAll(".ops-facts__value")].pop()?.textContent ?? "",
    convertGone: !document.querySelector(".ops-detail__buttons .ops-button--primary"),
    note: document.querySelector(".ops-detail__converted")?.textContent ?? "",
    links: document.querySelectorAll('.ops-overlay--drawer a[href*="customers"]').length,
    activity: [...document.querySelectorAll(".ops-activity__summary")].map((e) => e.textContent),
  }));
  check("conversion moves the lead to Won", converted.stage === "Won", String(converted.stage));
  check("the converted customer is named", converted.labels.includes("Converted customer"));
  check("the customer id is shown", /customer_\d{4}/.test(converted.customer), converted.customer);
  check("no link is offered to the unbuilt Customers module", converted.links === 0);
  check("the convert action is withdrawn", converted.convertGone);
  check("the drawer states the converted position", converted.note.includes("Converted"), converted.note);
  check("the conversion is audited",
    converted.activity.some((a) => /converted/i.test(a)), converted.activity[0]);

  /* Archive, and what happens to the row and the URL. */
  await page.goto(`${LEADS}?selected=lead_0009`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  const archiveName = await page.$eval(".ops-detail__title", (e) => e.textContent);
  await page.click(".ops-detail__buttons .ops-button--quiet >> nth=1");
  await page.waitForSelector(".ops-confirm", POLL);
  const archiveCopy = await page.evaluate(() => ({
    title: document.querySelector(".ops-confirm__title")?.textContent,
    body: document.querySelector(".ops-confirm__body")?.textContent ?? "",
  }));
  check("archiving asks first", archiveCopy.title === "Archive this lead?", String(archiveCopy.title));
  check("the archive copy does not claim deletion",
    !/delete/i.test(archiveCopy.body) && archiveCopy.body.includes("Reset demo data"), archiveCopy.body);

  await page.click(".ops-confirm .ops-button--primary");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  await page.waitForTimeout(500);
  const archived = await page.evaluate(
    (name) => ({
      count: document.querySelector(".ops-leads__count")?.textContent.trim(),
      search: location.search,
      present: [...document.querySelectorAll(".ops-leads__name")].some((e) => e.textContent === name),
      focused: document.activeElement?.tagName + "." + (document.activeElement?.className ?? ""),
    }),
    archiveName
  );
  check("archiving removes the lead from the working list", archived.count === "47 leads", String(archived.count));
  check("the archived row is gone", !archived.present);
  check("the stale selection is cleared from the URL", archived.search === "", archived.search);
  check("focus moves somewhere sensible, not to the body",
    archived.focused.includes("visually-hidden"), archived.focused);

  await page.goBack();
  await page.waitForTimeout(500);
  const afterBack = await page.evaluate(() => ({
    id: document.querySelector(".ops-detail__id")?.textContent?.trim() ?? null,
    missing: Boolean(document.querySelector(".ops-detail__missing")),
    search: location.search,
  }));
  /* The archive replaced its own history entry rather than pushing a new one,
     so the URL that named the archived lead is gone and Back cannot return to
     it. Landing on an earlier, still-valid record is correct. */
  check("Back cannot return to the archived record",
    !afterBack.search.includes("lead_0009") || afterBack.missing,
    `${afterBack.search} ${afterBack.id ?? ""}`);

  await ctx.close();
}

/* =====================================================================
   7. ROLES
   ===================================================================== */

section("ROLES");
{
  const { ctx, page } = await freshLeads();

  const expected = {
    Admin: { view: true, write: true },
    "Sales Agent": { view: true, write: true },
    "Fleet Coordinator": { view: false, write: false },
    "Finance Analyst": { view: false, write: false },
  };

  for (const [role, want] of Object.entries(expected)) {
    await page.selectOption(".ops-role__select", role);
    await page.waitForFunction(
      (r) => document.querySelector(".ops-actor__role")?.textContent === r,
      role,
      POLL
    );
    await page.waitForTimeout(350);
    const seen = await page.evaluate(() => ({
      rows: document.querySelectorAll(".ops-leads__row").length,
      cards: document.querySelectorAll(".ops-leadcard").length,
      names: document.querySelectorAll(".ops-leads__name").length,
      unavailable: Boolean(document.querySelector(".ops-unavailable")),
      newButton: Boolean(document.querySelector(".ops-leads__lead-row .ops-button--primary")),
      navLeads: [...document.querySelectorAll(".ops-sidebar a")].some(
        (a) => a.textContent.trim() === "Leads"
      ),
      leaked: /lead_\d{4}/.test(document.body.innerText),
    }));

    if (want.view) {
      check(`${role}: the list renders`, seen.rows > 0, `${seen.rows} rows`);
      check(`${role}: Leads is a link in the navigation`, seen.navLeads);
      check(`${role}: may create`, seen.newButton === want.write);
    } else {
      check(`${role}: no lead record is rendered`,
        seen.rows === 0 && seen.cards === 0 && seen.names === 0,
        `${seen.rows}/${seen.cards}/${seen.names}`);
      check(`${role}: the contained unavailable state is shown`, seen.unavailable);
      check(`${role}: no lead id leaks into the page`, !seen.leaked);
      check(`${role}: the navigation does not advertise Leads`, !seen.navLeads);
      check(`${role}: no create action`, !seen.newButton);
    }
  }

  /* The specific leak D-058 exists to prevent: a drawer full of Admin's data
     must not survive one frame of a role that cannot open the module. */
  await page.selectOption(".ops-role__select", "Admin");
  await page.waitForFunction(
    () => document.querySelector(".ops-actor__role")?.textContent === "Admin",
    null,
    POLL
  );
  await page.waitForSelector(".ops-leads__row", POLL);
  await page.click(".ops-leads__name >> nth=0");
  await page.waitForSelector(".ops-overlay--drawer", POLL);

  await page.selectOption(".ops-role__select", "Finance Analyst");
  /* Sampled immediately, with no settle: the point is that there is no frame
     in which the previous role's records are still on screen. */
  const immediate = await page.evaluate(() => ({
    drawer: Boolean(document.querySelector(".ops-overlay--drawer")),
    rows: document.querySelectorAll(".ops-leads__row").length,
    leaked: /lead_\d{4}/.test(document.body.innerText),
  }));
  check("switching to a barred role closes the detail at once", !immediate.drawer);
  check("no lead row survives the switch", immediate.rows === 0, String(immediate.rows));
  check("no lead id survives the switch", !immediate.leaked);

  await page.selectOption(".ops-role__select", "Admin");
  await page.waitForSelector(".ops-leads__row", POLL);
  check("switching back restores the module",
    (await page.$$eval(".ops-leads__row", (es) => es.length)) === 10);

  await ctx.close();
}

/* =====================================================================
   8. OVERVIEW REGRESSION
   ===================================================================== */

section("OVERVIEW REGRESSION");
{
  const { ctx, page } = await freshLeads();
  const kpis = async () => {
    await page.waitForSelector(".ops-kpi__value", POLL);
    await page.waitForTimeout(300);
    return page.$$eval(".ops-kpi__value", (es) => es.map((e) => Number(e.textContent)));
  };

  await page.goto(`${BASE}/demos/operations`, { waitUntil: "networkidle" });
  const before = await kpis();
  check("the Overview starts at 38 open leads", before[0] === 38, String(before[0]));

  /* Create → open leads rises by one. */
  await page.goto(LEADS, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__row", POLL);
  await page.click(".ops-leads__lead-row .ops-button--primary");
  await page.waitForSelector(".ops-form", POLL);
  await page.fill(".ops-form input.ops-input", "QA Overview Probe");
  await page.selectOption(".ops-form select >> nth=0", "Referral");
  await page.click('.ops-form button[type="submit"]');
  await page.waitForSelector(".ops-overlay--drawer", POLL);
  await waitForDetail(page);
  const newId = (await page.$eval(".ops-detail__id", (e) => e.textContent)).trim();

  await page.goto(`${BASE}/demos/operations`, { waitUntil: "networkidle" });
  const afterCreate = await kpis();
  check("creating a lead raises Open leads by one",
    afterCreate[0] === before[0] + 1, `${before[0]} -> ${afterCreate[0]}`);

  /* Qualify → the funnel moves, the total does not. */
  await page.goto(`${LEADS}?selected=${newId}`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForSelector(".ops-detail__actions", POLL);
  await page.selectOption(".ops-detail__actions select >> nth=0", "Qualified");
  await page.waitForFunction(
    () => [...document.querySelectorAll(".ops-facts__value")][3]?.textContent === "Qualified",
    null,
    POLL
  );
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/demos/operations`, { waitUntil: "networkidle" });
  const afterQualify = await kpis();
  check("qualifying does not change the open total",
    afterQualify[0] === afterCreate[0], `${afterCreate[0]} -> ${afterQualify[0]}`);

  /* Lost → open leads falls. */
  await page.goto(`${LEADS}?selected=${newId}`, { waitUntil: "networkidle" });
  await waitForDetail(page);
  await page.waitForSelector(".ops-detail__actions", POLL);
  await page.selectOption(".ops-detail__actions select >> nth=0", "Lost");
  await page.waitForFunction(
    () => [...document.querySelectorAll(".ops-facts__value")][3]?.textContent === "Lost",
    null,
    POLL
  );
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/demos/operations`, { waitUntil: "networkidle" });
  const afterLost = await kpis();
  check("marking a lead Lost lowers Open leads by one",
    afterLost[0] === afterQualify[0] - 1, `${afterQualify[0]} -> ${afterLost[0]}`);

  await ctx.close();
}

/* =====================================================================
   9. PERSISTENCE AND RESET
   ===================================================================== */

section("PERSISTENCE AND RESET");
{
  const { ctx, page } = await freshLeads();

  await page.click(".ops-leads__lead-row .ops-button--primary");
  await page.waitForSelector(".ops-form", POLL);
  await page.fill(".ops-form input.ops-input", "QA Persisted Lead");
  await page.selectOption(".ops-form select >> nth=0", "Campaign");
  await page.click('.ops-form button[type="submit"]');
  await page.waitForSelector(".ops-overlay--drawer", POLL);
  await waitForDetail(page);
  const id = (await page.$eval(".ops-detail__id", (e) => e.textContent)).trim();

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__count", POLL);
  await waitForDetail(page);
  check("a created lead survives a reload",
    (await countOf(page)) === "49 leads", await countOf(page));
  check("the reloaded page reopens the selected record from the URL",
    (await page.$eval(".ops-detail__id", (e) => e.textContent)).trim() === id);

  /* The drawer is a real modal, so it blocks the chrome behind it. Closing it
     first is what a visitor would have to do too. */
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  await page.click(".demo-chrome__reset");
  await page.waitForSelector(".demo-dialog[open]", POLL);
  await page.click(".demo-dialog__button--primary");
  await page.waitForFunction(
    () => document.querySelector(".ops-leads__count")?.textContent.trim() === "48 leads",
    null,
    POLL
  );
  await page.waitForTimeout(400);
  const afterReset = await page.evaluate(() => ({
    count: document.querySelector(".ops-leads__count")?.textContent.trim(),
    role: document.querySelector(".ops-actor__role")?.textContent,
    badge: document.querySelector(".ops-notify__badge")?.textContent,
    drawer: Boolean(document.querySelector(".ops-overlay--drawer")),
    missing: Boolean(document.querySelector(".ops-detail__missing")),
  }));
  check("reset restores the canonical 48", afterReset.count === "48 leads", String(afterReset.count));
  check("reset restores the Admin role", afterReset.role === "Admin", String(afterReset.role));
  check("reset restores the eight unread notifications", afterReset.badge === "8", String(afterReset.badge));
  check("reset leaves no stale detail open", !afterReset.drawer || afterReset.missing);

  await ctx.close();
}

/* =====================================================================
   10. RESPONSIVE
   ===================================================================== */

section("RESPONSIVE");
{
  const viewports = [
    [1920, 1080], [1440, 900], [1366, 768], [1180, 820],
    [1024, 768], [768, 1024], [430, 932], [390, 844], [360, 800],
  ];

  for (const [width, height] of viewports) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await page.goto(LEADS, { waitUntil: "networkidle" });
    /* The count element exists before the query settles - it renders a blank
       placeholder - so waiting for it can outrun the data. Wait for a record. */
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".ops-leads__row").length > 0 ||
        document.querySelectorAll(".ops-leadcard").length > 0,
      null,
      POLL
    );
    await page.waitForTimeout(200);

    const m = await page.evaluate(() => {
      const visible = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).display !== "none" : false;
      };
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        table: visible(".ops-leads__table-wrap"),
        cards: visible(".ops-leads__cards"),
        inlineFilters: visible(".ops-leads__filters"),
        filterButton: visible(".ops-leads__filter-button"),
        /* Both presentations are in the DOM and one is display:none, which
           keeps it out of the accessibility tree as well as off the screen.
           Counting both would always read twenty. */
        rows: visible(".ops-leads__table-wrap")
          ? document.querySelectorAll(".ops-leads__row").length
          : document.querySelectorAll(".ops-leadcard").length,
      };
    });

    check(`${width}x${height}: no horizontal overflow`, m.overflow <= 0, `${m.overflow}px`);
    check(`${width}x${height}: exactly one list presentation`,
      m.table !== m.cards, `table ${m.table}, cards ${m.cards}`);
    check(`${width}x${height}: exactly one filter presentation`,
      m.inlineFilters !== m.filterButton, `inline ${m.inlineFilters}, button ${m.filterButton}`);
    check(`${width}x${height}: ten records are listed`, m.rows === 10, String(m.rows));

    await ctx.close();
  }
}

section("MOBILE OVERLAYS");
{
  for (const width of [390, 360]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(LEADS, { waitUntil: "networkidle" });
    await page.waitForSelector(".ops-leadcard", POLL);

    const card = await page.evaluate(() => {
      const c = document.querySelector(".ops-leadcard");
      return {
        text: c.innerText,
        height: Math.round(c.getBoundingClientRect().height),
      };
    });
    check(`${width}px: a card carries enough to choose by`,
      /Unassigned|Avery Chen/.test(card.text) && /New|Contacted|Qualified|Proposal|Won|Lost/.test(card.text),
      card.text.replace(/\n/g, " · ").slice(0, 60));
    check(`${width}px: the card is a comfortable touch target`, card.height >= 44, `${card.height}px`);

    await page.click(".ops-leads__filter-button");
    await page.waitForSelector(".ops-overlay--sheet", POLL);
    const sheet = await page.evaluate(() => {
      const d = document.querySelector(".ops-overlay--sheet");
      const r = d.getBoundingClientRect();
      return {
        full: Math.round(r.width) === window.innerWidth,
        modal: d.matches(":modal"),
        locked: getComputedStyle(document.body).overflow === "hidden",
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        notifyOpen: Boolean(document.querySelector(".ops-notify__panel")),
      };
    });
    check(`${width}px: the filter sheet fills the width`, sheet.full);
    check(`${width}px: the filter sheet is modal`, sheet.modal);
    check(`${width}px: the page behind is locked`, sheet.locked);
    check(`${width}px: no horizontal overflow while open`, sheet.overflow <= 0, `${sheet.overflow}px`);
    check(`${width}px: the notification panel is not also open`, !sheet.notifyOpen);

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL);
    check(`${width}px: Escape closes the sheet and unlocks the page`,
      await page.evaluate(() => getComputedStyle(document.body).overflow !== "hidden"));

    await page.click(".ops-leadcard");
    await page.waitForSelector(".ops-overlay--drawer", POLL);
    const detail = await page.evaluate(() => {
      const d = document.querySelector(".ops-overlay--drawer");
      const r = d.getBoundingClientRect();
      return {
        full: Math.round(r.width) === window.innerWidth,
        left: Math.round(r.left),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        close: Boolean(document.querySelector(".ops-detail__head .ops-icon-button")),
      };
    });
    check(`${width}px: the detail is a full surface, not a narrow drawer`, detail.full && detail.left === 0);
    check(`${width}px: the detail causes no horizontal overflow`, detail.overflow <= 0);
    check(`${width}px: the close control is present`, detail.close);

    /* Only one overlay may hold the screen. The guarantee is structural
       rather than coordinated: the notification sheet lays a scrim over the
       page, so the Filter button underneath cannot be reached at all while it
       is open. Asserted by hit-testing rather than by clicking, because a
       click here would be a click on the scrim. */
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
    await page.click(".ops-notify__trigger");
    await page.waitForSelector(".ops-notify__panel", POLL);
    const covered = await page.evaluate(() => {
      const btn = document.querySelector(".ops-leads__filter-button");
      const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        blocked: hit !== btn && !btn.contains(hit),
        onScrim: Boolean(hit?.classList.contains("ops-notify__scrim")),
        locked: getComputedStyle(document.body).overflow === "hidden",
      };
    });
    check(`${width}px: the notification sheet covers the module beneath it`,
      covered.blocked, `hit scrim: ${covered.onScrim}`);
    check(`${width}px: the page is locked while it is open`, covered.locked);

    /* Escape rather than a scrim click: the panel itself covers the middle of
       the scrim, which is the point a click would land on. */
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".ops-notify__panel"), null, POLL);
    check(`${width}px: dismissing it unlocks the page`,
      await page.evaluate(() => getComputedStyle(document.body).overflow !== "hidden"));

    await page.click(".ops-leads__filter-button");
    await page.waitForSelector(".ops-overlay--sheet", POLL);
    const after = await page.evaluate(() => ({
      notify: Boolean(document.querySelector(".ops-notify__panel")),
      sheet: Boolean(document.querySelector(".ops-overlay--sheet")),
    }));
    check(`${width}px: the filter sheet then opens alone`,
      after.sheet && !after.notify, `notify ${after.notify}, sheet ${after.sheet}`);

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL);
    check(`${width}px: the page scrolls again once every overlay is closed`,
      await page.evaluate(() => getComputedStyle(document.body).overflow !== "hidden"));

    await ctx.close();
  }
}

/* =====================================================================
   11. ACCESSIBILITY, CONTRAST, NETWORK, IDLE
   ===================================================================== */

section("ACCESSIBILITY AND CONTRAST");
{
  const { ctx, page } = await freshLeads();

  const a11y = await page.evaluate(() => {
    const labelled = (el) =>
      Boolean(
        el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby") ||
          (el.id && document.querySelector(`label[for="${el.id}"]`)) ||
          el.closest("label")
      );
    return {
      searchLabelled: labelled(document.querySelector(".ops-leads__search-input")),
      filtersLabelled: [...document.querySelectorAll(".ops-leads__filters .ops-control__select")].every(labelled),
      pageSizeLabelled: labelled(document.querySelector(".ops-pager__size .ops-control__select")),
      sortHeadersFocusable: [...document.querySelectorAll(".ops-th-sort")].length,
      liveRegions: document.querySelectorAll('[role="status"][aria-live="polite"]').length,
      caption: Boolean(document.querySelector(".ops-leads__table caption")),
    };
  });
  check("the search field has a real label", a11y.searchLabelled);
  check("every filter has a real label", a11y.filtersLabelled);
  check("the page-size control has a label", a11y.pageSizeLabelled);
  /* Lead, Stage, Priority, Last activity and Next follow-up. Source, Interest
     and Owner are not sortable and carry no aria-sort. */
  check("the five sortable headings are buttons",
    a11y.sortHeadersFocusable === 5, String(a11y.sortHeadersFocusable));
  check("the table has a caption", a11y.caption);
  check("there is a polite live region for results", a11y.liveRegions >= 1, String(a11y.liveRegions));

  /* Keyboard: the list must be operable without a mouse. */
  await page.click(".ops-leads__search-input");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const reachedSort = await page.evaluate(() =>
    document.activeElement?.className.includes("ops-")
  );
  check("tabbing from the search reaches the controls", reachedSort);

  await page.focus(".ops-leads__name");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".ops-overlay--drawer", POLL);
  check("a lead opens from the keyboard", true, "Enter on the name");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--drawer"), null, POLL);
  check("Escape closes the drawer", true);

  const contrast = await page.evaluate(() => {
    const out = [];
    const parse = (c) => {
      const m = c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
      return m
        ? { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) }
        : { rgb: [255, 255, 255], a: 1 };
    };
    /**
     * The colour a reader actually sees behind the text.
     *
     * The pills are deliberately translucent — `rgba(115, 168, 235, 0.16)` and
     * the like — so taking the first non-transparent background found while
     * walking up reports the tint itself rather than the tint over the surface
     * beneath it, and understates the contrast badly. Every translucent layer
     * is composited onto the one below, which is what the browser does.
     */
    const bg = (el) => {
      const layers = [];
      let node = el;
      while (node) {
        const { rgb, a } = parse(getComputedStyle(node).backgroundColor);
        if (a > 0) {
          layers.push({ rgb, a });
          if (a === 1) break;
        }
        node = node.parentElement;
      }
      let base = [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        const { rgb, a } = layers[i];
        base = rgb.map((v, k) => Math.round(v * a + base[k] * (1 - a)));
      }
      return `rgb(${base.join(", ")})`;
    };
    const targets = [
      ".ops-leads__name", ".ops-leads__count", ".ops-table td", ".ops-th-sort",
      ".ops-pager__range", ".ops-control__label", ".ops-leads__unassigned",
    ];
    /* Every distinct stage and priority tone, not merely the first one that
       happens to sort to the top of the page. */
    const seen = new Set();
    for (const el of document.querySelectorAll(".ops-pill, .ops-prio")) {
      const cls = [...el.classList].find((c) => c.includes("--"));
      if (cls && !seen.has(cls)) {
        seen.add(cls);
        targets.push(`.${cls}`);
      }
    }
    for (const sel of targets) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      out.push({
        sel,
        fg: cs.color,
        bg: bg(el),
        size: parseFloat(cs.fontSize),
        weight: Number(cs.fontWeight),
      });
    }
    return out;
  });

  for (const c of contrast) {
    const large = c.size >= 24 || (c.size >= 18.66 && c.weight >= 700);
    const need = large ? 3 : 4.5;
    const r = ratio(rgb(c.fg), rgb(c.bg));
    check(`contrast ${c.sel}`, r >= need, `${r.toFixed(2)}:1 (needs ${need})`);
  }

  await ctx.close();
}

section("NETWORK, IDLE AND CONTENT");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const requests = [];
  const problems = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

  await page.goto(LEADS, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__row", POLL);

  /* Exercise the whole surface, then check nothing left the browser. */
  await page.fill(".ops-leads__search-input", "alina");
  await page.waitForTimeout(150);
  await page.fill(".ops-leads__search-input", "");
  await page.selectOption(".ops-leads__filters .ops-control__select >> nth=0", "Qualified");
  await page.waitForTimeout(150);
  await page.click(".ops-link-button");
  await page.waitForTimeout(150);
  await page.click(".ops-leads__name >> nth=0");
  await page.waitForSelector(".ops-overlay--drawer", POLL);
  await page.selectOption(".ops-detail__actions select >> nth=0", "Contacted");
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const app = requests.filter((u) => !u.startsWith("data:"));
  const external = app.filter((u) => !u.startsWith(BASE));
  const api = app.filter((u) => u.includes("/api/"));
  check("no external request", external.length === 0, external.slice(0, 3).join(" "));
  check("no API route call", api.length === 0, api.slice(0, 3).join(" "));
  const serious = problems.filter((t) => !/was preloaded using link preload but not used/.test(t));
  check("no console errors, hydration warnings or failed resources",
    serious.length === 0, serious.slice(0, 2).join(" | "));

  const idle = await page.evaluate(async () => {
    let frames = 0;
    let timers = 0;
    const rafOriginal = window.requestAnimationFrame;
    const setIntervalOriginal = window.setInterval;
    window.requestAnimationFrame = (cb) => {
      frames += 1;
      return rafOriginal(cb);
    };
    window.setInterval = (...args) => {
      timers += 1;
      return setIntervalOriginal(...args);
    };
    await new Promise((r) => setTimeout(r, 1200));
    window.requestAnimationFrame = rafOriginal;
    window.setInterval = setIntervalOriginal;
    return { frames, timers };
  });
  check("no animation frames while idle", idle.frames === 0, String(idle.frames));
  check("no intervals started while idle", idle.timers === 0, String(idle.timers));

  const text = await page.evaluate(() => document.body.innerText);
  for (const [name, re] of Object.entries({
    email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    telephone: /[+]?\d[\d\s().-]{7,}\d/,
    handle: /(^|\s)@[a-z0-9_]{3,}/i,
    brand: /\b(honda|yamaha|suzuki|kawasaki|ducati|harley|vespa|piaggio|ktm)\b/i,
  })) {
    const hit = text.match(re);
    check(`no ${name} in the rendered module`, hit === null, hit ? hit[0] : "");
  }

  await ctx.close();
}

section("PERFORMANCE SANITY");
{
  const { ctx, page } = await freshLeads();

  /* Measured in the page: driving these through Playwright reports seconds,
     because its default rAF polling starves against an application that
     schedules no frames at rest. QA SANITY, NOT A PUBLISHED BENCHMARK. */
  const timings = await page.evaluate(async () => {
    const settle = () => new Promise((r) => setTimeout(r, 0));
    const time = async (fn) => {
      const t0 = performance.now();
      await fn();
      await settle();
      return Math.round(performance.now() - t0);
    };
    const input = document.querySelector(".ops-leads__search-input");
    const set = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const search = await time(async () => set(input, "alina"));
    const clear = await time(async () => set(input, ""));
    const sel = document.querySelectorAll(".ops-leads__filters .ops-control__select")[0];
    const filter = await time(async () => {
      sel.value = "Qualified";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return { search, clear, filter };
  });
  check("search responds immediately", timings.search < 400, `${timings.search} ms`);
  check("clearing responds immediately", timings.clear < 400, `${timings.clear} ms`);
  check("filtering responds immediately", timings.filter < 400, `${timings.filter} ms`);
  console.log("  QA SANITY MEASUREMENT — NOT A PRODUCTION BENCHMARK.");

  const cls = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) total += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 900);
      })
  );
  check("layout is stable after load", cls < 0.02, cls.toFixed(5));

  await ctx.close();
}


/* =====================================================================
   12. CONTROL PRESENTATION (Stage 09C3.1.1)
   ===================================================================== */

section("FILTER AND SORT CONTROLS");
{
  const { ctx, page } = await freshLeads();

  const controls = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".ops-leads__filters .ops-control")) {
      const select = el.querySelector("select");
      const label = el.querySelector(".ops-control__label");
      const chevron = el.querySelector("svg.ops-control__chevron");
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const ss = getComputedStyle(select);
      out.push({
        label: label?.textContent ?? null,
        labelInside: label ? el.contains(label) : false,
        value: select.selectedOptions[0]?.textContent ?? "",
        height: Math.round(r.height),
        radius: parseFloat(cs.borderTopLeftRadius),
        fontSize: parseFloat(ss.fontSize),
        padding: parseFloat(cs.paddingLeft),
        appearance: ss.appearance,
        ariaLabel: select.getAttribute("aria-label"),
        chevron: Boolean(chevron),
        chevronHidden: chevron?.getAttribute("aria-hidden") === "true",
        labelHidden: label?.getAttribute("aria-hidden") === "true",
        optionCount: select.options.length,
      });
    }
    return out;
  });

  check("the toolbar renders four controls", controls.length === 4, String(controls.length));

  for (const c of controls) {
    const name = (c.label ?? "sort").toLowerCase();
    /* The label used to be a separate word sitting beside the select. Inside
       the same border it reads as one control rather than two things that
       happen to be adjacent. */
    check(`${name}: the label sits inside the control`, c.labelInside);
    check(`${name}: height is 40-42px`, c.height >= 40 && c.height <= 42, `${c.height}px`);
    check(`${name}: radius is 11-12px`, c.radius >= 11 && c.radius <= 12, `${c.radius}px`);
    check(`${name}: value text is 13-14px`, c.fontSize >= 13 && c.fontSize <= 14, `${c.fontSize}px`);
    check(`${name}: horizontal padding is 12-14px`, c.padding >= 12 && c.padding <= 14, `${c.padding}px`);
    /* The platform arrow is replaced rather than hidden behind another one. */
    check(`${name}: the native arrow is removed`, c.appearance === "none", c.appearance);
    check(`${name}: a locally drawn chevron replaces it`, c.chevron);
    check(`${name}: the chevron is decorative`, c.chevronHidden);
    check(`${name}: the visible label is not announced twice`, c.labelHidden !== false);
    check(`${name}: the control has an accessible name`, Boolean(c.ariaLabel), String(c.ariaLabel));
  }

  /* Sort is one control now. The separate direction button is gone, and each
     option states its field and its direction. */
  const sort = controls[3];
  check("sort has no separate direction button",
    (await page.$(".ops-sort-dir")) === null);
  check("sort is announced as Sort leads", sort.ariaLabel === "Sort leads", String(sort.ariaLabel));
  check("sort offers each field in both directions", sort.optionCount === 12, String(sort.optionCount));

  const sortOptions = await page.$$eval(
    ".ops-leads__filters .ops-control__select >> nth=3 >> option",
    (os) => os.map((o) => o.textContent)
  );
  for (const expected of [
    "Last activity — newest",
    "Last activity — oldest",
    "Next follow-up — soonest",
    "Lead name — A–Z",
  ]) {
    check(`sort offers "${expected}"`, sortOptions.includes(expected));
  }
  check("every sort option names a direction",
    sortOptions.every((o) => o.includes("—")), sortOptions[0]);

  /* Setting a filter is visible without shouting. */
  const before = await page.$eval(".ops-leads__filters .ops-control", (e) => e.dataset.active ?? "-");
  await page.selectOption(".ops-leads__filters .ops-control__select >> nth=0", "Qualified");
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => {
    const el = document.querySelector(".ops-leads__filters .ops-control");
    const cs = getComputedStyle(el);
    return {
      active: el.dataset.active ?? "-",
      value: el.querySelector("select").selectedOptions[0].textContent,
      bg: cs.backgroundColor,
      height: Math.round(el.getBoundingClientRect().height),
    };
  });
  check("a default filter is not marked active", before === "-", before);
  check("a set filter is marked active", after.active === "true", after.active);
  check("the marked state keeps the value visible", after.value === "Qualified", after.value);
  check("marking a filter does not resize it", after.height >= 40 && after.height <= 42, `${after.height}px`);

  /* The longest value in the product must not break the row. */
  await page.selectOption(".ops-leads__filters .ops-control__select >> nth=1", "Returning customer");
  await page.waitForTimeout(250);
  const longest = await page.evaluate(() => ({
    clipped: [...document.querySelectorAll(".ops-leads__filters *")].filter(
      (e) => e.scrollWidth - e.clientWidth > 1
    ).length,
    rowHeight: Math.round(document.querySelector(".ops-leads__filters").getBoundingClientRect().height),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check("the longest source value does not clip", longest.clipped === 0, `${longest.clipped}`);
  check("the longest source value does not rewrap the toolbar",
    longest.rowHeight >= 40 && longest.rowHeight <= 44, `${longest.rowHeight}px`);
  check("the longest source value causes no overflow", longest.overflow <= 0, `${longest.overflow}px`);

  /* Keyboard reach and a visible ring. */
  await page.focus(".ops-leads__filters .ops-control__select");
  const focused = await page.evaluate(() => {
    const el = document.querySelector(".ops-leads__filters .ops-control");
    const cs = getComputedStyle(el);
    return {
      isSelect: document.activeElement?.tagName === "SELECT",
      outlineWidth: parseFloat(cs.outlineWidth),
      outlineStyle: cs.outlineStyle,
    };
  });
  check("a filter is reachable by keyboard", focused.isSelect);
  check("focus draws a visible ring on the control",
    focused.outlineWidth >= 2 && focused.outlineStyle !== "none",
    `${focused.outlineWidth}px ${focused.outlineStyle}`);

  await ctx.close();
}

section("PAGE SIZE AND PAGINATION COMPOSITION");
{
  const { ctx, page } = await freshLeads();

  const size = await page.evaluate(() => {
    const el = document.querySelector(".ops-pager__size .ops-control");
    const select = el.querySelector("select");
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      height: Math.round(r.height),
      width: Math.round(r.width),
      radius: parseFloat(cs.borderTopLeftRadius),
      padding: parseFloat(cs.paddingLeft),
      value: select.selectedOptions[0].textContent,
      options: [...select.options].map((o) => o.textContent),
      ariaLabel: select.getAttribute("aria-label"),
      appearance: getComputedStyle(select).appearance,
      chevron: Boolean(el.querySelector("svg.ops-control__chevron")),
    };
  });

  /* "10" was a number with no question attached to it. */
  check("the page size says what it counts", size.value === "10 rows", size.value);
  check("both page sizes are offered as rows",
    size.options.join("|") === "10 rows|20 rows", size.options.join("|"));
  check("page size height is 38-40px", size.height >= 38 && size.height <= 40, `${size.height}px`);
  check("page size width is 92-104px", size.width >= 92 && size.width <= 104, `${size.width}px`);
  check("page size radius is 11-12px", size.radius >= 11 && size.radius <= 12, `${size.radius}px`);
  check("page size padding is 14px", size.padding === 14, `${size.padding}px`);
  check("page size has an accessible name", size.ariaLabel === "Rows per page", String(size.ariaLabel));
  check("page size drops the native arrow", size.appearance === "none");
  check("page size carries the drawn chevron", size.chevron);

  /* One footer, not three fragments. */
  const pager = await page.evaluate(() => {
    const bar = document.querySelector(".ops-pager");
    const cs = getComputedStyle(bar);
    const box = (s) => {
      const e = document.querySelector(s);
      const r = e.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) };
    };
    return {
      borderTop: parseFloat(cs.borderTopWidth),
      range: box(".ops-pager__range"),
      nav: box(".ops-pager__nav"),
      size: box(".ops-pager__size"),
      steps: [...document.querySelectorAll(".ops-pager__step")].map((b) => ({
        text: b.textContent.trim(),
        disabled: b.disabled,
        height: Math.round(b.getBoundingClientRect().height),
      })),
      page: document.querySelector(".ops-pager__page")?.textContent.trim(),
      live: document.querySelector(".ops-pager__page")?.getAttribute("aria-live"),
    };
  });

  check("the footer is one bar with a rule above it", pager.borderTop >= 1, `${pager.borderTop}px`);
  check("its three zones share one baseline",
    Math.abs(pager.range.top - pager.nav.top) < 24 && Math.abs(pager.nav.top - pager.size.top) < 24,
    `${pager.range.top}/${pager.nav.top}/${pager.size.top}`);
  check("the controls sit between the range and the page size",
    pager.range.right <= pager.nav.left && pager.nav.right <= pager.size.right);
  check("Previous and Next are the two steps",
    pager.steps.length === 2 &&
      /Previous/.test(pager.steps[0].text) &&
      /Next/.test(pager.steps[1].text),
    pager.steps.map((s) => s.text).join(" | "));
  /* A real disabled button, so it is announced as one rather than merely
     looking inert. */
  check("Previous is genuinely disabled on page one", pager.steps[0].disabled === true);
  check("Next is available on page one", pager.steps[1].disabled === false);
  check("the steps match the page-size height",
    pager.steps.every((s) => s.height >= 38 && s.height <= 40),
    pager.steps.map((s) => s.height).join("/"));
  check("the page indicator is announced politely", pager.live === "polite", String(pager.live));

  /* Both page sizes, and the page arithmetic that follows from them. */
  await page.selectOption(".ops-pager__size .ops-control__select", "20");
  await page.waitForTimeout(250);
  const twenty = await page.evaluate(() => ({
    rows: document.querySelectorAll(".ops-leads__row").length,
    page: document.querySelector(".ops-pager__page").textContent.trim(),
    range: document.querySelector(".ops-pager__range").textContent.trim(),
  }));
  check("20 rows lists twenty records", twenty.rows === 20, String(twenty.rows));
  check("20 rows recomputes the page count", twenty.page === "Page 1 of 3", twenty.page);
  check("20 rows recomputes the range", twenty.range === "1–20 of 48", twenty.range);

  await page.click(".ops-pager__step >> nth=1");
  await page.waitForTimeout(200);
  await page.click(".ops-pager__step >> nth=1");
  await page.waitForTimeout(200);
  const last = await page.evaluate(() => ({
    page: document.querySelector(".ops-pager__page").textContent.trim(),
    nextDisabled: document.querySelectorAll(".ops-pager__step")[1].disabled,
    prevDisabled: document.querySelectorAll(".ops-pager__step")[0].disabled,
  }));
  check("the last page disables Next", last.nextDisabled === true, last.page);
  check("the last page keeps Previous available", last.prevDisabled === false);

  await page.selectOption(".ops-pager__size .ops-control__select", "10");
  await page.waitForTimeout(250);
  const back = await page.evaluate(() => document.querySelector(".ops-pager__page").textContent.trim());
  check("changing the page size returns to a valid page", /Page [1-5] of 5/.test(back), back);

  await ctx.close();
}

section("PROVENANCE BAND");
{
  for (const [width, height] of [[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [360, 800]]) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await page.goto(LEADS, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".ops-leads__row").length > 0 ||
        document.querySelectorAll(".ops-leadcard").length > 0,
      null,
      POLL
    );
    await page.waitForTimeout(200);

    const m = await page.evaluate(() => {
      const band = document.querySelector(".demo-disclosure");
      const back = document.querySelector(".demo-chrome__back");
      const controls = document.querySelector(".demo-chrome__controls");
      const inner = document.querySelector(".demo-chrome__inner");
      const b = band.getBoundingClientRect();
      const k = back.getBoundingClientRect();
      const c = controls.getBoundingClientRect();
      const i = inner.getBoundingClientRect();
      const text = band.querySelector(".demo-disclosure__primary").getBoundingClientRect();
      return {
        bandWidth: Math.round(b.width),
        innerWidth: Math.round(i.width),
        share: b.width / i.width,
        sameRowAsBack: Math.abs(b.top - k.top) < 6,
        /* Content starts at the left edge of the band rather than floating in
           the middle of it. */
        textOffset: Math.round(text.left - b.left),
        primary: band.querySelector(".demo-disclosure__primary").textContent,
        secondary: band.querySelector(".demo-disclosure__secondary").textContent,
        gapToControls: Math.round(c.left - b.right),
        backWidth: Math.round(k.width),
        controlsWidth: Math.round(c.width),
        columnGap: parseFloat(getComputedStyle(inner).columnGap) || 0,
        innerPadding:
          parseFloat(getComputedStyle(inner).paddingLeft) +
          parseFloat(getComputedStyle(inner).paddingRight),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chromeHeight: Math.round(document.querySelector(".demo-chrome").getBoundingClientRect().height),
      };
    });

    check(`${width}px: the disclosure keeps its exact words`,
      m.primary === "INTERACTIVE ENGINEERING DEMO" &&
        m.secondary === "SYNTHETIC DATA · FRONTEND ONLY",
      `${m.primary} / ${m.secondary}`);
    check(`${width}px: the band's content is left-aligned inside it`,
      m.textOffset <= 16, `${m.textOffset}px from the left edge`);
    check(`${width}px: no horizontal overflow`, m.overflow <= 0, `${m.overflow}px`);

    if (width >= 861) {
      /* The band takes the middle column rather than sitting at the width of
         its own text with several hundred pixels of nothing beside it.
         
         Measured against what is actually available — the bar minus the two
         intrinsic ends — rather than as a share of the whole. The ends are a
         fixed ~430px, so at 1024 they are half the bar and at 1920 a fifth;
         a percentage-of-total threshold would be asserting the viewport
         width, not the behaviour. */
      const available =
        m.innerWidth - m.innerPadding - m.backWidth - m.controlsWidth - 2 * m.columnGap;
      check(`${width}px: the band fills the space between the two ends`,
        m.bandWidth >= available - 4,
        `${m.bandWidth}px of ${Math.round(available)}px available`);
      check(`${width}px: it reaches the controls`, m.gapToControls <= 24, `${m.gapToControls}px`);
      check(`${width}px: it shares the row with the back link`, m.sameRowAsBack);
      check(`${width}px: the bar stays within its height budget`,
        m.chromeHeight >= 32 && m.chromeHeight <= 40, `${m.chromeHeight}px`);
    } else {
      check(`${width}px: the band takes a row of its own`, !m.sameRowAsBack);
      check(`${width}px: it spans that row`, m.share > 0.9, `${(m.share * 100).toFixed(0)}%`);
    }

    await ctx.close();
  }
}

await browser.close();

console.log(
  `\n=== stage09c3.1 leads: ${failures === 0 ? `ALL PASS (${checks} checks)` : `${failures} FAILURE(S) of ${checks}`} ===`
);
process.exit(failures === 0 ? 0 : 1);
