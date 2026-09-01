import { chromium } from "playwright";

/* Stage 08 behaviour audit: experiment switching (including mid-execution),
   repeated execution, run/reset cycles, timer teardown, keyboard semantics,
   and the hard requirement that nothing here touches the network.

   No frame-forcing screenshots during a run, and interval polling rather than
   the default rAF: both are recorded traps in QA_BASELINE. A capture costs
   over a second and would swallow a 1.4s sequence; a headless page that is not
   painting starves rAF and lets throttled timers fire in a burst. */

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const pass = (b) => (b ? "PASS" : "FAIL");
const IDS = ["api", "ratelimit", "webhook", "queue", "idempotency"];
const RUN_LABEL = {
  api: "Send request", ratelimit: "Send burst", webhook: "Deliver event",
  queue: "Process queue", idempotency: "Send twice",
};
const DONE_LABEL = {
  api: "Send again", ratelimit: "Send again", webhook: "Deliver again",
  queue: "Process again", idempotency: "Send again",
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
p.on("request", (r) => requests.push(`${r.resourceType()} ${r.url()}`));
const failedResources = [];
p.on("requestfailed", (r) => failedResources.push(r.url()));

await p.goto(BASE + "/#lab", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ type: "jpeg", quality: 20 });
await p.waitForTimeout(800);

const read = () => p.evaluate(() => ({
  runLabel: document.querySelector(".lab__run-label").textContent,
  runDisabled: document.querySelector(".lab__run").disabled,
  resetDisabled: document.querySelector(".lab__reset").disabled,
  selected: document.querySelector('.lexp[aria-selected="true"]').id,
  panelFor: document.querySelector("#lab-panel").getAttribute("aria-labelledby"),
  ident: document.querySelector(".lab__ident").textContent,
  state: document.querySelector(".lobs__state").textContent,
  event: document.querySelector(".lobs__event").textContent,
  pattern: document.querySelector(".lobs__pattern").textContent,
  live: document.querySelector('.lab__foot [aria-live="polite"]').textContent,
  activeStages: document.querySelectorAll(".lstage.is-active").length,
  tag: document.querySelector(".lab__explanation-tag").textContent,
  explanation: document.querySelector(".lab__explanation-body").textContent.slice(0, 40),
}));

const runToCompletion = async (id) => {
  await p.click(".lab__run");
  await p.waitForFunction(
    (label) => document.querySelector(".lab__run-label").textContent === label,
    DONE_LABEL[id], { timeout: 15000, polling: 80 }
  );
};

/* --- 1. Fifty experiment switches, some of them mid-execution ----------- */
let switchFail = 0;
const seenExplanations = new Set();
for (let i = 0; i < 50; i++) {
  const id = IDS[i % IDS.length];
  // Every third switch happens while a sequence is still running.
  if (i % 3 === 2) {
    await p.click(".lab__run");
    await p.waitForTimeout(160);
  }
  await p.click(`#lexp-tab-${id}`);
  const r = await read();
  seenExplanations.add(r.explanation);

  const tabOk = r.selected === `lexp-tab-${id}` && r.panelFor === `lexp-tab-${id}`;
  const rovingOk = await p.evaluate(() =>
    [...document.querySelectorAll('.lexp[aria-selected="false"]')].every((t) => t.tabIndex === -1) &&
    document.querySelector('.lexp[aria-selected="true"]').tabIndex === 0
  );
  /* A switch must cancel whatever was running and present the new experiment
     from its own initial state: idle label, no lit stage, no announcement,
     Reset unavailable because nothing has been run. */
  const cleanOk =
    r.runLabel === RUN_LABEL[id] && !r.runDisabled && r.resetDisabled &&
    r.live === "" && r.activeStages === 0 && r.state === "READY";
  if (!(tabOk && rovingOk && cleanOk)) {
    switchFail++;
    if (switchFail <= 3) console.log(`  switch ${i} (${id}) FAIL ${JSON.stringify(r)}`);
  }
}
console.log(`50 experiment switches (17 mid-execution): ${pass(switchFail === 0)} (${50 - switchFail}/50 clean)`);
console.log(`  distinct explanations seen: ${seenExplanations.size} ${pass(seenExplanations.size === 5)}`);

/* --- 2. Twenty executions per experiment -------------------------------- */
const reqBefore = requests.length;
let runFail = 0;
const endStates = {};
for (const id of IDS) {
  await p.click(`#lexp-tab-${id}`);
  await p.waitForTimeout(120);
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    await runToCompletion(id);
    const r = await read();
    seen.add(`${r.state}|${r.event}`);
    const ok = r.runLabel === DONE_LABEL[id] && !r.runDisabled && !r.resetDisabled &&
      r.live.startsWith("Experiment complete:") && r.ident === `LAB / ${IDS.indexOf(id) + 1}`.replace(/(\d)$/, "0$1");
    if (!ok) {
      runFail++;
      if (runFail <= 3) console.log(`  run ${id}#${i} FAIL ${JSON.stringify(r)}`);
    }
  }
  endStates[id] = [...seen];
  // Deterministic: twenty runs must produce exactly one end state.
  if (seen.size !== 1) {
    runFail++;
    console.log(`  ${id} NON-DETERMINISTIC: ${seen.size} distinct end states ${JSON.stringify([...seen])}`);
  }
}
const netDuring = requests.length - reqBefore;
const netUrls = requests.slice(reqBefore);
console.log(`20 executions x 5 experiments: ${pass(runFail === 0)} (${100 - runFail}/100 clean)`);
console.log(`  every experiment ends in exactly one state: ${pass(Object.values(endStates).every((v) => v.length === 1))}`);
for (const id of IDS) console.log(`    ${id.padEnd(12)} ${endStates[id][0]}`);
console.log(`  network requests during 100 runs + 50 switches: ${netDuring} ${pass(netDuring === 0)}`);
if (netDuring > 0) netUrls.forEach((u) => console.log(`    ${u}`));

