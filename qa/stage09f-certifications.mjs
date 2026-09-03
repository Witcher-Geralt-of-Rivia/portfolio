/**
 * Certifications QA.
 *
 * The section publishes claims about credentials, and there are no credentials.
 * So this suite has two halves that answer two different questions.
 *
 * The first half needs no browser at all: `deck-geometry.ts` is pure, so the
 * choreography's arithmetic is checked at every card count and every breakpoint
 * in milliseconds rather than by scrolling. A scroll animation whose maths is
 * only observable by scrolling is a scroll animation nobody can debug.
 *
 * The second half needs one, and it runs against a fixture route that does not
 * exist in the committed tree. That is the house convention: the synthetic
 * credentials live under `qa/`, creating the route is a deliberate act, and the
 * production page is checked separately for their absence.
 *
 * The production check is the one that matters most and it is the cheapest:
 * with an empty collection the homepage must contain no certifications section,
 * no card, and none of the fixture strings. That is a hard failure condition in
 * the brief and it is asserted three ways.
 *
 *   node qa/stage09f-certifications.mjs
 *
 * Geometry and production checks run always. The specimen half runs only when
 * the fixture route is reachable, and says so when it is skipped:
 *
 *   mkdir -p src/app/specimen/certifications
 *   cp qa/fixtures/certifications-specimen.page.tsx src/app/specimen/certifications/page.tsx
 *   npm run build && npx next start -p 3001 -H 127.0.0.1
 *   node qa/stage09f-certifications.mjs
 *   rm -r src/app/specimen/certifications
 */

import { readFileSync } from "node:fs";
import { chromium } from "playwright";

import {
  MAX_STACK_DEPTH,
  MAX_TRAVEL,
  MIN_TRAVEL,
  REVEAL_WINDOW,
  activeIndex,
  cardProgress,
  cardScreenSlot,
  deckCapacity,
  isCardVisible,
  railShift,
  railShiftContinuous,
  revealThreshold,
  scrollRangeHeight,
  scrollTravel,
  sectionProgress,
  stackDepth,
} from "../src/components/certifications/deck-geometry.ts";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";

let failures = 0;
let checks = 0;
let skipped = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)}${detail ? "  " + detail : ""}`);
};
const skip = (label, why) => {
  skipped += 1;
  console.log(`  SKIP  ${label.padEnd(58)}  ${why}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

/**
 * Force a compositor frame, then let the scheduled work land.
 *
 * Headless Chromium does not necessarily paint a page nobody is looking at, and
 * `requestAnimationFrame` does not fire without a frame. The deck's whole
 * choreography is RAF-scheduled, so without this every card reads
 * `--cert-cp: 0` forever and the suite reports a broken animation that works
 * correctly in a real browser. A throwaway screenshot is the cheapest way to
 * make the compositor produce a frame.
 */
const settle = async (page, ms = 350) => {
  await page.waitForTimeout(ms);
  await page.screenshot();
  await page.waitForTimeout(ms);
};

/* ===================================================================== */
section("GEOMETRY - THE CHOREOGRAPHY'S ARITHMETIC");
{
  /* The property the whole reveal model rests on: every card ends fully
     resolved exactly as the section releases, at every count. If this drifts, a
     credential is left half-faded when the deck unpins. */
  const countsFullyResolve = [1, 2, 3, 4, 5, 7, 12].every((n) =>
    Array.from({ length: n }, (_, i) => cardProgress(1, i, n)).every((p) => p === 1)
  );
  check("every card is fully resolved at progress 1", countsFullyResolve);

  /* And the deck exists at entry. This is the requirement that forced the
     reveal window forward off the threshold rather than backward into it. */
  const deckAtEntry = [2, 3, 5].every((n) =>
    Array.from({ length: n }, (_, i) => cardProgress(0, i, n)).every((p) => p === 0)
  );
  check("nothing is resolved at progress 0, so there is a deck", deckAtEntry);

  check("card 01 resolves first", cardProgress(0.1, 0, 5) > cardProgress(0.1, 1, 5));
  check(
    "and cards resolve in order at any progress",
    [0.2, 0.4, 0.6, 0.8].every((p) => {
      const ps = Array.from({ length: 5 }, (_, i) => cardProgress(p, i, 5));
      return ps.every((v, i) => i === 0 || ps[i - 1] >= v);
    })
  );

  /* Overlap, which is what makes it a fold rather than a slideshow. */
  const gap = revealThreshold(1, 5) - revealThreshold(0, 5);
  check("reveals overlap rather than snap", REVEAL_WINDOW > gap, `window ${REVEAL_WINDOW} > gap ${gap.toFixed(3)}`);

  check("progress is clamped below", cardProgress(-5, 0, 3) === 0);
  check("progress is clamped above", cardProgress(5, 2, 3) === 1);
  check("a single card is handled", revealThreshold(0, 1) === 0 && cardProgress(1, 0, 1) === 1);
  check(
    "a non-finite progress does not produce NaN",
    Number.isFinite(cardProgress(NaN, 1, 3)) && Number.isFinite(cardProgress(Infinity, 1, 3))
  );

  /* Active index, which drives the counter, aria-current and the rail. */
  check("the active card starts at the first", activeIndex(0, 5) === 0);
  check("and ends at the last", activeIndex(1, 5) === 4);
  check(
    "and never leaves the collection",
    [0, 0.13, 0.5, 0.77, 1].every((p) => {
      const a = activeIndex(p, 5);
      return Number.isInteger(a) && a >= 0 && a < 5;
    })
  );
  check("it advances monotonically", (() => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const a = activeIndex(p, 5);
      if (a < last) return false;
      last = a;
    }
    return true;
  })());
}

