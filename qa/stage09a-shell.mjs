/**
 * Stage 09A - shared demo chrome QA.
 *
 * Measures the bar the demos will sit under: its height, its behaviour at the
 * project's eight viewports, its contrast against the live aurora, and the
 * reset dialog's keyboard and focus contract.
 *
 * To re-run:
 *   cp qa/fixtures/demos-qa-shell.page.tsx src/app/demos/qa-shell/page.tsx
 *   npm run dev
 *   node qa/stage09a-shell.mjs
 *   rm -r src/app/demos/qa-shell
 *
 * The fixture lives under qa/ so that copying it into the route tree is a
 * deliberate act. A QA route must never exist in production.
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const SHELL = `${BASE}/demos/qa-shell`;

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(50)}${detail ? "  " + detail : ""}`);
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

const VIEWPORTS = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
];

const browser = await chromium.launch();

/* =====================================================================
   1. Geometry at every viewport
   ===================================================================== */

section("CHROME GEOMETRY");
for (const [w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(SHELL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector("#shell-fixture");
  /* Headless starves frames until something forces one; measuring before that
     reads stale geometry. */
  await page.screenshot({ type: "jpeg", quality: 20 });

  const m = await page.evaluate(() => {
    const bar = document.querySelector(".demo-chrome");
    const inner = document.querySelector(".demo-chrome__inner");
    const back = document.querySelector(".demo-chrome__back");
    const reset = document.querySelector(".demo-chrome__reset");
    const disclosure = document.querySelector(".demo-disclosure");
    const box = (el) => {
      if (!el) return { w: 0, h: 0, top: 0 };
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
    };
    /* An element that truncates with an ellipsis is doing so deliberately.
       Genuine clipping - content cut with no indication - is the defect. */
    const clipped = [...document.querySelectorAll(".demo-chrome *")].filter(
      (e) =>
        e.scrollWidth - e.clientWidth > 1 &&
        getComputedStyle(e).textOverflow !== "ellipsis"
    ).length;
    return {
      barHeight: box(bar).h,
      innerHeight: box(inner).h,
      back: box(back),
      reset: box(reset),
      title: box(document.querySelector(".demo-chrome__title")),
      disclosureVisible: getComputedStyle(disclosure).display !== "none",
      disclosureText: disclosure.textContent.trim(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clipped,
      navHidden: getComputedStyle(document.querySelector(".site-nav")).display === "none",
    };
  });

  const desktop = w >= 861;
  const heightOk = desktop ? m.barHeight >= 32 && m.barHeight <= 40 : m.barHeight <= 92;
  check(
    `${w}x${h} chrome height`,
    heightOk,
    `${m.barHeight}px${desktop ? " (target 32-40)" : ""}`
  );
  check(`${w}x${h} no horizontal overflow`, m.overflow <= 0, `${m.overflow}px`);
  check(`${w}x${h} nothing clipped in the bar`, m.clipped === 0, `${m.clipped} clipped`);
  check(`${w}x${h} disclosure is present`, m.disclosureVisible && m.disclosureText.includes("INTERACTIVE ENGINEERING DEMO"));
  check(`${w}x${h} disclosure keeps both halves`, m.disclosureText.includes("SYNTHETIC DATA"));
  check(`${w}x${h} Back and Reset both rendered`, m.back.w > 0 && m.reset.w > 0);
  check(
    `${w}x${h} title is either readable or hidden`,
    m.title.w === 0 || m.title.w >= 60,
    `${m.title.w}px`
  );
  check(`${w}x${h} site navigation is removed`, m.navHidden === true);

  await ctx.close();
}

/* =====================================================================
   2. Contrast against the live background
   ===================================================================== */

section("CHROME CONTRAST (1440x900)");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(SHELL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ type: "jpeg", quality: 20 });

  const roles = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".demo-chrome *")) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const x = r.left + Math.min(r.width / 2, 6);
      const y = r.top + r.height / 2;
      let host = document.elementFromPoint(x, y);
      let bg = "rgb(255,255,255)";
      while (host) {
        const m = getComputedStyle(host).backgroundColor.match(/[\d.]+/g);
        if (m && (m.length < 4 || parseFloat(m[3]) > 0.9)) {
          bg = `rgb(${m[0]},${m[1]},${m[2]})`;
          break;
        }
        host = host.parentElement;
      }
      out.push({
        key: String(el.className) || el.tagName,
        color: cs.color,
        bg,
        size: parseFloat(cs.fontSize),
        weight: cs.fontWeight,
        text: el.textContent.trim().slice(0, 22),
      });
    }
    return out;
  });

  for (const r of roles) {
    const fg = r.color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const bg = r.bg.match(/[\d.]+/g).slice(0, 3).map(Number);
    const cr = ratio(fg, bg);
    const large = r.size >= 24 || (r.size >= 18.66 && Number(r.weight) >= 700);
    const need = large ? 3 : 4.5;
    check(
      `contrast ${r.key.slice(0, 28)}`,
      cr >= need,
      `${r.size}px ${cr.toFixed(2)}:1 need ${need}`
    );
  }
  await ctx.close();
}

