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
 * transparent pixels, usually black, into every edge, and the mark is 64%
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
 * The bounding box of everything that is not fully transparent.
 *
 * Measured at a threshold of 1 rather than 0: a handful of pixels carry an
 * alpha of exactly 1, invisible on any background, and honouring them would
 * report a box 97% of the canvas and defeat the trim.
 */
function alphaBounds(png, threshold = 1) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Crop to the artwork plus a safety margin, then scale.
 *
 * The master centres a 965x1119 mark in a 1254 square, so 11.5% of each side
 * is empty. Rendered in a 28px box that leaves the mark 25px tall and 21px
 * wide, which is what made it read small beside 12px type.
 *
 * The crop keeps the mark's own aspect rather than forcing a square: squaring
 * it would re-introduce most of the padding it just removed, since the mark is
 * already 89% of the canvas vertically. The margin is a percentage of the
 * larger trimmed dimension so the soft outer glow and its anti-aliased edge
 * are never clipped.
 */
function tighten(src, marginRatio = 0.05) {
  const b = alphaBounds(src);
  const margin = Math.round(Math.max(b.width, b.height) * marginRatio);
  const x0 = Math.max(0, b.minX - margin);
  const y0 = Math.max(0, b.minY - margin);
  const x1 = Math.min(src.width - 1, b.maxX + margin);
  const y1 = Math.min(src.height - 1, b.maxY + margin);
  const out = new PNG({ width: x1 - x0 + 1, height: y1 - y0 + 1 });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const s = ((y + y0) * src.width + (x + x0)) * 4;
      const o = (y * out.width + x) * 4;
      out.data[o] = src.data[s];
      out.data[o + 1] = src.data[s + 1];
      out.data[o + 2] = src.data[s + 2];
      out.data[o + 3] = src.data[s + 3];
    }
  }
  return { png: out, bounds: b, margin };
}

/** Scale an arbitrary-aspect image to a target height. */
function scaleToHeight(src, height) {
  const width = Math.round((src.width / src.height) * height);
  const out = new PNG({ width, height });
  const sx = src.width / width;
  const sy = src.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.min(src.height, Math.ceil((y + 1) * sy));
    for (let x = 0; x < width; x++) {
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
          r += src.data[i] * alpha;
          g += src.data[i + 1] * alpha;
          b += src.data[i + 2] * alpha;
          a += src.data[i + 3];
          n += 1;
        }
      }
      const meanA = a / n;
      const weight = meanA / 255;
      const o = (y * width + x) * 4;
      out.data[o] = weight > 0 ? Math.round(r / n / weight) : 0;
      out.data[o + 1] = weight > 0 ? Math.round(g / n / weight) : 0;
      out.data[o + 2] = weight > 0 ? Math.round(b / n / weight) : 0;
      out.data[o + 3] = Math.round(meanA);
    }
  }
  return out;
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

/* The tight derivative, used wherever the mark is small enough for the
   master's padding to matter: the navigation and the demo bar. */
const tight = tighten(master);
console.log(
  `
artwork bounds  ${tight.bounds.width}x${tight.bounds.height} at ` +
    `x${tight.bounds.minX} y${tight.bounds.minY}, margin ${tight.margin}px ` +
    `-> ${tight.png.width}x${tight.png.height}`
);
/* One asset for both placements: 120px tall serves 30px at 4x and 22px at
   5.5x, and a single file is one request rather than two. */
for (const [path, height] of [["public/brand/mark-120.png", 120]]) {
  const scaled = scaleToHeight(tight.png, height);
  const bytes = write(scaled, path);
  console.log(
    `  ${path.padEnd(30)} ${scaled.width}x${scaled.height}  ${(bytes / 1024).toFixed(1)} KB`
  );
}
