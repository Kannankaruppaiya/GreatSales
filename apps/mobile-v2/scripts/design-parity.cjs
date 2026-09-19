#!/usr/bin/env node
/**
 * Measures a built screen against the board it came from.
 *
 * Screens are traced from Penpot, and a trace drifts the moment anybody edits
 * a margin. Comparing screenshots by eye does not catch eight pixels; this
 * does, by reading each text run's position out of the rendered page and
 * subtracting the y and x the design records in design/screens/*.json.
 *
 * It found the splash panel's content sitting 12px low on its first run - the
 * gap under the CTA had been set to 14 where the board has 24 - which is
 * exactly the size of error that survives a side-by-side look.
 *
 *   npx expo export --platform web --output-dir dist
 *   npx serve -s dist -l 4601
 *   node scripts/design-parity.cjs 01-splash [url] [tolerance]
 *
 * Elements are matched BY THEIR TEXT, not by a class or a testID, so the
 * assertion is against the design rather than against our own markup.
 */
const path = require('path');

const [, , screenArg, urlArg, tolArg] = process.argv;
const screen = screenArg || '01-splash';
const url = urlArg || 'http://localhost:4601/';
const TOLERANCE = Number(tolArg ?? 4);

const spec = require(path.join(__dirname, '..', 'design', 'screens', `${screen}.json`));
const BOARD_W = spec._board?.width ?? 376;
const BOARD_H = spec._board?.height ?? 859;

/** Playwright's own browser is not always the one installed here. */
const EXECUTABLE = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

(async () => {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch(
    require('fs').existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {},
  );
  const page = await browser.newPage({ viewport: { width: BOARD_W, height: BOARD_H } });

  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  // Fonts change metrics, so measuring before they land measures the fallback.
  await page.waitForTimeout(2500);

  const wanted = spec.shapes
    .filter((s) => s.chars)
    .map((s) => ({ n: s.n, chars: s.chars, y: s.y, x: s.x }));

  const measured = await page.evaluate((items) => {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let t;
    while ((t = walk.nextNode())) if (t.textContent.trim()) nodes.push(t);
    return items.map((it) => {
      const hit = nodes.find((n) => n.textContent.trim() === it.chars.trim());
      if (!hit) return { n: it.n, missing: true };
      const r = hit.parentElement.getBoundingClientRect();
      const cs = getComputedStyle(hit.parentElement);
      return {
        n: it.n,
        top: Math.round(r.top),
        left: Math.round(r.left),
        fontSize: cs.fontSize,
        family: cs.fontFamily.split(',')[0].replace(/"/g, ''),
      };
    });
  }, wanted);

  console.log(`\n${screen} — rendered at ${BOARD_W}x${BOARD_H}, tolerance ${TOLERANCE}px\n`);
  console.log('name          design-y  render-y    Δy   design-x  render-x    Δx   size   font');
  console.log('─'.repeat(88));

  let failures = 0;
  const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);

  for (const it of wanted) {
    const m = measured.find((x) => x.n === it.n);
    if (!m || m.missing) {
      console.log(`${it.n.padEnd(13)} NOT FOUND IN RENDER — text "${it.chars}"`);
      failures++;
      continue;
    }
    const dy = m.top - it.y;
    const dx = it.x == null ? null : m.left - it.x;
    const bad = Math.abs(dy) > TOLERANCE || (dx != null && Math.abs(dx) > TOLERANCE);
    if (bad) failures++;
    console.log(
      `${it.n.padEnd(13)}${String(it.y).padStart(9)}${String(m.top).padStart(10)}` +
        `${sign(dy).padStart(6)}${String(it.x ?? '-').padStart(11)}` +
        `${String(dx == null ? '-' : m.left).padStart(10)}${(dx == null ? '-' : sign(dx)).padStart(6)}` +
        `${String(m.fontSize).padStart(7)}   ${m.family}${bad ? '   ← off' : ''}`,
    );
  }

  console.log('─'.repeat(88));
  if (consoleErrors.length) {
    console.log(`console errors (${consoleErrors.length}):`);
    for (const e of consoleErrors.slice(0, 5)) console.log('  ' + e);
    failures += consoleErrors.length;
  }
  console.log(failures ? `\n${failures} problem(s)\n` : '\nmatches the board\n');

  await browser.close();
  process.exit(failures ? 1 : 0);
})();
