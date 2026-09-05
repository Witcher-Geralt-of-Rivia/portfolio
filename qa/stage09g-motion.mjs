/**
 * Landing motion QA.
 *
 * Four sections gained scroll-driven motion, and the thing that makes them
 * testable is that the arithmetic lives in `src/lib/scroll-geometry.ts` with no
 * React and no DOM in it. Half of this suite never opens a browser and checks
 * the properties that matter at every panel count in milliseconds; the other
 * half opens one and checks that the page actually does what the numbers say.
 *
 * The invariants worth stating up front, because each of them was a real defect
 * in this project before it was an assertion:
 *
 *   a sequence must FINISH before its section releases
 *   the H1 must never be touched by any of it
 *   reduced motion must leave every section readable and complete
 *   nothing may overflow the document horizontally at any point
 *   a focusable control must not be reachable while it is off screen
 *
 *   node qa/stage09g-motion.mjs
 */

import { readFileSync } from "node:fs";
import { chromium } from "playwright";

import {
  activePanel,
  clamp01,
  cubicBezier,
  easeEntrance,
  easeNav,
  panelProgress,
  segmentAt,
  stepTravel,
  stickyProgress,
  stickyRangeHeight,
  viewportProgress,
} from "../src/lib/scroll-geometry.ts";
import {
  OPERATIONS_SCREENS,
  SCREEN_COUNT,
} from "../src/components/work/operations-screens.ts";

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
 * updates and a 280ms transition never advances. One forced frame starts it;
 * several drive it to the end. Recorded in QA_BASELINE because it has now
 * produced two false "the animation is dead" reports.
 */
const settle = async (page, ms = 110, frames = 7) => {
  for (let i = 0; i < frames; i++) {
    await page.waitForTimeout(ms);
    await page.screenshot();
  }
  await page.waitForTimeout(ms);
};

const geometryOf = (page, rangeSel, stageSel) =>
  page.evaluate(
    ({ r, s }) => {
      const range = document.querySelector(r);
      const stage = document.querySelector(s);
      if (!range || !stage) return null;
      const box = range.getBoundingClientRect();
      return {
        top: box.top + window.scrollY,
        height: range.offsetHeight,
        stage: stage.offsetHeight,
        sticky: Number.parseFloat(getComputedStyle(stage).top) || 0,
      };
    },
    { r: rangeSel, s: stageSel }
  );

/* ===================================================================== */
section("MATHS - EASING");
{
  check("the primary curve is anchored at both ends", easeEntrance(0) === 0 && easeEntrance(1) === 1);
  check("and the secondary too", easeNav(0) === 0 && easeNav(1) === 1);
  check(
    "the primary never overshoots",
    (() => {
      for (let x = 0; x <= 1.0001; x += 0.005) {
        const y = easeEntrance(x);
        if (y < -1e-6 || y > 1 + 1e-6) return false;
      }
      return true;
    })(),
    "no value outside 0..1, so nothing bounces"
  );
  check(
    "and is monotonic",
    (() => {
      let last = -1;
      for (let x = 0; x <= 1.0001; x += 0.005) {
        const y = easeEntrance(x);
        if (y < last - 1e-9) return false;
        last = y;
      }
      return true;
    })()
  );
  check(
    "it front-loads, which is what makes it read as decisive",
    easeEntrance(0.25) > 0.6,
    easeEntrance(0.25).toFixed(3)
  );
  check("linear is reproduced exactly", (() => {
    const linear = cubicBezier(0.33, 0.33, 0.67, 0.67);
    return [0.2, 0.5, 0.8].every((x) => Math.abs(linear(x) - x) < 0.01);
  })());
  check(
    "bad input is clamped rather than propagated",
    clamp01(NaN) === 0 && clamp01(Infinity) === 1 && clamp01(-Infinity) === 0,
    "NaN falls to 0; the infinities clamp to the ends they are nearest"
  );
}

