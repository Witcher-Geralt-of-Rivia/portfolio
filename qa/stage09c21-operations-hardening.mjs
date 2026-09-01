/**
 * Stage 09C2.1 — Operations shell hardening QA.
 *
 * Stage 09C2 asked whether the shell rendered. This asks whether what it
 * renders is honest: that every number on the Overview means something a
 * reader can check, that a role sees its own data and no one else's, that the
 * notification panel is usable on a phone, and that the mark is large enough
 * to read.
 *
 * Runs against a LOCAL PRODUCTION BUILD:
 *
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c21-operations-hardening.mjs
 *
 * Port 3001, never 3200: 3200 belongs to another application on this host and
 * 3100 is this portfolio's live production. Neither is touched.
 */

import { chromium } from "playwright";
import { readFileSync, statSync } from "node:fs";
import { PNG } from "pngjs";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const ROUTE = `${BASE}/demos/operations`;

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(56)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

/* Every waitForFunction passes an explicit polling interval. Playwright polls
   on requestAnimationFrame by default, and this application schedules no
   frames at rest, so an rAF-based wait starves against it. */
const POLL = { polling: 100, timeout: 15000 };

/* =====================================================================
   1. THE MASTER ARTWORK AND THE MARK DERIVED FROM IT
   ===================================================================== */

