import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";

/* Stage 06 behaviour audit: scenario switching, the flow state machine, timer
   cleanup, keyboard semantics, and the hard requirement that running the flow
   makes no network request of any kind.

   No frame-forcing screenshots during the run. Everything asserted here is DOM
   state driven by React, which updates whether or not the page paints, and a
   full-page screenshot costs over a second -- long enough to swallow the whole
   2.2s flow and make it look instantaneous. See qa/stage06-timing.mjs. */

const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const SCENARIOS = ["operations", "commerce", "field"];

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleErrors.push(`${m.type()}: ${m.text()}`); });
p.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const requests = [];
p.on("request", (r) => requests.push(r.url()));

await p.goto(BASE + "/#products", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await frame(p); await p.waitForTimeout(800); await frame(p);

const motion = await p.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
console.log(`prefers-reduced-motion in this browser: ${motion}`);

/* --- 1. Thirty scenario changes ---------------------------------------- */
let switchFailures = 0;
for (let i = 0; i < 30; i++) {
  const id = SCENARIOS[i % 3];
  await p.click(`#pscenario-tab-${id}`);
  const r = await p.evaluate((wanted) => {
    const tab = document.querySelector(`#pscenario-tab-${wanted}`);
    const panel = document.querySelector("#pstudio-panel");
    return {
      selected: tab.getAttribute("aria-selected") === "true",
      tabindex: tab.tabIndex === 0,
      others: [...document.querySelectorAll('.pscenario[aria-selected="false"]')].every((t) => t.tabIndex === -1),
      labelled: panel.getAttribute("aria-labelledby") === `pscenario-tab-${wanted}`,
      route: document.querySelector(".pweb__route").textContent,
      surfaces: !!document.querySelector(".pweb__frame") && !!document.querySelector(".pmob__device") && !!document.querySelector(".passist__panel"),
      // A scenario change must reset a run in progress, never leave it mid-flow.
      button: document.querySelector(".pstudio__run-label").textContent,
      live: document.querySelector('.pstudio [aria-live="polite"]').textContent,
    };
  }, id);
  const ok = r.selected && r.tabindex && r.others && r.labelled && r.surfaces && r.button === "Run product flow" && r.live === "";
  if (!ok) { switchFailures++; console.log(`  switch ${i} (${id}) FAIL ${JSON.stringify(r)}`); }
}
console.log(`\n30 scenario changes: ${pass(switchFailures === 0)} (${30 - switchFailures}/30 clean)`);

/* --- 2. Fifteen flow runs ----------------------------------------------- */
const reqBefore = requests.length;
let runFailures = 0;
const durations = [];
for (let i = 0; i < 15; i++) {
  const id = SCENARIOS[i % 3];
  await p.click(`#pscenario-tab-${id}`);

  const t0 = Date.now();
  await p.click(".pstudio__run");
  await p.waitForTimeout(700);

  const mid = await p.evaluate(() => ({
    label: document.querySelector(".pstudio__run-label").textContent,
    disabled: document.querySelector(".pstudio__run").disabled,
    lit: document.querySelectorAll(".pflow__node.is-active").length,
  }));

  /* Interval polling, not the default rAF: a headless page that is not
     painting starves rAF, which both delays detection and lets throttled
     interval callbacks fire in a burst afterwards. */
  await p.waitForFunction(() => document.querySelector(".pstudio__run-label").textContent === "Run again", null, { timeout: 8000, polling: 120 });
  const elapsed = Date.now() - t0;
  durations.push(elapsed);

  const end = await p.evaluate(() => ({
    label: document.querySelector(".pstudio__run-label").textContent,
    disabled: document.querySelector(".pstudio__run").disabled,
    live: document.querySelector('.pstudio [aria-live="polite"]').textContent,
    passed: document.querySelectorAll(".pflow__node.is-passed").length,
    synced: !!document.querySelector(".pmob__synced"),
    tag: document.querySelector(".pflow__tag").textContent,
  }));

  const midOk = mid.label === "Running…" && mid.disabled && mid.lit === 1;
  const ok = midOk && end.label === "Run again" && !end.disabled && end.live === "Product flow complete."
    && end.passed === 6 && end.synced && end.tag === "STATE / SETTLED";
  if (!ok) { runFailures++; console.log(`  run ${i} (${id}) FAIL mid=${JSON.stringify(mid)} end=${JSON.stringify(end)}`); }
}
const netDuringRuns = requests.length - reqBefore;
console.log(`15 flow runs: ${pass(runFailures === 0)} (${15 - runFailures}/15 clean)`);
/* Harness wall-clock, NOT the flow duration: it includes a 700ms mid-state
   read and interval polling granularity. The flow's real timing is measured
   in-page by qa/stage06-timing.mjs (~300ms per step, ~2.2s total). */
console.log(`  harness wall-clock per run min ${Math.min(...durations)}ms max ${Math.max(...durations)}ms (includes 700ms probe + polling)`);
console.log(`  network requests during 15 runs + 15 switches: ${netDuringRuns} ${pass(netDuringRuns === 0)}`);

/* --- 3. Timer cleanup: switch scenario mid-run -------------------------- */
await p.click("#pscenario-tab-operations");
await p.click(".pstudio__run");
await p.waitForTimeout(400);
await p.click("#pscenario-tab-field");
await p.waitForTimeout(2800);
const afterAbort = await p.evaluate(() => ({
  label: document.querySelector(".pstudio__run-label").textContent,
  live: document.querySelector('.pstudio [aria-live="polite"]').textContent,
  active: document.querySelectorAll(".pflow__node.is-active").length,
  passed: document.querySelectorAll(".pflow__node.is-passed").length,
  route: document.querySelector(".pweb__route").textContent,
}));
const abortOk = afterAbort.label === "Run product flow" && afterAbort.live === "" && afterAbort.active === 0
  && afterAbort.passed === 0 && afterAbort.route === "/app/dispatch";
console.log(`\nabandoned run leaves no stale state: ${pass(abortOk)} ${JSON.stringify(afterAbort)}`);

/* --- 4. Keyboard ------------------------------------------------------- */
await p.click("#pscenario-tab-operations");
await p.focus("#pscenario-tab-operations");
const keys = [];
for (const [key, expect] of [["ArrowRight", "commerce"], ["ArrowRight", "field"], ["ArrowRight", "operations"], ["ArrowLeft", "field"], ["Home", "operations"], ["End", "field"]]) {
  await p.keyboard.press(key);
  const r = await p.evaluate(() => ({
    sel: document.querySelector('.pscenario[aria-selected="true"]').id,
    focus: document.activeElement.id,
  }));
  const ok = r.sel === `pscenario-tab-${expect}` && r.focus === `pscenario-tab-${expect}`;
  keys.push(`${key}->${expect} ${ok ? "ok" : "FAIL " + JSON.stringify(r)}`);
}
console.log(`keyboard: ${keys.join(" | ")}`);

/* --- 5. Console -------------------------------------------------------- */
console.log(`\nconsole errors/warnings: ${consoleErrors.length ? consoleErrors.join(" | ") : "none"} ${pass(consoleErrors.length === 0)}`);

const total = switchFailures + runFailures + (abortOk ? 0 : 1) + (netDuringRuns === 0 ? 0 : 1) + (consoleErrors.length ? 1 : 0) + (keys.some((k) => k.includes("FAIL")) ? 1 : 0);
await browser.close();
console.log(`\n=== stage06 interaction: ${total === 0 ? "ALL PASS" : total + " FAILURE GROUP(S)"} ===`);
process.exit(total === 0 ? 0 : 1);