/* ===================================================================== */
section("GEOMETRY - CAPACITY AND THE SLIDING RAIL");
{
  /* Capacity is measured, so these are the real numbers: a 1200px content
     frame, a 306px card and a 20px gap fit three, not five. Asserting five
     because the viewport is wide was the original error and it put two
     focusable cards off the edge of the clip. */
  check("a 1200px frame fits three 306px cards", deckCapacity(1200, 306, 20) === 3, String(deckCapacity(1200, 306, 20)));
  check("a 921px frame fits three 288px cards", deckCapacity(921, 288, 20) === 3, String(deckCapacity(921, 288, 20)));
  check("a 691px frame fits two", deckCapacity(691, 288, 20) === 2, String(deckCapacity(691, 288, 20)));
  check("a 350px phone frame fits one", deckCapacity(350, 300, 14) === 1, String(deckCapacity(350, 300, 14)));
  check("capacity is never zero", deckCapacity(10, 300, 14) === 1 && deckCapacity(0, 300, 14) === 1);
  check(
    "the arithmetic is exact at the boundary",
    deckCapacity(632, 306, 20) === 2 && deckCapacity(631, 306, 20) === 1,
    `${deckCapacity(632, 306, 20)} / ${deckCapacity(631, 306, 20)}`
  );
  check(
    "capacity never increases as the frame narrows",
    (() => {
      let last = Infinity;
      for (let w = 1600; w >= 200; w -= 10) {
        const c = deckCapacity(w, 306, 20);
        if (c > last) return false;
        last = c;
      }
      return true;
    })()
  );
  check("bad input does not produce NaN", Number.isInteger(deckCapacity(NaN, NaN, NaN)));

  /* The rail is how "more credentials than fit" and "one card at a time on a
     phone" become the same mechanism. */
  check("a deck that fits never slides", railShift(0.5, 4, 5) === 0 && railShift(1, 5, 5) === 0);
  /* The property that matters on a phone is that every credential gets its own
     turn as the active card, in order, and none is skipped. Sampling five
     evenly spaced points does NOT show that and asserting it would be wrong:
     the reveal windows overlap, so the active card changes at 0.335, 0.5,
     0.665 and 0.83 rather than at the quarters. Walk the whole range instead. */
  const shifts = [];
  for (let p = 0; p <= 1.0001; p += 0.005) {
    const s = railShift(p, 5, 1);
    if (shifts[shifts.length - 1] !== s) shifts.push(s);
  }
  check(
    "a phone advances one slot per card, every card, in order",
    shifts.join(",") === "0,1,2,3,4",
    shifts.join(",")
  );
  /* Said accurately: `activeIndex` takes no capacity, so looping over
     capacities here would have run the identical assertion three times and
     claimed more than it checked. Capacity is exercised where it is actually an
     input, in the rail and the visible window below. */
  check(
    "every credential takes a turn as the active one",
    (() => {
      const seen = new Set();
      for (let p = 0; p <= 1.0001; p += 0.005) seen.add(activeIndex(p, 5));
      return seen.size === 5;
    })()
  );
  check(
    "the rail never slides past the end",
    [1, 2, 3, 5].every((cap) =>
      [0, 0.5, 1].every((p) => railShift(p, 9, cap) <= 9 - cap)
    )
  );
  check("and never slides backwards", railShift(0, 9, 3) === 0);

  /* The visible window, which decides what is inert. A card outside it is
     translated out of an overflow-hidden clip: invisible, but still in the tab
     order unless something says otherwise. */
  /* Visibility is judged from the rendered position, not an index window: an
     index window and a sliding rail disagree exactly on the card that is half
     in, which is the only one it matters for. */
  check(
    "an unresolved card sits at the window whatever the rail is doing",
    [0, 1.4, 3.9].every((shift) => Math.abs(cardScreenSlot(0, 4, 5, shift)) < 1e-9)
  );
  check(
    "a resolved card sits where its index is relative to the rail",
    Math.abs(cardScreenSlot(1, 4, 5, 4) - 0) < 1e-9 &&
      Math.abs(cardScreenSlot(1, 2, 5, 4) - -2) < 1e-9
  );
  /* The invariant that matters, and it is not "the active card is centred".

     `activeIndex` calls a card active once it is half resolved, which happens
     while it is still sliding in from the right, so asserting THAT card sits in
     the window would forbid the arrival the section is built around. And the
     rail slides continuously rather than in slot steps, so mid-transition two
     adjacent cards share the window, each about half in. That is what a rail
     looks like while it moves and it is deliberate: the alternative, snapping
     slot to slot, was tried and is what put the active card off a phone screen.

     What must always hold is that the cards stay CONTIGUOUS: the rail may
     leave the deck compact at entry, and it may sit between slots while it
     moves, but it must never open a hole between two credentials. */
  check(
    "cards stay contiguous, so the rail never opens a hole",
    (() => {
      for (const cap of [1, 2, 3]) {
        for (let p = 0; p <= 1.0001; p += 0.002) {
          const shift = railShiftContinuous(p, 5, cap);
          const slots = Array.from({ length: 5 }, (_, i) => cardScreenSlot(p, i, 5, shift));
          for (let i = 1; i < 5; i++) {
            /* A card is one slot wide, so neighbours more than a slot apart
               have a gap between them. Overlapping is fine and is exactly what
               the deck does while it is still stacked.

               The tolerance is 0.01 of a slot, about three pixels, rather than
               a float epsilon. The two curves being subtracted here cross at
               slightly different rates and leave a worst-case gap of 1.0001
               slots, which is three hundredths of a pixel: real, and not a gap
               anyone can see. A tolerance tighter than a pixel measures
               arithmetic rather than the thing it is standing in for. */
            if (slots[i] - slots[i - 1] > 1.01) return false;
          }
        }
      }
      return true;
    })()
  );
  /* Cards end where they belong: fully unfolded, each exactly one slot from
     the next, with the last one in the window's last slot. */
  check(
    "the deck ends fully unfolded and slot aligned",
    (() => {
      for (const cap of [1, 2, 3]) {
        const shift = railShiftContinuous(1, 5, cap);
        const slots = Array.from({ length: 5 }, (_, i) => cardScreenSlot(1, i, 5, shift));
        for (let i = 1; i < 5; i++) if (Math.abs(slots[i] - slots[i - 1] - 1) > 1e-6) return false;
        if (Math.abs(slots[4] - (cap - 1)) > 1e-6) return false;
      }
      return true;
    })()
  );
  /* And nothing teleports: a card arrives from just outside the window rather
     than appearing from several slots away. */
  check(
    "an arriving card is never more than a slot outside the window",
    (() => {
      for (const cap of [1, 2, 3]) {
        for (let p = 0; p <= 1.0001; p += 0.002) {
          const shift = railShiftContinuous(p, 5, cap);
          for (let i = 0; i < 5; i++) {
            if (cardScreenSlot(p, i, 5, shift) > cap - 1 + 1.05) return false;
          }
        }
      }
      return true;
    })()
  );
  check(
    "every card is on screen at some point in the choreography",
    (() => {
      for (const cap of [1, 2, 3]) {
        const seen = new Set();
        for (let p = 0; p <= 1.0001; p += 0.002) {
          const shift = railShiftContinuous(p, 5, cap);
          for (let i = 0; i < 5; i++) {
            if (isCardVisible(cardScreenSlot(p, i, 5, shift), cap)) seen.add(i);
          }
        }
        if (seen.size !== 5) return false;
      }
      return true;
    })()
  );
  check(
    "a departed card is off screen and therefore inert",
    !isCardVisible(cardScreenSlot(1, 0, 5, 4), 1)
  );

  check(
    "the rail never slides past the end",
    [1, 2, 3, 5].every((cap) =>
      [0, 0.5, 1].every((p) => railShift(p, 9, cap) <= 9 - cap)
    )
  );
  check("and never slides backwards", railShift(0, 9, 3) === 0);

  /* The continuous shift, and the property the integer one violated: the rail
     and the cards it carries must be driven by the same smooth quantity. */
  check("the rail does not move while everything fits", railShiftContinuous(0.5, 3, 3) === 0);
  check("it starts at zero", railShiftContinuous(0, 5, 1) === 0);
  check("and ends at the last full window", Math.abs(railShiftContinuous(1, 5, 1) - 4) < 1e-9, String(railShiftContinuous(1, 5, 1)));
  check(
    "it is monotonic and never jumps a whole slot",
    (() => {
      let last = 0;
      for (let p = 0; p <= 1.0001; p += 0.002) {
        const v = railShiftContinuous(p, 5, 1);
        if (v < last - 1e-9) return false;
        if (v - last > 0.2) return false;
        last = v;
      }
      return true;
    })()
  );

  /* Stack depth, so a large deck does not offset its tail off the page. */
  check("stack depth is bounded", stackDepth(40, 0) === MAX_STACK_DEPTH, String(stackDepth(40, 0)));
  check("a resolved card has no depth", stackDepth(2, 5) === 0);
}

