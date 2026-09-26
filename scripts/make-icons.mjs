#!/usr/bin/env node
/**
 * Generate the GreatSales brand asset set — every favicon, touch icon and
 * launcher icon the web console and the mobile app ship.
 *
 * There is no design source file and no rasterizer in this repo, so the mark is
 * drawn here in code: a PNG encoder over `zlib` plus 4x supersampling for clean
 * edges. Regenerate with `pnpm icons` rather than hand-editing the PNGs.
 *
 * The mark is a G whose bowl opens at the top right and carries an arrow away
 * up and to the right: the letter and the growth in one stroke. The same
 * geometry lives in `apps/web/src/components/BrandMark.tsx` (React); those two
 * are the only copies, and `MARK` below is the one this file writes into
 * `favicon.svg`. The sales app's launcher icons are drawn from its own mark by
 * `apps/mobilev2/scripts/make-icons.mjs`, which `pnpm icons` runs after this.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The emerald the design system calls `--color-brand`, and the two stops the
// tile is filled with.
const BRAND = [0x05, 0x96, 0x69]; // #059669
const TILE_FROM = [0x10, 0xb9, 0x81]; // #10b981
const TILE_TO = [0x04, 0x78, 0x57]; // #047857
const WHITE = [255, 255, 255];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps', 'web', 'public');
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

// --- the mark -------------------------------------------------------------
/**
 * The mark is authored on a 64 unit grid, the same grid the two React
 * components use, so a number changed in one place can be copied verbatim.
 *
 * The bowl is a 315° arc of a circle drawn as a stroke, left open between due
 * east and the up-right diagonal; the crossbar closes the letter at the middle
 * right; the arrowhead sits on the upper terminal and points out through the
 * opening. `svgPath` is the same bowl expressed for a vector renderer.
 */
const MARK = {
  ring: { cx: 32, cy: 32, r: 17, w: 8 },
  // Where the bowl begins, tucked under the arrowhead at 45°.
  arcStart: [44.02, 19.98],
  // The crossbar runs in from the lower terminal at the vertical middle.
  bar: { x0: 39, x1: 49, y: 32 },
  arrow: [
    [54.5, 9.5],
    [49.55, 24.35],
    [39.65, 14.45],
  ],
  svgPath: 'M 44.02 19.98 A 17 17 0 1 0 49 32 L 39 32',
};
const U = (v) => v / 64;

/** A shape is a predicate over unit coordinates: is (x, y) inside? */
const roundedRect = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/** Inside the triangle a, b, c — all three cross products share a sign. */
const triangle = (a, b, c) => (x, y) => {
  const side = (p, q) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const s1 = side(a, b);
  const s2 = side(b, c);
  const s3 = side(c, a);
  return !((s1 < 0 || s2 < 0 || s3 < 0) && (s1 > 0 || s2 > 0 || s3 > 0));
};

/**
 * The G, expressed in a 0..1 box so it scales to any size. `scale` grows the
 * letter about the centre of the canvas: at 1 it sits at the proportion the
 * product tile uses. Pass 0 for no mark at all — the Android background layer
 * is a plain fill.
 */
function gShape(scale = 1) {
  if (scale <= 0) return () => false;
  const { cx, cy, r, w } = MARK.ring;
  const [ax, ay] = MARK.arcStart;
  const { x0, x1, y: by } = MARK.bar;
  const arrow = triangle(...MARK.arrow.map(([px, py]) => [U(px), U(py)]));
  const half = U(w) / 2;
  const C = [U(cx), U(cy)];
  const R = U(r);
  const cap = [U(ax), U(ay)];

  return (px, py) => {
    // Undo the scale about the centre, then test against the base geometry.
    const x = 0.5 + (px - 0.5) / scale;
    const y = 0.5 + (py - 0.5) / scale;

    // The crossbar, a capsule along y = 32 between the two x bounds.
    const bx = Math.min(Math.max(x, U(x0)), U(x1));
    if ((x - bx) ** 2 + (y - U(by)) ** 2 <= half * half) return true;

    if (arrow(x, y)) return true;

    // The round cap on the upper terminal, which the arrowhead sits over.
    if ((x - cap[0]) ** 2 + (y - cap[1]) ** 2 <= half * half) return true;

    // The bowl: within the stroke, and outside the 45° opening at the top right.
    const dx = x - C[0];
    const dy = y - C[1];
    const d = Math.hypot(dx, dy);
    if (Math.abs(d - R) > half) return false;
    const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
    return (deg < 0 ? deg + 360 : deg) >= 45;
  };
}

/**
 * @param size    output edge length in pixels
 * @param bg      [r,g,b] background, or null for transparent
 * @param bgTo    [r,g,b] second gradient stop, run corner to corner; optional
 * @param fg      [r,g,b] mark colour
 * @param scale   size of the G relative to its natural 59% of the canvas
 * @param corner  background corner radius as a fraction of size (0 = square)
 */
function render({ size, bg, bgTo, fg, scale = 1, corner = 0 }) {
  const n = size * SS;
  const mark = gShape(scale);
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
      const fgA = (fgHits / total) * (bg ? 1 : bgShape((x + 0.5) / size, (y + 0.5) / size) ? 1 : 0);
      // The tile gradient runs corner to corner, so it is a function of x + y.
      const t = (x + y) / (2 * (size - 1 || 1));
      const stop = (i) => (bgTo ? bg[i] + (bgTo[i] - bg[i]) * t : bg[i]);
      // Composite mark over background, then over transparency.
      const a = Math.min(1, bgA + fgA);
      const mix = (i) => {
        const base = bg ? stop(i) * bgA : 0;
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

// --- SVG ------------------------------------------------------------------
/** The vector form, for the browser tab and anywhere a PNG would be a downgrade. */
function markSvg({ tile }) {
  const ink = tile ? '#ffffff' : '#059669';
  const glyph = `<path d="${MARK.svgPath}" fill="none" stroke="${ink}" stroke-width="${MARK.ring.w}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M ${MARK.arrow.map((p) => p.join(' ')).join(' L ')} Z" fill="${ink}"/>`;
  const body = tile
    ? `<defs>
    <linearGradient id="t" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#t)"/>
  <rect width="64" height="64" rx="15" fill="url(#s)"/>
  ${glyph}`
    : glyph;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="GreatSales">
  ${body}
</svg>
`;
}

// --- outputs --------------------------------------------------------------
const files = [
  // The console: an SVG tab icon for every current browser, a PNG for the rest,
  // and the full-bleed square iOS uses when the console is saved to a home screen.
  [WEB, 'favicon.png', { size: 64, bg: BRAND, fg: WHITE, scale: 1, corner: 0.22 }],
  [WEB, 'apple-touch-icon.png', { size: 180, bg: TILE_FROM, bgTo: TILE_TO, fg: WHITE, scale: 0.86 }],
];

for (const [dir, name, opts] of files) {
  mkdirSync(dir, { recursive: true });
  const buf = render(opts);
  writeFileSync(join(dir, name), buf);
  console.log(`${name.padEnd(30)} ${opts.size}x${opts.size}  ${(buf.length / 1024).toFixed(1)} KB`);
}

for (const [dir, name, tile] of [
  [WEB, 'favicon.svg', true],
  [WEB, 'brand-mark.svg', true],
  [WEB, 'brand-glyph.svg', false],
]) {
  const svg = markSvg({ tile });
  writeFileSync(join(dir, name), svg);
  console.log(`${name.padEnd(30)} vector      ${(svg.length / 1024).toFixed(1)} KB`);
}
