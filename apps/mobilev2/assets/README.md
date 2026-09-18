# Assets

## Vector decoration — already in code

The ridge lines, the brand swoosh and the app mark are shapes in the Penpot
design, not photographs. They are reproduced as real SVG paths in
`src/components/brand/Decor.tsx` and `BrandMark.tsx`, using the design's own
path data. Do not export these as PNGs: an SVG stays sharp at every density,
recolours with the tokens, and costs a few hundred bytes.

## Photographs — need exporting from Penpot

Penpot's asset CDN is not reachable from the build environment, so these four
raster images could not be pulled automatically. Export each one from Penpot
(select the shape, right-click → Export, or use the Design tab's Export panel)
and drop it here under the filename given. Until a file is present the screen
falls back to a flat brand surface, which is the correct behaviour — it must
never be replaced with an invented illustration.

| File to create | Penpot shape | Source size | Used by |
|---|---|---|---|
| `splash-bg.jpg` | `splash-photo` on "Screen 01 Splash" | 760×1340 | 01 Splash |
| `followups-hero.jpg` | `photo` on "02C.1 Follow-ups Overview" | 760×330 | 02C.1 Follow-ups overview |
| `promo-art.jpg` | `promo-art` inside `promo` | 1536×1024 | Pipeline promo card |

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
