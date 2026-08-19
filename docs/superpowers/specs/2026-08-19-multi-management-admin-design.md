# Multi-Management Admin Shell — Design

> Date: 2026-08-19 · Project: GreatSales CRM (`apps/web`)
> Status: Approved outline, spec for review

## 1. Goal

Today the web admin is a **single flat shell** for one company. We add a level
**above** it: an owner can **create and switch between unlimited managements**
(separate companies). Opening a management drops into **the exact current admin
design**, scoped to that management. Nothing inside the current admin changes.

One sentence: *wrap the existing admin in a tenant-selection shell.*

## 2. Locked decisions

| Decision | Choice |
|---|---|
| What is a "management" | A **separate company (tenant)** — fully isolated users + data, one never sees another |
| Who creates / switches managements | **Owner only** (platform super-admin). Regular admins stay locked to one management |
| Inside a management | **Exact current admin** — zero redesign of existing screens |
| Backend model | Reuse existing **multi-tenant** schema: `Tenant` + `tenant_id` + RLS, and platform tables (`PlatformUser`, `PlatformAuditLog`) — already built 2026-08-15 |

## 3. Two-level architecture

```
Login
 └─ (owner)  → Level 0: Management Home        /managements
                 ├─ card grid of managements
                 ├─ "＋ Create management" wizard
                 └─ click a card ─┐
                                  ▼
    (admin)  → Level 1: Management workspace   /m/:managementId/*
                 = EXISTING admin, unchanged
                 (Dashboard · Projections · Leads · Orders · Payments ·
                  Follow-ups · Customers · Products · Users · Data)
                 + topbar "management switcher" (owner only)
```

- **Level 0** exists only for the **owner**. It is the new surface.
- **Level 1** is the current app, moved under a `/m/:managementId` prefix. Every
  existing page renders unchanged; it reads the active `managementId` from context
  instead of assuming a single company.

### Who lands where

| Principal | On login | Can switch management | Can create management |
|---|---|---|---|
| **Owner** | Management Home (`/managements`) | ✅ any | ✅ |
| **Admin** (of one management) | straight into `/m/:theirId/dashboard` | ❌ | ❌ |
| **Management / Sales roles** | as today, inside their one management | ❌ | ❌ |

The owner is a **platform-level principal** (`PlatformUser`), distinct from a
tenant `User`. Creating/switching tenants is a platform action (RLS-bypass,
audited to `PlatformAuditLog`). When the owner opens a management, the session
sets the active tenant context and the owner operates with admin capability
inside it. This matches Part B ("Platform Super-Admin") in `ADMIN-CAPABILITIES.md`.

## 4. Level 0 — Management Home

Route: `/managements` (owner-only; others get redirected to their management).

- **Header**: brand, global "search managements", owner avatar/menu (sign out).
- **Card grid** (`repeat(auto-fit, minmax(190px, 1fr))`): one card per management —
  logo/initials, name, industry · currency, two stats (users, this-month sales),
  "Open →". Card click → `/m/:managementId/dashboard`.
- **Create card** (dashed): opens the Create-Management wizard.
- **Empty state**: first-run owner sees only the create card + a one-line prompt.
- **Scale**: search filters the grid client-side; sort by name / last-opened /
  activity. No pagination until ~50+ managements (YAGNI).

## 5. Create-Management wizard

A modal (or `/managements/new`) — minimal, provisions a real tenant.

Steps / fields:
1. **Company** — name, logo (optional), industry, region.
2. **Localization** — currency, timezone, fiscal-year start.
3. **First admin** — name + email (gets an invite to administer this management).

On submit (owner action, audited):
1. Create `Tenant` row (`status = Trial`, region, industry, currency).
2. Auto-provision: seed system roles + permission matrix, default master-data
   lists (deal stages, pay zones, categories), and the first `User` (admin role)
   with a pending invite.
3. Write `PlatformAuditLog` (who created which tenant, when).
4. Redirect owner into `/m/:newId/dashboard`.

Provisioning logic already scoped in Part B §1 (Tenant Lifecycle). No new tables.

## 6. Level 1 — Inside a management (existing admin)

Unchanged screens. Two additions only:

1. **Route prefix** — everything moves under `/m/:managementId/`. E.g.
   `/dashboard` → `/m/acme/dashboard`.
2. **Management switcher** (topbar, **owner only**) — dropdown showing current
   management name; items: switch to another management, back to Management Home,
   create new. Hidden entirely for non-owner principals.

Isolation guarantee: every data read/write is scoped by the active `managementId`
(maps to `tenant_id`, enforced by RLS at the DB — `SET LOCAL app.tenant_id`).
A management can never read another's data.

