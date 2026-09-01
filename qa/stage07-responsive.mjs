import { chromium } from "playwright";

/* Stage 07 layout audit. Every surface must survive every width: nothing
   dropped, nothing overflowing, nothing overlapping, and the phone order must
   stay learner state -> map -> tutor -> journey. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const VIEWPORTS = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800]];
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});

let failures = 0;

for (const [w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/#ai-learning", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(700); await frame(p);

  const r = await p.evaluate(() => {
    const box = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const size = (s) => { const b = box(s); return b ? [Math.round(b.width), Math.round(b.height)] : null; };
    const present = (s) => { const b = box(s); return !!b && b.width > 0 && b.height > 0; };

    const lab = box(".llab");
    const learner = box(".lpanel--learner");
    const map = box(".lmap");
    const tutor = box(".lpanel--tutor");
    const journey = box(".ljourney");

    // Nothing may escape the lab horizontally.
    const escaping = [...document.querySelector(".llab").querySelectorAll("*")]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .filter((e) => {
        const b = e.getBoundingClientRect();
        return b.left < lab.left - 1 || b.right > lab.right + 1;
      })
      .map((e) => String(e.className.baseVal ?? e.className).split(" ")[0]);

    const overlapArea = (a, b) => {
      if (!a || !b) return 0;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return Math.round(x * y);
    };

    // Document order on a phone must be learner, map, tutor, journey.
    const order = [learner, map, tutor, journey].map((b) => Math.round(b.top));
    const stacked = order[0] < order[1] && order[1] < order[2] && order[2] < order[3];

    const tabs = [...document.querySelectorAll(".lscenario")].map((t) => {
      const b = t.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    });

    const steps = [...document.querySelectorAll(".ljstep")].map((s) => Math.round(s.getBoundingClientRect().width));
    const meters = [...document.querySelectorAll(".lmeter__track")].map((m) => Math.round(m.getBoundingClientRect().width));

    return {
      present: {
        learner: present(".lpanel--learner"), map: present(".lmap"),
        tutor: present(".lpanel--tutor"), journey: present(".ljourney"),
        principles: present(".learning__principles"), run: present(".llab__run"),
      },
      sizes: {
        lab: size(".llab"), learner: size(".lpanel--learner"), map: size(".lmap"),
        tutor: size(".lpanel--tutor"), journey: size(".ljourney"),
      },
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      escaping: [...new Set(escaping)],
      overlaps: {
        learnerMap: overlapArea(learner, map),
        mapTutor: overlapArea(map, tutor),
        learnerTutor: overlapArea(learner, tutor),
      },
      stacked,
      tabMinH: Math.min(...tabs.map((t) => t.h)),
      stepMinW: steps.length ? Math.min(...steps) : 0,
      meterMinW: meters.length ? Math.min(...meters) : 0,
    };
  });

  const allPresent = Object.values(r.present).every(Boolean);
  const noOverflow = r.docOverflow <= 0;
  const noEscape = r.escaping.length === 0;
  const noOverlap = r.overlaps.learnerMap === 0 && r.overlaps.mapTutor === 0 && r.overlaps.learnerTutor === 0;
  const phone = w < 700;
  const orderOk = phone ? r.stacked : true;
  const touchOk = phone ? r.tabMinH >= 38 : r.tabMinH >= 38;
  const metersOk = r.meterMinW >= 28;

  const ok = allPresent && noOverflow && noEscape && noOverlap && orderOk && touchOk && metersOk;
  if (!ok) failures++;

  console.log(`\n--- ${w}x${h} --- lab ${r.sizes.lab[0]}x${r.sizes.lab[1]}`);
  console.log(`  surfaces present ............. ${pass(allPresent)} ${JSON.stringify(r.present)}`);
  console.log(`  learner ${JSON.stringify(r.sizes.learner)}  map ${JSON.stringify(r.sizes.map)}  tutor ${JSON.stringify(r.sizes.tutor)}  journey ${JSON.stringify(r.sizes.journey)}`);
  console.log(`  document horizontal overflow . ${r.docOverflow}px ${pass(noOverflow)}`);
  console.log(`  escaping the lab ............. ${r.escaping.length ? r.escaping.join(", ") : "none"} ${pass(noEscape)}`);
  console.log(`  panel overlap ................ ${JSON.stringify(r.overlaps)} ${pass(noOverlap)}`);
  console.log(`  phone stack order ............ ${phone ? (r.stacked ? "learner < map < tutor < journey PASS" : "WRONG ORDER FAIL") : "n/a (desktop/tablet)"}`);
  console.log(`  scenario tab min height ...... ${r.tabMinH}px ${pass(touchOk)}   journey step min width ${r.stepMinW}px   meter track min ${r.meterMinW}px ${pass(metersOk)}`);
  await ctx.close();
}

await browser.close();
console.log(`\n=== stage07 responsive: ${failures === 0 ? "ALL PASS" : failures + " viewport(s) FAILED"} ===`);
process.exit(failures === 0 ? 0 : 1);
