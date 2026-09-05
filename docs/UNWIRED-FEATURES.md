# Unwired features — what was found, and what was done

Audited at `1ddfcbf` (2026-09-05), fixed across eight commits ending `903ad1e`.

`pnpm facts` counts endpoints. This counted the other direction — **controls
that existed in the UI but did not reach the backend** — because a `queries.ts`
reference is enough to mark an endpoint "wired" even when no component ever
calls the hook, and that is exactly where these hid.

**This file is a record of one audit, not live status.** `pnpm facts`,
`pnpm wiring` and `pnpm smoke` are derived from the code and are what to trust.
The method that found these is at the bottom, so the next audit is a command
rather than a rediscovery.

---

## Fixed

### Controls that promised a backend that did not exist

| Was | Now |
|---|---|
| **Top-bar principal selector** wrote `ui.principalId`, which **nothing read**. Persisted to localStorage, so the stale choice survived reload while still doing nothing. | Each feature declares in `data/features.ts` which of the three global filters it passes to its query; the top bar renders only those. Principal is wired through customers (via mappings → product), leads (line items) and orders (order items). |
| **Top-bar month selector** drawn on eleven pages, read by two. | Rendered only on Dashboard and Projections, which read it. |
| **Data page "Lock Period"** was `useState` — reset on reload while the card claimed it "prevents unauthorized row overrides after accounting close". | `PeriodLock` table, `/period-locks` endpoints, and `ProjectionsService.update` refuses writes to a locked month **for every role including admin**. The worksheet renders read-only with a banner naming who locked it. |
| **Payments principal filter** — a Payment has no product relation at all. | Deliberately none. Payments declares no principal filter rather than faking one. |

### Numbers that were wrong

| Was | Now |
|---|---|
| Data page record counts read `items.length` off a **20-row default page** — 20 customers out of 417. The CSV export inherited it. | Every cursor list returns `total`, counted in the same transaction as the page so a concurrent insert cannot make a header disagree with its rows. Verified in the browser: **417**. |
| Mobile list hints (`orders.length`, `customers.length`) capped at the request size. | Read `total`. |

### Values that were frozen in time

Found by looking at the Data page's own period dropdown, not by the audit — the
screenshot showed it offering to lock **April** in September.

| Was | Now |
|---|---|
| `MONTHS` in `data/constants.ts`: a hardcoded twelve-entry fiscal window, Apr 2026 – Mar 2027. It would have **expired in April 2027** with no current month left to select; it could not reach **any** month before Apr 2026, so last year's figures were unreachable however long the tenant had run; and labels were a lookup into it, so anything outside rendered as the raw `"2027-04"`. | Generated. `periodLabel` formats any valid period, `monthOptions` builds the range, and one `MonthSelect` replaces four hand-rolled dropdowns — the Data page had already drifted, defaulting to `MONTHS[0]`. |
| The range, once generated, was floored at `Tenant.createdAt`. | Floored at the earliest period that **has data** (`firstPeriod`, an indexed ordered read on `Projection.period`, returned by `/managements`). Caught in the browser: Promech's tenant row is dated today while its projections start in June, so a `createdAt` floor hid three months of real history. Runs to **+3 months** ahead, because a projection worksheet you cannot open for next month is not a planning tool. Grouped by year, capped at 15 years. |
| `ui.month` was **persisted**, so a user who looked at June once opened the app in June for the rest of the year — every page, every reload. | Session state. Always the real current month on open; a month you select holds while you move between pages and is gone on reload. Store version bumped to 8 so existing installs drop the stale value. |
| Two of the three copies of the period regex accepted `2026-00` and `2026-99`, which reach Prisma as a period matching no rows — a bad request that looks like an empty month. | One checked `PeriodSchema`, used by dashboard, projections and period-locks. |
| Mobile's month stepper could walk into 2099 one tap at a time; `gs/domain.ts` carried a dead hardcoded `MONTH = '2026-08'`. | Reads the same shared helpers and stops at the same forward horizon. Dead constants removed. |

`months.test.ts` fixes "now" rather than trusting the clock, and two of its
cases sit years out. It paid for itself immediately: it caught an inverted
guard in the range builder that would have collapsed every list to the current
month, and forced a decision worth writing down — `currentPeriod` is **local**,
because "this month" is about the viewer's own calendar, while the period
arithmetic is UTC because it operates on strings rather than instants.

