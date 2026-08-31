import { chromium } from "playwright";
const URL = "https://intelligent-systems-lab.duckdns.org/";
const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [], failed = [], insecure = [], reqs = [];
page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0,160)); });
page.on("pageerror", e => errors.push("pageerror: " + e.message.slice(0,160)));
page.on("requestfailed", r => failed.push(`${r.failure()?.errorText} ${r.url().slice(0,90)}`));
page.on("request", r => { reqs.push(r.url()); if (r.url().startsWith("http://")) insecure.push(r.url()); });
const resp = await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ type: "jpeg", quality: 20 });
await page.waitForTimeout(2500);
const probe = await page.evaluate(() => ({
  title: document.title,
  protocol: location.protocol,
  host: location.host,
  auroraFields: document.querySelectorAll(".aurora__field").length,
  prismBeams: document.querySelectorAll(".prism__beam").length,
  grain: !!document.querySelector(".grain"),
  navLinks: document.querySelectorAll(".site-nav__link").length,
  heroTitle: document.querySelector("#hero-title")?.textContent?.trim(),
  constellationNodes: document.querySelectorAll(".cnode").length,
  constellationLinks: document.querySelectorAll(".clink").length,
  signals: document.querySelectorAll(".csignal").length,
  runningAnimations: document.getAnimations().filter(a => a.playState === "running").length,
  fontsLoaded: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family),
  bodyFont: getComputedStyle(document.body).fontFamily.split(",")[0].replace(/['"]/g,""),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
}));
const external = reqs.filter(u => !u.startsWith("https://intelligent-systems-lab.duckdns.org"));
console.log("  HTTP status        :", resp.status());
console.log("  protocol / host    :", probe.protocol, probe.host);
console.log("  title              :", probe.title);
console.log("  hero title         :", probe.heroTitle);
console.log("  aurora fields      :", probe.auroraFields, "| prism beams:", probe.prismBeams, "| grain:", probe.grain);
console.log("  nav links          :", probe.navLinks);
console.log("  constellation      :", probe.constellationNodes, "nodes,", probe.constellationLinks, "links,", probe.signals, "signals");
console.log("  running animations :", probe.runningAnimations);
console.log("  fonts loaded       :", probe.fontsLoaded.join(", "));
console.log("  body font resolves :", probe.bodyFont);
console.log("  horizontal overflow:", probe.overflow ? "FAIL" : "none");
console.log("  console errors     :", errors.length ? errors : "none");
console.log("  failed requests    :", failed.length ? failed : "none");
console.log("  insecure http://   :", insecure.length ? insecure : "none (no mixed content)");
console.log("  third-party reqs   :", external.length ? external : "none");
await page.screenshot({ path: "qa/shots/production-https-1440x900.png", type: "png", timeout: 90000 });
console.log("  screenshot         : qa/shots/production-https-1440x900.png");
await browser.close();
