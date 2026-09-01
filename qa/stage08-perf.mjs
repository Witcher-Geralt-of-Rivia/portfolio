import { chromium } from "playwright";

/* Layout stability, idle cost, execution cost and the reduced-motion contract.

   Only INFINITE keyframe animations count as "animating at rest": a snapshot
   taken just after an interaction is full of short transitions at currentTime
   0, which are the interaction settling, not a standing cost. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const IDS = ["api", "ratelimit", "webhook", "queue", "idempotency"];

const infinite = (scoped) => `document.getAnimations().filter((a) => {
  if (a.playState !== "running" || !a.animationName) return false;
  if (a.effect.getTiming().iterations !== Infinity) return false;
  const t = a.effect.target;
  return ${scoped ? '!!(t && t.closest && t.closest("#lab"))' : "true"};
}).map((a) => a.animationName)`;

async function measure(reduced) {
  const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows","--disable-background-timer-throttling"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference" });
  const p = await ctx.newPage();

  await p.addInitScript(() => {
    window.__cls = 0; window.__shifts = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.hadRecentInput) {
          window.__cls += e.value;
          if (e.value > 0.0001) window.__shifts.push({ v: +e.value.toFixed(5), src: (e.sources || []).map((s) => (s.node && s.node.className ? String(s.node.className).slice(0, 34) : "?")) });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(1400); await frame(p);
  await p.evaluate(() => document.querySelector("#lab").scrollIntoView({ block: "start" }));
  await p.waitForTimeout(700);

  const loadCls = await p.evaluate(() => window.__cls);
  const restScoped = await p.evaluate(infinite(true));
  const restPage = await p.evaluate(infinite(false));

  /* Idle cost over ~6s with the section on screen and untouched. */
  const idle = await p.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now();
    let longTasks = 0, layouts = 0, recalcs = 0;
    const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks += e.duration; });
    try { po.observe({ type: "longtask", buffered: false }); } catch { /* unsupported */ }
    setTimeout(() => {
      po.disconnect();
      resolve({ ms: Math.round(performance.now() - t0), longTasks: Math.round(longTasks), layouts, recalcs });
    }, 6000);
  }));

  /* Execution cost: long-task time across one run of every experiment. */
  const execStart = await p.evaluate(() => {
    window.__long = 0;
    window.__po = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += e.duration; });
    try { window.__po.observe({ type: "longtask", buffered: false }); } catch { /* unsupported */ }
    return performance.now();
  });
  /* Pass 1: cost only. No sampler runs during these five, because polling
     document.getAnimations() every 30ms is itself long-task work and would be
     measuring the measurement. */
  for (const id of IDS) {
    await p.click(`#lexp-tab-${id}`);
    await p.waitForTimeout(220);
    await p.click(".lab__run");
    await p.waitForFunction(() => !document.querySelector(".lab__run").disabled, null, { timeout: 15000, polling: 80 });
  }
  const exec = await p.evaluate((t0) => {
    window.__po.disconnect();
    return { long: Math.round(window.__long), ms: Math.round(performance.now() - t0) };
  }, execStart);

  /* Pass 2: which keyframe animations actually run, sampled in flight. Checking
     after a run has finished can never observe them, which would make the
     reduced-motion assertion trivially true. Cost is not measured here. */
  const seen = new Set();
  for (const id of IDS) {
    await p.click(`#lexp-tab-${id}`);
    await p.waitForTimeout(200);
    const names = await p.evaluate(`new Promise((resolve) => {
      const found = new Set();
      const tick = () => {
        for (const a of document.getAnimations()) {
          if (a.playState === "running" && a.animationName && a.effect.target &&
              a.effect.target.closest && a.effect.target.closest("#lab")) found.add(a.animationName);
        }
      };
      document.querySelector(".lab__run").click();
      const iv = setInterval(tick, 40); tick();
      const stop = setInterval(() => {
        if (!document.querySelector(".lab__run").disabled) { clearInterval(iv); clearInterval(stop); resolve([...found]); }
      }, 40);
      setTimeout(() => { clearInterval(iv); clearInterval(stop); resolve([...found]); }, 15000);
    })`);
    for (const n of names) seen.add(n);
  }

  const r = await p.evaluate(() => ({
    cls: window.__cls, shifts: window.__shifts,
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    runFillAnim: getComputedStyle(document.querySelector(".lab__run-fill")).animationName,
    nodes: document.querySelectorAll("#lab *").length,
    contentVisible:
      !!document.querySelector(".lflow__list") &&
      document.querySelectorAll(".lstage").length > 0 &&
      !!document.querySelector(".lobs__event"),
  }));
  const afterScoped = await p.evaluate(infinite(true));
  await browser.close();
  return { loadCls, restScoped, restPage, idle, exec, seen: [...seen], afterScoped, ...r };
}

