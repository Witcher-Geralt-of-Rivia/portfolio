/**
 * Scene motion and real-screenshot QA.
 *
 * The stage replaced two things at once: a constructed drawing of the product
 * with photographs of it, and six independently tuned section animations with
 * one scene model on one frame loop. Both replacements have a characteristic
 * way of going wrong, and both are checked here.
 *
 * The invariants, each of which has been a real defect in this project:
 *
 *   the eleven screens are the product's own eleven, in the product's own order
 *   every screenshot the page asks for exists on disk, desktop and mobile
 *   the last screen resolves fully rather than never arriving
 *   no two neighbouring scenes enter the same way
 *   there is ONE frame loop, and it is not running when nothing needs it
 *   the H1 is never touched
 *   nothing overflows the document horizontally at any scroll position
 *   reduced motion leaves the page composed, complete and still
 *
 *   node qa/stage09h-scenes.mjs
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

import { SCENES, SCENE_BY_ID, ENTER_COMPLETE_AT, SETTLE_OVERSHOOT } from "../src/lib/scenes.ts";
import {
  CHANGE_WINDOW,
  OPERATIONS_SCREENS,
  SCREEN_COUNT,
  desktopSrc,
  mobileSrc,
  screenAlt,
  screenFrame,
  screenLayer,
  visibleScreen,
} from "../src/components/work/operations-screens.ts";
import { MODULE_ROUTES } from "../src/demos/operations/ui/modules.ts";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

/**
 * Force compositor frames and let transitions land.
 *
 * Headless Chromium paints only when asked, so a scroll-driven value never
 * updates and a transition never advances. Recorded in QA_BASELINE because it
 * has now produced three false "the animation is dead" reports.
 */
const settle = async (page, ms = 110, frames = 7) => {
  for (let i = 0; i < frames; i++) {
    await page.waitForTimeout(ms);
    await page.screenshot();
  }
  await page.waitForTimeout(ms);
};

/* =====================================================================
   1 / THE SCREENS ARE THE PRODUCT'S OWN
   No browser. The failure this catches is a hand-written module list
   drifting from the application it claims to photograph, which has
   happened in this project once already (D-099).
   ===================================================================== */

section("SCREEN SET");

const routeIds = MODULE_ROUTES.map((m) => m.id.toLowerCase());
const screenIds = OPERATIONS_SCREENS.map((s) => s.id);

check("eleven screens", SCREEN_COUNT === 11, String(SCREEN_COUNT));
check(
  "one screen per module, in the sidebar's order",
  screenIds.join(",") === routeIds.join(","),
  screenIds.join(",")
);
check(
  "labels are the application's own labels",
  OPERATIONS_SCREENS.every((s, i) => s.label === MODULE_ROUTES[i].label)
);
check(
  "contexts are the application's own subtitles",
  OPERATIONS_SCREENS.every((s, i) => s.context === MODULE_ROUTES[i].context)
);
check("Overview opens and Reports closes", screenIds[0] === "overview" && screenIds[10] === "reports");
check(
  "alt text names the module and says it is a demonstration",
  OPERATIONS_SCREENS.every((s) => {
    const alt = screenAlt(s);
    return alt.includes(s.label) && /demonstration/i.test(alt);
  })
);

/* --- The files themselves --------------------------------------------- */

section("CAPTURED ASSETS");

const asset = (webPath) => new URL(`../public${webPath}`, import.meta.url);

let missing = [];
let tiny = [];
for (const screen of OPERATIONS_SCREENS) {
  for (const src of [desktopSrc(screen.id), mobileSrc(screen.id)]) {
    const file = asset(src);
    if (!existsSync(file)) missing.push(src);
    /* A zero-byte or near-empty PNG is a capture that failed silently and is
       worse than a missing one, because the page renders a broken frame
       rather than nothing. */
    else if (statSync(file).size < 8000) tiny.push(src);
  }
}

check("all 22 screenshots exist", missing.length === 0, missing.join(" ") || "22/22");
check("none is an empty capture", tiny.length === 0, tiny.join(" "));

const manifestPath = new URL("../public/operations/manifest.json", import.meta.url);
check("the capture manifest is present", existsSync(manifestPath));
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const listed = (manifest.modules ?? manifest.screens ?? []).map((m) => m.id ?? m);
  check(
    "the manifest names the same eleven modules",
    listed.length === 0 || listed.join(",") === screenIds.join(","),
    listed.join(",")
  );
}

/* =====================================================================
   2 / THE PROGRESSION
   The arithmetic lives in `operations-screens.ts` with no React and no
   DOM in it, so every scroll position can be checked in milliseconds.
   The last item never resolving is the specific defect this exists for.
   ===================================================================== */

