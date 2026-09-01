/**
 * Stage 09C2 — Operations shell, Overview and branding QA.
 *
 * Runs against a LOCAL PRODUCTION BUILD, not the dev server: this stage is
 * about what the built product actually renders.
 *
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c2-operations-ui.mjs
 *
 * Port 3001 rather than 3200: 3200 is another application on this host, and
 * 3100 is this portfolio's live production. Neither is touched.
 */

import { chromium } from "playwright";

/* Every waitForFunction here passes an explicit polling interval. Playwright
   defaults to requestAnimationFrame, and this application deliberately
   schedules no frames at rest — so rAF-based polling starves and turns a 43ms
   mutation into a 19-second measurement. The delay is in the harness, not the
   product. */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const ROUTE = `${BASE}/demos/operations`;

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

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

/* =====================================================================
   1. BRAND TERMINOLOGY AND ASSETS (static)
   ===================================================================== */

function walk(dir, exts) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".next") || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.includes(extname(entry))) out.push(full);
  }
  return out;
}

section("BRAND TERMINOLOGY");
{
  const files = [
    ...walk("src", [".ts", ".tsx", ".css"]),
    ...walk("docs", [".md", ".json"]),
    ...walk("qa", [".mjs", ".tsx"]),
    ...walk("deploy", [".ps1", ".js", ".mjs"]),
    "CLAUDE.md",
    "AGENTS.md",
  ].filter((f) => existsSync(f));

  /* Built from fragments so this harness does not itself contain the retired
     term and fail its own check. */
  const retired = ["Milky", "Intelligence"].join(" ");
  const offenders = files.filter((f) => readFileSync(f, "utf8").includes(retired));
  check("the retired design-language name appears nowhere", offenders.length === 0,
    offenders.slice(0, 4).join(", "));

  const oldMark = ["marks", "system-mark"].join("/");
  const markRefs = files.filter((f) => readFileSync(f, "utf8").includes(oldMark));
  check("the old system mark has no active references", markRefs.length === 0,
    markRefs.join(", "));
  check("the old mark file is gone", !existsSync(`public/${oldMark}.svg`));
}

section("BRAND ASSETS");
{
  check("the approved master is present", existsSync("logo.png"));
  const master = statSync("logo.png");
  check("the master is unchanged in size", master.size === 844406, `${master.size} bytes`);
  for (const [path, min] of [
    ["src/app/icon.png", 1000],
    ["src/app/apple-icon.png", 1000],
    ["public/brand/logo-96.png", 1000],
    ["public/brand/logo-192.png", 1000],
  ]) {
    check(`derived asset ${path}`, existsSync(path) && statSync(path).size > min);
  }
  check("no favicon.ico shadows the new icon", !existsSync("src/app/favicon.ico") && !existsSync("public/favicon.ico"));
}

/* =====================================================================
   2. BROWSER
   ===================================================================== */

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleProblems = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") consoleProblems.push(m.text());
});
const requests = [];
page.on("request", (r) => requests.push(r.url()));

const ready = async (p = page) => {
  await p.waitForSelector(".ops-kpi__value", { timeout: 20_000 });
  await p.evaluate(() => document.fonts.ready);
};

await page.goto(ROUTE, { waitUntil: "networkidle" });
await ready();

section("ROUTE AND METADATA");
{
  const head = await page.evaluate(() => ({
    title: document.title,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
    icon: document.querySelector('link[rel="icon"]')?.getAttribute("href") ?? null,
    apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") ?? null,
    h1: document.querySelector("h1")?.textContent ?? null,
    mains: document.querySelectorAll("main").length,
    nav: document.querySelector('nav[aria-label="Operations"]') !== null,
    current: document.querySelector('[aria-current="page"]')?.textContent?.trim() ?? null,
  }));
  check("the route renders the product", head.h1 === "Overview", String(head.h1));
  check("the page title marks it a demo", /Interactive Demo/i.test(head.title), head.title);
  check("robots is noindex, nofollow", head.robots === "noindex, nofollow", String(head.robots));
  check("the icon is the derived PNG", /icon\.png/.test(head.icon ?? ""), String(head.icon));
  check("an apple touch icon is declared", /apple-icon\.png/.test(head.apple ?? ""), String(head.apple));
  check("exactly one main landmark", head.mains === 1, String(head.mains));
  check("the sidebar is a labelled nav", head.nav === true);
  check("the active module is marked current", head.current === "Overview", String(head.current));
}

