# GreatSales CRM — Admin Capabilities Spec

> Build spec for the **web portal** admin surfaces. Everything below maps to models
> already in `packages/db/prisma/schema.prisma` — so building = UI + service + controller,
> the data model is ready.
>
> **Legend:** ✅ modeled in schema · 🆕 not yet in schema (add when built) ·
> 🔒 sensitive/audited action · ⚠️ standing config (careful, reversible-with-care)

---

## Roles at a glance

| Role | Surface | Login | DB role | Scope |
|---|---|---|---|---|
| **Salesperson** | Mobile (Expo) | mobile | `greatsales_app` | own data (offline-first) |
| **Management** | Web | web | `greatsales_app` | team / company **view** (mostly read) |
| **Tenant Admin** | Web | web | `greatsales_app` | one tenant — full **control** |
| **Platform Super-Admin** | Separate console | separate auth | `greatsales` (superuser, RLS bypass) | ALL tenants + platform |

> Security is **role-at-API + RLS-at-DB** (2-layer), not route-based. The running API
> connects as `greatsales_app` and runs `SET LOCAL app.tenant_id='<tid>'` per request.

---

# PART A — TENANT ADMIN (build now)

The customer company's administrator. Web portal. Full control of ONE tenant.

## 1. User & Access Management  🆕 *(POC gap)*
- User CRUD — salesperson / manager / admin: create, edit, deactivate (soft-delete `User.deletedAt`), reactivate
- Invite flow — email invite, pending-invites list, resend / revoke
- Role assignment (`User.roleId`)
- Password ops — force reset, temporary password, force-logout-all-sessions
- 2FA — enable / enforce / reset per user
- Login visibility — last login time, **last login IP** (`User.lastIp`), active/inactive
- Reporting manager assignment (`User.managerId`)
- Search / filter (role, team, active) + bulk deactivate

## 2. Team & Hierarchy Management  🆕
- Team CRUD (`Team`), assign manager (`Team.managerId`)
- Assign / remove salespeople to a team (`User.teamId`)
- Org-chart view — Manager → Team → Salesperson
- Re-org — move a salesperson to another team/manager

## 3. Roles & Permissions (RBAC)
- Custom roles (`Role`); lock system roles (`Role.isSystem`)
- Permission matrix — toggle the 13 permission keys per role (`RolePermission`)
- Module-level grants (e.g. hide payments from a role)

## 4. Master Data Management
- Products CRUD (`Product` — name, unit, base price, principal)
- Principals CRUD (`Principal`)
- Industries + sub-industries (`Industry`)
- Customer↔Product mappings oversight (`Mapping`)
- Config lists (enums / config): customer categories, payment terms, deal stages (9),
  pay zones, lead status, areas/territories

## 5. Customer Management (ALL customers)
- Full view/edit of every salesperson's customers (`Customer`)
- **Reassign** customer → another salesperson (on exit / rebalance)
- Contacts (`CustomerContact` — multi-contact, primary flag)
- Duplicate detect / merge
- Category / pay-zone override
- Import / export (Excel), bulk edit

## 6. Sales Targets & Projections (CORE)
- Set target per salesperson per period (`SalesTarget`)
- Bulk target upload (Excel)
- Projection override (`Projection` — committed vs achieved)
- Period lock (freeze edits after month-end)
- 3-way tracking: Target vs Committed vs Achieved

## 7. Leads / Orders / Payments oversight
- Leads — view all, stage override, reassign, activity timeline (`LeadActivity`)
- Orders — full view, status override (`OrderStatus`), status history (`OrderStatusHistory`)
- Payments — invoice tracking, aging, pay-zone, follow-up trail (`PaymentFollowup`), collections

