import { chromium } from "playwright";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows"] });

for (const [w, h] of [[1920,1080],[1440,900],[390,844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(1600); await frame(p);

  const r = await p.evaluate(() => {
    const svg = document.querySelector(".constellation__svg");
    const ctm = svg.getScreenCTM();
    const toScreen = (pt) => {
      const s = svg.createSVGPoint(); s.x = pt.x; s.y = pt.y;
      return s.matrixTransform(ctm);
    };
    const labels = [...document.querySelectorAll(".cnode__label")].map(l => ({
      text: l.textContent, rect: l.getBoundingClientRect(),
    }));

    // Sample every connection and test it against every label box.
    const hits = [];
    for (const path of document.querySelectorAll(".clink")) {
      const len = path.getTotalLength();
      for (let i = 0; i <= 80; i++) {
        const sp = toScreen(path.getPointAtLength((len * i) / 80));
        for (const l of labels) {
          const b = l.rect;
          if (sp.x >= b.left - 1 && sp.x <= b.right + 1 && sp.y >= b.top - 1 && sp.y <= b.bottom + 1) {
            hits.push(`${path.getAttribute("class").split(" ")[0]}:${path.classList[1]} over "${l.text}"`);
          }
        }
      }
    }

    // Label safe area inside each chip.
    const safe = [...document.querySelectorAll(".cnode")].map(n => {
      const chip = n.getBoundingClientRect();
      const label = n.querySelector(".cnode__label").getBoundingClientRect();
      const dot = n.querySelector(".cnode__dot").getBoundingClientRect();
      return {
        node: n.querySelector(".cnode__label").textContent,
        chipW: Math.round(chip.width), chipH: Math.round(chip.height),
        leftPad: Math.round(dot.left - chip.left),
        rightPad: Math.round(chip.right - label.right),
        topPad: Math.round(label.top - chip.top),
      };
    });

    const con = document.querySelector(".constellation").getBoundingClientRect();
    // display:none elements report a zero rect; they are not overflow.
    const inside = [...document.querySelectorAll(".cnode, .cnote, .ccore")]
      .filter(e => e.getBoundingClientRect().width > 0)
      .every(e => {
        const b = e.getBoundingClientRect();
        return b.left >= con.left - 2 && b.right <= con.right + 2 && b.top >= con.top - 2 && b.bottom <= con.bottom + 2;
      });

    return { hits: [...new Set(hits)], safe, inside,
             constellation: [Math.round(con.width), Math.round(con.height)] };
  });

  console.log(`\n--- ${w}x${h} (constellation ${r.constellation[0]}x${r.constellation[1]}) ---`);
  console.log(`  connections crossing a label: ${r.hits.length === 0 ? "none  PASS" : "FAIL " + r.hits.join(", ")}`);
  const minLeft = Math.min(...r.safe.map(s => s.leftPad));
  const minRight = Math.min(...r.safe.map(s => s.rightPad));
  console.log(`  chip padding: min left ${minLeft}px, min right ${minRight}px (need >= 8) ${pass(minLeft >= 8 && minRight >= 8)}`);
  console.log(`  all overlay elements inside artboard: ${pass(r.inside)}`);
  console.log(`  chip sizes: ${r.safe.map(s => `${s.node} ${s.chipW}x${s.chipH}`).join(" | ")}`);
  await ctx.close();
}
await browser.close();
