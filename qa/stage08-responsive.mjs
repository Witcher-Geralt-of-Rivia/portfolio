import { chromium } from "playwright";

/* Stage 08 layout audit across the eight required viewports, for every
   experiment. Special attention to 1366, 768, 390 and 360: cramped panels,
   tiny technical text, overflow, clipped flow and overlapping controls. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const VIEWPORTS = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800]];
const EXPERIMENTS = ["api", "ratelimit", "webhook", "queue", "idempotency"];
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});

let failures = 0;

for (const [w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/#lab", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(700); await frame(p);

  const rows = [];
  for (const id of EXPERIMENTS) {
    await p.click(`#lexp-tab-${id}`);
    await p.waitForTimeout(320);
    await frame(p);

    rows.push(await p.evaluate((name) => {
      const box = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      const ws = box(".lab__workspace");
      const input = box(".lpanel--input");
      const centre = box(".lab__centre");
      const obs = box(".lpanel--observation");
      const controls = box(".lab__controls");

      const escaping = [...document.querySelector(".lab__workspace").querySelectorAll("*")]
        .filter((e) => e.getBoundingClientRect().width > 0)
        .filter((e) => {
          const b = e.getBoundingClientRect();
          return b.left < ws.left - 1 || b.right > ws.right + 1;
        })
        .map((e) => String(e.className).split(" ")[0]);

      const overlap = (a, b) => {
        if (!a || !b) return 0;
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return Math.round(x * y);
      };

      // Nothing meaningful may drop below the established technical minimum.
      const tiny = [...document.querySelectorAll(".lab *")]
        .filter((e) => e.children.length === 0 && (e.textContent || "").trim().length > 1)
        .map((e) => ({ t: (e.textContent || "").trim().slice(0, 22), px: parseFloat(getComputedStyle(e).fontSize) }))
        .filter((e) => e.px < 8.4);

      const tabs = [...document.querySelectorAll(".lexp")].map((t) => Math.round(t.getBoundingClientRect().height));
      const runBtn = box(".lab__run");
      const resetBtn = box(".lab__reset");

      return {
        name,
        ws: [Math.round(ws.width), Math.round(ws.height)],
        input: input ? [Math.round(input.width), Math.round(input.height)] : null,
        centre: centre ? [Math.round(centre.width), Math.round(centre.height)] : null,
        obs: obs ? [Math.round(obs.width), Math.round(obs.height)] : null,
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        escaping: [...new Set(escaping)],
        overlaps: { inputCentre: overlap(input, centre), centreObs: overlap(centre, obs), inputObs: overlap(input, obs) },
        controlsOverlap: overlap(controls, obs),
        tiny: tiny.slice(0, 4),
        tabMinH: Math.min(...tabs),
        buttons: [runBtn ? Math.round(runBtn.height) : 0, resetBtn ? Math.round(resetBtn.height) : 0],
        // Phone order: system flow before input before observation.
        order: centre && input && obs ? [Math.round(centre.top), Math.round(input.top), Math.round(obs.top)] : null,
      };
    }, id));
  }

  const phone = w < 700;
  let vpFail = false;
  console.log(`\n--- ${w}x${h} ---`);
  for (const r of rows) {
    const noOverflow = r.docOverflow <= 0;
    const noEscape = r.escaping.length === 0;
    const noOverlap = r.overlaps.inputCentre === 0 && r.overlaps.centreObs === 0 && r.overlaps.inputObs === 0 && r.controlsOverlap === 0;
    const noTiny = r.tiny.length === 0;
    const touchOk = r.tabMinH >= 38 && r.buttons.every((b) => b >= 38);
    const orderOk = !phone || (r.order && r.order[0] < r.order[1] && r.order[1] < r.order[2]);
    const ok = noOverflow && noEscape && noOverlap && noTiny && touchOk && orderOk;
    if (!ok) { vpFail = true; }
    console.log(
      `  ${r.name.padEnd(12)} ws ${String(r.ws[0]).padStart(4)}x${String(r.ws[1]).padStart(4)}` +
      ` in ${JSON.stringify(r.input)} mid ${JSON.stringify(r.centre)} obs ${JSON.stringify(r.obs)}` +
      `  ovf ${r.docOverflow} ${pass(noOverflow)} esc ${r.escaping.length} ${pass(noEscape)} lap ${pass(noOverlap)}` +
      ` tiny ${r.tiny.length} ${pass(noTiny)} tap ${pass(touchOk)}${phone ? ` order ${pass(orderOk)}` : ""}`
    );
    if (r.tiny.length) console.log(`      tiny text: ${JSON.stringify(r.tiny)}`);
    if (r.escaping.length) console.log(`      escaping: ${r.escaping.join(", ")}`);
  }
  if (vpFail) failures++;
  await ctx.close();
}

await browser.close();
console.log(`\n=== stage08 responsive: ${failures === 0 ? "ALL PASS" : failures + " viewport(s) FAILED"} ===`);
process.exit(failures === 0 ? 0 : 1);
