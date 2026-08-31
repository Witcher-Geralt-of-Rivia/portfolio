import { chromium } from "playwright";

const URL = process.argv[2] || "http://127.0.0.1:3000/specimen";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const requests = [], failed = [], consoleMsgs = [];
page.on("request", r => requests.push({ url: r.url(), type: r.resourceType() }));
page.on("requestfailed", r => failed.push(`${r.failure()?.errorText} ${r.url()}`));
page.on("response", async r => { if (r.request().resourceType() === "font" && !r.ok()) failed.push(`HTTP ${r.status()} ${r.url()}`); });
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") consoleMsgs.push(`[${m.type()}] ${m.text().slice(0,180)}`); });

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

const fontReqs = requests.filter(r => r.type === "font" || /\.woff2?(\?|$)/.test(r.url));
const THIRD_PARTY = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit|fontshare|unpkg\.com|jsdelivr\.net|cdnjs/i;
const external = requests.filter(r => THIRD_PARTY.test(r.url));

console.log("=== FONT RESOURCES AS SEEN BY CHROMIUM ===");
for (const f of fontReqs) console.log("  " + f.url);
console.log("\n=== THIRD-PARTY FONT/CDN REQUESTS ===");
console.log(external.length ? external.map(e => "  " + e.url).join("\n") : "  none");

const loaded = await page.evaluate(() => [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status })));
console.log("\n=== document.fonts ===");
for (const f of loaded) console.log(`  ${f.family.padEnd(28)} weight=${f.weight.padEnd(9)} ${f.status}`);

const resolved = await page.evaluate(() => {
  const used = el => { const cs = getComputedStyle(el); return cs.fontFamily.split(",")[0].trim().replace(/['"]/g, ""); };
  const probe = (sel) => { const el = document.querySelector(sel); return el ? used(el) : "MISSING"; };
  return {
    body: probe("body"),
    h1: probe("h1"),
    display1: probe(".type-display-1"),
    bodyRole: probe(".type-body"),
    eyebrow: probe(".eyebrow"),
    technical: probe(".type-technical"),
    code: probe("pre code"),
  };
});
console.log("\n=== RESOLVED FAMILY PER ROLE ===");
for (const [k, v] of Object.entries(resolved)) console.log(`  ${k.padEnd(12)} ${v}`);

// Do the sans and mono roles actually render differently?
const widths = await page.evaluate(() => {
  const mk = (fam) => { const s = document.createElement("span");
    s.style.cssText = `position:absolute;visibility:hidden;font-size:64px;font-family:${fam}`;
    s.textContent = "IIIIMMMMWWWW1234"; document.body.appendChild(s);
    const w = s.getBoundingClientRect().width; s.remove(); return Math.round(w); };
  return { sans: mk("var(--font-sans)"), mono: mk("var(--font-mono)"), fallback: mk("Arial") };
});
console.log("\n=== METRIC PROOF (same string, 64px) ===");
console.log(`  sans stack=${widths.sans}px  mono stack=${widths.mono}px  Arial=${widths.fallback}px`);
console.log(`  sans !== mono: ${widths.sans !== widths.mono}   sans !== Arial: ${widths.sans !== widths.fallback}`);

console.log("\n=== FAILURES / CONSOLE ===");
console.log("  failed requests :", failed.length ? failed : "none");
console.log("  console err/warn:", consoleMsgs.length ? consoleMsgs : "none");
await browser.close();
