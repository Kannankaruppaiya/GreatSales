/**
 * Renders the app icons from the brand mark that already lives in code.
 *
 * `components/brand/BrandMark.tsx` defines the mark completely — a rounded
 * square at 26% radius, filled Primary, with a white G in Plus Jakarta Sans
 * ExtraBold at 52% of the size. These files are that same mark rasterised at
 * the sizes the stores and the browser need, so nothing here is a new piece of
 * artwork and the icons cannot drift from the app's own lockup.
 *
 * Re-run after changing the mark or the brand colour:
 *   node scripts/make-icons.mjs
 *
 * The Android adaptive foreground is drawn at 60% of the canvas: Android masks
 * the outer ~33% away, and a mark drawn edge to edge loses its corners.
 */
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const outDir = path.join(appRoot, "assets", "images");

// Kept in step with src/design/tokens.ts.
const PRIMARY = "#17A45E";
const ON_PRIMARY = "#FFFFFF";

const fontPath = path.resolve(
  appRoot,
  "../../node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf",
);

/**
 * @param size      canvas edge in px
 * @param markScale the mark's edge as a fraction of the canvas
 * @param transparent  true for the Android foreground, which is masked
 */
function page(size, markScale, transparent, fontDataUri) {
  const mark = Math.round(size * markScale);
  const radius = Math.round(mark * 0.26);
  const letter = Math.round(mark * 0.52);
  return `<!doctype html><meta charset="utf-8"><style>
    @font-face {
      font-family: "PJS";
      src: url("${fontDataUri}") format("truetype");
      font-weight: 800;
    }
    html, body { margin: 0; padding: 0; }
    body {
      width: ${size}px; height: ${size}px;
      background: ${transparent ? "transparent" : PRIMARY};
      display: flex; align-items: center; justify-content: center;
    }
    .mark {
      width: ${mark}px; height: ${mark}px;
      border-radius: ${radius}px;
      background: ${PRIMARY};
      display: flex; align-items: center; justify-content: center;
    }
    .g {
      font-family: "PJS"; font-weight: 800;
      font-size: ${letter}px; line-height: 1;
      color: ${ON_PRIMARY};
      /* The cap sits marginally high in this face; nudge it onto the optical
         centre so the letter does not read as floating. */
      transform: translateY(${Math.round(letter * 0.02)}px);
    }
  </style><div class="mark"><span class="g">G</span></div>`;
}

const TARGETS = [
  // The store icon is the full square: iOS masks the corners itself, and a
  // second rounded corner inside Apple's would show as a visible seam.
  { file: "icon.png", size: 1024, markScale: 1, transparent: false },
  { file: "adaptive-icon.png", size: 1024, markScale: 0.6, transparent: true },
  { file: "splash-icon.png", size: 512, markScale: 0.72, transparent: true },
  { file: "favicon.png", size: 48, markScale: 1, transparent: false },
];

const ttf = await readFile(fontPath);
const fontDataUri = `data:font/ttf;base64,${ttf.toString("base64")}`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
});

for (const target of TARGETS) {
  const context = await browser.newContext({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  const p = await context.newPage();
  await p.setContent(
    page(target.size, target.markScale, target.transparent, fontDataUri),
  );
  await p.evaluate(() => document.fonts.ready);
  const buffer = await p.screenshot({
    omitBackground: target.transparent,
    type: "png",
  });
  await writeFile(path.join(outDir, target.file), buffer);
  console.log(`${target.file}  ${target.size}x${target.size}`);
  await context.close();
}

await browser.close();