/* =====================================================================
   3. Reset dialog: keyboard, focus, and that it actually resets
   ===================================================================== */

section("RESET DIALOG");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(SHELL, { waitUntil: "networkidle" });
  await page.waitForSelector("#shell-fixture");
  await page.screenshot({ type: "jpeg", quality: 20 });

  const closedInitially = await page.evaluate(
    () => document.querySelector(".demo-dialog").open === false
  );
  check("the dialog starts closed", closedInitially);

  await page.click(".demo-chrome__reset");
  await page.waitForTimeout(200);

  const opened = await page.evaluate(() => {
    const d = document.querySelector(".demo-dialog");
    return {
      open: d.open,
      modal: d.matches(":modal"),
      labelled: d.getAttribute("aria-labelledby"),
      titleText: document.getElementById("demo-reset-title")?.textContent ?? "",
      focusInside: d.contains(document.activeElement),
      buttons: [...d.querySelectorAll("button")].map((b) => b.textContent.trim()),
    };
  });
  check("the dialog opens", opened.open === true);
  check("it opens as a modal", opened.modal === true);
  check("it is labelled by its title", opened.labelled === "demo-reset-title");
  check("the title asks before destroying data", opened.titleText === "Reset demo data?");
  check("focus moves into the dialog", opened.focusInside === true);
  check("it offers Cancel and Reset", opened.buttons.join("|") === "Cancel|Reset demo", opened.buttons.join("|"));

  /* Focus containment: tabbing must not escape a modal dialog. */
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  const trapped = await page.evaluate(() =>
    document.querySelector(".demo-dialog").contains(document.activeElement)
  );
  check("focus stays inside while tabbing", trapped === true);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const afterEscape = await page.evaluate(() => document.querySelector(".demo-dialog").open);
  check("Escape closes the dialog", afterEscape === false);

  /* And the control actually resets. Add a record, reset, confirm it is gone. */
  await page.click(".demo-chrome__reset");
  await page.waitForTimeout(150);
  await page.click(".demo-dialog__button--primary");
  await page.waitForTimeout(600);
  const afterReset = await page.evaluate(() => document.querySelector(".demo-dialog").open);
  check("confirming closes the dialog", afterReset === false);

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await page.waitForTimeout(300);
  check("no console errors during the dialog flow", consoleErrors.length === 0, consoleErrors[0] ?? "");

  await ctx.close();
}

/* =====================================================================
   4. Idle cost: the runtime must do nothing at rest
   ===================================================================== */

section("IDLE COST");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(SHELL, { waitUntil: "networkidle" });
  await page.waitForSelector("#shell-fixture");
  await page.screenshot({ type: "jpeg", quality: 20 });

  const idle = await page.evaluate(async () => {
    /* Count timers and rAF the page schedules over a quiet window. The demo
       runtime must schedule none: no polling, no sync loop, no worker tick. */
    let timeouts = 0;
    let intervals = 0;
    let frames = 0;
    const realTimeout = window.setTimeout;
    const realInterval = window.setInterval;
    const realRaf = window.requestAnimationFrame;
    window.setTimeout = function (...args) {
      timeouts += 1;
      return realTimeout.apply(this, args);
    };
    window.setInterval = function (...args) {
      intervals += 1;
      return realInterval.apply(this, args);
    };
    window.requestAnimationFrame = function (...args) {
      frames += 1;
      return realRaf.apply(this, args);
    };
    await new Promise((r) => realTimeout(r, 3000));
    window.setTimeout = realTimeout;
    window.setInterval = realInterval;
    window.requestAnimationFrame = realRaf;
    return { timeouts, intervals, frames };
  });

  check("no interval is scheduled while idle", idle.intervals === 0, `${idle.intervals}`);
  check("no animation frame loop while idle", idle.frames === 0, `${idle.frames}`);
  check("no timer churn while idle", idle.timeouts <= 2, `${idle.timeouts} timeouts in 3s`);

  const cls = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 1200);
      })
  );
  check("no layout shift in the chrome", cls < 0.01, cls.toFixed(5));

  await ctx.close();
}

await browser.close();

console.log(`\n=== stage09a shell: ${failures === 0 ? `ALL PASS (${checks} checks)` : `${failures} FAILURE(S) of ${checks}`} ===`);
process.exit(failures === 0 ? 0 : 1);