/* ===================================================================== */
section("MATHS - STICKY RANGES");
{
  check("a range is the stage, the offset and the travel", stickyRangeHeight(600, 900, 110) === 1610);
  check("progress starts at 0", stickyProgress(0, 1000, 1610, 600, 110) === 0);
  /* The defect this exists to prevent: a sticky box pinned at an offset
     releases that many pixels early, and leaving the offset out of any of the
     three places it appears ends the choreography short by its height. */
  check(
    "and reaches exactly 1 where the stage releases",
    stickyProgress(1000 + 1610 - 600 - 110, 1000, 1610, 600, 110) === 1,
    "the sticky offset is carried through both ends"
  );
  check(
    "an offset left out would finish short",
    stickyProgress(1000 + 1610 - 600 - 110, 1000, 1610, 600, 0) < 1,
    "which is the bug the parameter prevents"
  );
  check("a range with no travel cannot divide by zero", stickyProgress(500, 0, 600, 600, 0) === 0);

  check("travel is bounded above", stepTravel(50, 900, 0.7, 1, 2.5) === Math.round(2.5 * 900));
  check("and below", stepTravel(1, 900, 0.1, 1, 2.5) === 900);
  check("no steps means no travel", stepTravel(0, 900, 0.7, 1, 2.5) === 0);
}

/* ===================================================================== */
section("MATHS - SEGMENTS AND PANELS");
{
  /* The property every stacked section depends on: the last panel reaches its
     final state exactly as the section releases. Naive floor(p * segments)
     lands on a segment that does not exist at p = 1 and the last panel never
     resolves. */
  check(
    "the final segment resolves exactly at 1, at every count",
    [2, 3, 4, 5, 8].every((n) => {
      const s = segmentAt(1, n);
      return s.index === n - 2 && Math.abs(s.local - 1) < 1e-9;
    })
  );
  check(
    "and the first segment starts at 0",
    [2, 3, 4].every((n) => {
      const s = segmentAt(0, n);
      return s.index === 0 && s.local === 0;
    })
  );
  check("a single panel does not divide by zero", Number.isFinite(segmentAt(0.5, 1).local));
  check(
    "segment progress is continuous across a boundary",
    (() => {
      let last = segmentAt(0, 4);
      for (let p = 0.001; p <= 1.0001; p += 0.001) {
        const s = segmentAt(p, 4);
        /* Either the same segment advancing, or a boundary where the previous
           finished and the next started. */
        if (s.index === last.index) {
          if (s.local < last.local - 1e-6) return false;
        } else if (last.local < 0.98 || s.local > 0.05) {
          return false;
        }
        last = s;
      }
      return true;
    })()
  );

  check("every panel is fully forward at the end", [3, 4].every((n) =>
    Array.from({ length: n }, (_, i) => panelProgress(1, i, n)).every((v) => v === 1)
  ));
  check("and none is at the start", panelProgress(0, 2, 4) === 0);

  /* Hysteresis, which is what stops a viewport resting on a boundary from
     toggling a class every frame while nothing moves. */
  check("the active panel starts at the first", activePanel(0, 4) === 0);
  check("and ends at the last", activePanel(1, 4) === 3, String(activePanel(1, 4)));
  check(
    "it never leaves the collection",
    [0, 0.2, 0.5, 0.8, 1].every((p) => {
      const a = activePanel(p, 4);
      return Number.isInteger(a) && a >= 0 && a < 4;
    })
  );
  check(
    "it advances monotonically",
    (() => {
      let prev = 0;
      for (let p = 0; p <= 1.0001; p += 0.002) {
        const a = activePanel(p, 4, prev);
        if (a < prev) return false;
        prev = a;
      }
      return true;
    })()
  );
  check(
    "and every panel takes a turn",
    (() => {
      const seen = new Set();
      let prev = 0;
      for (let p = 0; p <= 1.0001; p += 0.002) {
        prev = activePanel(p, 4, prev);
        seen.add(prev);
      }
      return seen.size === 4;
    })()
  );
  check(
    "the boundary does not flicker",
    (() => {
      /* Sit within a hair of a switch point and jitter, as a resting viewport
         does. The state must not change. */
      const boundary = 1 / 3 / 2 + 1 / 3 * 0; // mid of the first segment
      let prev = activePanel(boundary, 4, 0);
      for (let i = 0; i < 200; i++) {
        const p = boundary + (i % 2 === 0 ? 1e-5 : -1e-5);
        const a = activePanel(p, 4, prev);
        if (a !== prev) return false;
        prev = a;
      }
      return true;
    })()
  );
}

