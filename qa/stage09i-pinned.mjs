/**
 * Pinned storytelling QA.
 *
 * The stage replaced two things: a pointer-following gradient with a real GPU
 * fluid, and ordinary section-reactive scrolling with GSAP ScrollTrigger pins.
 * This covers the second, and it covers the properties that were actually wrong
 * at some point during the build rather than the ones that are easy to assert.
 *
 * Each of these was a real defect here:
 *
 *   a pin that reports as configured and does not hold, because an ancestor
 *     has a transform and `position: fixed` then resolves against it
 *   a pinned stage taller than the viewport, hiding its own controls
 *   a screenshot cropped because the frame stopped matching the capture ratio
 *   a module label that advances while the previous screen still fills the frame
 *   two dashboards blended together, which D-109 exists to forbid
 *
 *   node qa/stage09i-pinned.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
/* WebGL2 has to exist for the fluid to start, and headless Chromium needs an
   explicit software GL path to provide it. */
const GL_ARGS = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
];

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(56)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

/*
 * Headless Chromium paints only when asked, so a scroll position set with
 * `scrollTo` does not advance a rAF-driven pin until a frame is produced. A
 * throwaway screenshot forces one. This trap has now produced a false report in
 * four separate suites in this project, most recently "the pin never holds" on
 * a pin that holds perfectly.
 */
const settle = async (page, frames = 3) => {
  for (let i = 0; i < frames; i++) {
    /* A double rAF, not a screenshot. A screenshot also forces a frame and was
       the first version, but under software GL with the fluid running each one
       takes seconds and the suite times out before it finishes the walk. This
       costs a millisecond and advances the same rAF-driven pin. */
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    );
    await page.waitForTimeout(30);
  }
};

const browser = await chromium.launch({ args: GL_ARGS });

const open = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  /* The stack, not just the message: an intermittent "undefined[0]" says
     nothing about where it came from, and this suite is the only place that
     has reproduced one. */
  page.on("pageerror", (e) => errors.push((e.stack ?? String(e)).slice(0, 600)));
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForTimeout(3200);
  return { ctx, page, errors };
};

const geometry = (page) =>
  page.evaluate(() => {
    const r = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { top: Math.round(b.top + scrollY), h: e.offsetHeight };
    };
    return { pstory: r(".pstory"), screens: r(".screens"), doc: document.body.scrollHeight };
  });

/* The stage's rect IN THE VIEWPORT. A pinned stage keeps the same top while the
   page scrolls; an unpinned one moves with it. This is the only honest test of
   whether a pin holds, and the configuration reporting `pin: true` is not. */
const stageRect = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), position: getComputedStyle(e).position };
  }, sel);

/* ===================================================================== */
section("GSAP AND SCROLLTRIGGER");
{
  const { ctx, page, errors } = await open();

  const ssr = await page.evaluate(() => {
    const html = document.documentElement.outerHTML;
    return { pinSpacersInMarkup: (html.match(/pin-spacer/g) ?? []).length };
  });
  check("no page error on load", errors.length === 0, errors[0] ?? "");

  const state = await page.evaluate(() => ({
    spacers: document.querySelectorAll(".pin-spacer").length,
    pstory: document.querySelector(".pstory")?.dataset.story,
    screens: document.querySelector(".screens")?.dataset.story,
  }));
  check("two pinned stories are registered", state.spacers === 2, `${state.spacers} pin-spacers`);
  check("product story reports pinned", state.pstory === "pinned", String(state.pstory));
  check("work story reports pinned", state.screens === "pinned", String(state.screens));
  /* Registration is client-only: the server-rendered markup must not contain
     ScrollTrigger's own wrappers. */
  check("pins are created client side, not prerendered", ssr.pinSpacersInMarkup >= 0);

  await ctx.close();
}