section("DISCLOSURE AND LOGO");
{
  const bar = await page.evaluate(() => {
    const disclosure = document.querySelector(".demo-disclosure")?.textContent ?? "";
    const marks = [...document.querySelectorAll("img")].map((i) => ({
      src: i.getAttribute("src"),
      w: i.naturalWidth,
      h: i.naturalHeight,
      cw: Math.round(i.getBoundingClientRect().width),
      ch: Math.round(i.getBoundingClientRect().height),
    }));
    return { disclosure, marks };
  });
  check("the disclosure is present", bar.disclosure.includes("INTERACTIVE ENGINEERING DEMO"));
  check("the disclosure keeps both halves", bar.disclosure.includes("SYNTHETIC DATA"));
  /* The site navigation is hidden on demo routes, so its two copies of the
     mark measure 0x0. The one that matters is the rendered one in the bar. */
  /* 09C2.1 replaced the square 96px derivative with a tight one that carries
     the mark's own 1077x1231 aspect: the square asset spent 11% of each side
     on transparent padding, which cost the mark visible height in the bar. */
  const rendered = bar.marks.filter((m) => (m.src ?? "").includes("mark-120") && m.cw > 0);
  check("the portfolio mark is in the demo bar", rendered.length === 1, JSON.stringify(bar.marks));
  if (rendered.length) {
    const mark = rendered[0];
    check("the mark loaded at its natural size", mark.w === 105 && mark.h === 120, `${mark.w}x${mark.h}`);
    check("the mark keeps the artwork's aspect, not a square",
      Math.abs(mark.cw / mark.ch - 105 / 120) < 0.05, `${mark.cw}x${mark.ch}`);
    check("the mark is subtle in the bar", mark.ch >= 18 && mark.ch <= 24, `${mark.ch}px tall`);
  }
}

section("OVERVIEW VALUES");
const readOverview = async (p = page) =>
  p.evaluate(() => ({
    kpis: [...document.querySelectorAll(".ops-kpi")].map((c) => ({
      label: c.querySelector(".ops-kpi__label")?.textContent ?? "",
      value: Number(c.querySelector(".ops-kpi__value")?.textContent ?? "-1"),
    })),
    funnel: [...document.querySelectorAll(".ops-funnel__row")].map((r) => ({
      stage: r.querySelector(".ops-funnel__stage")?.textContent ?? "",
      count: Number(r.querySelector(".ops-funnel__count")?.textContent ?? "-1"),
    })),
    fleet: [...document.querySelectorAll(".ops-fleet__row")].map((r) => ({
      status: r.querySelector(".ops-fleet__status")?.textContent ?? "",
      count: Number(r.querySelector(".ops-fleet__count")?.textContent ?? "-1"),
    })),
    reservations: document.querySelectorAll(".ops-table tbody tr").length,
    queue: [...document.querySelectorAll(".ops-queue__row")].map((r) => r.textContent?.trim() ?? ""),
    badge: Number(document.querySelector(".ops-notify__badge")?.textContent ?? "0"),
    actor: document.querySelector(".ops-actor__name")?.textContent ?? "",
    role: document.querySelector(".ops-actor__role")?.textContent ?? "",
    modules: [...document.querySelectorAll(".ops-sidebar__label")].map((s) => s.textContent),
    interactive: [...document.querySelectorAll("a.ops-sidebar__item")].map(
      (a) => a.querySelector(".ops-sidebar__label")?.textContent
    ),
  }));

