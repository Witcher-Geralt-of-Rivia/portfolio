/**
 * Public-site continuity monitor.
 *
 * Used to prove that building an inactive release slot cannot disturb the live
 * site. Uses a keep-alive https.Agent so the run does not perform a fresh DNS
 * lookup per request. Hammering DuckDNS that way trips the resolver and
 * produces ENOTFOUND failures that look like an outage but are not.
 *
 *   node qa/deploy-continuity.mjs <seconds> <out.json> [assetPath...]
 */
import fs from "node:fs";
import https from "node:https";

const HOST = "intelligent-systems-lab.duckdns.org";
const agent = new https.Agent({ keepAlive: true, maxSockets: 4 });

const [seconds, out, ...rawAssets] = process.argv.slice(2);
// Paths captured through a Windows shell can carry a stray CR, which makes
// http.request throw ERR_UNESCAPED_CHARACTERS.
const assets = rawAssets.map((a) => a.replace(/[^\x21-\x7e]/g, "")).filter(Boolean);
const targets = [["page", "/"], ...assets.map((a, i) => [`asset${i + 1}`, a])];
const rows = [];
const until = Date.now() + Number(seconds) * 1000;

const hit = (path) =>
  new Promise((resolve) => {
    const req = https.request(
      { host: HOST, path, method: "GET", agent, timeout: 8000 },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode }));
      }
    );
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, err: "timeout" }); });
    req.on("error", (e) => resolve({ status: 0, err: e.code || e.message.slice(0, 30) }));
    req.end();
  });

while (Date.now() < until) {
  for (const [name, path] of targets) {
    const r = await hit(path);
    rows.push({ t: Date.now(), name, path, status: r.status, err: r.err ?? null });
  }
  fs.writeFileSync(out, JSON.stringify(rows));
  await new Promise((r) => setTimeout(r, 800));
}
fs.writeFileSync(out, JSON.stringify(rows));
