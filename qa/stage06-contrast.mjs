import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
import { PNG } from "pngjs";

/* Worst-case contrast for every text role in Stage 06, measured against the
   darkest pixel actually rendered behind each text box -- including the pastel
   status pills, where the tone, not the panel, is the effective background. */

const lum = ([r,g,b]) => { const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const TARGETS = [
  [".products .eyebrow", "section eyebrow"],
  ["#products-title", "section heading"],
  [".products__lead", "supporting copy"],
  [".products__capabilities", "capability line"],
  [".pstudio__title", "studio title"],
  [".pstudio__subtitle", "studio subtitle"],
  ['.pscenario[aria-selected="true"]', "scenario tab (active)"],
  ['.pscenario[aria-selected="false"]', "scenario tab (inactive)"],
  [".psurface__tag", "surface tag"],
  [".pweb__route", "app route"],
  [".pweb__demo", "demo-data label"],
  [".pweb__nav-item.is-current", "app nav (current)"],
  [".pweb__nav-item:not(.is-current)", "app nav (rest)"],
  [".pweb__title", "app screen title"],
  [".pweb__block-label", "app block label"],
  [".pweb__tile-label", "tile label"],
  [".pweb__tile-value", "tile value"],
  [".pweb__tile-note", "tile note"],
  [".pweb__row-name", "row name"],
  [".pweb__row-meta", "row meta"],
  [".pweb__pill", "status pill (on tone)"],
  [".pweb__card-name", "card name"],
  [".pweb__card-meta", "card meta"],
  [".pweb__timeline-name", "timeline label"],
  [".pmob__header", "phone header"],
  [".pmob__label", "phone block label"],
  [".pmob__card-title", "phone card title"],
  [".pmob__card-meta", "phone card meta"],
  [".pmob__step-name", "phone step name"],
  [".pmob__checklist li", "phone checklist item"],
  [".pmob__action", "phone action"],
  [".pmob__tab.is-current", "phone tab (current)"],
  [".pmob__tab:not(.is-current)", "phone tab (rest)"],
  [".passist__title", "assist title"],
  [".passist__badge", "assist badge (on tone)"],
  [".passist__heading", "assist heading"],
  [".passist__text", "assist body"],
  [".passist__action", "assist action"],
  [".passist__context > span:last-child", "assist context"],
  [".pflow__title", "flow title"],
  [".pflow__tag", "flow tag"],
  [".pflow__node-label", "flow node label"],
  [".pflow__node-technical", "flow node technical"],
  [".pstudio__run-label", "run button label"],
  [".pstudio__stage", "flow status line"],
  [".products__rail-index", "capability index"],
  [".products__rail-title", "capability title"],
  [".products__micro", "micro label"],
];

const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows","--disable-background-timer-throttling"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(BASE + "/", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await frame(p); await p.waitForTimeout(1200); await frame(p);

const results = new Map();

for (const scenario of ["operations", "commerce", "field"]) {
  await p.click(`#pscenario-tab-${scenario}`);
  await p.waitForTimeout(500);
  // Run the flow to completion so the synced marker and lit rail are measured too.
  await p.click(".pstudio__run");
  await p.waitForFunction(() => document.querySelector(".pstudio__run-label").textContent === "Run again", null, { timeout: 9000, polling: 120 });
  await frame(p); await p.waitForTimeout(400); await frame(p);

  const extra = [...TARGETS, [".pmob__synced", "phone synced marker (on tone)"], [".pflow__node.is-passed .pflow__node-label", "flow label (passed)"]];

  const info = await p.evaluate((sels) => sels.map(([sel, label]) => {
    const el = document.querySelector(sel);
    if (!el) return { label, missing: true };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { label, color: cs.color, fontSize: cs.fontSize, weight: cs.fontWeight,
             rect: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) } };
  }), extra);

  /* The site navigation is position:fixed. Clicking a scenario tab scrolls the
     studio into view, which parks the nav's own dark text directly over the
     assist panel's header in a full-page capture -- sampled as if it were the
     assist panel's background. It is not part of this section's backdrop. */
  await p.addStyleTag({ content: "#products, #products * { color: transparent !important; } .site-nav { display: none !important; } nextjs-portal { display: none !important; }" });

  /* The assist panel has backdrop-filter, so it rasters on its own compositing
     layer. That layer can still hold the pre-override pixels after the style
     tag lands, which reads back as text-on-itself at 1.00:1. Force frames
     until the layer has actually repainted before sampling anything. */
  let png = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    await frame(p);
    await p.waitForTimeout(250);
    await frame(p);
    png = PNG.sync.read(await p.screenshot({ fullPage: true }));
    const probe = info.find((t) => t.label === "assist heading");
    let darkest = 255;
    for (let y = probe.rect.y; y < Math.min(png.height, probe.rect.y + probe.rect.h); y++)
      for (let x = probe.rect.x; x < Math.min(png.width, probe.rect.x + probe.rect.w); x++) {
        const i = (png.width * y + x) << 2;
        darkest = Math.min(darkest, (png.data[i] + png.data[i+1] + png.data[i+2]) / 3);
      }
    if (darkest > 200) break;
    if (attempt === 9) throw new Error(`assist layer never repainted (darkest ${darkest})`);
  }

  for (const t of info) {
    if (t.missing) continue;
    const { width, height, data } = png;
    let worst = null, wl = 2;
    for (let y = Math.max(0, t.rect.y); y < Math.min(height, t.rect.y + t.rect.h); y += 1)
      for (let x = Math.max(0, t.rect.x); x < Math.min(width, t.rect.x + t.rect.w); x += 1) {
        const i = (width * y + x) << 2; const px = [data[i], data[i+1], data[i+2]]; const l = lum(px);
        if (l < wl) { wl = l; worst = px; }
      }
    if (!worst) continue;
    const c = t.color.match(/\d+/g).slice(0, 3).map(Number);
    const rr = ratio(c, worst);
    const size = parseFloat(t.fontSize);
    const need = (size >= 24 || (size >= 18.66 && parseInt(t.weight) >= 700)) ? 3 : 4.5;
    const prev = results.get(t.label);
    if (!prev || rr < prev.rr) results.set(t.label, { rr, need, size: t.fontSize, worst, scenario });
  }

  await p.reload({ waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(800); await frame(p);
}

console.log("=== STAGE 06 CONTRAST (worst case across all three scenarios, flow complete) ===");
const fails = [];
for (const [label, r] of results) {
  const ok = r.rr >= r.need;
  if (!ok) fails.push(`${label} ${r.rr.toFixed(2)} (need ${r.need})`);
  console.log(`  ${label.padEnd(30)} ${r.size.padEnd(7)} on rgb(${String(r.worst).padEnd(11)}) ${r.rr.toFixed(2)}:1  need ${r.need}  ${ok ? "PASS" : "FAIL"}  [${r.scenario}]`);
}
console.log(`\nmeasured ${results.size} text roles; failures: ${fails.length ? fails.join(", ") : "none"}`);
await browser.close();
process.exit(fails.length ? 1 : 0);
