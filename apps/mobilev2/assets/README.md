# Assets

## App icons — generated, in place

`images/icon.png`, `images/adaptive-icon.png`, `images/splash-icon.png` and
`images/favicon.png` are rendered from the brand mark in
`src/components/brand/BrandMark.tsx` by `scripts/make-icons.mjs`, and wired in
`app.json`. They are the app's own lockup rasterised, not new artwork, so
re-run that script after changing the mark or the brand colour rather than
editing the PNGs.

## Vector decoration — already in code

The ridge lines, the brand swoosh and the app mark are shapes in the Penpot
design, not photographs. They are reproduced as real SVG paths in
`src/components/brand/Decor.tsx` and `BrandMark.tsx`, using the design's own
path data. Do not export these as PNGs: an SVG stays sharp at every density,
recolours with the tokens, and costs a few hundred bytes.

## Photographs — still to export from Penpot

These three raster images could not be pulled automatically: the plugin returns
shape data, not image binaries, and Penpot's asset CDN is not reachable from the
build environment. Export each from Penpot (select the shape, right-click →
Export, or the Design tab's Export panel) and drop it in `images/` under the
filename given.

**Only `splash-bg.jpg` is wired.** The splash resolves it through a guarded
`require` and falls back to a flat brand surface when the file is absent, which
is the correct behaviour — it must never be replaced with an invented
illustration. The other two have no code referencing them yet: adding the files
alone will not make them appear. Their boards (02C.1 and the pipeline promo
card) need building against the design first, so that the layout comes from the
board rather than from guesswork.

| File to create | Penpot shape | Source size | Wired? |
|---|---|---|---|
| `splash-bg.jpg` | `splash-photo` on "Screen 01 Splash" | 760×1340 | yes — `src/app/index.tsx` |
| `followups-hero.jpg` | `photo` on "02C.1 Follow-ups Overview" | 760×330 | no — no screen references it |
| `promo-art.jpg` | `promo-art` inside `promo` | 1536×1024 | no — the promo card is not built |

Export at 2× for the phone screens (the design frame is 376pt wide, so a 2×
asset is 752px). JPEG is right for photographs; keep PNG for anything with
transparency.

The brand board's rule for photography still applies to replacements: mountain,
field and travel imagery, washed back with white 58–78% so UI text stays
legible, one image per screen.

## Not an asset: the user's avatar

The design shows a photograph in the avatar slot (`megala-avatar`). That is the
signed-in person's own profile picture, not something the app ships. It comes
from the user record at runtime; `components/ui/Avatar.tsx` renders initials
when there is no photo, which is also what a customer account gets, since this
product stores no customer photographs.
