import { chromium } from "playwright";
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

const URL = "http://localhost:3000/specimen";
const OUT = "qa/shots";

const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
];

function decode(buf) {
  return PNG.sync.read(buf);
}

// Perceptual stats over a downsampled grid.
function analyse(png) {
  const { width, height, data } = png;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 260));
  let n = 0;
  let neutral = 0;
  let nearWhite = 0;
  let satSum = 0;
  let maxSat = 0;
  let minL = 1;
  let maxL = 0;
  const hueBuckets = new Array(12).fill(0);

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (width * y + x) << 2;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
      }
      n++;
      satSum += s;
      if (s > maxSat) maxSat = s;
      if (l < minL) minL = l;
      if (l > maxL) maxL = l;
      if (d * 255 < 3) neutral++;
      if (r > 0.985 && g > 0.985 && b > 0.985) nearWhite++;
      if (d * 255 >= 4) hueBuckets[Math.floor(h / 30)]++;
    }
  }
  const huesPresent = hueBuckets.filter((c) => c / n > 0.01).length;
  return {
    samples: n,
    avgSaturation: +(satSum / n).toFixed(4),
    maxSaturation: +maxSat.toFixed(4),
    neutralPct: +((neutral / n) * 100).toFixed(2),
    nearWhitePct: +((nearWhite / n) * 100).toFixed(2),
    lightnessRange: [+minL.toFixed(3), +maxL.toFixed(3)],
    hueFamilies: huesPresent,
    hueHistogram: hueBuckets.map((c) => +((c / n) * 100).toFixed(1)),
  };
}

function meanAbsDiff(a, b) {
  const len = Math.min(a.data.length, b.data.length);
  let sum = 0;
  let count = 0;
  let max = 0;
  for (let i = 0; i < len; i += 4 * 37) {
    const d =
      (Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2])) /
      3;
    sum += d;
    if (d > max) max = d;
    count++;
  }
  return { mean: +(sum / count).toFixed(3), max: +max.toFixed(1) };
}

const report = { viewports: {}, motion: {}, computed: {}, overflow: {} };

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const buf = await page.screenshot();
  fs.writeFileSync(path.join(OUT, `${vp.name}.png`), buf);
  report.viewports[vp.name] = analyse(decode(buf));

  report.overflow[vp.name] = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    horizontalOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  }));

  await ctx.close();
}

// ---- motion sampling at 1440x900 -----------------------------------------
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });

  await page.waitForTimeout(2000);
  const f1 = decode(await page.screenshot());
  await page.waitForTimeout(500);
  const f2 = decode(await page.screenshot());
  await page.waitForTimeout(9500);
  const f3buf = await page.screenshot();
  fs.writeFileSync(path.join(OUT, "1440x900-t12s.png"), f3buf);
  const f3 = decode(f3buf);
  await page.waitForTimeout(18000);
  const f4buf = await page.screenshot();
  fs.writeFileSync(path.join(OUT, "1440x900-t30s.png"), f4buf);
  const f4 = decode(f4buf);

  report.motion["0.5s apart"] = meanAbsDiff(f1, f2);
  report.motion["10s apart"] = meanAbsDiff(f1, f3);
  report.motion["28s apart"] = meanAbsDiff(f1, f4);

  report.computed = await page.evaluate(() => {
    const pick = (sel, props) => {
      const el = document.querySelector(sel);
      if (!el) return `MISSING ${sel}`;
      const cs = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
    };
    return {
      body: pick("body", ["background-color", "color", "font-family"]),
      html: pick("html", ["background-color"]),
      base: pick(".backdrop-base", ["z-index", "position", "background-image"]),
      field1: pick(".aurora__field--1", [
        "z-index",
        "filter",
        "opacity",
        "border-radius",
        "animation-duration",
        "animation-direction",
        "animation-timing-function",
        "animation-iteration-count",
        "width",
        "height",
        "left",
        "top",
      ]),
      field6: pick(".aurora__field--6", [
        "filter",
        "opacity",
        "animation-duration",
        "background-image",
      ]),
      aurora: pick(".aurora", ["z-index", "position", "overflow"]),
      prism: pick(".prism", ["z-index", "position"]),
      beamA: pick(".prism__beam--a", ["opacity", "animation-duration"]),
      beamB: pick(".prism__beam--b", [
        "opacity",
        "animation-duration",
        "mix-blend-mode",
      ]),
      grain: pick(".grain", [
        "z-index",
        "opacity",
        "mix-blend-mode",
        "background-image",
        "background-size",
      ]),
      milk: pick(".surface-milk", [
        "background-color",
        "backdrop-filter",
        "border-radius",
        "box-shadow",
      ]),
      frost: pick(".surface-frost", [
        "background-color",
        "backdrop-filter",
        "border-radius",
      ]),
      prismSurface: pick(".surface-prism", [
        "background-color",
        "backdrop-filter",
        "border-radius",
      ]),
      animationsRunning: document.getAnimations().length,
    };
  });

  await ctx.close();
}

// ---- reduced motion -------------------------------------------------------
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const r1buf = await page.screenshot();
  fs.writeFileSync(path.join(OUT, "1440x900-reduced-motion.png"), r1buf);
  const r1 = decode(r1buf);
  await page.waitForTimeout(4000);
  const r2 = decode(await page.screenshot());

  report.reducedMotion = {
    stats: analyse(r1),
    driftOver4s: meanAbsDiff(r1, r2),
    runningAnimations: await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === "running").length
    ),
  };
  await ctx.close();
}

await browser.close();
fs.writeFileSync("qa/report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