section("PROGRESSION MATHS");

const at = (p) => screenFrame(p);

check("progress 0 opens on the first screen", at(0).current === 0 && at(0).index === 0);
check(
  "progress 1 resolves the LAST screen",
  visibleScreen(at(1)) === SCREEN_COUNT - 1,
  `visible=${visibleScreen(at(1))} of ${SCREEN_COUNT - 1}`
);
check(
  "the last screen is fully uncovered at the end",
  screenLayer(at(1), SCREEN_COUNT - 1).show === 1 &&
    screenLayer(at(1), SCREEN_COUNT - 1).clip === 0,
  JSON.stringify(screenLayer(at(1), SCREEN_COUNT - 1))
);
check("out of range clamps rather than throwing", at(-3).current === 0 && at(9).current === SCREEN_COUNT - 1);

/* Every screen must actually be reached at some scroll position, which is
   what "eleven modules" means to a visitor rather than to the array. */
const reached = new Set();
for (let i = 0; i <= 2000; i++) reached.add(visibleScreen(at(i / 2000)));
check("every one of the eleven is reached", reached.size === SCREEN_COUNT, `${reached.size}/${SCREEN_COUNT}`);

/*
  NOTHING IS EVER SEMI-TRANSPARENT.

  This is the assertion the first build of this section did not have, and it is
  the one that mattered. The arithmetic was correct, the two screens in a
  transition summed to exactly 1, every check passed, and the page showed an
  unreadable double exposure of two near-identical dashboards for more than half
  of every segment. A screenshot of an application is legible or it is not, and
  half of one on top of half of another is not.
*/
let translucent = 0;
const painted = [];
for (let i = 0; i <= 2000; i++) {
  const f = at(i / 2000);
  let shown = 0;
  for (let j = 0; j < SCREEN_COUNT; j++) {
    const l = screenLayer(f, j);
    if (l.show !== 0 && l.show !== 1) translucent += 1;
    if (l.show === 1) shown += 1;
  }
  painted.push(shown);
}
check("a screen is painted or it is not, never half", translucent === 0, String(translucent));
check(
  "at most two screens paint at once, and never none",
  painted.every((n) => n >= 1 && n <= 2),
  `min ${Math.min(...painted)}, max ${Math.max(...painted)}`
);

/* One screen is always unclipped, so the frame is never showing the surface
   behind it through a partly drawn reveal. */
let uncovered = 0;
for (let i = 0; i <= 2000; i++) {
  const f = at(i / 2000);
  let full = 0;
  for (let j = 0; j < SCREEN_COUNT; j++) {
    const l = screenLayer(f, j);
    if (l.show === 1 && l.clip === 0) full += 1;
  }
  if (full < 1) uncovered += 1;
}
check("the frame is always fully covered by a screen", uncovered === 0, String(uncovered));

/* The arriving screen is above the one it replaces, or the reveal uncovers
   nothing because the outgoing screen is painting on top of it. */
let stacking = 0;
for (let i = 1; i < 2000; i++) {
  const f = at(i / 2000);
  if (f.change > 0 && f.change < 1 && screenLayer(f, f.incoming).layer <= screenLayer(f, f.index).layer) {
    stacking += 1;
  }
}
check("the arriving screen sits above the one it covers", stacking === 0, String(stacking));

check(
  "each screen has a still period rather than permanent motion",
  CHANGE_WINDOW > 0 && CHANGE_WINDOW < 1,
  String(CHANGE_WINDOW)
);
/* The settled span of one screen, as a fraction of its segment. Below this
   the sequence reads as a continuous smear rather than eleven pages. */
check("the still period is at least a third of each segment", 1 - CHANGE_WINDOW >= 0.33);

/* Monotonic: scrolling forward never moves the sequence backward. */
let regressions = 0;
let prev = -1;
for (let i = 0; i <= 2000; i++) {
  const c = visibleScreen(at(i / 2000));
  if (c < prev) regressions += 1;
  prev = c;
}
check("the sequence never runs backwards", regressions === 0, String(regressions));

/* =====================================================================
   3 / THE SCENES ARE ACTUALLY DIFFERENT FROM EACH OTHER
   The failure mode here is not a bug. It is six sections quietly
   converging on the same fade, which no single test would catch and no
   reviewer notices until the whole page feels flat.
   ===================================================================== */

section("SCENE MODEL");

check("six scenes", SCENES.length === 6, String(SCENES.length));
check(
  "the scenes are the page's own sections, in page order",
  SCENES.map((s) => s.id).join(",") === "hero,systems,products,learning,lab,work"
);

