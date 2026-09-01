/**
 * Brand asset derivation.
 *
 * Produces the deployable icon sizes from the approved master at
 * `logo.png`, which is never modified. Uses `pngjs`, already a
 * devDependency for the QA harnesses, rather than adding an image library for
 * one task.
 *
 * Downsampling premultiplies alpha before averaging and un-premultiplies
 * afterwards. Averaging straight RGBA instead would pull the colour of fully
 * transparent pixels — usually black — into every edge, and the mark is 64%
 * transparent with a wide soft border, so the halo would be obvious at 32px.
 *
 * Run: node qa/brand-derive.mjs
 */

import { PNG } from "pngjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SOURCE = "logo.png";

/** Box-downsample an RGBA image, averaging in premultiplied space. */
function resize(src, size) {
  const out = new PNG({ width: size, height: size });
  const sx = src.width / size;
  const sy = src.height / size;

  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.min(src.height, Math.ceil((y + 1) * sy));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(src.width, Math.ceil((x + 1) * sx));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;

      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) * 4;
          const alpha = src.data[i + 3] / 255;
          /* Premultiplied: a transparent pixel contributes no colour at all,
             only its (zero) weight. */
          r += src.data[i] * alpha;
          g += src.data[i + 1] * alpha;
          b += src.data[i + 2] * alpha;
          a += src.data[i + 3];
          n += 1;
        }
      }

      const meanA = a / n;
      const weight = meanA / 255;
      const o = (y * size + x) * 4;
      /* Un-premultiply. Where the average alpha is zero there is no colour to
         recover, so the pixel stays fully transparent black. */
      out.data[o] = weight > 0 ? Math.round(r / n / weight) : 0;
      out.data[o + 1] = weight > 0 ? Math.round(g / n / weight) : 0;
      out.data[o + 2] = weight > 0 ? Math.round(b / n / weight) : 0;
      out.data[o + 3] = Math.round(meanA);
    }
  }
  return out;
}

function write(png, path) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png, { deflateLevel: 9 }));
  return readFileSync(path).length;
}

const master = PNG.sync.read(readFileSync(SOURCE));
if (master.width !== master.height) {
  throw new Error(`Expected a square master, got ${master.width}x${master.height}.`);
}

/**
 * Sizes.
 *
 * `icon.png` is 256 rather than the more usual 512. The master is a soft
 * gradient mark, which PNG compresses poorly: 512 costs 164 KB against 55 KB
 * at 256, and 256 is already more than any favicon, bookmark or tab rendering
 * path asks for. A 164 KB tab icon would be out of proportion in a project
 * whose navigation mark was an 890-byte SVG.
 *
 * `logo-96` is the navigation source, displayed at 28px, so it still has
 * better than 3x for a high-density screen.
 */
const TARGETS = [
  ["src/app/icon.png", 256],
  ["src/app/apple-icon.png", 180],
  ["public/brand/logo-192.png", 192],
  ["public/brand/logo-96.png", 96],
];

console.log(`master ${SOURCE}  ${master.width}x${master.height}`);
for (const [path, size] of TARGETS) {
  const bytes = write(resize(master, size), path);
  console.log(`  ${path.padEnd(30)} ${String(size).padStart(4)}px  ${(bytes / 1024).toFixed(1)} KB`);
}
