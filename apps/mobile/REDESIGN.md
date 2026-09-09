# GreatSales Mobile — redesign plan & verification checklist

Working document for the full mobile redesign. Tick a row only after the screen
has been looked at in the browser preview, not when the code compiles.

> Supersedes `MOBILE_DESIGN.md` (repo root) and `apps/mobile/DESIGN.md`. Both
> describe an app that does not exist — they promise "instant action triggers"
> the rows do not have, and a "lower 60% thumb-reach zone" rule that the touch
> research below contradicts. Delete them once this plan is executed.

Run the app: `pnpm --filter mobile web` → http://localhost:8081 (API on :3001,
Postgres on :5433, login `admin@greatsales.local` / `admin`).

**After changing an icon or a token, clear Metro's cache before believing the
preview.** A restart alone is not enough — the first icon rewrite here rendered
the old emoji from a cached bundle and looked like a failed change. Delete
`%TEMP%/metro-cache` and `%TEMP%/metro-file-map-*`, then restart; the cold
rebuild takes a couple of minutes on this machine.

Screens still carrying inline glyphs to remove: `✕` in orders/projections, `✓`
in customers/orders/leads/followups, and the `─` dividers plus `Close by —`
placeholders in `index.tsx`. (Accounts and Money are done.)

**The dev database is shared and the API scopes by role.** A persisted session
belonging to `megala@greatsales.local` (role `sales`) shows 84 accounts and 0
invoices, which looks like an empty database and is not: `admin@greatsales.local`
sees 417 and 141 against the same Postgres. Check `/auth/me` before concluding
anything is broken.

---

## 1. Why the current app reads as "basic"

Measured on the running app (Sep 2026), not inferred:

| Finding | Evidence |
|---|---|
| No SVG anywhere; icons are `View` boxes and Unicode glyphs (`⌂ ✓ ✆ ↗`) plus shipping emoji (`🏢` Customers, `🔍` search) | `grep -c "Svg" src/gs/icons.tsx` → 0; `react-native-svg` not a dependency |
| Payments row is 184px tall → 2.6 invoices per screen, for 141 invoices | measured in the DOM |
| Customers row ~180px → 3 accounts per screen, for 417 accounts | measured |
| Row text is ~70% identical between rows | every customer row: `Others · General Engineering / Silver / Green Zone / No dues / No contact / 30 Days Credit`; every invoice: `150d+`, `TOTAL` == `PENDING`; every deal: `Stale` |
| Four saturated fills in one 2×2 grid, no focal point | dashboard |
| Duplicate numbers on one screen | `OUTSTANDING ₹34.8L` and `OVER 90D ₹34.8L`; `16% Achieved` in hero and again as a tile |
| Zero-value tiles occupy half a KPI strip | `0 PLATINUM`, `0 GOLD` |
| Brand colour mismatch | `app.json` icon/splash/`primaryColor` = `#208AEF` (blue); the app is emerald `#059669` |
| No dark mode | `useColorScheme` → 0 hits |
| No offline support | `NetInfo` / `persistQueryClient` / `onlineManager` → 0 hits |
| 27 spinners, 0 skeletons | `ActivityIndicator` × 27 |
| No haptics, no swipe actions | `Haptics`, `Swipeable` → 0 hits |
| Customers, Orders, Payments, Mappings are unreachable from the tab bar | `src/app/(app)/_layout.tsx:112-116` — all `href: null` |

Kept as-is (these are right): `motion.tsx` honours `useReducedMotion`; the month
stepper is 28px visually but carries `hitSlop={12}` → 52pt effective; customers
already has `onEndReached` infinite scroll.

## 2. Evidence the design rules are built on

- **Sessions are ~72s on mobile vs 150s on desktop; mobile content is twice as
  hard.** Every element pushes another below the fold. (Nielsen Norman, 151
  participants)
- **People touch and look at the centre of the screen**; accuracy is worst at the
  edges. Primary targets belong in the middle half to two-thirds, not in a
  bottom "thumb zone". Grips change constantly: one-handed 49%, cradled 36%,
  two-handed 15%. (Hoober, 1,333 field observations)
- **Hierarchy makes people find things ~4× faster.** Contrast should mark one
  takeaway per screen, not four. (Material 3 Expressive, 46 studies, 18,000
  participants)
- **Hiding navigation roughly halves discoverability** and raises task time and
  perceived difficulty. (Nielsen Norman, 179 participants)
- Compact breakpoint (<600dp): 16dp margins, single pane, navigation at the
  bottom. Tab bars are for navigation, must stay visible, and must not overflow.

## 3. Information architecture — 19 routed screens + 5 sheets

A mobile CRM is not a smaller web CRM. Web's job is managing the database;
mobile's job is acting on it — who to call, what to collect, what to close
today. The screen list is derived from a salesperson's day, not from the web
feature list.

