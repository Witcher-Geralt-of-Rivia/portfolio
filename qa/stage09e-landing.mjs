/**
 * Landing page QA.
 *
 * The homepage became a finished public page in this stage: the Stage 03
 * navigation specimen that stood in for `#work` is gone, replaced by the
 * flagship section for the verified Operations demo, and the document now ends
 * in a footer instead of stopping.
 *
 * Two things this suite guards that no amount of looking at it would catch.
 *
 * The first is the truth boundary. `SelectedWorkSection` publishes real client
 * work and refuses to render until its own invariant is met. The flagship
 * section is a different thing published a different way, and the page must
 * never blur them: no case-study language, no client language, and the
 * canonical engineering-demo disclosure visible rather than tucked into
 * metadata.
 *
 * The second is that the page has exactly one `#work`. It would be easy to
 * leave the old anchor behind and end up with two elements claiming the same
 * navigation target, which breaks the nav silently and only for some visitors.
 *
 *   node qa/stage09e-landing.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(56)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

const POLL = { timeout: 30000 };

const browser = await chromium.launch();

async function open(viewport = { width: 1440, height: 900 }, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...opts });
  const problems = [];
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("#work", POLL);
  await page.waitForTimeout(900);
  return { ctx, page, problems };
}

/* ===================================================================== */
section("IDENTITY - WHAT MAY NOT CHANGE");
{
  const { ctx, page, problems } = await open();

  /* Frozen, and asserted character for character. Product memory and the
     deployment smoke test both depend on these. */
  check(
    "the H1 is exactly the frozen line",
    (await page.$eval("h1", (e) => e.textContent.trim())) === "Engineering intelligent systems.",
    await page.$eval("h1", (e) => e.textContent.trim())
  );
  check("and there is only one of it", (await page.$$eval("h1", (n) => n.length)) === 1);

  const h2s = await page.$$eval("h2", (n) => n.map((e) => e.textContent.trim()));
  for (const frozen of [
    "One product. Every surface.",
    "Learning paths that adapt.",
    "Small systems. Serious engineering.",
  ]) {
    check(`the frozen heading survives: ${frozen}`.slice(0, 56), h2s.includes(frozen), "");
  }

  /* Heading order, read as a document rather than as a design. */
  const order = await page.$$eval("h1,h2,h3,h4", (n) =>
    n.map((e) => Number(e.tagName.slice(1)))
  );
  let jumped = null;
  for (let i = 1; i < order.length; i++) {
    if (order[i] - order[i - 1] > 1) jumped = `h${order[i - 1]} to h${order[i]} at ${i}`;
  }
  check("no heading level is skipped", jumped === null, jumped ?? "");
  check("the console is clean", problems.length === 0, problems.join(" | ").slice(0, 90));
  await ctx.close();
}

/* ===================================================================== */
section("NAVIGATION - FIVE TARGETS, ALL REAL");
{
  const { ctx, page } = await open();

  for (const id of ["systems", "products", "ai-learning", "lab", "work"]) {
    const found = await page.$$eval(`#${id}`, (n) => n.length);
    check(`#${id} exists exactly once`, found === 1, String(found));
  }

  /* The one the old page could not satisfy: Work was an inert specimen. */
  const workTag = await page.$eval("#work", (e) => `${e.tagName.toLowerCase()}.${e.className}`);
  check("#work is the featured section, not a specimen", workTag.includes("featured"), workTag);
  check(
    "and no navigation specimen survives anywhere",
    (await page.$$eval(".nav-specimen", (n) => n.length)) === 0
  );

  /* Following the link has to land on it, which is a different claim from the
     anchor existing. */
  await page.click('nav a[href="#work"]');
  await page.waitForTimeout(1200);
  const landed = await page.evaluate(() => {
    const r = document.querySelector("#work").getBoundingClientRect();
    return Math.round(r.top);
  });
  check("the Work nav link scrolls to it", Math.abs(landed) < 160, `${landed}px from the top`);

  await ctx.close();
}

