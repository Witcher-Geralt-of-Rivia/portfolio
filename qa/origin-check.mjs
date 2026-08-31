import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const origins = [BASE + "/", "http://localhost:3000/", "http://108.186.112.75:3000/"];
const browser = await chromium.launch();
for (const o of origins) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const bad = [];
  page.on("requestfailed", r => bad.push(r.url().split("/").pop()));
  page.on("response", r => { if (!r.ok() && r.status() !== 304) bad.push(`${r.status()} ${r.url().split("/").pop()}`); });
  try {
    const resp = await page.goto(o, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1200);
    console.log(`${o.padEnd(32)} page=${resp.status()}  problems=${bad.length ? bad.join(", ") : "none"}`);
  } catch (e) { console.log(`${o.padEnd(32)} ERROR ${e.message.slice(0,60)}`); }
  await ctx.close();
}
await browser.close();