| Layer | Screens |
|---|---|
| Auth (2) | Login · Change password |
| **Tabs (5)** | Today · Pipeline · Accounts · Money · More |
| Detail (4) | Account · Deal · Invoice · Visit |
| Tools (3) | Nearby (map) · Projections · Mappings |
| Admin (3) | Profile · Team visits · Coverage |
| System (2) | Not found · Offline gate |
| **Sheets (5)** | Capture · Log activity · Collect payment · Filters · Check-in |

Tab changes from today: Customers, Orders and Payments come **out** of the More
menu; Projections goes **into** it. Orders merges into Pipeline as a stage
rather than staying a separate screen — a deal's life is one continuous thing
(enquiry → trial → quote → oral → order → delivered).

### Screen grammar

Every screen: header (56px) → context strip → content → bottom action. **One**
hero element per screen; everything else neutral.

- **Today** — an action queue, not a KPI wall. Hero = target vs achieved (count-up
  + progress grow, the only dark card). Then: overdue follow-ups, deals at oral
  confirmation, collections due today. Each row is tappable and swipeable.
  Three quick actions maximum. Hide zero-value tiles.
- **Pipeline** — stage chips, then rows: name, amount, stage, days in stage, next
  date. Swipe → Call / WhatsApp / Advance stage. A "Stale" badge on every row is
  noise; mark the stale ones with an edge bar instead.
- **Accounts** — search-first, 417 records. Sort: Recent · A–Z · Outstanding ·
  Untouched. A–Z section index. Row = name + the one thing that differs
  (outstanding, days since contact). Swipe → Call / WhatsApp / Check in.
- **Money** — aging buckets. Row = name, amount, days pending, mail stage in
  words. The M1–M4 button matrix moves into a swipe action. Swipe → Remind /
  Call / Mark collected.
- **More** — Projections, Mappings, Products, Team visits, Coverage, Profile,
  Settings. Monthly-frequency surfaces only.
- **Detail screens** — hero (identity + one number) → action rail → tabbed
  sections → timeline.
- **Nearby** — MapLibre with customer pins, bottom sheet at 30% listing what is
  within 5km with outstanding amounts. This is the screen the web cannot have.

### Row anatomy — the single most important rule

Max 4 fields, 72–80px. Line 1: identity + amount. Line 2: differentiator + next
action. Status as a 3px edge bar, not a chip. Everything constant across rows
moves to the detail screen. Target: 8 rows per screen where there are now 2–3.

### Location tracking — decided, do not revisit

Build geotagged **check-in / check-out** (foreground only), a visit timeline and
a coverage report. Do **not** build continuous background breadcrumb tracking.

Reasons: meta-analysis of 94 samples / 23,461 workers (Ravid et al. 2023) found
monitoring raises stress with **no** performance gain; a second meta-analysis
(Siegel et al. 2022) put the monitoring↔performance correlation at r = 0.01 and
found a *positive* association with counterproductive work behaviour. Framing it
as "developmental" does not help — purpose does not moderate the effect.
Practically: background location needs a Google Play permissions declaration
plus video review, costs 15–30% battery/day, and is killed by exactly the OEMs
Indian field teams use (Xiaomi, Oppo, OnePlus, Samsung). Under India's DPDP Act
employment processing is a "legitimate use" (s.7(1)(i)) but must stay necessary
and proportionate; check-in clears that bar, a 24-hour trail is hard to defend.

What *does* help, per the same literature: announcing comprehensively and
explaining the rationale. Tell reps exactly what is recorded, what is not, who
sees it, how long it is kept.

## 4. Tech stack

Base is fixed: Expo SDK 54 · RN 0.81.5 · React 19.1 · Reanimated 4.1.1 ·
NativeWind 4.1 · expo-router 6 · TanStack Query 5.101. `newArchEnabled` is unset,
which on SDK 54 means the New Architecture is on — required by Reanimated 4 and
by FlashList v2 / Legend List.

```bash
# UI foundation
npx expo install react-native-svg
npm  i phosphor-react-native
npx  @rnr/cli init            # react-native-reusables (shadcn for RN)
npm  i @legendapp/list
npx  expo install react-native-true-sheet expo-haptics

# images
npx expo install expo-image expo-image-picker expo-camera \
                 expo-image-manipulator expo-file-system

# data / offline
npx expo install react-native-mmkv @react-native-community/netinfo
npm  i @tanstack/react-query-persist-client @tanstack/query-async-storage-persister

# map / charts / notifications
npm  i @maplibre/maplibre-react-native victory-native
npx  expo install @shopify/react-native-skia expo-notifications
```

Use `npx expo install` rather than `npm i` wherever the package is Expo-aware —
it resolves the SDK-54-compatible version.

