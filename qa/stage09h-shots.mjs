/**
 * Stage 09H visual capture.
 *
 * The suites prove the page is correct. This proves it is not ugly, which is a
 * different question and the one that was missed: the first build of the work
 * sequence passed every check while showing an unreadable double exposure of
 * two dashboards, because the checks asserted the arithmetic and nobody opened
 * the frames.
 *
 * It writes, at 1440x900 unless stated:
 *
 *   61  the five section handoffs, before / mid / after
 *   62  every one of the eleven work screens, at the moment its label changes
 *   63  the pointer field at left, centre and right
 *   64  mobile at 390x844
 *   65  reduced motion
 *
 * The PNGs are NOT committed. They are 21MB, they are a judgement aid rather
 * than a baseline, and this file reproduces them in a couple of minutes:
 *
 *   OUT=qa/shots/stage09h node qa/stage09h-shots.mjs
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.env.OUT ?? "qa/shots/stage09h";
/* Defaults to the local preview, but points anywhere: the same frames have to
   be checkable against the deployed site, because a build that is correct on
   loopback and wrong in production is the only kind of wrong that matters. */
const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
mkdirSync(OUT, { recursive: true });

const settle = async (p, ms = 90, n = 8) => {
  for (let i = 0; i < n; i++) {
    await p.waitForTimeout(ms);
    await p.screenshot();
  }
  await p.waitForTimeout(ms);
};

const b = await chromium.launch();

/* --- 61: the five section handoffs, before / mid / after ---------------- */
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settle(p, 150, 6);
  await p.mouse.move(1050, 340);
  await settle(p, 80, 8);

  const tops = await p.evaluate(() => {
    const o = {};
    for (const el of document.querySelectorAll(".scene")) {
      const r = el.getBoundingClientRect();
      o[el.dataset.scene] = Math.round(r.top + scrollY);
    }
    o._doc = document.body.scrollHeight;
    o._vh = innerHeight;
    return o;
  });
  console.log("GEOM " + JSON.stringify(tops));

  for (const s of ["systems", "products", "learning", "lab", "work"]) {
    for (const [tag, off] of [["before", -760], ["mid", -380], ["after", 60]]) {
      await p.evaluate((y) => scrollTo(0, y), Math.max(0, tops[s] + off));
      await settle(p, 80, 7);
      await p.screenshot({ path: `${OUT}/61-${s}-${tag}.png` });
    }
  }
  await c.close();
}

/* --- 62: every one of the eleven work screens -------------------------- */
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settle(p, 150, 6);
  const g = await p.evaluate(() => {
    const r = document.querySelector(".screens");
    const st = document.querySelector(".screens__stage");
    return {
      top: Math.round(r.getBoundingClientRect().top + scrollY),
      h: r.offsetHeight,
      s: st.offsetHeight,
    };
  });
  const seen = new Set();
  for (let i = 0; i <= 40; i++) {
    await p.evaluate((y) => scrollTo(0, y), Math.round(g.top + ((g.h - g.s) * i) / 40));
    await settle(p, 70, 5);
    const label = await p.evaluate(() => document.querySelector(".screens__module")?.textContent ?? "");
    if (label && !seen.has(label)) {
      seen.add(label);
      await p.screenshot({ path: `${OUT}/62-${String(seen.size).padStart(2, "0")}-${label}.png` });
    }
  }
  console.log("SCREENS " + [...seen].join(","));
  await c.close();
}

/* --- 63: the pointer field at left, centre and right ------------------- */
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settle(p, 150, 6);
  for (const [tag, x, y] of [["left", 120, 700], ["centre", 720, 420], ["right", 1330, 180]]) {
    await p.mouse.move(x, y);
    await settle(p, 80, 14);
    const pos = await p.evaluate(() => {
      const el = document.querySelector("[data-scene='hero']");
      return `${el.style.getPropertyValue("--pointer-x")},${el.style.getPropertyValue("--pointer-y")}`;
    });
    console.log(`POINTER ${tag} ${pos}`);
    await p.screenshot({ path: `${OUT}/63-pointer-${tag}.png` });
  }
  await c.close();
}

/* --- 64: mobile ------------------------------------------------------- */
{
  const c = await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const p = await c.newPage();
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settle(p, 150, 6);
  const doc = await p.evaluate(() => document.body.scrollHeight);
  for (let i = 0; i < 7; i++) {
    await p.evaluate((y) => scrollTo(0, y), Math.round((doc * i) / 7));
    await settle(p, 70, 5);
    await p.screenshot({ path: `${OUT}/64-mobile-${i}.png` });
  }
  await c.close();
}

/* --- 65: reduced motion ----------------------------------------------- */
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await c.newPage();
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settle(p, 150, 6);
  const doc = await p.evaluate(() => document.body.scrollHeight);
  for (let i = 0; i < 6; i++) {
    await p.evaluate((y) => scrollTo(0, y), Math.round((doc * i) / 6));
    await settle(p, 70, 4);
    await p.screenshot({ path: `${OUT}/65-reduced-${i}.png` });
  }
  await c.close();
}

await b.close();
console.log("VISUAL CAPTURE DONE");