/* --- 3. Twenty run/reset cycles per experiment -------------------------- */
let resetFail = 0;
for (const id of IDS) {
  await p.click(`#lexp-tab-${id}`);
  await p.waitForTimeout(120);
  const initial = await read();
  for (let i = 0; i < 20; i++) {
    await runToCompletion(id);
    await p.click(".lab__reset");
    await p.waitForTimeout(60);
    const after = await read();
    /* Reset must restore the initial deterministic state exactly, not merely
       something that looks idle. */
    const ok =
      after.runLabel === initial.runLabel && after.state === initial.state &&
      after.event === initial.event && after.live === "" &&
      after.activeStages === 0 && after.resetDisabled === true;
    if (!ok) {
      resetFail++;
      if (resetFail <= 3) console.log(`  reset ${id}#${i} FAIL before=${JSON.stringify(initial)} after=${JSON.stringify(after)}`);
    }
  }
}
console.log(`20 run/reset cycles x 5 experiments: ${pass(resetFail === 0)} (${100 - resetFail}/100 restored exactly)`);

/* --- 4. Teardown: switch and unmount mid-execution ---------------------- */
await p.click("#lexp-tab-queue");
await p.waitForTimeout(120);
await p.click(".lab__run");
await p.waitForTimeout(300);
await p.click("#lexp-tab-api");
await p.waitForTimeout(2600);
const afterCancel = await read();
const cancelOk =
  afterCancel.runLabel === RUN_LABEL.api && afterCancel.live === "" &&
  afterCancel.state === "READY" && afterCancel.activeStages === 0 &&
  afterCancel.selected === "lexp-tab-api";
console.log(`\ncancelled sequence leaves no stale state: ${pass(cancelOk)} ${JSON.stringify(afterCancel)}`);

await p.click(".lab__run");
await p.waitForTimeout(250);
const unmount = await p.evaluate(() => new Promise((resolve) => {
  const errors = [];
  const onError = (e) => errors.push(String(e.message || e));
  window.addEventListener("error", onError);
  document.querySelector("#lab").remove();
  setTimeout(() => {
    window.removeEventListener("error", onError);
    resolve(errors.length === 0 ? "no error after unmount" : errors.join(" | "));
  }, 2600);
}));
console.log(`unmount during a run: ${unmount} ${pass(unmount === "no error after unmount")}`);

/* --- 5. Keyboard --------------------------------------------------------- */
await p.reload({ waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ type: "jpeg", quality: 20 });
await p.waitForTimeout(700);
await p.click("#lexp-tab-api");
await p.focus("#lexp-tab-api");
const keys = [];
for (const [key, expect] of [
  ["ArrowRight", "ratelimit"], ["ArrowRight", "webhook"], ["ArrowLeft", "ratelimit"],
  ["Home", "api"], ["End", "idempotency"], ["ArrowRight", "api"],
]) {
  await p.keyboard.press(key);
  const r = await p.evaluate(() => ({
    sel: document.querySelector('.lexp[aria-selected="true"]').id,
    focus: document.activeElement.id,
  }));
  const ok = r.sel === `lexp-tab-${expect}` && r.focus === `lexp-tab-${expect}`;
  keys.push(`${key}->${expect} ${ok ? "ok" : "FAIL " + JSON.stringify(r)}`);
}
console.log(`keyboard: ${keys.join(" | ")}`);

console.log(`\nconsole errors/warnings: ${consoleIssues.length ? consoleIssues.slice(0, 4).join(" | ") : "none"} ${pass(consoleIssues.length === 0)}`);
console.log(`failed resource requests: ${failedResources.length} ${pass(failedResources.length === 0)}`);

const total = switchFail + runFail + resetFail + (cancelOk ? 0 : 1) +
  (netDuring === 0 ? 0 : 1) + (unmount === "no error after unmount" ? 0 : 1) +
  (keys.some((k) => k.includes("FAIL")) ? 1 : 0) + (consoleIssues.length ? 1 : 0) +
  (failedResources.length ? 1 : 0);
await browser.close();
console.log(`\n=== stage08 interaction: ${total === 0 ? "ALL PASS" : total + " FAILURE GROUP(S)"} ===`);
process.exit(total === 0 ? 0 : 1);