| Choice | Why, and what was rejected |
|---|---|
| **phosphor-react-native** | 9,161 icons, MIT, six weights. Regular/Fill gives paired inactive/active tab states for free; Duotone for hero moments. Lucide (1,778, ISC) is one style only; Tabler (6,143, MIT) is the fallback. |
| **react-native-reusables** | NativeWind 4 + RN-Primitives + CVA — identical to the stack already here. Copy-paste ownership, no lock-in. Tamagui and Gluestack were rejected: both bring their own styling system, which has no payoff once NativeWind is running. |
| **@legendapp/list** | Pure JS, no native code, drop-in for FlatList/FlashList, good with the variable row heights this app has. It does **not** recycle by default, which also sidesteps expo/expo#44254 (expo-image thumbhash placeholders leaking across recycled FlashList cells). |
| **react-native-true-sheet** | `@gorhom/bottom-sheet` is the usual answer but has open bugs filed against exactly this combination (RN 0.81.5 + Reanimated 4.1.7): #2746 Android edge-to-edge sheets peeking when closed, #2737 iOS Fabric native stack overflow, #2507 render error. Sheets appear on five surfaces here, so prototype both on a real device before committing. |
| **victory-native** | Skia + Reanimated, and the only chart library with a shared API across React and React Native — the web app can share chart code. |
| **MapLibre RN** | MIT (fork of Mapbox v9 pre-licence-change), works with any tile provider. `react-native-maps` is Google-Maps-only on Android and needs a billed API key. |
| **moti — do not add** | Targets Reanimated 2/3 and breaks on Reanimated 4. `motion.tsx` already builds on Reanimated directly. |

**Map tiles — licence trap.** Carto's keyless basemap is **non-commercial only**
and cannot be used here. Start on MapTiler's free tier (commercial-friendly,
needs a key); the zero-vendor path later is a Protomaps `.pmtiles` file on the
project's own S3, though `maplibre-react-native` does not yet support custom
protocols, so that route needs Expo DOM components (`'use dom'`).

**Images.** `expo-image` for disk/memory caching and BlurHash/ThumbHash
placeholders; `expo-image-manipulator` to resize and compress *before* upload
(field 4G — send ~200KB, not 4MB). Generate the ThumbHash **server-side** on
upload and store it beside the image so lists render a real placeholder instead
of a grey box.

## 5. Asset sources — all free, all commercial-safe

| Need | Source | Licence |
|---|---|---|
| Icons | phosphoricons.com (9,161, 6 weights) | MIT |
| Icons (fallback) | tabler.io/icons (6,143) · lucide.dev (1,778) | MIT / ISC |
| Components | `npx @rnr/cli add button card badge input tabs skeleton` | MIT |
| Illustrations | openpeeps.com · humaaans.com | **CC0**, no attribution |
| Illustrations | undraw.co (recolour to emerald before export) | MIT |
| Illustrations — avoid | Storyset | free tier requires attribution |
| Fonts | Plus Jakarta Sans (already installed). Add `fontVariant: ['tabular-nums']` on every ₹ amount | OFL |
| Screen references | banani.co/references (no signup) · uxarchive.com · screenlane.com · chamjo.design (Asia apps) | free |
| Micro-interactions | designspells.com | free |
| AI-ready references | refero.design — ships `design.md` files | free tier |

## 6. Build order & verification checklist

Each step is verified in the browser preview before the next one starts.

| # | Step | Files | Verified |
|---|---|---|---|
| 1 | SVG + Phosphor; rewrite the icon set, delete every glyph and emoji | `src/gs/icons.tsx`, `package.json` | ☑ 15 SVGs on the dashboard, 0 emoji, 0 glyphs |
| 2a | Brand colour `#208AEF` → emerald across `app.json`, app icon, adaptive-icon background, favicon | `app.json`, `assets/images/*` | ☑ icon regenerated |
| 2b | Token layer (light + **dark**) as CSS variables; `useC()`/`useShadow()`; `kit.tsx` migrated off the frozen light palette | `src/global.css`, `tailwind.config.js`, `src/gs/theme.ts`, `src/gs/kit.tsx` | ☑ dark verified in the preview |
| 3 | `Row` primitive — 72px, 4 fields, edge status bar, swipe actions + haptics; plus `RowSkeleton` and `RowEmpty` | `src/gs/Row.tsx` | ☑ measured 72px |
| 4 | Navigation restructure — 5 tabs, remove the `href: null` orphans | `src/app/(app)/_layout.tsx` | ☐ |
| 5 | Today screen — action queue | `src/app/(app)/index.tsx` | ☐ |
| 6 | Pipeline (leads + orders merged) | `src/app/(app)/pipeline.tsx` | ☐ |
| 7 | Accounts — search-first, lean rows | `src/app/(app)/customers.tsx` | ☑ 3 rows/screen → 8 |
| 8 | Money — lean rows, reminder as a swipe | `src/app/(app)/payments.tsx` | ☑ 2.6 rows/screen → 8 |
| 9 | Detail screens (Account, Deal, Invoice) + the 5 sheets | | ☐ |
| 10 | Offline layer — MMKV, query persistence, mutation outbox | `src/gs/query.ts` | ☐ |
| 11 | Images — expo-image, server-side ThumbHash, upload compression | api + mobile | ☐ |
| 12 | Nearby map + check-in + visit timeline | | ☐ |
| 13 | Skeletons, empty states, error boundary, notifications | | ☐ |
