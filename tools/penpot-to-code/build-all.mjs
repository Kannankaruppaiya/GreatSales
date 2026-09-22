/**
 * Converts every board in a Penpot file into code, in one run.
 *
 *   pnpm design:all [path/to/penpot-file.json] [--page mobiles] [--only "03.1"]
 *                   [--out design-reference/generated] [--dumps design-dumps]
 *                   [--frameworks HTML,Tailwind]
 *
 * The file is what Penpot's API returns for `get-file`. Cloudflare challenges
 * plain HTTP clients, so it is fetched from a browser tab that is already on
 * design.penpot.app and saved to disk; see AGENTS.md.
 *
 * Writes, per board: a compact dump (re-renderable without the 13 MB file), a
 * standalone HTML page, and Tailwind JSX. Plus an index.html contact sheet of
 * every screen, for comparing against Penpot at a glance.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { boardToDump, boardsOf, loadPenpotFile } from "./penpot-file.mjs";
import { imagesOf, penpotToken, pullImages } from "./pull-images.mjs";
import { assertCheckout, htmlPage, renderDump } from "./render-core.mjs";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const filePath =
  argv.find((a) => !a.startsWith("-") && a.endsWith(".json")) ||
  path.join(process.env.USERPROFILE || ".", "Downloads", "greatsales-penpot-file.json");

const pageFilter = flag("page", null);
const only = flag("only", null);
const outDir = path.resolve(flag("out", "design-reference/generated"));
const dumpDir = path.resolve(flag("dumps", "design-dumps"));
const frameworks = flag("frameworks", "HTML,Tailwind").split(",");

assertCheckout();

if (!fs.existsSync(filePath)) {
  console.error(`Penpot file not found: ${filePath}`);
  process.exit(1);
}

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const started = Date.now();
const file = loadPenpotFile(filePath);
console.log(`${file.name}: ${file.pages.length} pages`);

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(dumpDir, { recursive: true });

const token = penpotToken();
if (token) {
  const images = imagesOf(file);
  const written = await pullImages(images, path.join(outDir, "images"), token);
  console.log(`images: ${images.length} used, ${written.length} downloaded`);
} else {
  console.log("images: no PENPOT_TOKEN, screens will point at missing files");
}

const built = [];
const failed = [];

for (const page of file.pages) {
  if (pageFilter && !page.name.toLowerCase().includes(pageFilter.toLowerCase())) continue;

  const boards = boardsOf(page).filter(
    (b) => !only || b.name.toLowerCase().includes(only.toLowerCase()),
  );
  console.log(`\n${page.name}: ${boards.length} boards`);

  for (const board of boards) {
    const name = slug(board.name);
    try {
      const dump = boardToDump(board, page);
      fs.writeFileSync(path.join(dumpDir, `${name}.json`), JSON.stringify(dump));

      for (const framework of frameworks) {
        const isHtml = framework === "HTML";
        const { code, css } = await renderDump(dump, {
          framework,
          mode: isHtml ? "html" : "jsx",
        });
        const outFile = path.join(
          outDir,
          isHtml ? `${name}.html` : `${name}.${framework.toLowerCase()}.jsx`,
        );
        fs.writeFileSync(outFile, isHtml ? htmlPage(code, css, board.name) : code);
      }

      built.push({ name, board: board.name, page: page.name });
      console.log(`  ✓ ${board.name}`);
    } catch (error) {
      failed.push({ board: board.name, error: String(error).slice(0, 200) });
      console.log(`  ✗ ${board.name} — ${String(error).slice(0, 120)}`);
    }
  }
}

// A contact sheet, so every screen can be checked against Penpot in one view.
const sheet = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${file.name} — generated screens</title>
    <style>
      body { margin: 0; padding: 24px; background: #0F3244; color: #F8FBFC;
             font: 14px/1.4 "Plus Jakarta Sans", system-ui, sans-serif; }
      h1 { font-size: 18px; margin: 0 0 20px; }
      .grid { display: flex; flex-wrap: wrap; gap: 24px; }
      figure { margin: 0; width: 376px; }
      figcaption { padding: 8px 2px; font-size: 12px; color: #A9C4D0; }
      iframe { width: 376px; height: 859px; border: 0; border-radius: 34px; background: #fff; }
    </style>
  </head>
  <body>
    <h1>${file.name} — ${built.length} screens</h1>
    <div class="grid">
${built
  .map(
    (b) =>
      `      <figure><iframe src="${b.name}.html" loading="lazy"></iframe><figcaption>${b.board}</figcaption></figure>`,
  )
  .join("\n")}
    </div>
  </body>
</html>
`;
fs.writeFileSync(path.join(outDir, "index.html"), sheet);

console.log(
  `\n${built.length} screens in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${outDir}` +
    (failed.length ? `\n${failed.length} failed` : ""),
);
for (const f of failed) console.log(`  ${f.board}: ${f.error}`);