{
  const o = await readOverview();
  const kpi = (label) => o.kpis.find((k) => k.label === label)?.value;
  check("open leads is 38", kpi("OPEN LEADS") === 38, String(kpi("OPEN LEADS")));
  check("confirmed reservations is 4", kpi("CONFIRMED RESERVATIONS") === 4, String(kpi("CONFIRMED RESERVATIONS")));
  check("vehicles available is 10", kpi("VEHICLES AVAILABLE") === 10, String(kpi("VEHICLES AVAILABLE")));
  check("payments requiring attention is 8", kpi("PAYMENTS REQUIRING ATTENTION") === 8, String(kpi("PAYMENTS REQUIRING ATTENTION")));
  check("unread notifications is 8", o.badge === 8, String(o.badge));
  check(
    "the funnel is 12/10/9/7/6",
    JSON.stringify(o.funnel.map((f) => f.count)) === JSON.stringify([12, 10, 9, 7, 6]),
    JSON.stringify(o.funnel.map((f) => f.count))
  );
  check(
    "the fleet is 10/4/7/3",
    JSON.stringify(o.fleet.map((f) => f.count)) === JSON.stringify([10, 4, 7, 3]),
    JSON.stringify(o.fleet.map((f) => f.count))
  );
  check("upcoming reservations are listed", o.reservations >= 4 && o.reservations <= 5, String(o.reservations));
  check("the action queue is capped at six", o.queue.length <= 6, String(o.queue.length));
  check("the queue leads with overdue payments", /payment/i.test(o.queue[0] ?? ""), o.queue[0] ?? "");
  check("queue rows are distinguishable", new Set(o.queue).size === o.queue.length,
    `${new Set(o.queue).size} distinct of ${o.queue.length}`);
  check("no raw entity id is displayed", !o.queue.some((q) => /_\d{4}\b/.test(q)),
    o.queue.find((q) => /_\d{4}\b/.test(q)) ?? "");
  check("the default actor is Morgan Reed, Admin", o.actor === "Morgan Reed" && o.role === "Admin",
    `${o.actor} / ${o.role}`);
  check("all eleven modules are listed for Admin", o.modules.length === 11, String(o.modules.length));
  /* This asserts temporary build state, and it moves each time a module is
     built: 09C2 shipped Overview alone, 09C3.1 added Leads. By 09C5 every
     module is interactive and the `implemented` flag that drives this — and
     this check with it — is deleted. */
  check("only the built modules are interactive",
    JSON.stringify(o.interactive) === '["Overview","Leads"]',
    JSON.stringify(o.interactive));
}

/* =====================================================================
   3. ROLES
   ===================================================================== */

section("ROLE MATRIX");
const ROLE_EXPECT = {
  Admin: { actor: "Morgan Reed", modules: 11, kpis: 4 },
  "Sales Agent": { actor: "Avery Chen", modules: 6, kpis: 2 },
  "Fleet Coordinator": { actor: "Jordan Blake", modules: 5, kpis: 2 },
  "Finance Analyst": { actor: "Taylor Quinn", modules: 5, kpis: 1 },
};

for (const [role, want] of Object.entries(ROLE_EXPECT)) {
  await page.selectOption(".ops-role__select", role);
  await page.waitForFunction(
    (r) => document.querySelector(".ops-actor__role")?.textContent === r,
    role,
    { timeout: 10_000, polling: 100 }
  );
  await page.waitForTimeout(150);
  const o = await readOverview();
  check(`${role}: actor is ${want.actor}`, o.actor === want.actor, o.actor);
  check(`${role}: ${want.modules} modules visible`, o.modules.length === want.modules, String(o.modules.length));
  check(`${role}: ${want.kpis} KPI card(s)`, o.kpis.length === want.kpis,
    o.kpis.map((k) => k.label).join(" | "));
}

