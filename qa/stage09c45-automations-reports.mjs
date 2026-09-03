/**
 * Stage 09C4.5 - Operations Automations and Reports QA.
 *
 * One suite for two modules, because they are the two ends of the same claim.
 * Automations is where the product acts on its own records; Reports is where
 * it counts what those records now say. Neither is a list, neither has a
 * drawer, and between them they carry the two failures a demo of this kind is
 * most likely to ship:
 *
 *   1. a rule switch that colours a chip and changes nothing, and
 *   2. a report figure that was written down rather than counted.
 *
 * So the weight of this file sits in two places. The Automations sections walk
 * every one of the five canonical rules through the module a visitor would
 * actually use, and read the store afterwards to ask what the click left
 * behind: a disabled rule has to record a Skipped run and withhold its effect,
 * and Test has to write a run without moving a single business record. The
 * Reports sections check the figures against the canonical seed, prove that
 * every share is printed with its denominator, and then move a payment through
 * the product to watch the panels follow it. That last one is specification
 * workflow W3, and the sentence it exists to keep is "the Overview and Reports
 * figures move with it".
 *
 * The reader-dependent sections need a route that only exists during a QA run:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c45-automations-reports.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host,
 * 3100 is production and 3000 is the documented development preview.
 *
 * Against production those sections print a SKIP line and the rest still runs,
 * so a green exit here means both screens are sound either way.
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const ROOT = `${BASE}/demos/operations`;
const AUTOMATIONS = `${ROOT}/automations`;
const REPORTS = `${ROOT}/reports`;
const LEADS = `${ROOT}/leads`;
const RESERVATIONS = `${ROOT}/reservations`;
const MAINTENANCE = `${ROOT}/maintenance`;
const PAYMENTS = `${ROOT}/payments`;
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

/** What each route has rendered once it has something to show. */
const READY = {
  automations: ".ops-rule, .ops-unavailable",
  reports: ".ops-panel__title, .ops-unavailable",
  list: ".ops-leads__count, .ops-unavailable",
};

/** The five rules, frozen, in seed order. */
const RULE_IDS = [
  "automation_rule_0001",
  "automation_rule_0002",
  "automation_rule_0003",
  "automation_rule_0004",
  "automation_rule_0005",
];
const RULE_NAMES = [
  "New website lead assignment",
  "Qualified lead follow-up",
  "Reservation confirmation message",
  "Overdue payment alert",
  "Maintenance completion notice",
];
const RULE_EVENTS = [
  "lead.created.website",
  "lead.qualified",
  "reservation.confirmed",
  "payment.overdue",
  "maintenance.completed",
];

/** The four report groups the specification freezes, in order. */
const PANELS = [
  "Lead funnel",
  "Fleet utilisation",
  "Contract status and value",
  "Payment status",
];

const browser = await chromium.launch();

/** A page on one of the module routes, with its content rendered. */
async function fresh(viewport = { width: 1440, height: 900 }, path = AUTOMATIONS, ready = READY.automations) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForSelector(ready, POLL).catch(() => {});
  await page.waitForTimeout(250);
  /* A brand new context can go several seconds without producing a frame, and
     until it does every rect reads stale and every transition reads unstarted.
     A throwaway capture forces one, cheaply, before anything is measured. */
  await page.screenshot({ type: "jpeg", quality: 20 });
  return { ctx, page, problems };
}

/** Move an existing page to another module and wait for it to arrive. */
async function go(page, path, ready) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForSelector(ready, POLL).catch(() => {});
  await page.waitForTimeout(300);
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
const ROLE_SELECT = ".ops-role__select .demo-select__trigger";
const PERIOD_SELECT = ".ops-reports__head .demo-select__trigger";

const textOf = (page, sel, d = "-") =>
  page.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim()).catch(() => d);
const allOf = (page, sel) =>
  page.$$eval(sel, (n) => n.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const countOf = (page) => textOf(page, ".ops-leads__count");
/* No `marksOf` or `actionsOf` here, unlike every other module suite: neither of
   these two screens has a detail drawer to read them off. */

const gone = (page, sel) =>
  page.waitForFunction((s) => !document.querySelector(s), sel, POLL);

const waitForDetail = (page) =>
  page.waitForFunction(
    () =>
      Boolean(document.querySelector(".ops-detail__id")) ||
      Boolean(document.querySelector(".ops-detail__missing")),
    null,
    POLL
  );

/**
 * Close whatever overlay is up, and wait for it to be gone.
 *
 * Not politeness: every overlay in this product is a native modal `<dialog>`,
 * so the chrome behind it is genuinely inert and a click on the role select or
 * the reset button while one is open will sit there until it times out.
 */
async function closeOverlay(page) {
  if (!(await page.$(".ops-overlay"))) return;
  await page.keyboard.press("Escape");
  await gone(page, ".ops-overlay").catch(() => {});
  await page.waitForTimeout(250);
}

/**
 * Focus something the way a person does, with the keyboard.
 *
 * The report bars are focusable list items styled through `:focus-visible`,
 * which a scripted `element.focus()` deliberately does not match. Stepping off
 * and back on with Tab is the smallest honest way to ask the question a
 * keyboard visitor is really asking.
 */
async function focusByKeyboard(page, selector) {
  await page.focus(selector);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  return page.evaluate((sel) => {
    const el = document.activeElement;
    if (!el) return { onTarget: false, ring: "none:0px" };
    const cs = getComputedStyle(el);
    return { onTarget: el.matches(sel), ring: `${cs.outlineStyle}:${cs.outlineWidth}` };
  }, selector);
}

/** `USD 1234.56` back to the integer cents the domain actually stores. */
const centsOf = (text) => {
  const m = /USD\s+(-?)(\d+)\.(\d{2})/.exec(text ?? "");
  if (!m) return null;
  const value = Number(m[2]) * 100 + Number(m[3]);
  return m[1] === "-" ? -value : value;
};

/* =====================================================================
   READING THE TWO SCREENS
   ===================================================================== */

/** Every rule card, as the page presents it. */
const rulesOf = (page) =>
  page.$$eval(".ops-rule", (cards) =>
    cards.map((card) => {
      const text = (sel) =>
        card.querySelector(sel)?.textContent.replace(/\s+/g, " ").trim() ?? null;
      const firstMeta = card.querySelector(".ops-rule__meta span");
      return {
        name: text(".ops-rule__name"),
        state: text(".ops-rule__head .ops-pill"),
        when: text(".ops-rule__when"),
        event: text(".ops-rule__event"),
        action: text(".ops-rule__action"),
        meta: text(".ops-rule__meta"),
        runCount: Number((firstMeta?.textContent ?? "").replace(/[^0-9]/g, "")),
        lastStatus: text(".ops-rule__last .ops-pill"),
        lastSummary: text(".ops-rule__last-summary"),
        buttons: [...card.querySelectorAll(".ops-rule__foot .ops-button")].map((b) =>
          b.textContent.replace(/\s+/g, " ").trim()
        ),
        link: card.querySelector(".ops-rule__meta a")?.getAttribute("href") ?? null,
        quiet: card.classList.contains("ops-rule--off"),
      };
    })
  );

/** The run history panel beside the rules. */
const historyOf = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector(".ops-automations .ops-panel");
    if (!panel) return null;
    return {
      title: panel.querySelector("#ops-runs-title")?.textContent.replace(/\s+/g, " ").trim() ?? null,
      note: panel.querySelector(".ops-panel__note")?.textContent.replace(/\s+/g, " ").trim() ?? null,
      items: panel.querySelectorAll(".ops-runs__item").length,
      rules: [...panel.querySelectorAll(".ops-runs__rule")].map((e) => e.textContent.trim()),
      statuses: [...panel.querySelectorAll(".ops-runs__item .ops-pill")].map((e) =>
        e.textContent.trim()
      ),
      summaries: [...panel.querySelectorAll(".ops-runs__summary")].length,
      showAll: Boolean(panel.querySelector("button.ops-link-button")),
    };
  });

/**
 * One report panel, read by its title.
 *
 * Bars, legend and figures together, because the assertions this suite makes
 * are about the relationships between them: a count against its bar, a share
 * against its denominator, a figure against the note that says what it is a
 * proportion of.
 */
const panelOf = (page, title) =>
  page.evaluate((wanted) => {
    const panels = [...document.querySelectorAll(".ops-reports .ops-panel")];
    const hit = panels.find(
      (p) => p.querySelector(".ops-panel__title")?.textContent.trim() === wanted
    );
    if (!hit) return null;
    const clean = (el) => el?.textContent.replace(/\s+/g, " ").trim() ?? "";
    return {
      note: clean(hit.querySelector(".ops-panel__note")),
      bars: [...hit.querySelectorAll(".ops-statbar")].map((bar) => ({
        label: clean(bar.querySelector(".ops-statbar__label")),
        count: clean(bar.querySelector(".ops-statbar__count")),
        share: clean(bar.querySelector(".ops-statbar__share")),
        scale: bar.querySelector(".ops-statbar__fill")?.style.transform ?? "",
      })),
      legend: [...hit.querySelectorAll(".ops-fleet__row")].map((row) => ({
        status: clean(row.querySelector(".ops-fleet__status")),
        count: clean(row.querySelector(".ops-fleet__count")),
      })),
      segments: hit.querySelectorAll(".ops-fleet__seg").length,
      figures: [...hit.querySelectorAll(".ops-figures > *")].map((f) => ({
        label: clean(f.querySelector(".ops-figure__label")),
        value: clean(f.querySelector(".ops-figure__value")),
        note: clean(f.querySelector(".ops-figure__note")),
      })),
    };
  }, title);

/** The bar counts of one panel as a plain object, for comparing with the seed. */
const barsOf = (panel) =>
  Object.fromEntries((panel?.bars ?? []).map((b) => [b.label, Number(b.count)]));

const sumOf = (panel) =>
  (panel?.bars ?? []).reduce((total, b) => total + Number(b.count), 0);

/** One figure inside a panel, by its label. */
const figureOf = (panel, label) =>
  (panel?.figures ?? []).find((f) => f.label === label) ?? null;

/* =====================================================================
   1. AUTOMATIONS: SHAPE, AND THE ABSENCES
   ===================================================================== */