## 8. Analytics & Reporting  🆕 *(POC gap — no analytics existed)*
- Org dashboard — target vs achievement, trend lines (ECharts)
- Drill-down: company → team → manager → salesperson → customer
- Pipeline funnel (9-stage conversion)
- Performance leaderboard
- Payment aging / collections report
- Product / principal / industry split
- Custom report builder + scheduled reports (email) + export (Excel/PDF)
- Date-range / team / region filters + saved views

## 9. Data Operations
- Import jobs (`ImportJob`) — Excel upload + validation + row-level error report
- Export — every list → Excel/CSV
- Bulk ops — assign, status change, delete
- Archive / restore (soft-delete `deletedAt`)
- Attachments (`Attachment` — S3) oversight

## 10. Notifications & Communication
- Notification rules (`NotificationType` — follow-up due, payment reminder, lead assigned)
- Broadcast / announcement to all users
- Email / push templates

## 11. Audit & Compliance  🆕
- Audit log viewer (`AuditLog` — who/when/what, before/after json)
- Security events (login, failed login, password/permission changes)
- Filters (user, entity, date)
- Compliance — data export, data deletion request

## 12. Workspace / Tenant Settings
- Company profile — name, logo, branding
- Localization — currency, timezone, fiscal year, date/number format
- Security policy — password rules, session timeout, 2FA enforcement, IP allowlist
- Feature toggles (`TenantFeatureFlag` — per-tenant overrides) ✅
- Integrations — API keys, webhooks ⚠️ (standing config)
- Plan & limits (`Tenant.plan/limits`) — view only now, billing later

## 13. Mobile App Governance
- Force update / version gating (block old versions)
- Device / session management, remote logout
- Sync oversight — last sync time, sync failures (PowerSync)

---

## Admin vs Management vs Salesperson (boundary)

| Capability | Salesperson | Management | Admin |
|---|---|---|---|
| Own data (mobile) | ✅ | — | — |
| Team/company view | — | ✅ | ✅ |
| Analytics/reports | own | ✅ read | ✅ full |
| Create/edit users | — | ❌ | ✅ |
| Roles & permissions | — | ❌ | ✅ |
| Master data | — | ❌ | ✅ |
| Set targets | — | sometimes | ✅ |
| Reassign data | — | ❌ | ✅ |
| Workspace settings | — | ❌ | ✅ |
| Audit log | — | partial | ✅ |

> **Rule:** Management = visibility + oversight (mostly read). Admin = control (write + config).

## Small things not to miss
- Every list: search + column filter + sort + pagination + export
- Saved views / filters
- Soft-delete + restore (no hard-delete)
- "View as" / impersonate (support) 🔒 audited
- Reassignment on employee exit (customers/leads/orders transfer)
- Duplicate detection (customers, invoices)
- Empty states + inline validation
- Optimistic UI + undo for bulk actions
- Auto audit trail on every write (`AuditLog`)
- Per-user login IP (`User.lastIp`)

---

# PART B — PLATFORM SUPER-ADMIN (Phase 2)

*Us* — the SaaS operator. Separate console, separate auth, cross-tenant.
Build **after** tenant app + admin ship. Foundation (RLS + platform tables) is ready,
so this layers on without rewrite.

> **Priority key:** 🔴 High · 🟡 Medium · 🟢 Low — with the **trigger** that makes it real.

## Status of platform foundation (already built 2026-08-15)
| Piece | Status |
|---|---|
| `PlatformUser` (separate table, `PlatformRole`, 2FA) | ✅ |
| `PlatformAuditLog` | ✅ |
| `FeatureFlag` + `TenantFeatureFlag` (RLS-scoped) | ✅ |
| `Tenant.status/region/industry/contract*/accountManagerId` | ✅ |
| App role revoked on platform tables (verified) | ✅ |
| Billing (Plan/Subscription/Invoice) | 🆕 deferred |
| Usage metering / limit enforcement | 🆕 deferred |

