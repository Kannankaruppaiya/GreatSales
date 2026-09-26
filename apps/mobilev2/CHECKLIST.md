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
2. **One seam for data, and it is the API.** Screens call `useData()` and
   nothing else; `ApiSource` (`src/data/api-source.ts`) is the only
   implementation. The synthetic generator was removed on 2026-09-25 — it was
   dummy data in a production path, and its row shapes had drifted from the
   API's (a four-value projection status, per-receipt payment records).
3. **Only a salesperson signs in.** Sign-in sends `client: "mobile"` and the
   API refuses every other role after checking the password.
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
- [x] Bottom navigation + Quick Actions launcher (the `+`) — drawn once by
      `AppShell` over **every** signed-in screen, section-highlighted
- [x] `DataSource` / `MutableDataSource` interfaces, typed to the API's rows
- [x] `ApiSource` — every method exercised against the live API
- [x] Auth — sign-in, SecureStore refresh token, single-flight refresh,
      restore on launch, forced password change, sign-out that revokes
- [x] Paged lists with "Load more"; a load error shows as an error, not "empty"
- [x] Domain labels + colour semantics for every wire enum
- [x] Decorative vectors rebuilt as real SVG (ridges, brand swoosh)
- [x] Photographs exported from Penpot and wired (`src/lib/photos.ts`)
- [x] Re-enable `typedRoutes` once every route below exists
- [ ] Component tests for the primitives — the app has no RN test runner yet;
      the API behaviour it depends on is pinned by
      `apps/api/src/common/mobile-reads.spec.ts`

---

## 01 — Splash / Login / Entry (5)

- [x] 01 Splash / Welcome — the board's own photograph, brand green if it is absent
- [x] 01A Login — workspace + email + password; Google sign-in omitted, the
      API has password auth only; "Remember me" decides whether the session
      is kept on the device
- [x] Change password — forced after an admin reset, and from My Profile
- [x] 01B Location permission — the OS prompt and its outcomes are states of this screen
- [x] 01C Preparing / setting up — steps resolve on real requests, not a timer
- [x] 01D Session restore — `preparing` routes on to Home when the steps complete

## 02 — Home (6)

- [x] 02E.1 Home screen
- [x] 02E.2 Quick Actions launcher
- [x] 02A Sales progress — `GET /dashboard` for the month: target, committed,
      recurring and new-sales achieved, gap to target
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
- [x] Pin a customer at the salesperson's current location (Location tab)
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
- [x] 08N Order actions — mark the next fulfilment stage, cancel with a
      reason, delete while still Created. The ladder is enforced by the API.

## 09 — Payments / Collection Intelligence (10) — **READ ONLY**

- [x] 09 Payments overview
- [x] 09A Outstanding
- [x] 09B Aging buckets
- [x] 09C Overdue / red zone
- [x] 09D Search / filters
- [x] 09E Customer outstanding
- [x] 09F Invoice / payment detail
- [x] 09G Collection log *(read-only)* — the ledger keeps a received total,
      not receipts, so the history shown is the collection log
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

- [x] 11 More menu — the front door to Orders, Payments, Projections and
      Mappings, which have no tab of their own
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

Re-checked against `apps/api/src` on 2026-09-25, when the app moved onto the
API. Rows marked **closed** were fixed in the API in that change.

| # | Gap | Status |
|---|-----|--------|
| 1 | **No global search endpoint.** | Open. Flow 10 fans out across each list's own `search`; results rank within a module, not across. |
| 2 | No `GET /leads/:id` | **Closed** — `GET /leads/:id`, 404 outside the caller's scope. |
| 3 | No `GET /orders/:id` | **Closed** — likewise for orders, payments, follow-ups, mappings and projection lines. |
| 4 | Activity timeline has no endpoint | Assembled from real records: remarks, the record's follow-ups, and the lead's move into its current stage. |
| 5 | "Scan Bill" | Open — no OCR or attachment-scan endpoint. The quick action is Add Customer instead. |
| 6 | "Continue with Google" | Open — password sign-in only. Not rendered. |
| 7 | No stored "hot" flag or per-deal probability | Open — derived from stage (`STAGE_PROBABILITY`). |
| 8 | `/leads` took one stage, no closure bound, id order only | **Closed** — `stages`, `closeBefore`, `sort` (recent, closeDate, value); `GET /leads/stage-summary`. |
| 9 | Follow-ups had no due window, id order, no record name | **Closed** — `dueFrom` / `dueTo`, `sort` (due, -due), `entityName` on every row. |
| 10 | An activity is one text field | Open by design — no From → To stage record exists to show. |
| 11 | Orders are not timeline events | Open — the order shows its own status timeline. |
| 12 | Every record belongs to the signed-in salesperson | By design — owner filters would never remove a row. |
| 13 | No map tiles or geocoding | Open — pinned-locations list opening the device maps app. |
| 14 | ~~No order-write endpoint for a salesperson~~ | **Was wrong** — `PATCH /orders/:id` accepts `order.write`. Status and cancel are built (08N). |
| 15 | No notification-preference or language store | Open — Settings holds theme and date format for the session. |
| 16 | No ticketing backend | Open — Help sends the rep to their administrator, or to `extra.supportEmail` when configured. |
| 17 | Notifications | **Closed** — reads `GET /notifications`; tapping one opens its record. No push registration. |
| 18 | Receivables summary was computed from one page of rows | **Closed** — `GET /payments/summary`. |
| 19 | Order codes were minted by each client | **Closed** — the API numbers orders `SO-<year>-<nnnn>`. |
| 20 | Stored `Payment.status` goes stale | Open — the overdue list uses the derived `overdueDays`; fixing the stored filter is a separate task. |

## Verified

2026-09-25, against the live API with the Promech dataset, as `megala`, in
Chromium at 375 x 812:

- Every route opened with real record ids; no load errors, no failed requests.
- Sign-in: an administrator is refused with the API's message, a wrong
  password gets one generic message, a salesperson gets in; a page reload
  restores the session.
- Written through the UI and checked in Postgres: follow-up (create, complete,
  delete), customer (with industry and primary contact; delete), lead (with
  product line, remark and its single follow-up; stage change; delete),
  mapping (create, re-price, delete), projection line (quantity, remark),
  sales order (create; next stage; cancel with reason; delete), roll-forward.
- Everything written was removed afterwards; the dataset was left as found.
- `pnpm parity`: nothing a salesperson may do on the web is missing here.

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