/* ===================================================================== */
section("GEOMETRY - THE SCROLL RANGE IS BOUNDED");
{
  const vh = 900;
  check("no cards means no travel", scrollTravel(0, vh) === 0);
  check("one card still gets a readable minimum", scrollTravel(1, vh) === Math.round(MIN_TRAVEL * vh));
  check(
    "travel grows with the collection",
    scrollTravel(2, vh) > scrollTravel(1, vh) && scrollTravel(4, vh) > scrollTravel(2, vh)
  );

  /* The requirement this suite exists to keep honest: a future collection must
     not turn the section into a tunnel. */
  const ceiling = Math.round(MAX_TRAVEL * vh);
  check("travel is capped", scrollTravel(50, vh) === ceiling, `${scrollTravel(50, vh)}px at 50 cards`);
  check(
    "so a huge collection is bounded, not infinite",
    scrollTravel(500, vh) === scrollTravel(50, vh) && ceiling < 4 * vh,
    `${ceiling}px, under 4 viewports`
  );
  check("the range is the stage plus the travel", scrollRangeHeight(3, vh, 700) === 700 + scrollTravel(3, vh));

  /* Section progress from cached geometry. */
  check("progress before the range is 0", sectionProgress(0, 1000, 2000, 800) === 0);
  check("progress after the range is 1", sectionProgress(9999, 1000, 2000, 800) === 1);
  check("progress halfway is 0.5", sectionProgress(1600, 1000, 2000, 800) === 0.5);
  check(
    "a range with no travel does not divide by zero",
    sectionProgress(500, 0, 800, 800) === 0 && Number.isFinite(sectionProgress(500, 0, 700, 800))
  );
}

