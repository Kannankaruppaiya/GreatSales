/**
 * Penpot board dumps -> React Native components, directly.
 *
 *   pnpm design:rn                          # every dump in design-dumps/
 *   pnpm design:rn --only "01d"             # boards whose file name contains it
 *   pnpm design:rn --out apps/mobilev2/src/design/penpot
 *
 * FigmaToCode has no React Native generator, which is why design:all only ever
 * produced HTML and Tailwind that the mobile app could not use. This emitter
 * does not go through FigmaToCode at all: it reads the compact dumps that
 * penpot-file.mjs writes (design:all refreshes them) and writes one .tsx per
 * board, built from View, Text, Image and react-native-svg — nothing the app
 * does not already ship.
 *
 * Every GreatSales board is absolutely positioned (no Penpot flex layout
 * anywhere in the file), so the output is too: each node is placed at its
 * Penpot box relative to its parent. That makes a board pixel-faithful at its
 * design width; `PenpotBoard` in the app scales it to the phone's width.
 *
 * The output is a design reference that runs in the app, not a screen: its
 * text is the board's sample copy. Real screens take their layout, colours,
 * and artwork (the SVG strings, gradients and images) from it and their data
 * from the API.
 *
 * The same three traps the HTML path hit apply here and are handled the same
 * way: a vector's box is its SVG viewBox (which includes the stroke), not its
 * selrect; the SVG's coordinates are already absolute page coordinates; and
 * groups do not clip, boards do.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const root = process.cwd();
const dumpDir = path.resolve(flag("dumps", "design-dumps"));
const outDir = path.resolve(flag("out", "apps/mobilev2/src/design/penpot"));
const imageDir = path.resolve(flag("images", "design-reference/generated/images"));
const assetDir = path.resolve(flag("assets", "apps/mobilev2/assets/penpot"));
const only = flag("only", null);

/* ------------------------------------------------------------------ values */

const r1 = (n) => Math.round(n * 10) / 10;

/** "#RRGGBB" or "#RRGGBB@0.35" -> a colour React Native accepts. */
const colour = (spec) => {
  const [hex, alphaRaw] = String(spec).split("@");
  const alpha = alphaRaw === undefined ? 1 : Number(alphaRaw);
  if (alpha >= 1) return hex.toUpperCase();
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${r1(alpha * 100) / 100})`;
};

/** The weights the app loads; anything else snaps to the nearest one. */
const JAKARTA = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
};
const fontFamily = (family, weight) => {
  if (/caveat/i.test(family)) return "Caveat_400Regular";
  const w = Math.min(800, Math.max(400, Math.round(Number(weight) / 100) * 100));
  return JAKARTA[w];
};

const TEXT_TRANSFORM = { uppercase: "uppercase", lowercase: "lowercase", capitalize: "capitalize" };
const TEXT_DECORATION = { underline: "underline", "line-through": "line-through" };
const TEXT_ALIGN = { LEFT: "left", CENTER: "center", RIGHT: "right", JUSTIFIED: "justify" };

/** A style object as source, keys in insertion order, undefined dropped. */
const styleSrc = (style) =>
  "{ " +
  Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? JSON.stringify(v) : v}`)
    .join(", ") +
  " }";

const radiusStyle = (r) => {
  if (Array.isArray(r)) {
    const [tl, tr, br, bl] = r;
    return {
      borderTopLeftRadius: tl || undefined,
      borderTopRightRadius: tr || undefined,
      borderBottomRightRadius: br || undefined,
      borderBottomLeftRadius: bl || undefined,
    };
  }
  return r ? { borderRadius: r } : {};
};

const shadowStyle = (effects) => {
  const shadows = (effects || [])
    .filter(([kind]) => kind === "D" || kind === "I")
    .map(
      ([kind, ox, oy, blur, spread, spec]) =>
        `${kind === "I" ? "inset " : ""}${r1(ox)}px ${r1(oy)}px ${r1(blur)}px ${r1(spread)}px ${colour(spec)}`,
    );
  return shadows.length ? { boxShadow: shadows.join(", ") } : {};
};

/* ------------------------------------------------------------------ emit */

class Board {
  constructor(dump, slug) {
    this.dump = dump;
    this.slug = slug;
    this.svgs = new Map(); // dump svg index -> const name
    this.gradients = 0;
    this.images = new Set();
    this.uses = new Set(["View"]);
  }

  svgConst(index) {
    if (!this.svgs.has(index)) this.svgs.set(index, `SVG_${this.svgs.size}`);
    return this.svgs.get(index);
  }

  box(node, parent) {
    const [x, y, w, h] = node.b;
    const [px, py] = parent ? parent.b : [x, y];
    return { left: r1(x - px), top: r1(y - py), width: r1(w), height: r1(h) };
  }

