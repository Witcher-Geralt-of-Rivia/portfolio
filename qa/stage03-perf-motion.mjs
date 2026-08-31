import { chromium } from "playwright";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
] });

/* ---------- REDUCED MOTION ---------- */
console.log("=== REDUCED MOTION (390x844) ===");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  const base = await p.evaluate(() => ({
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    auroraAnims: document.getAnimations().filter(a => a.playState === "running").length,
  }));
  console.log(`  html scroll-behavior: ${base.scrollBehavior} ${pass(base.scrollBehavior === "auto")}`);
  console.log(`  Stage 01 running animations: ${base.auroraAnims} ${pass(base.auroraAnims === 0)}`);

  await p.click(".site-nav__toggle");
  await frame(p); await p.waitForTimeout(300); await frame(p);
  const open = await p.evaluate(() => {
    const panel = document.querySelector(".site-nav__panel");
    const cs = getComputedStyle(panel);
    const item = getComputedStyle(document.querySelector(".site-nav__panel-item"));
    return {
      transform: cs.transform, visibility: cs.visibility, opacity: cs.opacity,
      itemDelay: item.transitionDelay, itemTransform: item.transform,
      expanded: document.querySelector(".site-nav__toggle").getAttribute("aria-expanded"),
    };
  });
  console.log(`  panel transform: ${open.transform} ${pass(open.transform === "none")}  (no slide/scale)`);
  console.log(`  item stagger delay: ${open.itemDelay} ${pass(parseFloat(open.itemDelay) === 0)}   item transform: ${open.itemTransform}`);
  console.log(`  menu still usable: opened=${open.expanded} visible=${open.visibility} opacity=${open.opacity} ${pass(open.expanded === "true" && open.visibility === "visible")}`);
  await p.keyboard.press("Escape");
  await frame(p); await p.waitForTimeout(250);
  const closed = await p.evaluate(() => document.querySelector(".site-nav__toggle").getAttribute("aria-expanded"));
  console.log(`  Escape still closes: ${pass(closed === "false")}`);
  await ctx.close();
}

/* ---------- CLS + IDLE + NETWORK ---------- */
console.log("\n=== CLS / NETWORK / IDLE (per viewport) ===");
for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [768, 1024], [390, 844], [360, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  });
  const errors = [], failed = [], reqs = [];
  p.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
  p.on("pageerror", e => errors.push("pageerror: " + e.message.slice(0, 120)));
  p.on("requestfailed", r => failed.push(r.url().split("/").pop()));
  p.on("request", r => reqs.push(r.url()));
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(2500);
  const clsA = await p.evaluate(() => +window.__cls.toFixed(4));

  // opening the menu must not reflow document content
  let clsB = clsA;
  if (w < 900) {
    await p.click(".site-nav__toggle");
    await frame(p); await p.waitForTimeout(500); await frame(p);
    clsB = await p.evaluate(() => +window.__cls.toFixed(4));
    await p.keyboard.press("Escape");
    await frame(p); await p.waitForTimeout(300);
  }
  const external = reqs.filter(u => !u.startsWith("http://127.0.0.1:3000"));
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(`  ${String(w + "x" + h).padEnd(10)} CLS=${clsA}${w < 900 ? ` (after menu open: ${clsB})` : ""}  overflow=${pass(!overflow)}  errors=${errors.length ? errors.join("|") : "none"}  failed=${failed.length ? failed.join(",") : "none"}  thirdParty=${external.length ? external.join(",") : "none"}`);
  await ctx.close();
}

/* ---------- IDLE JS ---------- */
console.log("\n=== IDLE JS ACTIVITY (1440x900, 6s idle) ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const client = await p.context().newCDPSession(p);
  await client.send("Performance.enable");
  const grab = async () => Object.fromEntries((await client.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
  const a = await grab();
  await p.waitForTimeout(6000);
  const b = await grab();
  const d = k => +(b[k] - a[k]).toFixed(4);
  console.log(`  over 6s idle: scriptTime=+${d("ScriptDuration")}s  layouts=+${d("LayoutCount")}  styleRecalcs=+${d("RecalcStyleCount")}  tasks=+${d("TaskDuration")}s`);
  console.log(`  navigation generates continuous work: ${d("ScriptDuration") > 0.05 ? "YES (investigate)" : "NO"}`);
  await ctx.close();
}
await browser.close();