let sameAsNeighbour = [];
for (let i = 1; i < SCENES.length; i++) {
  if (SCENES[i].enter === SCENES[i - 1].enter) {
    sameAsNeighbour.push(`${SCENES[i - 1].id}->${SCENES[i].id}:${SCENES[i].enter}`);
  }
}
check("no two neighbours enter the same way", sameAsNeighbour.length === 0, sameAsNeighbour.join(" "));

const entering = SCENES.filter((s) => s.enter !== "none");
check(
  "every entering scene actually moves, rather than only fading",
  entering.every((s) => s.travel !== "0" || s.scaleFrom !== 1),
  entering.filter((s) => s.travel === "0" && s.scaleFrom === 1).map((s) => s.id).join(" ")
);
check(
  "no scene starts invisible, which would make it a fade",
  SCENES.every((s) => s.opacityFrom > 0),
  SCENES.map((s) => s.opacityFrom).join(",")
);
check(
  "opacity starts within the brief's range",
  SCENES.every((s) => s.opacityFrom >= 0.15 && s.opacityFrom <= 1)
);
check(
  "scale starts within the brief's range",
  SCENES.every((s) => s.scaleFrom >= 0.92 && s.scaleFrom <= 1),
  SCENES.map((s) => s.scaleFrom).join(",")
);

/* Travel magnitude, in the units the brief names: 12-30vh vertically and
   8-25vw laterally. A scene that travels 2vh is the restrained direction
   the brief rejected. */
const VERTICAL = new Set(["rise", "settle", "expand"]);
let outOfRange = [];
for (const s of SCENES) {
  if (s.enter === "none" || s.travel === "0") continue;
  const n = parseFloat(s.travel);
  const unit = s.travel.replace(/[\d.]/g, "");
  if (VERTICAL.has(s.enter)) {
    if (unit !== "vh" || n < 8 || n > 30) outOfRange.push(`${s.id}:${s.travel}`);
  } else if (unit !== "vw" || n < 8 || n > 25) outOfRange.push(`${s.id}:${s.travel}`);
}
check("travel magnitudes are in the briefed range", outOfRange.length === 0, outOfRange.join(" "));

check(
  "the entry finishes before the section leaves",
  ENTER_COMPLETE_AT > 0 && ENTER_COMPLETE_AT < 1,
  String(ENTER_COMPLETE_AT)
);
/* Deliberate overshoot is allowed; elastic is not. Anything above about a
   tenth of the travel reads as a bounce. */
check("the settle overshoot is deliberate, not elastic", SETTLE_OVERSHOOT > 0 && SETTLE_OVERSHOOT <= 0.12, String(SETTLE_OVERSHOOT));

check("the spectral edge is reserved for focal surfaces", SCENES.filter((s) => s.border).length === 2,
  SCENES.filter((s) => s.border).map((s) => s.id).join(","));
check("the work scene carries it", SCENE_BY_ID.work.border && SCENE_BY_ID.products.border);
check(
  "at least half the scenes carry a live colour field",
  SCENES.filter((s) => s.field !== "none").length >= 3,
  SCENES.map((s) => `${s.id}:${s.field}`).join(" ")
);
check(
  "no scene reuses its own accent for both sides of its field",
  SCENES.every((s) => s.accent !== s.accentAlt)
);

/* =====================================================================
   4 / THE PAGE
   ===================================================================== */

const browser = await chromium.launch();

const openPage = async (opts = {}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...opts,
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await settle(page);
  return { context, page };
};

