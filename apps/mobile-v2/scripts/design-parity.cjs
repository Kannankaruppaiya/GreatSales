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

  /*
   * Messages a DEPENDENCY emits in development and never in a production
   * build. Each entry is an exact substring and each is here with a reason -
   * this is not a place to quieten our own bugs, and the list is short on
   * purpose.
   *
   * Verified absent from `expo export` output before being added.
   */
  const KNOWN_DEV_NOISE = [
    // expo-image's web renderer passes React the HTML attribute spelling.
    'Invalid DOM property `%s`. Did you mean `%s`? fetchpriority fetchPriority',
  ];
  const isNoise = (t) => KNOWN_DEV_NOISE.some((k) => t.includes(k));

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !isNoise(m.text())) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => {
    if (!isNoise(e.message)) consoleErrors.push('pageerror: ' + e.message);
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  // Fonts change metrics, so measuring before they land measures the fallback.
  await page.waitForTimeout(2500);

  const wanted = spec.shapes
    // `_placeholder` used to mean "unmeasurable". It no longer does - an
    // input's placeholder is measured below - and now means only "the design
    // records this and no screen renders it".
    .filter((s) => s.chars && !s._placeholder)
    .map((s) => ({ n: s.n, chars: s.chars, y: s.y, x: s.x, w: s.w, align: s.align, skipX: !!s._skipX }));

  const measured = await page.evaluate((items) => {
    /*
     * Candidates are text nodes AND their nearest element, because a design
     * text run is not always one DOM text node. "GreatSales" is rendered as
     * <Text><Text>G</Text>reatSales</Text> to colour the leading letter, which
     * is two text nodes and no single one of them says "GreatSales"; the
     * element's textContent does.
     */
    const seen = new Set();
    const candidates = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = walk.nextNode())) {
      if (!t.textContent.trim()) continue;
      for (const el of [t.parentElement, t.parentElement?.parentElement]) {
        if (el && !seen.has(el)) {
          seen.add(el);
          candidates.push({ el, text: el.textContent.trim() });
        }
      }
    }

    /*
     * An input's placeholder is rendered text on the screen and has to be
     * measurable, or a search field placed 30px out passes.
     *
     * It is not a text node, so it is collected separately and its position
     * is derived rather than read: the box is the INPUT's, and the text sits
     * one padding and border in, vertically centred in it. That is how the
     * browser lays a placeholder out, and it is what the design's own text
     * shape describes.
     */
    for (const input of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
      const ph = input.getAttribute('placeholder').trim();
      if (ph && !seen.has(input)) {
        seen.add(input);
        candidates.push({ el: input, text: ph, isPlaceholder: true });
      }
    }

    /*
     * Matches are CONSUMED in document order. "3" appears twice on the home
     * screen - the notification badge and a stat - and taking the first hit
     * for both reported the stat as 238px out. The spec lists shapes roughly
     * in document order, so consuming keeps the second "3" for the second
     * entry that wants one.
     */
    const used = new Set();
    const pick = (want) => {
      const exact = candidates.find((c) => !used.has(c.el) && c.text === want);
      if (exact) return exact;
      return candidates.find((c) => !used.has(c.el) && c.text.startsWith(want));
    };

    return items.map((it) => {
      const hit = pick(it.chars.trim());
      if (!hit) return { n: it.n, missing: true };
      const el = hit.el;
      /*
       * Consuming an element consumes its ANCESTORS, and deliberately NOT its
       * descendants.
       *
       * Ancestors, because candidates include both a text node's parent and
       * its grandparent: the notification badge's "3" offers two elements, and
       * leaving the outer one available let it match a stat's "3" and report
       * that 240px out.
       *
       * Not descendants, because one design text run is sometimes two nested
       * ones in the render. The footer is a single Penpot shape with mixed
       * fills, built as <Text>New to GreatSales? <Text>Contact Support</Text>
       * </Text>; consuming the outer match's children took "Contact Support"
       * with it and reported it missing.
       */
      used.add(el);
      for (const other of candidates) {
        if (other.el !== el && other.el.contains(el)) used.add(other.el);
      }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);

      // For a placeholder the box is the field's; the text is inset by the
      // padding and border, and centred in what is left.
      let top = r.top;
      let left = r.left;
      let width = r.width;
      if (hit.isPlaceholder) {
        const px = (v) => parseFloat(v) || 0;
        const lh = px(cs.lineHeight) || px(cs.fontSize) * 1.2;
        const inner = r.height - px(cs.paddingTop) - px(cs.paddingBottom)
          - px(cs.borderTopWidth) - px(cs.borderBottomWidth);
        top = r.top + px(cs.borderTopWidth) + px(cs.paddingTop) + (inner - lh) / 2;
        left = r.left + px(cs.borderLeftWidth) + px(cs.paddingLeft);
        width = r.width - px(cs.borderLeftWidth) - px(cs.paddingLeft)
          - px(cs.borderRightWidth) - px(cs.paddingRight);
      }

      return {
        n: it.n,
        top: Math.round(top),
        left: Math.round(left),
        right: Math.round(left + width),
        width: Math.round(width),
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

    /*
     * A centred run is compared by its CENTRE, not its left edge.
     *
     * Penpot's shape for centred text is a BOX - "Continue with Google" is a
     * 221-wide box at x128, not a glyph run starting at 128 - and the browser
     * lays the same string out to its own width. Subtracting two left edges
     * there measures the difference between two text-measurement engines, not
     * a layout error. Centres are the same point in both.
     */
    const centred = it.align === 'center' || (it.x == null && it.w == null);
    /*
     * A right-aligned run is compared by its RIGHT edge, for the same reason a
     * centred one is compared by its centre: Penpot's shape is a box and the
     * browser lays the string to its own width, so only the aligned edge is
     * the same point in both. "View All" sits in a 109-wide box at x234 and
     * reads as 56px out on its left edge while its right edge is exact.
     */
    const rightAligned = it.align === 'right' && it.w != null;
    let dx = null;
    if (it.x != null && !it.skipX) {
      if (rightAligned) dx = Math.round(it.x + it.w - m.right);
      else if (centred && it.w != null) dx = Math.round(it.x + it.w / 2 - (m.left + m.width / 2));
      else dx = m.left - it.x;
    }
    const bad = Math.abs(dy) > TOLERANCE || (dx != null && Math.abs(dx) > TOLERANCE);
    if (bad) failures++;
    console.log(
      `${it.n.padEnd(13)}${String(it.y).padStart(9)}${String(m.top).padStart(10)}` +
        `${sign(dy).padStart(6)}${String(it.x ?? '-').padStart(11)}` +
        `${String(dx == null ? '-' : m.left).padStart(10)}${(dx == null ? '-' : sign(dx)).padStart(6)}` +
        `${it.x == null ? '  ' : rightAligned ? ' r' : centred ? ' c' : '  '}` +
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