section("ROLE PERSISTENCE");
{
  await page.reload({ waitUntil: "networkidle" });
  await ready();
  const role = await page.evaluate(() => document.querySelector(".ops-actor__role")?.textContent);
  check("the selected role survives a reload", role === "Finance Analyst", String(role));
  await page.selectOption(".ops-role__select", "Admin");
  await page.waitForFunction(() => document.querySelector(".ops-actor__role")?.textContent === "Admin",
    null, { polling: 100 });
}

/* =====================================================================
   4. NOTIFICATIONS
   ===================================================================== */

section("NOTIFICATIONS");
{
  const trigger = ".ops-notify__trigger";
  const expandedBefore = await page.getAttribute(trigger, "aria-expanded");
  check("the trigger is a collapsed disclosure", expandedBefore === "false", String(expandedBefore));

  await page.click(trigger);
  await page.waitForSelector(".ops-notify__panel");
  const opened = await page.evaluate(() => ({
    expanded: document.querySelector(".ops-notify__trigger")?.getAttribute("aria-expanded"),
    controls: document.querySelector(".ops-notify__trigger")?.getAttribute("aria-controls"),
    panelId: document.querySelector(".ops-notify__panel")?.id,
    items: document.querySelectorAll(".ops-notify__item").length,
    unread: document.querySelectorAll(".ops-notify__item--unread").length,
  }));
  check("the panel opens", opened.expanded === "true");
  check("the trigger controls the panel", opened.controls === opened.panelId, `${opened.controls}`);
  check("notifications are listed", opened.items > 0, String(opened.items));
  check("eight are unread", opened.unread === 8, String(opened.unread));

  await page.click(".ops-notify__mark");
  await page.waitForFunction(() => Number(document.querySelector(".ops-notify__badge")?.textContent ?? "0") === 7,
    null, { timeout: 10_000, polling: 100 });
  check("marking one read updates the badge", true, "8 -> 7");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const afterEscape = await page.evaluate(() => ({
    open: document.querySelector(".ops-notify__panel") !== null,
    focused: document.activeElement?.className ?? "",
  }));
  check("Escape closes the panel", afterEscape.open === false);
  check("focus returns to the trigger", afterEscape.focused.includes("ops-notify__trigger"),
    afterEscape.focused);

  await page.click(trigger);
  await page.waitForSelector(".ops-notify__panel");
  await page.click(".ops-notify__action");
  await page.waitForFunction(() => document.querySelector(".ops-notify__badge") === null,
    null, { timeout: 10_000, polling: 100 });
  check("mark all read clears the badge", true, "0 unread");

  await page.keyboard.press("Escape");
  /* The badge and the action queue are two independent queries revalidated by
     the same revision bump, and the queue settles a beat after the badge. Wait
     for the condition rather than for a fixed interval: a wait that never
     resolves still fails the check below. */
  await page
    .waitForFunction(
      () =>
        ![...document.querySelectorAll(".ops-queue__row")].some((r) =>
          /assigned for follow-up/.test(r.textContent ?? "")
        ),
      null,
      { timeout: 10_000, polling: 100 }
    )
    .catch(() => {});
  const queueAfter = await page.evaluate(() =>
    [...document.querySelectorAll(".ops-queue__row")].map((r) => r.textContent ?? "")
  );
  check("the action queue drops the read notifications",
    !queueAfter.some((q) => /assigned for follow-up/.test(q)), queueAfter.slice(0, 2).join(" | "));

  await page.reload({ waitUntil: "networkidle" });
  await ready();
  /* The notification query resolves from IndexedDB after first paint, so the
     badge's absence is only meaningful once that query has settled. */
  await page
    .waitForFunction(() => !document.querySelector("[aria-busy='true']"), null,
      { timeout: 10_000, polling: 100 })
    .catch(() => {});
  await page.waitForTimeout(300);
  const persisted = await page.evaluate(() => ({
    badge: document.querySelector(".ops-notify__badge")?.textContent ?? null,
    role: document.querySelector(".ops-actor__role")?.textContent ?? "?",
  }));
  check("the read state survives a reload", persisted.badge === null,
    `badge ${persisted.badge} as ${persisted.role}`);
}

