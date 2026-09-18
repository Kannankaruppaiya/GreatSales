/**
 * Screenshots routes of the exported web build, in a real browser.
 *
 * Typechecking says a screen compiles; this says it renders. Every page error
 * and console error is collected and reported, so a screen that throws on
 * mount is caught rather than shipped.
 *
 *   npx expo export --platform web
 *   python3 -m http.server 8091 --directory dist &
 *   node scripts/screenshot.mjs "/(tabs)/pipeline" /stages
 *
 * Routes are visited by pushing history state rather than by loading the URL:
 * the export is a single-page bundle and a plain static server has no SPA
 * fallback, so a deep link would 404.
 */
import { chromium } from "playwright";

const routes = process.argv.slice(2);
if (routes.length === 0) {
  console.error("usage: node scripts/screenshot.mjs <route> [route...]");
  process.exit(1);
}

const BASE = process.env.PREVIEW_URL ?? "http://127.0.0.1:8091/";
const OUT = process.env.SHOT_DIR ?? "/tmp";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({
  // The Penpot frames are 376×859; matching them keeps the screenshots
  // comparable to the boards.
  viewport: { width: 376, height: 859 },
  deviceScaleFactor: 2,
});

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  // A missing asset is reported by assets/README.md, not by every run.
  if (/404|Failed to load resource/.test(m.text())) return;
  errors.push(`console: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

for (const route of routes) {
  await page.evaluate((r) => {
    window.history.pushState({}, "", r);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
  // Long enough for the synthetic source's simulated latency to settle.
  await page.waitForTimeout(2200);

  const name = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
  await page.screenshot({ path: `${OUT}/shot-${name}.png` });

  const text = await page.evaluate(() => document.body.innerText);
  console.log(`${route} -> ${text.slice(0, 200).replace(/\n+/g, " | ")}`);
}

console.log("ERRORS:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