/* ===================================================================== */
section("MATHS - VIEWPORT PROGRESS");
{
  check("nothing before the element arrives", viewportProgress(0, 5000, 600, 900) === 0);
  check("complete after it has passed", viewportProgress(9000, 1000, 600, 900) === 1);
  check(
    "monotonic through the whole travel",
    (() => {
      let last = -1;
      for (let y = 0; y < 4000; y += 10) {
        const v = viewportProgress(y, 1000, 600, 900);
        if (v < last - 1e-9) return false;
        last = v;
      }
      return true;
    })()
  );
  check("a zero-height element does not divide by zero", Number.isFinite(viewportProgress(500, 0, 0, 0)));
}

/* ===================================================================== */
section("THE WORK SCREENS ARE THE PRODUCT'S OWN");
{
  /* The section no longer groups the product into four presentation states:
     it shows the product's own eleven modules, in the product's own order.
     D-099 records what happened the last time this section carried a
     hand-typed copy of that list, so it is compared rather than trusted.
     The screenshots themselves are checked by `qa/stage09h-scenes.mjs`. */
  const modules = readFileSync(
    new URL("../src/demos/operations/ui/modules.ts", import.meta.url),
    "utf8"
  );
  const productModules = [...modules.matchAll(/id: "([A-Za-z]+)", label:/g)].map((m) => m[1]);
  const shown = OPERATIONS_SCREENS.map((s) => s.label);

  check("the product publishes eleven modules", productModules.length === 11, String(productModules.length));
  check("the section shows all eleven", SCREEN_COUNT === 11, String(SCREEN_COUNT));
  check(
    "in the product's own order, with nothing left out",
    shown.join(",") === productModules.join(","),
    shown.join(",")
  );
  check("none is named twice", new Set(shown).size === shown.length);
  check(
    "no screen invents a fact about the application",
    OPERATIONS_SCREENS.every((s) => !/\d{2,}/.test(s.context)),
    "the figures a visitor sees come from the capture, not from this file"
  );
}

/* ===================================================================== */
section("THE PAGE - HEADLINE AND DEPENDENCIES");
{
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const deps = Object.keys(pkg.dependencies ?? {});
  check("runtime dependencies are unchanged", deps.join(",") === "geist,next,react,react-dom", deps.join(","));
  for (const banned of ["gsap", "lenis", "framer-motion", "motion", "animejs", "anime.js", "three"]) {
    check(`no ${banned}`.slice(0, 58), !deps.includes(banned) && !(pkg.devDependencies ?? {})[banned]);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });

  /* Before anything settles: the headline has to be right in the first HTML,
     not after a sequence finishes. */
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const early = await page.evaluate(() => ({
    text: document.querySelector("h1")?.textContent?.trim(),
    laidOut: document.querySelector("h1").getClientRects().length > 0,
    inHtml: document.documentElement.outerHTML.includes("Engineering intelligent systems."),
  }));
  check("the H1 is exact before any motion runs", early.text === "Engineering intelligent systems.", early.text);
  check("it is in the served HTML, not produced by script", early.inHtml);
  check("and it occupies its space from the first layout", early.laidOut,
    "so nothing below it moves when the hero entrance plays");

  await settle(page, 130, 10);
  const late = await page.evaluate(() => ({
    text: document.querySelector("h1")?.textContent?.trim(),
    opacity: getComputedStyle(document.querySelector("h1")).opacity,
    boot: getComputedStyle(document.querySelector(".cinit__state--boot")).opacity,
    live: getComputedStyle(document.querySelector(".cinit__state--live")).opacity,
    metric: document.querySelector(".cinit__metric")?.textContent,
  }));
  check("the sequence never edits the H1", late.text === early.text, late.text);
  /* The hero's own entrance fades the headline in over 400ms and predates this
     stage; Stages 01-04 are frozen and it is not this work's to change. What
     matters here is that it finishes, and that nothing this stage added holds
     it back. */
  check("the H1 finishes fully opaque", late.opacity === "1", late.opacity);
  check("the init resolves out of BOOT", Number(late.boot) < 0.02, late.boot);
  check("into the live state", Number(late.live) > 0.98, late.live);
  check("carrying the section's own metric", late.metric === "00.410", late.metric);
  check("the page is error free", problems.length === 0, problems.join(" | ").slice(0, 80));

  await ctx.close();
  await browser.close();
}

