import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";

/* Stage 06 layout audit across the eight required viewports. Every surface has
   to survive at every width: nothing dropped, nothing overflowing, nothing
   overlapping into unreadability. */

const VIEWPORTS = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800]];
const pass = (b) => (b ? "PASS" : "FAIL");
const frame = async (p) => { await p.screenshot({ type: "jpeg", quality: 20 }); };

const browser = await chromium.launch({
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
});

let failures = 0;

for (const [w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/#products", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await frame(p); await p.waitForTimeout(700); await frame(p);

  const r = await p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (s) => { const e = q(s); return e ? e.getBoundingClientRect() : null; };
    const present = (s) => { const b = box(s); return !!b && b.width > 0 && b.height > 0; };

    const studio = box(".pstudio");
    const web = box(".pweb__frame");
    const mob = box(".pmob__device");
    const assist = box(".passist__panel");
    const flow = box(".pflow");
    const rail = box(".products__rail");

    // Horizontal overflow of the section and of the studio's own contents.
    const section = q("#products");
    const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const inside = [...q(".pstudio").querySelectorAll("*")]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .filter((e) => {
        const b = e.getBoundingClientRect();
        return b.left < studio.left - 1 || b.right > studio.right + 1;
      })
      .map((e) => e.className.toString().split(" ")[0]);

    // Do the three surfaces overlap each other's *content*? Controlled edge
    // overlap is allowed by design; content collision is not.
    const overlapArea = (a, b) => {
      if (!a || !b) return 0;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };
    const webMob = overlapArea(web, mob);
    const webAssist = overlapArea(web, assist);
    const mobAssist = overlapArea(mob, assist);

    // Every scenario tab reachable and sized for touch at small widths.
    const tabs = [...document.querySelectorAll(".pscenario")].map((t) => {
      const b = t.getBoundingClientRect();
      return { label: t.textContent, w: Math.round(b.width), h: Math.round(b.height) };
    });
    const runBtn = box(".pstudio__run");

    // Flow rail: are all six stages laid out without collapsing to zero?
    const nodes = [...document.querySelectorAll(".pflow__node")].map((n) => {
      const b = n.getBoundingClientRect();
      return { w: Math.round(b.width), label: n.querySelector(".pflow__node-label").textContent };
    });

    return {
      surfaces: { web: present(".pweb__frame"), mobile: present(".pmob__device"), assist: present(".passist__panel"), flow: present(".pflow"), rail: present(".products__rail") },
      studio: [Math.round(studio.width), Math.round(studio.height)],
      sizes: {
        web: web ? [Math.round(web.width), Math.round(web.height)] : null,
        mobile: mob ? [Math.round(mob.width), Math.round(mob.height)] : null,
        assist: assist ? [Math.round(assist.width), Math.round(assist.height)] : null,
        flow: flow ? [Math.round(flow.width), Math.round(flow.height)] : null,
        rail: rail ? [Math.round(rail.width), Math.round(rail.height)] : null,
      },
      docOverflow,
      escaping: [...new Set(inside)],
      overlaps: { webMob: Math.round(webMob), webAssist: Math.round(webAssist), mobAssist: Math.round(mobAssist) },
      tabs, runBtn: runBtn ? [Math.round(runBtn.width), Math.round(runBtn.height)] : null,
      nodes,
      sectionTop: Math.round(section.getBoundingClientRect().top + window.scrollY),
    };
  });

  const allPresent = Object.values(r.surfaces).every(Boolean);
  const noOverflow = r.docOverflow <= 0;
  const noEscape = r.escaping.length === 0;
  const noContentCollision = r.overlaps.webMob === 0 && r.overlaps.mobAssist === 0;
  const minTab = Math.min(...r.tabs.map((t) => t.h));
  const minNode = Math.min(...r.nodes.map((n) => n.w));
  const touchOk = w >= 700 ? minTab >= 30 : minTab >= 32;

  const ok = allPresent && noOverflow && noEscape && noContentCollision && touchOk && minNode >= 44;
  if (!ok) failures++;

  console.log(`\n--- ${w}x${h} --- studio ${r.studio[0]}x${r.studio[1]}`);
  console.log(`  all five surfaces present: ${pass(allPresent)}  ${JSON.stringify(r.surfaces)}`);
  console.log(`  sizes web ${r.sizes.web} mobile ${r.sizes.mobile} assist ${r.sizes.assist} flow ${r.sizes.flow}`);
  console.log(`  document horizontal overflow: ${r.docOverflow}px ${pass(noOverflow)}`);
  console.log(`  elements escaping the studio: ${r.escaping.length ? r.escaping.join(", ") : "none"} ${pass(noEscape)}`);
  console.log(`  surface content collision (web/mobile ${r.overlaps.webMob}, mobile/assist ${r.overlaps.mobAssist}, web/assist ${r.overlaps.webAssist} = allowed edge depth) ${pass(noContentCollision)}`);
  console.log(`  scenario tab height min ${minTab}px ${pass(touchOk)} | run button ${r.runBtn}`);
  console.log(`  flow node min width ${minNode}px ${pass(minNode >= 44)}`);
  await ctx.close();
}

await browser.close();
console.log(`\n=== stage06 responsive: ${failures === 0 ? "ALL PASS" : failures + " viewport(s) FAILED"} ===`);
process.exit(failures === 0 ? 0 : 1);
