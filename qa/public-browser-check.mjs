import { chromium } from "playwright";

/* Chromium against the live public origin. Console, network and mixed-content
   are all origin-sensitive, so they are only meaningful measured over real
   HTTPS rather than against a loopback dev server. */

const BASE = process.env.QA_PUBLIC || "https://intelligent-systems-lab.duckdns.org";
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});

let failures = 0;

for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const failed = [];
  const insecure = [];
  const requests = [];

  p.on("console", (m) => {
    const t = m.type();
    if (t === "error") consoleErrors.push(m.text());
    else if (t === "warning") consoleWarnings.push(m.text());
  });
  p.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
  p.on("requestfailed", (r) => failed.push(`${r.url()} :: ${r.failure() && r.failure().errorText}`));
  p.on("request", (r) => {
    requests.push(r.url());
    // Mixed content: any subresource fetched over plaintext from an HTTPS page.
    if (/^http:\/\//i.test(r.url())) insecure.push(r.url());
  });
  p.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.url()} -> ${r.status()}`); });

  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(1200); await frame(p);
  await p.evaluate(() => document.querySelector("#products").scrollIntoView({ block: "start" }));
  await p.waitForTimeout(600);
  await frame(p);

  // Exercise the section so lazily-triggered errors surface too.
  for (const id of ["commerce", "field", "operations"]) {
    await p.click(`#pscenario-tab-${id}`);
    await p.waitForTimeout(350);
  }
  await p.click(".pstudio__run");
  await p.waitForFunction(() => document.querySelector(".pstudio__run-label").textContent === "Run again", null, { timeout: 12000, polling: 120 });
  await frame(p); await p.waitForTimeout(400); await frame(p);

  // The list reset, measured on the live page.
  const lists = await p.evaluate(() => {
    const out = {};
    for (const sel of [".products__rail", ".pweb__rows", ".pflow__rail"]) {
      const el = document.querySelector(sel);
      if (!el) { out[sel] = null; continue; }
      const cs = getComputedStyle(el);
      out[sel] = { tag: el.tagName.toLowerCase(), pad: cs.paddingInlineStart, margin: cs.marginBlockStart, marker: cs.listStyleType };
    }
    return out;
  });

  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const secure = await p.evaluate(() => location.protocol === "https:");

  const listsOk = Object.values(lists).every((l) => l && l.pad === "0px" && l.margin === "0px" && l.marker === "none");
  const ok = consoleErrors.length === 0 && failed.length === 0 && insecure.length === 0 && overflow <= 0 && listsOk && secure;
  if (!ok) failures++;

  console.log(`\n--- ${w}x${h}  ${BASE} ---`);
  console.log(`  served over HTTPS ............ ${secure} ${pass(secure)}`);
  console.log(`  console errors .............. ${consoleErrors.length} ${pass(consoleErrors.length === 0)}${consoleErrors.length ? " :: " + consoleErrors.slice(0, 3).join(" | ") : ""}`);
  console.log(`  console warnings ............ ${consoleWarnings.length}${consoleWarnings.length ? " :: " + consoleWarnings.slice(0, 2).join(" | ") : ""}`);
  console.log(`  failed resource requests .... ${failed.length} ${pass(failed.length === 0)}${failed.length ? " :: " + failed.slice(0, 3).join(" | ") : ""}`);
  console.log(`  mixed content (http:// sub) . ${insecure.length} ${pass(insecure.length === 0)}${insecure.length ? " :: " + insecure.slice(0, 3).join(" | ") : ""}`);
  console.log(`  total requests .............. ${requests.length}`);
  console.log(`  horizontal overflow ......... ${overflow}px ${pass(overflow <= 0)}`);
  console.log(`  list reset on live page ..... ${pass(listsOk)} ${JSON.stringify(lists)}`);

  await ctx.close();
}

await browser.close();
console.log(`\n=== public browser check: ${failures === 0 ? "ALL PASS" : failures + " viewport(s) FAILED"} ===`);
process.exit(failures === 0 ? 0 : 1);
