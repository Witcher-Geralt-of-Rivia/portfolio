import { chromium } from "playwright";
const URL = "https://intelligent-systems-lab.duckdns.org";
const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [], failed = [], insecure = [], reqs = [];
page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0,160)); });
page.on("pageerror", e => errors.push("pageerror: " + e.message.slice(0,160)));
page.on("requestfailed", r => failed.push(`${r.failure()?.errorText} ${r.url().slice(0,80)}`));
page.on("request", r => { reqs.push(r.url()); if (r.url().startsWith("http://")) insecure.push(r.url()); });

const resp = await page.goto(`${URL}/#systems`, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ type: "jpeg", quality: 20 });
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const s = document.getElementById("systems");
  const rect = s.getBoundingClientRect();
  const nav = document.querySelector(".site-nav__desktop").getBoundingClientRect();
  const heading = document.getElementById("systems-title").getBoundingClientRect();
  return {
    status: "ok", protocol: location.protocol, hash: location.hash,
    sectionPresent: !!s,
    headingClearsNav: heading.top > nav.bottom,
    sectionTopInView: Math.round(rect.top),
    nodes: document.querySelectorAll(".arch-canvas .arch-node").length,
    links: document.querySelectorAll(".arch-link").length,
    trace: document.querySelectorAll(".arch-trace__row").length,
    tabs: document.querySelectorAll('[role="tab"]').length,
    activeNav: [...document.querySelectorAll('.site-nav__link[aria-current="location"]')].map(a => a.textContent.trim()),
    heroIntact: document.querySelectorAll(".cnode").length,
    aurora: document.querySelectorAll(".aurora__field").length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
});
const external = reqs.filter(u => !u.startsWith(URL));
console.log("  HTTP status        :", resp.status());
console.log("  protocol / hash    :", r.protocol, r.hash);
console.log("  #systems present   :", r.sectionPresent, "| heading clears fixed nav:", r.headingClearsNav, `(top ${r.sectionTopInView}px)`);
console.log("  architecture       :", r.nodes, "nodes,", r.links, "links,", r.trace, "trace rows,", r.tabs, "tabs");
console.log("  nav active on land :", r.activeNav);
console.log("  hero intact        :", r.heroIntact, "constellation nodes,", r.aurora, "aurora fields");
console.log("  horizontal overflow:", r.overflow ? "FAIL" : "none");
console.log("  console errors     :", errors.length ? errors : "none");
console.log("  failed requests    :", failed.length ? failed : "none");
console.log("  mixed content      :", insecure.length ? insecure : "none");
console.log("  third-party reqs   :", external.length ? external : "none");

const html = await page.content();
const banned = [/mailto:/i, /\btel:/i, /whatsapp/i, /telegram/i, /discord/i, /[a-z0-9._%+-]+@[a-z0-9.-]+\.(com|net|org|io|dev|br)/i,
                /OPENAI_API_KEY/i, /ANTHROPIC_API_KEY/i, /GEMINI_API_KEY/i];
const hits = banned.filter(re => re.test(html)).map(re => re.source);
console.log("  privacy/AI scan    :", hits.length ? "HITS " + hits : "clean");
await browser.close();
