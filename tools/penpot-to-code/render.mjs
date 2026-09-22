/**
 * Renders one compact Penpot board dump into code. See render-core.mjs for how
 * the dump reaches FigmaToCode's generators.
 *
 *   pnpm design:code design-dumps/<board>.json \
 *        [--framework HTML|Tailwind|Flutter|SwiftUI|Compose] \
 *        [--mode html|jsx|styled-components|svelte] [-o out.file]
 *
 * An `-o` path ending in .html gets a standalone page, so the render can be
 * opened in a browser and compared against the Penpot board.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { htmlPage, renderDump } from "./render-core.mjs";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const dumpPath = argv.find((a) => !a.startsWith("-") && a.endsWith(".json"));
if (!dumpPath) {
  console.error("usage: render.mjs <dump.json> [--framework X] [--mode Y] [-o out]");
  process.exit(1);
}

const outIndex = argv.indexOf("-o");
const outPath = outIndex === -1 ? flag("out", null) : argv[outIndex + 1];

const { code, css, name } = await renderDump(
  JSON.parse(fs.readFileSync(dumpPath, "utf8")),
  {
    framework: flag("framework", "HTML"),
    mode: flag("mode", "jsx"),
    images: flag("images", "images/"),
  },
);

const output = outPath?.endsWith(".html") ? htmlPage(code, css, name) : code;

if (outPath) {
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, output);
  if (css && !outPath.endsWith(".html")) {
    const cssPath = outPath.replace(/\.[^.]+$/, ".css");
    fs.writeFileSync(cssPath, css);
    console.error(`wrote ${cssPath} (${css.length} chars)`);
  }
  console.error(`wrote ${outPath} (${output.length} chars)`);
} else {
  process.stdout.write(output);
}
