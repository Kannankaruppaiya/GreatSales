#!/usr/bin/env node
/**
 * Design-token drift check for the web console.
 *
 * The design system lives in apps/web/src/index.css (@theme). It only works if
 * pages actually use it, and nothing was checking that: a survey on 2026-09-07
 * found 273 ad-hoc font sizes across nine values (text-[10.5px], text-[11.5px],
 * ...) and 181 raw palette classes sitting next to the tokens that already
 * named those colours. That is what makes the UI read as unfinished.
 *
 * Rewriting all of it at once would be a large, risky visual diff, so this is a
 * ratchet instead: the counts that exist today are the baseline, and the check
 * fails when a number goes UP. Existing violations can be paid down whenever;
 * new ones cannot be added.
 *
 *   node scripts/check-design.mjs           # table + summary, exit 1 on regression
 *   node scripts/check-design.mjs --json    # machine-readable
 *   node scripts/check-design.mjs --update  # accept current counts as the new baseline
 *
 * --update is for lowering the baseline after a cleanup. Raising it means
 * writing the drift into the repo on purpose, so say why in the commit.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // repo root, one level up from scripts/
const SRC = join(ROOT, 'apps/web/src');
const BASELINE = join(ROOT, 'scripts/design-baseline.json');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const update = args.has('--update');

/**
 * Each rule is a regex plus the fix to print when it trips. The names are the
 * keys in design-baseline.json — renaming one resets its baseline to zero.
 */
const RULES = [
  {
    name: 'arbitrary-text-size',
    re: /\btext-\[[\d.]+px\]/g,
    fix: 'use the scale: text-3xs (10px), text-2xs (11px), text-xs (12px), text-sm (14px)',
  },
  {
    name: 'raw-palette-class',
    re: /\b(?:bg|text|border|ring|divide|from|to|via)-(?:slate|gray|zinc|neutral|stone|emerald|green|red|amber|blue|violet|indigo|purple|pink|orange|yellow|teal|cyan|sky|rose|lime|fuchsia)-\d{2,3}\b/g,
    fix: 'use the semantic tokens: text-ink, text-muted, border-line, bg-surface, bg-brand, text-red',
  },
  {
    name: 'raw-hex-colour',
    // Skips index.css itself; this rule only looks at components.
    re: /#[0-9a-fA-F]{3,8}\b/g,
    fix: 'add the colour to @theme in index.css and use its token',
  },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(full)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const results = RULES.map((rule) => {
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(rule.re)) {
      const line = text.slice(0, m.index).split('\n').length;
      hits.push({ file: relative(ROOT, file).split(sep).join("/"), line, match: m[0] });
    }
  }
  return { ...rule, re: undefined, count: hits.length, hits };
});

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

/** Per file, not per rule: a bare total tells you a number went up but not where. */
const byFile = Object.fromEntries(
  results.map((r) => {
    const counts = {};
    for (const h of r.hits) counts[h.file] = (counts[h.file] ?? 0) + 1;
    return [r.name, counts];
  }),
);

if (update) {
  writeFileSync(BASELINE, JSON.stringify(byFile, null, 2) + '\n');
  const totals = results.map((r) => `${r.name}=${r.count}`).join(' ');
  console.log(`design baseline updated: ${totals}`);
  process.exit(0);
}

const regressions = [];
for (const r of results) {
  const was = baseline[r.name] ?? {};
  for (const [file, count] of Object.entries(byFile[r.name])) {
    const before = was[file] ?? 0;
    if (count > before) regressions.push({ rule: r, file, before, count });
  }
}

const total = (rule) => Object.values(baseline[rule] ?? {}).reduce((a, b) => a + b, 0);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        counts: Object.fromEntries(results.map((r) => [r.name, r.count])),
        baselineTotals: Object.fromEntries(results.map((r) => [r.name, total(r.name)])),
        regressions: regressions.map(({ rule, file, before, count }) => ({
          rule: rule.name,
          file,
          before,
          count,
        })),
      },
      null,
      2,
    ),
  );
} else {
  console.log(`\n  Design tokens — ${files.length} .tsx file(s) in apps/web/src
`);
  for (const r of results) {
    const was = total(r.name);
    const mark = r.count > was ? '[!]' : r.count < was ? '[v]' : '[x]';
    console.log(
      `  ${mark} ${r.name.padEnd(20)} ${String(r.count).padStart(4)}  ` +
        `(${r.count === was ? 'at baseline' : `baseline ${was}`})`,
    );
  }
  for (const { rule, file, before, count } of regressions) {
    console.log(`\n  ${file}  ${rule.name}: ${before} -> ${count}`);
    console.log(`    ${rule.fix}`);
    for (const h of results.find((r) => r.name === rule.name).hits.filter((h) => h.file === file)) {
      console.log(`    ${file}:${h.line}  ${h.match}`);
    }
  }
  if (!regressions.length) console.log('\n  No new drift.\n');
  else console.log('\n  Fix these, or run --update if you deliberately lowered something else.\n');
}

if (regressions.length) process.exit(1);
