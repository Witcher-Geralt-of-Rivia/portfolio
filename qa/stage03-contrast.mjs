import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
import { PNG } from "pngjs";
const lum = ([r,g,b]) => { const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows"] });

async function audit(w, h, openMenu, targets) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  if (openMenu) { await p.click(".site-nav__toggle"); await frame(p); await p.waitForTimeout(450); await frame(p); }

  const info = await p.evaluate((sels) => sels.map(([sel,label]) => {
    const el = document.querySelector(sel);
    if (!el) return { label, missing: true };
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return { label, color: cs.color, fontSize: cs.fontSize,
             rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  }), targets);

  // Backdrop only: hide nav text, keep the Frost surfaces and aurora.
  await p.addStyleTag({ content: `.site-nav *, .site-nav { color: transparent !important; }
    .site-nav__link::after, .site-nav__panel-dash { opacity: 0 !important; }` });
  // Headless defers style recalc until a frame is produced, so force one
  // and assert the text really is hidden before sampling the backdrop.
  await frame(p);
  await p.waitForTimeout(200);
  const hidden = await p.evaluate(() => {
    const a = document.querySelector(".site-nav__link") || document.querySelector(".site-nav__panel-label");
    return getComputedStyle(a).color;
  });
  if (!/rgba\(0, 0, 0, 0\)|transparent/.test(hidden)) {
    console.log(`  !! text not hidden (computed ${hidden}) - backdrop sample would be invalid`);
  }
  const frames = [];
  for (const wait of [300, 7000, 9000]) { await p.waitForTimeout(wait); frames.push(PNG.sync.read(await p.screenshot())); }

  console.log(`\n--- ${w}x${h}${openMenu ? " (menu open)" : ""} ---`);
  for (const t of info) {
    if (t.missing) { console.log(`  ${t.label}: MISSING`); continue; }
    let worst = null, wl = 2;
    for (const png of frames) {
      const { width, height, data } = png;
      for (let y = Math.max(0,t.rect.y); y < Math.min(height, t.rect.y+t.rect.h); y += 2)
        for (let x = Math.max(0,t.rect.x); x < Math.min(width, t.rect.x+t.rect.w); x += 2) {
          const i = (width*y+x)<<2; const px=[data[i],data[i+1],data[i+2]]; const l=lum(px);
          if (l < wl) { wl = l; worst = px; }
        }
    }
    const c = t.color.match(/\d+/g).slice(0,3).map(Number);
    const rr = ratio(c, worst);
    const large = parseFloat(t.fontSize) >= 24;
    const need = large ? 3.0 : 4.5;
    console.log(`  ${t.label.padEnd(26)} ${t.fontSize.padEnd(7)} on rgb(${String(worst).padEnd(11)})  ${rr.toFixed(2)}:1  need ${need}  ${rr >= need ? "PASS" : "FAIL"}`);
  }
  await ctx.close();
}

console.log("=== NAVIGATION CONTRAST OVER LIVE FROST + AURORA ===");
await audit(1440, 900, false, [
  [".site-nav__wordmark", "wordmark (mono 12px)"],
  ['.site-nav__link[aria-current="location"]', "active link"],
  [".site-nav__links li:nth-child(3) .site-nav__link", "inactive link"],
]);
await audit(390, 844, false, [[".site-nav__bar .site-nav__wordmark", "mobile wordmark"]]);
await audit(390, 844, true, [
  [".site-nav__panel-index", "panel number (mono 12px)"],
  [".site-nav__panel-label", "panel label"],
  [".site-nav__panel-item:nth-child(5) .site-nav__panel-label", "panel label (last)"],
]);
await browser.close();