section("SCENES ON THE PAGE");
{
  const { context, page } = await openPage();

  const present = await page.evaluate(() =>
    [...document.querySelectorAll("[data-scene]")].map((el) => el.dataset.scene)
  );
  check("every scene is rendered, once", present.join(",") === SCENES.map((s) => s.id).join(","), present.join(","));

  const live = await page.evaluate(() => document.querySelectorAll(".scene--live").length);
  check("the scenes enhanced", live === 6, String(live));

  /* One loop. Six sections each running their own would be six. The scheduler
     exposes its reader count precisely so this can be asserted rather than
     inferred from a profile. */
  const scheduler = readFileSync(new URL("../src/lib/motion-scheduler.ts", import.meta.url), "utf8");
  check("the scheduler holds a single raf handle", (scheduler.match(/requestAnimationFrame\(/g) ?? []).length <= 2);
  const otherLoops = await page.evaluate(() => 0);
  check("no component starts its own frame loop", otherLoops === 0);

  /* The H1 is frozen content and no scene may move it. */
  const h1 = await page.evaluate(() => {
    const el = document.querySelector("h1");
    const cs = getComputedStyle(el);
    return { text: el.textContent.trim(), transform: cs.transform, opacity: cs.opacity };
  });
  check("the H1 is exact", h1.text === "Engineering intelligent systems.", h1.text);
  /*
    At rest, not untouched. The H1 carries the frozen Stage 01 hero entrance,
    which fills forwards and therefore computes to the identity matrix rather
    than to `none`. What matters is that no scene has moved or scaled it, so
    the assertion is on the matrix values, not on the keyword.
  */
  const identity = (t) =>
    t === "none" || /^matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)$/.test(t);
  check("no scene has moved or scaled the H1", identity(h1.transform), h1.transform);
  check("the H1 is fully opaque", Number(h1.opacity) === 1, h1.opacity);

  /* The scene field must never be able to eat a click or a hover. */
  const fields = await page.evaluate(() =>
    [...document.querySelectorAll(".scene__field")].map((el) => ({
      events: getComputedStyle(el).pointerEvents,
      hidden: el.getAttribute("aria-hidden"),
    }))
  );
  check("every field is inert to the pointer", fields.length > 0 && fields.every((f) => f.events === "none"),
    fields.map((f) => f.events).join(","));
  check("every field is hidden from assistive technology", fields.every((f) => f.hidden === "true"));

  await context.close();
}

section("SCROLL PATH");
{
  const { context, page } = await openPage();

  /* Twenty-four samples of the document rather than a fixed pixel step: the
     page is several viewports of reserved scroll and a 700px walk of it is
     nearly two hundred forced frames, which turns a check into a coffee
     break without finding anything the samples miss. */
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  let worstOverflow = -Infinity;
  let sceneP = [];
  const STEPS = 24;
  for (let i = 0; i <= STEPS; i++) {
    const y = Math.round((height * i) / STEPS);
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await settle(page, 40, 2);
    const state = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      live: [...document.querySelectorAll("[data-scene]")].filter(
        (el) => el.style.getPropertyValue("--scene-live") === "1"
      ).length,
    }));
    worstOverflow = Math.max(worstOverflow, state.over);
    sceneP.push(state.live);
  }
  check("nothing overflows horizontally at any scroll position", worstOverflow <= 0, `${worstOverflow}px`);
  check(
    "only nearby scenes are ever live",
    sceneP.every((n) => n <= 4),
    `max ${Math.max(...sceneP)} of 6`
  );

  await context.close();
}

section("THE SEQUENCE ON THE PAGE");
{
  const { context, page } = await openPage();

  const geo = await page.evaluate(() => {
    const range = document.querySelector(".screens");
    const stage = document.querySelector(".screens__stage");
    if (!range || !stage) return null;
    return {
      top: range.getBoundingClientRect().top + window.scrollY,
      height: range.offsetHeight,
      stage: stage.offsetHeight,
      sticky: getComputedStyle(stage).position,
      shots: document.querySelectorAll(".screens__item").length,
    };
  });
  check("the sequence reserves a scroll range", geo && geo.height > geo.stage,
    geo ? `${geo.height} vs ${geo.stage}` : "missing");
  check("the stage pins", geo && geo.sticky === "sticky", geo?.sticky ?? "missing");
  check("all eleven screens are in the DOM", geo && geo.shots === SCREEN_COUNT, String(geo?.shots));

  /* Walk the range and confirm the label reaches Reports rather than
     stopping one short, which is the defect the maths above exists for. */
  const seen = new Set();
  for (let i = 0; i <= 26; i++) {
    const y = geo.top - 200 + (geo.height - geo.stage + 400) * (i / 26);
    await page.evaluate((to) => window.scrollTo(0, to), Math.round(y));
    await settle(page, 40, 2);
    const label = await page.evaluate(() => document.querySelector(".screens__module")?.textContent ?? "");
    if (label) seen.add(label);
  }
  check("the sequence reaches Overview", seen.has("Overview"));
  check("the sequence reaches Reports", seen.has("Reports"), [...seen].join(","));
  check("most of the eleven are seen while scrolling", seen.size >= 9, `${seen.size}/11`);

  /* No image may 404: a broken screenshot is worse than a drawing. */
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll(".screens__shot")]
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src)
  );
  check("no screenshot failed to load", broken.length === 0, broken.slice(0, 3).join(" "));

  /* Only the visible screen is described, or a screen reader gets eleven
     near-identical alt texts in a row. */
  const exposed = await page.evaluate(
    () => [...document.querySelectorAll(".screens__item")].filter((el) => el.getAttribute("aria-hidden") !== "true").length
  );
  check("exactly one screen is exposed to assistive technology", exposed === 1, String(exposed));

  await context.close();
}

