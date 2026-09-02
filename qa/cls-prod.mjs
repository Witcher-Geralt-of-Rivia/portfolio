import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const browser = await chromium.launch();
const rows = [];
for (const [w, h] of [[1920,1080],[1440,900],[1366,768],[768,1024],[390,844],[360,800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__cls = 0; window.__n = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__n++; } })
      .observe({ type: "layout-shift", buffered: true });
  });
  const errs = [], failed = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0,120)); });
  page.on("requestfailed", r => failed.push(r.url().split("/").pop()));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => ({ cls: +window.__cls.toFixed(4), n: window.__n,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
  rows.push(`  ${String(w+'x'+h).padEnd(10)} CLS=${String(r.cls).padEnd(7)} shifts=${String(r.n).padEnd(3)} overflow=${r.overflow?'FAIL':'none'}  errors=${errs.length?errs.join('|'):'none'}  failedReq=${failed.length?failed.join(','):'none'}`);
  await ctx.close();
}
await browser.close();
console.log("=== PRODUCTION BUILD - CLS / OVERFLOW / CONSOLE ===");
rows.forEach(r => console.log(r));
