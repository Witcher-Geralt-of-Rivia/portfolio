import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const OUT = "qa/shots/stage04";
const URL = BASE + "/";
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
] });

async function open(w, h, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p);
  await p.waitForTimeout(1400);
  await frame(p);
  return { ctx, p };
}
const shot = async (p, name) => {
  await p.screenshot({ path: `${OUT}/${name}.png`, type: "png", timeout: 90000 });
  console.log("  wrote", name + ".png");
};

for (const [w, h] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800]]) {
  const { ctx, p } = await open(w, h);
  await shot(p, `hero-${w}x${h}`);
  await ctx.close();
}

/* Motion sampling: same composition, subtly different state. */


/* Hover on Agents */
{
  const { ctx, p } = await open(1440, 900);
  // The chips drift continuously, so Playwright's "wait for stable" check
  // never settles. Move the pointer to the chip's centre directly.
  const box = await p.evaluate(() => {
    const r = document.querySelector(".cnode--agents").getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p.mouse.move(box.x, box.y);
  await frame(p); await p.waitForTimeout(500); await frame(p);
  await shot(p, "hover-agents-1440x900");
  await ctx.close();
}

/* Reduced motion */
{
  const { ctx, p } = await open(1440, 900, { reducedMotion: "reduce" });
  await shot(p, "reduced-motion-1440x900");
  await ctx.close();
}

/* Keyboard focus on the primary action */
{
  const { ctx, p } = await open(1440, 900);
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press("Tab");
    await frame(p);
    const on = await p.evaluate(() => document.activeElement?.classList.contains("hero__action--primary"));
    if (on) break;
  }
  await p.waitForTimeout(250);
  console.log("  focused:", await p.evaluate(() => document.activeElement?.textContent?.trim()));
  await shot(p, "hero-focus-1440x900");
  await ctx.close();
}
await browser.close();
