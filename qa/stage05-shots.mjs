import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3300";
const OUT = "qa/shots/stage05";
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-background-timer-throttling",
] });

async function open(w, h, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p);
  await p.waitForTimeout(1200);
  return { ctx, p };
}
/* Centre the architecture panel in the viewport. Judging this section from a
   page-top screenshot would show the heading and cut off the diagram. */
async function focusSection(p) {
  await p.evaluate(() => {
    const panel = document.querySelector(".arch-lab");
    const r = panel.getBoundingClientRect();
    const target = r.top + scrollY - Math.max(24, (innerHeight - r.height) / 2);
    window.scrollTo({ top: Math.max(0, target), behavior: "instant" });
  });
  await frame(p);
  await p.waitForTimeout(700);
  await frame(p);
}
const shot = async (p, name) => {
  await p.screenshot({ path: `${OUT}/${name}.png`, type: "png", timeout: 90000 });
  console.log("  wrote", name + ".png");
};

/* 1. Agent Workflow (default) at 1440x900 */
{
  const { ctx, p } = await open(1440, 900);
  await focusSection(p);
  await shot(p, "systems-agent-1440x900");
  await ctx.close();
}
/* 2. CRM / ERP mode at 1440x900 */
{
  const { ctx, p } = await open(1440, 900);
  await focusSection(p);
  await p.click('[role="tab"]:has-text("CRM / ERP")');
  await frame(p); await p.waitForTimeout(900); await frame(p);
  await shot(p, "systems-crm-1440x900");
  await ctx.close();
}
/* 3. Mobile */
{
  const { ctx, p } = await open(390, 844);
  await focusSection(p);
  await shot(p, "systems-mobile-390x844");
  await ctx.close();
}
/* 4. Keyboard focus on a node */
{
  const { ctx, p } = await open(1440, 900);
  await focusSection(p);
  await p.evaluate(() => {
    const n = document.querySelectorAll(".arch-canvas .arch-node")[3];
    n?.focus();
  });
  await frame(p); await p.waitForTimeout(600); await frame(p);
  console.log("  focused:", await p.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 30)));
  await shot(p, "systems-focus-1440x900");
  await ctx.close();
}
/* 5. Reduced motion */
{
  const { ctx, p } = await open(1440, 900, { reducedMotion: "reduce" });
  await focusSection(p);
  await shot(p, "systems-reduced-motion-1440x900");
  await ctx.close();
}
await browser.close();
