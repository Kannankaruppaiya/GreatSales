/**
 * One line per top-level layer of a Penpot board: name, type, box relative to
 * the board, fill, stroke, radius, and each text run as text|weight/size|colour.
 *
 *   pnpm design:inspect 02b-1-actions-overview
 *   pnpm design:inspect 02b-1 --layer gauge      # one layer's subtree, with SVGs
 *
 * It reads the dumps `pnpm design:all` writes. This is the fast way to take a
 * board's exact numbers when porting it into a screen: a few KB of text instead
 * of a screenshot or the generated component.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
const query = argv.find((a) => !a.startsWith("-"));
const layerFlag = argv.indexOf("--layer");
const layer = layerFlag === -1 ? null : argv[layerFlag + 1];
const dumpDir = path.resolve("design-dumps");

if (!query) {
  console.error("usage: pnpm design:inspect <board file name or part of it> [--layer name]");
  process.exit(1);
}
const file = fs.readdirSync(dumpDir).find((f) => f.startsWith(query) || f.includes(query));
if (!file) {
  console.error(`No dump matching "${query}" in ${dumpDir}. Run pnpm design:all first.`);
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(path.join(dumpDir, file), "utf8"));
const [bx, by] = dump.root.b;
const round = (n) => Math.round(n * 10) / 10;

const line = (node, depth) => {
  const box = [node.b[0] - bx, node.b[1] - by, node.b[2], node.b[3]].map(round).join(",");
  const fill = node.f ? JSON.stringify(node.f).slice(0, 80) : "";
  const stroke = node.s ? `stroke ${node.s[0]} ${node.s[1]}` : "";
  const radius = node.r ? `r ${JSON.stringify(node.r)}` : "";
  const shadow = node.e ? `fx ${JSON.stringify(node.e)}` : "";
  const text = node.R
    ? node.R.filter(Boolean)
        .map((r) => `${JSON.stringify(r[0])}|${r[2]}/${r[3]}|${r[9]}`)
        .join(" + ")
    : "";
  const svg = layer && node.v !== undefined ? dump.svgs[node.v] : "";
  return `${"  ".repeat(depth)}${node.n} ${node.t} ${box} ${[fill, stroke, radius, shadow, text, svg]
    .filter(Boolean)
    .join(" ")}`;
};

console.log(`${file}: ${dump.root.n} ${dump.root.b[2]}x${dump.root.b[3]}`);
if (layer) {
  const target = dump.root.c.find((c) => c.n === layer);
  if (!target) {
    console.error(`No top-level layer "${layer}".`);
    process.exit(1);
  }
  (function walk(n, d) {
    console.log(line(n, d));
    (n.c || []).forEach((c) => walk(c, d + 1));
  })(target, 0);
} else {
  for (const child of dump.root.c) console.log(line(child, 0));
}
