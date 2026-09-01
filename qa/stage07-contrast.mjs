import { chromium } from "playwright";
import { PNG } from "pngjs";

/* Worst-case contrast for every Stage 07 text role, measured against the
   darkest pixel actually rendered behind each text box, across all three
   scenarios and after an adaptation has run.

   SVG text takes its colour from `fill`, not `color`, so the transparency
   override and the colour read both have to account for that - otherwise the
   map labels are sampled against themselves and read 1.00:1. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const lum = ([r,g,b]) => { const f=(v)=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const TARGETS = [
  [".learning .eyebrow", "section eyebrow"],
  ["#ai-learning-title", "section heading"],
  [".learning__lead", "supporting copy"],
  [".learning__capabilities", "technical line"],
  [".llab__title", "lab title"],
  [".llab__subtitle", "simulation annotation"],
  ['.lscenario[aria-selected="true"]', "scenario tab (active)"],
  ['.lscenario[aria-selected="false"]', "scenario tab (inactive)"],
  [".lpanel--learner .lpanel__title", "learner panel title"],
  [".lpanel--learner .lpanel__badge", "simulated-learner badge"],
  [".lprofile__row dt", "profile key"],
  [".lprofile__row dd", "profile value"],
  [".lpanel__label", "panel section label"],
  [".lmeter__label", "mastery label"],
  [".lmeter__value", "mastery value"],
  [".lgap__text", "knowledge gap item"],
  [".llab__map-title", "map title"],
  [".llegend__text", "map legend"],
  [".lnode--primary .lnode__label", "map node label"],
  [".lnode__code", "map node code"],
  [".lnode__order text", "milestone number"],
  [".lartifact__title", "artifact title"],
  [".lartifact__body", "artifact body"],
  [".lartifact__tag", "artifact tag"],
  [".lpanel--tutor .lpanel__title", "tutor title"],
  [".lpanel--tutor .lpanel__badge", "tutor badge"],
  [".ltutor__brief", "tutor brief"],
  [".ltutor__focus-label", "tutor focus label"],
  [".ltutor__focus-text", "tutor focus text"],
  [".ltutor__action", "tutor action"],
  [".lpanel__foot > span:last-child", "tutor context"],
  [".ljourney__title", "journey title"],
  [".ljourney__tag", "journey tag"],
  [".ljstep.is-current .ljstep__label", "journey step (current)"],
  [".ljstep:not(.is-current) .ljstep__label", "journey step (rest)"],
  [".ljstep__code", "journey step code"],
  [".llab__run-label", "adapt button label"],
  [".llab__stage", "adapt status line"],
  [".learning__principle-index", "principle index"],
  [".learning__principle-title", "principle title"],
];

const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows","--disable-background-timer-throttling"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(BASE + "/", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await frame(p); await p.waitForTimeout(1200); await frame(p);

const results = new Map();

for (const scenario of ["tutor", "assessment", "path"]) {
  await p.click(`#lscenario-tab-${scenario}`);
  await p.waitForTimeout(450);
  await p.click(".llab__run");
  await p.waitForFunction(() => /again/i.test(document.querySelector(".llab__run-label").textContent), null, { timeout: 9000, polling: 100 });
  await frame(p); await p.waitForTimeout(400); await frame(p);

  const info = await p.evaluate((sels) => sels.map(([sel, label]) => {
    const el = document.querySelector(sel);
    if (!el) return { label, missing: true };
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { label, missing: true };
    const cs = getComputedStyle(el);
    const isSvg = el.ownerSVGElement != null;
    const colour = isSvg ? cs.fill : cs.color;
    return {
      label, colour, fontSize: cs.fontSize, weight: cs.fontWeight, isSvg,
      rect: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
    };
  }), TARGETS);

  /* Hide the text, keeping every surface, then sample what is behind it. The
     fixed site navigation and the dev-tools indicator are removed too: both
     paint over the section in a full-page capture and would be sampled as if
     they were this section's background. */
  await p.addStyleTag({ content:
    "#ai-learning, #ai-learning * { color: transparent !important; }" +
    "#ai-learning text, #ai-learning tspan { fill: transparent !important; }" +
    ".site-nav { display: none !important; } nextjs-portal { display: none !important; }" });

  let png = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    await frame(p); await p.waitForTimeout(220); await frame(p);
    png = PNG.sync.read(await p.screenshot({ fullPage: true }));
    const probe = info.find((t) => t.label === "section heading");
    let darkest = 255;
    for (let y = probe.rect.y; y < Math.min(png.height, probe.rect.y + probe.rect.h); y++)
      for (let x = probe.rect.x; x < Math.min(png.width, probe.rect.x + probe.rect.w); x++) {
        const i = (png.width * y + x) << 2;
        darkest = Math.min(darkest, (png.data[i] + png.data[i+1] + png.data[i+2]) / 3);
      }
    if (darkest > 200) break;
    if (attempt === 7) throw new Error(`text never went transparent (darkest ${darkest})`);
  }

  for (const t of info) {
    if (t.missing) continue;
    let worst = null, wl = 2;
    for (let y = Math.max(0, t.rect.y); y < Math.min(png.height, t.rect.y + t.rect.h); y++)
      for (let x = Math.max(0, t.rect.x); x < Math.min(png.width, t.rect.x + t.rect.w); x++) {
        const i = (png.width * y + x) << 2;
        const px = [png.data[i], png.data[i+1], png.data[i+2]];
        const l = lum(px);
        if (l < wl) { wl = l; worst = px; }
      }
    if (!worst) continue;
    const c = t.colour.match(/\d+/g).slice(0, 3).map(Number);
    const rr = ratio(c, worst);
    const size = parseFloat(t.fontSize);
    // SVG type is in viewBox units; what matters is the rendered size.
    const rendered = t.isSvg ? size * 1.077 : size;
    const need = (rendered >= 24 || (rendered >= 18.66 && parseInt(t.weight) >= 700)) ? 3 : 4.5;
    const prev = results.get(t.label);
    if (!prev || rr < prev.rr) results.set(t.label, { rr, need, size: rendered.toFixed(1), worst, scenario });
  }

  await p.reload({ waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(900); await frame(p);
}

console.log("=== STAGE 07 CONTRAST (worst case across all three scenarios, after adaptation) ===");
const fails = [];
for (const [label, r] of results) {
  const ok = r.rr >= r.need;
  if (!ok) fails.push(`${label} ${r.rr.toFixed(2)} (need ${r.need})`);
  console.log(`  ${label.padEnd(26)} ${String(r.size).padStart(5)}px on rgb(${String(r.worst).padEnd(11)}) ${r.rr.toFixed(2)}:1  need ${r.need}  ${ok ? "PASS" : "FAIL"}  [${r.scenario}]`);
}
console.log(`\nmeasured ${results.size} text roles; failures: ${fails.length ? fails.join(", ") : "none"}`);
await browser.close();
process.exit(fails.length ? 1 : 0);