/* =====================================================================
   5. RESET
   ===================================================================== */

section("RESET");
{
  await page.click(".demo-chrome__reset");
  await page.waitForSelector(".demo-dialog[open]");
  const dialog = await page.evaluate(() => ({
    modal: document.querySelector(".demo-dialog")?.matches(":modal"),
    title: document.getElementById("demo-reset-title")?.textContent,
    body: document.querySelector(".demo-dialog__body")?.textContent ?? "",
  }));
  check("the reset dialog is modal", dialog.modal === true);
  check("its copy is the shared wording", dialog.title === "Reset demo data?" &&
    dialog.body.includes("restores the original synthetic dataset"), dialog.title ?? "");

  await page.click(".demo-dialog__button--primary");
  await page.waitForFunction(
    () => Number(document.querySelector(".ops-notify__badge")?.textContent ?? "0") === 8,
    null,
    { timeout: 15_000, polling: 100 }
  );
  await page.waitForTimeout(200);
  const o = await readOverview();
  const kpi = (l) => o.kpis.find((k) => k.label === l)?.value;
  check("reset restores 38 open leads", kpi("OPEN LEADS") === 38, String(kpi("OPEN LEADS")));
  check("reset restores 4 confirmed reservations", kpi("CONFIRMED RESERVATIONS") === 4);
  check("reset restores 10 available vehicles", kpi("VEHICLES AVAILABLE") === 10);
  check("reset restores 8 payments needing attention", kpi("PAYMENTS REQUIRING ATTENTION") === 8);
  check("reset restores 8 unread notifications", o.badge === 8, String(o.badge));
  check("reset restores the Admin role", o.role === "Admin" && o.actor === "Morgan Reed",
    `${o.actor} / ${o.role}`);
}

/* =====================================================================
   6. ACCESSIBILITY AND CONTRAST
   ===================================================================== */

section("ACCESSIBILITY");
{
  const a11y = await page.evaluate(() => {
    const labelled = document.querySelector(".ops-role__select");
    const labelId = labelled?.getAttribute("id");
    return {
      roleLabel: labelId
        ? document.querySelector(`label[for="${labelId}"]`)?.textContent?.trim()
        : null,
      liveRegions: document.querySelectorAll('[role="status"]').length,
      svgHidden: [...document.querySelectorAll(".ops-fleet__ring, .ops-funnel__rail")].every(
        (el) => el.getAttribute("aria-hidden") === "true"
      ),
      fleetTextValues: [...document.querySelectorAll(".ops-fleet__row")].every(
        (r) => r.querySelector(".ops-fleet__status") && r.querySelector(".ops-fleet__count")
      ),
      table: document.querySelectorAll(".ops-table th[scope='col']").length,
      kpiHeadings: document.querySelectorAll(".ops-kpi h3").length,
      panelHeadings: document.querySelectorAll(".ops-panel h2").length,
    };
  });
  check("the role control is labelled Demo role", a11y.roleLabel === "Demo role", String(a11y.roleLabel));
  check("there is a polite status region", a11y.liveRegions >= 1, String(a11y.liveRegions));
  check("data SVG is hidden from assistive tech", a11y.svgHidden === true);
  check("every fleet state is written in text", a11y.fleetTextValues === true);
  check("the reservations table has column headers", a11y.table === 4, String(a11y.table));
  check("KPI cards are headed", a11y.kpiHeadings >= 1, String(a11y.kpiHeadings));
  check("panels are headed", a11y.panelHeadings >= 4, String(a11y.panelHeadings));
}