/* ===================================================================== */
section("FEATURED WORK - THE FLAGSHIP");
{
  const { ctx, page } = await open();
  const work = await page.$("#work");
  const text = (await work.textContent()).replace(/\s+/g, " ");

  check("it names the product", text.includes("Rental Operations Platform"), "");
  check("and the in-app console", text.includes("Operations Console"), "");
  check(
    "the headline states the system",
    (await page.$eval("#featured-title", (e) => e.textContent.trim())) ===
      "One operational system. Eleven connected modules.",
    await page.$eval("#featured-title", (e) => e.textContent.trim())
  );

  /* The canonical disclosure, visible on the page rather than in metadata. */
  const disclosure = await page.$eval(".featured__disclosure", (e) => ({
    text: e.textContent.replace(/\s+/g, " ").trim(),
    visible: e.getClientRects().length > 0,
  }));
  check(
    "the engineering-demo disclosure is present",
    disclosure.text.includes("INTERACTIVE ENGINEERING DEMO"),
    disclosure.text
  );
  check(
    "with the synthetic-data line",
    disclosure.text.includes("SYNTHETIC DATA · FRONTEND ONLY"),
    disclosure.text
  );
  check("and it is actually visible", disclosure.visible);

  const cta = await page.$eval(".featured__cta", (e) => ({
    href: e.getAttribute("href"),
    target: e.getAttribute("target"),
    label: e.textContent.trim(),
  }));
  check("the action opens the demo", cta.href === "/demos/operations", String(cta.href));
  check("in the same tab", cta.target === null, String(cta.target));
  check("and says so plainly", /demo/i.test(cta.label), cta.label);

  /* Facts, and each one true of the frozen demo. */
  const facts = await page.$$eval(".featured__fact", (n) =>
    n.map((e) => e.textContent.replace(/\s+/g, " ").trim())
  );
  check("four facts, no metrics grid", facts.length === 4, facts.join(" | "));
  check("eleven modules", facts.some((f) => f.includes("11") && /module/.test(f)), facts.join(" | "));
  check("thirteen entities", facts.some((f) => f.includes("13") && /entit/.test(f)), "");
  check("four roles", facts.some((f) => f.includes("4") && /role/.test(f)), "");
  check("five automation rules", facts.some((f) => f.includes("5") && /automation/.test(f)), "");

  /* All eleven module names appear, so breadth is shown rather than claimed. */
  const modules = await page.$$eval(".featured__module", (n) => n.map((e) => e.textContent.trim()));
  const expected = ["Leads", "Customers", "Reservations", "Inbox", "Contracts", "Fleet", "Maintenance", "Payments", "Automations", "Reports"];
  check("ten modules are named in the groups", modules.length === 10, modules.join(","));
  check("and they are the right ten", expected.every((m) => modules.includes(m)), modules.join(","));
  check("with Overview as the entry point", text.includes("Overview"), "");

  /* The preview is a composition, not an embedded application. */
  check("the preview is present", (await page.$(".fpv")) !== null);
  check("it is labelled for assistive technology", (await page.$eval(".fpv", (e) => e.getAttribute("aria-label") ?? "")).length > 30);
  check("there is no iframe anywhere on the page", (await page.$$eval("iframe", (n) => n.length)) === 0);
  check("and no canvas", (await page.$$eval("canvas", (n) => n.length)) === 0);

  await ctx.close();
}

