import { chromium } from "playwright";

/* Stage 07 behaviour audit: scenario switching, the adapt state machine, timer
   cleanup, cancellation, keyboard semantics, and the hard requirement that
   nothing here touches the network.

   No frame-forcing screenshots during a run, and interval polling rather than
   the default rAF: both are recorded traps in QA_BASELINE. A full-page capture
   costs over a second and would swallow the 1.7s sequence; a headless page
   that is not painting starves rAF and lets throttled timers fire in a burst. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const pass = (b) => (b ? "PASS" : "FAIL");
const SCENARIOS = ["tutor", "assessment", "path"];
const ACTIONS = {
  tutor: { idle: "Adapt next step", done: "Path updated", again: "Adapt again" },
  assessment: { idle: "Adapt next step", done: "Rubric updated", again: "Adapt again" },
  path: { idle: "Adapt path", done: "Path updated", again: "Adapt again" },
};

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

const consoleIssues = [];
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleIssues.push(`${m.type()}: ${m.text()}`); });
p.on("pageerror", (e) => consoleIssues.push(`pageerror: ${e.message}`));
const requests = [];
p.on("request", (r) => requests.push(r.url()));

await p.goto(BASE + "/#ai-learning", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ type: "jpeg", quality: 20 });
await p.waitForTimeout(900);

const read = () => p.evaluate(() => ({
  label: document.querySelector(".llab__run-label").textContent,
  disabled: document.querySelector(".llab__run").disabled,
  selected: document.querySelector('.lscenario[aria-selected="true"]').id,
  panelLabelledBy: document.querySelector("#llab-panel").getAttribute("aria-labelledby"),
  live: document.querySelector('.llab [aria-live="polite"]').textContent,
  current: document.querySelectorAll(".ljstep.is-current").length,
  currentStep: (document.querySelector(".ljstep.is-current .ljstep__label") || {}).textContent || null,
  route: document.querySelectorAll(".lmap__link.is-route").length,
  signals: document.querySelectorAll(".lmap__signal").length,
  summary: (document.querySelector("#llab-panel .visually-hidden") || {}).textContent || "",
  tutorBrief: document.querySelector(".ltutor__brief").textContent,
  tag: document.querySelector(".ljourney__tag").textContent,
}));

/* --- 1. Thirty scenario changes ---------------------------------------- */
let switchFail = 0;
const seenSummaries = new Set();
for (let i = 0; i < 30; i++) {
  const id = SCENARIOS[i % 3];
  await p.click(`#lscenario-tab-${id}`);
  const r = await read();
  const tabOk = r.selected === `lscenario-tab-${id}` && r.panelLabelledBy === `lscenario-tab-${id}`;
  const rovingOk = await p.evaluate(() =>
    [...document.querySelectorAll('.lscenario[aria-selected="false"]')].every((t) => t.tabIndex === -1) &&
    document.querySelector('.lscenario[aria-selected="true"]').tabIndex === 0
  );
  // A scenario change must reset the control and leave no stale announcement.
  const cleanOk = r.label === ACTIONS[id].idle && r.live === "" && r.current === 1 && r.signals <= 2;
  seenSummaries.add(r.summary);
  if (!(tabOk && rovingOk && cleanOk)) {
    switchFail++;
    if (switchFail <= 3) console.log(`  switch ${i} (${id}) FAIL ${JSON.stringify(r)}`);
  }
}
console.log(`30 scenario changes: ${pass(switchFail === 0)} (${30 - switchFail}/30 clean)`);
console.log(`  distinct accessible summaries seen: ${seenSummaries.size} ${pass(seenSummaries.size >= 3)}`);

