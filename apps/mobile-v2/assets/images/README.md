# Images

Four raster images exist in the Penpot design (file V4, page `mobiles`). They
cannot be pulled out over the plugin API — its sandboxed `fetch` returns only
text and JSON, so binary never survives — and they have to be exported by hand
from Penpot: select the shape, then Export in the right-hand panel.

| Design name | Size | Used on | Lands as |
| --- | --- | --- | --- |
| `splash-bg` | 760×1340 | Screen 01 Splash | `splash-bg.webp` ✅ in place |
| `02c-road` | 760×330 | 02C.1 Follow-ups Overview | `02c-road.png` |
| `var0` | 1536×1024 | 03.2 All Stages | `stages-bg.png` |
| `megala-avatar` | 240×240 | 5 screens | — see below |

`splash-bg.webp` is the real photograph, at the source's own 760×1340 and
146KB. WebP rather than PNG because the same picture costs a megabyte or two
as PNG; it is loaded through `expo-image`, which decodes WebP on every
platform, where React Native's own loader does not on iOS without extra setup.

`megala-avatar` is not coming. It is the demo user's photograph on five
screens, and `UserRow` carries no avatar field — the API has no such concept,
so there is nothing to render it from for a real user. Those screens use the
initials chip the design already uses elsewhere (`SC`, `AT`, `KW` on the home
screen) instead.

The remaining files here are the stock Expo template icons and still need
replacing with the real app icon and splash.
