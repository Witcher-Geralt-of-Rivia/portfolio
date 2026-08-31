import { chromium } from "playwright";
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };
const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows","--disable-background-timer-throttling"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errs = [];
p.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0,140)); });
p.on("pageerror", e => errs.push("pageerror: " + e.message.slice(0,140)));
await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await frame(p); await p.waitForTimeout(1500); await frame(p);

const r = await p.evaluate(() => {
  const sig = document.querySelector(".csignal");
  const cs = sig ? getComputedStyle(sig) : null;
  const box = sig ? sig.getBoundingClientRect() : null;
  const node = document.querySelector(".cnode--automation");
  const nb = node.getBoundingClientRect();
  const core = document.querySelector(".ccore").getBoundingClientRect();
  const con = document.querySelector(".constellation").getBoundingClientRect();
  return {
    signalOffsetPath: cs ? cs.offsetPath.slice(0, 40) : "none",
    signalOffsetDistance: cs ? cs.offsetDistance : "none",
    signalBox: box ? [Math.round(box.x), Math.round(box.y), Math.round(box.width)] : null,
    signalMovesOffOrigin: box ? (box.width > 0 && box.x > con.x + 20) : false,
    constellation: [Math.round(con.width), Math.round(con.height)],
    automationChip: [Math.round(nb.width), Math.round(nb.height)],
    core: [Math.round(core.width), Math.round(core.height)],
    svgShapes: document.querySelectorAll(".constellation__svg path, .constellation__svg circle, .constellation__svg rect, .constellation__svg ellipse").length,
    heroDom: document.querySelectorAll("#hero *").length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    activeNav: [...document.querySelectorAll('.site-nav__link[aria-current="location"]')].map(a=>a.textContent.trim()),
  };
});
console.log(JSON.stringify(r, null, 2));
console.log("console errors:", errs.length ? errs : "none");
await browser.close();