section("LOGO");
{
  /* The master is approved artwork. It is read here and never written: the
     stage forbids overwriting, recompressing, cropping or regenerating it. */
  const bytes = statSync("logo.png").size;
  const master = PNG.sync.read(readFileSync("logo.png"));
  check("the master logo is unchanged", bytes === 844406, `${bytes} bytes`);
  check("the master is 1254x1254", master.width === 1254 && master.height === 1254);

  const bounds = (png) => {
    let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
    for (let y = 0; y < png.height; y += 1) {
      for (let x = 0; x < png.width; x += 1) {
        if (png.data[(png.width * y + x) * 4 + 3] > 1) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };

  const mb = bounds(master);
  const masterFill = (mb.w * mb.h) / (master.width * master.height);
  console.log(
    `  note: master artwork occupies ${mb.w}x${mb.h} of ${master.width}x${master.height}` +
      ` (${(masterFill * 100).toFixed(1)}% of the frame)`
  );

  /* The whole point of the tight derivative: the master centres its mark in a
     square with roughly 11% dead space on each side, which cost the navigation
     five visible pixels. The derived asset must not carry that padding. */
  const mark = PNG.sync.read(readFileSync("public/brand/mark-120.png"));
  const kb = bounds(mark);
  const markFill = (kb.w * kb.h) / (mark.width * mark.height);
  check("the derived mark is 120px tall", mark.height === 120, `${mark.width}x${mark.height}`);
  check(
    "the mark fills its frame better than the master",
    markFill > masterFill + 0.1,
    `${(markFill * 100).toFixed(1)}% vs ${(masterFill * 100).toFixed(1)}%`
  );
  check(
    "the mark keeps the master's aspect within 2%",
    Math.abs(mb.w / mb.h - kb.w / kb.h) / (mb.w / mb.h) < 0.02,
    `${(kb.w / kb.h).toFixed(3)} vs ${(mb.w / mb.h).toFixed(3)}`
  );

  /* A margin proves nothing was cropped: the outer glow is soft, and trimming
     to the exact alpha bound would shave it. */
  const margin = Math.min(kb.x0, kb.y0, mark.width - (kb.x0 + kb.w), mark.height - (kb.y0 + kb.h));
  check("the trim leaves a safety margin, so nothing is cropped", margin >= 2, `${margin}px`);

  let opaqueCorner = 0;
  for (const [x, y] of [[0, 0], [mark.width - 1, 0], [0, mark.height - 1], [mark.width - 1, mark.height - 1]]) {
    if (mark.data[(mark.width * y + x) * 4 + 3] !== 0) opaqueCorner += 1;
  }
  check("the mark has transparent corners, so no plate is drawn", opaqueCorner === 0);
}

/* =====================================================================
   2. THE RENDERED PRODUCT
   ===================================================================== */

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(ROUTE, { waitUntil: "networkidle" });
await page.waitForSelector(".ops-kpi__value");

const setRole = async (role) => {
  await page.selectOption(".ops-role__select", role);
  await page.waitForFunction(
    (r) => document.querySelector(".ops-actor__role")?.textContent === r,
    role,
    POLL
  );
  await page.waitForFunction(() => !document.querySelector("[aria-busy='true']"), null, POLL);
};

section("MARK SIZE IN THE SHELL");
{
  /* The site navigation is not rendered over a demo, so its mark is measured
     where it actually appears: the portfolio itself. */
  const home = await ctx.newPage();
  await home.goto(BASE, { waitUntil: "networkidle" });
  const nav = await home.evaluate(() => {
    const el = [...document.querySelectorAll(".site-nav__mark")].find(
      (e) => e.getBoundingClientRect().height > 0
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, src: el.getAttribute("src") };
  });
  await home.close();

  const m = await page.evaluate(() => {
    const bar = document.querySelector(".demo-chrome__mark");
    const box = (e) => (e ? e.getBoundingClientRect() : null);
    return {
      bar: box(bar) && { w: box(bar).width, h: box(bar).height, src: bar.getAttribute("src") },
    };
  });
  m.nav = nav;

  check("the navigation mark uses the tight asset", m.nav?.src === "/brand/mark-120.png", m.nav?.src);
  /* 09C2 rendered 28px square from a padded source, of which 25px was mark.
     The tight asset at 30px tall is what earns the extra visible height. */
  check("the navigation mark is at least 30px tall", (m.nav?.h ?? 0) >= 30, `${m.nav?.h}px`);
  check(
    "the navigation mark is undistorted",
    m.nav && Math.abs(m.nav.w / m.nav.h - 105 / 120) < 0.03,
    `${(m.nav.w / m.nav.h).toFixed(3)}`
  );
  if (m.bar) {
    check("the demo bar mark uses the tight asset", m.bar.src === "/brand/mark-120.png", m.bar.src);
    check(
      "the demo bar mark is undistorted",
      Math.abs(m.bar.w / m.bar.h - 105 / 120) < 0.05,
      `${(m.bar.w / m.bar.h).toFixed(3)}`
    );
  }
}

section("PRODUCT IDENTITY IS STATED ONCE");
{
  const m = await page.evaluate(() => {
    const text = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim());
    return {
      chromeTitle: document.querySelector(".demo-chrome__title") !== null,
      consoleMentions: (document.body.innerText.match(/Operations Console/g) ?? []).length,
      /* The sidebar names the product on a wide screen and the top bar does it
         when the sidebar collapses into a drawer. Only one is ever visible, so
         the name is stated once at every width rather than once in the DOM. */
      productNodes: [...document.querySelectorAll(".ops-sidebar__product, .ops-topbar__product")]
        .filter((e) => e.getBoundingClientRect().height > 0)
        .map((e) => e.textContent.trim()),
      routeH1: text("h1"),
      mainLandmarks: document.querySelectorAll("main").length,
    };
  });

  /* The shared bar carried the demo's title while the product beneath it
     already names itself in the sidebar and again in the route heading. The
     bar's title stands down rather than the product's own identity. */
  check("the shared bar states no product title", !m.chromeTitle);
  check("the product names itself exactly once", m.consoleMentions === 1, `${m.consoleMentions}`);
  check("exactly one visible node carries the product name",
    m.productNodes.length === 1 && m.productNodes[0] === "Operations Console",
    m.productNodes.join(" | "));
  check("exactly one h1 names the route", m.routeH1.length === 1, m.routeH1.join(" | "));
  check("exactly one main landmark", m.mainLandmarks === 1, `${m.mainLandmarks}`);
}

section("KPI CARDS CARRY MEANING, NOT DECORATION");
{
  const m = await page.evaluate(() => ({
    /* A progress bar needs a denominator. These KPIs have none — "38 open
       leads" is not 38% of anything — so a bar drawn under them was a
       decoration that read as a measurement. */
    bars: document.querySelectorAll(".ops-kpi progress, .ops-kpi__bar, .ops-kpi__track, .ops-kpi__fill").length,
    cards: [...document.querySelectorAll(".ops-kpi")].map((card) => ({
      label: card.querySelector(".ops-kpi__label")?.textContent ?? "",
      value: Number(card.querySelector(".ops-kpi__value")?.textContent ?? "NaN"),
      parts: [...card.querySelectorAll(".ops-kpi__part")].map((p) => ({
        count: Number(p.querySelector(".ops-kpi__part-count")?.textContent ?? "NaN"),
        label: p.querySelector(".ops-kpi__part-label")?.textContent ?? "",
      })),
      note: card.querySelector(".ops-kpi__note")?.textContent ?? "",
    })),
  }));

  check("no KPI draws a progress bar", m.bars === 0, `${m.bars} found`);
  check("four KPI cards for Admin", m.cards.length === 4, `${m.cards.length}`);

  /* A breakdown that is cut off mid-part is worse than no breakdown: it reads
     as a complete list and is not one. Each part is nowrap by design, so the
     container has to be free to wrap between them. */
  const fit = await page.evaluate(() =>
    [...document.querySelectorAll(".ops-kpi__parts, .ops-kpi__note")].map((el) => ({
      label: el.closest(".ops-kpi")?.querySelector(".ops-kpi__label")?.textContent ?? "?",
      overflow: el.scrollWidth - el.clientWidth,
    }))
  );
  for (const f of fit) {
    check(`${f.label.toLowerCase()}: the breakdown is not clipped`, f.overflow <= 0, `${f.overflow}px`);
  }

  for (const card of m.cards) {
    const name = card.label.toLowerCase();
    check(`${name}: the headline is a number`, Number.isFinite(card.value), `${card.value}`);
    if (card.parts.length > 0) {
      const sum = card.parts.reduce((t, p) => t + p.count, 0);
      /* The breakdown is the check a reader can do on sight, so it must
         actually add up to the headline above it. */
      check(
        `${name}: the breakdown sums to the headline`,
        sum === card.value,
        `${card.parts.map((p) => `${p.count} ${p.label}`).join(" + ")} = ${sum} vs ${card.value}`
      );
      check(`${name}: every part is labelled`, card.parts.every((p) => p.label.length > 0));
    } else {
      check(`${name}: carries a note instead of a bare number`, card.note.trim().length > 0, card.note);
    }
  }

  /* No previous period exists in this demo, so any comparison would be
     invented. */
  const text = await page.evaluate(() => document.body.innerText);
  for (const re of [/vs\.? last/i, /[+-]\d+(\.\d+)?%/, /\bmonth over month\b/i, /\btrend(ing)?\b/i]) {
    check(`no fabricated comparison matching ${re}`, !re.test(text), (text.match(re) ?? [""])[0]);
  }
}

/* =====================================================================
   3. ROLE COMPOSITION AND DATA LEAKS
   ===================================================================== */

/* Derived from permissions.ts by hand so the harness is an independent
   statement of the rule rather than a mirror of the code under test. */
const EXPECTED = {
  Admin: {
    kpis: ["OPEN LEADS", "CONFIRMED RESERVATIONS", "VEHICLES AVAILABLE", "PAYMENTS REQUIRING ATTENTION"],
    panels: ["Lead funnel", "Fleet status", "Upcoming reservations", "Action queue"],
    categories: ["CRM", "Reservation", "Finance", "Maintenance", "Automation"],
    queueKinds: ["Payment", "Maintenance", "Follow-up", "Notification"],
  },
  "Sales Agent": {
    kpis: ["OPEN LEADS", "CONFIRMED RESERVATIONS"],
    panels: ["Lead funnel", "Upcoming reservations", "Action queue"],
    categories: ["CRM", "Reservation"],
    queueKinds: ["Follow-up", "Notification"],
  },
  "Fleet Coordinator": {
    kpis: ["CONFIRMED RESERVATIONS", "VEHICLES AVAILABLE"],
    panels: ["Fleet status", "Upcoming reservations", "Action queue"],
    categories: ["Reservation", "Maintenance"],
    queueKinds: ["Maintenance", "Notification"],
  },
  "Finance Analyst": {
    kpis: ["PAYMENTS REQUIRING ATTENTION"],
    panels: ["Payment status", "Contract status", "Action queue"],
    categories: ["Finance"],
    queueKinds: ["Payment", "Notification"],
  },
};

/* A panel is a module's data in summary form, so a role that cannot open the
   module must not see the panel either. */
const ALL_PANELS = [
  "Lead funnel",
  "Fleet status",
  "Upcoming reservations",
  "Payment status",
  "Contract status",
  "Action queue",
];
const ALL_KPIS = EXPECTED.Admin.kpis.concat(["PAYMENTS REQUIRING ATTENTION"]);

for (const [role, want] of Object.entries(EXPECTED)) {
  section(`ROLE — ${role.toUpperCase()}`);
  await setRole(role);

  const seen = await page.evaluate(() => ({
    kpis: [...document.querySelectorAll(".ops-kpi__label")].map((e) => e.textContent.trim()),
    panels: [...document.querySelectorAll(".ops-panel__title")].map((e) => e.textContent.trim()),
    queue: [...document.querySelectorAll(".ops-queue__row")].map((r) => ({
      kind: r.querySelector(".ops-pill")?.textContent.trim() ?? "",
      label: r.querySelector(".ops-queue__label")?.textContent.trim() ?? "",
    })),
    badge: Number(document.querySelector(".ops-notify__badge")?.textContent ?? "0"),
    navModules: [...document.querySelectorAll(".ops-nav__label")].map((e) => e.textContent.trim()),
  }));

  check("KPI set matches the permission matrix", JSON.stringify(seen.kpis) === JSON.stringify(want.kpis), seen.kpis.join(" | "));
  check("panel set matches the permission matrix", JSON.stringify(seen.panels) === JSON.stringify(want.panels), seen.panels.join(" | "));

  const forbiddenPanels = ALL_PANELS.filter((p) => !want.panels.includes(p) && seen.panels.includes(p));
  const forbiddenKpis = [...new Set(ALL_KPIS)].filter((k) => !want.kpis.includes(k) && seen.kpis.includes(k));
  check("no panel from a module this role cannot open", forbiddenPanels.length === 0, forbiddenPanels.join(", "));
  check("no KPI from a module this role cannot open", forbiddenKpis.length === 0, forbiddenKpis.join(", "));

  const strayQueue = seen.queue.filter((q) => !want.queueKinds.includes(q.kind));
  check("every action queue row belongs to this role", strayQueue.length === 0, strayQueue.map((q) => q.kind).join(", "));

  /* Open the panel and compare the badge against the list it labels. The
     badge counting the unfiltered set was the leak this stage fixes: Finance
     showed eight while its own list held three. */
  await page.click(".ops-notify__trigger");
  await page.waitForSelector(".ops-notify__panel");
  const notif = await page.evaluate(() => ({
    categories: [...document.querySelectorAll(".ops-notify__category")].map((e) => e.textContent.trim()),
    unreadRows: document.querySelectorAll(".ops-notify__item--unread").length,
    rows: document.querySelectorAll(".ops-notify__item").length,
  }));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ops-notify__panel"), null, POLL);

  const strayCats = [...new Set(notif.categories)].filter((c) => !want.categories.includes(c));
  check("every notification belongs to a module this role can open", strayCats.length === 0, strayCats.join(", "));
  check(
    "the badge counts this role's own unread notifications",
    seen.badge === notif.unreadRows,
    `badge ${seen.badge} vs ${notif.unreadRows} unread of ${notif.rows}`
  );

  const navStray = seen.navModules.filter((n) =>
    role === "Sales Agent" ? ["Fleet", "Maintenance", "Payments", "Automations", "Reports"].includes(n)
      : role === "Fleet Coordinator" ? ["Leads", "Customers", "Payments", "Automations", "Reports", "Inbox"].includes(n)
      : role === "Finance Analyst" ? ["Leads", "Customers", "Fleet", "Maintenance", "Automations", "Inbox"].includes(n)
      : false
  );
  check("navigation advertises no module this role cannot open", navStray.length === 0, navStray.join(", "));
}

/* The strongest statement of the rule: no non-Admin role may see anything
   Admin cannot, and each must see strictly less. */
section("ROLE CONTAINMENT");
{
  const collect = async (role) => {
    await setRole(role);
    await page.click(".ops-notify__trigger");
    await page.waitForSelector(".ops-notify__panel");
    const v = await page.evaluate(() => [
      ...[...document.querySelectorAll(".ops-notify__category")].map((e) => "n:" + e.textContent.trim()),
      ...[...document.querySelectorAll(".ops-panel__title")].map((e) => "p:" + e.textContent.trim()),
      ...[...document.querySelectorAll(".ops-nav__label")].map((e) => "m:" + e.textContent.trim()),
    ]);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".ops-notify__panel"), null, POLL);
    return new Set(v);
  };

  const admin = await collect("Admin");
  for (const role of ["Sales Agent", "Fleet Coordinator", "Finance Analyst"]) {
    const s = await collect(role);
    /* Payment status and Contract status are Finance's substitutes for the
       operational panels it cannot see, so they are the one thing Admin does
       not render. Everything else must be a subset. */
    const beyond = [...s].filter((x) => !admin.has(x) && !["p:Payment status", "p:Contract status"].includes(x));
    check(`${role} sees nothing beyond Admin`, beyond.length === 0, beyond.join(", "));
    check(`${role} sees strictly less than Admin`, s.size < admin.size, `${s.size} vs ${admin.size}`);
  }
}

