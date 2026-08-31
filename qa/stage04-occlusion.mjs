import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
import { PNG } from "pngjs";

/* Is any connection actually VISIBLE through a chip? Compare the pixels
   inside each label box against the same chip with every link removed. */
const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding"] });
for (const [w, h] of [[390, 844], [360, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ type: "jpeg", quality: 20 });
  await p.waitForTimeout(1200);
  // Freeze drift so the two captures register exactly.
  await p.addStyleTag({ content: ".cnode, .ccore, .csignal, .clink--flow { animation: none !important; }" });
  await p.screenshot({ type: "jpeg", quality: 20 });
  await p.waitForTimeout(300);

  const boxes = await p.evaluate(() =>
    // Measure the label's own box: spec 96 is about lines crossing label
    // TEXT, and sampling the whole chip catches antialiasing on its border.
    [...document.querySelectorAll(".cnode__label")].map(l => {
      const c = l.getBoundingClientRect();
      return { label: l.textContent,
               x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.width), h: Math.round(c.height) };
    })
  );
  const withLinks = PNG.sync.read(await p.screenshot());
  await p.addStyleTag({ content: ".clink { display: none !important; }" });
  await p.screenshot({ type: "jpeg", quality: 20 });
  await p.waitForTimeout(300);
  const without = PNG.sync.read(await p.screenshot());

  console.log(`\n--- ${w}x${h} : visible line bleed through chips ---`);
  let worst = 0, worstLabel = "";
  for (const b of boxes) {
    let maxDiff = 0;
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        const i = (withLinks.width * y + x) << 2;
        const d = Math.max(
          Math.abs(withLinks.data[i] - without.data[i]),
          Math.abs(withLinks.data[i + 1] - without.data[i + 1]),
          Math.abs(withLinks.data[i + 2] - without.data[i + 2])
        );
        if (d > maxDiff) maxDiff = d;
      }
    if (maxDiff > worst) { worst = maxDiff; worstLabel = b.label; }
    console.log(`  ${b.label.padEnd(12)} max pixel delta over label: ${maxDiff}/255`);
  }
  console.log(`  worst: ${worst}/255 on "${worstLabel}" -> ${worst <= 3 ? "PASS (not perceptible)" : "FAIL (visible)"}`);
  await ctx.close();
}
await browser.close();
