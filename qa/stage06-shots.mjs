import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";

/* Stage 06 screenshot set.
   Every capture is page.screenshot({ clip }). elementHandle.screenshot() waits
   for the element to be "stable" first, which times out on a section that is
   animating.

   There is deliberately no mid-flow screenshot. Capturing one is not reliable
   here: a full-page clip is composited slowly enough that the run settles
   during the capture, producing a frame that shows a lit stage next to a
   "Run again" button - a state the application never actually renders. The
   running state is verified by assertion instead, in stage06-interaction.mjs:
   label "Running...", button disabled, exactly one rail node lit, 15/15 runs. */

const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const HIDE = ".site-nav { display: none !important; } nextjs-portal { display: none !important; }";

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});

async function shoot(name, { w, h, scenario, run, wait = 0 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);

  /* Both overlays are removed for the capture only. The site navigation is
     position:fixed and would paint across the middle of the section; it is
     unchanged and covered by Stage 03 QA. <nextjs-portal> is the dev-tools
     indicator, which exists only under `next dev`, never in production. */
  await p.addStyleTag({ content: HIDE });
  await frame(p); await p.waitForTimeout(700); await frame(p);

  if (scenario) {
    await p.click(`#pscenario-tab-${scenario}`);
    await frame(p); await p.waitForTimeout(450); await frame(p);
  }

  if (run) {
    await p.click(".pstudio__run");
    await p.waitForFunction(() => document.querySelector(".pstudio__run-label").textContent === "Run again", null, { timeout: 9000, polling: 60 });
    await p.waitForTimeout(wait);
    await frame(p); await p.waitForTimeout(200); await frame(p);
  }

  const clip = await p.evaluate(() => {
    const r = document.querySelector(".products").getBoundingClientRect();
    return { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY),
             width: Math.round(r.width), height: Math.round(r.height) };
  });

  await p.screenshot({ path: `qa/shots/stage06/${name}.png`, clip, fullPage: true, animations: "allow" });
  console.log(`shot ${name}`);
  await ctx.close();
}

await shoot("01-desktop-operations", { w: 1440, h: 900 });
await shoot("02-desktop-commerce", { w: 1440, h: 900, scenario: "commerce" });
await shoot("03-desktop-field", { w: 1440, h: 900, scenario: "field" });
await shoot("04-desktop-complete", { w: 1440, h: 900, run: true, wait: 250 });
await shoot("05-tablet", { w: 1024, h: 768 });
await shoot("06-mobile", { w: 390, h: 844 });

await browser.close();
