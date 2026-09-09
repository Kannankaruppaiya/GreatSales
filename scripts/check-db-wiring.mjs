#!/usr/bin/env node
/**
 * Database <-> code wiring check.
 *
 * `check-wiring.mjs` answers "does a frontend call this endpoint?". This
 * answers the layer underneath it: does any code read or write this table, and
 * does any code mention this column?
 *
 * Nothing else in the repo asks that. `prisma migrate diff` compares the schema
 * to the database and will happily report a clean bill of health for a table
 * no line of code has touched since it was added, because drift detection is
 * about the two halves of the schema agreeing — not about the schema being
 * used. A model that nothing reads is either a feature that was never wired or
 * a migration that should have been reverted, and both are worth knowing.
 *
 * Two checks, and they are not equally strong:
 *
 *   Models   Reliable. Prisma Client is called as `db.customer.findMany(...)`,
 *            so the model name appears as a property on a client handle and
 *            can be matched exactly.
 *
 *   Columns  A heuristic, and reported as one. A field is only flagged when
 *            its name appears NOWHERE outside the schema and its migrations —
 *            not in a query, a DTO, a type, a seed, a test. That is a strong
 *            signal, but the converse is not: a field that is mentioned may
 *            still be written and never read. Short, common names (`id`,
 *            `name`) are matched everywhere and will never flag; that is the
 *            expected behaviour, not a gap.
 *
 * Static only — no database connection, no running server, about a second.
 *
 *   node scripts/check-db-wiring.mjs          # table + summary
 *   node scripts/check-db-wiring.mjs --json   # machine-readable
 *   node scripts/check-db-wiring.mjs --strict # exit 1 if a model is untouched
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCHEMA = join(ROOT, 'packages/db/prisma/schema.prisma');

/**
 * Where code that could use a table lives, and whether it is the product.
 *
 * The distinction matters more than it looks. A seed writing a table proves
 * the table exists and is fillable; it says nothing about whether the running
 * application ever touches it. Folding the seeds into one corpus turned four
 * genuinely unwired tables green on the first run of this script. They are read
 * — a table nothing mentions at all is a different finding from one only a
 * fixture writes — but counted apart.
 */
const CODE_DIRS = [
  { dir: 'apps/api/src', scope: 'app' },
  { dir: 'apps/web/src', scope: 'app' },
  { dir: 'apps/mobile/src', scope: 'app' },
  { dir: 'packages/shared/src', scope: 'app' },
  { dir: 'packages/db/src', scope: 'app' },
  // The seeds are loose files beside schema.prisma, not a seed/ directory.
  { dir: 'packages/db/prisma', scope: 'seed' },
];

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const strict = args.has('--strict');

/**
 * Models this application is not expected to query by name, and why.
 *
 * Listing one here is a claim that its absence is deliberate and a promise to
 * say what makes it so; anything not listed and untouched is a finding. The
 * reason is printed with the model, so a future reader can disagree with the
 * judgement instead of just inheriting it.
 */
const INFRASTRUCTURE_MODELS = new Map([
  ['PrismaMigration', "written by Prisma's own migration engine, never by us"],
  // The platform layer is the operator console's data, deliberately outside the
  // tenant `User` table so tenant RLS never touches it — and the tenant app's
  // database role has SELECT revoked on both (see the RLS migration). Code in
  // apps/api reaching either one would be the defect, not the fix. They are
  // reachable only from the operator surface, which is not in this repository.
  ['PlatformUser', 'platform layer — the tenant app role is REVOKED on this table'],
  ['PlatformAuditLog', 'platform layer — the tenant app role is REVOKED on this table'],
]);

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, test, out);
    else if (test(full)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The schema: every model and its scalar fields.
// ---------------------------------------------------------------------------
function parseSchema() {
  if (!existsSync(SCHEMA)) return [];
  const src = readFileSync(SCHEMA, 'utf8');
  const models = [];

  // `model Customer {` ... `}` at column 0 — Prisma's formatter guarantees the
  // closing brace is unindented, so this does not need a real parser.
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(src))) {
    const [, name, body] = m;
    const fields = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      if (!line || line.startsWith('@@')) continue;
      const f = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
      if (!f) continue;
      const [, fieldName, type, list, optional] = f;
      fields.push({
        name: fieldName,
        type,
        // A relation field is navigated, not selected; it is not a column.
        relation: /^[A-Z]/.test(type),
        list: !!list,
        optional: !!optional,
      });
    }
    models.push({ name, fields, line: src.slice(0, m.index).split('\n').length });
  }
  return models;
}

