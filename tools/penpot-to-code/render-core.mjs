/**
 * Turns a compact Penpot board dump into code with bernaferrari/FigmaToCode's
 * generators.
 *
 * FigmaToCode is a Figma plugin, but its generators only ever read a plain
 * Figma REST JSON_REST_V1 node tree — the Figma API is used before them, to
 * build that tree and to flatten vectors. So the pipeline is:
 *
 *   Penpot          --(penpot-file.mjs or penpot-extract.js)--> compact dump
 *   compact dump    --(expand, here)--> Figma REST tree
 *   Figma REST tree --(normalise, here)--> what processNodePair would have made
 *   --> htmlMain / tailwindMain / flutterMain / swiftuiMain / composeMain
 *
 * The FigmaToCode checkout stays outside this repo (it is GPL-3.0, and this is
 * a dev-time tool, not product code). Point at it with FIGMA_TO_CODE_DIR;
 * tools/penpot-to-code/setup.mjs clones and installs it.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_CHECKOUT = path.join(
  process.env.USERPROFILE || process.env.HOME || ".",
  "FigmaToCode",
);

export const checkoutDir = process.env.FIGMA_TO_CODE_DIR || DEFAULT_CHECKOUT;
const backendEntry = path.join(checkoutDir, "packages", "backend", "src", "index.ts");

export const assertCheckout = () => {
  if (!fs.existsSync(backendEntry)) {
    throw new Error(
      `FigmaToCode not found at ${checkoutDir}.\n` +
        `Run: pnpm design:setup   (or set FIGMA_TO_CODE_DIR)`,
    );
  }
};

// The generators reach for the Figma API only on paths this pipeline avoids
// (flattening vectors, resolving colour variables). Stub it so a stray call is
// a clear error instead of a crash inside an unrelated module.
globalThis.figma ??= {
  mixed: Symbol("figma.mixed"),
  getNodeByIdAsync: async () => {
    throw new Error("figma.getNodeByIdAsync is not available outside Figma");
  },
  getSelectionColors: () => null,
  variables: {
    getVariableById: () => null,
    getVariableByIdAsync: async () => null,
  },
};

let backendPromise = null;
const backend = () => {
  assertCheckout();
  backendPromise ??= import(pathToFileURL(backendEntry).href);
  return backendPromise;
};

export const settingsFor = ({ framework = "HTML", mode = "jsx" } = {}) => ({
  framework,
  showLayerNames: false,
  embedImages: false,
  embedVectors: true, // the SVG is already attached by the extractor
  useColorVariables: false,
  htmlGenerationMode: mode,
  imagePlaceholderMode: "asset",
  tailwindGenerationMode: mode === "jsx" ? "jsx" : "html",
  roundTailwindValues: true,
  roundTailwindColors: true,
  baseFontSize: 16,
  useTailwind4: true,
  thresholdPercent: 10,
  baseFontFamily: "Plus Jakarta Sans",
  fontFamilyCustomConfig: {},
  flutterGenerationMode: "snippet",
  swiftUIGenerationMode: "snippet",
  composeGenerationMode: "snippet",
  useOldPluginVersion2025: false,
  responsiveRoot: false,
});

/* ------------------------------------------------------------------ expand */

const rgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16) / 255,
  g: parseInt(hex.slice(3, 5), 16) / 255,
  b: parseInt(hex.slice(5, 7), 16) / 255,
});

/** "#RRGGBB" or "#RRGGBB@0.35" */
const parseColor = (spec) => {
  const [hex, alpha] = String(spec).split("@");
  return { color: rgb(hex), opacity: alpha === undefined ? 1 : Number(alpha) };
};

const solidPaint = (spec) => {
  const { color, opacity } = parseColor(spec);
  return { type: "SOLID", visible: true, blendMode: "NORMAL", opacity, color };
};