/* ===================================================================== */
section("TRUTH BOUNDARY - A DEMO IS NOT CLIENT WORK");
{
  const { ctx, page } = await open();
  const html = await page.content();
  const body = (await page.$eval("body", (e) => e.innerText)).replace(/\s+/g, " ");

  /* The words that would turn an honest demonstration into a false claim. */
  for (const phrase of [
    "case study",
    "client work",
    "selected client",
    "commissioned",
    "production client",
    "our client",
  ]) {
    check(`the page never says "${phrase}"`.slice(0, 56), !new RegExp(phrase, "i").test(body), "");
  }

  /* The real case-study system stays dormant. */
  check("no case-study section is rendered", (await page.$$eval(".work", (n) => n.length)) === 0);
  check("no verified mark is borrowed", (await page.$$eval(".case__verified, .verified-mark", (n) => n.length)) === 0);

  /* Demo 02 and Demo 03 are not advertised. */
  check("no unfinished demo is advertised", !/coming soon/i.test(body));
  check("no link to an unbuilt demo", (await page.$$eval('a[href^="/demos/"]', (n) => n.map((e) => e.getAttribute("href")))).every((h) => h === "/demos/operations"), "");

  /* Contact rules, which are standing rather than stage-specific. */
  check("no mailto link", !/mailto:/i.test(html));
  check("no telephone link", !/\btel:\+?\d/i.test(html));
  check("no email address", !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html));
  check("no telephone number", !/\+\d[\d\s().-]{7,}\d/.test(html));
  check("no messenger channel", !/whatsapp|telegram|discord/i.test(html));
  check("no social account", !/twitter\.com|x\.com|linkedin\.com|github\.com\/[a-z]/i.test(html));
  check("no contact CTA", !/hire me|let.s talk|book a call|get in touch|contact us|work with me/i.test(body));
  check("no form", (await page.$$eval("form, input, textarea", (n) => n.length)) === 0);
  check("no em dash", !html.includes(String.fromCharCode(0x2014)));

  /* Inflated claims. */
  check(
    "no inflated language",
    !/enterprise.grade|world.class|industry.leading|revolutionary|cutting.edge/i.test(body)
  );

  await ctx.close();
}

/* ===================================================================== */
section("THE PAGE ENDS");
{
  const { ctx, page } = await open();
  check("a site footer exists", (await page.$$eval(".site-footer", (n) => n.length)) === 1);
  const footer = (await page.$eval(".site-footer", (e) => e.innerText)).replace(/\s+/g, " ");
  check("it names the portfolio", footer.includes("Intelligent Systems Lab"), footer.slice(0, 50));
  check(
    "and offers the way back into the page",
    (await page.$$eval(".site-footer__link", (n) => n.length)) === 5,
    String(await page.$$eval(".site-footer__link", (n) => n.length))
  );
  check("it is the last thing in the document", await page.evaluate(() => {
    const f = document.querySelector(".site-footer");
    const end = f.getBoundingClientRect().bottom + window.scrollY;
    return document.body.scrollHeight - end < 80;
  }));
  await ctx.close();
}

/* ===================================================================== */
section("RESPONSIVE");
for (const [w, h] of [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
]) {
  const { ctx, page } = await open({ width: w, height: h });
  const m = await page.evaluate(() => ({
    hOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    workWidth: Math.round(document.querySelector("#work").getBoundingClientRect().width),
    ctaWidth: Math.round(document.querySelector(".featured__cta").getBoundingClientRect().width),
    lead: Math.round(document.querySelector(".featured__lead").getBoundingClientRect().width),
  }));
  check(`${w}x${h}: no horizontal overflow`, m.hOver <= 0, String(m.hOver));
  check(`${w}x${h}: the work section fits`, m.workWidth <= w, String(m.workWidth));
  /* A paragraph the width of a phone is a wall. The lead is allowed the column
     on a phone but must stay inside a readable measure on a desktop. */
  if (w >= 1024) {
    check(`${w}x${h}: the lead keeps a readable measure`, m.lead < w * 0.62, `${m.lead} of ${w}`);
  }
  if (w <= 767) {
    check(`${w}x${h}: the action spans the column`, m.ctaWidth > w * 0.6, String(m.ctaWidth));
  }
  await ctx.close();
}

/* ===================================================================== */
section("REDUCED MOTION");
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, { reducedMotion: "reduce" });
  const still = await page.evaluate(() => {
    const cta = document.querySelector(".featured__cta");
    const arrow = document.querySelector(".featured__cta-arrow");
    return {
      cta: getComputedStyle(cta).transitionDuration,
      arrow: getComputedStyle(arrow).transitionDuration,
      aurora: getComputedStyle(document.querySelector(".aurora__field")).animationName,
    };
  });
  check("the action does not transition", /^(0s|0s.*)$/.test(still.cta.split(",")[0].trim()), still.cta);
  check("nor does its arrow", /^0s/.test(still.arrow.trim()), still.arrow);
  check("and the background is still", still.aurora === "none", still.aurora);
  check("the page still renders its work section", (await page.$("#work")) !== null);
  await ctx.close();
}

await browser.close();
console.log(
  `\n=== stage 09E landing: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
