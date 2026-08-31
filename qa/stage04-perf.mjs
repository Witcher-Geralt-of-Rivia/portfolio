import { chromium } from "playwright";
import { PNG } from "pngjs";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-background-timer-throttling",
] });

/* ---- CLS / network / console at every required viewport ---- */
console.log("=== CLS / NETWORK / CONSOLE ===");
for (const [w, h] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  });
  const errs = [], failed = [], reqs = [];
  p.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${m.type()}] ${m.text().slice(0,110)}`); });
  p.on("pageerror", e => errs.push("pageerror: " + e.message.slice(0,110)));
  p.on("requestfailed", r => failed.push(r.url().split("/").pop()));
  p.on("request", r => reqs.push(r.url()));
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(3000); await frame(p);
  const cls = await p.evaluate(() => +window.__cls.toFixed(4));
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const external = reqs.filter(u => !u.startsWith("http://127.0.0.1:3000"));
  console.log(`  ${String(w+"x"+h).padEnd(10)} CLS=${cls}  overflow=${pass(!overflow)}  external=${external.length ? external.join(",") : "0"}  failed=${failed.length ? failed.join(",") : "none"}  console=${errs.length ? errs.join("|") : "clean"}`);
  await ctx.close();
}

/* ---- Idle cost after entrance ---- */
console.log("\n=== IDLE COST (1440x900, 6s after entrance) ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  const client = await p.context().newCDPSession(p);
  await client.send("Performance.enable");
  const grab = async () => Object.fromEntries((await client.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
  const a = await grab();
  await p.waitForTimeout(6000);
  const b = await grab();
  const d = k => +(b[k] - a[k]).toFixed(4);
  console.log(`  scriptTime=+${d("ScriptDuration")}s  layouts=+${d("LayoutCount")}  styleRecalcs=+${d("RecalcStyleCount")}  recalcTime=+${d("RecalcStyleDuration")}s  taskTime=+${d("TaskDuration")}s`);
  console.log(`  nodes=${b.Nodes}  jsHeap=${(b.JSHeapUsedSize/1048576).toFixed(1)}MB  continuous JS: ${d("ScriptDuration") > 0.05 ? "YES" : "NO"}`);
  await ctx.close();
}

/* ---- 30 seconds of motion: no resets, no synchronisation, no strobe ---- */
console.log("\n=== MOTION OVER 30s (1440x900) ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await frame(p); await p.waitForTimeout(1500);
  const samples = [], shots = [];
  for (let i = 0; i < 11; i++) {
    await frame(p);
    const s = await p.evaluate(() =>
      [...document.querySelectorAll(".cnode")].map(n => getComputedStyle(n).transform)
    );
    samples.push(s);
    shots.push(PNG.sync.read(await p.screenshot({ clip: { x: 699, y: 170, width: 613, height: 613 }, timeout: 120000 })));
    await p.waitForTimeout(3000);
  }
  // Any two nodes holding an identical transform across every sample = synced.
  let synced = 0;
  for (let a = 0; a < 8; a++)
    for (let b2 = a + 1; b2 < 8; b2++)
      if (samples.every(s => s[a] === s[b2])) synced++;
  console.log(`  node pairs moving in lockstep: ${synced} ${pass(synced === 0)}`);

  /* A single hot pixel means nothing here: the chips carry dark label text,
     and text drifting three pixels flips individual pixels between glyph
     and background. What actually reveals a jump, a strobe or a loop reset
     is the *area* that changes, so measure the share of pixels that moved
     and watch for an outlier between samples. */
  const deltas = [];
  for (let i = 1; i < shots.length; i++) {
    let sum = 0, n = 0, changed = 0;
    const A = shots[i - 1], B = shots[i];
    for (let k = 0; k < A.data.length; k += 4 * 11) {
      const d = Math.abs(A.data[k] - B.data[k]);
      sum += d; n++; if (d > 12) changed++;
    }
    deltas.push({ mean: +(sum / n).toFixed(2), changedPct: +((changed / n) * 100).toFixed(2) });
  }
  const means = deltas.map(d => d.mean);
  const changed = deltas.map(d => d.changedPct);
  const avg = means.reduce((a, b) => a + b) / means.length;
  const spread = Math.max(...means) - Math.min(...means);
  console.log(`  mean delta per 3s sample : ${means.join(", ")}`);
  console.log(`  area changed per sample  : ${changed.map(c => c + "%").join(", ")}`);
  console.log(`  gentle (mean < 6)                : ${pass(means.every(m => m < 6))}`);
  console.log(`  no jump/reset (spread < 0.6x avg): ${pass(spread < avg * 0.6)}  spread=${spread.toFixed(2)} avg=${avg.toFixed(2)}`);
  console.log(`  no strobe (area changed < 12%)   : ${pass(changed.every(c => c < 12))}`);
  await ctx.close();
}
await browser.close();
