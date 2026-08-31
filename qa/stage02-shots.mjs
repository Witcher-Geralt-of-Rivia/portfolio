import { chromium } from "playwright";
import fs from "node:fs";

const URL = "http://127.0.0.1:3000/";
const VIEWPORTS = [
  [1920, 1080], [1440, 900], [1366, 768], [768, 1024], [390, 844], [360, 800],
];
const PROBES = [
  [".type-display-1", "Display 01"],
  [".type-display-2", "Display 02"],
  ["h1", "H1"], ["h2", "H2"], ["h3", "H3"], ["h4", "H4"],
  [".type-lead", "Lead"], [".type-body-lg", "Body Large"], [".type-body", "Body"],
  [".type-small", "Small"], [".type-caption", "Caption"],
  [".eyebrow", "Eyebrow"], [".type-technical", "Technical label"],
  [".type-technical-micro", "Technical micro"], ["pre code", "Code"],
  [".type-metric", "Metric"],
];

const browser = await chromium.launch();
const results = {};
for (const [w, h] of VIEWPORTS) {
  const key = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // CLS observer installed before any paint.
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });

  const errors = [], failed = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
  page.on("requestfailed", r => failed.push(r.url().split("/").pop()));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);

  const metrics = await page.evaluate((probes) => {
    const out = {};
    for (const [sel, label] of probes) {
      const el = document.querySelector(sel);
      if (!el) { out[label] = "MISSING"; continue; }
      const cs = getComputedStyle(el);
      out[label] = `${cs.fontSize} / w${cs.fontWeight} / lh ${cs.lineHeight} / ls ${cs.letterSpacing}`;
    }
    const de = document.documentElement;
    out.__overflow = de.scrollWidth > de.clientWidth + 1;
    out.__scrollWidth = de.scrollWidth;
    out.__clientWidth = de.clientWidth;
    out.__cls = +(window.__cls || 0).toFixed(4);
    // Any element wider than the viewport?
    let widest = null, widestW = 0;
    for (const el of document.querySelectorAll("main *")) {
      const r = el.getBoundingClientRect();
      if (r.width > widestW) { widestW = r.width; widest = el.className || el.tagName; }
    }
    out.__widest = `${String(widest).slice(0, 40)} @ ${Math.round(widestW)}px`;
    return out;
  }, PROBES);

  metrics.__errors = errors.length ? errors : "none";
  metrics.__failed = failed.length ? failed : "none";
  results[key] = metrics;

  fs.writeFileSync(`qa/shots/stage02/${key}.png`, await page.screenshot({ fullPage: false }));
  fs.writeFileSync(`qa/shots/stage02/${key}-full.png`, await page.screenshot({ fullPage: true }));
  await ctx.close();
}
await browser.close();

for (const [vp, m] of Object.entries(results)) {
  console.log(`\n================ ${vp} ================`);
  console.log(`  overflow=${m.__overflow ? "FAIL" : "none"} (scroll ${m.__scrollWidth} vs client ${m.__clientWidth})  CLS=${m.__cls}`);
  console.log(`  widest element: ${m.__widest}`);
  console.log(`  console errors: ${m.__errors}   failed requests: ${m.__failed}`);
  for (const [k, v] of Object.entries(m)) if (!k.startsWith("__")) console.log(`    ${k.padEnd(17)} ${v}`);
}
fs.writeFileSync("qa/stage02-report.json", JSON.stringify(results, null, 2));
