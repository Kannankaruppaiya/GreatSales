/**
 * Clones bernaferrari/FigmaToCode next to this repo and installs the backend
 * package's dependencies, so tools/penpot-to-code/render.mjs can import its
 * generators.
 *
 * The checkout deliberately lives OUTSIDE this repository: FigmaToCode is
 * GPL-3.0 and is used here as a separate dev-time tool, not as product code.
 *
 *   node tools/penpot-to-code/setup.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO = "https://github.com/bernaferrari/FigmaToCode.git";
const target =
  process.env.FIGMA_TO_CODE_DIR ||
  path.join(process.env.USERPROFILE || process.env.HOME || ".", "FigmaToCode");

const run = (cmd, args, cwd) => {
  console.log(`> ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: true });
};

if (!fs.existsSync(path.join(target, ".git"))) {
  run("git", ["clone", "--depth", "1", REPO, JSON.stringify(target)], process.cwd());
} else {
  console.log(`FigmaToCode already cloned at ${target}`);
}

// The repo pins pnpm 11 through devEngines, which npm refuses to run inside it;
// invoke pnpm from elsewhere with --dir so npm never reads that manifest.
run(
  "npx",
  ["--yes", "pnpm@11", "-C", JSON.stringify(target), "install", "--filter", "backend...", "--ignore-scripts"],
  process.env.TEMP || process.env.TMPDIR || ".",
);

console.log(`\nReady. FIGMA_TO_CODE_DIR=${target}`);
