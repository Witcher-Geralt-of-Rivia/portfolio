/**
 * Stage 09I visual proof.
 *
 * The suites prove the pins hold and the numbers are right. This produces the
 * frames a person has to look at, because every defect in this stage that
 * mattered was invisible to an assertion:
 *
 *   a pin that reported as configured and did not hold
 *   three surfaces resolving into an overlapping cluster
 *   a screenshot cropped by a frame that had stopped matching its ratio
 *   a frame that opened completely empty
 *
 * The last one is the sharpest example: the suite was passing 35 out of 35 with
 * it present, because every check sampled from inside the sequence.
 *
 * It writes, at 1440x900 unless stated:
 *
 *   A  the product story: approach, four states, release
 *   B  the work story: approach, all eleven modules, release
 *   C  the Lab to Work handoff, across its scrub
 *   D  mobile at 390x844
 *   E  reduced motion
 *
 * The PNGs are not committed. They are a judgement aid rather than a baseline.
 *
 *   OUT=<dir> QA_BASE=<origin> node qa/stage09i-shots.mjs
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.env.OUT ?? "qa/shots/stage09i";
const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

/* A double rAF rather than a screenshot: both force a frame, and under software
   GL with the fluid running a screenshot costs seconds. */
const frame = async (page, n = 3) => {
  for (let i = 0; i < n; i++) {
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    );
    await page.waitForTimeout(40);
  }
};

const open = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForTimeout(3500);
  return { ctx, page };
};

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, timeout: 180000 });

const geometry = (page) =>
  page.evaluate(() => {
    const r = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      return { top: Math.round(e.getBoundingClientRect().top + scrollY), h: e.offsetHeight };
    };
    return { pstory: r(".pstory"), screens: r(".screens") };
  });

/* --- A: the product story --------------------------------------------- */
{
  const { ctx, page } = await open();
  const geo = await geometry(page);
  console.log("GEO " + JSON.stringify(geo));
  for (let i = 0; i <= 6; i++) {
    const y = Math.round(geo.pstory.top - 300 + (geo.pstory.h + 300) * (i / 6));
    await page.evaluate((v) => scrollTo(0, v), y);
    await frame(page);
    const s = await page.evaluate(() => ({
      top: Math.round(document.querySelector(".pstory__stage").getBoundingClientRect().top),
      caption: [...document.querySelectorAll(".pstory__caption")]
        .filter((e) => Number(getComputedStyle(e).opacity) > 0.5)
        .map((e) => e.textContent.trim().slice(0, 22))[0],
    }));
    console.log(`A${i} stageTop=${s.top} caption="${s.caption ?? ""}"`);
    await shot(page, `A-product-${i}`);
  }
  await ctx.close();
}

/* --- B: the work story, one frame per module -------------------------- */
{
  const { ctx, page } = await open();
  const geo = await geometry(page);
  const seen = new Set();
  for (let i = 0; i <= 46; i++) {
    const y = Math.round(geo.screens.top - 200 + (geo.screens.h + 200) * (i / 46));
    await page.evaluate((v) => scrollTo(0, v), y);
    await frame(page, 2);
    const s = await page.evaluate(() => ({
      label: document.querySelector(".screens__module")?.textContent ?? "",
      top: Math.round(document.querySelector(".screens__stage").getBoundingClientRect().top),
    }));
    if (s.label && !seen.has(s.label)) {
      seen.add(s.label);
      console.log(`B ${String(seen.size).padStart(2, "0")} ${s.label} stageTop=${s.top}`);
      await shot(page, `B-work-${String(seen.size).padStart(2, "0")}-${s.label}`);
    }
  }
  console.log("B SCREENS " + [...seen].join(","));
  await ctx.close();
}

/* --- C: the Lab to Work handoff --------------------------------------- */
{
  const { ctx, page } = await open();
  const geo = await geometry(page);
  for (let i = 0; i <= 5; i++) {
    const y = Math.round(geo.screens.top - 900 + (900 * i) / 5);
    await page.evaluate((v) => scrollTo(0, v), y);
    /* More frames than elsewhere: this block reads a scrubbed opacity rather
       than a layout position, and a single under-settled sample reported the
       plane stuck at 1 on a handoff that scrubs correctly. */
    await frame(page, 6);
    const s = await page.evaluate(() => ({
      plane: Number(getComputedStyle(document.querySelector(".screens__handoff")).opacity).toFixed(2),
      frameTop: Math.round(document.querySelector(".screens__frame").getBoundingClientRect().top),
    }));
    console.log(`C${i} plane=${s.plane} frameTop=${s.frameTop}`);
    await shot(page, `C-handoff-${i}`);
  }
  await ctx.close();
}

/* --- D: mobile --------------------------------------------------------- */
{
  const { ctx, page } = await open({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const doc = await page.evaluate(() => document.body.scrollHeight);
  for (let i = 0; i < 6; i++) {
    await page.evaluate((v) => scrollTo(0, v), Math.round((doc * i) / 6));
    await frame(page, 2);
    await shot(page, `D-mobile-${i}`);
  }
  await ctx.close();
}

/* --- E: reduced motion -------------------------------------------------- */
{
  const { ctx, page } = await open({ reducedMotion: "reduce" });
  const doc = await page.evaluate(() => document.body.scrollHeight);
  for (let i = 0; i < 5; i++) {
    await page.evaluate((v) => scrollTo(0, v), Math.round((doc * i) / 5));
    await frame(page, 2);
    await shot(page, `E-reduced-${i}`);
  }
  await ctx.close();
}

await browser.close();
console.log("VISUAL PROOF DONE -> " + OUT);