section("CONTRAST");
{
  const roles = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll(".ops-app *")) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const key = String(el.className);
      if (!key || seen.has(key)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.top < 0 || r.top > innerHeight) continue;
      seen.add(key);
      let host = document.elementFromPoint(r.left + Math.min(r.width / 2, 6), r.top + r.height / 2);
      let bg = "rgb(255,255,255)";
      while (host) {
        const m = getComputedStyle(host).backgroundColor.match(/[\d.]+/g);
        if (m && (m.length < 4 || parseFloat(m[3]) > 0.9)) {
          bg = `rgb(${m[0]},${m[1]},${m[2]})`;
          break;
        }
        host = host.parentElement;
      }
      out.push({ key, color: cs.color, bg, size: parseFloat(cs.fontSize), weight: cs.fontWeight });
    }
    return out;
  });

  let worst = { key: "", cr: 99 };
  let fails = 0;
  for (const r of roles) {
    const fg = r.color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const bg = r.bg.match(/[\d.]+/g).slice(0, 3).map(Number);
    const cr = ratio(fg, bg);
    const large = r.size >= 24 || (r.size >= 18.66 && Number(r.weight) >= 700);
    const need = large ? 3 : 4.5;
    if (cr < need) {
      fails += 1;
      console.log(`  FAIL  contrast ${r.key.slice(0, 34)} ${r.size}px ${cr.toFixed(2)}:1 need ${need}`);
    }
    if (cr < worst.cr) worst = { key: r.key, cr };
  }
  checks += 1;
  if (fails) failures += 1;
  console.log(
    `  ${fails === 0 ? "PASS" : "FAIL"}  ${String(roles.length).padStart(2)} text roles meet WCAG AA${
      fails === 0 ? `, worst ${worst.cr.toFixed(2)}:1 (${worst.key.slice(0, 26)})` : ""
    }`
  );
}

/* =====================================================================
   7. RESPONSIVE
   ===================================================================== */

section("RESPONSIVE");
const VIEWPORTS = [
  [1920, 1080], [1440, 900], [1366, 768], [1180, 820], [1024, 768],
  [768, 1024], [430, 932], [390, 844], [360, 800],
];
for (const [w, h] of VIEWPORTS) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  await p.goto(ROUTE, { waitUntil: "networkidle" });
  await ready(p);
  await p.screenshot({ type: "jpeg", quality: 20 });

  const m = await p.evaluate(() => {
    const nav = document.querySelector(".ops-app__nav");
    const navStyle = nav ? getComputedStyle(nav) : null;
    const persistent = navStyle?.position === "static" || navStyle?.position === "relative";
    const menu = document.querySelector(".ops-topbar__menu");
    const menuShown = menu ? getComputedStyle(menu).display !== "none" : false;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      persistentSidebar: persistent,
      menuButton: menuShown,
      kpiCols: getComputedStyle(document.querySelector(".ops-kpis")).gridTemplateColumns.split(" ").length,
      kpiWidth: Math.round(document.querySelector(".ops-kpi")?.getBoundingClientRect().width ?? 0),
      /* Excludes two non-defects: an ellipsis is deliberate truncation, and
         visually-hidden text is clipped to 1px on purpose so a screen reader
         can still read it. */
      /* Only text that is actually cut counts. Excluded: an ellipsis, which
         is deliberate truncation; visually-hidden text, clipped to 1px on
         purpose; and containers whose overflow comes from a child that
         overhangs by design, such as the notification badge sitting proud of
         its trigger. So the element must own the text. */
      clipped: [...document.querySelectorAll(".ops-app *")].filter((e) => {
        if (e.scrollWidth - e.clientWidth <= 1) return false;
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
        if (getComputedStyle(e).textOverflow === "ellipsis") return false;
        if (e.classList.contains("visually-hidden")) return false;
        return e.getBoundingClientRect().width > 2;
      }).length,
      roleFits:
        (document.querySelector(".ops-role__select")?.getBoundingClientRect().right ?? 0) <=
        document.documentElement.clientWidth + 1,
    };
  });

  check(`${w}x${h} no horizontal overflow`, m.overflow <= 0, `${m.overflow}px`);
  check(`${w}x${h} nothing clipped`, m.clipped === 0, `${m.clipped}`);
  check(`${w}x${h} exactly one navigation presentation`,
    m.persistentSidebar !== m.menuButton, `sidebar=${m.persistentSidebar} menu=${m.menuButton}`);
  check(`${w}x${h} KPI cards stay readable`, m.kpiWidth >= 150, `${m.kpiWidth}px x${m.kpiCols}`);
  check(`${w}x${h} the role control fits the bar`, m.roleFits === true);
  await c.close();
}

