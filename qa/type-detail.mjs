import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

console.log("=== MEASURE CAPPING AT 1920 (rendered px + approx chars/line) ===");
const measures = await page.evaluate(() => {
  const rows = [];
  for (const sel of [".type-display-1", ".type-display-2", ".type-lead", ".type-body-lg", ".type-body", "pre"]) {
    const el = document.querySelector(sel); if (!el) continue;
    const cs = getComputedStyle(el);
    const w = el.getBoundingClientRect().width;
    // width of "0" at this element's font settings => chars per line
    const s = document.createElement("span");
    s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`;
    s.textContent = "0"; document.body.appendChild(s);
    const ch = s.getBoundingClientRect().width; s.remove();
    rows.push({ sel, width: Math.round(w), maxWidth: cs.maxWidth, charsPerLine: Math.round(w / ch) });
  }
  return rows;
});
for (const m of measures) console.log(`  ${m.sel.padEnd(18)} rendered=${String(m.width).padStart(4)}px  max-width=${m.maxWidth.padEnd(10)} ~${m.charsPerLine} ch/line`);

console.log("\n=== VARIABLE WEIGHT AXIS IS REAL (not synthetic) ===");
const weights = await page.evaluate(() => {
  const mk = (weight) => {
    const s = document.createElement("span");
    s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-family:var(--font-sans);font-size:80px;font-weight:${weight};font-synthesis:none`;
    s.textContent = "Engineering intelligent"; document.body.appendChild(s);
    const w = s.getBoundingClientRect().width; s.remove(); return +w.toFixed(2);
  };
  return [400, 450, 500, 520, 560, 620, 700].map(w => ({ weight: w, width: mk(w) }));
});
let prev = null;
for (const w of weights) {
  const delta = prev === null ? "-" : (w.width - prev).toFixed(2);
  console.log(`  weight ${String(w.weight).padEnd(4)} width=${String(w.width).padStart(8)}px  delta=${delta}`);
  prev = w.width;
}
const distinct = new Set(weights.map(w => w.width)).size;
console.log(`  distinct widths across 7 weights: ${distinct}/7  => ${distinct >= 6 ? "true variable axis" : "SUSPECT: possible synthesis"}`);

console.log("\n=== FONT-SYNTHESIS / RENDERING SANITY ===");
const sanity = await page.evaluate(() => {
  const h1 = document.querySelector("h1"), code = document.querySelector("pre code");
  return {
    h1Weight: getComputedStyle(h1).fontWeight,
    h1Synthesis: getComputedStyle(h1).fontSynthesis || "(unset)",
    codeLigatures: getComputedStyle(code).fontVariantLigatures,
    codeFamily: getComputedStyle(code).fontFamily.split(",")[0],
    metricNumeric: getComputedStyle(document.querySelector(".type-metric")).fontVariantNumeric,
    bodySmoothing: getComputedStyle(document.body).webkitFontSmoothing,
    textRendering: getComputedStyle(document.body).textRendering,
  };
});
for (const [k, v] of Object.entries(sanity)) console.log(`  ${k.padEnd(16)} ${v}`);
await browser.close();