const expandFill = (f) => {
  if (typeof f === "string") return solidPaint(f);
  if (f.I) {
    return {
      type: "IMAGE",
      visible: true,
      blendMode: "NORMAL",
      opacity: 1,
      scaleMode: "FILL",
      // The extension travels with the name so the generated reference points
      // at the file pull-images writes, rather than a guessed .png.
      imageRef: `${f.I}.${f.x || "png"}`,
    };
  }
  if (f.G) {
    const [kind, sx, sy, ex, ey, stops] = f.G;
    return {
      type: kind === "R" ? "GRADIENT_RADIAL" : "GRADIENT_LINEAR",
      visible: true,
      blendMode: "NORMAL",
      opacity: 1,
      gradientHandlePositions: [
        { x: sx, y: sy },
        { x: ex, y: ey },
        { x: sx + 0.5, y: sy },
      ],
      gradientStops: stops.map(([position, spec]) => {
        const { color, opacity } = parseColor(spec);
        return { position, color: { ...color, a: opacity } };
      }),
    };
  }
  return solidPaint("#000000");
};

const PRIMARY_ALIGN = {
  start: "MIN",
  center: "CENTER",
  end: "MAX",
  "space-between": "SPACE_BETWEEN",
  "space-around": "SPACE_BETWEEN",
  "space-evenly": "SPACE_BETWEEN",
};
const COUNTER_ALIGN = { start: "MIN", center: "CENTER", end: "MAX", stretch: "MIN" };
const TEXT_CASE = { uppercase: "UPPER", lowercase: "LOWER", capitalize: "TITLE" };
const TEXT_DECORATION = { underline: "UNDERLINE", "line-through": "STRIKETHROUGH" };
const AUTO_RESIZE = { "auto-width": "WIDTH_AND_HEIGHT", "auto-height": "HEIGHT" };

const segmentFrom = (run, start) => {
  const [
    text,
    family,
    weight,
    size,
    lineHeight,
    letterSpacing,
    transform,
    decoration,
    italic,
    colorSpec,
  ] = run;
  // Penpot stores line height as a multiplier; Figma's JSON wants pixels.
  const lineHeightPx = lineHeight > 4 ? lineHeight : lineHeight * size;
  return {
    characters: text,
    start,
    end: start + text.length,
    fontSize: size,
    fontName: { family, style: italic ? "Italic" : String(weight) },
    fontWeight: weight,
    textCase: TEXT_CASE[transform] || "ORIGINAL",
    textDecoration: TEXT_DECORATION[decoration] || "NONE",
    letterSpacing: { unit: "PIXELS", value: letterSpacing },
    lineHeight: { unit: "PIXELS", value: lineHeightPx },
    fills: [solidPaint(colorSpec)],
    openTypeFeatures: {},
    indentation: 0,
    listOptions: { type: "NONE" },
    hyperlink: null,
    textStyleId: "",
    fillStyleId: "",
  };
};

const expandText = (node, out) => {
  let runs;
  let alignH = "LEFT";
  let alignV = "TOP";
  let growType = "fixed";

  if (node.R) {
    // penpot-file.mjs: paragraph style in T, one entry per styled run in R,
    // null marking a paragraph break.
    [alignH, alignV, growType] = node.T || ["LEFT", "TOP", "fixed"];
    runs = node.R;
  } else {
    // penpot-extract.js: one run, its style inline in T.
    const [
      characters,
      family,
      weight,
      size,
      lineHeight,
      letterSpacing,
      h,
      v,
      transform,
      decoration,
      grow,
      italic,
    ] = node.T;
    alignH = h;
    alignV = v;
    growType = grow;
    const colorSpec = typeof (node.f || [])[0] === "string" ? node.f[0] : "#000000";
    runs = [
      [
        characters,
        family,
        weight,
        size,
        lineHeight,
        letterSpacing,
        transform,
        decoration,
        italic,
        colorSpec,
      ],
    ];
  }

  const segments = [];
  let characters = "";
  for (const run of runs) {
    if (run === null) {
      characters += "\n";
      continue;
    }
    segments.push(segmentFrom(run, characters.length));
    characters += run[0];
  }

  const first = segments[0] || segmentFrom(["", "Inter", 400, 14, 1.2, 0, "none", "none", 0, "#000000"], 0);
  out.characters = characters;
  out.style = {
    fontFamily: first.fontName.family,
    fontPostScriptName: null,
    fontWeight: first.fontWeight,
    fontSize: first.fontSize,
    textAlignHorizontal: alignH,
    textAlignVertical: alignV,
    letterSpacing: first.letterSpacing.value,
    lineHeightPx: first.lineHeight.value,
    lineHeightUnit: "PIXELS",
  };
  out.textAutoResize = AUTO_RESIZE[growType] || "NONE";
  out.styledTextSegments = segments;
};

