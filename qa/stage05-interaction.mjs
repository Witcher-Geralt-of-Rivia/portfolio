import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3300";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: [
  "--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-background-timer-throttling",
] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text().slice(0,150)}`); });
page.on("pageerror", e => errors.push("pageerror: " + e.message.slice(0,150)));
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await frame(page); await page.waitForTimeout(1200);

const MODES = ["Agent Workflow", "Automation", "CRM / ERP", "SaaS Backend"];

console.log("=== MODE CONTENT ===");
for (const label of MODES) {
  await page.click(`[role="tab"]:has-text("${label}")`);
  await frame(page); await page.waitForTimeout(650); await frame(page);
  const s = await page.evaluate(() => ({
    nodes: document.querySelectorAll(".arch-canvas .arch-node").length,
    links: document.querySelectorAll(".arch-link").length,
    packets: document.querySelectorAll(".arch-packet").length,
    trace: document.querySelectorAll(".arch-trace__row").length,
    selected: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
    panelLabelledBy: document.getElementById("arch-panel")?.getAttribute("aria-labelledby"),
    summary: document.querySelector("#arch-panel .visually-hidden")?.textContent?.slice(0, 46),
  }));
  console.log(`  ${label.padEnd(15)} nodes=${s.nodes} links=${s.links} packets=${s.packets} trace=${s.trace} selected="${s.selected}"`);
  console.log(`      panel labelled by ${s.panelLabelledBy} | summary "${s.summary}..."`);
}

console.log("\n=== PANEL HEIGHT STABILITY ACROSS MODES ===");
const heights = [];
for (const label of MODES) {
  await page.click(`[role="tab"]:has-text("${label}")`);
  await frame(page); await page.waitForTimeout(600);
  heights.push(await page.evaluate(() => Math.round(document.querySelector(".arch-lab").getBoundingClientRect().height)));
}
console.log(`  panel heights: ${heights.join(", ")}  spread=${Math.max(...heights) - Math.min(...heights)}px ${pass(Math.max(...heights) - Math.min(...heights) <= 1)}`);

console.log("\n=== 20 MODE TRANSITIONS ===");
await page.evaluate(() => { window.__cls = 0;
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
for (let i = 0; i < 20; i++) {
  await page.click(`[role="tab"]:has-text("${MODES[i % 4]}")`);
  await frame(page);
  await page.waitForTimeout(180);
}
await page.waitForTimeout(700); await frame(page);
const after = await page.evaluate(() => ({
  nodes: document.querySelectorAll(".arch-canvas .arch-node").length,
  links: document.querySelectorAll(".arch-link").length,
  trace: document.querySelectorAll(".arch-trace__row").length,
  selected: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
  selectedCount: document.querySelectorAll('[role="tab"][aria-selected="true"]').length,
  cls: +(window.__cls || 0).toFixed(4),
}));
console.log(`  after 20 switches: nodes=${after.nodes} links=${after.links} trace=${after.trace} selected="${after.selected}"`);
console.log(`  exactly one tab selected: ${pass(after.selectedCount === 1)}   no residue: ${pass(after.nodes > 0 && after.links > 0 && after.trace === 8)}`);
console.log(`  CLS across 20 transitions: ${after.cls} ${pass(after.cls < 0.01)}`);
console.log(`  console errors/warnings: ${errors.length ? errors.slice(0,4) : "none"}`);
await browser.close();
