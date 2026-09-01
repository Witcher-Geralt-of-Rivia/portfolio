import { chromium } from "playwright";

/* Stage 08 screenshot set, captured with page.screenshot({ clip }).
   elementHandle.screenshot() waits for the element to be "stable" first, which
   times out on a section that animates - see QA_BASELINE. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const HIDE = ".site-nav { display: none !important; } nextjs-portal { display: none !important; }";

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});

async function shoot(name, { w, h, experiment, variant, run }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: HIDE });
  await frame(p); await p.waitForTimeout(700); await frame(p);

  if (experiment) {
    await p.click(`#lexp-tab-${experiment}`);
    await frame(p); await p.waitForTimeout(400); await frame(p);
  }
  if (variant) {
    await p.click(`.lvariant:nth-child(${variant})`);
    await p.waitForTimeout(300);
  }
  if (run) {
    await p.click(".lab__run");
    // Settled state: the running frames are asserted, not photographed.
    await p.waitForFunction(
      () => !document.querySelector(".lab__run").disabled,
      null, { timeout: 12000, polling: 100 }
    );
    await frame(p); await p.waitForTimeout(350); await frame(p);
  }

  const clip = await p.evaluate(() => {
    const r = document.querySelector(".lab").getBoundingClientRect();
    return { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
  });
  await p.screenshot({ path: `qa/shots/stage08/${name}.png`, clip, fullPage: true, animations: "allow" });
  console.log(`shot ${name}`);
  await ctx.close();
}

await shoot("lab-api-1440x900", { w: 1440, h: 900, experiment: "api", run: true });
await shoot("lab-webhook-1440x900", { w: 1440, h: 900, experiment: "webhook", variant: 2, run: true });
await shoot("lab-queue-1440x900", { w: 1440, h: 900, experiment: "queue", run: true });
await shoot("lab-idempotency-1440x900", { w: 1440, h: 900, experiment: "idempotency", run: true });
await shoot("lab-mobile-390x844", { w: 390, h: 844, experiment: "ratelimit", run: true });

await browser.close();
