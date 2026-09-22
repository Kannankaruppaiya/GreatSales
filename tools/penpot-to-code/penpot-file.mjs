/**
 * Converts a Penpot file (the JSON its API returns for `get-file`) into the
 * compact board dumps that render-core.mjs expands.
 *
 * This is the batch path: one file holds every page and every board, so all the
 * screens convert in one run with nothing travelling through a conversation.
 * The per-board plugin extractor (penpot-extract.js) stays for the cases where
 * only the live selection matters.
 *
 * The file's shape format differs from the plugin API's:
 *   - objects live in a flat map per page; a container lists child ids in
 *     `shapes`, so the tree is rebuilt by lookup
 *   - geometry is `selrect` (absolute), not x/y/width/height on the shape
 *   - a path carries its SVG `d` string in `content`, so vectors are assembled
 *     here rather than exported from Penpot
 *   - text carries a paragraph tree with a style on every run, which is why
 *     this path keeps mixed-style text that the plugin path flattens
 */
import fs from "node:fs";

const round = (n) => Math.round((Number(n) || 0) * 10) / 10;

const colorOf = (hex, opacity) => {
  const c = String(hex || "#000000").toUpperCase();
  const o = opacity === undefined || opacity === null ? 1 : opacity;
  return o === 1 ? c : `${c}@${Math.round(o * 100) / 100}`;
};

const EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

const mapFill = (f) => {
  if (f.fillImage) {
    return {
      I: f.fillImage.name || f.fillImage.id,
      x: EXT[f.fillImage.mtype] || "png",
      id: f.fillImage.id,
      w: f.fillImage.width,
      h: f.fillImage.height,
    };
  }
  const g = f.fillColorGradient;
  if (g) {
    return {
      G: [
        g.type === "radial" ? "R" : "L",
        round(g.startX ?? 0.5),
        round(g.startY ?? 0),
        round(g.endX ?? 0.5),
        round(g.endY ?? 1),
        (g.stops || []).map((s) => [
          Math.round((s.offset ?? 0) * 100) / 100,
          colorOf(s.color, s.opacity),
        ]),
      ],
    };
  }
  if (f.fillColor) return colorOf(f.fillColor, f.fillOpacity);
  return null;
};

