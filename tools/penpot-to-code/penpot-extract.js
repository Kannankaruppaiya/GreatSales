/**
 * Runs inside the Penpot plugin sandbox (Penpot MCP execute_code).
 *
 * Serialises a Penpot board into a compact tree that render.mjs expands into
 * the Figma REST JSON_REST_V1 shape FigmaToCode's generators consume.
 *
 * Compact, not pretty, on purpose: the Penpot sandbox has no CompressionStream
 * and cannot POST to localhost (mixed content), so every byte of a dump travels
 * through the MCP tool result. The full Figma-shaped tree for one screen is
 * ~106 KB; this form is roughly a third of that, mostly by keeping colours as
 * hex, dropping defaults, and pooling repeated icon SVGs in one table.
 *
 * Installs itself as storage.p2f so later boards cost one short call.
 *
 *   const BOARD_NAME = "02E.1 Home Screen";   // or leave undefined for selection
 *   ...this file...
 */
(() => {
  const round = (n) => Math.round((Number(n) || 0) * 10) / 10;

  const colorOf = (hex, opacity) => {
    const c = String(hex || "#000000").toUpperCase();
    const o = opacity === undefined || opacity === null ? 1 : opacity;
    return o === 1 ? c : `${c}@${Math.round(o * 100) / 100}`;
  };

  const svgs = [];
  const svgIndex = new Map();

  // Penpot's markup carries per-shape ids, print-adjust styles and 10-decimal
  // path coordinates; none of it survives into generated code, and it is more
  // than half the size of a dump.
  const cleanSvg = (markup) =>
    String(markup)
      .replace(/\s+/g, " ")
      .replace(/\s(id|class|version|xmlns:xlink)="[^"]*"/g, "")
      .replace(/\sstyle="-webkit-print-color-adjust::exact"/g, "")
      .replace(/(\d+\.\d{3,})/g, (m) =>
        String(Math.round(parseFloat(m) * 100) / 100),
      )
      .replace(/>\s+</g, "><")
      .trim();

  const poolSvg = (markup) => {
    const clean = cleanSvg(markup);
    if (svgIndex.has(clean)) return svgIndex.get(clean);
    const i = svgs.length;
    svgs.push(clean);
    svgIndex.set(clean, i);
    return i;
  };

  const mapFill = (f) => {
    if (f.fillImage) {
      return {
        I: f.fillImage.name || f.fillImage.id,
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
    for (const sh of shape.shadows || []) {
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

  const SIZING = { fix: "FIXED", auto: "HUG", fill: "FILL" };
  const VECTOR_TYPES = { path: 1, bool: 1, "svg-raw": 1 };

  const convert = (shape) => {
    if (shape.hidden || shape.visible === false) return null;

    const type = shape.type;
    const node = {
      n: shape.name,
      b: [round(shape.x), round(shape.y), round(shape.width), round(shape.height)],
    };
    if ((shape.opacity ?? 1) !== 1) node.o = shape.opacity;
    const effects = mapEffects(shape);
    if (effects.length) node.e = effects;

    if (VECTOR_TYPES[type]) {
      node.t = "V";
      try {
        const markup = penpot.generateMarkup([shape], { type: "svg" });
        if (typeof markup === "string") node.v = poolSvg(markup);
      } catch (e) {
        /* falls back to an empty box */
      }
      return node;
    }

    node.t =
      type === "text"
        ? "T"
        : type === "ellipse" || type === "circle"
          ? "E"
          : type === "rect" || type === "rectangle" || type === "image"
            ? "R"
            : type === "group"
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

    const radii = [
      shape.borderRadiusTopLeft,
      shape.borderRadiusTopRight,
      shape.borderRadiusBottomRight,
      shape.borderRadiusBottomLeft,
    ];
    if (radii.some((r) => r)) {
      const r = radii.map((v) => v || 0);
      node.r = r.every((v) => v === r[0]) ? r[0] : r;
    } else if (shape.borderRadius) {
      node.r = shape.borderRadius;
    }

    if (node.t === "T") {
      node.T = [
        shape.characters || "",
        shape.fontFamily || "Inter",
        Number(shape.fontWeight) || 400,
        Number(shape.fontSize) || 14,
        Number(shape.lineHeight) || 1.2,
        Number(shape.letterSpacing) || 0,
        String(shape.align || "left").toUpperCase(),
        String(shape.verticalAlign || "top").toUpperCase(),
        shape.textTransform || "none",
        shape.textDecoration || "none",
        shape.growType || "fixed",
        shape.fontStyle === "italic" ? 1 : 0,
      ];
      return node;
    }

    if (node.t === "F" || node.t === "G") {
      const flex = shape.flex;
      if (flex) {
        const dir =
          flex.dir === "row" || flex.dir === "row-reverse" ? "H" : "V";
        node.L = [
          dir,
          round(dir === "H" ? (flex.columnGap ?? 0) : (flex.rowGap ?? 0)),
          round(flex.leftPadding),
          round(flex.rightPadding),
          round(flex.topPadding),
          round(flex.bottomPadding),
          flex.justifyContent || "start",
          flex.alignItems || "start",
          SIZING[flex.horizontalSizing] || "FIXED",
          SIZING[flex.verticalSizing] || "FIXED",
        ];
      }

      const children = [];
      for (const child of shape.children || []) {
        const c = convert(child);
        if (!c) continue;
        const lc = child.layoutChild;
        if (lc) {
          c.z = [
            SIZING[lc.horizontalSizing] || "FIXED",
            SIZING[lc.verticalSizing] || "FIXED",
            lc.absolute ? 1 : 0,
          ];
        }
        children.push(c);
      }
      if (children.length) node.c = children;
    }

    return node;
  };

  const extract = (name) => {
    svgs.length = 0;
    svgIndex.clear();
    const target = name
      ? penpotUtils.findShape((s) => s.name === name)
      : penpot.selection[0];
    if (!target) return { error: `board not found: ${name}` };
    const root = convert(target);
    return { v: 1, board: target.name, svgs: svgs.slice(), root };
  };

  storage.p2f = { extract, convert };

  return extract(typeof BOARD_NAME !== "undefined" ? BOARD_NAME : null);
})();