  gradientSrc(g, pad, style) {
    const [kind, sx, sy, ex, ey, stops] = g.G;
    const id = `g${this.slug.replace(/[^a-z0-9]/gi, "")}${this.gradients++}`;
    this.uses.add("Svg");
    const stopSrc = stops
      .map(([offset, spec]) => {
        const [hex, a] = String(spec).split("@");
        return `<Stop offset={${offset}} stopColor="${hex}" stopOpacity={${a === undefined ? 1 : a}} />`;
      })
      .join("");
    const def =
      kind === "R"
        ? `<RadialGradient id="${id}" cx="${sx}" cy="${sy}" rx="${r1(Math.hypot(ex - sx, ey - sy))}" ry="${r1(Math.hypot(ex - sx, ey - sy))}" gradientUnits="objectBoundingBox">${stopSrc}</RadialGradient>`
        : `<LinearGradient id="${id}" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}">${stopSrc}</LinearGradient>`;
    this.uses.add(kind === "R" ? "RadialGradient" : "LinearGradient");
    return (
      `${pad}<Svg style={StyleSheet.absoluteFill} width="100%" height="100%"><Defs>${def}</Defs>` +
      `<Rect width="100%" height="100%" fill="url(#${id})" /></Svg>`
    );
  }

  fillLayers(node, pad) {
    const fills = node.f || [];
    let backgroundColor;
    const layers = [];
    for (const f of fills) {
      if (typeof f === "string") {
        // Several solid fills stack; the topmost wins unless it is translucent,
        // and a board never relies on blending two solids, so take the last.
        backgroundColor = colour(f);
      } else if (f.G) {
        layers.push(this.gradientSrc(f, pad));
      } else if (f.I) {
        const file = `${f.I}.${f.x || "png"}`;
        this.images.add(file);
        this.uses.add("Image");
        layers.push(
          // Explicit numbers, not absoluteFill: react-native-web sizes an Image
          // that has only edges to its intrinsic size, showing one corner of it.
          `${pad}<Image source={require("@/assets/penpot/${file}")} style={{ position: "absolute", left: 0, top: 0, width: ${r1(node.b[2])}, height: ${r1(node.b[3])} }} resizeMode="cover" />`,
        );
      }
    }
    return { backgroundColor, layers };
  }

  text(node, parent, pad) {
    const [alignH = "LEFT", , grow = "fixed"] = node.T || [];
    const runs = node.R || [];
    const first = runs.find(Boolean);
    const box = this.box(node, parent);
    const runStyle = (run) => {
      const [, family, weight, size, lineHeight, letterSpacing, transform, decoration, italic, spec] = run;
      return {
        fontFamily: fontFamily(family, weight),
        fontSize: size,
        lineHeight: r1(lineHeight > 4 ? lineHeight : lineHeight * size),
        letterSpacing: letterSpacing ? r1(letterSpacing) : undefined,
        color: colour(spec),
        textTransform: TEXT_TRANSFORM[transform],
        textDecorationLine: TEXT_DECORATION[decoration],
        fontStyle: italic ? "italic" : undefined,
      };
    };
    const base = first ? runStyle(first) : {};
    // An auto-width label was measured in Penpot's renderer; a pixel or two of
    // metric difference must not wrap it onto a second line.
    const width = grow === "auto-width" ? r1(box.width + 4) : box.width;
    const style = {
      position: "absolute",
      left: box.left,
      top: box.top,
      width,
      textAlign: TEXT_ALIGN[alignH],
      opacity: node.o,
      ...base,
    };
    this.uses.add("Text");
    const body = runs
      .map((run) => {
        if (run === null) return "{'\\n'}";
        const own = runStyle(run);
        const diff = Object.fromEntries(
          Object.entries(own).filter(([k, v]) => base[k] !== v),
        );
        const literal = `{${JSON.stringify(run[0])}}`;
        return Object.keys(diff).length ? `<Text style={${styleSrc(diff)}}>${literal}</Text>` : literal;
      })
      .join("");
    return `${pad}<Text style={${styleSrc(style)}}>${body}</Text>`;
  }

  node(node, parent, depth) {
    const pad = "  ".repeat(depth);
    if (node.t === "T") return this.text(node, parent, pad);

    if (node.t === "V") {
      const svg = this.dump.svgs?.[node.v];
      if (!svg) return "";
      const vb = /viewBox="([-\d.eE ]+)"/.exec(svg);
      let [x, y, w, h] = node.b;
      if (vb) {
        const [vx, vy, vw, vh] = vb[1].trim().split(/\s+/).map(Number);
        if ([vx, vy, vw, vh].every(Number.isFinite) && vw > 0 && vh > 0) [x, y, w, h] = [vx, vy, vw, vh];
      }
      const box = this.box({ b: [x, y, w, h] }, parent);
      this.uses.add("SvgXml");
      const style = { position: "absolute", left: box.left, top: box.top, opacity: node.o };
      return `${pad}<SvgXml xml={${this.svgConst(node.v)}} width={${box.width}} height={${box.height}} style={${styleSrc(style)}} />`;
    }

    const isRoot = !parent;
    const box = this.box(node, parent);
    const { backgroundColor, layers } = this.fillLayers(node, pad + "  ");
    const [strokeSpec, strokeWidth] = node.s || [];
    const style = {
      ...(isRoot
        ? { width: box.width, height: box.height }
        : { position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height }),
      backgroundColor,
      ...(node.t === "E" ? { borderRadius: r1(Math.min(box.width, box.height) / 2) } : radiusStyle(node.r)),
      borderWidth: strokeSpec ? strokeWidth : undefined,
      borderColor: strokeSpec ? colour(strokeSpec) : undefined,
      // Boards clip in Penpot, and so does any shape carrying a gradient or an
      // image, whose layer must follow the corner radius.
      overflow: node.t === "F" || layers.length ? "hidden" : undefined,
      opacity: node.o,
      ...shadowStyle(node.e),
    };
    const children = (node.c || []).map((c) => this.node(c, node, depth + 1)).filter(Boolean);
    const inner = [...layers, ...children];
    const label = JSON.stringify(node.n);
    const pointer = node.t === "G" ? ' pointerEvents="box-none"' : "";
    if (!inner.length) return `${pad}<View style={${styleSrc(style)}}${pointer} />`;
    return `${pad}<View style={${styleSrc(style)}}${pointer}>{/* ${label.replace(/\*\//g, "")} */}\n${inner.join("\n")}\n${pad}</View>`;
  }

