import { chromium } from "playwright";
import { PNG } from "pngjs";

const URL = "http://127.0.0.1:3000/specimen";
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Roles to audit: selector -> human label. Each is real, meaningful text.
const ROLES = [
  [".type-display-1", "display-1 (large)", true],
  ["h1", "h1 (large)", true],
  [".type-lead", "lead (large)", true],
  [".type-body-lg", "body-lg", false],
  [".type-body", "body", false],
  [".type-small", "small", false],
  [".type-caption", "caption", false],
  [".eyebrow", "eyebrow (mono 12px)", false],
  [".type-technical", "technical label (mono 13px)", false],
  [".specimen__metric .type-technical-micro", "technical micro (mono 12px)", false],
  [".surface-milk .type-technical-micro", "technical micro on MILK", false],
  ["pre code", "code (mono)", false],
  [".surface-milk .type-body", "body on MILK", false],
  [".surface-milk .type-caption", "caption on MILK", false],
  [".surface-frost .type-body", "body on FROST", false],
  [".surface-frost .type-caption", "caption on FROST", false],
  [".surface-prism .type-body", "body on PRISM", false],
  [".surface-prism .type-caption", "caption on PRISM", false],
  [".specimen__role", "specimen role label", false],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);

// Rect + colour for every role, in full-page coordinates.
const targets = await page.evaluate((roles) => {
  return roles.map(([sel, label, isLarge]) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, label, isLarge, missing: true };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      sel, label, isLarge,
      color: cs.color,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      rect: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
    };
  });
}, ROLES);

// Backdrop-only frames: text transparent, layout untouched, sampled at
// several points in the aurora cycle so the worst position is caught.
await page.addStyleTag({ content: `*, *::before, *::after { color: transparent !important; }` });
const frames = [];
for (const wait of [1500, 9000, 11000]) {
  await page.waitForTimeout(wait);
  frames.push(PNG.sync.read(await page.screenshot({ fullPage: true })));
}

function worstBackdrop(rect) {
  let worst = null, worstL = 2;
  for (const png of frames) {
    const { width, height, data } = png;
    for (let y = Math.max(0, rect.y); y < Math.min(height, rect.y + rect.h); y += 2)
      for (let x = Math.max(0, rect.x); x < Math.min(width, rect.x + rect.w); x += 2) {
        const i = (width * y + x) << 2;
        const p = [data[i], data[i + 1], data[i + 2]];
        const l = lum(p);
        if (l < worstL) { worstL = l; worst = p; }
      }
  }
  return worst;
}

console.log("=== CONTRAST OVER WORST-CASE LIVE BACKDROP (3 aurora positions) ===");
console.log("role                                    colour            size   worst bg        ratio   need   verdict");
const failures = [];
for (const t of targets) {
  if (t.missing) { console.log(`  ${t.label.padEnd(38)} MISSING SELECTOR ${t.sel}`); continue; }
  const bg = worstBackdrop(t.rect);
  if (!bg) { console.log(`  ${t.label.padEnd(38)} no pixels`); continue; }
  const c = t.color.match(/\d+/g).slice(0, 3).map(Number);
  const r = ratio(c, bg);
  const need = t.isLarge ? 3.0 : 4.5;
  const ok = r >= need;
  if (!ok) failures.push(`${t.label} ${r.toFixed(2)}:1`);
  console.log(
    `  ${t.label.padEnd(38)} ${t.color.padEnd(17)} ${t.fontSize.padEnd(6)} rgb(${String(bg).padEnd(11)}) ${r.toFixed(2).padStart(5)}  ${String(need).padStart(4)}   ${ok ? "PASS" : "FAIL"}`
  );
}
console.log("\nFailures:", failures.length ? failures : "none");
await browser.close();