/* ===================================================================== */
section("SECTIONS RESOLVE BEFORE THEY RELEASE");
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await settle(page, 150, 4);

  /* --- Systems tracer --- */
  const sys = await page.evaluate(() => {
    const el = document.querySelector(".arch-trace-scope");
    const b = el.getBoundingClientRect();
    return { top: b.top + window.scrollY, height: el.offsetHeight };
  });
  check("the tracer scope exists", Boolean(sys));
  await page.evaluate(
    (y) => window.scrollTo(0, Math.max(0, Math.min(y, document.body.scrollHeight - window.innerHeight))),
    sys.top - 900 + (sys.height + 900) * 0.8
  );
  await settle(page);
  const traced = await page.evaluate(() => {
    const drawn = [...document.querySelectorAll(".arch-link-trace")].map((e) =>
      Number(getComputedStyle(e).getPropertyValue("--arch-drawn") || 0)
    );
    const states = [...document.querySelectorAll(".arch-node")].map((e) => e.dataset.archTrace);
    return {
      count: drawn.length,
      minDrawn: Math.min(...drawn),
      idle: states.filter((s) => s === "idle").length,
      resolved: states.filter((s) => s === "resolved").length,
      total: states.length,
    };
  });
  check("every connection is drawn by the end", traced.minDrawn > 0.99, traced.minDrawn.toFixed(3));
  check("every node reaches its final state", traced.idle === 0 && traced.resolved === traced.total,
    `${traced.resolved} of ${traced.total} resolved`);

  /* --- Product stack --- */
  /*
     Unpinned, deliberately, and the assertion says so rather than checking for
     a reserved range that should not exist. The studio is 988px tall at 1440
     against a usable 790px, so pinning it would hang its event-flow rail and
     its Run button off the bottom of the screen. Progress runs as the section
     passes instead, which is the same behaviour without the dead scrolling.
  */
  const pstack = await page.evaluate(() => {
    const el = document.querySelector(".pstack");
    const stage = document.querySelector(".pstack__stage");
    const box = el.getBoundingClientRect();
    return {
      enhanced: el.className.includes("--enhanced"),
      top: box.top + window.scrollY,
      height: el.offsetHeight,
      stageHeight: stage.offsetHeight,
      position: getComputedStyle(stage).position,
    };
  });
  check("the product stack is enhanced at this width", pstack.enhanced);
  check("it reserves no scroll range", pstack.height === pstack.stageHeight,
    `${pstack.height} vs ${pstack.stageHeight}`);
  check("and nothing is pinned", pstack.position !== "sticky", pstack.position);

  const surfacesSeen = new Set();
  for (let f = 0; f <= 1.001; f += 0.1) {
    await page.evaluate(
      (y) => window.scrollTo(0, Math.max(0, Math.min(y, document.body.scrollHeight - window.innerHeight))),
      pstack.top - 900 + (pstack.height + 900) * f
    );
    await settle(page, 80, 3);
    const s = await page.evaluate(() => document.querySelector(".pstack").dataset.pstack);
    if (s !== undefined) surfacesSeen.add(s);
  }
  check("every surface takes a turn leading", surfacesSeen.size === 3, [...surfacesSeen].join(","));

  const stacked = await page.evaluate(() => ({
    index: document.querySelector(".pstack").dataset.pstack,
    dim: [...document.querySelectorAll(".psurface")].filter(
      (e) => Number(getComputedStyle(e).opacity) < 0.7
    ).length,
  }));
  check("it ends on the last surface", stacked.index === "2", String(stacked.index));
  check("and none of the three is ever hidden", stacked.dim === 0,
    "they recede to 0.76, which reads as depth rather than as disabled");

  /* --- The work screen sequence --- */
  const screens = await geometryOf(page, ".screens", ".screens__stage");
  check("the screen sequence reserves a range", screens && screens.height > screens.stage,
    screens ? `${screens.height} vs ${screens.stage}` : "missing");
  await page.evaluate(
    (g) => window.scrollTo(0, Math.min(g.top + g.height - g.stage - g.sticky, document.body.scrollHeight - window.innerHeight)),
    screens
  );
  await settle(page);
  const resolvedState = await page.evaluate(() => {
    const root = document.querySelector(".screens");
    const items = [...document.querySelectorAll(".screens__item")];
    return {
      active: root.dataset.screensActive,
      module: document.querySelector(".screens__module")?.textContent ?? "",
      /* The reveal has landed when the last screen is painted and unclipped.
         A screen is painted or it is not, so a fractional opacity here is the
         double-exposure defect coming back. */
      painted: items.filter((el) => Number(el.style.getPropertyValue("--screen-show") || 0) === 1).length,
      translucent: items.filter((el) => {
        const o = Number(getComputedStyle(el).opacity);
        return o > 0.001 && o < 0.999;
      }).length,
      uncovered: items.filter(
        (el) =>
          Number(el.style.getPropertyValue("--screen-show") || 0) === 1 &&
          Number(el.style.getPropertyValue("--screen-clip") || 0) === 0
      ).length,
    };
  });
  /* The defect this exists for: the last item never fully resolving. */
  check("it ends on the last screen", resolvedState.active === String(SCREEN_COUNT - 1), String(resolvedState.active));
  check("which is Reports", resolvedState.module === "Reports", resolvedState.module);
  check("and that screen is fully uncovered", resolvedState.uncovered >= 1,
    `${resolvedState.uncovered} uncovered of ${resolvedState.painted} painted`);
  check("no screen is left half drawn on top of another", resolvedState.translucent === 0,
    String(resolvedState.translucent));

  /* The disclosure is not a casualty of the choreography. */
  const disclosure = await page.evaluate(() => {
    const el = document.querySelector(".featured__disclosure");
    return { text: el.textContent.replace(/\s+/g, " ").trim(), visible: el.getClientRects().length > 0,
             opacity: getComputedStyle(el).opacity };
  });
  check("the demo disclosure is still visible", disclosure.visible && Number(disclosure.opacity) > 0.9, disclosure.opacity);
  check("and still exact", disclosure.text.includes("INTERACTIVE ENGINEERING DEMO") &&
    disclosure.text.includes("SYNTHETIC DATA · FRONTEND ONLY"), disclosure.text);

  /* The action is a plain link throughout and never waits for an animation. */
  const cta = await page.evaluate(() => {
    const a = document.querySelector(".featured__cta");
    a.focus();
    return { href: a.getAttribute("href"), focused: document.activeElement === a,
             pointer: getComputedStyle(a).pointerEvents };
  });
  check("the CTA is a normal link", cta.href === "/demos/operations", String(cta.href));
  check("focusable at all times", cta.focused);
  check("and never disabled by the sequence", cta.pointer !== "none", cta.pointer);

  await ctx.close();
  await browser.close();
}

