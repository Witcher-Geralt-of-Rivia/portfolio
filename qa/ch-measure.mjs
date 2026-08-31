import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const r = await page.evaluate(() => {
  const mk = (fam) => {
    const s = document.createElement("span");
    s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-size:100px;font-family:${fam}`;
    s.textContent = "0"; document.body.appendChild(s);
    const w = s.getBoundingClientRect().width; s.remove(); return w;
  };
  // ch as the browser itself resolves it, in each font
  const probe = (fam) => {
    const d = document.createElement("div");
    d.style.cssText = `position:absolute;visibility:hidden;font-size:100px;font-family:${fam};width:13ch`;
    document.body.appendChild(d);
    const w = d.getBoundingClientRect().width; d.remove(); return w;
  };
  return {
    geistZero: mk("var(--font-sans)"),
    fallbackZero: mk("Arial"),
    geist13ch: probe("var(--font-sans)"),
    arial13ch: probe("Arial"),
  };
});
console.log("At font-size 100px:");
console.log("  Geist  '0' advance :", r.geistZero.toFixed(2), "px  => 1ch =", (r.geistZero / 100).toFixed(4), "em");
console.log("  Arial  '0' advance :", r.fallbackZero.toFixed(2), "px  => 1ch =", (r.fallbackZero / 100).toFixed(4), "em");
console.log("  13ch in Geist      :", r.geist13ch.toFixed(2), "px  =", (r.geist13ch / 100).toFixed(3), "em");
console.log("  13ch in Arial      :", r.arial13ch.toFixed(2), "px  =", (r.arial13ch / 100).toFixed(3), "em");
console.log("\n  => display-1 13ch equivalent:", (r.geistZero * 13 / 100).toFixed(3) + "em");
console.log("  => display-2 16ch equivalent:", (r.geistZero * 16 / 100).toFixed(3) + "em");
await browser.close();
