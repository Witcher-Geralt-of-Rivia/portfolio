import { chromium } from "playwright";
const URL = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [], failed = [];
page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("requestfailed", r => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 110)}`));
const resp = await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(3000);
const probe = await page.evaluate(() => {
  const f = document.querySelector(".aurora__field--1");
  const g = document.querySelector(".grain");
  const cs = f && getComputedStyle(f);
  return {
    title: document.title,
    auroraFields: document.querySelectorAll(".aurora__field").length,
    prismBeams: document.querySelectorAll(".prism__beam").length,
    grainPresent: !!g,
    fieldFilter: cs?.filter,
    fieldAnimation: cs?.animationName + " " + cs?.animationDuration,
    runningAnimations: document.getAnimations().filter(a => a.playState === "running").length,
    stylesheetsApplied: getComputedStyle(document.body).fontFamily.includes("system-ui"),
  };
});
await page.screenshot({ path: "qa/shots/remote-preview.png" });
console.log("HTTP status      :", resp.status());
console.log("Title            :", probe.title);
console.log("Aurora fields    :", probe.auroraFields, "| prism beams:", probe.prismBeams, "| grain:", probe.grainPresent);
console.log("Field filter     :", probe.fieldFilter);
console.log("Field animation  :", probe.fieldAnimation);
console.log("Running anims    :", probe.runningAnimations);
console.log("CSS applied      :", probe.stylesheetsApplied);
console.log("Console errors   :", errors.length ? errors : "none");
console.log("Failed requests  :", failed.length ? failed : "none");
await browser.close();