section("AUTOMATIONS - FIVE RULES AND NOTHING ELSE");
{
  const { ctx, page, problems } = await fresh();

  check("the route renders the module", (await page.$(".ops-automations")) !== null);
  const cards = await rulesOf(page);
  check("five rule cards", cards.length === 5, String(cards.length));
  check(
    "named in the frozen order",
    cards.map((c) => c.name).join(" | ") === RULE_NAMES.join(" | "),
    cards.map((c) => c.name).join(" | ")
  );
  /* The event type beside the sentence is the one line that ties a card to the
     code, so it is asserted literally rather than by description. */
  check(
    "each carries its raw trigger, in the same order",
    cards.map((c) => c.event).join(",") === RULE_EVENTS.join(","),
    cards.map((c) => c.event).join(",")
  );
  check(
    "and a sentence a reader can use instead",
    cards.every((c) => typeof c.when === "string" && c.when.length > 12 && c.when !== c.event),
    cards[0]?.when ?? ""
  );
  check(
    "every card says what it does",
    cards.every((c) => typeof c.action === "string" && c.action.length > 0),
    cards.find((c) => !c.action)?.name ?? ""
  );

  /* State as a word, never as a hue alone: a reader who cannot separate two
     soft colours would otherwise be reading nothing at all. */
  check(
    "every card states Enabled or Disabled in words",
    cards.length === 5 && cards.every((c) => c.state === "Enabled" || c.state === "Disabled"),
    cards.map((c) => c.state).join(",")
  );
  check(
    "and the canonical seed has all five enabled",
    cards.every((c) => c.state === "Enabled"),
    cards.map((c) => c.state).join(",")
  );
  check(
    "each reports its run count and its tally",
    cards.every((c) => /\d+ runs?/.test(c.meta) && /succeeded/.test(c.meta) && /skipped/.test(c.meta) && /failed/.test(c.meta)),
    cards[0]?.meta ?? ""
  );
  check(
    "and where to make the trigger happen for real",
    cards.every((c) => typeof c.link === "string" && c.link.startsWith("/demos/operations/")),
    cards.map((c) => c.link).join(" ")
  );

  check(
    "every card offers Test rule",
    cards.every((c) => c.buttons.some((b) => b.startsWith("Test rule"))),
    cards.find((c) => !c.buttons.some((b) => b.startsWith("Test rule")))?.name ?? ""
  );
  check(
    "and View runs",
    cards.every((c) => c.buttons.some((b) => b.startsWith("View runs"))),
    cards.find((c) => !c.buttons.some((b) => b.startsWith("View runs")))?.name ?? ""
  );
  check(
    "with one switch each, reading Disable while enabled",
    cards.every((c) => c.buttons.filter((b) => /^(Enable|Disable)/.test(b)).length === 1) &&
      cards.every((c) => c.buttons.some((b) => b.startsWith("Disable"))),
    cards[0]?.buttons.join(" | ") ?? ""
  );

  const history = await historyOf(page);
  check("the history opens on every rule", history?.title === "Recent runs", String(history?.title));
  check("with runs in it", (history?.items ?? 0) > 0, String(history?.items));
  check(
    "each naming its rule rather than an id",
    (history?.rules ?? []).length === history?.items &&
      (history?.rules ?? []).every((r) => RULE_NAMES.includes(r)),
    (history?.rules ?? []).slice(0, 2).join(" | ")
  );
  check(
    "each carrying its own outcome word",
    (history?.statuses ?? []).length === history?.items &&
      (history?.statuses ?? []).every((s) => /^(Success|Skipped|Failed)$/.test(s)),
    (history?.statuses ?? []).slice(0, 3).join(",")
  );
  check("and a summary line", history?.summaries === history?.items, `${history?.summaries}/${history?.items}`);
  check(
    "the tally names all three outcomes",
    /succeeded/.test(history?.note ?? "") && /skipped/.test(history?.note ?? "") && /failed/.test(history?.note ?? ""),
    history?.note ?? ""
  );

  /* The absences this module is designed around. Five frozen rules are not a
     list anyone searches, filters or pages, and there is no rule record to
     open in a drawer, so none of that grammar may have arrived by habit. */
  const shape = await page.evaluate(() => ({
    tables: document.querySelectorAll(".ops-automations table").length,
    searches: document.querySelectorAll('.ops-automations input[type="search"]').length,
    inputs: document.querySelectorAll(".ops-automations input, .ops-automations textarea").length,
    pagers: document.querySelectorAll(".ops-automations .ops-pager").length,
    rows: document.querySelectorAll(".ops-automations .ops-leads__row").length,
    cards: document.querySelectorAll(".ops-automations .ops-leadcard").length,
    selects: document.querySelectorAll('.ops-automations [role="combobox"]').length,
    detail: document.querySelectorAll(".ops-detail__id").length,
  }));
  check("no table", shape.tables === 0, String(shape.tables));
  check("no search input", shape.searches === 0 && shape.inputs === 0, `${shape.searches}/${shape.inputs}`);
  check("no pagination", shape.pagers === 0, String(shape.pagers));
  check("no list rows or cards", shape.rows === 0 && shape.cards === 0, `${shape.rows}/${shape.cards}`);
  check("no filter or sort select", shape.selects === 0, String(shape.selects));
  check("and no drawer", shape.detail === 0, String(shape.detail));

  /* Nothing here is deep-linked. Narrowing the history is a reading aid on one
     screen rather than a selection worth putting in the URL. */
  const html = await page.content();
  check("nothing on the page carries a selection parameter", !html.includes("selected="));
  await page.click('.ops-rule >> nth=0 >> button:has-text("View runs")');
  await page.waitForTimeout(400);
  check("and narrowing the history leaves the URL alone", page.url() === AUTOMATIONS, page.url());

  check("the shape console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   THE READER
   ===================================================================== */

/**
 * A reader onto the same store the screen is using.
 *
 * The probe route builds a runtime on the default adapter, which is the same
 * IndexedDB these screens persist to, in the same browser context and
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

/**
 * The whole world, re-read after the screen has written.
 *
 * Wider than any one section needs, because the assertion that matters most
 * here is the negative one: a rule fired, and nothing else moved. Records are
 * `{ id, data }` wrappers, so every status lives at `r.data.status`.
 */
const readWorld = (reader) =>
  reader.evaluate(async () => {
    const rt = window.__qaRuntime;
    const [rules, runs, notes, messages, conversations, leads, vehicles, contracts, reservations, work, payments] =
      await Promise.all([
        rt.repository.all("automation_rules"),
        rt.repository.all("automation_runs"),
        rt.repository.all("notifications"),
        rt.repository.all("messages"),
        rt.repository.all("conversations"),
        rt.repository.all("leads"),
        rt.repository.all("vehicles"),
        rt.repository.all("contracts"),
        rt.repository.all("reservations"),
        rt.repository.all("maintenance"),
        rt.repository.all("payments"),
      ]);

    const tally = (rows, key = "status") =>
      rows.reduce((acc, r) => {
        acc[r.data[key]] = (acc[r.data[key]] ?? 0) + 1;
        return acc;
      }, {});

    const system = messages.filter((m) => m.data.authorType === "System");

    return {
      rules: Object.fromEntries(
        rules.map((r) => [r.id, { name: r.data.name, enabled: r.data.enabled, runCount: r.data.runCount }])
      ),
      runs: {
        total: runs.length,
        byRule: tally(runs, "ruleId"),
        byId: Object.fromEntries(
          runs.map((r) => [
            r.id,
            {
              ruleId: r.data.ruleId,
              status: r.data.status,
              summary: r.data.summary,
              sourceEventId: r.data.sourceEventId,
            },
          ])
        ),
      },
      notes: {
        total: notes.length,
        byCategory: tally(notes, "category"),
        byId: Object.fromEntries(
          notes.map((n) => [
            n.id,
            {
              category: n.data.category,
              role: n.data.actorRole,
              type: n.data.sourceEntityType,
              source: n.data.sourceEntityId,
              title: n.data.title,
            },
          ])
        ),
      },
      messages: {
        total: messages.length,
        system: system.length,
        lastSystemBody: system.length > 0 ? system[system.length - 1].data.body : null,
      },
      conversations: {
        total: conversations.length,
        unread: conversations.filter((c) => c.data.unread).length,
      },
      counts: {
        leads: leads.length,
        vehicles: vehicles.length,
        contracts: contracts.length,
        reservations: reservations.length,
        work: work.length,
        payments: payments.length,
      },
      tallies: {
        vehicles: tally(vehicles),
        contracts: tally(contracts),
        reservations: tally(reservations),
        work: tally(work),
      },
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

/** The ids present after a change and absent before it. */
const added = (before, after) => Object.keys(after).filter((id) => !(id in before));

/**
 * The one new AutomationRun, or the reason there is not exactly one.
 *
 * Every rule section asks the same question, and asking it by set difference
 * rather than by count means a run written for the wrong rule is caught even
 * when the arithmetic happens to work out.
 */
const oneRun = (before, after, ruleId, status = "Success") => {
  const ids = added(before.runs.byId, after.runs.byId);
  const run = ids.length === 1 ? after.runs.byId[ids[0]] : null;
  return {
    ids,
    run,
    id: ids[0] ?? null,
    ok: Boolean(run) && run.ruleId === ruleId && run.status === status,
    detail: ids.length !== 1 ? `${ids.length} new runs` : `${run.ruleId} ${run.status}`,
  };
};

/** The notifications one action raised, as their stored records. */
const newNotes = (before, after) =>
  added(before.notes.byId, after.notes.byId).map((id) => after.notes.byId[id]);

/**
 * Drive one rule through the module a visitor would really use.
 *
 * A fresh context per rule, so each starts from the canonical seed rather than
 * from whatever the previous rule left behind.
 */
async function ruleThroughTheProduct({ label, path, ready, drive, expect }) {
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, path, ready);
  const reader = await openReader(ctx);
  if (!reader) {
    console.log(`  SKIP  ${label}: probe route absent (expected against production)`);
    await ctx.close();
    return;
  }
  const before = await readWorld(reader);
  await page.bringToFront();
  const carried = await drive(page);
  const after = await readWorld(reader);
  await expect({ before, after, carried, page, reader });
  check(`${label}: the console is clean`, problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   2. DISABLE, THE CONSEQUENCE, AND ENABLE

   The section this module exists for. Switching a rule off has to stop the
   rule acting, and the only way to know that is to go and cause the event: a
   screen that greyed the card and left the engine running would pass every
   other assertion in this file.
   ===================================================================== */

section("AUTOMATIONS - DISABLE, THE CONSEQUENCE, AND ENABLE");
{
  const { ctx, page, problems } = await fresh();
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    const before = await readWorld(reader);
    check("the seed holds 18 automation runs", before.runs.total === 18, String(before.runs.total));
    check("and 22 notifications", before.notes.total === 22, String(before.notes.total));
    check(
      "with all five rules enabled",
      Object.values(before.rules).every((r) => r.enabled) && Object.keys(before.rules).length === 5,
      JSON.stringify(Object.values(before.rules).map((r) => r.enabled))
    );

    await page.bringToFront();
    await page.click('.ops-rule >> nth=2 >> button:has-text("Disable")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.waitForTimeout(250);
    check(
      "disabling asks first",
      (await textOf(page, ".ops-confirm__title")) === "Disable this rule?",
      await textOf(page, ".ops-confirm__title")
    );
    check(
      "naming the rule and its id",
      (await textOf(page, ".ops-confirm__subject")).includes(RULE_NAMES[2]) &&
        (await textOf(page, ".ops-confirm__subject")).includes(RULE_IDS[2]),
      await textOf(page, ".ops-confirm__subject")
    );
    /* The promise the history rests on: a rule that is off still records that
       an event woke it. A silence would leave a visitor with no evidence that
       the system noticed at all. */
    const body = await textOf(page, ".ops-confirm__body");
    check("and saying a skipped run is still recorded", /still recorded as runs, marked Skipped/.test(body), body.slice(0, 96));
    check("without alarm language", !/permanent|warning|cannot be undone/i.test(body));

    await page.click(".ops-confirm .ops-button--primary");
    await gone(page, ".ops-confirm");
    await page.waitForTimeout(900);

    const offCards = await rulesOf(page);
    check("the card reads Disabled", offCards[2].state === "Disabled", String(offCards[2].state));
    check("and the switch now offers Enable", offCards[2].buttons.some((b) => b.startsWith("Enable")), offCards[2].buttons.join(" | "));
    check("the card is quieter, not struck out", offCards[2].quiet === true, String(offCards[2].quiet));
    check(
      "the other four are untouched",
      offCards.filter((c) => c.state === "Enabled").length === 4,
      offCards.map((c) => c.state).join(",")
    );

    const disabled = await recordOf(reader, "automation_rules", RULE_IDS[2]);
    check("and the rule record says so", disabled?.enabled === false, String(disabled?.enabled));

    /* The consequence, end to end. Rule 03 appends a System message when a
       reservation is confirmed, so confirming one now is the question: does a
       disabled rule actually withhold its effect, or only its colour. */
    const beforeConfirm = await readWorld(reader);
    await page.bringToFront();
    await go(page, RESERVATIONS, READY.list);
    await choose(page, FILTER(0), "Draft");
    await page.waitForTimeout(350);
    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(400);
    await page.click('.ops-detail__buttons .ops-button:has-text("Confirm reservation")');
    await page.waitForSelector(".ops-vehicle-choice", POLL);
    await page.waitForTimeout(400);
    await page.click(".ops-vehicle-option__input");
    await page.waitForTimeout(200);
    await page.click(".ops-sheet__foot .ops-button--primary");
    await gone(page, ".ops-vehicle-choice");
    await page.waitForTimeout(1300);

    const afterConfirm = await readWorld(reader);
    const skipped = oneRun(beforeConfirm, afterConfirm, RULE_IDS[2], "Skipped");
    check("confirming still wakes the engine", skipped.ids.length === 1, skipped.detail);
    check("which records a Skipped run for Rule 03", skipped.ok, skipped.detail);
    check(
      "and says the rule is disabled",
      /disabled/i.test(skipped.run?.summary ?? ""),
      skipped.run?.summary ?? ""
    );
    /* The assertion that proves disabling disables. This is the effect the
       rule would have had, and it must not have happened. */
    check(
      "no System message was appended",
      afterConfirm.messages.system === beforeConfirm.messages.system,
      `${beforeConfirm.messages.system} to ${afterConfirm.messages.system}`
    );
    check(
      "no message at all was written",
      afterConfirm.messages.total === beforeConfirm.messages.total,
      `${beforeConfirm.messages.total} to ${afterConfirm.messages.total}`
    );
    check(
      "and no conversation was left unread by it",
      afterConfirm.conversations.unread === beforeConfirm.conversations.unread,
      `${beforeConfirm.conversations.unread} to ${afterConfirm.conversations.unread}`
    );
    /* The booking itself still went through: a disabled rule withholds the
       automation, never the visitor's own action. */
    check(
      "while the reservation was confirmed anyway",
      afterConfirm.tallies.reservations.Confirmed === beforeConfirm.tallies.reservations.Confirmed + 1,
      JSON.stringify(afterConfirm.tallies.reservations)
    );

    /* Back on the module, the history has to show the skip rather than hide it. */
    await page.bringToFront();
    await go(page, AUTOMATIONS, READY.automations);
    const afterCards = await rulesOf(page);
    check(
      "the card reports its skipped run",
      afterCards[2].lastStatus === "Skipped",
      String(afterCards[2].lastStatus)
    );
    check(
      "and its run count moved",
      afterCards[2].runCount === (before.rules[RULE_IDS[2]]?.runCount ?? 0) + 1,
      `${before.rules[RULE_IDS[2]]?.runCount} to ${afterCards[2].runCount}`
    );

    await page.click('.ops-rule >> nth=2 >> button:has-text("Enable")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.waitForTimeout(250);
    check(
      "enabling asks first too",
      (await textOf(page, ".ops-confirm__title")) === "Enable this rule?",
      await textOf(page, ".ops-confirm__title")
    );
    /* Runs are a record of what happened, not a queue, so nothing is replayed
       and the dialog says so before the click rather than after it. */
    check(
      "and says nothing skipped is replayed",
      /Nothing that was skipped while it was off is replayed/.test(await textOf(page, ".ops-confirm__body")),
      (await textOf(page, ".ops-confirm__body")).slice(0, 96)
    );
    await page.click(".ops-confirm .ops-button--primary");
    await gone(page, ".ops-confirm");
    await page.waitForTimeout(900);

    const back = await rulesOf(page);
    check("the card reads Enabled again", back[2].state === "Enabled", String(back[2].state));
    check("and offers Disable once more", back[2].buttons.some((b) => b.startsWith("Disable")), back[2].buttons.join(" | "));
    const reenabled = await recordOf(reader, "automation_rules", RULE_IDS[2]);
    check("the rule record agrees", reenabled?.enabled === true, String(reenabled?.enabled));

    check("the switch console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
    await ctx.close();
  }
}

/* =====================================================================
   3. TEST RULE

   A Test button that quietly reassigned a real lead would be a trap, and it is
   exactly the trap this control is shaped to fall into. So the test here is
   half about what the run wrote and half about what it did not touch.
   ===================================================================== */

section("AUTOMATIONS - TEST WRITES A RUN AND MOVES NOTHING");
{
  const { ctx, page, problems } = await fresh();
  const reader = await openReader(ctx);

  if (!reader) {
    console.log("  SKIP  probe route absent (expected against production)");
    await ctx.close();
  } else {
    const before = await readWorld(reader);

    await page.bringToFront();
    await page.click('.ops-rule >> nth=4 >> button:has-text("Test rule")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.waitForTimeout(250);
    check(
      "testing asks first",
      (await textOf(page, ".ops-confirm__title")) === "Test this rule?",
      await textOf(page, ".ops-confirm__title")
    );
    const body = await textOf(page, ".ops-confirm__body");
    check("and says a real run is written", /writes a real AutomationRun/.test(body), body.slice(0, 96));
    check("while business records are left alone", /does not touch business records/.test(body));
    check("and nothing is sent anywhere", /nothing is sent anywhere/.test(body));

    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForFunction(
      () => /Test run recorded/.test(document.querySelector(".ops-confirm__title")?.textContent ?? ""),
      null,
      POLL
    );
    await page.waitForTimeout(700);

    /* The run the visitor came to see is the point, so the dialog stays and
       shows it. A toast claiming it worked would be the component telling the
       visitor what the service said instead of showing it. */
    check("the dialog does not close on success", (await page.$(".ops-confirm")) !== null);
    check(
      "it changes to the recorded state",
      (await textOf(page, ".ops-confirm__title")) === "Test run recorded",
      await textOf(page, ".ops-confirm__title")
    );
    const labels = await allOf(page, ".ops-confirm .ops-facts__label");
    check("stating outcome, summary and run", labels.join(",") === "Outcome,Summary,Run", labels.join(","));
    const values = await allOf(page, ".ops-confirm .ops-facts__value");
    check("the outcome is a word", values[0] === "Success", String(values[0]));
    check("the summary is a sentence", (values[1] ?? "").length > 12, String(values[1]));
    const runId = await textOf(page, ".ops-confirm .ops-mono");
    check("and the run is named by its id", /^automation_run_\d{4}$/.test(runId), runId);
    check(
      "with one way out",
      (await allOf(page, ".ops-confirm__actions .ops-button")).join(",") === "Done",
      (await allOf(page, ".ops-confirm__actions .ops-button")).join(",")
    );

    const after = await readWorld(reader);
    const written = oneRun(before, after, RULE_IDS[4], "Success");
    check("exactly one AutomationRun was written", written.ids.length === 1, written.detail);
    check("it is the id the dialog showed", written.id === runId, `${written.id} vs ${runId}`);
    check("for Rule 05", written.run?.ruleId === RULE_IDS[4], String(written.run?.ruleId));
    check("and it succeeded", written.run?.status === "Success", String(written.run?.status));
    check(
      "against a synthetic event, said so in the record",
      written.run?.sourceEventId === "test_event",
      String(written.run?.sourceEventId)
    );

    const raised = newNotes(before, after);
    check("one notification is raised", raised.length === 1, String(raised.length));
    check("in the Automation category", raised[0]?.category === "Automation", String(raised[0]?.category));
    check(
      "pointing at the rule that was tested",
      raised[0]?.type === "automation_rule" && raised[0]?.source === RULE_IDS[4],
      `${raised[0]?.type} ${raised[0]?.source}`
    );

    /* The trap, stated. A test run must leave the principal records exactly
       where it found them: no work order closed, no vehicle freed, no contract
       moved, no booking touched. */
    check("no work order moved", JSON.stringify(after.tallies.work) === JSON.stringify(before.tallies.work), JSON.stringify(after.tallies.work));
    check("no vehicle moved", JSON.stringify(after.tallies.vehicles) === JSON.stringify(before.tallies.vehicles), JSON.stringify(after.tallies.vehicles));
    check("no contract moved", JSON.stringify(after.tallies.contracts) === JSON.stringify(before.tallies.contracts), JSON.stringify(after.tallies.contracts));
    check("no reservation moved", JSON.stringify(after.tallies.reservations) === JSON.stringify(before.tallies.reservations), JSON.stringify(after.tallies.reservations));
    check(
      "and no record was created or destroyed",
      JSON.stringify(after.counts) === JSON.stringify(before.counts),
      JSON.stringify(after.counts)
    );
    check(
      "not even a message",
      after.messages.total === before.messages.total && after.conversations.unread === before.conversations.unread,
      `${after.messages.total} messages, ${after.conversations.unread} unread`
    );

    await page.click('.ops-confirm__actions .ops-button:has-text("Done")');
    await gone(page, ".ops-confirm");
    await page.waitForTimeout(600);
    const cards = await rulesOf(page);
    check("closing leaves the run on the card", cards[4].lastStatus === "Success", String(cards[4].lastStatus));
    const history = await historyOf(page);
    check(
      "and at the head of the history",
      history?.rules[0] === RULE_NAMES[4],
      String(history?.rules[0])
    );

    check("the test console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
    await ctx.close();
  }
}

/* =====================================================================
   4. VIEW RUNS
   ===================================================================== */

section("AUTOMATIONS - VIEW RUNS NARROWS THE HISTORY");
{
  const { ctx, page, problems } = await fresh();

  const cards = await rulesOf(page);
  /* The busiest rule, so the narrowed list has something in it and the widened
     one visibly has more. Chosen from the cards rather than assumed, because
     the seed's distribution is not this suite's to own. */
  const busiest = cards.reduce((best, c, i) => (c.runCount > cards[best].runCount ? i : best), 0);
  const name = cards[busiest].name;

  const wide = await historyOf(page);
  check("the history starts on every rule", wide?.title === "Recent runs", String(wide?.title));
  const distinctWide = new Set(wide?.rules ?? []).size;
  check("showing more than one rule", distinctWide > 1, String(distinctWide));

  await page.click(`.ops-rule >> nth=${busiest} >> button:has-text("View runs")`);
  await page.waitForTimeout(500);

  const narrow = await historyOf(page);
  check("clicking View runs names the rule in the title", narrow?.title === `Runs: ${name}`, String(narrow?.title));
  check(
    "every visible run belongs to that rule",
    (narrow?.rules ?? []).length > 0 && (narrow?.rules ?? []).every((r) => r === name),
    [...new Set(narrow?.rules ?? [])].join(" | ")
  );
  check(
    "and the note counts that rule's runs",
    new RegExp(`^${cards[busiest].runCount} runs?$`).test(narrow?.note ?? ""),
    `${narrow?.note} vs ${cards[busiest].runCount}`
  );
  const narrowed = await rulesOf(page);
  check(
    "the card's own button offers the way back",
    narrowed[busiest].buttons.some((b) => b.startsWith("Show all runs")),
    narrowed[busiest].buttons.join(" | ")
  );
  check("and the panel offers one too", narrow?.showAll === true, String(narrow?.showAll));
  check(
    "the button reports its pressed state",
    (await page.$eval(
      `.ops-rule >> nth=${busiest} >> button:has-text("Show all runs")`,
      (e) => e.getAttribute("aria-pressed")
    )) === "true"
  );

  await page.click('.ops-panel button.ops-link-button:has-text("Show all runs")');
  await page.waitForTimeout(500);
  const again = await historyOf(page);
  check("Show all runs returns the title", again?.title === "Recent runs", String(again?.title));
  check(
    "and more rules appear again",
    new Set(again?.rules ?? []).size > new Set(narrow?.rules ?? []).size,
    `${new Set(narrow?.rules ?? []).size} to ${new Set(again?.rules ?? []).size}`
  );
  check(
    "with the whole tally back",
    /succeeded/.test(again?.note ?? "") && /failed/.test(again?.note ?? ""),
    again?.note ?? ""
  );

  check("the history console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   5. ALL FIVE RULES, THROUGH REAL PRODUCT PATHS

   The centrepiece. 09C4.A already proved the domain wakes each rule when it is
   asked to; this asks whether a visitor can wake it, using the module the rule
   card itself points at, with no call to `processEvents` anywhere. A screen
   that reached for a bare service instead of its workflow would pass every
   other section in this file and fail here.

   One fresh context per rule, so each starts from the canonical seed. This
   section is deliberately slow.
   ===================================================================== */

section("ALL FIVE RULES, THROUGH THE PRODUCT");

/* --- Rule 01: a website lead is created in Leads ----------------------- */
await ruleThroughTheProduct({
  label: "rule 01",
  path: LEADS,
  ready: READY.list,
  drive: async (page) => {
    await page.click(".ops-leads__lead-row .ops-button--primary");
    await page.waitForSelector(".ops-form", POLL);
    await page.waitForTimeout(300);
    await page.fill(".ops-form input.ops-input", "QA Rule 01 Website Lead");
    await choose(page, ".ops-form .demo-select__trigger >> nth=0", "Website");
    await page.click('.ops-form button[type="submit"]');
    await page.waitForSelector(".ops-overlay--drawer", POLL);
    await waitForDetail(page);
    await page.waitForTimeout(1100);
    return { leadId: await textOf(page, ".ops-detail__id") };
  },
  expect: async ({ before, after, carried, reader }) => {
    const run = oneRun(before, after, RULE_IDS[0]);
    check("rule 01: one run, for the website assignment rule", run.ok, run.detail);
    check("rule 01: the lead itself was created", after.counts.leads === before.counts.leads + 1, String(after.counts.leads));
    const lead = await recordOf(reader, "leads", carried.leadId);
    /* The rule's whole effect: an unassigned website lead does not stay
       unassigned. The rotation is deterministic, so this is a fact about the
       record rather than about which agent happened to be picked. */
    check("rule 01: the lead gains an assigned actor", Boolean(lead?.assignedActorId), String(lead?.assignedActorId));
    check("rule 01: and starts at New regardless", lead?.stage === "New", String(lead?.stage));
    const raised = newNotes(before, after);
    check("rule 01: one notification is raised", raised.length === 1, String(raised.length));
    check("rule 01: in the CRM category", raised[0]?.category === "CRM", String(raised[0]?.category));
    check(
      "rule 01: pointing at the lead it assigned",
      raised[0]?.type === "lead" && raised[0]?.source === carried.leadId,
      `${raised[0]?.type} ${raised[0]?.source}`
    );
  },
});

/* --- Rule 02: a lead is moved to Qualified in Leads -------------------- */
await ruleThroughTheProduct({
  label: "rule 02",
  path: LEADS,
  ready: READY.list,
  drive: async (page) => {
    await choose(page, FILTER(0), "Contacted");
    await page.waitForTimeout(350);
    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(400);
    const leadId = await textOf(page, ".ops-detail__id");
    await choose(page, ".ops-detail__actions .demo-select__trigger >> nth=0", "Qualified");
    await page.waitForFunction(
      () => (document.querySelector(".ops-detail__marks")?.textContent ?? "").includes("Qualified"),
      null,
      POLL
    );
    await page.waitForTimeout(1100);
    return { leadId };
  },
  expect: async ({ before, after, carried, reader }) => {
    const run = oneRun(before, after, RULE_IDS[1]);
    check("rule 02: one run, for the qualified follow-up rule", run.ok, run.detail);
    const lead = await recordOf(reader, "leads", carried.leadId);
    check("rule 02: the stage change landed", lead?.stage === "Qualified", String(lead?.stage));
    /* Two days out, which is the rule's own offset. Asserted as presence and
       direction rather than as an instant, since the demo clock moves a tick
       with every commit. */
    check("rule 02: the lead gains a next follow-up", Boolean(lead?.nextFollowUpAt), String(lead?.nextFollowUpAt));
    check(
      "rule 02: dated ahead of the lead's last activity",
      Date.parse(lead?.nextFollowUpAt ?? 0) > Date.parse(lead?.lastActivityAt ?? 0),
      `${lead?.nextFollowUpAt} vs ${lead?.lastActivityAt}`
    );
    const raised = newNotes(before, after);
    check("rule 02: one notification is raised", raised.length === 1, String(raised.length));
    check("rule 02: in the CRM category", raised[0]?.category === "CRM", String(raised[0]?.category));
    check(
      "rule 02: pointing at the lead that qualified",
      raised[0]?.source === carried.leadId,
      String(raised[0]?.source)
    );
    check("rule 02: no lead was created", after.counts.leads === before.counts.leads, String(after.counts.leads));
  },
});

/* --- Rule 03: a draft reservation is confirmed onto a vehicle ---------- */
await ruleThroughTheProduct({
  label: "rule 03",
  path: RESERVATIONS,
  ready: READY.list,
  drive: async (page) => {
    await choose(page, FILTER(0), "Draft");
    await page.waitForTimeout(350);
    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(400);
    const reservationId = await textOf(page, ".ops-detail__id");
    await page.click('.ops-detail__buttons .ops-button:has-text("Confirm reservation")');
    await page.waitForSelector(".ops-vehicle-choice", POLL);
    await page.waitForTimeout(400);
    await page.click(".ops-vehicle-option__input");
    await page.waitForTimeout(200);
    await page.click(".ops-sheet__foot .ops-button--primary");
    await gone(page, ".ops-vehicle-choice");
    await page.waitForTimeout(1300);
    return { reservationId };
  },
  expect: async ({ before, after }) => {
    const run = oneRun(before, after, RULE_IDS[2]);
    check("rule 03: one run, for the reservation message rule", run.ok, run.detail);
    check(
      "rule 03: a System message is appended",
      after.messages.system === before.messages.system + 1,
      `${before.messages.system} to ${after.messages.system}`
    );
    check(
      "rule 03: which says what happened",
      /reservation confirmed/i.test(after.messages.lastSystemBody ?? ""),
      String(after.messages.lastSystemBody)
    );
    check(
      "rule 03: and a conversation is left unread",
      after.conversations.unread > before.conversations.unread,
      `${before.conversations.unread} to ${after.conversations.unread}`
    );
    check(
      "rule 03: the booking was confirmed as asked",
      after.tallies.reservations.Confirmed === before.tallies.reservations.Confirmed + 1,
      JSON.stringify(after.tallies.reservations)
    );
    /* The message is the effect; a notification is not part of this rule. */
    check("rule 03: and no notification was invented", after.notes.total === before.notes.total, String(after.notes.total));
  },
});

/* --- Rule 04: Payments opens and the clock is reconciled --------------- */
await ruleThroughTheProduct({
  label: "rule 04",
  /* Started somewhere else on purpose: opening Payments is the action under
     test, so the module must not already have been entered when the before
     snapshot is taken. */
  path: AUTOMATIONS,
  ready: READY.automations,
  drive: async (page) => {
    await go(page, PAYMENTS, READY.list);
    await page.waitForTimeout(1600);
    return { count: await countOf(page) };
  },
  expect: async ({ before, after, carried }) => {
    check("rule 04: the ledger opened", carried.count === "26 payments", String(carried.count));
    /* Three, not one. A payment becomes overdue because the clock passed its
       due date, so the reconciliation raises every transition it finds, and on
       the canonical seed it finds exactly three. */
    const ids = added(before.runs.byId, after.runs.byId);
    check("rule 04: three runs are written", ids.length === 3, String(ids.length));
    check(
      "rule 04: all of them for the overdue payment rule",
      ids.length > 0 && ids.every((id) => after.runs.byId[id].ruleId === RULE_IDS[3]),
      [...new Set(ids.map((id) => after.runs.byId[id].ruleId))].join(",")
    );
    check(
      "rule 04: and all of them succeeded",
      ids.length > 0 && ids.every((id) => after.runs.byId[id].status === "Success"),
      [...new Set(ids.map((id) => after.runs.byId[id].status))].join(",")
    );
    const raised = newNotes(before, after);
    check("rule 04: three notifications are raised", raised.length === 3, String(raised.length));
    check(
      "rule 04: every one for Finance",
      raised.length > 0 && raised.every((n) => n.category === "Finance" && n.role === "Finance Analyst"),
      raised.map((n) => `${n.category}/${n.role}`).join(" ")
    );
    check(
      "rule 04: naming the three late payments",
      raised.map((n) => n.source).sort().join(",") === "payment_0016,payment_0018,payment_0019",
      raised.map((n) => n.source).sort().join(",")
    );
    /* Overdue is derived rather than stored, so nothing about a payment record
       may have been rewritten to make the alert possible. */
    check(
      "rule 04: no payment record was created",
      after.counts.payments === before.counts.payments,
      String(after.counts.payments)
    );
    check(
      "rule 04: and no contract moved",
      JSON.stringify(after.tallies.contracts) === JSON.stringify(before.tallies.contracts),
      JSON.stringify(after.tallies.contracts)
    );
  },
});

/* --- Rule 05: the running work order is completed in Maintenance ------- */
await ruleThroughTheProduct({
  label: "rule 05",
  path: MAINTENANCE,
  ready: READY.list,
  drive: async (page) => {
    await choose(page, FILTER(0), "In Progress");
    await page.waitForTimeout(350);
    await page.click(".ops-leads__name");
    await waitForDetail(page);
    await page.waitForTimeout(450);
    const workOrderId = await textOf(page, ".ops-detail__id");
    await page.click('.ops-detail__buttons .ops-button:has-text("Complete work")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.waitForTimeout(250);
    await page.click(".ops-confirm .ops-button--primary");
    await gone(page, ".ops-confirm");
    await page.waitForTimeout(1300);
    return { workOrderId };
  },
  expect: async ({ before, after, carried, reader }) => {
    const run = oneRun(before, after, RULE_IDS[4]);
    check("rule 05: one run, for the maintenance notice rule", run.ok, run.detail);
    const work = await recordOf(reader, "maintenance", carried.workOrderId);
    check("rule 05: the work order is Completed", work?.status === "Completed", String(work?.status));
    const raised = newNotes(before, after);
    check("rule 05: one notification is raised", raised.length === 1, String(raised.length));
    check("rule 05: in the Maintenance category", raised[0]?.category === "Maintenance", String(raised[0]?.category));
    check(
      "rule 05: addressed to the Fleet Coordinator",
      raised[0]?.role === "Fleet Coordinator",
      String(raised[0]?.role)
    );
    check(
      "rule 05: and pointing at the work order",
      raised[0]?.source === carried.workOrderId,
      `${raised[0]?.source} vs ${carried.workOrderId}`
    );
    check(
      "rule 05: the vehicle leaves the workshop",
      (after.tallies.vehicles.Maintenance ?? 0) === (before.tallies.vehicles.Maintenance ?? 0) - 1,
      JSON.stringify(after.tallies.vehicles)
    );
  },
});

/* =====================================================================
   6. REPORTS: SHAPE, AND THE DENOMINATOR RULE
   ===================================================================== */

section("REPORTS - FOUR PANELS, AND EVERY SHARE WITH ITS TOTAL");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, REPORTS, READY.reports);

  check("the route renders the module", (await page.$(".ops-reports")) !== null);
  const titles = await allOf(page, ".ops-reports .ops-panel__title");
  check("exactly four panels", titles.length === 4, String(titles.length));
  check("in the specification's frozen order", titles.join(" | ") === PANELS.join(" | "), titles.join(" | "));
  /* Reservations and Maintenance are not report groups here, however reportable
     they might be. A fifth panel would be the frozen contract being adjusted to
     fit an idea rather than the other way round. */
  check("and no fifth", (await page.$$eval(".ops-reports .ops-panel", (n) => n.length)) === 4);

  /* The only control on the only screen in the product that writes nothing. */
  const controls = await page.evaluate(() => ({
    buttons: document.querySelectorAll(".ops-reports button").length,
    combos: document.querySelectorAll('.ops-reports [role="combobox"]').length,
    primary: document.querySelectorAll(".ops-reports .ops-button--primary").length,
    forms: document.querySelectorAll(".ops-reports form").length,
    inputs: document.querySelectorAll(".ops-reports input, .ops-reports textarea").length,
    detailButtons: document.querySelectorAll(".ops-reports .ops-detail__buttons").length,
    inHead: document.querySelectorAll(".ops-reports__head .demo-select__trigger").length,
  }));
  check("one control on the page", controls.buttons === 1, String(controls.buttons));
  check("and it is the period select", controls.combos === 1 && controls.inHead === 1, `${controls.combos}/${controls.inHead}`);
  check("no button that writes", controls.primary === 0, String(controls.primary));
  check("no form", controls.forms === 0 && controls.inputs === 0, `${controls.forms}/${controls.inputs}`);
  check("and no record actions", controls.detailButtons === 0, String(controls.detailButtons));
  const periods = await optionsOf(page, PERIOD_SELECT);
  check(
    "the period offers the three frozen windows",
    periods.join(",") === "30 days,90 days,All demo data",
    periods.join(",")
  );

  const fleet = await panelOf(page, "Fleet utilisation");
  check("the fleet ring has four segments", fleet?.segments === 4, String(fleet?.segments));
  check(
    "and a legend that carries the data in text",
    (fleet?.legend ?? []).length === 4 && (fleet?.legend ?? []).every((r) => /^\d+$/.test(r.count)),
    (fleet?.legend ?? []).map((r) => `${r.status} ${r.count}`).join(", ")
  );

  /* The rule the bar component makes structural: a rail draws a length, and a
     length on its own is a claim nobody can check. */
  const bars = await page.$$eval(".ops-reports .ops-statbar", (rows) =>
    rows.map((row) => ({
      label: row.querySelector(".ops-statbar__label")?.textContent.trim() ?? "",
      count: row.querySelector(".ops-statbar__count")?.textContent.trim() ?? "",
      share: row.querySelector(".ops-statbar__share")?.textContent.replace(/\s+/g, " ").trim() ?? "",
    }))
  );
  check("every panel draws bars", bars.length >= 12, String(bars.length));
  check(
    "every bar carries its count in text",
    bars.every((b) => /^\d+$/.test(b.count)),
    bars.find((b) => !/^\d+$/.test(b.count))?.label ?? ""
  );
  check(
    "and every bar labels itself",
    bars.every((b) => b.label.length > 0),
    String(bars.filter((b) => !b.label).length)
  );
  check(
    "no share is printed without its denominator",
    bars.every((b) => /\d+% of \d+ /.test(b.share)),
    bars.find((b) => !/\d+% of \d+ /.test(b.share))?.share ?? ""
  );

  /* The same rule again, for the headline figures. The note is the
     denominator, not decoration, and a percentage without one is exactly the
     number a reader has no way to check. */
  const figures = await page.$$eval(".ops-reports .ops-figures > *", (nodes) =>
    nodes.map((f) => ({
      label: f.querySelector(".ops-figure__label")?.textContent.trim() ?? "",
      value: f.querySelector(".ops-figure__value")?.textContent.trim() ?? "",
      note: f.querySelector(".ops-figure__note")?.textContent.replace(/\s+/g, " ").trim() ?? "",
    }))
  );
  check("the panels state headline figures", figures.length >= 6, String(figures.length));
  check(
    "every figure has a label and a note",
    figures.every((f) => f.label.length > 0 && f.note.length > 0),
    figures.find((f) => !f.note)?.label ?? ""
  );
  const percentages = figures.filter((f) => f.value.endsWith("%"));
  check("at least one figure is a percentage", percentages.length >= 1, String(percentages.length));
  check(
    "and every percentage names what it is a share of",
    percentages.every((f) => /\d/.test(f.note)),
    percentages.find((f) => !/\d/.test(f.note))?.note ?? ""
  );

  check("the shape console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   7. REPORTS ARE DERIVED, NOT WRITTEN

   Every figure compared with the canonical seed. A reporting screen is where a
   demo is most tempted to write a number down, and a number written down here
   would be the first one in the product that disagrees with its own list.
   ===================================================================== */

section("REPORTS - COUNTED FROM THE RECORDS, NOT STORED");
{
  const { ctx, page } = await fresh({ width: 1440, height: 900 }, REPORTS, READY.reports);

  const funnel = await panelOf(page, "Lead funnel");
  const funnelBars = barsOf(funnel);
  check(
    "the funnel runs the five stages in order",
    (funnel?.bars ?? []).map((b) => b.label).join(",") === "New,Contacted,Qualified,Proposal,Won",
    (funnel?.bars ?? []).map((b) => b.label).join(",")
  );
  check(
    "with the seeded distribution",
    JSON.stringify(funnelBars) === JSON.stringify({ New: 12, Contacted: 10, Qualified: 9, Proposal: 7, Won: 6 }),
    JSON.stringify(funnelBars)
  );
  /* 48 leads less the 4 Lost, which the funnel reports separately rather than
     as a stage. Summed here rather than trusted, so the note and the bars have
     to agree with each other as well as with the seed. */
  check("the funnel totals 44", sumOf(funnel) === 44, String(sumOf(funnel)));
  check("and says so in its note", funnel?.note === "44 leads in the period", String(funnel?.note));
  check(
    "still open is the funnel less what is won",
    Number(figureOf(funnel, "Still open")?.value) === 44 - 6,
    figureOf(funnel, "Still open")?.value ?? ""
  );
  check("and won is stated as its own figure", figureOf(funnel, "Won")?.value === "6", figureOf(funnel, "Won")?.value ?? "");

  const fleet = await panelOf(page, "Fleet utilisation");
  const legend = Object.fromEntries((fleet?.legend ?? []).map((r) => [r.status, Number(r.count)]));
  check("the fleet counts 24 vehicles", fleet?.note === "24 vehicles", String(fleet?.note));
  check(
    "in the canonical distribution",
    JSON.stringify(legend) === JSON.stringify({ Available: 10, Reserved: 4, Rented: 7, Maintenance: 3 }),
    JSON.stringify(legend)
  );
  check(
    "and the legend adds up to the register",
    Object.values(legend).reduce((a, b) => a + b, 0) === 24,
    String(Object.values(legend).reduce((a, b) => a + b, 0))
  );
  check(
    "the rented share is that arithmetic, not a figure",
    figureOf(fleet, "Rented share")?.value === `${Math.round((7 / 24) * 100)}%`,
    figureOf(fleet, "Rented share")?.value ?? ""
  );
  check(
    "printed with the fleet it was taken over",
    /of 24 vehicles/.test(figureOf(fleet, "Rented share")?.note ?? ""),
    figureOf(fleet, "Rented share")?.note ?? ""
  );

  const contracts = await panelOf(page, "Contract status and value");
  const contractBars = barsOf(contracts);
  check(
    "contracts are counted by status",
    JSON.stringify(contractBars) === JSON.stringify({ Pending: 3, Active: 7, Completed: 3, Cancelled: 1 }),
    JSON.stringify(contractBars)
  );
  check("totalling 14", sumOf(contracts) === 14, String(sumOf(contracts)));
  check("and saying so", contracts?.note === "14 contracts in the period", String(contracts?.note));
  check(
    "each status carries its money with it",
    (contracts?.bars ?? []).every((b) => /USD \d+\.\d{2}/.test(b.share)),
    (contracts?.bars ?? [])[0]?.share ?? ""
  );
  const total = centsOf(figureOf(contracts, "Total value")?.value);
  const paid = centsOf(figureOf(contracts, "Paid")?.value);
  const outstanding = centsOf(figureOf(contracts, "Outstanding")?.value);
  check("the three money figures parse", [total, paid, outstanding].every((v) => v !== null), `${total}/${paid}/${outstanding}`);
  /* The same subtraction the contract drawer makes on one record, summed over
     the period. The harness does the arithmetic and asks the screen to agree. */
  check("outstanding is the total less what was paid", outstanding === total - paid, `${outstanding} vs ${total} - ${paid}`);
  check(
    "and each figure names the contracts it covers",
    (contracts?.figures ?? []).every((f) => /14 contracts/.test(f.note)),
    (contracts?.figures ?? []).map((f) => f.note).join(" | ").slice(0, 80)
  );

  const payments = await panelOf(page, "Payment status");
  const paymentBars = barsOf(payments);
  check(
    "payments are counted by status",
    JSON.stringify(paymentBars) === JSON.stringify({ Paid: 18, Pending: 5, Overdue: 3 }),
    JSON.stringify(paymentBars)
  );
  check("totalling 26", sumOf(payments) === 26, String(sumOf(payments)));
  /* Overdue is never written down: a payment record only ever says Pending or
     Paid, and the third state is produced at read time by comparing the due
     date with the logical clock. Three of them appearing here at all is the
     only proof that this panel reads the effective status rather than the
     stored one, where the split would be 18 and 8. */
  check("the split is the effective one, not the stored one", paymentBars.Overdue === 3, JSON.stringify(paymentBars));
  check("which the stored split could not produce", paymentBars.Pending === 5 && paymentBars.Pending !== 8, String(paymentBars.Pending));
  check(
    "outstanding is summed over what is not settled",
    /across 8 payments not yet settled/.test(figureOf(payments, "Outstanding")?.note ?? ""),
    figureOf(payments, "Outstanding")?.note ?? ""
  );
  check("and it is money", centsOf(figureOf(payments, "Outstanding")?.value) !== null, figureOf(payments, "Outstanding")?.value ?? "");

  await ctx.close();
}

/* =====================================================================
   8. THE PERIOD FILTER
   ===================================================================== */

section("REPORTS - THE PERIOD, AND THE PANEL IT CANNOT APPLY TO");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, REPORTS, READY.reports);

  const readAll = async () => ({
    funnel: sumOf(await panelOf(page, "Lead funnel")),
    fleet: (await panelOf(page, "Fleet utilisation"))?.note ?? "",
    contracts: sumOf(await panelOf(page, "Contract status and value")),
    payments: sumOf(await panelOf(page, "Payment status")),
  });

  const wide = await readAll();
  check("the default window is everything", wide.funnel === 44 && wide.contracts === 14 && wide.payments === 26, JSON.stringify(wide));

  await choose(page, PERIOD_SELECT, "30 days");
  await page.waitForTimeout(900);
  const narrow = await readAll();
  const moved = ["funnel", "contracts", "payments"].filter((k) => narrow[k] !== wide[k]);
  check("30 days recounts the time-based panels", moved.length >= 1, `${moved.join(",")}: ${JSON.stringify(narrow)}`);
  check(
    "and never counts more than the whole dataset",
    ["funnel", "contracts", "payments"].every((k) => narrow[k] <= wide[k]),
    JSON.stringify(narrow)
  );
  /* A vehicle's status is what it is now, so a date window over the register
     would produce a number with no meaning at all. The fleet stays 24 and the
     page says why rather than leaving a reader to wonder. */
  check("the fleet snapshot does not move", narrow.fleet === "24 vehicles", narrow.fleet);
  const notes = await allOf(page, ".ops-reports__note");
  check(
    "and the page says the period does not apply to it",
    notes.some((n) => /snapshot/.test(n) && /period filter does not apply/.test(n)),
    notes.join(" | ").slice(0, 96)
  );
  check(
    "the live region says the panels were recounted",
    /recounted/.test(await textOf(page, '.ops-reports [role="status"]', "")),
    await textOf(page, '.ops-reports [role="status"]', "")
  );
  /* Narrowed or not, no bar may lose its denominator. */
  const shares = await allOf(page, ".ops-reports .ops-statbar__share");
  check(
    "every share still carries its total",
    shares.every((s) => /\d+% of \d+ /.test(s)),
    shares.find((s) => !/\d+% of \d+ /.test(s)) ?? ""
  );

  await choose(page, PERIOD_SELECT, "All demo data");
  await page.waitForTimeout(900);
  const back = await readAll();
  check("switching back restores every figure", JSON.stringify(back) === JSON.stringify(wide), JSON.stringify(back));

  check("the period console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   9. REPORTS MOVE WITH THE DATA

   Specification workflow W3, and the sentence it exists to keep: record a
   payment against a contract and "the Overview and Reports figures move with
   it". Driven through Payments, read back on Reports, with no reader involved:
   if the panels were written down rather than counted, this is where they stop
   agreeing with the ledger.
   ===================================================================== */

section("REPORTS - THE FIGURES FOLLOW A RECORDED PAYMENT");
{
  const { ctx, page, problems } = await fresh({ width: 1440, height: 900 }, REPORTS, READY.reports);

  const contractsBefore = await panelOf(page, "Contract status and value");
  const paymentsBefore = await panelOf(page, "Payment status");
  const outstandingBefore = centsOf(figureOf(contractsBefore, "Outstanding")?.value);
  const paidBefore = centsOf(figureOf(contractsBefore, "Paid")?.value);
  const paidCountBefore = barsOf(paymentsBefore).Paid;

  await go(page, PAYMENTS, READY.list);
  await page.click('.ops-button--primary:has-text("Record payment")');
  await page.waitForSelector(".ops-form", POLL);
  await page.waitForTimeout(400);

  /* The form states the remaining balance before the fields, and that ceiling
     is the service's rule as well as the visitor's guidance. Ten dollars sits
     safely under every seeded balance, so the amount is a constant rather than
     a calculation that could itself be wrong. */
  const remaining = centsOf(await textOf(page, ".ops-payments__balance-row--total .ops-payments__balance-value"));
  check("the form states a remaining balance", remaining !== null && remaining > 1000, String(remaining));
  await page.fill(".ops-form input.ops-input", "10.00");
  await page.click('.ops-form button[type="submit"]');
  await gone(page, ".ops-form");
  await page.waitForTimeout(1400);
  check(
    "the ledger records the payment",
    (await countOf(page)) === "27 payments",
    await countOf(page)
  );
  check(
    "and says so in its own words",
    /Payment of USD 10\.00 recorded against contract_/.test(await textOf(page, '.ops-payments [role="status"]', "")),
    await textOf(page, '.ops-payments [role="status"]', "")
  );

  await go(page, REPORTS, READY.reports);
  const contractsAfter = await panelOf(page, "Contract status and value");
  const paymentsAfter = await panelOf(page, "Payment status");
  const outstandingAfter = centsOf(figureOf(contractsAfter, "Outstanding")?.value);
  const paidAfter = centsOf(figureOf(contractsAfter, "Paid")?.value);

  check(
    "the outstanding figure falls by exactly the amount",
    outstandingAfter === outstandingBefore - 1000,
    `${outstandingBefore} to ${outstandingAfter}`
  );
  check(
    "and the paid figure rises by exactly the same",
    paidAfter === paidBefore + 1000,
    `${paidBefore} to ${paidAfter}`
  );
  check(
    "the total value is untouched",
    centsOf(figureOf(contractsAfter, "Total value")?.value) === centsOf(figureOf(contractsBefore, "Total value")?.value),
    figureOf(contractsAfter, "Total value")?.value ?? ""
  );
  check(
    "the paid payment count rises by one",
    barsOf(paymentsAfter).Paid === paidCountBefore + 1,
    `${paidCountBefore} to ${barsOf(paymentsAfter).Paid}`
  );
  check("and the ledger panel counts 27", sumOf(paymentsAfter) === 27, String(sumOf(paymentsAfter)));
  /* The payment panel's own outstanding sum is over the payments that are not
     settled, and the record just written is settled, so it correctly does not
     move. The figure that falls is the contract balance, which is what W3 is
     about. Asserted rather than left implicit, because the two sums answer two
     different questions and a screen that conflated them would look right. */
  check(
    "while the unsettled payment sum is unchanged",
    centsOf(figureOf(paymentsAfter, "Outstanding")?.value) === centsOf(figureOf(paymentsBefore, "Outstanding")?.value),
    `${figureOf(paymentsBefore, "Outstanding")?.value} to ${figureOf(paymentsAfter, "Outstanding")?.value}`
  );
  check(
    "no contract changed status for a payment",
    JSON.stringify(barsOf(contractsAfter)) === JSON.stringify(barsOf(contractsBefore)),
    JSON.stringify(barsOf(contractsAfter))
  );

  check("the workflow console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
  await ctx.close();
}

/* =====================================================================
   10. ROLE

   Automations is the most consequential control in the product, so it is
   Admin alone. Reports is read-only and opens for Admin and Finance. The rule
   underneath both is D-092: what a role is denied is the door, never the
   information behind it.
   ===================================================================== */

section("ROLE - WHO OPENS AUTOMATIONS, AND WHO OPENS REPORTS");
{
  const { ctx, page } = await fresh();

  check("Admin sees the rules", (await page.$$eval(".ops-rule", (n) => n.length)) === 5);
  check(
    "and the sidebar carries all eleven modules",
    (await page.$$eval(".ops-sidebar a", (n) => n.length)) === 11,
    String(await page.$$eval(".ops-sidebar a", (n) => n.length))
  );
  /* The build-state pending mechanism is deleted, not merely unused. */
  check("with no pending entries left anywhere", (await page.$(".ops-sidebar__item--pending")) === null);

  for (const role of ["Sales Agent", "Fleet Coordinator", "Finance Analyst"]) {
    await closeOverlay(page);
    await choose(page, ROLE_SELECT, role);
    await page.waitForTimeout(800);
    check(`${role} cannot open Automations`.slice(0, 58), (await page.$(".ops-unavailable")) !== null);
    check(`${role} is told so by name`.slice(0, 58), (await textOf(page, ".ops-unavailable__text")).includes(role), (await textOf(page, ".ops-unavailable__text")).slice(0, 56));
    check(`${role} is left no rule card`.slice(0, 58), (await page.$$eval(".ops-rule", (n) => n.length)) === 0);
    check(`${role} is left no history`.slice(0, 58), (await page.$(".ops-runs__item")) === null);
    check(
      `${role} is told the matrix is simulated`.slice(0, 58),
      /simulated/.test(await textOf(page, ".ops-unavailable__note", "")),
      (await textOf(page, ".ops-unavailable__note", "")).slice(0, 56)
    );
  }

  await closeOverlay(page);
  await choose(page, ROLE_SELECT, "Admin");
  await page.waitForTimeout(800);
  check("Admin gets the rules back", (await page.$$eval(".ops-rule", (n) => n.length)) === 5);

  await go(page, REPORTS, READY.reports);
  check("Admin reads the four panels", (await allOf(page, ".ops-reports .ops-panel__title")).join(",") === PANELS.join(","));

  for (const role of ["Sales Agent", "Fleet Coordinator"]) {
    await choose(page, ROLE_SELECT, role);
    await page.waitForTimeout(800);
    check(`${role} cannot open Reports`.slice(0, 58), (await page.$(".ops-unavailable")) !== null);
    check(`${role} is told so by name in Reports`.slice(0, 58), (await textOf(page, ".ops-unavailable__text")).includes(role), (await textOf(page, ".ops-unavailable__text")).slice(0, 56));
    check(`${role} is left no panel`.slice(0, 58), (await page.$$eval(".ops-reports .ops-panel", (n) => n.length)) === 0);
  }

  await choose(page, ROLE_SELECT, "Finance Analyst");
  await page.waitForTimeout(900);
  const financeTitles = await allOf(page, ".ops-reports .ops-panel__title");
  check("Finance opens Reports", (await page.$(".ops-reports")) !== null && financeTitles.length === 4, String(financeTitles.length));
  /* Four groups are named in the specification and the funnel is one of them.
     Finance cannot open Leads, and D-092 withholds the link rather than the
     information, so the panel is here and the door is not. */
  check("including the lead funnel", financeTitles.join(",") === PANELS.join(","), financeTitles.join(","));
  const financeFunnel = await panelOf(page, "Lead funnel");
  check("with the same figures Admin reads", sumOf(financeFunnel) === 44, String(sumOf(financeFunnel)));
  check(
    "and no way through to Leads from this page",
    (await page.$$eval('.ops-reports a[href*="/leads"]', (n) => n.length)) === 0
  );
  check(
    "nor any other link out of the panels",
    (await page.$$eval(".ops-reports a", (n) => n.length)) === 0,
    String(await page.$$eval(".ops-reports a", (n) => n.length))
  );
  check(
    "the sidebar for Finance is five modules",
    (await page.$$eval(".ops-sidebar a", (n) => n.length)) === 5,
    String(await page.$$eval(".ops-sidebar a", (n) => n.length))
  );

  await ctx.close();
}

/* =====================================================================
   11. MOBILE
   ===================================================================== */

section("MOBILE");
for (const [w, h] of [
  [390, 844],
  [360, 800],
]) {
  /* --- automations ---------------------------------------------------- */
  {
    const { ctx, page, problems } = await fresh({ width: w, height: h });
    const tag = `automations ${w}`;

    check(
      `${tag}: nothing overflows sideways`,
      (await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )) <= 0
    );
    const grid = await page.$eval(".ops-automations__grid", (e) =>
      getComputedStyle(e).gridTemplateColumns.trim()
    );
    check(`${tag}: the grid becomes one column`, grid.split(/\s+/).length === 1, grid);

    const stacked = await page.$$eval(".ops-rule", (cards) =>
      cards.map((c) => {
        const r = c.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY) };
      })
    );
    check(`${tag}: five cards are still there`, stacked.length === 5, String(stacked.length));
    check(
      `${tag}: they stack in one column`,
      stacked.every((c, i) => i === 0 || (c.left === stacked[0].left && c.top >= stacked[i - 1].bottom - 1)),
      stacked.map((c) => `${c.left}/${c.top}`).join(" ")
    );
    check(
      `${tag}: and none is wider than the screen`,
      await page.$$eval(".ops-rule", (cards, width) => cards.every((c) => c.getBoundingClientRect().width <= width), w)
    );
    check(
      `${tag}: the history sits below the rules`,
      await page.evaluate(() => {
        const last = [...document.querySelectorAll(".ops-rule")].pop();
        const panel = document.querySelector(".ops-automations .ops-panel");
        return Boolean(last && panel) && panel.getBoundingClientRect().top >= last.getBoundingClientRect().bottom - 1;
      })
    );

    /* The dialog is the one overlay this module opens, so it is what decides
       whether a phone can finish the job. Opened and dismissed without running
       anything: the effect is tested elsewhere, the geometry is tested here. */
    await page.click('.ops-rule >> nth=0 >> button:has-text("Test rule")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.waitForTimeout(400);
    const panel = await page.$eval(".ops-confirm .ops-overlay__panel", (e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, bottom: r.bottom };
    });
    check(`${tag}: the dialog fits the viewport`, panel.left >= -1 && panel.right <= w + 1, `${Math.round(panel.left)}..${Math.round(panel.right)}`);
    check(
      `${tag}: with its action reachable`,
      await page.$eval(
        ".ops-confirm__actions .ops-button--primary",
        (e) => e.getBoundingClientRect().bottom <= window.innerHeight + 1
      )
    );
    check(
      `${tag}: and the dialog does not scroll sideways`,
      (await page.evaluate(() => {
        const el = document.querySelector(".ops-confirm .ops-overlay__panel");
        return el ? el.scrollWidth - el.clientWidth : 0;
      })) <= 1
    );
    await page.click('.ops-confirm .ops-button--quiet:has-text("Back")');
    await gone(page, ".ops-confirm");
    check(`${tag}: Back leaves the rules untouched`, (await rulesOf(page)).every((c) => c.state === "Enabled"));

    check(`${tag}: the mobile console is clean`, problems.length === 0, problems.join(" | ").slice(0, 100));
    await ctx.close();
  }

  /* --- reports -------------------------------------------------------- */
  {
    const { ctx, page, problems } = await fresh({ width: w, height: h }, REPORTS, READY.reports);
    const tag = `reports ${w}`;

    check(
      `${tag}: nothing overflows sideways`,
      (await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )) <= 0
    );
    const rows = await page.$$eval(".ops-overview__row", (n) =>
      n.map((r) => getComputedStyle(r).gridTemplateColumns.trim())
    );
    check(`${tag}: the panel rows become one column`, rows.length > 0 && rows.every((r) => r.split(/\s+/).length === 1), rows.join(" | "));

    const panels = await page.$$eval(".ops-reports .ops-panel", (nodes) =>
      nodes.map((p) => {
        const r = p.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY), width: Math.round(r.width) };
      })
    );
    check(`${tag}: four panels are still there`, panels.length === 4, String(panels.length));
    check(
      `${tag}: stacked, one above the next`,
      panels.every((p, i) => i === 0 || (p.left === panels[0].left && p.top >= panels[i - 1].bottom - 1)),
      panels.map((p) => `${p.left}/${p.top}`).join(" ")
    );
    check(`${tag}: none wider than the screen`, panels.every((p) => p.width <= w), String(Math.max(...panels.map((p) => p.width))));
    check(
      `${tag}: the ring stays inside its panel`,
      await page.$eval(".ops-fleet__ring", (e) => e.getBoundingClientRect().right <= window.innerWidth + 1)
    );
    check(
      `${tag}: and no bar row scrolls sideways`,
      (await page.$$eval(".ops-reports .ops-statbars", (nodes) => nodes.map((n) => n.scrollWidth - n.clientWidth))).every((d) => d <= 1)
    );
    check(
      `${tag}: the period select is still reachable`,
      await page.$eval(PERIOD_SELECT, (e) => {
        const r = e.getBoundingClientRect();
        return r.left >= -1 && r.right <= window.innerWidth + 1;
      })
    );

    check(`${tag}: the mobile console is clean`, problems.length === 0, problems.join(" | ").slice(0, 100));
    await ctx.close();
  }
}

/* =====================================================================
   12. CONTAINMENT

   The Inbox owns the fixed-viewport workspace. Both of these modules must grow
   with their content like every other page-growth module, and must not have
   picked up the `:has(.ops-inbox)` rules by accident. Measured, and captured
   full page, because the Inbox defect was invisible to a viewport screenshot.
   ===================================================================== */

section("CONTAINMENT - TWO NORMAL PAGE-GROWTH MODULES");
{
  const { PNG } = await import("pngjs");
  const fs = await import("node:fs");
  const DIR = "qa/shots/stage09c45";
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
    { name: "automations", root: ".ops-automations", path: AUTOMATIONS, ready: READY.automations },
    { name: "reports", root: ".ops-reports", path: REPORTS, ready: READY.reports },
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
      const { ctx, page } = await fresh({ width: w, height: h }, mod.path, mod.ready);
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
         is lower down: the shell keeps `min-height: 100dvh`, so a short page on
         a tall screen legitimately leaves app surface below the last panel.
         What must never appear there is portfolio background, which the capture
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
       rule the Inbox defect broke, stated rather than tested by symptom
       (D-086). Both roots carry `position: relative` for exactly this reason,
       since the visually hidden heading, the live region and the revealed
       share are all absolutely positioned. */
    const { ctx, page } = await fresh({ width: 1440, height: 900 }, mod.path, mod.ready);
    const escaped = await page.evaluate((rootSelector) => {
      const root = document.querySelector(rootSelector);
      const stray = [];
      for (const el of document.querySelectorAll(`${rootSelector} *`)) {
        if (getComputedStyle(el).position !== "absolute") continue;
        let p = el.parentElement;
        while (p && getComputedStyle(p).position === "static") p = p.parentElement;
        if (p && !root.contains(p)) stray.push(el.className || el.tagName);
      }
      return stray;
    }, mod.root);
    check(`${mod.name}: no absolute descendant escapes the module`, escaped.length === 0, escaped.slice(0, 2).join(", "));
    await ctx.close();
  }
}

/* =====================================================================
   13. PRESENTATION AND CONTENT RULES
   ===================================================================== */

section("PRESENTATION - CONTRAST, FOCUS AND CONTENT");
for (const mod of [
  {
    name: "automations",
    root: ".ops-automations",
    path: AUTOMATIONS,
    ready: READY.automations,
    /* The separator dots are excluded on purpose: they are `aria-hidden`
       punctuation drawn in the line colour, and holding decoration to a text
       ratio would be measuring the wrong thing. */
    text:
      ".ops-rule__name, .ops-rule__when, .ops-rule__event, .ops-rule__action, .ops-rule__meta, .ops-rule__last-summary, .ops-pill, .ops-link-button, .ops-panel__title, .ops-panel__note, .ops-runs__rule, .ops-runs__summary, .ops-runs__meta",
    focus: ".ops-rule__foot .ops-button",
    stir: async (page) => {
      await page.click('.ops-rule >> nth=1 >> button:has-text("View runs")');
      await page.waitForTimeout(500);
    },
  },
  {
    name: "reports",
    root: ".ops-reports",
    path: REPORTS,
    ready: READY.reports,
    text:
      ".ops-reports__note, .ops-panel__title, .ops-panel__note, .ops-statbar__label, .ops-statbar__count, .ops-figure__label, .ops-figure__value, .ops-figure__note, .ops-fleet__status, .ops-fleet__count",
    focus: ".ops-statbar",
    stir: async (page) => {
      await choose(page, PERIOD_SELECT, "90 days");
      await page.waitForTimeout(700);
    },
  },
]) {
  const { ctx, page } = await fresh({ width: 1440, height: 900 }, mod.path, mod.ready);

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

  /* Nothing on either screen depends on colour alone: every pill says its own
     word, and every rail prints the count it drew. */
  const pills = await allOf(page, `${mod.root} .ops-pill`);
  if (pills.length > 0) {
    check(
      `${mod.name}: pills carry their own words`,
      pills.every((p) => /^[A-Za-z ]+$/.test(p)),
      pills.slice(0, 4).join(",")
    );
  }

  /* One announcement, not several. The shell owns a second live region for
     role changes and reset, which is why this is scoped to the module. */
  check(
    `${mod.name}: exactly one polite live region`,
    (await page.$$eval(`${mod.root} [role="status"][aria-live="polite"]`, (n) => n.length)) === 1,
    String(await page.$$eval(`${mod.root} [role="status"][aria-live="polite"]`, (n) => n.length))
  );
  check(
    `${mod.name}: with a focusable heading landmark`,
    (await page.$eval(`${mod.root} h2`, (e) => e.getAttribute("tabindex"))) === "-1"
  );

  const ring = await focusByKeyboard(page, mod.focus);
  check(`${mod.name}: the keyboard reaches its controls`, ring.onTarget, mod.focus);
  check(`${mod.name}: which show focus`, !/^none:0px$/.test(ring.ring), ring.ring);

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

  if (mod.name === "reports") {
    /* No invented metric language. The panels are checked rather than the whole
       document, because the page's own standing note contains the phrase
       "previous period" in the sentence that refuses the comparison, and a
       naive match would fail on the honesty it is meant to protect. */
    const panels = await textOf(page, ".ops-reports .ops-overview", "");
    for (const [name, re] of [
      ["a comparison with last time", /vs last|compared to last|month over month/i],
      ["a previous period", /previous period/i],
      ["a trend arrow figure", /[+]\d+%/],
    ]) {
      check(`reports: the panels claim no ${name}`.slice(0, 58), !re.test(panels), (panels.match(re) ?? [""])[0]);
    }
    const notes = await allOf(page, ".ops-reports__note");
    check(
      "reports: the only mention of a previous period denies one",
      notes
        .filter((n) => /previous period/i.test(n))
        .every((n) => /Nothing is compared against a previous period/.test(n)),
      notes.find((n) => /previous period/i.test(n))?.slice(0, 72) ?? ""
    );
    check(
      "reports: and says the figures are counted from the records",
      notes.some((n) => /counted from the synthetic records/.test(n)),
      notes.join(" | ").slice(0, 72)
    );
  }

  /* No network beyond the app itself. */
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await mod.stir(page);
  check(
    `${mod.name}: no external request`,
    requests.filter((u) => !u.startsWith(BASE) && !u.startsWith("data:")).length === 0,
    requests.find((u) => !u.startsWith(BASE) && !u.startsWith("data:")) ?? ""
  );
  check(`${mod.name}: and no API call`, requests.filter((u) => u.includes("/api/")).length === 0);

  await ctx.close();
}

/* =====================================================================
   14. RESET

   Last, because it is the promise the whole demo rests on: whatever a visitor
   did, the canonical world comes back. Both modules are checked from the same
   restored store, the rules from the record and the report figures from the
   screen, so a reset that restored the data and left a screen stale would be
   caught rather than assumed away.
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
    await page.click('.ops-rule >> nth=0 >> button:has-text("Disable")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.click(".ops-confirm .ops-button--primary");
    await gone(page, ".ops-confirm");
    await page.waitForTimeout(900);
    await page.click('.ops-rule >> nth=3 >> button:has-text("Test rule")');
    await page.waitForSelector(".ops-confirm", POLL);
    await page.click(".ops-confirm .ops-button--primary");
    await page.waitForFunction(
      () => /Test run recorded/.test(document.querySelector(".ops-confirm__title")?.textContent ?? ""),
      null,
      POLL
    );
    await page.click('.ops-confirm__actions .ops-button:has-text("Done")');
    await gone(page, ".ops-confirm");
    await page.waitForTimeout(900);

    const dirty = await readWorld(reader);
    check("the world is out of its canonical shape", dirty.runs.total === 19, String(dirty.runs.total));
    check("with one rule switched off", dirty.rules[RULE_IDS[0]]?.enabled === false, String(dirty.rules[RULE_IDS[0]]?.enabled));
    check("and an extra notification", dirty.notes.total === 23, String(dirty.notes.total));

    /* Reset through the product's own control. Any overlay has to go first: it
       is a modal dialog and the chrome behind it cannot be clicked. */
    await page.bringToFront();
    await closeOverlay(page);
    await page.click('.demo-chrome button:has-text("Reset")');
    await page.waitForSelector("dialog[open]", POLL);
    await page.click('dialog[open] button:has-text("Reset demo")');
    await page.waitForTimeout(3000);

    const after = await readWorld(reader);
    check("18 automation runs return", after.runs.total === 18, String(after.runs.total));
    check("22 notifications return", after.notes.total === 22, String(after.notes.total));
    check("five rules return", Object.keys(after.rules).length === 5, String(Object.keys(after.rules).length));
    check(
      "and every one of them is enabled again",
      Object.values(after.rules).every((r) => r.enabled),
      JSON.stringify(Object.values(after.rules).map((r) => r.enabled))
    );
    check(
      "the run history is the seeded one",
      JSON.stringify(after.counts) ===
        JSON.stringify({ leads: 48, vehicles: 24, contracts: 14, reservations: 18, work: 10, payments: 26 }),
      JSON.stringify(after.counts)
    );

    /* And the screens agree with the store behind them. */
    await page.bringToFront();
    await go(page, AUTOMATIONS, READY.automations);
    const cards = await rulesOf(page);
    check("the module shows five enabled rules", cards.length === 5 && cards.every((c) => c.state === "Enabled"), cards.map((c) => c.state).join(","));
    check(
      "in the frozen order again",
      cards.map((c) => c.name).join(" | ") === RULE_NAMES.join(" | "),
      cards.map((c) => c.name).join(" | ")
    );

    await go(page, REPORTS, READY.reports);
    const titles = await allOf(page, ".ops-reports .ops-panel__title");
    check("the four panels return", titles.join(",") === PANELS.join(","), titles.join(","));
    check("the funnel counts 44 again", sumOf(await panelOf(page, "Lead funnel")) === 44);
    check(
      "the fleet counts 24 again",
      (await panelOf(page, "Fleet utilisation"))?.note === "24 vehicles",
      String((await panelOf(page, "Fleet utilisation"))?.note)
    );
    const contracts = await panelOf(page, "Contract status and value");
    check(
      "the contracts are back in their canonical split",
      JSON.stringify(barsOf(contracts)) === JSON.stringify({ Pending: 3, Active: 7, Completed: 3, Cancelled: 1 }),
      JSON.stringify(barsOf(contracts))
    );
    const payments = await panelOf(page, "Payment status");
    check(
      "and the payments in theirs, overdue included",
      JSON.stringify(barsOf(payments)) === JSON.stringify({ Paid: 18, Pending: 5, Overdue: 3 }),
      JSON.stringify(barsOf(payments))
    );

    await ctx.close();
  }
}

await browser.close();

console.log(
  `\n=== stage 09C4.5 automations and reports: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