const expand = (node, svgs, state) => {
  const [x, y, width, height] = node.b;
  const out = {
    id: `p2f:${++state.ids}`,
    name: node.n,
    visible: true,
    blendMode: "NORMAL",
    opacity: node.o ?? 1,
    absoluteBoundingBox: { x, y, width, height },
    effects: (node.e || []).map(([kind, ox, oy, radius, spread, spec]) => {
      const { color, opacity } = parseColor(spec);
      if (kind === "B") return { type: "LAYER_BLUR", visible: true, radius };
      return {
        type: kind === "I" ? "INNER_SHADOW" : "DROP_SHADOW",
        visible: true,
        blendMode: "NORMAL",
        radius,
        spread,
        offset: { x: ox, y: oy },
        color: { ...color, a: opacity },
      };
    }),
    fills: [],
    strokes: [],
  };

  if (node.t === "V") {
    out.type = "VECTOR";
    out.canBeFlattened = true;
    if (node.v !== undefined && svgs[node.v]) {
      out.svg = svgs[node.v];
      // A path's own box excludes stroke width, so a plain horizontal line
      // reports height 0 and the generated box would clip it. The SVG's viewBox
      // is in the same absolute page coordinates and does include the stroke.
      const viewBox = /viewBox="([-\d.eE ]+)"/.exec(out.svg);
      if (viewBox) {
        const [vx, vy, vw, vh] = viewBox[1].trim().split(/\s+/).map(Number);
        if ([vx, vy, vw, vh].every(Number.isFinite) && vw > 0 && vh > 0) {
          out.absoluteBoundingBox = { x: vx, y: vy, width: vw, height: vh };
        }
      }
    }
    return out;
  }

  out.type =
    node.t === "T"
      ? "TEXT"
      : node.t === "E"
        ? "ELLIPSE"
        : node.t === "R"
          ? "RECTANGLE"
          : "FRAME"; // F and G both land here, as the plugin does with GROUP

  out.fills = (node.f || []).map(expandFill);
  const imageFill = out.fills.find((f) => f.type === "IMAGE");
  if (imageFill) state.images.set(out.id, imageFill.imageRef);

  if (node.s) {
    const [spec, weight, align] = node.s;
    out.strokes = [solidPaint(spec)];
    out.strokeWeight = weight;
    out.strokeAlign = align;
  }

  if (Array.isArray(node.r)) out.rectangleCornerRadii = node.r;
  else if (node.r) out.cornerRadius = node.r;

  if (node.t === "T") {
    expandText(node, out);
    return out;
  }

  if (node.L) {
    const [dir, gap, padL, padR, padT, padB, justify, alignItems, hSize, vSize] = node.L;
    out.layoutMode = dir === "H" ? "HORIZONTAL" : "VERTICAL";
    out.itemSpacing = gap;
    out.paddingLeft = padL;
    out.paddingRight = padR;
    out.paddingTop = padT;
    out.paddingBottom = padB;
    out.primaryAxisAlignItems = PRIMARY_ALIGN[justify] || "MIN";
    out.counterAxisAlignItems = COUNTER_ALIGN[alignItems] || "MIN";
    out.layoutSizingHorizontal = hSize;
    out.layoutSizingVertical = vSize;
  }

  if (node.t === "F" || node.t === "G") {
    // Always an array, even when empty: the generators walk children without
    // checking, so a group whose contents are all hidden would crash.
    out.children = (node.c || []).map((child) => {
      const c = expand(child, svgs, state);
      if (child.z) {
        const [hSize, vSize, absolute] = child.z;
        c.layoutSizingHorizontal = hSize;
        c.layoutSizingVertical = vSize;
        if (absolute) c.layoutPositioning = "ABSOLUTE";
      }
      return c;
    });
    // Boards clip their contents in Penpot; groups are only a bounding box, and
    // clipping them cuts stroke caps off icons.
    out.clipsContent = node.t === "F";
  }

  return out;
};

/* --------------------------------------------------------------- normalise */

