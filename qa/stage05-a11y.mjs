import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3300";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-background-timer-throttling",
] });

/* ---- keyboard + detail strip ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(1000);

  console.log("=== TABLIST KEYBOARD ===");
  await p.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]').focus());
  const seq = [];
  for (const key of ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "Home", "End", "ArrowLeft"]) {
    await p.keyboard.press(key);
    await frame(p); await p.waitForTimeout(200);
    seq.push(`${key}->${await p.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim())}`);
  }
  console.log("  " + seq.join("  |  "));
  const roving = await p.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    return { total: tabs.length, tabbable: tabs.filter(t => t.tabIndex === 0).length,
             focusFollows: document.activeElement?.getAttribute("role") === "tab" };
  });
  console.log(`  roving tabindex: ${roving.tabbable}/${roving.total} tabbable ${pass(roving.tabbable === 1)}   focus follows selection ${pass(roving.focusFollows)}`);

  console.log("\n=== NODE FOCUS + DETAIL STRIP ===");
  await p.evaluate(() => document.querySelector('[role="tab"]').click());
  await frame(p); await p.waitForTimeout(500);
  const before = await p.evaluate(() => document.getElementById("arch-detail")?.textContent?.trim().slice(0, 40));
  await p.evaluate(() => document.querySelectorAll(".arch-canvas .arch-node")[2]?.focus());
  await frame(p); await p.waitForTimeout(400);
  const focused = await p.evaluate(() => ({
    active: document.activeElement?.textContent?.trim().replace(/\s+/g, " "),
    detail: document.getElementById("arch-detail")?.textContent?.trim(),
    describedBy: document.activeElement?.getAttribute("aria-describedby"),
    outline: getComputedStyle(document.activeElement).outlineWidth,
    dimmedOthers: document.querySelectorAll(".arch-node.is-dimmed").length,
    tag: document.activeElement?.tagName,
  }));
  console.log(`  before focus: "${before}"`);
  console.log(`  focused node: "${focused.active}" <${focused.tag}> aria-describedby=${focused.describedBy}`);
  console.log(`  detail strip: "${focused.detail}"`);
  console.log(`  strip updated ${pass(focused.detail !== before)}   focus ring ${focused.outline} ${pass(parseFloat(focused.outline) >= 2)}   others dimmed=${focused.dimmedOthers}`);

  const tabOrder = [];
  await p.evaluate(() => document.querySelector(".arch-canvas .arch-node")?.focus());
  for (let i = 0; i < 5; i++) {
    tabOrder.push(await p.evaluate(() => document.activeElement?.querySelector(".arch-node__label")?.textContent ?? "?"));
    await p.keyboard.press("Tab"); await frame(p); await p.waitForTimeout(120);
  }
  console.log(`  node tab order follows flow: ${tabOrder.join(" -> ")}`);
  await ctx.close();
}

/* ---- reduced motion ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await frame(p); await p.waitForTimeout(900);
  console.log("\n=== REDUCED MOTION ===");
  const r = await p.evaluate(() => {
    const node = document.querySelector(".arch-canvas .arch-node");
    const packet = document.querySelector(".arch-packet");
    const row = document.querySelector(".arch-trace__row");
    return {
      running: document.getAnimations().filter(a => a.playState === "running").length,
      nodeAnim: getComputedStyle(node).animationName,
      packetAnim: getComputedStyle(packet).animationName,
      packetDistance: getComputedStyle(packet).offsetDistance,
      rowDelay: getComputedStyle(row).animationDelay,
      nodesVisible: [...document.querySelectorAll(".arch-canvas .arch-node")].every(n => getComputedStyle(n).opacity !== "0"),
      linksVisible: document.querySelectorAll(".arch-link").length,
      traceVisible: document.querySelectorAll(".arch-trace__row").length,
    };
  });
  console.log(`  running animations: ${r.running} ${pass(r.running === 0)}`);
  console.log(`  node animation: ${r.nodeAnim} | packet: ${r.packetAnim} at ${r.packetDistance} | trace delay: ${r.rowDelay}`);
  console.log(`  everything still visible: nodes ${pass(r.nodesVisible)} links=${r.linksVisible} trace=${r.traceVisible}`);
  await p.click('[role="tab"]:has-text("Automation")');
  await frame(p); await p.waitForTimeout(400);
  const after = await p.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim());
  console.log(`  mode switching still works: "${after}" ${pass(after === "Automation")}`);
  await ctx.close();
}
await browser.close();
