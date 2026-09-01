import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const HIDE = ".site-nav { display: none !important; } nextjs-portal { display: none !important; }";

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});

async function shoot(name, { w, h, scenario, adapt }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: HIDE });
  await frame(p); await p.waitForTimeout(700); await frame(p);

  if (scenario) {
    await p.click(`#lscenario-tab-${scenario}`);
    await frame(p); await p.waitForTimeout(450); await frame(p);
  }
  if (adapt) {
    await p.click(".llab__run");
    await p.waitForTimeout(700);
    await frame(p);
  }

  const clip = await p.evaluate(() => {
    const r = document.querySelector(".learning").getBoundingClientRect();
    return { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
  });
  await p.screenshot({ path: `qa/shots/stage07/${name}.png`, clip, fullPage: true, animations: "allow" });
  console.log(`shot ${name}`);
  await ctx.close();
}

await shoot("learning-tutor-1440x900", { w: 1440, h: 900 });
await shoot("learning-assessment-1440x900", { w: 1440, h: 900, scenario: "assessment" });
await shoot("learning-path-1440x900", { w: 1440, h: 900, scenario: "path" });
await shoot("learning-adapt-active-1440x900", { w: 1440, h: 900, adapt: true });
await shoot("learning-mobile-390x844", { w: 390, h: 844 });

await browser.close();
