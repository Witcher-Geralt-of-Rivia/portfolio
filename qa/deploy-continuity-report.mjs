import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const fmt = (t) => new Date(t).toTimeString().slice(0, 8);
const names = [...new Set(rows.map((r) => r.name))];
console.log(`  window ${fmt(rows[0].t)} -> ${fmt(rows.at(-1).t)}   samples ${rows.length}`);
for (const n of names) {
  const s = rows.filter((r) => r.name === n);
  const ok = s.filter((r) => r.status === 200).length;
  const non = s.filter((r) => r.status !== 200 && r.status !== 0);
  const fail = s.filter((r) => r.status === 0);
  console.log(
    `  ${n.padEnd(7)} total=${String(s.length).padStart(3)}  200=${String(ok).padStart(3)}  non-200=${non.length}  connFail=${fail.length}` +
      (s[0]?.path ? `   ${s[0].path}` : "")
  );
  if (non.length) console.log(`          statuses ${[...new Set(non.map((r) => r.status))].join(",")} at ${non.slice(0, 5).map((r) => fmt(r.t)).join(" ")}`);
  if (fail.length) console.log(`          errors ${[...new Set(fail.map((r) => r.err))].join(",")} at ${fail.slice(0, 5).map((r) => fmt(r.t)).join(" ")}`);
}
const bad = rows.filter((r) => r.status !== 200);
console.log(bad.length ? `  outage window: ${fmt(bad[0].t)} -> ${fmt(bad.at(-1).t)} (${((bad.at(-1).t - bad[0].t) / 1000).toFixed(1)}s span, ${bad.length} samples)` : "  NO non-200 responses at any point");