/* ===================================================================== */
section("CONTENT - PRODUCTION IS EMPTY AND GATED");
{
  const source = readFileSync(new URL("../src/content/certifications.ts", import.meta.url), "utf8");

  check(
    "the production collection is declared empty",
    /export const CERTIFICATIONS: Certification\[\] = \[\];/.test(source)
  );

  /* The failure this is really guarding: somebody adds a plausible-looking
     example, in a comment or otherwise, and it gets uncommented later. */
  const issuers = ["AWS", "Amazon Web Services", "Microsoft", "Google", "OpenAI", "Coursera", "Udemy", "Meta", "IBM", "Oracle", "Cisco", "CompTIA"];
  const named = issuers.filter((i) => new RegExp(`\\b${i}\\b`).test(source.replace(/no issuer names as placeholders \([^)]*\)/, "")));
  check("no real issuer is named in the production source", named.length === 0, named.join(", "));

  check("no https URL is present", !/https:\/\//.test(source.replace(/https URL/g, "")));
  check("the two-gate accessor exists", /publishableCertifications/.test(source) && /certificationsArePublishable/.test(source));
  check("the gate requires verified status", /status === "verified"/.test(source));
  check("and completeness", /isComplete\(c\)/.test(source));

  /* The URL gate, exercised directly. This is what stops a javascript: URL ever
     reaching an href. */
  const mod = await import("../src/content/certifications.ts");
  check("an https credential URL is accepted", mod.isSafeCredentialUrl("https://example.com/x"));
  check("http is refused", !mod.isSafeCredentialUrl("http://example.com/x"));
  check("javascript: is refused", !mod.isSafeCredentialUrl("javascript:alert(1)"));
  check("data: is refused", !mod.isSafeCredentialUrl("data:text/html,<script>"));
  check("an empty URL is refused", !mod.isSafeCredentialUrl("") && !mod.isSafeCredentialUrl("   "));
  check("a malformed URL is refused", !mod.isSafeCredentialUrl("not a url"));

  check("the empty collection does not publish", mod.certificationsArePublishable() === false);
  check("and publishes nothing", mod.publishableCertifications().length === 0);

  const complete = {
    id: "x", status: "verified", title: "T", issuer: "I",
    issuedAt: "2025-01-01", credentialUrl: "https://example.com/c",
  };
  check("a complete verified record publishes", mod.certificationsArePublishable([complete]));
  check("a draft never publishes", !mod.certificationsArePublishable([{ ...complete, status: "draft" }]));
  check("a record with no URL never publishes", !mod.certificationsArePublishable([{ ...complete, credentialUrl: "" }]));
  check("a record with a javascript URL never publishes", !mod.certificationsArePublishable([{ ...complete, credentialUrl: "javascript:alert(1)" }]));
  check("a bad issue date never publishes", !mod.certificationsArePublishable([{ ...complete, issuedAt: "March 2025" }]));
  check("an impossible date never publishes", !mod.certificationsArePublishable([{ ...complete, issuedAt: "2025-02-30" }]));
  check("a malformed expiry never publishes", !mod.certificationsArePublishable([{ ...complete, expiresAt: "soon" }]));
  check("an absent expiry is fine", mod.certificationsArePublishable([{ ...complete, expiresAt: undefined }]));
}

