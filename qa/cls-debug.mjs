import { chromium } from "playwright";
const browser = await chromium.launch();
for (const [w, h] of [[1920, 1080], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__shifts.push({
          value: +e.value.toFixed(5),
          time: Math.round(e.startTime),
          sources: (e.sources || []).map(s => ({
            node: s.node ? (s.node.nodeName + "." + (s.node.className || "").toString().slice(0, 45)) : "?",
            from: `${Math.round(s.previousRect.x)},${Math.round(s.previousRect.y)} ${Math.round(s.previousRect.width)}x${Math.round(s.previousRect.height)}`,
            to: `${Math.round(s.currentRect.x)},${Math.round(s.currentRect.y)} ${Math.round(s.currentRect.width)}x${Math.round(s.currentRect.height)}`,
          })),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3500);
  const shifts = await page.evaluate(() => window.__shifts);
  console.log(`\n===== ${w}x${h} : ${shifts.length} shift entries =====`);
  for (const s of shifts) {
    console.log(`  value=${s.value} at ${s.time}ms`);
    for (const src of s.sources) console.log(`      ${src.node}\n        ${src.from}  ->  ${src.to}`);
  }
  await ctx.close();
}
await browser.close();
