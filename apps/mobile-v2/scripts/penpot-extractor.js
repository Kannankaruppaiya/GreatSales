/*
 * The design extractor, for pasting into the Penpot MCP plugin.
 *
 * This file is NOT imported by anything and is not part of the app build. It
 * is the source of the helpers that read Penpot's `mobiles` page, kept here
 * because the plugin's `storage` is wiped every time the tab reloads and
 * re-deriving them by hand is how two extractions end up measuring
 * differently.
 *
 * Paste the whole file into mcp__Penpot__execute_code once per session, then:
 *
 *   storage.extract('02C.1 Follow-ups Overview')   -> every shape, board-relative
 *   storage.glyph(board, 'r-ic')                   -> one group's paths, box-relative
 *
 * Two things it does that a naive walk does not, and both matter:
 *
 * `storage.localD` rewrites a path's `d` from Penpot's canvas coordinates -
 * which run into the thousands - into its own group's 0..N box. A viewBox of
 * "3414 479 26 26" works but nobody can check it against the file; "0 0 22 22"
 * with the path starting at 2.2 can be read straight off the extraction.
 *
 * `storage.walk` stops at depth 4 and records `_deep` rather than recursing
 * forever. Board 03E.3 has 143 shapes and a scene group can nest six deep;
 * the depth cap is what keeps one extraction inside a sane token budget.
 */
storage.fillOf = (s) => {
  const f = s.fills;
  if (!Array.isArray(f) || !f.length) return null;
  const a = f[0];
  if (a.fillColorGradient) {
    const g = a.fillColorGradient;
    return { gradient: (g.stops || []).map((st) => st.color), type: g.type };
  }
  if (!a.fillColor) return null;
  return a.fillOpacity != null && a.fillOpacity < 1 ? `${a.fillColor}@${a.fillOpacity}` : a.fillColor;
};

storage.strokeOf = (s) => {
  const k = s.strokes;
  if (!Array.isArray(k) || !k.length) return null;
  const a = k[0];
  return `${a.strokeWidth || 1}px ${a.strokeColor || ''}`.trim();
};

storage.radOf = (s) => {
  if (s.borderRadius) return s.borderRadius;
  const p = [s.borderRadiusTopLeft, s.borderRadiusTopRight, s.borderRadiusBottomRight, s.borderRadiusBottomLeft];
  return p.some((v) => v) ? p.join('/') : null;
};

storage.one = (s, ox, oy) => {
  const o = {
    n: s.name,
    t: s.type,
    x: Math.round((s.x - ox) * 10) / 10,
    y: Math.round((s.y - oy) * 10) / 10,
    w: Math.round(s.width * 10) / 10,
    h: Math.round(s.height * 10) / 10,
  };
  const fill = storage.fillOf(s);
  if (fill) o.fill = fill;
  const st = storage.strokeOf(s);
  if (st) o.stroke = st;
  const r = storage.radOf(s);
  if (r) o.r = r;
  if (s.type === 'text') {
    o.chars = s.characters;
    o.size = Number(s.fontSize);
    o.weight = s.fontWeight;
    o.family = s.fontFamily;
    o.lh = s.lineHeight;
    o.align = s.align ?? s.horizontalAlign;
    const tf = s.fills && s.fills[0] && s.fills[0].fillColor;
    if (tf) o.fill = tf;
  }
  if (s.opacity != null && s.opacity < 1) o.op = s.opacity;
  if (s.hidden) o.hidden = true;
  return o;
};

storage.walk = (s, ox, oy, out, depth) => {
  const o = storage.one(s, ox, oy);
  if (s.children && s.children.length) {
    o.kids = s.children.length;
    out.push(o);
    if (depth > 3) { o._deep = true; return; }
    for (const c of s.children) storage.walk(c, ox, oy, out, depth + 1);
  } else {
    out.push(o);
  }
};

storage.extract = (boardName) => {
  const b = penpot.currentPage.findShapes({ name: boardName }).find((s) => s.type === 'board');
  if (!b) return { error: 'no board ' + boardName };
  const out = [];
  for (const c of b.children) storage.walk(c, b.x, b.y, out, 0);
  return {
    board: { name: b.name, w: Math.round(b.width), h: Math.round(b.height), fill: storage.fillOf(b) },
    n: out.length,
    shapes: out,
  };
};

