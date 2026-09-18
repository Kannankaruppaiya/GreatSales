# GreatSales mobile — build checklist

The screen list from the spec, in the order it is being built. Update this file
as screens land; it is the record of what is done and what is next.

Legend: `[x]` done · `[~]` partially done · `[ ]` not started ·
`[!]` blocked on something outside this app.

---

## Ground rules this app holds to

1. **No hardcoded business data.** No customer name, opportunity, amount, order
   or invoice is written into a screen. Everything comes from the data source.
   The previous rewrite failed on exactly this point.
2. **One seam for data.** Screens call `useData()` and nothing else. Flip
   `dataSource` in `app.json` from `synthetic` to `api` and the same screens
   read the real backend. No screen imports either implementation.
3. **Synthetic data is labelled as such.** `SyntheticBanner` is on screen
   whenever the rows are generated, and disappears on its own when the source
   is the API.
4. **Design values come from Penpot, not from taste.** `src/design/tokens.ts`
   is extracted from the design system page; screens use tokens, never raw
   numbers or hex codes.
5. **Payments are read-only.** The sales role holds `payment.read` and not
   `payment.write` (`ROLE_PERMISSIONS` in `@greatsales/shared`). The write
   interface has no payment methods at all, so a payment-writing screen cannot
   be built by accident.
6. **Nothing is invented to fill a design.** Where a screen needs a backend
   capability that does not exist, it is recorded under "Backend gaps" below
   and the screen says so, rather than faking a result.

---

## Foundation

- [x] App scaffold — Expo + expo-router, monorepo Metro config
- [x] Design tokens extracted from Penpot (colour, type, spacing, radius,
      elevation, nav, controls, icons)
- [x] Fonts — Plus Jakarta Sans (5 weights) + Caveat for the brand script
- [x] Core primitives — Text, Button, Card/Panel/IconPlate, Chip/CountBadge/
      StatusDot, Input, SearchBar, Screen, Avatar, EmptyState, Skeleton,
      SectionHeader
- [x] Brand lockup — AppMark, Wordmark, BrandScript (drawn in code, not bitmaps)
- [x] Bottom navigation + Quick Actions launcher (the `+`)
- [x] Synthetic data layer — seeded generator, 12 entity types, contract-typed
- [x] `DataSource` / `MutableDataSource` interfaces
- [x] `SyntheticSource` (in-memory, read + write)
- [x] `ApiSource` (endpoints mapped from `apps/api/src`)
- [x] Domain labels + colour semantics for every wire enum
- [x] Decorative vectors rebuilt as real SVG (ridges, brand swoosh)
- [x] Photographs exported from Penpot and wired (`src/lib/photos.ts`)
- [x] Re-enable `typedRoutes` once every route below exists
- [ ] Auth / token wiring for `ApiSource`
- [ ] Component tests for the primitives

---

## 01 — Splash / Login / Entry (5)

- [x] 01 Splash / Welcome — the board's own photograph, brand green if it is absent
- [x] 01A Login — Google sign-in omitted, the API has password auth only
- [x] 01B Location permission — the OS prompt and its outcomes are states of this screen
- [x] 01C Preparing / setting up — steps resolve on real requests, not a timer
- [x] 01D Session restore — `preparing` routes on to Home when the steps complete

## 02 — Home (6)

- [x] 02E.1 Home screen
- [x] 02E.2 Quick Actions launcher
- [x] 02A Sales progress — achievement derived from the period's projections
- [x] 02B Actions overview — "Others" row dropped, nothing in the product feeds it
- [x] 02C Follow-ups overview + 02C.2–02C.4 as bucket filters on one route
- [x] 02C.5 Follow-up detail — quick actions hidden when their data is missing
- [x] 02D Hot opportunities — "hot" is derived, there is no stored flag

## 03 — Pipeline (10)

- [x] 03 / 03A Pipeline overview + list (stage rail, search, stream)
- [x] 03.2 All stages — the funnel whole, closed stages included
- [x] 03.3 Opportunity card — the row shape used by every list
- [x] 03A.2 / 03A.3 Filters + sorted list
- [x] 03B Search & filters — one sheet, not eight drill-in pickers
- [x] 03C Opportunity detail — overview
- [x] 03D / 03.5 Change stage
- [x] 03E.2 Activity timeline + 03E.3 filters + 03E.4 detail
- [x] 03F Products & assignment
- [x] 03G Add follow-up
- [x] 03H Create sales order (opportunity → order)
- [x] 03I Opportunity actions sheet

## 04 — New Sales Lead (7)

- [x] 04 Entry point
- [x] 04A Find / select customer
- [x] 04B Create customer branch
- [x] 04C Opportunity information
- [x] 04D Product / deal information
- [x] 04E Follow-up & expected closure
- [x] 04F Review & create
- [x] 04G Lead created — success

