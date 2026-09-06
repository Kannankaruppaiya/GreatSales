#!/usr/bin/env node
/**
 * Generate the GreatSales app icon set.
 *
 * The mobile app shipped with Expo's default template icon, which is what a
 * customer would have seen on their home screen. There is no design source
 * file and no rasterizer in this repo, so the mark is drawn here in code: a
 * PNG encoder over `zlib` plus 4x supersampling for clean edges. Regenerate
 * with `pnpm icons` rather than hand-editing the PNGs.
 *
 * The mark is three ascending rounded bars — a sales trend — in white on the
 * brand blue that the splash screen already uses.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAND = [0x20, 0x8a, 0xef]; // #208AEF — same blue as the splash background
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'mobile', 'assets', 'images');
const SS = 4; // supersampling factor: draw big, average down, get antialiasing for free

// --- PNG ------------------------------------------------------------------
function png(width, height, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // Each scanline is prefixed with filter type 0 (None). Filtering would
  // shrink the file; these are icons, not payloads.
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

// --- drawing --------------------------------------------------------------
/** A shape is a predicate over unit coordinates: is (x, y) inside? */
const roundedRect = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/** Three ascending bars, expressed in a 0..1 box so they scale to any size. */
function barsShape(inset) {
  const s = 1 - 2 * inset;
  const at = (v) => inset + v * s;
  const w = 0.20 * s;
  const r = w / 2;
  const bars = [
    [0.06, 0.62], // [left, top] — right edge is left+w, bottom is common
    [0.40, 0.34],
    [0.74, 0.06],
  ].map(([l, t]) => roundedRect(at(l), at(t), at(l) + w, at(0.94), r));
  return (x, y) => bars.some((b) => b(x, y));
}

/**
 * @param size    output edge length in pixels
 * @param bg      [r,g,b] background, or null for transparent
 * @param fg      [r,g,b] mark colour
 * @param inset   fraction of the canvas kept clear around the mark
 * @param corner  background corner radius as a fraction of size (0 = square)
 */
function render({ size, bg, fg, inset, corner = 0 }) {
  const n = size * SS;
  const mark = barsShape(inset);
  const bgShape = corner > 0 ? roundedRect(0, 0, 1, 1, corner) : () => true;
  const out = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Average SS*SS subsamples: this is the antialiasing.
      let bgHits = 0;
      let fgHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x * SS + sx + 0.5) / n;
          const v = (y * SS + sy + 0.5) / n;
          if (bgShape(u, v)) bgHits++;
          if (mark(u, v)) fgHits++;
        }
      }
      const total = SS * SS;
      const bgA = bg ? bgHits / total : 0;
      const fgA = fgHits / total * (bg ? 1 : bgShape((x + 0.5) / size, (y + 0.5) / size) ? 1 : 0);
      // Composite mark over background, then over transparency.
      const a = Math.min(1, bgA + fgA);
      const mix = (i) => {
        const base = bg ? bg[i] * bgA : 0;
        return a === 0 ? 0 : Math.round((base * (1 - fgA) + fg[i] * fgA) / a);
      };
      const o = (y * size + x) * 4;
      out[o] = mix(0);
      out[o + 1] = mix(1);
      out[o + 2] = mix(2);
      out[o + 3] = Math.round(a * 255);
    }
  }
  return png(size, size, out);
}

const WHITE = [255, 255, 255];
const files = {
  // iOS and the store listing want an opaque square; the OS masks the corners.
  'icon.png': { size: 1024, bg: BRAND, fg: WHITE, inset: 0.18 },
  // Android adaptive icons are two layers the launcher masks together. The
  // foreground must stay inside the safe zone or the mask crops the mark.
  'android-icon-background.png': { size: 1024, bg: BRAND, fg: BRAND, inset: 0.5 },
  'android-icon-foreground.png': { size: 1024, bg: null, fg: WHITE, inset: 0.29 },
  'android-icon-monochrome.png': { size: 1024, bg: null, fg: WHITE, inset: 0.29 },
  // The splash background colour comes from app.json, so the image is the mark alone.
  'splash-icon.png': { size: 512, bg: null, fg: WHITE, inset: 0.05 },
  'favicon.png': { size: 64, bg: BRAND, fg: WHITE, inset: 0.16, corner: 0.22 },
};

for (const [name, opts] of Object.entries(files)) {
  const buf = render(opts);
  writeFileSync(join(OUT, name), buf);
  console.log(`${name.padEnd(30)} ${opts.size}x${opts.size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
