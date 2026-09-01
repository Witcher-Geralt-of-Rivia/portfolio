import { chromium } from "playwright";

/* The knowledge map is drawn in a fixed 520x340 viewBox, so every label shrinks
   with the scale factor the container imposes. This measures what the reader
   actually sees: rendered type size in CSS pixels, and whether any two labels
   collide once scaled. Guessing font sizes for an SVG that is scaled by its
   container is how you ship an illegible map on a phone. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const VIEWPORTS = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800]];
const SCENARIOS = ["tutor", "assessment", "path"];

/* Rendered floor for map labels. Below this the map stops being readable. */
const MIN_RENDERED_PX = 9;

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

  const rows = [];
  for (const scenario of SCENARIOS) {
    await p.click(`#lscenario-tab-${scenario}`);
    await p.waitForTimeout(400);
    await frame(p);

    rows.push(await p.evaluate((name) => {
      const svg = document.querySelector(".lmap");
      const box = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const scale = box.width / vb.width;

      const visible = (el) => {
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden";
      };

      const texts = [...svg.querySelectorAll(".lnode__label, .lnode__code")].filter(visible);
      const measured = texts.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent,
          kind: el.classList.contains("lnode__code") ? "code" : "label",
          rendered: +(parseFloat(getComputedStyle(el).fontSize) * scale).toFixed(2),
          rect: { l: r.left, r: r.right, t: r.top, b: r.bottom },
        };
      });

      // Label-to-label collisions. A 1px tolerance keeps hairline touches out.
      const collisions = [];
      for (let i = 0; i < measured.length; i++) {
        for (let j = i + 1; j < measured.length; j++) {
          const a = measured[i].rect;
          const b = measured[j].rect;
          const overlapX = Math.min(a.r, b.r) - Math.max(a.l, b.l);
          const overlapY = Math.min(a.b, b.b) - Math.max(a.t, b.t);
          if (overlapX > 1 && overlapY > 1) {
            collisions.push(`"${measured[i].text}" x "${measured[j].text}"`);
          }
        }
      }

      // Nothing may spill outside the drawn map box.
      const spill = measured.filter((m) => m.rect.l < box.left - 1 || m.rect.r > box.right + 1).map((m) => m.text);

      const smallest = measured.length ? Math.min(...measured.map((m) => m.rendered)) : 0;
      return {
        scenario: name,
        mapW: Math.round(box.width), mapH: Math.round(box.height),
        scale: +scale.toFixed(3),
        labels: measured.length,
        smallest,
        collisions: [...new Set(collisions)],
        spill: [...new Set(spill)],
      };
    }, scenario));
  }

  console.log(`\n--- ${w}x${h} ---`);
  for (const r of rows) {
    const ok = r.smallest >= MIN_RENDERED_PX && r.collisions.length === 0 && r.spill.length === 0;
    if (!ok) failures++;
    console.log(
      `  ${r.scenario.padEnd(11)} map ${String(r.mapW).padStart(4)}x${String(r.mapH).padStart(3)} scale ${String(r.scale).padEnd(5)}` +
      ` labels ${String(r.labels).padStart(2)}  smallest ${String(r.smallest).padStart(5)}px ${pass(r.smallest >= MIN_RENDERED_PX)}` +
      `  collisions ${r.collisions.length} ${pass(r.collisions.length === 0)}  spill ${r.spill.length} ${pass(r.spill.length === 0)}`
    );
    if (r.collisions.length) console.log(`      ${r.collisions.slice(0, 6).join(" | ")}`);
    if (r.spill.length) console.log(`      spilling: ${r.spill.join(", ")}`);
  }
  await ctx.close();
}

await browser.close();
console.log(`\n=== stage07 map type: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"} ===`);
process.exit(failures === 0 ? 0 : 1);