const n = await measure(false);
console.log(`=== STAGE 08 STABILITY / COST  (${BASE}, no-preference) ===`);
console.log(`  CLS at load ......................... ${n.loadCls.toFixed(5)} ${pass(n.loadCls <= 0.02)}`);
console.log(`  CLS after 5 experiments + 5 runs .... ${n.cls.toFixed(5)} ${pass(n.cls <= 0.02)}`);
console.log(`  layout shift sources ................ ${n.shifts.length ? JSON.stringify(n.shifts.slice(0, 3)) : "none"}`);
console.log(`  DOM nodes in #lab ................... ${n.nodes}`);
console.log(`  idle 6s: long-task time ............. ${n.idle.longTasks}ms over ${n.idle.ms}ms ${pass(n.idle.longTasks < 400)}`);
console.log(`  execution: long-task time ........... ${n.exec.long}ms over ${n.exec.ms}ms for 5 runs ${pass(n.exec.long < 1200)}`);
console.log(`  infinite animations at rest ......... Stage 08: ${n.restScoped.length} ${pass(n.restScoped.length === 0)} | page-wide ${n.restPage.length}`);
console.log(`  infinite animations after 5 runs .... ${n.afterScoped.length} ${pass(n.afterScoped.length === 0)}`);
console.log(`  keyframe animations seen during runs  ${JSON.stringify(n.seen)}`);

const r = await measure(true);
console.log(`\n=== STAGE 08 REDUCED MOTION ===`);
console.log(`  media query honoured ................ ${r.reduced} ${pass(r.reduced)}`);
console.log(`  run-progress animation .............. ${r.runFillAnim} ${pass(r.runFillAnim === "none")}`);
console.log(`  keyframe animations during runs ..... ${JSON.stringify(r.seen)} ${pass(r.seen.length === 0)}`);
console.log(`  infinite animations at rest ......... Stage 08: ${r.restScoped.length} ${pass(r.restScoped.length === 0)} | page-wide ${r.restPage.length} ${pass(r.restPage.length === 0)}`);
console.log(`  CLS ................................. ${r.cls.toFixed(5)} ${pass(r.cls <= 0.02)}`);
console.log(`  every experiment still runs ......... ${r.contentVisible} ${pass(r.contentVisible)}`);

const reducedOk = r.reduced && r.runFillAnim === "none" && r.seen.length === 0 &&
  r.restScoped.length === 0 && r.restPage.length === 0 && r.cls <= 0.02 && r.contentVisible;
console.log(`  reduced-motion contract ............. ${pass(reducedOk)}`);

const ok = n.loadCls <= 0.02 && n.cls <= 0.02 && n.idle.longTasks < 400 && n.exec.long < 1200 &&
  n.restScoped.length === 0 && n.afterScoped.length === 0 && n.seen.includes("lab-run") && reducedOk;
console.log(`\n=== stage08 performance: ${ok ? "ALL PASS" : "FAIL"} ===`);
process.exit(ok ? 0 : 1);