const mapEffects = (shape) => {
  const out = [];
  for (const sh of shape.shadow || []) {
    if (sh.hidden) continue;
    out.push([
      sh.style === "inner-shadow" ? "I" : "D",
      round(sh.offsetX),
      round(sh.offsetY),
      round(sh.blur),
      round(sh.spread),
      colorOf(sh.color && sh.color.color, sh.color && sh.color.opacity),
    ]);
  }
  if (shape.blur && !shape.blur.hidden) {
    out.push(["B", 0, 0, round(shape.blur.value), 0, "#000000"]);
  }
  return out;
};

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const isIdentity = (t) =>
  !t || ["a", "b", "c", "d", "e", "f"].every((k) => (t[k] ?? IDENTITY[k]) === IDENTITY[k]);

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Builds standalone SVG markup for a path shape from its `d` string. */
const svgForPath = (shape) => {
  const d = typeof shape.content === "string" ? shape.content : null;
  if (!d) return null;

  const fill = (shape.fills || [])[0];
  const stroke = (shape.strokes || [])[0];
  const strokeWidth = stroke ? (stroke.strokeWidth ?? 1) : 0;

  // A path's selrect is the geometry only; a stroke and its round caps sit
  // outside it, so the box is grown by half the stroke before it becomes the
  // viewBox (render-core takes the node's box from this viewBox).
  const pad = stroke ? strokeWidth / 2 + 0.5 : 0;
  const { x, y, width, height } = shape.selrect;
  const vb = [
    round(x - pad),
    round(y - pad),
    Math.max(round(width + pad * 2), 0.1),
    Math.max(round(height + pad * 2), 0.1),
  ];

  const attrs = [`d="${esc(d)}"`];
  attrs.push(
    fill && fill.fillColor
      ? `fill="${fill.fillColor}"${fill.fillOpacity !== undefined && fill.fillOpacity !== 1 ? ` fill-opacity="${fill.fillOpacity}"` : ""}`
      : `fill="none"`,
  );
  if (stroke) {
    attrs.push(`stroke="${stroke.strokeColor || "#000000"}"`);
    attrs.push(`stroke-width="${strokeWidth}"`);
    if (stroke.strokeOpacity !== undefined && stroke.strokeOpacity !== 1) {
      attrs.push(`stroke-opacity="${stroke.strokeOpacity}"`);
    }
    if (stroke.strokeCapStart === "round" || stroke.strokeCapEnd === "round") {
      attrs.push(`stroke-linecap="round" stroke-linejoin="round"`);
    }
  }
  if (!isIdentity(shape.transform)) {
    // Penpot applies a shape's matrix about the centre of its selrect, not
    // about the SVG origin. Applied raw, a 0.83 x-scale moves a path at
    // x = 689 to x = 574 and the icon disappears off its own viewBox.
    const t = shape.transform;
    const cx = round(x + width / 2);
    const cy = round(y + height / 2);
    attrs.push(
      `transform="translate(${cx} ${cy}) matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f}) translate(${-cx} ${-cy})"`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vb[2]}" height="${vb[3]}" viewBox="${vb.join(" ")}" fill="none"><path ${attrs.join(" ")}/></svg>`;
};

/** Flattens Penpot's paragraph tree into styled runs. */
const textRuns = (content) => {
  const runs = [];
  const paragraphs = [];
  const collectParagraphs = (node) => {
    if (!node) return;
    if (node.type === "paragraph") paragraphs.push(node);
    else for (const child of node.children || []) collectParagraphs(child);
  };
  collectParagraphs(content);

  paragraphs.forEach((paragraph, index) => {
    if (index > 0) runs.push(null); // paragraph break
    for (const run of paragraph.children || []) {
      if (run.text === undefined) continue;
      const style = { ...paragraph, ...run };
      const fill = (style.fills || [])[0] || {};
      runs.push([
        run.text,
        style.fontFamily || "Inter",
        Number(style.fontWeight) || 400,
        Number(style.fontSize) || 14,
        Number(style.lineHeight) || 1.2,
        Number(style.letterSpacing) || 0,
        style.textTransform || "none",
        style.textDecoration || "none",
        style.fontStyle === "italic" ? 1 : 0,
        colorOf(fill.fillColor || "#000000", fill.fillOpacity),
      ]);
    }
  });

  return runs;
};

const paragraphStyle = (content) => {
  let node = content;
  while (node && node.type !== "paragraph") node = (node.children || [])[0];
  return node || {};
};

/**
 * Converts one shape (and its subtree) into the compact form.
 * `svgs` is the per-board pool of vector markup.
 */
const convert = (shape, objects, svgs, svgIndex) => {
  if (!shape || shape.hidden) return null;

  const box = shape.selrect || shape;
  const node = {
    n: shape.name,
    b: [round(box.x), round(box.y), round(box.width), round(box.height)],
  };
  if ((shape.opacity ?? 1) !== 1) node.o = shape.opacity;
  const effects = mapEffects(shape);
  if (effects.length) node.e = effects;

  if (shape.type === "path" || shape.type === "bool" || shape.type === "svg-raw") {
    node.t = "V";
    const markup = svgForPath(shape);
    if (markup) {
      let index = svgIndex.get(markup);
      if (index === undefined) {
        index = svgs.length;
        svgs.push(markup);
        svgIndex.set(markup, index);
      }
      node.v = index;
    }
    return node;
  }

  node.t =
    shape.type === "text"
      ? "T"
      : shape.type === "circle" || shape.type === "ellipse"
        ? "E"
        : shape.type === "rect" || shape.type === "image"
          ? "R"
          : shape.type === "group"
            ? "G"
            : "F";

  const fills = [];
  for (const f of shape.fills || []) {
    const mapped = mapFill(f);
    if (mapped) fills.push(mapped);
  }
  if (fills.length) node.f = fills;

  const stroke = (shape.strokes || [])[0];
  if (stroke) {
    node.s = [
      colorOf(stroke.strokeColor, stroke.strokeOpacity),
      round(stroke.strokeWidth ?? 1),
      stroke.strokeAlignment === "inner"
        ? "INSIDE"
        : stroke.strokeAlignment === "outer"
          ? "OUTSIDE"
          : "CENTER",
    ];
  }

  const radii = [shape.r1, shape.r2, shape.r3, shape.r4];
  if (radii.some((r) => r)) {
    const r = radii.map((v) => v || 0);
    node.r = r.every((v) => v === r[0]) ? r[0] : r;
  } else if (shape.rx) {
    node.r = shape.rx;
  }

  if (node.t === "T") {
    const style = paragraphStyle(shape.content);
    node.T = [
      String(style.textAlign || "left").toUpperCase(),
      String(shape.verticalAlign || "top").toUpperCase(),
      shape.growType || "fixed",
    ];
    node.R = textRuns(shape.content);
    return node;
  }

  if (node.t === "F" || node.t === "G") {
    if (shape.layout === "flex") {
      const dir = String(shape.layoutFlexDir || "row").startsWith("row") ? "H" : "V";
      node.L = [
        dir,
        round(dir === "H" ? shape.layoutGapColumn : shape.layoutGapRow),
        round(shape.layoutPadding?.p4),
        round(shape.layoutPadding?.p2),
        round(shape.layoutPadding?.p1),
        round(shape.layoutPadding?.p3),
        shape.layoutJustifyContent || "start",
        shape.layoutAlignItems || "start",
        "FIXED",
        "FIXED",
      ];
    }

    const children = [];
    for (const id of shape.shapes || []) {
      const child = convert(objects[id], objects, svgs, svgIndex);
      if (child) children.push(child);
    }
    if (children.length) node.c = children;
  }

  return node;
};

export const loadPenpotFile = (filePath) => {
  const file = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const data = file.data || file;
  return {
    name: file.name,
    pages: Object.entries(data.pagesIndex || {}).map(([id, page]) => ({
      id,
      name: page.name,
      objects: page.objects,
    })),
  };
};

/** The top-level boards of a page, in the order the page lists them. */
export const boardsOf = (page) => {
  const root = page.objects["00000000-0000-0000-0000-000000000000"];
  const ids = root ? root.shapes || [] : Object.keys(page.objects);
  return ids
    .map((id) => page.objects[id])
    .filter((shape) => shape && shape.type === "frame" && !shape.hidden);
};

export const boardToDump = (board, page) => {
  const svgs = [];
  const root = convert(board, page.objects, svgs, new Map());
  return { v: 1, board: board.name, svgs, root };
};
