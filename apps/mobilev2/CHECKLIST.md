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
- [ ] Re-enable `typedRoutes` once every route below exists
- [ ] Auth / token wiring for `ApiSource`
- [ ] Component tests for the primitives

---

## 01 — Splash / Login / Entry (5)

- [ ] 01 Splash / Welcome
- [ ] 01A Login
- [ ] 01B Location permission
- [ ] 01C Change password
- [ ] 01D Session restore / error

## 02 — Home (6)

- [x] 02E.1 Home screen
- [x] 02E.2 Quick Actions launcher
- [ ] 02A Sales progress
- [ ] 02B Actions overview (overdue / outstanding / opportunities)
- [ ] 02C Follow-ups overview
- [ ] 02D Hot opportunities

## 03 — Pipeline (10)

- [x] 03 / 03A Pipeline overview + list (stage rail, search, stream)
- [ ] 03B Search & filters
- [ ] 03C Opportunity detail — overview
- [ ] 03D Change stage
- [ ] 03E Activity timeline
- [ ] 03F Products & assignment
- [ ] 03G Add follow-up
- [ ] 03H Create sales order (opportunity → order)
- [ ] 03I Opportunity actions sheet

## 04 — New Sales Lead (7)

- [ ] 04 Entry point
- [ ] 04A Find / select customer
- [ ] 04B Create customer branch
- [ ] 04C Opportunity information
- [ ] 04D Product / deal information
- [ ] 04E Follow-up & expected closure
- [ ] 04F Review & create
- [ ] 04G Lead created — success

## 05 — Customers / Customer 360 (16)

- [x] 05C Customer list
- [ ] 05 Map + list shell
- [ ] 05A Search
- [ ] 05B Filters
- [ ] 05D Customer map
- [ ] 05E Customer overview (360 header)
- [ ] 05F Contacts
- [ ] 05G Products / assignments
- [ ] 05H Sales orders
- [ ] 05I Outstanding / payment status *(read-only)*
- [ ] 05J Follow-ups / activity
- [ ] 05K Location
- [ ] 05L Add customer entry
- [ ] 05M Customer form
- [ ] 05N Review
- [ ] 05O Customer created

## 06 — My Customer Mapping (9)

- [ ] 06 Mapping list
- [ ] 06A Search / filter (incl. unpriced mappings)
- [ ] 06B Select customer
- [ ] 06C Select product
- [ ] 06D Principal / product
- [ ] 06E Agreed / custom price
- [ ] 06F Review mapping
- [ ] 06G Mapping created
- [ ] 06H Edit / delete mapping

## 07 — Recurring Projections (13)

- [ ] 07 Projection overview
- [ ] 07A Month selection
- [ ] 07B Search / filters
- [ ] 07C Projection detail
- [ ] 07D Edit projection *(blocked when the period is locked)*
- [ ] 07E Next follow-up
- [ ] 07F Expected closure / target date
- [ ] 07G Status
- [ ] 07H Remarks
- [ ] 07I Follow-up log
- [ ] 07J Convert to sales order
- [ ] 07K Delete projection
- [ ] 07L Roll forward / locked period

## 08 — Sales Orders (15)

- [ ] 08 Sales orders list
- [ ] 08A Search / filters
- [ ] 08B Order list rows
- [ ] 08C Order detail
- [ ] 08D Select customer
- [ ] 08E Add products
- [ ] 08F Quantity / pricing
- [ ] 08G Delivery details
- [ ] 08H Payment terms
- [ ] 08I Order review
- [ ] 08J Order created
- [ ] 08K Status timeline
- [ ] 08L Invoice / print view
- [ ] 08M Fulfilment SLA
- [ ] 08N Order actions

## 09 — Payments / Collection Intelligence (10) — **READ ONLY**

- [ ] 09 Payments overview
- [ ] 09A Outstanding
- [ ] 09B Aging buckets
- [ ] 09C Overdue / red zone
- [ ] 09D Search / filters
- [ ] 09E Customer outstanding
- [ ] 09F Invoice / payment detail
- [ ] 09G Payment history *(read-only)*
- [ ] 09H Collection follow-up information
- [ ] 09I Aging detail

Prohibited on this app, and absent from the write interface: record payment,
edit payment, delete payment, import payment, send-reminder mutation.

## 10 — Global Search (4)

- [!] 10 Global search — see "Backend gaps"
- [!] 10A Search results
- [!] 10B Category / filter
- [ ] 10C Result detail (routes into existing detail screens)

## 11 — More / Sales Account (6)

- [x] 11 More menu
- [ ] 11A My profile
- [ ] 11B Notifications
- [ ] 11C App settings
- [ ] 11D Help / support
- [ ] 11E About

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

## Design gaps

The Penpot file covers flows 01, 02 and 03 (through 03E) across 45 boards.
Flows 03F–11 are specified in writing but have no boards yet. Those screens are
being built from the design system — the same tokens, cards, chips and
navigation — rather than invented layouts.
