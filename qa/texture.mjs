import { PNG } from "pngjs";
import fs from "node:fs";
const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
const { width, height, data } = png;

// Local variation inside smooth patches: is the grain actually dithering?
function patch(cx, cy, size = 60) {
  const vals = [];
  for (let y = cy; y < cy + size; y++)
    for (let x = cx; x < cx + size; x++) {
      const i = (width * y + x) << 2;
      vals.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }
  const mean = vals.reduce((a, b) => a + b) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  const uniq = new Set(vals.map(Math.round)).size;
  return { mean: +mean.toFixed(2), sd: +sd.toFixed(3), distinctLevels: uniq };
}

// Banding: run-lengths of identical luminance along a scanline.
function bands(y) {
  let runs = [], cur = 1, prev = null;
  for (let x = 0; x < width; x++) {
    const i = (width * y + x) << 2;
    const v = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
    if (v === prev) cur++;
    else { if (prev !== null) runs.push(cur); cur = 1; prev = v; }
  }
  runs.push(cur);
  runs.sort((a, b) => b - a);
  return { longestFlatRun: runs[0], meanRun: +(runs.reduce((a, b) => a + b) / runs.length).toFixed(2) };
}

console.log(process.argv[2]);
for (const [name, x, y] of [["top-left", 120, 60], ["top-right", 1200, 60], ["mid", 640, 300], ["bottom", 400, 780]])
  console.log(`  patch ${name.padEnd(10)}`, patch(x, y));
for (const y of [60, 300, 780]) console.log(`  scanline y=${String(y).padStart(3)}`, bands(y));