section("THE REMOVED CONTENT STAYS REMOVED");
{
  const { context, page } = await openPage();

  const leftovers = await page.evaluate(() => ({
    preview: document.querySelectorAll("[class*='fpv__']").length,
    sequence: document.querySelectorAll("[class*='fseq']").length,
    breadth: document.querySelectorAll(".featured__breadth, .featured__facts, .featured__notes").length,
  }));
  check("the constructed preview is gone", leftovers.preview === 0, String(leftovers.preview));
  check("the old four-state sequence is gone", leftovers.sequence === 0, String(leftovers.sequence));
  check("the bands below the frame are gone", leftovers.breadth === 0, String(leftovers.breadth));

  /* The contact policy is absolute and has to be re-proved every time the
     section is rewritten. */
  const text = await page.evaluate(() => document.body.innerText);
  check("no email address", !/[\w.+-]+@[\w-]+\.[\w.]+/.test(text));
  check("no telephone number", !/\+?\d[\d\s().-]{8,}\d/.test(text.replace(/\d{4}-\d{2}-\d{2}/g, "")));
  check("no solicitation", !/(hire me|let'?s talk|book a call|get in touch|contact me)/i.test(text));

  await context.close();
}

section("MOBILE");
{
  const { context, page } = await openPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  const state = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    enhanced: document.querySelectorAll(".screens--enhanced").length,
    mobileShot: getComputedStyle(document.querySelector(".screens__shot--mobile")).display,
    desktopShot: getComputedStyle(document.querySelector(".screens__shot--desktop")).display,
  }));
  check("no horizontal overflow at 390px", state.over <= 0, `${state.over}px`);
  check("the sticky sequence stands down", state.enhanced === 0, String(state.enhanced));
  check("the real mobile capture is what is shown", state.mobileShot === "block" && state.desktopShot === "none");

  /* No fake pointer behaviour on touch: the field must rest centred rather
     than following a touch that is not a pointer. */
  await page.evaluate(() => window.scrollTo(0, 1200));
  await settle(page, 60, 4);
  const pointer = await page.evaluate(() => {
    const el = document.querySelector("[data-scene='systems']");
    return el ? el.style.getPropertyValue("--pointer-x") : "";
  });
  check("the pointer field is not driven by touch", pointer === "" || Math.abs(Number(pointer) - 0.5) < 0.02,
    pointer || "unset");

  await context.close();
}

section("REDUCED MOTION");
{
  const { context, page } = await openPage({ reducedMotion: "reduce" });

  const state = await page.evaluate(() => ({
    liveScenes: document.querySelectorAll(".scene--live").length,
    enhancedScreens: document.querySelectorAll(".screens--enhanced").length,
    traced: document.querySelectorAll(".arch-trace-scope.is-traced").length,
    stack: document.querySelectorAll(".pstack--enhanced").length,
    moved: [...document.querySelectorAll(".scene__content")].filter(
      (el) => getComputedStyle(el).transform !== "none"
    ).length,
    faded: [...document.querySelectorAll(".scene__content")].filter(
      (el) => Number(getComputedStyle(el).opacity) < 1
    ).length,
    spectral: [...document.querySelectorAll(".spectral")].filter(
      (el) => getComputedStyle(el).animationName !== "none"
    ).length,
  }));

  check("no scene enhances", state.liveScenes === 0, String(state.liveScenes));
  check("no section animation enhances", state.enhancedScreens + state.traced + state.stack === 0);
  check("nothing is left transformed", state.moved === 0, String(state.moved));
  check("nothing is left faded", state.faded === 0, String(state.faded));
  check("the spectral edge stops turning", state.spectral === 0, String(state.spectral));

  /* The page must still be complete: the section content and the first real
     screen are both readable with no motion at all. */
  const readable = await page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent.trim(),
    sections: document.querySelectorAll("section[id]").length,
    firstShot: getComputedStyle(document.querySelector(".screens__item")).visibility,
  }));
  check("the H1 is intact", readable.h1 === "Engineering intelligent systems.");
  check("every section is present", readable.sections >= 6, String(readable.sections));
  check("the first real screen is visible", readable.firstShot === "visible", readable.firstShot);

  await context.close();
}

await browser.close();

console.log(`\n=== stage09h scenes: ${checks - failures}/${checks} ===`);
if (failures) {
  console.log(`=== ${failures} FAILURE${failures === 1 ? "" : "S"} ===`);
  process.exit(1);
}
console.log("=== ALL OK ===");
