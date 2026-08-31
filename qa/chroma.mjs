import { PNG } from "pngjs";
import fs from "node:fs";

const file = process.argv[2];
const png = PNG.sync.read(fs.readFileSync(file));
const { width, height, data } = png;

const chromas = [];
for (let y = 0; y < height; y += 3) {
  for (let x = 0; x < width; x += 3) {
    const i = (width * y + x) << 2;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.min(r, g, b) < 200) continue; // skip text pixels
    chromas.push(Math.max(r, g, b) - Math.min(r, g, b));
  }
}
chromas.sort((a, b) => a - b);
const q = (p) => chromas[Math.floor((chromas.length - 1) * p)];
console.log(file);
console.log("  chroma p10/p50/p75/p90/p99/max:",
  q(0.1), q(0.5), q(0.75), q(0.9), q(0.99), chromas[chromas.length - 1]);

// 5x4 grid of average colours
const gx = 5, gy = 4;
for (let ry = 0; ry < gy; ry++) {
  let row = "  ";
  for (let rx = 0; rx < gx; rx++) {
    let r = 0, g = 0, b = 0, n = 0;
    const x0 = Math.floor((width * rx) / gx), x1 = Math.floor((width * (rx + 1)) / gx);
    const y0 = Math.floor((height * ry) / gy), y1 = Math.floor((height * (ry + 1)) / gy);
    for (let y = y0; y < y1; y += 4) {
      for (let x = x0; x < x1; x += 4) {
        const i = (width * y + x) << 2;
        if (Math.min(data[i], data[i + 1], data[i + 2]) < 200) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
    if (!n) { row += "   ----------   "; continue; }
    const R = Math.round(r / n), G = Math.round(g / n), B = Math.round(b / n);
    row += `${String(R).padStart(3)},${String(G).padStart(3)},${String(B).padStart(3)} (c${String(Math.max(R,G,B)-Math.min(R,G,B)).padStart(2)})  `;
  }
  console.log(row);
}