## 7. State / context changes (`apps/web`)

Current `store/ui.ts` (`useUi`) holds `role`, `ownerId`, filters — no tenant.

Add:

- `activeManagementId: string | null` — the tenant currently open (null on
  Management Home).
- `isOwner: boolean` — platform-owner flag (drives Level 0 access + switcher).
- `managements: ManagementSummary[]` — list for Home + switcher (id, name, logo,
  industry, currency, stats). Sourced from API for the owner.
- Actions: `openManagement(id)`, `leaveManagement()` (→ Home), `createManagement(input)`.

`activeManagementId` becomes the single source every existing page/selector reads
to scope data. In the current mock POC this narrows the in-memory dataset; against
the real API it sets the tenant header / context per request.

## 8. Components

New:

| Component | Role |
|---|---|
| `ManagementHomePage` | Level 0 — card grid + create card + search |
| `CreateManagementModal` | provisioning wizard |
| `ManagementSwitcher` | topbar dropdown (owner only) |
| `RequireOwner` | route guard — owner-only, else redirect to their management |
| `ManagementProvider` | reads `:managementId` from the URL, sets context, guards access |

Modified:

| File | Change |
|---|---|
| `App.tsx` | add `/managements` (+ `RequireOwner`); wrap existing routes in `/m/:managementId/*` behind `ManagementProvider`; redirect rules |
| `components/layout.tsx` (`Topbar`) | mount `ManagementSwitcher` (owner only) |
| `store/ui.ts` | add `activeManagementId`, `isOwner`, `managements`, actions; bump persist `version` + migrate |
| existing pages/selectors | read `activeManagementId` for scoping — **no UI change** |

## 9. Routing (target)

```
/login                         public
/managements                   owner only  → ManagementHomePage
/managements/new               owner only  → CreateManagementModal (or route)
/m/:managementId/dashboard     → DashboardPage      ┐
/m/:managementId/projections   → ProjectionsPage    │ existing screens,
/m/:managementId/leads         → LeadsPage          │ unchanged, wrapped in
/m/:managementId/orders        → OrdersPage         │ ManagementProvider
/m/:managementId/payments      → PaymentsPage        │
/m/:managementId/followups     → FollowUpsPage      │
/m/:managementId/customers     → CustomersPage      │
/m/:managementId/products      → ProductsPage       │
/m/:managementId/users         → UsersPage (admin)  │
/m/:managementId/data          → DataPage  (admin)  ┘
/                              redirect: owner → /managements; admin → /m/:their/dashboard
```

`ManagementProvider` validates that the principal may access `:managementId`
(owner → any; admin → only their own) before rendering; invalid → redirect + toast.

## 10. Migration steps (order)

1. Extend `store/ui.ts` with tenant/owner state + actions; bump persist version.
2. Add `ManagementProvider` + `RequireOwner`.
3. Re-nest existing routes under `/m/:managementId/*` in `App.tsx`; add root redirect.
4. Update internal links / `NavLink` `to` in `layout.tsx` to prefix `/m/:managementId`.
5. Build `ManagementHomePage` (Level 0) with mock managements list.
6. Build `CreateManagementModal` (client provisioning for POC; wire to API later).
7. Add `ManagementSwitcher` to `Topbar` (owner only).
8. Point existing selectors at `activeManagementId` for scoping.
9. Backend (when off mock): tenant provisioning endpoint + platform-scoped
   list/create; `PlatformAuditLog` on create/switch.

## 11. Out of scope (YAGNI now)

- Billing / plans / usage metering (Part B §2 — deferred until charging).
- Separate platform console app — owner shell lives in the same web app for now.
- Cross-management aggregate dashboards ("all companies at a glance").
- Pagination / advanced filtering on Management Home (<50 managements).
- Per-management custom branding beyond logo + name.

## 12. Testing

- **Access**: admin cannot reach `/managements`; admin cannot open a management
  that isn't theirs (redirect). Owner can.
- **Isolation**: opening management A never surfaces management B's data.
- **Provisioning**: create wizard yields a tenant with seeded roles, masters, and
  a pending first-admin invite; audit row written.
- **Switcher**: visible for owner only; switching swaps active context + data.
- **Redirects**: `/` routes owner → Home, admin → their `/m/:id/dashboard`;
  deep link into `/m/:id/*` while logged out → login → back to intended URL.

## 13. Resolved questions

- Management = separate isolated tenant. ✅
- Owner-only create/switch. ✅
- Existing admin design unchanged. ✅