## 05 — Customers / Customer 360 (16)

- [x] 05C Customer list
- [x] 05 Map + list shell
- [x] 05A Search
- [~] 05B Filters — category, area, industry, outstanding. Salesperson filter
      not built: every customer readable here is already the signed-in user's.
- [~] 05D Customer map — built as a pinned-locations list that opens each
      customer in the device maps app. See "Backend gaps" #13.
- [x] 05E Customer overview (360 header)
- [x] 05F Contacts
- [x] 05G Products / assignments
- [x] 05H Sales orders
- [x] 05I Outstanding / payment status *(read-only)*
- [x] 05J Follow-ups / activity
- [x] 05K Location
- [x] 05L Add customer entry
- [x] 05M Customer form
- [x] 05N Review
- [x] 05O Customer created

## 06 — My Customer Mapping (9)

- [x] 06 Mapping list
- [x] 06A Search / filter (incl. unpriced mappings)
- [x] 06B Select customer
- [x] 06C Select product
- [x] 06D Principal / product
- [x] 06E Agreed / custom price
- [x] 06F Review mapping
- [x] 06G Mapping created
- [x] 06H Edit / delete mapping

## 07 — Recurring Projections (13)

- [x] 07 Projection overview
- [x] 07A Month selection
- [x] 07B Search / filters
- [x] 07C Projection detail
- [x] 07D Edit projection *(blocked when the period is locked)*
- [x] 07E Next follow-up
- [x] 07F Expected closure / target date
- [x] 07G Status
- [x] 07H Remarks
- [x] 07I Follow-up log
- [x] 07J Convert to sales order
- [x] 07K Delete projection
- [x] 07L Roll forward / locked period

## 08 — Sales Orders (15)

- [x] 08 Sales orders list
- [x] 08A Search / filters
- [x] 08B Order list rows
- [x] 08C Order detail
- [x] 08D Select customer
- [x] 08E Add products
- [x] 08F Quantity / pricing
- [x] 08G Delivery details
- [x] 08H Payment terms
- [x] 08I Order review
- [x] 08J Order created
- [x] 08K Status timeline
- [x] 08L Invoice / print view
- [x] 08M Fulfilment SLA
- [!] 08N Order actions — cancel and edit are not offered: the API exposes no
      order-write method for a salesperson. The status timeline shows a
      cancelled order; it cannot cause one.

## 09 — Payments / Collection Intelligence (10) — **READ ONLY**

- [x] 09 Payments overview
- [x] 09A Outstanding
- [x] 09B Aging buckets
- [x] 09C Overdue / red zone
- [x] 09D Search / filters
- [x] 09E Customer outstanding
- [x] 09F Invoice / payment detail
- [x] 09G Payment history *(read-only)*
- [x] 09H Collection follow-up information
- [x] 09I Aging detail

Prohibited on this app, and absent from the write interface: record payment,
edit payment, delete payment, import payment, send-reminder mutation.

## 10 — Global Search (4)

- [!] 10 Global search — see "Backend gaps"
- [!] 10A Search results
- [!] 10B Category / filter
- [x] 10C Result detail (routes into existing detail screens)

## 11 — More / Sales Account (6)

- [x] 11 More menu
- [x] 11A My profile
- [x] 11B Notifications
- [~] 11C App settings — theme and date format only, held for the session.
      Notification preferences and language are not built: nothing stores them.
- [~] 11D Help / support — answers the questions this app raises (why payments
      are read-only, where data comes from) and points at the web console.
      No ticket management: there is no ticketing backend to carry it.
- [x] 11E About

---

## Backend gaps

Checked against `apps/api/src` on 2026-09-18. Recorded rather than worked
around; each is a decision for the API, not something this app should fake.