/* --- 2. Twenty adapt runs ---------------------------------------------- */
const reqBefore = requests.length;
let runFail = 0;
for (let i = 0; i < 20; i++) {
  const id = SCENARIOS[i % 3];
  await p.click(`#lscenario-tab-${id}`);
  await p.waitForTimeout(120);
  const before = await read();

  await p.click(".llab__run");
  await p.waitForTimeout(500);
  const mid = await read();

  await p.waitForFunction(
    (done) => document.querySelector(".llab__run-label").textContent === done,
    ACTIONS[id].done, { timeout: 8000, polling: 100 }
  );
  const done = await read();

  await p.waitForFunction(
    (again) => document.querySelector(".llab__run-label").textContent === again,
    ACTIONS[id].again, { timeout: 8000, polling: 100 }
  );
  const settled = await read();

  const midOk = mid.label === "Adapting…" && mid.disabled && mid.tag === "STATE / ADAPTING";
  const doneOk = done.live === "Learning path updated." && !done.disabled;
  const settledOk = settled.label === ACTIONS[id].again && settled.tag === "STATE / SETTLED";
  // The adaptation has to actually change something observable.
  const changed = settled.currentStep !== before.currentStep || settled.tutorBrief !== before.tutorBrief;
  if (!(midOk && doneOk && settledOk && changed)) {
    runFail++;
    if (runFail <= 3) console.log(`  run ${i} (${id}) FAIL mid=${JSON.stringify(mid)} settled=${JSON.stringify(settled)}`);
  }
}
const netDuring = requests.length - reqBefore;
console.log(`20 adapt runs: ${pass(runFail === 0)} (${20 - runFail}/20 clean)`);
console.log(`  network requests during 20 runs + 20 switches: ${netDuring} ${pass(netDuring === 0)}`);

/* --- 3. Cancellation: switch scenario mid-sequence ---------------------- */
await p.click("#lscenario-tab-tutor");
await p.waitForTimeout(150);
await p.click(".llab__run");
await p.waitForTimeout(400);
await p.click("#lscenario-tab-path");
await p.waitForTimeout(2600);
const cancelled = await read();
const cancelOk =
  cancelled.label === ACTIONS.path.idle && cancelled.live === "" &&
  cancelled.selected === "lscenario-tab-path" && cancelled.tag === "STATE / SETTLED";
console.log(`\ncancelled sequence leaves no stale state: ${pass(cancelOk)} ${JSON.stringify(cancelled)}`);

/* --- 4. Re-entrancy: the button cannot start a second sequence ---------- */
await p.click("#lscenario-tab-tutor");
await p.waitForTimeout(150);
await p.click(".llab__run");
await p.waitForTimeout(300);
const doubleDisabled = await p.evaluate(() => document.querySelector(".llab__run").disabled);
await p.waitForFunction(() => document.querySelector(".llab__run-label").textContent === "Adapt again", null, { timeout: 8000, polling: 100 });
console.log(`button is inert while running: ${pass(doubleDisabled)}`);

/* --- 5. Unmount: timers must not survive the section being torn down ---- */
await p.click(".llab__run");
await p.waitForTimeout(300);
const unmountClean = await p.evaluate(() => new Promise((resolve) => {
  const errors = [];
  const onError = (e) => errors.push(String(e.message || e));
  window.addEventListener("error", onError);
  document.querySelector("#ai-learning").remove();
  setTimeout(() => {
    window.removeEventListener("error", onError);
    resolve(errors.length === 0 ? "no error after unmount" : errors.join(" | "));
  }, 2600);
}));
console.log(`unmount during a run: ${unmountClean} ${pass(unmountClean === "no error after unmount")}`);

/* --- 6. Keyboard -------------------------------------------------------- */
await p.reload({ waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ type: "jpeg", quality: 20 });
await p.waitForTimeout(700);
await p.click("#lscenario-tab-tutor");
await p.focus("#lscenario-tab-tutor");
const keys = [];
for (const [key, expect] of [["ArrowRight","assessment"],["ArrowRight","path"],["ArrowRight","tutor"],["ArrowLeft","path"],["Home","tutor"],["End","path"]]) {
  await p.keyboard.press(key);
  const r = await p.evaluate(() => ({
    sel: document.querySelector('.lscenario[aria-selected="true"]').id,
    focus: document.activeElement.id,
  }));
  const ok = r.sel === `lscenario-tab-${expect}` && r.focus === `lscenario-tab-${expect}`;
  keys.push(`${key}->${expect} ${ok ? "ok" : "FAIL " + JSON.stringify(r)}`);
}
console.log(`keyboard: ${keys.join(" | ")}`);

console.log(`\nconsole errors/warnings: ${consoleIssues.length ? consoleIssues.join(" | ") : "none"} ${pass(consoleIssues.length === 0)}`);

const total = switchFail + runFail + (cancelOk ? 0 : 1) + (netDuring === 0 ? 0 : 1) +
  (doubleDisabled ? 0 : 1) + (unmountClean === "no error after unmount" ? 0 : 1) +
  (keys.some((k) => k.includes("FAIL")) ? 1 : 0) + (consoleIssues.length ? 1 : 0);
await browser.close();
console.log(`\n=== stage07 interaction: ${total === 0 ? "ALL PASS" : total + " FAILURE GROUP(S)"} ===`);
process.exit(total === 0 ? 0 : 1);
