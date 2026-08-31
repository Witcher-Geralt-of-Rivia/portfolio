import { chromium } from "playwright";
const browser = await chromium.launch();
for (const vp of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3117/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable");
  const grab = async () => Object.fromEntries((await client.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]));
  const a = await grab();
  await page.waitForTimeout(6000);
  const b = await grab();
  const d = k => +(b[k] - a[k]).toFixed(3);
  console.log(
    `${String(vp.width + "x" + vp.height).padEnd(10)} over 6s of animation: ` +
    `layouts=+${d("LayoutCount")} styleRecalcs=+${d("RecalcStyleCount")} ` +
    `scriptTime=+${d("ScriptDuration")}s layoutTime=+${d("LayoutDuration")}s ` +
    `recalcTime=+${d("RecalcStyleDuration")}s nodes=${b.Nodes} jsHeapMB=${(b.JSHeapUsedSize/1048576).toFixed(1)}`
  );
  await ctx.close();
}
await browser.close();