## 1. Tenant Lifecycle  🟡 *(trigger: 1st onboarding)*
- Onboard — create `Tenant`, auto-provision roles/permissions/admin/masters
- Configure plan / limits / config (✅ fields)
- Status: Trial → Active → Suspended → Churned (`Tenant.status` ✅)
- Suspend / reactivate / offboard (soft-delete + retention + final export)
- Metadata: region, industry, contract dates, account manager (✅)

## 2. Plans, Limits & Billing  🔴 low-now *(trigger: start charging)*
- Plan definitions (Free/Pro/Enterprise) 🆕
- Limits per plan + enforcement (`Tenant.limits` ✅, enforcement 🆕)
- Usage metering (users, storage, API, records) 🆕
- Stripe: subscriptions, invoices, dunning, proration (deferred)
- Trials, coupons; revenue dashboard (MRR/ARR/churn)

## 3. Cross-Tenant Support  🟡 *(trigger: 2nd tenant / support team)*
- All-users view; impersonate / "login as tenant admin" 🔒 audited, time-boxed
- Password reset / unlock any user
- Per-tenant support context (health, plan, recent errors)

## 4. Platform Team & Internal RBAC  🟢 build / 🔴 decide *(decision already taken: separate table)*
- Internal roles: SuperAdmin / Ops / Support / Billing / ReadOnly (`PlatformRole` ✅)
- Team member CRUD + role assign; 2FA enforced

## 5. Monitoring & Observability  🟡
- System health (API, Postgres, Redis, BullMQ, PowerSync)
- Per-tenant usage; error rates (Sentry), latency; queue health; DB perf; uptime/incidents

## 6. Operations & Maintenance  🟡
- Re-run failed imports/syncs/jobs; controlled data fixes 🔒; bulk migrations
- Maintenance mode (global / per-tenant) + notice broadcast
- Backup / restore / PITR

## 7. Feature Flags & Rollout  🟢 *(trigger: risky rollout / kill-switch)*
- Global flags (`FeatureFlag.enabledGlobal` ✅) + rollout % (`rolloutPercent` ✅)
- Per-tenant override (`TenantFeatureFlag` ✅); canary / A-B

## 8. Global Master & Defaults  🟢
- Default taxonomies (industries), base permission catalog seeded per new tenant
- System templates, system-wide config

## 9. Security & Compliance (Platform)  🟡
- Platform audit log (`PlatformAuditLog` ✅) — impersonation, data access, tenant actions
- Data residency / region; GDPR export / erasure per tenant
- Secrets & key rotation; abuse/WAF/rate-limit; incident response

## 10. Communication (Platform → Tenants)  🟢
- Announcements (maintenance, features) to tenant admins
- Targeted campaigns; in-app broadcast; public status page

## 11. Business Analytics (operator)  🟢
- Tenant growth, active/churned, MRR/ARR, expansion
- Feature usage; cohort / retention; trial → paid conversion

## 12. Release & App Version Management  🟡
- Mobile force-update (global); OTA channels (EAS dev/staging/prod)
- API versioning / deprecation; changelog

---

## Tenant Admin vs Platform Super-Admin

| | Tenant Admin | Platform Super-Admin |
|---|---|---|
| Who | Customer company | Us (operator) |
| Scope | ONE tenant | ALL tenants |
| App | Tenant web portal | Separate console |
| DB role | `greatsales_app` (RLS bound) | `greatsales` (RLS bypass) |
| Manage users | own company | tenants + platform team |
| Billing | view | full control |
| Impersonate | ❌ | ✅ 🔒 |
| Infra / monitoring | ❌ | ✅ |
| Feature flags | ❌ | ✅ |

---

## Build guidance
- **Phase 1 (now):** Tenant Admin (Part A) — this is what ships first. Every capability
  has its data model ready.
- **Phase 2 (revenue/scale):** Platform Super-Admin console — start with tenant lifecycle
  + support/impersonation, then billing when charging begins.
- Do not build platform tooling early; onboard first customers manually (Prisma Studio /
  script) and invoice offline until billing is justified.
