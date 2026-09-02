import { chromium } from "playwright";

/* Stage 06 keeps semantic <ul>/<ol> for its lists, so the browser's marker box
   has to be removed in CSS rather than by swapping in <div>s. This measures
   that removal on every one of those lists, with the component-local reset
   active and with it neutralised.

   "before" is what the browser does to a bare list: the ~40px marker inset that
   pushes content away from its panel edge. "after" is the reset in force.

   Content inset is measured against the list's own PADDING edge, i.e. the first
   child's offset minus the container's border, so a 1px panel border is not
   mistaken for leftover marker indentation. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

/* selector, label, expected tag, scenario that renders it, expected inline-start
   padding once the reset has run.

   Five lists sit flush at 0. `.pweb__timeline` is the exception: it is a panel
   in its own right and re-declares `padding: 13px 14px` later in products.css
   (deliberate, and it wins on source order at equal specificity). 14px is its
   design inset, not leftover marker indentation -- the marker box is still
   gone, which is what the before/after columns show. */
const LISTS = [
  [".products__rail", "capability rail", "ul", "operations", 0],
  [".pweb__rows", "web rows", "ul", "operations", 0],
  [".pflow__rail", "event rail", "ol", "operations", 0],
  [".pweb__timeline", "web timeline", "ol", "commerce", 14],
  [".pmob__steps", "phone step list", "ol", "commerce", 0],
  [".pmob__checklist ul", "phone checklist", "ul", "field", 0],
];

const ALL = LISTS.map(([s]) => s).join(", ");
// Restore only what the local reset suppresses: the UA list defaults.
const NEUTRALISE = `${ALL} { padding-inline-start: 40px !important; list-style: disc !important; margin-block: 1em !important; }`;

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(BASE + "/#products", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await frame(p); await p.waitForTimeout(900); await frame(p);

const probe = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  const first = el.firstElementChild;
  const fb = first ? first.getBoundingClientRect() : null;
  const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
  return {
    tag: el.tagName.toLowerCase(),
    padding: cs.paddingInlineStart,
    margin: cs.marginBlockStart,
    listStyle: cs.listStyleType,
    // Offset of the first item past the container's own border.
    contentInset: fb ? +(fb.left - box.left - borderLeft).toFixed(1) : null,
  };
};

const rows = [];
for (const scenario of ["operations", "commerce", "field"]) {
  await p.click(`#pscenario-tab-${scenario}`);
  await p.waitForTimeout(450);
  await frame(p);

  const wanted = LISTS.filter(([, , , sc]) => sc === scenario);

  const after = await p.evaluate(
    ([sels, fn]) => sels.map((s) => eval(`(${fn})`)(s)), [wanted.map((w) => w[0]), probe.toString()]
  );
  const tag = await p.addStyleTag({ content: NEUTRALISE });
  await frame(p); await p.waitForTimeout(350); await frame(p);
  const before = await p.evaluate(
    ([sels, fn]) => sels.map((s) => eval(`(${fn})`)(s)), [wanted.map((w) => w[0]), probe.toString()]
  );
  await p.evaluate((el) => el.remove(), tag);
  await frame(p); await p.waitForTimeout(250);

  wanted.forEach((w, i) => rows.push({ label: w[1], sel: w[0], expectedTag: w[2], scenario, expectedPad: w[4], a: after[i], b: before[i] }));
}

console.log("=== STAGE 06 SEMANTIC LIST MARKER INSET ===");
console.log(`(${BASE})\n`);
console.log("  list              scenario     tag   before    after   padding  margin  list-style  semantic");
console.log("  " + "-".repeat(95));
let fails = 0;
for (const r of rows) {
  if (!r.a) { console.log(`  ${r.label}: MISSING in ${r.scenario}`); fails++; continue; }
  /* The reset's job: no marker, no margin, and no marker indentation. Any
     remaining inline-start padding must be a value the design asks for. */
  const reset = r.a.listStyle === "none" && r.a.margin === "0px"
    && r.a.padding === `${r.expectedPad}px` && r.a.contentInset === r.expectedPad;
  const semantic = r.a.tag === r.expectedTag;
  const regressed = !(r.b.contentInset >= 30);   // the neutralised state must actually show the marker inset
  if (!reset || !semantic || regressed) fails++;
  console.log(
    `  ${r.label.padEnd(17)} ${r.scenario.padEnd(11)} <${r.a.tag}>` +
    ` ${String(r.b.contentInset).padStart(6)}px ${String(r.a.contentInset).padStart(6)}px` +
    `  ${r.a.padding.padEnd(8)} ${r.a.margin.padEnd(7)} ${r.a.listStyle.padEnd(11)} ` +
    `${semantic ? "ok" : "TAG MISMATCH"} ${reset ? "PASS" : "FAIL"}${r.expectedPad ? "  (design inset, not marker)" : ""}`
  );
}
console.log(`\n  all six lists are real <ul>/<ol> (not divs): ${rows.every((r) => r.a && r.a.tag === r.expectedTag) ? "PASS" : "FAIL"}`);
console.log(`=== list reset: ${fails === 0 ? "ALL PASS" : fails + " FAILURE(S)"} ===`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