/* ===================================================================== */
section("NO HORIZONTAL OVERFLOW, ANYWHERE, AT ANY PROGRESS");
{
  const browser = await chromium.launch();
  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [430, 932], [390, 844], [360, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await settle(page, 90, 2);

    /* Walk the whole document rather than sampling the sections, because a
       transform that overflows does so between the points anyone would pick.
       Each step waits for its own frame, so no outer settle is needed. */
    const worst = await page.evaluate(async () => {
      let over = -Infinity;
      const max = document.body.scrollHeight - window.innerHeight;
      for (let i = 0; i <= 14; i++) {
        window.scrollTo(0, (max * i) / 14);
        await new Promise((r) => requestAnimationFrame(r));
        over = Math.max(over, document.documentElement.scrollWidth - document.documentElement.clientWidth);
      }
      return over;
    });
    check(`${w}x${h}: no horizontal overflow at any scroll`, worst <= 0, String(worst));
    await ctx.close();
  }
  await browser.close();
}

/* ===================================================================== */
section("REDUCED MOTION LEAVES EVERYTHING READABLE");
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await settle(page, 130, 5);

  const state = await page.evaluate(() => ({
    screensEnhanced: document.querySelectorAll(".screens--enhanced").length,
    pstackEnhanced: document.querySelectorAll(".pstack--enhanced").length,
    traced: document.querySelectorAll(".arch-trace-scope.is-traced").length,
    scenesLive: document.querySelectorAll(".scene--live").length,
    h1: document.querySelector("h1").textContent.trim(),
    boot: getComputedStyle(document.querySelector(".cinit__state--boot")).opacity,
    live: getComputedStyle(document.querySelector(".cinit__state--live")).opacity,
    /* Nothing may be hidden. Every element the choreography touches has to be
       fully present when the choreography is refused. */
    dimScreens: [...document.querySelectorAll(".screens__item")].filter(
      (e) => e.getClientRects().length > 0 && Number(getComputedStyle(e).opacity) < 0.99
    ).length,
    dimScenes: [...document.querySelectorAll(".scene__content")].filter(
      (e) => Number(getComputedStyle(e).opacity) < 0.99
    ).length,
    movedScenes: [...document.querySelectorAll(".scene__content")].filter(
      (e) => getComputedStyle(e).transform !== "none"
    ).length,
    dimSurfaces: [...document.querySelectorAll(".psurface")].filter(
      (e) => Number(getComputedStyle(e).opacity) < 0.99
    ).length,
    dimNodes: [...document.querySelectorAll(".arch-node")].filter(
      (e) => Number(getComputedStyle(e).opacity) < 0.99
    ).length,
    stickyStages: [...document.querySelectorAll(".screens__stage, .pstack__stage")].filter(
      (e) => getComputedStyle(e).position === "sticky"
    ).length,
  }));

  check("no section is enhanced", state.screensEnhanced === 0 && state.pstackEnhanced === 0 && state.traced === 0,
    `${state.screensEnhanced}/${state.pstackEnhanced}/${state.traced}`);
  check("no scene is enhanced either", state.scenesLive === 0, String(state.scenesLive));
  check("nothing is sticky", state.stickyStages === 0, String(state.stickyStages));
  check("the H1 is unchanged", state.h1 === "Engineering intelligent systems.");
  check("the hero shows its settled state at once", Number(state.boot) < 0.02 && Number(state.live) > 0.98);
  check("the visible screen is fully readable", state.dimScreens === 0, String(state.dimScreens));
  check("no scene is left faded", state.dimScenes === 0, String(state.dimScenes));
  check("no scene is left transformed", state.movedScenes === 0, String(state.movedScenes));
  check("every product surface is readable", state.dimSurfaces === 0, String(state.dimSurfaces));
  check("every architecture node is readable", state.dimNodes === 0, String(state.dimNodes));

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check("and there is still no overflow", overflow <= 0, String(overflow));

  await ctx.close();
  await browser.close();
}