| # | Gap | What the app does |
|---|-----|-------------------|
| 1 | **No global search endpoint.** There is no search controller; every list endpoint takes its own `search` parameter. | Flow 10 is built as a client-side fan-out across those endpoints. It is not server-side search and will not rank across modules. Flagged in `BACKEND_CAPABILITIES.globalSearch`. |
| 2 | **No `GET /leads/:id`.** Leads expose list-only. | Detail screens filter a list response. Works, but costs a wider fetch than it should. |
| 3 | **No `GET /orders/:id`.** Same as above. | Same approach. |
| 4 | **Activity timeline has no endpoint of its own.** | `listActivities` reads `/remarks`. The design's "activity types" (call, visit, stage change, quotation) are richer than remarks carry. |
| 5 | **"Scan Bill"** appears in the design's quick actions. No OCR or attachment-scan endpoint exists. | Not built. The fourth quick action is Add Customer instead. |
| 6 | **"Continue with Google"** is on the login board. The API exposes password sign-in only. | Not rendered. An OAuth button that cannot complete is worse than none. |
| 7 | **No stored "hot" flag or per-deal probability.** 02D ranks by it, and 03A.2 offers it as a filter. | Derived: open pipeline sorted by value, banded by a probability read off the deal's stage. Named in `STAGE_PROBABILITY`. The 03A.2 "Probability" filter section is **not built** — derived from the stage, it would be the stage filter under a second name. |
| 8 | **`/leads` takes one stage and no closure-date bound.** 03A.2 filters on several stages at once. | `ApiSource.listLeads` narrows after the fetch, and says so in a comment. Works; costs a wider page than it should. |
| 9 | **No `GET /remarks/:id`.** 03E.4 opens one activity. | `getActivity` filters a page, like leads and orders. |
| 10 | **An activity is one text field.** 03E.4 shows From → To stages and a separate "Additional Notes". | Neither is built. A "From" stage would have to be reconstructed from the timeline and shown as a record, and one field under two headings is not two fields. |
| 11 | **Orders are not timeline events.** 03E.3 offers a "Sales Order Conversion" filter. | Not built; the activity stream reads `/remarks`, which carries no orders. |
| 12 | **Every record belongs to the signed-in salesperson.** 03A.2 offers "My Deals", 03E.3 offers "Performed By", 05B offers a salesperson filter. | None is built — the filter would never remove a row. |
| 13 | **No map tiles or geocoding service.** 05D is a map of customer pins. | Built as a list of pinned locations that opens each one in the device maps app. An in-app map needs `react-native-maps`, a key and a tile provider; none is configured, and it has no web target, which would have cost the render checks this app is verified with. |
| 14 | **No order-write endpoint for a salesperson.** 08N offers edit and cancel. | Not built. `MutableDataSource` has `createOrder` and no order edit or cancel, so the screens cannot offer one. |
| 15 | **No notification-preference or language store.** 11C offers both. | Not built. Settings holds theme and date format for the session only, and says so on screen. |
| 16 | **No ticketing backend.** 11D is a support / ticket area. | Help answers the questions this app actually raises and points at the web console. No ticket list, no ticket creation. |
| 17 | **Notifications are generated, not delivered.** There is no push registration or notification endpoint. | The list reads the synthetic feed and references real records. Nothing registers for push. |

## Verified

Every screen renders under Chromium at 376 x 859 with no page or console
errors (`node scripts/screenshot.mjs <routes>` over the route list, plus a
drill-through that opens each list's first row). The three create flows were
driven end to end through the UI — sign in, + launcher, fill, save — and the
record each one writes was checked afterwards:

| Flow | Checked |
|------|---------|
| Add follow-up | Saved; Today's count 6 → 7 and the list total 29 → 30. |
| Add customer | Saved; success screen, and the new account opens at `/customer/cust-new-1` with real zeros, not placeholders. |
| New sales lead | Saved through all five steps with a product line; deal value computed, pipeline 29 → 30. |

That pass is what found the focus bug below.

## Fixed during verification

- **Screens kept stale data.** A screen that stayed mounted held whatever it
  loaded when it opened, so scheduling a follow-up from the + launcher left
  Home showing the old count. `useAsync` now re-fetches when a screen regains
  focus, skipping the first focus so nothing loads twice.
- **Projections opened on the wrong month** — the newest period, which is next
  month, showing 0% achievement. It opens on the current month now.
- **Two dead navigation targets** — a "Sort" chip pointing at a route that does
  not exist, and an Edit action with no screen behind it. Both are real screens
  now.
- **Duplicate notifications** — one line repeated down the feed. The generator
  draws without replacement and references real records.
- **Raw enum shown to the user** (`Moved to NewEnquiries`) and two date formats
  in one app (`03 Sept 2026` beside `3 Sep 2026`). Both go through the shared
  label and date helpers now.

## Assets

No gaps. All three photographs are exported and rendered: the splash hero, the
band under the pull-quote on "02C.1 Follow-ups Overview", and the art behind the
promo card on "03.2 All Stages". Penpot's asset CDN is unreachable from the
build environment, so they came through the plugin's `shape.export()` instead;
`assets/README.md` records the route, the sizes and which screen draws each one.
Every file is resolved through a guarded `require`, so a missing photograph
degrades to the flat brand surface — never to an invented illustration.

The ridges and the brand swoosh needed no export: they are vectors, and are
reproduced as real SVG paths from the design's own path data. The app icons are
the brand mark itself, rasterised by `scripts/make-icons.mjs`.

## Design gaps

The Penpot file covers flows 01, 02 and 03 (through 03E) across 45 boards.
Flows 03F–11 are specified in writing and have no boards. Those screens were
built in code from the design system — the same tokens, cards, chips and
navigation as the boarded screens — rather than from invented layouts, on the
instruction not to design them in Penpot first.