### Things that silently dropped what the user typed

| Was | Now |
|---|---|
| Dashboard follow-up modal collected a note; the handler named it `_note` and discarded it. History hardcoded to `[]`. | Posts to `/remarks` **before** saving the fields, so a failed note keeps the modal open with the text still in it. |
| Mobile "Map product to customer" — full form, submit body was `onDone()` under the comment `// Mapping product done`. | Wired to `POST /mappings`. The picker is part of the fix: it needs a real `productId`, which a typed SKU string never had, so principal and product now come from the catalog. |
| Mobile lead form collected industry and sub-industry and left both out of the request body. | Sent, from the `/industries` catalogue. |
| `Remark` table existed with five relations, no route, no schema. `RemarksModal.tsx` was a complete component with zero consumers. | `GET`/`POST /remarks`, addressed by (entityType, entityId). `RemarksPanel` embedded in the lead, order, payment and customer detail views. Authorization is inherited from the parent record, and the parent **row** must be one the caller could open — without that a sales user could read every rep's commentary by guessing ids while every permission check passed. |

### Actions that existed only as unused hooks

Web: `useDeleteLead`, `useDeleteOrder`, `useDeleteProduct`, `useUpdatePrincipal`,
`useDeletePrincipal`. Mobile: customer update and delete, lead, order, payment
and follow-up delete. All had endpoints, all had hooks, none had a caller.

Each now has a button behind one shared component per client, which forces every
caller to state what is lost rather than ask "Are you sure?". Mobile follow-ups
say **Drop**, not Delete, and explain why — marking a mistakenly-raised task as
Done corrupts the history the overdue counts are built from.

### The management area

`ManagementHomePage` was 928 lines rendering `trackerStore`, a zustand `persist`
store seeded from `data/demoSeedData.ts`. **No API call anywhere on the page** —
every executive-facing number was a POC fixture in that browser's localStorage,
and the workspaces it listed existed nowhere else.

Rewritten onto `/managements`, `/dashboard` and `/users`. The breakdowns are not
recomputed — `/dashboard` owns that arithmetic and shares its engine with the
worksheet. The switcher is now a label, because a `User` row carries one
`tenantId` and there is exactly one workspace to be in. `trackerStore` and
`demoSeedData` are deleted, which also removes the last client-side copy of real
customer records from the bundle.

**Create Management was deleted rather than wired**, and that is a database
decision: `20260825160000` revokes `Tenant` writes from the runtime role because
a tenant-scoped connection able to write the tenancy registry is a
cross-tenant escalation path, and `tenant-isolation.spec` asserts that revoke.
Creating a workspace is an operator action on the `PlatformUser` layer, which
has no auth wired. A create button here could only have been a lie or a
regression.

### Mobile pagination and search

Every list requested a hardcoded `limit: 100` and **discarded `nextCursor`** —
the string "cursor" appeared nowhere in the app. 100 of 417 customers, no "load
more", nothing to say the rest existed. No screen sent `search` either, so the
box filtered those 100 in JS and a customer on page 3 could not be found.

All five lists go through `useCursorList`. Screens that aggregate over the whole
set (kanban, report tabs, follow-up buckets) pass `autoFetchAll` and walk every
page of the **filtered** set.

### Mobile forced password change

Login ignored `mustChangePassword` and went to the tab bar, where the API's
guard then 403'd every request. The server was right; the app had no way out, so
an admin resetting a rep's password locked that rep out of mobile entirely.
There is now a screen, the guard routes to it on bootstrap as well as at login,
and "sign out instead" stays reachable so nobody is trapped.

### Reference data

Web and mobile each hardcoded their own industry taxonomy, and mobile hardcoded
five oil brands shown to every tenant regardless of who they sell for. Both now
read `/industries` and `/principals`.

Filter option lists had to move with the filters: area, industry, division and
salesperson were derived from the rows on screen, which is correct only while
the filter is client-side. Against a server filter a row-derived list collapses
to the value just chosen — pick "Ambattur" and it becomes the only area you can
pick. They now come from sources independent of the filter.

### One bug the audit did not predict

