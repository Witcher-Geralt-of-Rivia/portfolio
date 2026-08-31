import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3300";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const VIEWPORTS = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800]];
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-background-timer-throttling",
] });

console.log("=== RESPONSIVE ===");
for (const [w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
  const errs = [], failed = [], reqs = [];
  p.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0,110)); });
  p.on("pageerror", e => errs.push("pageerror: " + e.message.slice(0,110)));
  p.on("requestfailed", r => failed.push(r.url().split("/").pop()));
  p.on("request", r => reqs.push(r.url()));
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(1600); await frame(p);

  const m = await p.evaluate(() => {
    const de = document.documentElement;
    const lab = document.querySelector(".arch-lab").getBoundingClientRect();
    const section = document.getElementById("systems").getBoundingClientRect();
    const canvasShown = getComputedStyle(document.querySelector(".arch-canvas")).display !== "none";
    const flowShown = getComputedStyle(document.querySelector(".arch-flow")).display !== "none";
    const modes = document.querySelectorAll('[role="tab"]');
    const modeBox = modes[0].getBoundingClientRect();
    // any element wider than the viewport?
    let widest = 0;
    for (const el of document.querySelectorAll("#systems *")) widest = Math.max(widest, el.getBoundingClientRect().width);
    // labels must not be clipped
    const clipped = [...document.querySelectorAll(".arch-node__label")]
      .filter(el => el.getBoundingClientRect().width > 0 && el.scrollWidth > el.clientWidth + 1).length;
    return {
      overflow: de.scrollWidth > de.clientWidth + 1,
      sectionH: Math.round(section.height), labH: Math.round(lab.height), labW: Math.round(lab.width),
      layout: canvasShown ? "topology" : (flowShown ? "vertical flow" : "none"),
      modeH: Math.round(modeBox.height), modeW: Math.round(modeBox.width),
      widest: Math.round(widest), clientWidth: de.clientWidth,
      clippedLabels: clipped,
      cls: +(window.__cls || 0).toFixed(4),
    };
  });
  const external = reqs.filter(u => !u.startsWith(BASE));
  const ok = !m.overflow && m.clippedLabels === 0 && errs.length === 0 && failed.length === 0;
  console.log(`  ${String(w+"x"+h).padEnd(10)} ${pass(ok)}  layout=${m.layout.padEnd(13)} panel=${m.labW}x${m.labH} section=${m.sectionH}px`);
  console.log(`             overflow=${m.overflow ? "FAIL" : "none"} clippedLabels=${m.clippedLabels} modeBtn=${m.modeW}x${m.modeH} CLS=${m.cls} errors=${errs.length ? errs[0] : "none"} failed=${failed.length ? failed[0] : "none"} external=${external.length}`);
  await ctx.close();
}
await browser.close();