/** The Node-side equivalent of jsonNodeConversion.processNodePair. */
const normalize = (node, parent, state) => {
  const clean = String(node.name || "node").replace(/[^a-zA-Z0-9_-]/g, "_");
  const count = state.names.get(clean) || 0;
  state.names.set(clean, count + 1);
  node.uniqueName = count === 0 ? clean : `${clean}_${String(count).padStart(2, "0")}`;

  Object.defineProperty(node, "parent", {
    value: parent,
    enumerable: false,
    writable: true,
  });

  if (node.type === "TEXT") {
    Object.assign(node, node.style);
    if (!node.textAutoResize) node.textAutoResize = "NONE";
  }

  const bb = node.absoluteBoundingBox;
  if (bb) {
    node.width = bb.width;
    node.height = bb.height;
    node.x = parent?.absoluteBoundingBox ? bb.x - parent.absoluteBoundingBox.x : 0;
    node.y = parent?.absoluteBoundingBox ? bb.y - parent.absoluteBoundingBox.y : 0;
  }

  if (node.canBeFlattened !== true) node.canBeFlattened = false;

  if (node.layoutMode && node.layoutMode !== "NONE") {
    node.paddingLeft ??= 0;
    node.paddingRight ??= 0;
    node.paddingTop ??= 0;
    node.paddingBottom ??= 0;
  }
  node.layoutMode ||= "NONE";
  node.layoutGrow ||= 0;
  node.layoutSizingHorizontal ||= "FIXED";
  node.layoutSizingVertical ||= "FIXED";
  node.primaryAxisAlignItems ||= "MIN";
  node.counterAxisAlignItems ||= "MIN";

  const children = Array.isArray(node.children) ? node.children : null;
  const hasChildren = !!(children && children.length);
  if (node.layoutSizingHorizontal === "HUG" && !hasChildren)
    node.layoutSizingHorizontal = "FIXED";
  if (node.layoutSizingVertical === "HUG" && !hasChildren)
    node.layoutSizingVertical = "FIXED";

  if (children) {
    node.children = children.filter((c) => c.visible !== false);
    for (const child of node.children) normalize(child, node, state);
    if (
      node.layoutMode === "NONE" ||
      node.children.some((c) => c.layoutPositioning === "ABSOLUTE")
    ) {
      node.isRelative = true;
    }
  }

  return node;
};

/* ------------------------------------------------------------------ render */

/**
 * @returns {Promise<{ code: string, css: string, name: string }>}
 */
export const renderDump = async (dump, options = {}) => {
  const { framework = "HTML", mode = "jsx", images = "images/" } = options;
  const state = { ids: 0, names: new Map(), images: new Map() };

  const isCompact = dump && dump.root && Array.isArray(dump.svgs);
  const trees = isCompact
    ? [expand(dump.root, dump.svgs, state)]
    : Array.isArray(dump)
      ? dump
      : [dump];
  const roots = trees.map((n) => normalize(n, null, state));

  const api = await backend();
  const main = {
    HTML: api.htmlMain,
    Tailwind: api.tailwindMain,
    Flutter: api.flutterMain,
    SwiftUI: api.swiftuiMain,
    Compose: api.composeMain,
  }[framework];
  if (!main) throw new Error(`unknown framework: ${framework}`);

  const result = await main(roots, settingsFor({ framework, mode }));

  // htmlMain answers with { html, css }; the others answer with a string.
  let code = typeof result === "string" ? result : result.html;
  const css = typeof result === "string" ? "" : result.css || "";

  // FigmaToCode cannot read Penpot's image bytes, so it leaves a placeholder
  // token per image fill. Point each one at the named asset instead.
  code = code.replace(/__FIGMA_IMAGE_([^_]+)__/g, (match, encodedId) => {
    const name = state.images.get(decodeURIComponent(encodedId));
    return name ? `${images}${name}` : match;
  });

  return { code, css, name: roots[0]?.name ?? dump.board ?? "screen" };
};

/** Wraps generated HTML in a page, so a render can be opened and compared. */
export const htmlPage = (code, css, title) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&family=Caveat:wght@400..700&display=swap"
      rel="stylesheet"
    />
    <style>
      body { margin: 0; display: flex; justify-content: center; background: #E8E9EA; }
      /* An inline <svg> sits on the text baseline, so a short icon drops to the
         bottom of its line box — which pushed the FAB's horizontal stroke 10px
         below the vertical one until this. */
      svg { display: block; }
${css}
    </style>
  </head>
  <body>
${code}
  </body>
</html>
`;
