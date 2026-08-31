import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const pass = (b) => (b ? "PASS" : "FAIL");
const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows"] });

console.log("=== DESKTOP GEOMETRY ===");
for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(700);
  const g = await p.evaluate(() => {
    const nav = document.querySelector(".site-nav__desktop");
    const idc = document.querySelector(".site-nav__desktop .site-nav__identity");
    const links = [...document.querySelectorAll(".site-nav__link")];
    const cs = getComputedStyle(nav), r = nav.getBoundingClientRect();
    /* The bar is centred on the CONTENT FRAME, not on the raw viewport --
       `scrollbar-gutter: stable` reserves 15px that the frame excludes. This
       used to compare against documentElement.clientWidth, which is correct
       for a classic scrollbar but not for the overlay scrollbars headless
       Chromium uses: there clientWidth === innerWidth while the gutter is
       still reserved, so a correctly centred bar read as 7.5px off. */
    const main = document.querySelector("main");
    const mr = main.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    return {
      w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top),
      left: Math.round(r.left), right: Math.round(vw - r.right),
      centred: Math.abs((r.left + r.width / 2) - (mr.left + mr.width / 2)) < 1.5,
      centreOffset: +((r.left + r.width / 2) - (mr.left + mr.width / 2)).toFixed(2),
      radius: cs.borderRadius, z: cs.zIndex, pos: cs.position,
      identity: Math.round(idc.getBoundingClientRect().width),
      linkH: Math.round(links[0].getBoundingClientRect().height),
      wrapped: links.some(a => a.getBoundingClientRect().height > 42),
      viewport: vw,
      barHidden: getComputedStyle(document.querySelector(".site-nav__bar")).display === "none",
    };
  });
  console.log(`  ${w}x${h} (layout ${g.viewport}px): ${g.w}x${g.h} top=${g.top} radius=${g.radius} z=${g.z} ${g.pos}`);
  console.log(`     centred on content frame=${pass(g.centred)} (${g.centreOffset}px)  side clearance L/R=${g.left}/${g.right}px (min 24) ${pass(Math.min(g.left,g.right) >= 24)}  maxWidth<=1060 ${pass(g.w <= 1060)}`);
  console.log(`     identity=${g.identity}px (190-215) ${pass(g.identity >= 190 && g.identity <= 215)}  linkH=${g.linkH}  wrapping=${pass(!g.wrapped)}  compact bar hidden=${pass(g.barHidden)}`);
  await ctx.close();
}

console.log("\n=== KEYBOARD ORDER + ARIA (1440x900) ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const order = [];
  for (let i = 0; i < 7; i++) {
    await p.keyboard.press("Tab");
    await p.screenshot({ type: "jpeg", quality: 20 });
    const a = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      return { text: (el.textContent || "").trim().slice(0, 16), tag: el.tagName,
               outline: cs.outlineWidth + " " + cs.outlineStyle, ring: cs.boxShadow.slice(0, 30) };
    });
    if (a) order.push(a);
  }
  console.log("  tab order:", order.map(o => o.text || o.tag).join(" -> "));
  const visible = order.every(o => o.outline !== "0px none" && parseFloat(o.outline) >= 2);
  console.log(`  every focused control has a >=2px visible ring: ${pass(visible)} (e.g. "${order[0]?.outline}", halo "${order[0]?.ring}...")`);

  const aria = await p.evaluate(() => {
    const navs = [...document.querySelectorAll("nav")].map(n => ({
      label: n.getAttribute("aria-label"),
      visible: getComputedStyle(n).display !== "none" && getComputedStyle(n.closest("[class]")).display !== "none",
    }));
    const cur = [...document.querySelectorAll("[aria-current]")].map(a => a.getAttribute("aria-current"));
    const btn = document.querySelector(".site-nav__toggle");
    return { navs, cur, panelId: document.querySelector(".site-nav__panel")?.id,
             controls: btn.getAttribute("aria-controls"), expanded: btn.getAttribute("aria-expanded") };
  });
  console.log(`  nav landmarks: ${JSON.stringify(aria.navs)}`);
  /* Stage 04 changed this deliberately: at the top of the page the hero
     owns the viewport, so no section is active. One item becomes current
     only once a section reaches the detection band. */
  console.log(`  aria-current at hero (expect none): ${JSON.stringify(aria.cur)} ${pass(aria.cur.length === 0)}`);
  console.log(`  panel id="${aria.panelId}" matches aria-controls="${aria.controls}": ${pass(aria.panelId === aria.controls)}`);
  await ctx.close();
}
await browser.close();
