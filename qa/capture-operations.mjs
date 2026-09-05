/**
 * Capture the real Operations application, one image per module.
 *
 * The landing page's featured section used to draw a picture of the product:
 * a hand-composed rail, four state cards, a flow strip. It was honest about
 * being an abstraction and it was still the wrong thing to show, because a
 * visitor comparing it to the demo found two different-looking interfaces and
 * had no way to tell which one was real.
 *
 * So the landing page now shows the product. These are screenshots of the
 * actual verified application at its actual routes, and this script is how they
 * are made: a written-down, repeatable procedure rather than someone's
 * screenshot folder.
 *
 * WHAT MAKES THEM CANONICAL
 *
 * A fresh browser context per capture. The demo persists to IndexedDB, so a
 * single context walking eleven routes would carry state between them: opening
 * Payments runs the overdue reconciliation (D-095), which writes automation
 * runs and notifications, and Reports would then be photographed downstream of
 * a visit rather than at the seed. A new context has an empty origin, so every
 * image is the application as it is on first arrival.
 *
 * The default role is Admin (Morgan Reed) and nothing here changes it. Admin is
 * the only role that can see all eleven modules, and a capture set with holes in
 * it would misrepresent the product.
 *
 * WHAT IS NOT ALLOWED
 *
 * Nothing in the image may be edited. No values changed, no rows added, no UI
 * removed, no text repainted. The only post-processing is what the browser
 * itself does when it encodes the file. If a screen looks wrong, the fix is in
 * the application, not in the picture of it.
 *
 *   npm run build && npx next start -p 3001 -H 127.0.0.1
 *   node qa/capture-operations.mjs
 *
 * Writes public/operations/{desktop,mobile}/operations-<module>.png and prints
 * a manifest. Re-running overwrites; the filenames are deterministic so the
 * diff shows exactly which screens changed.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const ROOT = new URL("../public/operations/", import.meta.url);

/**
 * The eleven, in the order the product's own sidebar lists them.
 *
 * `route` is the real public route. `title` is what the application's top bar
 * says, and is used as the readiness signal: the capture waits for the app to
 * have actually rendered that module rather than for a network idle event that
 * says nothing about hydration.
 */
const MODULES = [
  { id: "overview", route: "", title: "Overview" },
  { id: "leads", route: "/leads", title: "Leads" },
  { id: "customers", route: "/customers", title: "Customers" },
  { id: "reservations", route: "/reservations", title: "Reservations" },
  { id: "contracts", route: "/contracts", title: "Contracts" },
  { id: "fleet", route: "/fleet", title: "Fleet" },
  { id: "maintenance", route: "/maintenance", title: "Maintenance" },
  { id: "payments", route: "/payments", title: "Payments" },
  { id: "automations", route: "/automations", title: "Automations" },
  { id: "inbox", route: "/inbox", title: "Inbox" },
  { id: "reports", route: "/reports", title: "Reports" },
];

/**
 * Desktop is captured at the width the application was designed and QA'd at.
 * Mobile is captured at a real phone width rather than by shrinking the desktop
 * image, because the application is genuinely responsive and a 1440px table
 * scaled into a 390px frame is unreadable in a way the product is not.
 */
const VIEWPORTS = [
  { id: "desktop", width: 1440, height: 900, scale: 1 },
  { id: "mobile", width: 390, height: 844, scale: 2 },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Force compositor frames.
 *
 * Headless Chromium paints only when asked, and this application has entrance
 * transitions on its rows and panels. Without frames the capture catches them
 * mid-flight and the screenshot shows a half-faded table.
 */
async function settle(page, frames = 6, ms = 140) {
  for (let i = 0; i < frames; i++) {
    await wait(ms);
    await page.screenshot();
  }
  await wait(ms);
}

const browser = await chromium.launch();
const manifest = [];
let failures = 0;

for (const viewport of VIEWPORTS) {
  const dir = new URL(`${viewport.id}/`, ROOT);
  mkdirSync(dir, { recursive: true });

  for (const module of MODULES) {
    /* A new context per capture: empty IndexedDB, so the application is at its
       canonical seed and not downstream of whatever the previous route did. */
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.scale,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const problems = [];
    page.on("pageerror", (e) => problems.push(String(e)));

    const url = `${BASE}/demos/operations${module.route}`;
    await page.goto(url, { waitUntil: "networkidle" });

    /* Readiness is the application saying which module it is, not the network
       going quiet: the shell renders before the runtime has hydrated its data,
       and a screenshot taken then shows an empty product. */
    let ready = false;
    try {
      await page.waitForFunction(
        (title) => {
          const bar = document.querySelector(".ops-topbar__title");
          return Boolean(bar && bar.textContent && bar.textContent.trim() === title);
        },
        module.title,
        { timeout: 20000 }
      );
      ready = true;
    } catch {
      ready = false;
    }

    await settle(page);

    /* Playwright wants a filesystem path, not a URL object. */
    const file = fileURLToPath(new URL(`operations-${module.id}.png`, dir));
    await page.screenshot({ path: file, fullPage: false });

    /* Recorded so a set with a broken capture in it cannot pass unnoticed. */
    const facts = await page.evaluate(() => ({
      title: document.querySelector(".ops-topbar__title")?.textContent?.trim() ?? "",
      role: document.querySelector(".ops-role")?.textContent?.trim() ?? "",
      /* Any of these on screen would mean the picture is of a broken app. */
      empty: document.body.innerText.trim().length < 40,
    }));

    const ok = ready && facts.title === module.title && !facts.empty && problems.length === 0;
    if (!ok) failures += 1;

    manifest.push({
      viewport: viewport.id,
      module: module.id,
      title: facts.title,
      role: facts.role,
      ok,
      problems: problems.slice(0, 2),
    });
    console.log(
      `  ${ok ? "OK  " : "FAIL"}  ${viewport.id.padEnd(8)} ${module.id.padEnd(14)} ${facts.title.padEnd(14)} ${facts.role}`
    );

    await context.close();
  }
}

await browser.close();

writeFileSync(
  new URL("manifest.json", ROOT),
  `${JSON.stringify(
    {
      note: "Generated by qa/capture-operations.mjs from the real application. Do not edit images.",
      modules: MODULES.map((m) => m.id),
      viewports: VIEWPORTS.map((v) => `${v.id} ${v.width}x${v.height}@${v.scale}x`),
      captures: manifest,
    },
    null,
    2
  )}\n`
);

console.log(
  `\n=== operations capture: ${failures === 0 ? "ALL OK" : `${failures} FAILED`} (${manifest.length} images) ===`
);
process.exit(failures === 0 ? 0 : 1);
