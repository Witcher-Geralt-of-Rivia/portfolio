import { chromium } from "playwright";
const pass = (b) => (b ? "PASS" : "FAIL");
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
] });

for (const [w, h] of [[768, 1024], [390, 844], [360, 800]]) {
  console.log(`\n================= ${w}x${h} =================`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
  page.on("requestfailed", r => failed.push(r.url().split("/").pop()));
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  const closed = await page.evaluate(() => {
    const bar = document.querySelector(".site-nav__bar");
    const btn = document.querySelector(".site-nav__toggle");
    const desk = document.querySelector(".site-nav__desktop");
    const wm = document.querySelector(".site-nav__bar .site-nav__wordmark");
    const br = bar.getBoundingClientRect(), btr = btn.getBoundingClientRect();
    return {
      barTop: Math.round(br.top), barLeft: Math.round(br.left),
      barW: Math.round(br.width), barH: Math.round(br.height),
      barRadius: getComputedStyle(bar).borderRadius,
      barZ: getComputedStyle(bar).zIndex,
      btnW: Math.round(btr.width), btnH: Math.round(btr.height),
      desktopShown: getComputedStyle(desk).display !== "none",
      ariaExpanded: btn.getAttribute("aria-expanded"),
      ariaControls: btn.getAttribute("aria-controls"),
      ariaLabel: btn.getAttribute("aria-label"),
      wordmark: wm.textContent,
      wordmarkFits: wm.scrollWidth <= wm.clientWidth + 1,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  console.log(`  bar: ${closed.barW}x${closed.barH} at (${closed.barLeft},${closed.barTop}) radius=${closed.barRadius} z=${closed.barZ}`);
  console.log(`  toggle ${closed.btnW}x${closed.btnH}  desktopNavShown=${closed.desktopShown}  wordmark="${closed.wordmark}" fits=${closed.wordmarkFits}`);
  console.log(`  aria-expanded=${closed.ariaExpanded} aria-controls=${closed.ariaControls} label="${closed.ariaLabel}"`);
  console.log(`  horizontal overflow: ${pass(!closed.overflow)}    desktop nav hidden: ${pass(!closed.desktopShown)}    touch target >=40: ${pass(closed.btnW >= 40 && closed.btnH >= 40)}`);

  const widthBefore = closed.clientWidth;
  await page.click(".site-nav__toggle");
  // Headless Chromium only advances CSS transitions when frames are
  // produced; a screenshot forces one, so this measures the settled panel
  // rather than a frame frozen mid-scale.
  await page.waitForTimeout(200);
  await page.screenshot({ type: "jpeg", quality: 20 });
  await page.waitForTimeout(400);
  await page.screenshot({ type: "jpeg", quality: 20 });
  const opened = await page.evaluate(() => {
    const panel = document.querySelector(".site-nav__panel");
    const btn = document.querySelector(".site-nav__toggle");
    const pr = panel.getBoundingClientRect();
    const items = [...document.querySelectorAll(".site-nav__panel-item")];
    const links = [...document.querySelectorAll(".site-nav__panel-link")];
    const labels = [...document.querySelectorAll(".site-nav__panel-label")];
    return {
      panelX: Math.round(pr.left), panelY: Math.round(pr.top),
      panelW: Math.round(pr.width), panelH: Math.round(pr.height),
      panelBottomGap: Math.round(innerHeight - pr.bottom),
      panelRadius: getComputedStyle(panel).borderRadius,
      ariaExpanded: btn.getAttribute("aria-expanded"),
      ariaLabel: btn.getAttribute("aria-label"),
      itemHeights: items.map(i => Math.round(i.getBoundingClientRect().height)),
      allLinksVisible: links.every(l => { const r = l.getBoundingClientRect(); return r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1; }),
      labelLines: labels.map(l => Math.round(l.getBoundingClientRect().height / parseFloat(getComputedStyle(l).lineHeight))),
      labelFont: getComputedStyle(labels[0]).fontSize,
      focusInPanel: panel.contains(document.activeElement),
      focusedText: document.activeElement ? document.activeElement.textContent.trim().slice(0, 24) : "",
      bodyLocked: document.body.classList.contains("nav-locked"),
      clientWidth: document.documentElement.clientWidth,
    };
  });
  console.log(`  panel: ${opened.panelW}x${opened.panelH} at (${opened.panelX},${opened.panelY}) radius=${opened.panelRadius} bottomGap=${opened.panelBottomGap}px`);
  console.log(`  item heights: ${opened.itemHeights.join(", ")}   labelFont=${opened.labelFont}   labelLines=${opened.labelLines.join(",")}`);
  console.log(`  all 5 links inside panel: ${pass(opened.allLinksVisible)}`);
  console.log(`  aria-expanded=${opened.ariaExpanded} label="${opened.ariaLabel}"   focus into panel: ${pass(opened.focusInPanel)} ("${opened.focusedText}")`);
  console.log(`  scroll lock: ${pass(opened.bodyLocked)}   layout width unchanged: ${pass(opened.clientWidth === widthBefore)} (${widthBefore} -> ${opened.clientWidth})`);
  await ctx.close();
}
await browser.close();
