import { chromium } from "playwright";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
] });

for (const [w, h] of [[390, 844], [360, 800]]) {
  console.log(`\n=========== INTERACTION ${w}x${h} ===========`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
  page.on("pageerror", e => errors.push("pageerror: " + e.message.slice(0, 120)));
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // underlying page must not scroll while open
  await page.click(".site-nav__toggle");
  await frame(page); await page.waitForTimeout(350); await frame(page);
  // A real wheel gesture is the thing a scroll lock must stop. Scripted
  // scrollTo() intentionally still moves an overflow:hidden viewport, so
  // testing with it would prove nothing.
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(w / 2, h / 2);
  await page.mouse.wheel(0, 1200);
  await frame(page);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => scrollY);
  console.log(`  wheel gesture blocked while open : ${pass(after === before)} (${before} -> ${after})`);

  // and scrolling works again once closed
  await page.keyboard.press("Escape");
  await frame(page); await page.waitForTimeout(350);
  await page.mouse.wheel(0, 600);
  await frame(page);
  await page.waitForTimeout(300);
  const restored = await page.evaluate(() => scrollY);
  console.log(`  scrolling restored after close   : ${pass(restored > 0)} (0 -> ${restored})`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.click(".site-nav__toggle");
  await frame(page); await page.waitForTimeout(350); await frame(page);

  // focus trap
  await page.evaluate(() => {
    const l = [...document.querySelectorAll(".site-nav__panel-link")];
    l[l.length - 1].focus();
  });
  await page.keyboard.press("Tab");
  const fwd = await page.evaluate(() => document.activeElement.className);
  await page.keyboard.press("Tab");
  const fwd2 = await page.evaluate(() => document.activeElement.textContent.trim().slice(0, 14));
  console.log(`  Tab from last link  -> ${fwd.includes("toggle") ? "menu trigger" : fwd} ${pass(fwd.includes("toggle"))}`);
  console.log(`  Tab again wraps in  -> "${fwd2}" ${pass(fwd2.includes("Systems"))}`);
  await page.evaluate(() => document.querySelector(".site-nav__toggle").focus());
  await page.keyboard.press("Shift+Tab");
  const back = await page.evaluate(() => document.activeElement.textContent.trim().slice(0, 14));
  console.log(`  Shift+Tab from trigger -> "${back}" ${pass(back.includes("Work"))}`);

  // escape
  await page.keyboard.press("Escape");
  await frame(page); await page.waitForTimeout(350); await frame(page);
  const esc = await page.evaluate(() => ({
    expanded: document.querySelector(".site-nav__toggle").getAttribute("aria-expanded"),
    vis: getComputedStyle(document.querySelector(".site-nav__panel")).visibility,
    label: document.querySelector(".site-nav__toggle").getAttribute("aria-label"),
    focusOnToggle: document.activeElement === document.querySelector(".site-nav__toggle"),
    locked: document.body.classList.contains("nav-locked"),
    inert: document.querySelector(".site-nav__panel").hasAttribute("inert"),
  }));
  console.log(`  Escape closes: ${pass(esc.expanded === "false" && esc.vis === "hidden")}  focus returned: ${pass(esc.focusOnToggle)}  unlocked: ${pass(!esc.locked)}  panel inert: ${pass(esc.inert)}  label="${esc.label}"`);

  // closing by choosing a destination
  await page.click(".site-nav__toggle");
  await frame(page); await page.waitForTimeout(350);
  await page.locator(".site-nav__panel-link").nth(2).click();
  await frame(page); await page.waitForTimeout(500);
  const nav = await page.evaluate(() => ({
    expanded: document.querySelector(".site-nav__toggle").getAttribute("aria-expanded"),
    locked: document.body.classList.contains("nav-locked"),
    hash: location.hash,
  }));
  console.log(`  choosing a destination closes: ${pass(nav.expanded === "false" && !nav.locked)}  hash=${nav.hash}`);

  // toggle button closes it too
  await page.click(".site-nav__toggle");
  await frame(page); await page.waitForTimeout(300);
  await page.click(".site-nav__toggle");
  await frame(page); await page.waitForTimeout(350);
  const t = await page.evaluate(() => document.querySelector(".site-nav__toggle").getAttribute("aria-expanded"));
  console.log(`  trigger toggles closed: ${pass(t === "false")}`);
  console.log(`  console errors: ${errors.length ? errors.join(" | ") : "none"}`);
  await ctx.close();
}
await browser.close();
