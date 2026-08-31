import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const EXPS = {
  "A baseline": "",
  "B display measure off": ".type-display-1,.type-display-2{max-width:none}",
  "C all ch-measures off": ".type-display-1,.type-display-2,.type-lead,.type-body-lg,.type-body{max-width:none}",
  "D display measure in rem": ".type-display-1{max-width:13.5rem}.type-display-2{max-width:18rem}",
};
const browser = await chromium.launch();
for (const [name, css] of Object.entries(EXPS)) {
  const out = [];
  for (const [w, h] of [[1920,1080],[1440,900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.addInitScript((c) => {
      window.__cls = 0;
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
        .observe({ type: "layout-shift", buffered: true });
      if (c) document.addEventListener("DOMContentLoaded", () => {}, { once: true });
      if (c) {
        const s = document.createElement("style"); s.textContent = c;
        (document.head || document.documentElement).appendChild(s);
      }
    }, css);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(3000);
    out.push(`${w}x${h}=${(await page.evaluate(() => +window.__cls.toFixed(4)))}`);
    await ctx.close();
  }
  console.log(`  ${name.padEnd(24)} CLS  ${out.join("  ")}`);
}
await browser.close();
