import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const browser = await chromium.launch();
for (const [dsf, zoom, tag] of [[2, 1, "dsf2-100pct"], [2, 1.25, "dsf2-125pct"]]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  if (zoom !== 1) await page.evaluate((z) => { document.documentElement.style.zoom = String(z); }, zoom);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  // Tight crop around the identity cluster and the first two links.
  await page.screenshot({
    path: `qa/shots/stage03/mark-${tag}.png`,
    clip: { x: 180, y: 14, width: 400, height: 76 },
  });
  // and the active link with its aurora dash
  await page.screenshot({
    path: `qa/shots/stage03/active-${tag}.png`,
    clip: { x: 840, y: 22, width: 260, height: 58 },
  });
  console.log("captured", tag);
  await ctx.close();
}
await browser.close();
