import { chromium } from "playwright";
import fs from "node:fs";
const [w, h, name, wait] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(+(wait || 2500));
fs.writeFileSync(`qa/shots/${name}.png`, await page.screenshot());
await browser.close();
console.log("shot", name);
