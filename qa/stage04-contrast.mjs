import { chromium } from "playwright";
import { PNG } from "pngjs";
const lum = ([r,g,b]) => { const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const TARGETS = [
  [".hero__eyebrow", "eyebrow"],
  [".hero__title", "heading"],
  [".hero__lead", "supporting copy"],
  [".hero__action--primary", "primary button label"],
  [".hero__action--secondary", "secondary button label"],
  [".hero__rail-index", "capability index"],
  [".hero__rail-label", "capability label"],
  [".cnode--agents .cnode__label", "constellation label (Agents)"],
  [".cnode--api .cnode__label", "constellation label (API)"],
  [".ccore__label", "ORCHESTRATOR"],
  [".cnote", "technical annotation"],
];

const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows"] });
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(1600); await frame(p);

  const info = await p.evaluate((sels) => sels.map(([sel, label]) => {
    const el = document.querySelector(sel);
    if (!el) return { label, missing: true };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // Page coordinates, so full-page frames line up with below-fold elements.
    return { label, color: cs.color, fontSize: cs.fontSize, weight: cs.fontWeight,
             rect: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY),
                     w: Math.round(r.width), h: Math.round(r.height) } };
  }), TARGETS);

  // Backdrop only: hide hero text, keep every surface in place.
  await p.addStyleTag({ content: `#hero, #hero * { color: transparent !important; }` });
  await frame(p);
  await p.waitForTimeout(250);
  const check = await p.evaluate(() => getComputedStyle(document.querySelector(".hero__title")).color);
  if (!/rgba\(0, 0, 0, 0\)/.test(check)) console.log("  !! text not hidden:", check);

  const frames = [];
  for (const wait of [250, 7000, 9000]) { await p.waitForTimeout(wait); frames.push(PNG.sync.read(await p.screenshot({ fullPage: true }))); }

  console.log(`\n--- ${w}x${h} ---`);
  const fails = [];
  for (const t of info) {
    if (t.missing) { console.log(`  ${t.label}: MISSING`); continue; }
    let worst = null, wl = 2;
    for (const png of frames) {
      const { width, height, data } = png;
      for (let y = Math.max(0, t.rect.y); y < Math.min(height, t.rect.y + t.rect.h); y += 2)
        for (let x = Math.max(0, t.rect.x); x < Math.min(width, t.rect.x + t.rect.w); x += 2) {
          const i = (width * y + x) << 2;
          const px = [data[i], data[i+1], data[i+2]];
          const l = lum(px);
          if (l < wl) { wl = l; worst = px; }
        }
    }
    if (!worst) continue;
    const c = t.color.match(/\d+/g).slice(0,3).map(Number);
    const rr = ratio(c, worst);
    const size = parseFloat(t.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(t.weight) >= 700);
    const need = large ? 3 : 4.5;
    const ok = rr >= need;
    if (!ok) fails.push(t.label);
    console.log(`  ${t.label.padEnd(30)} ${t.fontSize.padEnd(7)} on rgb(${String(worst).padEnd(11)})  ${rr.toFixed(2)}:1  need ${need}  ${ok ? "PASS" : "FAIL"}`);
  }
  console.log(`  failures: ${fails.length ? fails.join(", ") : "none"}`);
  await ctx.close();
}
await browser.close();