  source(componentName) {
    const jsx = this.node(this.dump.root, null, 2);
    const [, , width, height] = this.dump.root.b;
    const rn = ["StyleSheet", ...["View", "Text", "Image"].filter((u) => this.uses.has(u))];
    const svgNames = ["Svg", "SvgXml", "Defs", "Rect", "Stop", "LinearGradient", "RadialGradient"].filter(
      (u) => this.uses.has(u) || (["Defs", "Rect", "Stop"].includes(u) && this.uses.has("Svg")),
    );
    const svgDefault = svgNames.includes("Svg");
    const svgNamed = svgNames.filter((n) => n !== "Svg");
    const svgImport = svgNames.length
      ? `import ${svgDefault ? "Svg" : ""}${svgDefault && svgNamed.length ? ", " : ""}${svgNamed.length ? `{ ${svgNamed.join(", ")} }` : ""} from "react-native-svg";\n`
      : "";
    const consts = [...this.svgs.entries()]
      .map(([index, name]) => `const ${name} = ${JSON.stringify(this.dump.svgs[index])};`)
      .join("\n");
    return `/* GENERATED by tools/penpot-to-code/to-react-native.mjs from the Penpot
 * board ${JSON.stringify(this.dump.root.n)}. Do not edit: regenerate with
 * \`pnpm design:rn\`. Its text is the board's sample copy — a design
 * reference, not a screen.
 */
import React from "react";
import { ${rn.join(", ")} } from "react-native";
${svgImport}
export const size = { width: ${width}, height: ${height} } as const;

${consts}

export default function ${componentName}() {
  return (
${jsx}
  );
}
`;
  }
}

/* ------------------------------------------------------------------ run */

const pascal = (slug) =>
  "Penpot" +
  slug
    .split("-")
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");

const files = fs
  .readdirSync(dumpDir)
  .filter((f) => f.endsWith(".json") && (!only || f.includes(only)))
  .sort();
if (!files.length) {
  console.error(`No dumps in ${dumpDir}${only ? ` matching "${only}"` : ""}. Run pnpm design:all first.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(assetDir, { recursive: true });

const entries = [];
const images = new Set();
let bytes = 0;
for (const file of files) {
  const slug = file.replace(/\.json$/, "");
  const dump = JSON.parse(fs.readFileSync(path.join(dumpDir, file), "utf8"));
  const board = new Board(dump, slug);
  const name = pascal(slug);
  const src = board.source(name);
  fs.writeFileSync(path.join(outDir, `${slug}.tsx`), src);
  bytes += src.length;
  board.images.forEach((i) => images.add(i));
  entries.push({ slug, name, title: dump.root.n });
}

for (const image of images) {
  const from = path.join(imageDir, image);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(assetDir, image));
  else console.warn(`  missing image ${image} (run pnpm design:all with PENPOT_TOKEN set)`);
}

// The index is regenerated whole only on a full run, so --only never drops the
// other boards from it.
if (!only) {
  const index = `/* GENERATED by tools/penpot-to-code/to-react-native.mjs. Do not edit. */
import type { ComponentType } from "react";

export interface PenpotBoardEntry {
  slug: string;
  title: string;
  load: () => { default: ComponentType; size: { width: number; height: number } };
}

/** Every board, loaded on demand so opening the gallery does not parse all of them. */
export const BOARDS: PenpotBoardEntry[] = [
${entries
  .map((e) => `  { slug: ${JSON.stringify(e.slug)}, title: ${JSON.stringify(e.title)}, load: () => require("./${e.slug}") },`)
  .join("\n")}
];
`;
  fs.writeFileSync(path.join(outDir, "index.ts"), index);
}

console.log(
  `${entries.length} boards -> ${path.relative(root, outDir)} (${Math.round(bytes / 1024)} KB), ${images.size} images -> ${path.relative(root, assetDir)}`,
);
