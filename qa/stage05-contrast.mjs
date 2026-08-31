import { chromium } from "playwright";
import { PNG } from "pngjs";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3300";
const lum = ([r,g,b]) => { const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const TARGETS = [
  [".systems .eyebrow", "section eyebrow"],
  ["#systems-title", "section heading"],
  [".systems__lead", "section supporting copy"],
  [".systems__capabilities", "capability line"],
  [".arch-lab__title", "lab title"],
  [".arch-lab__subtitle", "lab subtitle"],
  ['[role="tab"][aria-selected="true"]', "mode label (active)"],
  ['[role="tab"]:not([aria-selected="true"])', "mode label (inactive)"],
  [".arch-canvas .arch-node__label", "node label"],
  [".arch-canvas .arch-node__technical", "node technical label"],
  [".arch-trace__title", "trace title"],
  [".arch-trace__badge", "trace badge"],
  [".arch-trace__time", "trace time"],
  [".arch-trace__text", "trace row"],
  [".arch-lab__detail-hint", "detail strip"],
  [".systems__principle-index", "principle index"],
  [".systems__principle-title", "principle title"],
  [".systems__micro", "micro label"],
];

const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await frame(p); await p.waitForTimeout(1500);

const info = await p.evaluate((sels) => sels.map(([sel, label]) => {
  const el = document.querySelector(sel);
  if (!el) return { label, missing: true };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { label, color: cs.color, fontSize: cs.fontSize, weight: cs.fontWeight,
           rect: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) } };
}), TARGETS);

// Hide the section's text, keeping every surface, then sample the backdrop.
await p.addStyleTag({ content: "#systems, #systems * { color: transparent !important; }" });
await frame(p);
await p.waitForTimeout(250);
const hidden = await p.evaluate(() => getComputedStyle(document.querySelector("#systems-title")).color);
if (!/rgba\(0, 0, 0, 0\)/.test(hidden)) console.log("  !! text not hidden:", hidden);

const frames = [];
for (const wait of [250, 6500, 8000]) { await p.waitForTimeout(wait); frames.push(PNG.sync.read(await p.screenshot({ fullPage: true }))); }

console.log("=== STAGE 05 CONTRAST (worst-case over live surfaces) ===");
const fails = [];
for (const t of info) {
  if (t.missing) { console.log(`  ${t.label}: MISSING`); continue; }
  let worst = null, wl = 2;
  for (const png of frames) {
    const { width, height, data } = png;
    for (let y = Math.max(0,t.rect.y); y < Math.min(height, t.rect.y + t.rect.h); y += 2)
      for (let x = Math.max(0,t.rect.x); x < Math.min(width, t.rect.x + t.rect.w); x += 2) {
        const i = (width*y+x)<<2; const px=[data[i],data[i+1],data[i+2]]; const l=lum(px);
        if (l < wl) { wl = l; worst = px; }
      }
  }
  if (!worst) continue;
  const c = t.color.match(/\d+/g).slice(0,3).map(Number);
  const rr = ratio(c, worst);
  const size = parseFloat(t.fontSize);
  const need = (size >= 24 || (size >= 18.66 && parseInt(t.weight) >= 700)) ? 3 : 4.5;
  const ok = rr >= need;
  if (!ok) fails.push(`${t.label} ${rr.toFixed(2)}`);
  console.log(`  ${t.label.padEnd(28)} ${t.fontSize.padEnd(7)} on rgb(${String(worst).padEnd(11)})  ${rr.toFixed(2)}:1  need ${need}  ${ok ? "PASS" : "FAIL"}`);
}
console.log(`  failures: ${fails.length ? fails.join(", ") : "none"}`);
await browser.close();