/* =====================================================================
   8. MEMORY FALLBACK
   ===================================================================== */

section("MEMORY FALLBACK");
{
  const failCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await failCtx.addInitScript(() => {
    const broken = {
      open() {
        const r = { onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
        setTimeout(() => r.onerror && r.onerror(), 0);
        return r;
      },
      deleteDatabase() {
        const r = { onsuccess: null, onerror: null, onblocked: null };
        setTimeout(() => r.onsuccess && r.onsuccess(), 0);
        return r;
      },
    };
    Object.defineProperty(window, "indexedDB", { configurable: true, get: () => broken });
  });
  const p = await failCtx.newPage();
  await p.goto(ROUTE, { waitUntil: "networkidle" });
  await ready(p);

  const o = await readOverview(p);
  const notice = await p.evaluate(() => ({
    top: document.querySelector(".ops-topbar__notice")?.textContent ?? null,
    chrome: document.querySelector(".demo-chrome__notice")?.textContent ?? null,
  }));
  check("the Overview still renders on the fallback",
    o.kpis.find((k) => k.label === "OPEN LEADS")?.value === 38);
  check("the session-only state is disclosed",
    (notice.chrome ?? "").includes("SESSION ONLY") || (notice.top ?? "").length > 0,
    `${notice.chrome} / ${notice.top}`);

  await p.click(".ops-notify__trigger");
  await p.waitForSelector(".ops-notify__panel");
  await p.click(".ops-notify__mark");
  await p.waitForFunction(() => Number(document.querySelector(".ops-notify__badge")?.textContent ?? "0") === 7,
    null, { timeout: 10_000, polling: 100 });
  check("a notification mutation works on the fallback", true, "8 -> 7");

  await p.keyboard.press("Escape");
  await p.click(".demo-chrome__reset");
  await p.waitForSelector(".demo-dialog[open]");
  await p.click(".demo-dialog__button--primary");
  await p.waitForFunction(() => Number(document.querySelector(".ops-notify__badge")?.textContent ?? "0") === 8,
    null, { timeout: 15_000, polling: 100 });
  check("reset works on the fallback", true, "back to 8 unread");
  await failCtx.close();
}

/* =====================================================================
   9. PERFORMANCE, CLS AND NETWORK
   ===================================================================== */

section("PERFORMANCE");
{
  const perfCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await perfCtx.newPage();
  await p.goto(ROUTE, { waitUntil: "networkidle" });
  await ready(p);
  await p.screenshot({ type: "jpeg", quality: 20 });

  const cls = await p.evaluate(
    () =>
      new Promise((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 1500);
      })
  );
  check("CLS is effectively zero after initialization", cls < 0.02, cls.toFixed(5));

  const idle = await p.evaluate(async () => {
    let intervals = 0;
    let frames = 0;
    const ri = window.setInterval;
    const rr = window.requestAnimationFrame;
    const rt = window.setTimeout;
    window.setInterval = function (...a) { intervals += 1; return ri.apply(this, a); };
    window.requestAnimationFrame = function (...a) { frames += 1; return rr.apply(this, a); };
    await new Promise((r) => rt(r, 3000));
    window.setInterval = ri;
    window.requestAnimationFrame = rr;
    return { intervals, frames };
  });
  check("no interval is scheduled while idle", idle.intervals === 0, String(idle.intervals));
  check("no animation frame loop while idle", idle.frames === 0, String(idle.frames));

  /* Measured inside the page, not through Playwright's action layer.
     Driving these from the harness measures Playwright waiting for
     actionability — which starves on rAF against an application that
     schedules no frames — and reports seconds for work that takes tens of
     milliseconds. The numbers below are the application's. */
  const timings = await p.evaluate(async () => {
    const settle = () => new Promise((r) => setTimeout(r, 0));
    const waitFor = async (test, limit = 10000) => {
      const started = performance.now();
      while (!test() && performance.now() - started < limit) {
        await new Promise((r) => setTimeout(r, 10));
      }
      return performance.now() - started;
    };

    const t0 = performance.now();
    document.querySelector(".ops-role__select").value = "Finance Analyst";
    document.querySelector(".ops-role__select").dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => document.querySelector(".ops-actor__role")?.textContent === "Finance Analyst");
    const roleSwitch = performance.now() - t0;

    document.querySelector(".ops-role__select").value = "Admin";
    document.querySelector(".ops-role__select").dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => document.querySelector(".ops-actor__role")?.textContent === "Admin");
    await settle();

    const t1 = performance.now();
    document.querySelector(".ops-notify__trigger").click();
    await waitFor(() => document.querySelector(".ops-notify__panel") !== null);
    const openPanel = performance.now() - t1;

    const t2 = performance.now();
    document.querySelector(".ops-notify__action").click();
    await waitFor(() => document.querySelector(".ops-notify__badge") === null);
    const markAll = performance.now() - t2;

    return {
      roleSwitch: Math.round(roleSwitch),
      openPanel: Math.round(openPanel),
      markAll: Math.round(markAll),
    };
  });
  console.log(`  role switch                  ${timings.roleSwitch}ms`);
  console.log(`  notification panel open      ${timings.openPanel}ms`);
  console.log(`  mark all read (8 rows)       ${timings.markAll}ms`);
  check("interactions settle well under a second",
    timings.roleSwitch < 900 && timings.openPanel < 900 && timings.markAll < 900,
    `${timings.roleSwitch}/${timings.openPanel}/${timings.markAll}ms`);
  console.log("  QA SANITY MEASUREMENT - NOT A PRODUCTION BENCHMARK");
  await perfCtx.close();
}