// ---------------------------------------------------------------------------
// The code: one pass, held in memory, because every model and field is looked
// up against the same corpus and re-reading 400 files per model is the
// difference between one second and a minute.
// ---------------------------------------------------------------------------
function readCorpus() {
  const files = [];
  for (const { dir, scope } of CODE_DIRS) {
    for (const f of walk(join(ROOT, dir), (x) => /\.(t|j)sx?$/.test(x) && !x.endsWith('.d.ts'))) {
      files.push({ path: relative(ROOT, f), scope, text: readFileSync(f, 'utf8') });
    }
  }
  return files;
}

/** `Customer` -> `customer`, `CustomerContact` -> `customerContact`. */
const clientProp = (model) => model[0].toLowerCase() + model.slice(1);

/**
 * Where a model is used, as `<handle>.<model>.<operation>`.
 *
 * Anchored on the operation as well as the name so that a variable that merely
 * happens to be called `payment` does not read as a table access.
 */
const PRISMA_OPS =
  'findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|create|createMany|' +
  'update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy';

function usesOfModel(corpus, model) {
  const prop = clientProp(model);
  const re = new RegExp(`\\.${prop}\\s*\\.\\s*(${PRISMA_OPS})\\b`, 'g');
  const hits = [];
  for (const file of corpus) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(file.text))) {
      hits.push({
        file: file.path,
        scope: file.scope,
        line: file.text.slice(0, m.index).split('\n').length,
        op: m[1],
      });
    }
  }
  return hits;
}

/**
 * Where a model is reached through a relation rather than by name.
 *
 * Prisma nested writes and includes never mention the target model: the order
 * item rows in `salesOrder.create({ data: { items: { create: [...] } } })` are
 * addressed as `items`, the relation FIELD name. Without this, SalesOrderItem
 * and LeadProduct both reported UNTOUCHED while being written on every order
 * and every lead — a false positive that would have made the whole check
 * untrustworthy.
 *
 * Matched on `field: {` and `field: true`, which are the include/select and
 * nested-write shapes. Reported separately from a direct query, because
 * "reached through its parent" and "queried in its own right" are different
 * facts about a table.
 */
function relationUses(corpus, fieldNames) {
  const hits = [];
  for (const name of fieldNames) {
    const re = new RegExp(String.raw`\b${name}\s*:\s*(\{|true\b)`, 'g');
    for (const file of corpus) {
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(file.text))) {
        hits.push({
          file: file.path,
          scope: file.scope,
          line: file.text.slice(0, m.index).split('\n').length,
          via: name,
        });
      }
    }
  }
  return hits;
}

/** Does the identifier appear anywhere in application code at all? */
function mentionsField(corpus, field) {
  const re = new RegExp(`\\b${field}\\b`);
  return corpus.some((f) => re.test(f.text));
}

// ---------------------------------------------------------------------------
const models = parseSchema();
const corpus = readCorpus();

// Relation fields on OTHER models that point at this one — the names a nested
// write or include would use.
const inboundRelations = new Map(models.map((m) => [m.name, new Set()]));
for (const m of models) {
  for (const f of m.fields) {
    if (f.relation && inboundRelations.has(f.type)) inboundRelations.get(f.type).add(f.name);
  }
}