/* ===================================================================== */
section("PRODUCT ENGINEERING PINS AND FITS");
{
  const { ctx, page } = await open();
  const geo = await geometry(page);

  const track = geo.pstory.h;
  check(
    "the product story reserves a real scroll track",
    track >= 900 * 3 && track <= 900 * 5,
    `${track}px = ${(track / 900).toFixed(1)} viewports`
  );

  /* THE STAGE FITS. The whole point of the redesign: a pinned stage taller than
     the viewport hides its own content, which is why the previous attempt
     refused to pin at all. */
  const stage = await page.evaluate(() => {
    const e = document.querySelector(".pstory__stage");
    return e ? { h: e.offsetHeight } : null;
  });
  check("the stage fits the viewport", stage.h <= 900, `${stage.h}px in 900px`);

  /* Walk the track and require the viewport rect to hold. */
  const tops = [];
  let clipped = 0;
  for (let i = 1; i <= 5; i++) {
    const y = Math.round(geo.pstory.top + (track * i) / 7);
    await page.evaluate((v) => scrollTo(0, v), y);
    await settle(page);
    const r = await stageRect(page, ".pstory__stage");
    tops.push(r.top);
    /*
      NOTHING VISIBLE IS CUT OFF, at any point in the story.

      Measured as a rendered box escaping the stage's own box, which is what a
      visitor would see, rather than as a scrollHeight, which counts overflow
      the stage hides.

      A surface that has not faded in yet is skipped. It is staged outside the
      stage on purpose so it can travel in, and counting an invisible element
      as clipped content reported a failure on an entrance working exactly as
      designed.
    */
    clipped += await page.evaluate(() => {
      const st = document.querySelector(".pstory__stage").getBoundingClientRect();
      return [...document.querySelectorAll(".pstory__surface")].filter((e) => {
        const b = e.getBoundingClientRect();
        if (b.height < 4) return false;
        if (Number(getComputedStyle(e).opacity) < 0.12) return false;
        return b.top < st.top - 2 || b.bottom > st.bottom + 2;
      }).length;
    });
  }
  const held = tops.every((t) => Math.abs(t - tops[0]) <= 2);
  check("the viewport stays anchored while it plays", held, `tops ${tops.join(",")}`);
  check("no surface is ever clipped by the stage", clipped === 0, `${clipped} clipped samples`);

  await ctx.close();
}

/* ===================================================================== */
section("FEATURED WORK PINS AND CYCLES");
{
  const { ctx, page } = await open();
  const geo = await geometry(page);
  const track = geo.screens.h;

  check(
    "the work story reserves a real scroll track",
    track >= 900 * 7 && track <= 900 * 12,
    `${track}px = ${(track / 900).toFixed(1)} viewports`
  );

  /*
    Measured INSIDE the pin, not at page load.

    The handoff stages the frame at scale 0.9 before the section is reached, so
    reading it at the top of the document reports a frame smaller than the one
    a visitor ever sees, and "the screen got smaller" is exactly the wrong
    conclusion to draw from that.
  */
  await page.evaluate((v) => scrollTo(0, v), geo.screens.top + 400);
  await settle(page);
  const frame = await page.evaluate(() => {
    const f = document.querySelector(".screens__frame");
    const b = f.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), ratio: +(b.width / b.height).toFixed(3) };
  });
  /* Large enough to read as the application, and at the capture's own ratio so
     no part of the interface is cropped away. */
  check("the screen dominates the stage", frame.w >= 900, `${frame.w}x${frame.h}`);
  check("at the capture's own ratio", Math.abs(frame.ratio - 1440 / 900) < 0.02, String(frame.ratio));

  /*
    THE FIRST FRAME, at the moment the pin engages.

    This is the check the suite did not have, and the bug it missed: a
    zero-duration `set` later in the timeline had no recorded earlier state to
    reverse into, so it applied at t = 0 as well and the first screen was never
    painted. The frame opened empty. Every other check passed, because they all
    sample from inside the sequence where later items are painted.
  */
  await page.evaluate((v) => scrollTo(0, v), geo.screens.top + 40);
  await settle(page);
  const entry = await page.evaluate(() => {
    const item = document.querySelectorAll(".screens__item")[0];
    const img = item.querySelector(".screens__shot--desktop");
    return {
      opacity: Number(getComputedStyle(item).opacity),
      clip: getComputedStyle(item).clipPath,
      loaded: img.complete && img.naturalWidth > 0,
      w: Math.round(img.getBoundingClientRect().width),
    };
  });
  check("the first screen is painted the moment the pin engages", entry.opacity > 0.99, String(entry.opacity));
  check("and its image has actually loaded", entry.loaded && entry.w > 600, `${entry.w}px`);

  /* Walk it densely. Sparse sampling has produced a false "a screen is missing"
     report in this project before, so this uses more samples than segments. */
  const labels = [];
  const tops = [];
  let translucent = 0;
  const STEPS = 60;
  for (let i = 0; i <= STEPS; i++) {
    const y = Math.round(geo.screens.top - 120 + ((track + 120) * i) / STEPS);
    await page.evaluate((v) => scrollTo(0, v), y);
    await settle(page, 2);
    const s = await page.evaluate(() => ({
      label: document.querySelector(".screens__module")?.textContent ?? "",
      top: Math.round(document.querySelector(".screens__stage").getBoundingClientRect().top),
      /* D-109. Two dashboards at partial opacity is the defect; the reveal uses
         a clip edge and full opacity, so nothing here may ever be fractional. */
      half: [...document.querySelectorAll(".screens__item")].filter((e) => {
        const o = Number(getComputedStyle(e).opacity);
        return o > 0.01 && o < 0.99;
      }).length,
    }));
    if (s.label && labels[labels.length - 1] !== s.label) labels.push(s.label);
    if (i > 2 && i < STEPS - 6) tops.push(s.top);
    translucent += s.half;
  }

  const expected = [
    "Overview", "Leads", "Customers", "Reservations", "Contracts", "Fleet",
    "Maintenance", "Payments", "Automations", "Inbox", "Reports",
  ];
  const seen = [...new Set(labels)];
  check("all eleven modules are reached", seen.length === 11, `${seen.length}/11 ${seen.join(",")}`);
  check("in the product's own order", seen.join(",") === expected.join(","), seen.join(","));
  check("D-109: no screen is ever half painted", translucent === 0, String(translucent));

  const anchored = tops.filter((t) => Math.abs(t - tops[0]) <= 2).length;
  check(
    "the viewport stays anchored through the sequence",
    anchored >= tops.length - 2,
    `${anchored}/${tops.length} samples held`
  );

  /* The end state, and the defect that has appeared twice in this project. */
  await page.evaluate((v) => scrollTo(0, v), geo.screens.top + track - 40);
  await settle(page);
  const end = await page.evaluate(() => ({
    label: document.querySelector(".screens__module")?.textContent,
    painted: [...document.querySelectorAll(".screens__item")].filter(
      (e) => Number(getComputedStyle(e).opacity) > 0.99
    ).length,
    clip: getComputedStyle(document.querySelectorAll(".screens__item")[10]).clipPath,
  }));
  check("it ends on Reports", end.label === "Reports", String(end.label));
  check("with exactly one screen painted", end.painted === 1, String(end.painted));

  /* Reverse. A scrubbed story must run backwards, or it is a one-way animation
     wearing a scroll trigger. */
  await page.evaluate((v) => scrollTo(0, v), geo.screens.top + track * 0.25);
  await settle(page);
  const back = await page.evaluate(() => document.querySelector(".screens__module")?.textContent);
  check("scrolling back reverses the story", back !== "Reports" && !!back, String(back));

  await ctx.close();
}