/** Absolute path data -> the group's own box, rounded to 2dp. */
storage.localD = (d, ox, oy) => {
  const toks = d.match(/[MLCZ]|-?\d+(?:\.\d+)?/g) || [];
  const out = [];
  let i = 0;
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    const t = toks[i];
    let cmd;
    const explicit = /^[MLCZ]$/.test(t);
    if (explicit) {
      i++;
      if (t === 'Z') { out.push('Z'); continue; }
      cmd = t;
    } else {
      // An implicit repeat of the previous command, which is how Penpot
      // writes a polyline: "M a,b L c,d e,f" rather than repeating the L.
      cmd = out.length ? out[out.length - 1][0] || 'L' : 'L';
    }
    const n = cmd === 'C' ? 3 : 1;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const x = Math.round((num() - ox) * 100) / 100;
      const y = Math.round((num() - oy) * 100) / 100;
      pts.push(`${x},${y}`);
    }
    out.push((explicit ? cmd : '') + pts.join(' '));
  }
  return out.join('');
};

storage.glyph = (boardName, groupName) => {
  const b = penpot.currentPage.findShapes({ name: boardName }).find((s) => s.type === 'board');
  let g = null;
  const rec = (s) => {
    if (s.name === groupName && s.children) g = s;
    if (s.children) s.children.forEach(rec);
  };
  b.children.forEach(rec);
  if (!g) return { error: 'no ' + groupName };
  const parts = [];
  for (const c of g.children) {
    if (c.hidden) continue;
    const p = {
      t: c.type,
      x: Math.round((c.x - g.x) * 100) / 100,
      y: Math.round((c.y - g.y) * 100) / 100,
      w: Math.round(c.width * 100) / 100,
      h: Math.round(c.height * 100) / 100,
    };
    if (c.type === 'path') p.d = storage.localD(c.toD(), g.x, g.y);
    if (c.type === 'rectangle') p.r = c.borderRadius ?? null;
    const f = c.fills && c.fills[0];
    if (f && f.fillColor) p.fill = f.fillColor;
    const k = c.strokes && c.strokes[0];
    if (k) p.stroke = { w: k.strokeWidth, c: k.strokeColor };
    if (c.opacity != null && c.opacity < 1) p.op = c.opacity;
    parts.push(p);
  }
  return { box: [Math.round(g.width * 100) / 100, Math.round(g.height * 100) / 100], parts };
};

/**
 * Every glyph group on a board at once, in document order.
 *
 * It pulls each group's parts INLINE rather than calling storage.glyph per
 * name, because a board repeats group names - 02B.1 has five `r-ic` and four
 * `nav-ic` - and a name lookup would return the first one five times.
 * `at` is where each instance sits, which is how they are told apart.
 */
storage.glyphs = (boardName, names) => {
  const b = penpot.currentPage.findShapes({ name: boardName }).find((s) => s.type === 'board');
  const out = [];
  const rec = (s) => {
    if (s.children && names.includes(s.name)) {
      const parts = [];
      for (const c of s.children) {
        if (c.hidden) continue;
        const p = {
          t: c.type,
          x: Math.round((c.x - s.x) * 100) / 100,
          y: Math.round((c.y - s.y) * 100) / 100,
          w: Math.round(c.width * 100) / 100,
          h: Math.round(c.height * 100) / 100,
        };
        if (c.type === 'path') p.d = storage.localD(c.toD(), s.x, s.y);
        if (c.type === 'rectangle') p.r = c.borderRadius ?? null;
        const f = c.fills && c.fills[0];
        if (f && f.fillColor) p.fill = f.fillColor;
        const k = c.strokes && c.strokes[0];
        if (k) p.stroke = { w: k.strokeWidth, c: k.strokeColor };
        if (c.opacity != null && c.opacity < 1) p.op = c.opacity;
        parts.push(p);
      }
      out.push({
        n: s.name,
        at: [Math.round(s.x - b.x), Math.round(s.y - b.y)],
        box: [Math.round(s.width * 100) / 100, Math.round(s.height * 100) / 100],
        parts,
      });
    }
    if (s.children) s.children.forEach(rec);
  };
  b.children.forEach(rec);
  return out;
};

'extractor ready';
