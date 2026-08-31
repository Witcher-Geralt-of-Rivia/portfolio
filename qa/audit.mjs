import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto("http://localhost:3117/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Sample the real rendered backdrop under each text sample, worst case.
const samples = await page.evaluate(() => {
  const out = [];
  for (const sel of [".specimen__note", ".text-primary", ".text-secondary", ".text-muted", ".text-technical", ".specimen__panel-name"]) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    out.push({ sel, color: getComputedStyle(el).color, x: Math.round(r.x + 4), y: Math.round(r.y + r.height / 2) });
  }
  return out;
});
const shot = await page.screenshot();
const { PNG } = await import("pngjs");
const png = PNG.sync.read(shot);
const px = (x, y) => { const i = (png.width * y + x) << 2; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
for (const s of samples) {
  // find the lightest nearby background pixel (worst case for dark text)
  let best = [0, 0, 0];
  for (let dx = -30; dx <= 120; dx += 6) for (let dy = -14; dy <= 14; dy += 4) {
    const p = px(Math.max(0, s.x + dx), Math.max(0, s.y + dy));
    if (Math.min(...p) > Math.min(...best)) continue;
    if (Math.min(...p) < 205) continue;
    best = p;
  }
  const c = s.color.match(/\d+/g).slice(0, 3).map(Number);
  const bg = px(s.x + 200, s.y);
  console.log(`${s.sel.padEnd(24)} ${s.color.padEnd(20)} on bg rgb(${bg}) -> ${ratio(c, bg).toFixed(2)}:1`);
}
const html = await page.content();
const banned = [/mailto:/i, /@[a-z0-9.-]+\.(com|net|org|io|dev)/i, /\btelegram\b/i, /\bwhatsapp\b/i, /\bdiscord\b/i, /tel:/i, /contact/i, /\+\d{6,}/];
const hits = banned.filter(re => re.test(html));
console.log("\nContact-info scan of rendered HTML:", hits.length ? "HITS " + hits : "clean");
await browser.close();