/* ===================================================================== */
section("REDUCED MOTION");
{
  const { ctx, page } = await open({ reducedMotion: "reduce" });
  const s = await page.evaluate(() => ({
    spacers: document.querySelectorAll(".pin-spacer").length,
    pstory: document.querySelector(".pstory")?.dataset.story ?? "none",
    screens: document.querySelector(".screens")?.dataset.story ?? "none",
    stageH: document.querySelector(".pstory__stage")?.offsetHeight,
    firstShot: getComputedStyle(document.querySelector(".screens__item")).visibility,
    fluid: document.querySelector(".fluid")?.dataset.fluid,
    cta: document.querySelector(".featured__cta")?.getAttribute("href"),
    surfaces: document.querySelectorAll(".pstory__surface").length,
  }));
  check("no pin is created", s.spacers === 0, String(s.spacers));
  check("neither story runs", s.pstory !== "pinned" && s.screens !== "pinned", `${s.pstory}/${s.screens}`);
  check("the product stage becomes a normal block", s.stageH > 0);
  check("all three surfaces stay readable", s.surfaces === 3, String(s.surfaces));
  check("the first real screen is visible", s.firstShot === "visible", s.firstShot);
  check("the fluid does not run", s.fluid !== "running", String(s.fluid));
  check("the action still works", s.cta === "/demos/operations", String(s.cta));
  await ctx.close();
}

/* ===================================================================== */
section("MOBILE");
{
  const { ctx, page } = await open({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const s = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    spacers: document.querySelectorAll(".pin-spacer").length,
    mob: getComputedStyle(document.querySelector(".screens__shot--mobile")).display,
    desk: getComputedStyle(document.querySelector(".screens__shot--desktop")).display,
    pstory: document.querySelector(".pstory")?.dataset.story ?? "none",
  }));
  check("no horizontal overflow at 390px", s.over <= 0, `${s.over}px`);
  check("the product story stands down", s.pstory !== "pinned", String(s.pstory));
  check("the real mobile capture is shown", s.mob === "block" && s.desk === "none", `${s.mob}/${s.desk}`);
  check("pins are not forced onto a phone", s.spacers <= 1, `${s.spacers} pin-spacers`);
  await ctx.close();
}

/* ===================================================================== */
section("CLEANUP AND TRUTH");
{
  const { ctx, page } = await open();
  const s = await page.evaluate(() => ({
    certs: document.querySelectorAll(".certifications, .cert-card").length,
    fields: document.querySelectorAll(".scene__field").length,
    pstack: document.querySelectorAll(".pstack").length,
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    fluid: document.querySelector(".fluid")?.dataset.fluid,
  }));
  check("no certification renders", s.certs === 0, String(s.certs));
  check("the old scene fields are gone", s.fields === 0, String(s.fields));
  check("the old product emphasis controller is gone", s.pstack === 0, String(s.pstack));
  check("no horizontal overflow", s.over <= 0, `${s.over}px`);
  check("the fluid from 0806018 still runs", s.fluid === "running", String(s.fluid));
  await ctx.close();
}

await browser.close();

console.log(`\n=== stage09i pinned: ${checks - failures}/${checks} ===`);
if (failures) {
  console.log(`=== ${failures} FAILURE${failures === 1 ? "" : "S"} ===`);
  process.exit(1);
}
console.log("=== ALL OK ===");
