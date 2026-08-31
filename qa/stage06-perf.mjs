import { chromium } from "playwright";

/* Layout stability, animation cost and the reduced-motion contract for Stage 06.

   Two measurement notes, both learned the hard way:
   - Only INFINITE keyframe animations count as "animating at rest". A snapshot
     taken just after an interaction is full of 180-260ms colour transitions at
     currentTime 0; those are the interaction settling, not a persistent cost.
   - Long-task totals under `next dev` are dominated by React's development
     double-render and the always-on background layers. The authoritative
     figure is measured against the production server; see QA_BASELINE. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const infiniteIn = (scope) => `(() => document.getAnimations().filter((a) => {
  if (a.playState !== "running" || !a.animationName) return false;
  if (a.effect.getTiming().iterations !== Infinity) return false;
  const t = a.effect.target;
  return ${scope === "products" ? '!!(t && t.closest && t.closest("#products"))' : "true"};
}))()`;

async function measure(reduced) {
  const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows","--disable-background-timer-throttling"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference" });
  const p = await ctx.newPage();

  await p.addInitScript(() => {
    window.__cls = 0; window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) {
          window.__cls += e.value;
          if (e.value > 0.0001) window.__shifts.push({ v: +e.value.toFixed(5), sources: (e.sources || []).map((s) => (s.node && s.node.className ? String(s.node.className).slice(0, 40) : "?")) });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(1500); await frame(p);
  await p.evaluate(() => document.querySelector("#products").scrollIntoView({ block: "start" }));
  await p.waitForTimeout(600);

  const loadCls = await p.evaluate(() => window.__cls);
  const restProducts = (await p.evaluate(`${infiniteIn("products")}.map((a) => a.animationName)`));
  const restPage = (await p.evaluate(`${infiniteIn("page")}.map((a) => a.animationName)`));

  // Sample continuously through one run so the ambient packet cannot be missed
  // in the gap between polls -- it is short-lived under reduced motion.
  await p.click("#pscenario-tab-operations");
  await p.waitForTimeout(400);
  const seen = await p.evaluate(`new Promise((resolve) => {
    const names = new Set();
    const tick = () => {
      for (const a of ${infiniteIn("products")}) names.add(a.animationName);
      for (const a of document.getAnimations()) { if (a.playState === "running" && a.animationName && a.effect.target && a.effect.target.closest && a.effect.target.closest("#products")) names.add(a.animationName); }
    };
    document.querySelector(".pstudio__run").click();
    const iv = setInterval(tick, 40);
    tick();
    const stop = setInterval(() => {
      if (document.querySelector(".pstudio__run-label").textContent === "Run again") {
        clearInterval(iv); clearInterval(stop); resolve([...names]);
      }
    }, 40);
    setTimeout(() => { clearInterval(iv); clearInterval(stop); resolve([...names]); }, 9000);
  })`);

  for (const id of ["commerce", "field"]) {
    await p.click(`#pscenario-tab-${id}`);
    await p.waitForTimeout(400);
    await p.click(".pstudio__run");
    await p.waitForFunction(() => document.querySelector(".pstudio__run-label").textContent === "Run again", null, { timeout: 9000, polling: 120 });
    await p.waitForTimeout(500);
  }

  const r = await p.evaluate(() => ({
    cls: window.__cls, shifts: window.__shifts,
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    contentAnim: getComputedStyle(document.querySelector(".passist__body")).animationName,
    synced: !!document.querySelector(".pmob__synced"),
    settled: document.querySelector(".pflow__tag").textContent,
    passed: document.querySelectorAll(".pflow__node.is-passed").length,
    live: document.querySelector('.pstudio [aria-live="polite"]').textContent,
    nodes: document.querySelectorAll("#products *").length,
  }));
  const afterProducts = await p.evaluate(`${infiniteIn("products")}.map((a) => a.animationName)`);
  await browser.close();
  return { loadCls, restProducts, restPage, seen, afterProducts, ...r };
}

const n = await measure(false);
console.log(`=== STAGE 06 STABILITY / ANIMATION COST  (${BASE}, no-preference) ===`);
console.log(`  CLS at load ......................... ${n.loadCls.toFixed(5)} ${pass(n.loadCls <= 0.02)}`);
console.log(`  CLS after 3 scenarios + 3 flows ..... ${n.cls.toFixed(5)} ${pass(n.cls <= 0.02)}`);
console.log(`  layout shift sources ................ ${n.shifts.length ? JSON.stringify(n.shifts) : "none"}`);
console.log(`  DOM nodes in #products .............. ${n.nodes}`);
console.log(`  infinite animations at rest ......... Stage 06: ${n.restProducts.length} ${pass(n.restProducts.length === 0)} | page-wide: ${n.restPage.length} (frozen stages 01/04/05)`);
console.log(`  infinite animations after 3 flows ... ${n.afterProducts.length} ${pass(n.afterProducts.length === 0)}`);
console.log(`  keyframe animations during a flow ... ${JSON.stringify(n.seen)}`);
console.log(`  flow settled ........................ ${n.settled} / ${n.passed} passed / synced ${n.synced}`);

const r = await measure(true);
console.log(`\n=== STAGE 06 REDUCED MOTION ===`);
console.log(`  media query honoured ................ ${r.reduced} ${pass(r.reduced)}`);
console.log(`  content transition animation ........ ${r.contentAnim} ${pass(r.contentAnim === "none")}`);
console.log(`  keyframe animations during a flow ... ${JSON.stringify(r.seen)} ${pass(r.seen.length === 0)}`);
console.log(`  infinite animations at rest ......... Stage 06: ${r.restProducts.length} ${pass(r.restProducts.length === 0)} | page-wide: ${r.restPage.length} ${pass(r.restPage.length === 0)}`);
console.log(`  CLS ................................. ${r.cls.toFixed(5)} ${pass(r.cls <= 0.02)}`);
console.log(`  content still changed ............... ${r.settled} / ${r.passed} passed / synced ${r.synced} / live "${r.live}"`);

const reducedOk = r.reduced && r.contentAnim === "none" && r.seen.length === 0 && r.restProducts.length === 0
  && r.restPage.length === 0 && r.cls <= 0.02 && r.synced && r.passed === 6
  && r.settled === "STATE / SETTLED" && r.live === "Product flow complete.";
console.log(`  reduced-motion contract ............. ${pass(reducedOk)}`);

const ok = n.loadCls <= 0.02 && n.cls <= 0.02 && n.restProducts.length === 0 && n.afterProducts.length === 0
  && n.seen.includes("ppacket") && reducedOk;
console.log(`\n=== stage06 performance: ${ok ? "ALL PASS" : "FAIL"} ===`);
process.exit(ok ? 0 : 1);
