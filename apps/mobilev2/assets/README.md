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

## Photographs — exported and wired

All three raster images are in `images/` and every one of them is rendered by a
screen. They came out of Penpot through the plugin's `shape.export()` rather
than the asset CDN, which the build environment cannot reach; re-export the same
way (or by hand: select the shape, right-click → Export) if the design changes.

| File | Penpot shape | Exported | Rendered by |
|---|---|---|---|
| `splash-bg.jpg` | `splash-photo` on "01 Splash" | 752×1332 | `src/app/index.tsx`, full-bleed behind the lockup |
| `followups-hero.jpg` | `photo` on "02C.1 Follow-ups Overview" | 730×372 | `components/brand/QuoteBand.tsx`, the band under the pull-quote |
| `promo-art.jpg` | `promo-art` inside `promo` | 680×454 | `components/brand/PromoCard.tsx`, behind the card on "03.2 All Stages" |

Each is resolved through `src/lib/photos.ts`, a guarded `require` per file, so a
missing photograph degrades to the flat brand surface instead of failing the
bundle. That fallback must never become an invented illustration.

Two things the boards say that a filename does not, and that were wrong in an
earlier version of this file:

- The 02C.1 photograph is a **footer band**, not a hero. It sits below the
  follow-ups list under the pull-quote and the swoosh, inset by 5 rather than by
  the screen gutter, at radius 21 with a white 22% lift over it.
- The promo card belongs to **"03.2 All Stages"**, not to the pipeline list. Its
  art is drawn taller than the card and bleeds past it, with the board's own
  white gradient veil keeping the left-hand copy legible.

On web, size a photograph explicitly. `react-native-web` falls back to the
file's intrinsic width when an `Image` is positioned or stretched rather than
given a width, which drew the promo art at twice the card's width and cropped
the follow-ups band to the left of the picture. Both now set `width: "100%"`.

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