const report = models.map((model) => {
  const uses = usesOfModel(corpus, model.name);
  const appUses = uses.filter((u) => u.scope === 'app');
  const seedUses = uses.filter((u) => u.scope === 'seed');
  const viaRelation = appUses.length
    ? [] // already queried directly by the product; the weaker signal adds nothing
    : relationUses(corpus, [...(inboundRelations.get(model.name) ?? [])]).filter(
        (u) => u.scope === 'app',
      );
  const columns = model.fields.filter((f) => !f.relation);
  const unmentioned = columns.filter((f) => !mentionsField(corpus, f.name)).map((f) => f.name);
  return {
    model: model.name,
    infrastructure: INFRASTRUCTURE_MODELS.has(model.name),
    infrastructureReason: INFRASTRUCTURE_MODELS.get(model.name) ?? null,
    columns: columns.length,
    relations: model.fields.length - columns.length,
    // Distinct operations tell you more than a raw count: a model with only
    // `create` is written and never read, which is its own kind of unwired.
    operations: [...new Set(appUses.map((u) => u.op))].sort(),
    useCount: appUses.length,
    uses: appUses.slice(0, 5),
    // A table only a fixture writes is not a wired feature. Counted, but apart.
    // Reaching it through a parent relation still counts as the app using it,
    // so a nested write keeps SalesOrderItem out of this bucket.
    seedOnly: appUses.length === 0 && viaRelation.length === 0 && seedUses.length > 0,
    seedUseCount: seedUses.length,
    relationUseCount: viaRelation.length,
    reachedVia: [...new Set(viaRelation.map((u) => u.via))].sort(),
    unmentionedColumns: unmentioned,
  };
});

const considered = report.filter((r) => !r.infrastructure);
const untouched = considered.filter(
  (r) => r.useCount === 0 && r.relationUseCount === 0 && !r.seedOnly,
);
const seedOnly = considered.filter((r) => r.seedOnly);
const writeOnly = considered.filter(
  (r) =>
    r.useCount > 0 &&
    !r.operations.some((op) => op.startsWith('find') || op === 'count' || op === 'aggregate' || op === 'groupBy'),
);
const withDeadColumns = considered.filter((r) => r.unmentionedColumns.length > 0);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        models: report,
        summary: {
          total: considered.length,
          untouched: untouched.map((r) => r.model),
          seedOnly: seedOnly.map((r) => r.model),
          writeOnly: writeOnly.map((r) => r.model),
          unmentionedColumns: Object.fromEntries(
            withDeadColumns.map((r) => [r.model, r.unmentionedColumns]),
          ),
        },
      },
      null,
      2,
    ),
  );
} else {
  console.log('\nGreatSales — database/code wiring\n');
  if (!models.length) {
    console.log(`  No models found. Is ${relative(ROOT, SCHEMA)} present?\n`);
  } else {
    const w = Math.max(...report.map((r) => r.model.length)) + 2;
    for (const r of report) {
      const mark = r.infrastructure
        ? '[-]'
        : r.useCount
          ? '[x]'
          : r.relationUseCount || r.seedOnly
            ? '[~]'
            : '[ ]';
      const status = r.infrastructure
        ? `n/a     ${r.infrastructureReason}`
        : r.useCount
          ? `${String(r.useCount).padStart(3)} use(s)  ${r.operations.join(', ')}`
          : r.relationUseCount
            ? `${String(r.relationUseCount).padStart(3)} nested   via ${r.reachedVia.join(', ')}`
            : r.seedOnly
              ? `${String(r.seedUseCount).padStart(3)} seed     fixtures only — the app never touches it`
              : 'UNTOUCHED — no code queries this table';
      console.log(`  ${mark} ${r.model.padEnd(w)} ${status}`);
    }
    const nested = considered.filter((r) => !r.useCount && r.relationUseCount).length;
    const reached = considered.length - untouched.length - seedOnly.length;
    console.log(
      `\n  ${reached}/${considered.length} models reached by application code` +
        (nested ? ` (${nested} only through a parent relation)` : ''),
    );

    if (seedOnly.length) {
      console.log('\n  Written by seeds/fixtures only — no application code touches these:');
      for (const r of seedOnly) console.log(`    ${r.model}`);
    }

    if (writeOnly.length) {
      console.log('\n  Written but never read:');
      for (const r of writeOnly) console.log(`    ${r.model}  (${r.operations.join(', ')})`);
    }

    if (withDeadColumns.length) {
      console.log('\n  Columns no code mentions anywhere — heuristic, check before deleting:');
      for (const r of withDeadColumns) {
        console.log(`    ${r.model}: ${r.unmentionedColumns.join(', ')}`);
      }
    }
  }
  console.log();
}

if (strict && (untouched.length || seedOnly.length)) process.exit(1);