section("NETWORK AND CONTENT");
{
  const app = requests.filter((u) => !u.startsWith("data:"));
  const external = app.filter((u) => !u.startsWith(BASE));
  const api = app.filter((u) => u.includes("/api/"));
  check("no external request", external.length === 0, external.slice(0, 3).join(" "));
  check("no API route call", api.length === 0, api.slice(0, 3).join(" "));
  check("the logo is served locally", app.some((u) => u.includes("/brand/mark-120.png")));
  /* Scoped to what §126 actually names: errors, hydration warnings and failed
     resources. Next emits a preload hint for a route stylesheet the document
     does not claim within its window; it is a framework asset hint, not an
     application defect, and it is reported rather than hidden. */
  const serious = consoleProblems.filter(
    (t) => !/was preloaded using link preload but not used/.test(t)
  );
  const preloadHints = consoleProblems.length - serious.length;
  check("no console errors, hydration warnings or failed resources",
    serious.length === 0, serious.slice(0, 2).join(" | "));
  console.log(`  note: ${preloadHints} framework preload hint(s), not application errors`);

  const text = await page.evaluate(() => document.body.innerText);
  const patterns = {
    email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    telephone: /[+]?\d[\d\s().-]{7,}\d/,
    handle: /(^|\s)@[a-z0-9_]{3,}/i,
    brand: /\b(honda|yamaha|suzuki|kawasaki|ducati|harley|vespa|piaggio|ktm)\b/i,
  };
  for (const [name, re] of Object.entries(patterns)) {
    const hit = text.match(re);
    check(`no ${name} in the rendered product`, hit === null, hit ? hit[0] : "");
  }
}

await ctx.close();
await browser.close();

console.log(
  `\n=== stage09c2 operations ui: ${failures === 0 ? `ALL PASS (${checks} checks)` : `${failures} FAILURE(S) of ${checks}`} ===`
);
process.exit(failures === 0 ? 0 : 1);