/* ===================================================================== */
section("FIXTURES ARE NOT IN THE PRODUCT");
{
  const fixture = readFileSync(new URL("./fixtures/certifications-specimen.page.tsx", import.meta.url), "utf8");
  check("the fixture declares itself synthetic", /NONE OF THE CREDENTIALS BELOW ARE REAL/.test(fixture));
  check("its URLs are the reserved example domain", (fixture.match(/https:\/\/example\.com/g) ?? []).length >= 5);
  check(
    "and it points at no other host",
    (fixture.match(/https:\/\/(?!example\.com)[a-z]/g) ?? []).length === 0
  );

  /* Nothing in src/ may import the fixture, which is what keeps it out of the
     bundle regardless of where the file sits. */
  const { execSync } = await import("node:child_process");
  const importers = execSync('git grep -l "certifications-specimen" -- src/ || true', { encoding: "utf8" }).trim();
  check("nothing under src/ imports the fixture", importers === "", importers);

  const routed = execSync('git ls-files src/app/specimen/certifications || true', { encoding: "utf8" }).trim();
  check("the fixture route is not committed", routed === "", routed);
}

/* ===================================================================== */
section("THE PUBLIC PAGE SHOWS NO CERTIFICATIONS");
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  check("no certifications section renders", (await page.$$eval("#certifications, .certs", (n) => n.length)) === 0);
  check("no credential card renders", (await page.$$eval(".cert-card", (n) => n.length)) === 0);
  check("no credential modal exists", (await page.$$eval(".cert-modal", (n) => n.length)) === 0);

  const body = (await page.$eval("body", (e) => e.innerText)).replace(/\s+/g, " ");
  const html = await page.content();

  /* Every invented issuer from the fixture, by name. */
  for (const s of ["Meridian Institute", "Northfield Academy", "Calderwood", "Ashgrove", "Brackenhurst", "Draft Institute"]) {
    check(`the page never says "${s}"`.slice(0, 58), !body.includes(s) && !html.includes(s));
  }
  check("and no fixture URL appears", !html.includes("example.com"));
  check("no credential id appears", !/MIAC-|NASRP-|BTC-|AI-SATM/.test(html));

  /* The page must not merely omit the cards: it must not reserve space for them
     or announce a section that has nothing in it. */
  check("the word Certifications does not appear", !/\bCertifications?\b/i.test(body), "");
  check("no empty gap is reserved", (await page.$$eval(".certs__range", (n) => n.length)) === 0);

  /* Numbering stays coherent: exactly one 05, and it is the featured build. */
  /* Only the numbered ones: the hero carries an unnumbered eyebrow of its own.
     The point of this check is that inserting a section which renders nothing
     leaves no hole in the sequence, and that the featured build has not
     silently advanced to 06 while Certifications shows nothing. */
  const eyebrows = (await page.$$eval(".eyebrow", (n) => n.map((e) => e.textContent.trim())))
    .filter((t) => /^\d{2} \//.test(t));
  check(
    "the numbered sections run 01 to 05 with no gap",
    eyebrows.map((t) => t.slice(0, 2)).join(",") === "01,02,03,04,05",
    eyebrows.join(" | ")
  );
  check(
    "and 05 is the featured build, not a missing certifications section",
    eyebrows[4] === "05 / FEATURED ENGINEERING BUILD",
    eyebrows[4] ?? "(none)"
  );

  check("the page is still error free", problems.length === 0, problems.join(" | ").slice(0, 90));
  await ctx.close();
  await browser.close();
}