/* ===================================================================== */
section("FOCUS AND RESIZE");
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await settle(page, 130, 4);

  /* Nothing the choreography recedes may become unreachable: these sections
     dim, they do not hide, so every control stays in the tab order and none is
     left invisible-but-focusable. */
  const focusables = await page.evaluate(() => {
    const inSection = (sel) => [...document.querySelectorAll(`${sel} a, ${sel} button`)];
    const all = [...inSection(".screens"), ...inSection(".pstack"), ...inSection(".arch-trace-scope")];
    return all
      .filter((el) => {
        /* The genuine failure is LAID OUT BUT INVISIBLE: an element the browser
           still puts in the tab order while nobody can see it.

           Not the same as zero-size, which was the first version of this check
           and reported ten false positives. The architecture section renders a
           linear flow band as a narrow-width alternate to the canvas, and at
           1440 its ancestor is `display: none`. Those buttons measure 0x0 and
           are not focusable at all, because display:none removes an element
           from the tab order outright. Nothing in the tab order was ever
           wrong; the check was.

           `checkVisibility` with opacity off answers "is this rendered", and
           with opacity on answers "can it be seen". Rendered but unseeable is
           the pair that matters. */
        const rendered = el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
        const seeable = el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        return rendered && !seeable && el.closest("[inert]") === null;
      })
      .map((el) => ({ cls: el.className.toString().split(" ")[0] }));
  });
  check("no control is invisible and still reachable", focusables.length === 0,
    focusables.map((f) => f.cls).join(", ").slice(0, 60));

  /* Resize has to re-measure, or the reserved ranges keep coordinates from a
     viewport that no longer exists. */
  const before = await geometryOf(page, ".screens", ".screens__stage");
  await page.setViewportSize({ width: 1024, height: 768 });
  await settle(page, 150, 4);
  const after = await geometryOf(page, ".screens", ".screens__stage");
  check("the screen range is re-measured on resize", before.height !== after.height,
    `${before.height} -> ${after.height}`);

  await page.evaluate(
    (g) => window.scrollTo(0, Math.min(g.top + g.height - g.stage - g.sticky, document.body.scrollHeight - window.innerHeight)),
    after
  );
  await settle(page);
  const stillResolves = await page.evaluate(() => document.querySelector(".screens").dataset.screensActive);
  check("and still resolves to the last screen afterwards", stillResolves === String(SCREEN_COUNT - 1),
    String(stillResolves));

  /* Below its threshold the product stack stands down entirely. */
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page, 150, 4);
  const narrow = await page.evaluate(() => ({
    enhanced: document.querySelectorAll(".pstack--enhanced").length,
    sticky: getComputedStyle(document.querySelector(".pstack__stage")).position,
  }));
  check("the product stack is off on a phone", narrow.enhanced === 0 && narrow.sticky !== "sticky",
    `${narrow.enhanced} / ${narrow.sticky}`);

  await ctx.close();
  await browser.close();
}

/* ===================================================================== */
section("CERTIFICATIONS ARE UNTOUCHED");
{
  const source = readFileSync(new URL("../src/content/certifications.ts", import.meta.url), "utf8");
  check("production certifications are still empty", /export const CERTIFICATIONS: Certification\[\] = \[\];/.test(source));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await settle(page, 120, 3);
  check("no certifications section renders", (await page.$$eval("#certifications, .certs", (n) => n.length)) === 0);
  check("no credential card renders", (await page.$$eval(".cert-card", (n) => n.length)) === 0);
  await ctx.close();
  await browser.close();
}

console.log(
  `\n=== stage 09G motion: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