`period.manage` was added to the shared RBAC list, granted to admin and
management there, and guarded on the lock routes — and every lock attempt still
returned **403**. The catalogue was copy-pasted into both seeds, so the key
existed in code and not in the database, and the guard denied a permission the
code said the caller held. Nothing failed loudly: a 403 looks exactly like
correct authorization from outside.

Both seeds import from `@greatsales/shared` now, and `rbac-catalogue.spec`
asserts the seeded rows match the code key for key and grant for grant.

**Found by probing the running stack, not by the type checker or the test
suite** — the lock passed its unit tests against a database seeded inside those
same tests, where the reseed happened to include the key. Worth remembering:
compiling and passing is not the same as working.

---

## Deliberately not done

| Item | Why |
|---|---|
| Create / rename a management | Needs `PlatformUser` auth. Wiring it means re-granting `Tenant` writes to the runtime role and deleting the isolation test that guards them. |
| Mobile order-create screen | Orders are created from the projections convert flow. A second full order form is new product scope, not wiring. |
| `AREAS` on both clients | Still a hardcoded list of Chennai localities. No areas endpoint exists on either side; unlike industries there is no table behind it. |
| `POST /projections` | Rows come from mappings plus seed by design. Recorded so it is not rediscovered as a gap. |
| `DELETE /remarks/:id` | A remark is an activity-trail entry — the schema calls it "audit-friendly" and gives it no `deletedAt`. Append-only is the position, not an oversight. Say so if a note posted by mistake should be removable and it is a small addition. |
| Refresh token in `AsyncStorage` (mobile) | Pre-existing, tracked in `checklists/05-MOBILE.md`. Belongs in the OS secure store; out of scope for this pass and now named in `apps/mobile/AGENTS.md`. |

---

## Verification

- **408 API tests**, including the RLS inventory check that fails if a new
  tenant-owned table ships without a policy — `PeriodLock` ships with one, and
  `Remark` was missing from the original policy list entirely.
- **215 web tests**, clean production build.
- **`pnpm smoke` 20/20**, now covering `period-locks`, `industries` and
  `managements` so the next session checks the new surface without finding it.
- **Browser**: logged in, confirmed the top-bar filters differ per page as
  declared, the Data page reads 417, locking a period from the UI flips the
  worksheet read-only.
- **Direct probe of the running API** (13 checks, re-run on a freshly seeded
  database): the lock refuses an admin PATCH and leaves the row untouched; a
  remark round-trips and is attributed; a remark on an unreachable record is
  refused; `total` (417) exceeds the page length; the principal filter narrows
  customers through mappings.

Two web tests changed rather than being deleted, both because their assertion
had stopped matching their intent: the lead modal's "does not PATCH" asserted no
request **at all**, which broke once the modal legitimately read its remark
timeline; and a route test asserted on page copy the management rewrite
replaced.

---

## How to run this audit again

`pnpm wiring` answers *"which endpoint has no caller"*. It cannot answer
*"which button has no endpoint"*. Three passes covered the gap.

**1. Unused-hook diff — the highest signal per token, and the one `pnpm wiring`
structurally cannot do.** For every `use*` exported from a `queries.ts`, count
consumers outside that file:

```bash
for f in apps/web/src/features/*/queries.ts; do
  for h in $(sed -n 's/^export function \(use[A-Za-z]*\).*/\1/p' "$f"); do
    n=$(grep -rl "\b$h\b" apps/web/src --include=*.tsx --include=*.ts | grep -vc "/queries.ts")
    [ "$n" -eq 0 ] && echo "UNUSED $f/$h"
  done
done
```

**2. Reachability from a call graph.** `graft build` (v0.16.0, no API key, ~40s)
produced a 1718-node graph. Out of the box it was useless here — it leaves
`@/lib/api`-style path aliases unresolved, so 75 of 79 UI files looked unwired.
Resolving `@/x` → `apps/<app>/src/x` fixed 555 edges and cut false positives to
25. That is what surfaced the management area and the orphaned `Remark` table.

**Verdict on Graft:** worth one build for this pass, not worth adopting. It
needs the alias patch before it says anything true about this repo, its `ask` is
lexical retrieval rather than analysis, and passes 1 and 3 found most of the
list without it.

**3. Reading the handlers.** The inert selectors, the `useState` lock, the wrong
counts, the dropped notes, the mobile pagination and the password dead end only
fall out of reading code. No graph finds a button whose handler is `setState`.