await setRole("Admin");

/* =====================================================================
   4. THE NOTIFICATION PANEL ON A PHONE
   ===================================================================== */

for (const width of [390, 360]) {
  section(`MOBILE NOTIFICATIONS — ${width}px`);
  const mctx = await browser.newContext({ viewport: { width, height: 844 } });
  const mp = await mctx.newPage();
  await mp.goto(ROUTE, { waitUntil: "networkidle" });
  await mp.waitForSelector(".ops-kpi__value");

  const pre = await mp.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    /* The sidebar collapses into a drawer here, so the top bar takes over
       naming the product. Exactly one of them may be visible. */
    productNodes: [...document.querySelectorAll(".ops-sidebar__product, .ops-topbar__product")]
      .filter((e) => e.getBoundingClientRect().height > 0)
      .map((e) => e.textContent.trim()),
  }));
  check("no horizontal overflow before opening", pre.overflow <= 0, `${pre.overflow}px`);
  check("the product is still named exactly once", pre.productNodes.length === 1,
    pre.productNodes.join(" | "));

  await mp.click(".ops-notify__trigger");
  await mp.waitForSelector(".ops-notify__panel");

  const m = await mp.evaluate(() => {
    const panel = document.querySelector(".ops-notify__panel");
    const list = document.querySelector(".ops-notify__list");
    const topbar = document.querySelector(".ops-topbar");
    const r = panel.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      vw: window.innerWidth,
      vh: window.innerHeight,
      topbarBottom: topbar.getBoundingClientRect().bottom,
      widthRatio: r.width / window.innerWidth,
      scrim: document.querySelectorAll(".ops-notify__scrim").length,
      close: document.querySelectorAll(".ops-notify__close").length,
      bodyLocked: getComputedStyle(document.body).overflow === "hidden",
      listScrolls: list.scrollHeight > list.clientHeight + 1,
      rows: document.querySelectorAll(".ops-notify__item").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  /* A popover anchored to a 24px bell overflowed the screen on a phone. The
     sheet is the fix: full width, below the bar it belongs to, inside the
     viewport at both ends. */
  check("the panel stays inside the viewport horizontally", m.left >= -1 && m.right <= m.vw + 1, `${Math.round(m.left)}..${Math.round(m.right)} of ${m.vw}`);
  check("the panel presents as a full-width sheet", m.widthRatio > 0.9, `${(m.widthRatio * 100).toFixed(0)}%`);
  check("the panel opens below the bar it belongs to", m.top >= m.topbarBottom - 1, `${Math.round(m.top)} vs ${Math.round(m.topbarBottom)}`);
  check("the panel bottom stays on screen", m.bottom <= m.vh + 1, `${Math.round(m.bottom)} of ${m.vh}`);
  check("no horizontal overflow while open", m.overflow <= 0, `${m.overflow}px`);
  check("a scrim covers the page behind", m.scrim === 1);
  check("an explicit close control exists for touch", m.close === 1);
  check("the page behind does not scroll", m.bodyLocked);
  check("the list scrolls rather than the page", m.listScrolls, `${m.rows} rows`);

  /* Every row must be reachable, not merely present in the DOM. */
  const reachable = await mp.evaluate(async () => {
    const list = document.querySelector(".ops-notify__list");
    list.scrollTop = list.scrollHeight;
    await new Promise((r) => setTimeout(r, 60));
    const items = [...document.querySelectorAll(".ops-notify__item")];
    const last = items[items.length - 1].getBoundingClientRect();
    return { lastBottom: last.bottom, vh: window.innerHeight, count: items.length };
  });
  check(
    "the last notification is reachable by scrolling",
    reachable.lastBottom <= reachable.vh + 1,
    `${Math.round(reachable.lastBottom)} of ${reachable.vh}`
  );

  await mp.click(".ops-notify__close");
  await mp.waitForFunction(() => !document.querySelector(".ops-notify__panel"), null, POLL);
  const restored = await mp.evaluate(() => ({
    locked: getComputedStyle(document.body).overflow === "hidden",
    focused: document.activeElement?.className ?? "",
  }));
  check("closing restores page scrolling", !restored.locked);
  check("closing returns focus to the trigger", restored.focused.includes("ops-notify__trigger"), restored.focused);

  /* The shared bar has to wrap here. Whatever order it takes, nothing may sit
     off screen and no row may be empty. */
  const bar = await mp.evaluate(() => {
    const inner = document.querySelector(".demo-chrome__inner");
    return [...inner.children]
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { cls: String(e.className).split(" ")[0], left: r.left, right: r.right, w: r.width };
      });
  });
  check("every shared-bar item is on screen", bar.every((b) => b.left >= -1 && b.right <= width + 1), JSON.stringify(bar.map((b) => b.cls)));
  check("the shared bar renders no empty filler", bar.every((b) => b.w > 0));

  await mctx.close();
}

