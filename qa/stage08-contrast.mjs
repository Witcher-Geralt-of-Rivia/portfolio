import { chromium } from "playwright";
import { PNG } from "pngjs";

/* Worst-case contrast for every Stage 08 text role, measured against the
   darkest pixel actually rendered behind each text box, across all five
   experiments after a run has completed.

   The fixed site navigation and the dev-tools indicator are removed for the
   sample: both paint over the section in a full-page capture and would be
   read as this section's background. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const lum = ([r,g,b]) => { const f=(v)=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const SHELL = [
  [".lab .eyebrow", "section eyebrow"],
  ["#lab-title", "section heading"],
  [".lab__lead", "supporting copy"],
  [".lab__capabilities", "technical line"],
  [".lab__title", "workspace title"],
  [".lab__subtitle", "simulation annotation"],
  [".lab__ident", "experiment identifier"],
  [".lpanel--input .lpanel__title", "input panel title"],
  [".lpanel--input .lpanel__badge", "input annotation"],
  [".linput__row dt", "input key"],
  [".linput__row dd", "input value"],
  [".linput__body", "payload block"],
  [".lflow__title", "flow title"],
  [".lflow__tag", "flow tag"],
  [".lstage__code", "flow stage code"],
  [".lpanel--observation .lpanel__title", "observation title"],
  [".lobs dt", "observation key"],
  [".lobs__state", "observation state"],
  [".lobs__event", "observation event"],
  [".lobs__pattern", "observation pattern"],
  [".lab__run-label", "run button label"],
  [".lab__reset", "reset button"],
  [".lab__status", "status line"],
  [".lab__explanation-title", "explanation title"],
  [".lab__explanation-tag", "explanation tag"],
  [".lab__explanation-body", "explanation body"],
  [".lab__patterns-title", "pattern rail title"],
  [".lab__pattern-index", "pattern index"],
  [".lab__pattern-title", "pattern title"],
];

const SELECTOR = [
  ['.lexp[aria-selected="true"] .lexp__label', "selector label (active)"],
  ['.lexp[aria-selected="false"] .lexp__label', "selector label (inactive)"],
  ['.lexp[aria-selected="true"] .lexp__index', "selector number (active)"],
  ['.lexp[aria-selected="false"] .lexp__index', "selector number (inactive)"],
  [".lstage.is-active .lstage__label", "flow stage (active)"],
  [".lstage:not(.is-active) .lstage__label", "flow stage (rest)"],
  [".lvariant.is-active", "variant (active)"],
  [".lvariant:not(.is-active)", "variant (inactive)"],
];

const VIEWS = [
  [".lresp__title", "response title"],
  [".lresp__sim", "simulated-response badge"],
  [".lresp__status", "response status"],
  [".lresp__time", "response time label"],
  [".lresp__header dt", "response header key"],
  [".lresp__body", "response body"],
  [".lrate__title", "stream title"],
  [".lrate__window", "window label"],
  [".lrdot__n", "request number"],
  [".lrate__used", "quota used"],
  [".lrate__remaining", "quota remaining"],
  [".lrate__blocked", "blocked banner"],
  [".lwh__check-key", "webhook check key"],
  [".lwh__check-value", "webhook check value"],
  [".lwh__history-title", "delivery history title"],
  [".lwatt__n", "attempt number"],
  [".lwatt__result", "attempt result"],
  [".lq__title", "queue title"],
  [".lq__depth", "queue depth"],
  [".lqjob__id", "job id"],
  [".lqjob__state", "job state"],
  [".lqjob__note", "job note"],
  [".lq__backoff-title", "backoff title"],
  [".lqmark__label", "backoff mark"],
  [".lq__backoff-note", "backoff note"],
  [".lidstep__t", "timeline time"],
  [".lidstep__label", "timeline label"],
  [".lidem__counter dt", "counter key"],
  [".lidem__value", "counter value"],
  [".lidem__note", "idempotency note"],
];

const ALL = [...SHELL, ...SELECTOR, ...VIEWS];

const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows","--disable-background-timer-throttling"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(BASE + "/", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await frame(p); await p.waitForTimeout(1200); await frame(p);

const results = new Map();

for (const id of ["api", "ratelimit", "webhook", "queue", "idempotency"]) {
  await p.click(`#lexp-tab-${id}`);
  await p.waitForTimeout(320);
  await p.click(".lab__run");
  await p.waitForFunction(() => !document.querySelector(".lab__run").disabled, null, { timeout: 15000, polling: 80 });
  await frame(p); await p.waitForTimeout(350); await frame(p);

  const info = await p.evaluate((sels) => sels.map(([sel, label]) => {
    const el = document.querySelector(sel);
    if (!el) return { label, missing: true };
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { label, missing: true };
    const cs = getComputedStyle(el);
    return {
      label, colour: cs.color, fontSize: cs.fontSize, weight: cs.fontWeight,
      rect: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
    };
  }), ALL);

  await p.addStyleTag({ content:
    "#lab, #lab * { color: transparent !important; }" +
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
    const need = (size >= 24 || (size >= 18.66 && parseInt(t.weight) >= 700)) ? 3 : 4.5;
    const prev = results.get(t.label);
    if (!prev || rr < prev.rr) results.set(t.label, { rr, need, size: size.toFixed(1), worst, id });
  }

  await p.reload({ waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(900); await frame(p);
}

console.log("=== STAGE 08 CONTRAST (worst case across five experiments, after a run) ===");
const fails = [];
for (const [label, r] of results) {
  const ok = r.rr >= r.need;
  if (!ok) fails.push(`${label} ${r.rr.toFixed(2)} (need ${r.need})`);
  console.log(`  ${label.padEnd(28)} ${String(r.size).padStart(5)}px on rgb(${String(r.worst).padEnd(11)}) ${r.rr.toFixed(2)}:1  need ${r.need}  ${ok ? "PASS" : "FAIL"}  [${r.id}]`);
}
console.log(`\nmeasured ${results.size} text roles; failures: ${fails.length ? fails.join(", ") : "none"}`);
await browser.close();
process.exit(fails.length ? 1 : 0);
