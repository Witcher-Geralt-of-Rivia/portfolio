import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const ids = ["systems", "products", "ai-learning", "lab", "work"];
const expected = ["Systems", "Products", "AI Learning", "Lab", "Work"];

const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);

const seq = [];
for (const id of ids) {
  await page.evaluate((i) => {
    const el = document.getElementById(i);
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + el.offsetHeight * 0.4, behavior: "instant" });
  }, id);
  // A screenshot forces the compositor to produce a frame, which is what
  // flushes IntersectionObserver delivery in headless Chromium.
  await page.screenshot({ type: "jpeg", quality: 20 });
  await page.waitForTimeout(250);
  await page.screenshot({ type: "jpeg", quality: 20 });
  const s = await page.evaluate(() => {
    const cur = [...document.querySelectorAll('.site-nav__link[aria-current="location"]')];
    return { active: cur.map(a => a.textContent.trim()), count: cur.length, y: Math.round(scrollY) };
  });
  seq.push({ id, active: s.active[0] ?? "(none)", count: s.count, y: s.y });
}
console.log("=== ACTIVE SECTION SEQUENCE (1440x900) ===");
seq.forEach((s, i) => console.log(
  `  y=${String(s.y).padStart(4)}  scrolled #${s.id.padEnd(12)} active="${s.active}"  expected="${expected[i]}"  simultaneous=${s.count}  ${s.active === expected[i] && s.count === 1 ? "PASS" : "FAIL"}`
));
const ok = seq.every((s, i) => s.active === expected[i] && s.count === 1);
console.log(`  overall: ${ok ? "PASS" : "FAIL"}`);

// Flicker check: step in small increments across a boundary.
console.log("\n=== BOUNDARY STABILITY (systems -> products) ===");
const states = [];
for (let k = 0; k <= 8; k++) {
  await page.evaluate((f) => {
    const a = document.getElementById("systems");
    const top = a.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: top + a.offsetHeight * (0.5 + f * 0.09), behavior: "instant" });
  }, k);
  await page.screenshot({ type: "jpeg", quality: 20 });
  await page.waitForTimeout(120);
  const a = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.site-nav__link[aria-current="location"]')];
    return c.map(x => x.textContent.trim()).join(",") || "(none)";
  });
  states.push(a);
}
console.log("  " + states.join(" -> "));
let flips = 0;
for (let i = 1; i < states.length; i++) if (states[i] !== states[i-1]) flips++;
console.log(`  transitions across boundary: ${flips} (expect 1, >1 would mean flicker) ${flips <= 1 ? "PASS" : "FAIL"}`);
await browser.close();
