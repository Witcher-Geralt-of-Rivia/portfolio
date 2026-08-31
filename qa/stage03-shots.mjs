import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const OUT = "qa/shots/stage03";
const URL = BASE + "/";
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
] });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, type: "png" });
  console.log("  wrote", name + ".png");
}
async function open(page, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1200);
  return { ctx, p };
}

/* desktop */
{
  const { ctx, p } = await open(browser, 1920, 1080);
  await shot(p, "desktop-top-1920x1080");
  await p.evaluate(() => { const e = document.getElementById("ai-learning"); window.scrollTo({ top: e.getBoundingClientRect().top + scrollY + e.offsetHeight * 0.4, behavior: "instant" }); });
  await frame(p); await p.waitForTimeout(400); await frame(p);
  await shot(p, "desktop-scrolled-1920x1080");
  await ctx.close();
}
{
  const { ctx, p } = await open(browser, 1440, 900);
  await shot(p, "desktop-1440x900");
  /* keyboard focus: tab until a nav link has focus */
  for (let i = 0; i < 6; i++) {
    await p.keyboard.press("Tab");
    const onLink = await p.evaluate(() => document.activeElement?.classList.contains("site-nav__link"));
    if (onLink) break;
  }
  await frame(p); await p.waitForTimeout(250);
  const focused = await p.evaluate(() => document.activeElement?.textContent?.trim());
  console.log("  focus ring on:", focused);
  await shot(p, "keyboard-focus-1440x900");
  await ctx.close();
}
{
  const { ctx, p } = await open(browser, 1366, 768);
  await shot(p, "laptop-1366x768");
  await ctx.close();
}

/* tablet + mobile, closed then open */
for (const [w, h, label] of [[768, 1024, "tablet"], [390, 844, "mobile"], [360, 800, "mobile"]]) {
  const { ctx, p } = await open(browser, w, h);
  await shot(p, `${label}-closed-${w}x${h}`);
  await p.click(".site-nav__toggle");
  await frame(p); await p.waitForTimeout(400); await frame(p);
  await shot(p, `${label}-open-${w}x${h}`);
  await ctx.close();
}
await browser.close();
