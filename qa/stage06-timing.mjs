import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";

/* Measures the flow state machine from INSIDE the page. No screenshots are
   taken during the run: forcing frames from the harness perturbs headless
   timer scheduling, which is what made the flow look instantaneous. */

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(BASE + "/#products", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ type: "jpeg", quality: 20 });
await p.waitForTimeout(800);
await p.screenshot({ type: "jpeg", quality: 20 });

for (let run = 0; run < 3; run++) {
  const r = await p.evaluate(() => new Promise((resolve) => {
    const stage = document.querySelector(".pstudio__stage");
    const btn = document.querySelector(".pstudio__run");
    const marks = [];
    const t0 = performance.now();
    /* Watch the footer, not just the stage line: the final commit sets
       stepIndex to the value it already held, so the stage text does not
       change and an observer bound to it never sees completion. */
    const foot = stage.closest(".pstudio__foot");
    let last = "";
    const obs = new MutationObserver(() => {
      const text = stage.textContent;
      if (text !== last) { last = text; marks.push({ t: Math.round(performance.now() - t0), text }); }
      if (document.querySelector(".pstudio__run-label").textContent === "Run again") {
        obs.disconnect();
        resolve({ marks, total: Math.round(performance.now() - t0) });
      }
    });
    obs.observe(foot, { childList: true, subtree: true, characterData: true });
    btn.click();
    setTimeout(() => { obs.disconnect(); resolve({ marks, total: -1, timedOut: true }); }, 9000);
  }));
  console.log(`\nrun ${run}: total ${r.total}ms${r.timedOut ? " (TIMED OUT)" : ""}`);
  for (const m of r.marks) console.log(`   ${String(m.t).padStart(5)}ms  ${m.text}`);
  await p.waitForTimeout(400);
}

await browser.close();
