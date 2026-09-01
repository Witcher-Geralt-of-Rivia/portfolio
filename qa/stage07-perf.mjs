import { chromium } from "playwright";

/* Layout stability, animation cost, idle activity and the reduced-motion
   contract for Stage 07.

   Only INFINITE keyframe animations count as "animating at rest": a snapshot
   taken just after an interaction is full of short colour transitions at
   currentTime 0, which are the interaction settling, not a standing cost. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const infinite = (scoped) => `document.getAnimations().filter((a) => {
  if (a.playState !== "running" || !a.animationName) return false;
  if (a.effect.getTiming().iterations !== Infinity) return false;
  const t = a.effect.target;
  return ${scoped ? '!!(t && t.closest && t.closest("#ai-learning"))' : "true"};
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
          if (e.value > 0.0001) window.__shifts.push({ v: +e.value.toFixed(5), src: (e.sources || []).map((s) => (s.node && s.node.className ? String(s.node.className).slice(0, 40) : "?")) });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(1400); await frame(p);
  await p.evaluate(() => document.querySelector("#ai-learning").scrollIntoView({ block: "start" }));
  await p.waitForTimeout(700);

  const loadCls = await p.evaluate(() => window.__cls);
  const restScoped = await p.evaluate(infinite(true));
  const restPage = await p.evaluate(infinite(false));

  /* Idle cost over ~6s with the section on screen and untouched. */
  const idle = await p.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now();
    let longTasks = 0;
    const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks += e.duration; });
    try { po.observe({ type: "longtask", buffered: false }); } catch { /* not supported */ }
    setTimeout(() => {
      po.disconnect();
      resolve({ ms: Math.round(performance.now() - t0), longTasks: Math.round(longTasks) });
    }, 6000);
  }));

  /* Sample every keyframe animation seen during one adapt run. */
  await p.click("#lscenario-tab-tutor");
  await p.waitForTimeout(350);
  const seen = await p.evaluate(`new Promise((resolve) => {
    const names = new Set();
    const tick = () => {
      for (const a of document.getAnimations()) {
        if (a.playState === "running" && a.animationName && a.effect.target && a.effect.target.closest && a.effect.target.closest("#ai-learning")) names.add(a.animationName);
      }
    };
    document.querySelector(".llab__run").click();
    const iv = setInterval(tick, 40); tick();
    const stop = setInterval(() => {
      if (document.querySelector(".llab__run-label").textContent === "Adapt again") { clearInterval(iv); clearInterval(stop); resolve([...names]); }
    }, 40);
    setTimeout(() => { clearInterval(iv); clearInterval(stop); resolve([...names]); }, 9000);
  })`);

  for (const id of ["assessment", "path"]) {
    await p.click(`#lscenario-tab-${id}`);
    await p.waitForTimeout(300);
    await p.click(".llab__run");
    await p.waitForFunction(() => /Adapt again|Adapt path|Adapt next step/.test(document.querySelector(".llab__run-label").textContent), null, { timeout: 9000, polling: 100 });
    await p.waitForTimeout(400);
  }

  const r = await p.evaluate(() => ({
    cls: window.__cls, shifts: window.__shifts,
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    tutorAnim: getComputedStyle(document.querySelector(".ltutor__body")).animationName,
    signalAnim: (() => { const s = document.querySelector(".lmap__signal"); return s ? getComputedStyle(s).animationName : "none"; })(),
    nodes: document.querySelectorAll("#ai-learning *").length,
    contentVisible: !!document.querySelector(".lmap") && !!document.querySelector(".ltutor__brief") && document.querySelectorAll(".lnode").length > 0,
  }));
  const afterScoped = await p.evaluate(infinite(true));
  await browser.close();
  return { loadCls, restScoped, restPage, idle, seen, afterScoped, ...r };
}

const n = await measure(false);
console.log(`=== STAGE 07 STABILITY / COST  (${BASE}, no-preference) ===`);
console.log(`  CLS at load ......................... ${n.loadCls.toFixed(5)} ${pass(n.loadCls <= 0.02)}`);
console.log(`  CLS after 3 scenarios + 3 adapts .... ${n.cls.toFixed(5)} ${pass(n.cls <= 0.02)}`);
console.log(`  layout shift sources ................ ${n.shifts.length ? JSON.stringify(n.shifts) : "none"}`);
console.log(`  DOM nodes in #ai-learning ........... ${n.nodes}`);
console.log(`  idle 6s: long-task time ............. ${n.idle.longTasks}ms over ${n.idle.ms}ms ${pass(n.idle.longTasks < 400)}`);
console.log(`  infinite animations at rest ......... Stage 07: ${n.restScoped.length} (${n.restScoped.join(",") || "none"}) | page-wide ${n.restPage.length}`);
console.log(`  infinite animations after 3 adapts .. ${n.afterScoped.length}`);
console.log(`  keyframe animations during a run .... ${JSON.stringify(n.seen)}`);

const r = await measure(true);
console.log(`\n=== STAGE 07 REDUCED MOTION ===`);
console.log(`  media query honoured ................ ${r.reduced} ${pass(r.reduced)}`);
console.log(`  tutor content animation ............. ${r.tutorAnim} ${pass(r.tutorAnim === "none")}`);
console.log(`  knowledge signal animation .......... ${r.signalAnim} ${pass(r.signalAnim === "none")}`);
console.log(`  keyframe animations during a run .... ${JSON.stringify(r.seen)} ${pass(r.seen.length === 0)}`);
console.log(`  infinite animations at rest ......... Stage 07: ${r.restScoped.length} ${pass(r.restScoped.length === 0)} | page-wide ${r.restPage.length} ${pass(r.restPage.length === 0)}`);
console.log(`  CLS ................................. ${r.cls.toFixed(5)} ${pass(r.cls <= 0.02)}`);
console.log(`  all content still visible ........... ${r.contentVisible} ${pass(r.contentVisible)}`);

const reducedOk = r.reduced && r.tutorAnim === "none" && r.signalAnim === "none" && r.seen.length === 0 &&
  r.restScoped.length === 0 && r.restPage.length === 0 && r.cls <= 0.02 && r.contentVisible;
console.log(`  reduced-motion contract ............. ${pass(reducedOk)}`);

/* The only standing animation Stage 07 owns is the route signal, and the
   design caps it at two. The exact count varies by scenario, because a
   highlighted route only carries a signal where a real edge exists. */
const onlySignals = (list) => list.length <= 2 && list.every((a) => a === "lsignal-travel");
console.log(`
  standing animations are signals only, capped at 2: at rest ${pass(onlySignals(n.restScoped))} (${n.restScoped.length}), after runs ${pass(onlySignals(n.afterScoped))} (${n.afterScoped.length})`);

const ok = n.loadCls <= 0.02 && n.cls <= 0.02 && n.idle.longTasks < 400 &&
  onlySignals(n.restScoped) && onlySignals(n.afterScoped) && reducedOk;
console.log(`\n=== stage07 performance: ${ok ? "ALL PASS" : "FAIL"} ===`);
process.exit(ok ? 0 : 1);
