# Projections Auth Unification — Design Note (DEFERRED)

**Date:** 2026-08-19
**Status:** DECIDED, NOT YET IMPLEMENTED — do nothing until picked up again.
**Decision owner:** Kannan

---

## The problem

The web app currently runs **two parallel, disconnected auth systems**:

| System | Store | Behaviour |
|--------|-------|-----------|
| Main app login | `useUi` (`apps/web/src/store/ui.ts`) | `LoginPage.tsx` — polished UI, "1-click persona" demo buttons. **Mock only**: it just sets a `role` / `authed` flag, never calls the real backend. Drives `ProtectedRoute`, `RoleGuard`, `RequireOwner` in `App.tsx`. |
| Real API login | `useAuth` (`apps/web/src/store/auth.ts`) | Used **only** by `ProjectionsPage.tsx` via an inline `ConnectPanel`. Calls the real NestJS `POST /auth/login`, receives the JWT pair, persists it, and wires `setTokenGetter` for the api client. |

### Symptom the user noticed
On `ProjectionsPage`, the worksheet header shows `admin@acme.test · admin` and a **Disconnect** button. That button calls `useAuth.logout()` — it disconnects the *second* (real API) session, separate from the main app session.

So the user logs in once through the pretty `LoginPage` (mock), lands in the app, and then `ProjectionsPage` demands a **second** login into the real API through an in-worksheet `ConnectPanel`. Projections is the only page wired to the live API; every other page runs on mock data (`data/mock.ts`, `data/pocSeedData.ts`).

### Extra smells to clean up
- Hardcoded seeded credentials live directly inside the component:
  - `ProjectionsPage.tsx` → `DEFAULTS = { tenantId: "tenant_acme", email: "admin@acme.test", password: "Passw0rd!" }`
  - `LoginPage.tsx` → prefilled `admin@greatsales.test` / `Passw0rd!`
- `ConnectPanel` and the header **Disconnect** button are prototype scaffolding, not a real product flow.

---

## Decision — Option 2: Unify whole-app auth

Make the app's **single** `LoginPage` the real authentication entry point:

1. `LoginPage` calls the real `POST /auth/login` (tenant + email + password), storing the JWT pair + profile in **one** shared auth store.
2. `ProtectedRoute`, `RoleGuard`, `RequireOwner`, and `RootRedirect` read session/role from that same store (replace the mock `useUi.authed` / `role` / `isOwner` reads).
3. `ProjectionsPage` **consumes** `accessToken` from the shared store — no inline `ConnectPanel`, no header Disconnect. Logout lives in the app chrome (sidebar/topbar), once, for the whole app.
4. Seeded/demo credentials move out of components into a single config location (env-driven), used only to prefill the demo login — never hardcoded in a page.

**Why this over the alternatives**
- *Auto-connect (scoped)* — quick, but keeps the two-auth split alive and only hides it. Tech debt stays.
- *Full-page connect gate* — still a second login, just prettier. Doesn't fix the root cause.
- *Unify (chosen)* — one session, one login, one logout. Correct long-term shape; the rest of the app stops being mock-authed.

---

## Scope / impact when implemented (not now)

This is a **large** change — it touches the whole auth surface, not just projections:

- `store/ui.ts` — remove/replace mock `login(role)` / `authed` / `isOwner`; back them with the real session + JWT claims (role from token).
- `store/auth.ts` — becomes the single source of truth (may merge the two stores).
- `App.tsx` — `ProtectedRoute` / `PublicAuthRoute` / `RootRedirect` read the real session.
- `pages/LoginPage.tsx` — wire `submit` + persona buttons to real `/auth/login`; keep demo prefill from config.
- `pages/ProjectionsPage.tsx` — delete `ConnectPanel`, `DEFAULTS`, the `!enabled` gate, and the header user-info + **Disconnect** block. Add a single app-level logout in the layout chrome.
- `components/RoleGuard.tsx`, `RequireOwner.tsx` — role from JWT claims.
- Backend check: confirm `/auth/login` returns role + tenant/management scoping the frontend guards rely on; confirm token refresh path.

**Open questions to resolve before building:**
- Do the mock pages (dashboard, leads, orders, payments, etc.) need real API data too, or do they keep mock data while only auth is unified? (If they stay mock, the unified session is auth-only for now, which is fine.)
- Role source of truth: JWT claim vs a `/me` call.
- Refresh-token rotation / expiry handling on the client.

---

## Next step (when resumed)
Run this back through brainstorming → `writing-plans` to produce the implementation plan before touching code. Until then: **no code changes.**
