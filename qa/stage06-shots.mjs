import { chromium } from "playwright";

const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});

async function shoot(name, { w, h, scenario, run, runToStage, wait = 0 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.querySelector("#products").scrollIntoView({ block: "start" }));
  await frame(p); await p.waitForTimeout(600); await frame(p);

  if (scenario) { await p.click(`#pscenario-tab-${scenario}`); await frame(p); await p.waitForTimeout(500); await frame(p); }
  await p.addStyleTag({ content: ".site-nav { display: none !important; } nextjs-portal { display: none !important; }" });
  await frame(p); await p.waitForTimeout(150); await frame(p);

  /* An element screenshot costs over a second, so a fixed wait lands after the
     ~2.2s flow has already settled. Capture is triggered off the flow's own
     state instead: wait for the rail to light the requested stage. */
  if (run) {
    await p.click(".pstudio__run");
    if (typeof runToStage === "number") {
      await p.waitForFunction((n) => {
        const nodes = [...document.querySelectorAll(".pflow__node")];
        return nodes.findIndex((el) => el.classList.contains("is-active")) >= n;
      }, runToStage, { timeout: 6000, polling: 20 });
    } else {
      await p.waitForFunction(() => document.querySelector(".pstudio__run-label").textContent === "Run again", null, { timeout: 9000, polling: 60 });
      await p.waitForTimeout(wait);
    }
  }

  /* Two overlays are removed for the capture only. The site navigation is
     position:fixed and would paint across the middle of the section; the nav
     itself is unchanged and covered by Stage 03 QA. <nextjs-portal> is the
     dev-tools indicator, which exists only under `next dev` and never in the
     production build. Neither is part of Stage 06. */
  const el = await p.$(".products");
  await el.screenshot({ path: `qa/shots/stage06/${name}.png` });
  console.log(`shot ${name}`);
  await ctx.close();
}

await shoot("01-desktop-operations", { w: 1440, h: 900 });
await shoot("02-desktop-commerce", { w: 1440, h: 900, scenario: "commerce" });
await shoot("03-desktop-field-running", { w: 1440, h: 900, scenario: "field", run: true, runToStage: 1 });
await shoot("04-desktop-complete", { w: 1440, h: 900, run: true, wait: 300 });
await shoot("05-tablet", { w: 1024, h: 768 });
await shoot("06-mobile", { w: 390, h: 844 });

await browser.close();