/* ===================================================================== */
section("THE SPECIMEN - THE COMPONENT UNDER FIXTURES");
{
  const specimen = `${BASE}/specimen/certifications`;
  let reachable = false;
  try {
    const res = await fetch(specimen, { redirect: "manual" });
    reachable = res.status === 200;
  } catch {
    reachable = false;
  }

  if (!reachable) {
    skip("the whole specimen half", `${specimen} is not routed; see this file's header`);
  } else {
    const browser = await chromium.launch();

    /* --- desktop, five cards --- */
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const problems = [];
      page.on("pageerror", (e) => problems.push(String(e)));
      await page.goto(`${specimen}?n=5`, { waitUntil: "networkidle" });
      await settle(page, 500);

      check("the draft record is refused by the gate", (await page.$$eval(".cert-card", (n) => n.length)) === 5, `${await page.$$eval(".cert-card", (n) => n.length)} cards`);
      check("the choreography is enhanced", (await page.$$eval(".certs__range--enhanced", (n) => n.length)) === 1);

      const atStart = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".cert-card")];
        return cards.map((c) => Number(getComputedStyle(c).getPropertyValue("--cert-cp")));
      });
      check("the deck starts stacked", atStart.every((v) => v < 0.02), atStart.join(","));

      /* Scroll to the middle of the range and to its end. */
      const range = await page.evaluate(() => {
        const el = document.querySelector(".certs__range");
        const r = el.getBoundingClientRect();
        const stage = document.querySelector(".certs__stage");
        /* The stage is pinned at a `top` offset for navigation clearance, so it
           releases that many pixels before the range's own end. Scrolling to
           the range end rather than the release point overshoots and captures a
           section that has already begun to scroll away. */
        const sticky = parseFloat(getComputedStyle(stage).top) || 0;
        return {
          top: r.top + window.scrollY,
          height: el.offsetHeight - sticky,
          stage: stage.offsetHeight,
        };
      });
      await page.evaluate((y) => window.scrollTo(0, y), range.top + (range.height - range.stage) / 2);
      await settle(page);
      const mid = await page.evaluate(() =>
        [...document.querySelectorAll(".cert-card")].map((c) => Number(getComputedStyle(c).getPropertyValue("--cert-cp")))
      );
      check("cards resolve in order mid-range", mid.every((v, i) => i === 0 || mid[i - 1] >= v), mid.map((v) => v.toFixed(2)).join(","));
      check("and some are partly resolved", mid.some((v) => v > 0 && v < 1), mid.map((v) => v.toFixed(2)).join(","));

      /* Scroll to where the stage releases, and never past what the document
         allows: asking for a position the page cannot reach silently measures a
         different progress than the one requested. */
      await page.evaluate((y) => window.scrollTo(0, Math.min(y, document.body.scrollHeight - window.innerHeight)), range.top + range.height - range.stage);
      await settle(page);
      const end = await page.evaluate(() =>
        [...document.querySelectorAll(".cert-card")].map((c) => Number(getComputedStyle(c).getPropertyValue("--cert-cp")))
      );
      check("every card is resolved at the end", end.every((v) => v > 0.99), end.map((v) => v.toFixed(2)).join(","));

      const spread = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".cert-card")];
        const xs = cards.map((c) => Math.round(c.getBoundingClientRect().left));
        return { xs, distinct: new Set(xs).size };
      });
      check("the unfolded deck is spread horizontally", spread.distinct === 5, spread.xs.join(","));

      check("no horizontal overflow", (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
      check("the specimen is error free", problems.length === 0, problems.join(" | ").slice(0, 80));
      await ctx.close();
    }

    /* --- card and modal interaction --- */
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${specimen}?n=3`, { waitUntil: "networkidle" });
      await settle(page, 450);

      check("three fixtures mount three cards", (await page.$$eval(".cert-card", (n) => n.length)) === 3);

      /* The title link must not open the modal. This is the interaction the
         brief singles out, and the one a naive card-wrapping-anchor gets
         wrong. */
      const link = page.locator(".cert-card .cert-link").first();
      check("the title is a real anchor", (await link.getAttribute("href"))?.startsWith("https://"), String(await link.getAttribute("href")));
      check("it opens in a new tab", (await link.getAttribute("target")) === "_blank");
      check("with a safe rel", (await link.getAttribute("rel")) === "noopener noreferrer");

      /* Click it with navigation suppressed, and assert no dialog appeared. */
      await page.evaluate(() => {
        document.querySelector(".cert-card .cert-link").addEventListener("click", (e) => e.preventDefault());
      });
      await link.click();
      await page.waitForTimeout(350);
      check("clicking the title does not open the modal", (await page.$$eval("dialog[open]", (n) => n.length)) === 0);

      /* The card body does. */
      await page.locator(".cert-card__issuer").first().click();
      await page.waitForTimeout(400);
      check("clicking the card body opens the modal", (await page.$$eval("dialog[open]", (n) => n.length)) === 1);
      check("the modal is a native dialog", (await page.$eval(".cert-modal", (e) => e.tagName.toLowerCase())) === "dialog");
      check("it is labelled", (await page.$eval(".cert-modal", (e) => Boolean(e.getAttribute("aria-labelledby")))));
      check("and described", (await page.$eval(".cert-modal", (e) => Boolean(e.getAttribute("aria-describedby")))));
      check("the page behind is locked", (await page.evaluate(() => document.body.style.overflow)) === "hidden");
      check("the modal fits the viewport", await page.evaluate(() => {
        const r = document.querySelector(".cert-modal").getBoundingClientRect();
        return r.height <= window.innerHeight && r.width <= window.innerWidth && r.top >= -1;
      }));

      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      check("Escape closes it", (await page.$$eval("dialog[open]", (n) => n.length)) === 0);
      check("and the scroll lock is released", (await page.evaluate(() => document.body.style.overflow)) !== "hidden");

      /* Keyboard: the explicit trigger, and focus coming back to it. */
      const opened = await page.evaluate(async () => {
        const btn = document.querySelector(".cert-card__open");
        btn.focus();
        const before = document.activeElement === btn;
        btn.click();
        await new Promise((r) => setTimeout(r, 400));
        return { before, dialog: Boolean(document.querySelector("dialog[open]")) };
      });
      check("the View details button is focusable", opened.before);
      check("and opens the modal from the keyboard", opened.dialog);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(450);
      check(
        "focus returns to the credential that opened it",
        await page.evaluate(() => document.activeElement?.classList.contains("cert-card__open")),
        await page.evaluate(() => document.activeElement?.className ?? "(none)")
      );

      /* No invalid nesting: an anchor or button inside another one. */
      check(
        "no interactive element nests inside another",
        (await page.$$eval("a a, a button, button a, button button", (n) => n.length)) === 0
      );
      await ctx.close();
    }

    /* --- the modal without an image --- */
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${specimen}?n=5`, { waitUntil: "networkidle" });
      await settle(page, 450);

      /* Unfold the deck before reaching for a card that is not the first one.
         While the deck is stacked every card sits at the same coordinates and
         the front one takes the clicks, which is correct behaviour and makes
         any attempt to click card three from the stack a test that measures
         nothing. */
      const r5 = await page.evaluate(() => {
        const el = document.querySelector(".certs__range");
        const b = el.getBoundingClientRect();
        return { top: b.top + window.scrollY, height: el.offsetHeight, stage: document.querySelector(".certs__stage").offsetHeight };
      });
      await page.evaluate((y) => window.scrollTo(0, y), r5.top + r5.height - r5.stage);
      await settle(page);

      /* fixture-03 carries no image; fixture-04 carries one. */
      await page.locator(".cert-card").nth(2).locator(".cert-card__open").click();
      await page.waitForTimeout(400);
      check("a credential with no image frames its metadata instead", (await page.$$eval(".cert-modal__meta--plate", (n) => n.length)) === 1);
      check("and does not repeat its title in the frame", (await page.$eval(".cert-modal", (e) => (e.innerText.match(/Type-Safe Application Development/g) ?? []).length)) === 1);
      check("and no broken image element", (await page.$$eval(".cert-modal__image", (n) => n.length)) === 0);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);

      await page.locator(".cert-card").nth(3).locator(".cert-card__open").click();
      await page.waitForTimeout(500);
      check("a credential with an image shows it", (await page.$$eval(".cert-modal__image", (n) => n.length)) === 1);
      check("and does not frame its metadata", (await page.$$eval(".cert-modal__meta--plate", (n) => n.length)) === 0);
      check("and the image actually loaded", await page.evaluate(() => {
        const img = document.querySelector(".cert-modal__image");
        return img.complete && img.naturalWidth > 0;
      }));
      await ctx.close();
    }

    /* --- responsive --- */
    /* The expected capacity at each width is what the measured frame actually
       fits, computed from the same tokens the stylesheet uses rather than
       asserted from memory. */
    for (const [w, h, expectCapacity] of [[1440, 900, 3], [1024, 768, 2], [768, 1024, 2], [390, 844, 1]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto(`${specimen}?n=5`, { waitUntil: "networkidle" });
      await settle(page, 450);

      const range = await page.evaluate(() => {
        const el = document.querySelector(".certs__range");
        const r = el.getBoundingClientRect();
        const stage = document.querySelector(".certs__stage");
        /* The stage is pinned at a `top` offset for navigation clearance, so it
           releases that many pixels before the range's own end. Scrolling to
           the range end rather than the release point overshoots and captures a
           section that has already begun to scroll away. */
        const sticky = parseFloat(getComputedStyle(stage).top) || 0;
        return {
          top: r.top + window.scrollY,
          height: el.offsetHeight - sticky,
          stage: stage.offsetHeight,
        };
      });
      await page.evaluate((y) => window.scrollTo(0, y), range.top + range.height - range.stage);
      await settle(page);

      const m = await page.evaluate(() => {
        /* The deck clips the rail, so visibility is judged against the deck's
           box and not the viewport's: a card can sit inside the window and
           still be cut off by the clip, which is exactly what happened at
           1440 when capacity was a guess. */
        const deckBox = document.querySelector(".certs__deck").getBoundingClientRect();
        return {
        hOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        shift: Number(getComputedStyle(document.querySelector(".certs__rail")).getPropertyValue("--cert-shift")),
        inView: [...document.querySelectorAll(".cert-card")].filter((c) => {
          const r = c.getBoundingClientRect();
          return r.left >= deckBox.left - 4 && r.right <= deckBox.right + 4;
        }).length,
        titleSize: parseFloat(getComputedStyle(document.querySelector(".cert-card__title")).fontSize),
        capacity: (() => {
          const stage = document.querySelector(".certs__stage");
          const deck = document.querySelector(".certs__deck");
          const gap = parseFloat(getComputedStyle(stage).getPropertyValue("--cert-gap")) || 0;
          const card = document.querySelector(".cert-card").getBoundingClientRect().width;
          return Math.max(1, Math.floor((deck.clientWidth + gap) / (card + gap)));
        })(),
      };
      });

      check(`${w}x${h}: no horizontal body overflow`, m.hOver <= 0, String(m.hOver));
      check(`${w}x${h}: at most the capacity is on screen`, m.inView <= expectCapacity, `${m.inView} of ${expectCapacity}`);
      check(`${w}x${h}: the deck measured the capacity it has`, m.capacity === expectCapacity, `${m.capacity}, expected ${expectCapacity}`);
      check(`${w}x${h}: card text stays readable`, m.titleSize >= 16, `${m.titleSize}px`);

      /* The defect this catches: a phone at the end of the deck has four cards
         translated out of the clip, each holding a link and a button. Focusable
         and invisible is the worst combination there is. */
      const reachable = await page.evaluate(() => {
        const controls = [...document.querySelectorAll(".cert-card a, .cert-card button")];
        return controls
          .filter((el) => {
            const deckBox = document.querySelector(".certs__deck").getBoundingClientRect();
            const r = el.getBoundingClientRect();
            return r.right < deckBox.left - 2 || r.left > deckBox.right + 2;
          })
          .filter((el) => {
            /* inert removes it from the tab order; this is the check that the
               attribute actually took effect rather than merely being set. */
            let node = el;
            while (node) {
              if (node.inert) return false;
              node = node.parentElement;
            }
            return true;
          }).length;
      });
      check(`${w}x${h}: no off-screen control is focusable`, reachable === 0, `${reachable} reachable`);
      check(
        `${w}x${h}: the rail ended at the last full window`,
        m.shift === 5 - expectCapacity,
        `${m.shift}, expected ${5 - expectCapacity}`
      );
      await ctx.close();
    }

    /* --- reduced motion --- */
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.goto(`${specimen}?n=5`, { waitUntil: "networkidle" });
      await settle(page, 450);

      check("the choreography is refused", (await page.$$eval(".certs__range--enhanced", (n) => n.length)) === 0);
      check("every card is still present", (await page.$$eval(".cert-card", (n) => n.length)) === 5);
      const vis = await page.evaluate(() =>
        [...document.querySelectorAll(".cert-card")].map((c) => {
          const cs = getComputedStyle(c);
          const r = c.getBoundingClientRect();
          return { op: Number(cs.opacity), w: Math.round(r.width), h: Math.round(r.height) };
        })
      );
      check("none is hidden", vis.every((v) => v.op === 1), JSON.stringify(vis.map((v) => v.op)));
      check("and none is collapsed", vis.every((v) => v.w > 40 && v.h > 40));
      check("the section is not sticky", (await page.$eval(".certs__stage", (e) => getComputedStyle(e).position)) !== "sticky");
      check("no progress counter is shown", (await page.$eval(".certs__progress", (e) => getComputedStyle(e).display)) === "none");

      /* The modal still works: reduced motion removes movement, not function. */
      await page.locator(".cert-card__open").first().click();
      await page.waitForTimeout(400);
      check("the modal still opens", (await page.$$eval("dialog[open]", (n) => n.length)) === 1);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      check("and still closes", (await page.$$eval("dialog[open]", (n) => n.length)) === 0);
      await ctx.close();
    }

    /* --- resize --- */
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${specimen}?n=5`, { waitUntil: "networkidle" });
      await settle(page, 450);

      const before = await page.evaluate(() => document.querySelector(".certs__range").offsetHeight);
      await page.setViewportSize({ width: 820, height: 700 });
      await settle(page, 500);
      const after = await page.evaluate(() => ({
        h: document.querySelector(".certs__range").offsetHeight,
        hOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      check("the range is re-measured on resize", after.h !== before, `${before} -> ${after.h}`);
      check("and no overflow is left behind", after.hOver <= 0, String(after.hOver));

      /* Scroll to the end after the resize: stale coordinates would leave cards
         unresolved or off screen. */
      const range = await page.evaluate(() => {
        const el = document.querySelector(".certs__range");
        const r = el.getBoundingClientRect();
        const stage = document.querySelector(".certs__stage");
        /* The stage is pinned at a `top` offset for navigation clearance, so it
           releases that many pixels before the range's own end. Scrolling to
           the range end rather than the release point overshoots and captures a
           section that has already begun to scroll away. */
        const sticky = parseFloat(getComputedStyle(stage).top) || 0;
        return {
          top: r.top + window.scrollY,
          height: el.offsetHeight - sticky,
          stage: stage.offsetHeight,
        };
      });
      await page.evaluate((y) => window.scrollTo(0, y), range.top + range.height - range.stage);
      await settle(page);
      const resolved = await page.evaluate(() =>
        [...document.querySelectorAll(".cert-card")].map((c) => Number(getComputedStyle(c).getPropertyValue("--cert-cp")))
      );
      check("the choreography still completes after a resize", resolved.every((v) => v > 0.99), resolved.map((v) => v.toFixed(2)).join(","));
      await ctx.close();
    }

    await browser.close();
  }
}

console.log(
  `\n=== stage 09F certifications: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks${skipped ? `, ${skipped} skipped` : ""}) ===`
);
process.exit(failures === 0 ? 0 : 1);