/* =====================================================================
   5. THE FIXES SURVIVE A RESET
   ===================================================================== */

section("RESET");
{
  await setRole("Finance Analyst");
  /* Reset is confirmed through the shared <dialog>, not a native confirm(). */
  await page.click(".demo-chrome__reset");
  await page.waitForSelector(".demo-dialog[open]");
  await page.click(".demo-dialog__button--primary");
  await page.waitForFunction(
    () => document.querySelector(".ops-actor__role")?.textContent === "Admin",
    null,
    POLL
  );
  await page.waitForTimeout(200);
  await page.waitForFunction(() => !document.querySelector("[aria-busy='true']"), null, POLL);
  const m = await page.evaluate(() => ({
    role: document.querySelector(".ops-role__select")?.value,
    kpis: document.querySelectorAll(".ops-kpi").length,
    badge: Number(document.querySelector(".ops-notify__badge")?.textContent ?? "0"),
    values: [...document.querySelectorAll(".ops-kpi__value")].map((e) => e.textContent.trim()),
  }));
  check("reset returns to Admin", m.role === "Admin", m.role);
  check("reset restores the four Admin KPIs", m.kpis === 4, `${m.kpis}`);
  check("reset restores the seeded figures", m.values.join(",") === "38,4,10,8", m.values.join(","));
  check("reset restores the unread badge", m.badge === 8, `${m.badge}`);
}

await ctx.close();
await browser.close();

console.log(
  `\n=== stage09c2.1 hardening: ${failures === 0 ? `ALL PASS (${checks} checks)` : `${failures} FAILURE(S) of ${checks}`} ===`
);
process.exit(failures === 0 ? 0 : 1);
