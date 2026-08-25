# D. Frontend — Web Console — Production Checklist

> **apps/web · Vite 6 + React 19 SPA**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 155

**Gate:** Judged against `vite build` output served by nginx — never the dev server.

**Depends on:** [C. API](03-API.md), [F. Shared packages](06-SHARED-PACKAGES.md).

## Status legend

| Symbol | Meaning |
| --- | --- |
| `[ ]` | **Not started** — no code, or nobody has looked. |
| `[~]` | **Code exists, UNVERIFIED.** An implementation is present but unproven against a production build. **This is not progress.** |
| `[x]` | **Verified in a production build**, with evidence recorded in the Evidence column. |
| `[-]` | **Deliberately out of scope for v1** — requires a written reason and a follow-up ticket. |

**Evidence rule.** A box may only be ticked when someone can point at proof a stranger
could re-run: a command plus its pasted output, a CI run URL, an `EXPLAIN (ANALYZE)` plan
with the measured number, a migration plus the rollback that was actually executed, or a
screenshot of the **production build**. "It looks right", "the code is there", and a unit
test with a mocked Prisma client are **not** evidence.

> ⚠️ Repo-root audit and readiness reports (`*-AUDIT-REPORT.md`, `*-READINESS*.md`,
> `FRONTEND-PRODUCTION-READINESS-QUESTIONNAIRE.md`) are historical and contain claims that
> do not match the code. **Never tick a box on their authority.** Re-verify against the code
> and a running production build, every time.

**Rules:** never delete a row (mark it `[-]` with a reason instead) · never tick in bulk ·
if a verified item regresses, set it back to `[ ]` and log it in
[O.3 Regression log](15-GO-LIVE.md) · update **Last reviewed** whenever you touch this file.

---

**Current shape (verified 2026-08-25):** Vite 6 + React 19 SPA, React Router 7, TanStack Query 5,
Zustand, Tailwind 4, `xlsx`, react-hook-form + zod. Build = `tsc --noEmit && vite build`.
10 protected routes + login portals + change-password + management routes.

## D.1 Production build integrity

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| D.1.1 | `pnpm --filter web build` succeeds from a clean checkout with zero warnings tolerated | `[ ]` | |
| D.1.2 | `tsc --noEmit` passes in `strict` mode; `strict` is actually on in `tsconfig.json` (verify, don't assume) | `[ ]` | |
| D.1.3 | Zero `any`, `@ts-ignore`, or `@ts-expect-error` in the production path — each remaining one is listed and justified | `[ ]` | |
| D.1.4 | No `console.log` / `debugger` in the production bundle (grep the built `dist/`) | `[ ]` | |
| D.1.5 | `import.meta.env.DEV`-only code is proven tree-shaken out of `dist/` | `[ ]` | |
| D.1.6 | 🔴 **No mock data reaches the production bundle.** `src/data/mock.ts`, `src/data/pocSeedData.ts`, `src/data/selectors.ts`, `src/store/trackerStore.ts`, `src/lib/mockOwner.ts` are deleted or provably unreachable from `main.tsx`. **Verified reachable today — see D.1.6a–D.1.6c below.** | `[~]` | PARTIAL 2026-08-25. **Measured first**, per D.1.6b: 60 distinct string literals sampled from `pocSeedData.ts` were probed against `apps/web/dist` — **50 of 60 were present**, in the ENTRY chunk, i.e. downloaded by every visitor BEFORE logging in. (An earlier single-literal probe came back clean and was misleading; one sample is not a measurement.) Four dead modules removed and one import edge cut — see D.1.6a/c/d/e. The data is now out of the entry chunk but **still in the build**; closing this needs F14. |
| D.1.6a | `src/store/trackerStore.ts` (a zustand+persist client-side mock store) is imported at runtime by `components/modals/AddMappingModal.tsx`, `features/management/managementActions.ts`, and `features/management/ManagementHomePage.tsx`. Removing it requires the mapping API ([C.3.1](03-API.md)) and real tenancy ([C.3.5](03-API.md)) to exist first | `[~]` | `AddMappingModal.tsx` turned out to be imported by NOTHING — dead code, and with it the whole F5 mapping UI was unreachable. Deleted, along with `hooks.ts`, `data/selectors.ts` and `lib/mockOwner.ts`, which were dead once it went. **Still live:** `managementActions.ts` and `ManagementHomePage.tsx` read `trackerStore`, so the F14 management feature is now the ONLY path to the POC dataset. `managementStore.ts` uses `import type`, which is erased and pulls nothing. |
| D.1.6b | 🔴 **Also a data-exposure item, not only a bundle-size one — see [G.3.9](07-SECURITY.md).** `trackerStore` imports `POC_CUSTOMERS … POC_USERS` from `src/data/pocSeedData.ts`, which is **33,448 lines**. Because `trackerStore` is in the production path, that entire POC dataset is a bundle candidate. **Measure it:** build, then grep `dist/` for a known POC value and record the byte cost | `[~]` | MEASURED. `trackerStore-*.js` is 432,018 bytes and carries the real records. `ManagementProvider` was the only STATIC import reaching it, so it sat in the entry chunk; making it lazy moved it out: entry chunk 790,570 -> 358,070 bytes (-55%), gzip 136 kB -> 104 kB. The 500 kB chunk warning is gone. Not downloaded pre-login any more — **but still shipped**, so this stays open. |
| D.1.6c | `src/store/ui.ts` imports `CURRENT_MONTH` from `src/data/mock.ts` (which re-exports `pocSeedData`), and `ui.ts` is imported by `App.tsx`, `layout.tsx`, and `DashboardPage.tsx`. Replace with a computed value so the mock module is not pulled in by the app shell | `[x]` | DONE. `store/ui.ts` imported `CURRENT_MONTH` from `@/data/mock` — a hardcoded `"2026-08"`. Two bugs in one: the app defaulted to a single fixed month forever, and because `ui.ts` is imported by `App.tsx`, `layout.tsx` and `DashboardPage.tsx`, that one string dragged the POC dataset into the shell. Now computed from `new Date()`. |
| D.1.6d | `src/lib/mockOwner.ts` (imports `users` from `data/mock`) is used by `hooks.ts` and `AddMappingModal.tsx` — remove once the real owner comes from the session | `[x]` | DONE. `lib/mockOwner.ts` deleted — its only consumers were `hooks.ts` and `AddMappingModal.tsx`, both dead. |
| D.1.6e | `src/data/selectors.ts` (imports from `data/mock`) is used by `hooks.ts` and `store/auth.ts` — remove or re-point at API types | `[x]` | DONE. `data/selectors.ts` deleted — consumed only by the dead `hooks.ts`. `store/auth.ts` never imported it; an earlier grep hit was a comment. |
| D.1.6f | A CI check fails the build if any module under `src/data/mock*`, `src/data/pocSeedData*`, `src/store/trackerStore*`, or `src/lib/mockOwner*` appears in the production module graph — so this cannot regress silently | `[ ]` | |
| D.1.7 | Demo-login prefill (`VITE_DEMO_*`) is empty in a production build, verified by grepping `dist/` for any seeded password string | `[x]` | VERIFIED 2026-08-25 on a real `vite build`: `grep -rq "Passw0rd!" apps/web/dist` finds nothing. Now asserted in CI (`.github/workflows/ci.yml`, build job) so it cannot regress. |
| D.1.8 | No secret, API key, or internal URL is embedded in the bundle — every `VITE_*` var is reviewed as **public by definition** | `[ ]` | |
| D.1.9 | Source maps: either not shipped, or shipped privately to the error tracker only — never publicly served | `[ ]` | |
| D.1.10 | Build is reproducible: same commit ⇒ same bundle hash | `[ ]` | |
| D.1.11 | Dependency licences reviewed (`xlsx` in particular) and compatible with a commercial product | `[ ]` | |

## D.2 Bundle & load performance

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| D.2.1 | Bundle size budget set (gzipped initial JS) and enforced in CI — a build that exceeds it fails | `[ ]` | No budget is enforced yet. Baseline measured 2026-08-25 for whoever sets one: entry chunk 790,516 B; all assets 372,453 B gzipped. Most of the entry chunk is the POC dataset — see D.1.6b — so set the budget AFTER that is removed, or it will be set around a bug. |
| D.2.2 | Route-level code splitting: `/products`, `/users`, `/data` and every heavy page load lazily | `[x]` | VERIFIED 2026-08-25: `vite build` emits 19 per-route chunks (`CustomersPage-*.js`, `UsersPage-*.js`, `ProductsPage-*.js`, `DataPage-*.js`, …), so routes are already lazily loaded. |
| D.2.3 | `xlsx` (large) is dynamically imported only when an import/export is actually triggered | `[x]` | VERIFIED 2026-08-25: `xlsx` is its own chunk, `xlsx-CkFp8p6R.js` at 429,534 bytes — it is not in the entry bundle. |
| D.2.4 | Chart code is code-split away from the initial shell | `[ ]` | |
| D.2.5 | Vendor chunking reviewed so a small app change does not bust the whole cache | `[ ]` | |
| D.2.6 | Assets fingerprinted; `index.html` served `no-cache`, hashed assets served `immutable, max-age=31536000` | `[ ]` | |
| D.2.7 | Fonts self-hosted or preloaded with `font-display: swap`; no layout shift from font loading | `[ ]` | |
| D.2.8 | Images/icons optimised; `lucide-react` imports are tree-shaken (no full-library import) | `[ ]` | |
| D.2.9 | Core Web Vitals measured on the **production build over a real network profile**: LCP, CLS, INP recorded with numbers | `[ ]` | |
| D.2.10 | Time-to-interactive measured on the slowest realistic device/network the sales team actually uses | `[ ]` | |
| D.2.11 | Long lists are virtualised or paginated — no page renders 10k DOM rows | `[ ]` | |
| D.2.12 | No render-blocking waterfall: the app shell does not wait on a chain of dependent requests before first paint | `[ ]` | |

## D.3 Data layer (TanStack Query + API client)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| D.3.1 | `staleTime` / `gcTime` / `retry` are set deliberately per query, not left at defaults | `[ ]` | |
| D.3.2 | Retry policy never retries a 4xx and never retries a non-idempotent mutation | `[ ]` | |
| D.3.3 | Query keys are structured and collision-free; **tenant id is part of every key** so switching tenant cannot show stale data from the previous one | `[ ]` | |
| D.3.4 | Logout clears the entire query cache — no data from the previous user survives | `[ ]` | |
| D.3.5 | Every mutation invalidates exactly the right keys; no stale list after a create/update/delete | `[ ]` | |
| D.3.6 | Optimistic updates (if used) roll back correctly on failure, proven by a test | `[ ]` | |
| D.3.7 | The API client attaches auth, and the single-flight refresh-on-401 is proven under concurrent 401s | `[ ]` | |
| D.3.8 | A failed refresh logs the user out cleanly and redirects — no infinite refresh loop | `[ ]` | |
| D.3.9 | Every fetch has a timeout / `AbortSignal`; a hung request cannot spin forever | `[ ]` | |
| D.3.10 | Requests are cancelled on unmount/route change | `[ ]` | |
| D.3.11 | The client never paginates by fetching everything — **the dashboard's fetch-all-leads pattern must be replaced by a server aggregate (C.3.2)** | `[ ]` | |
| D.3.12 | `API_BASE_URL` is same-origin `/api/v1` in production so the refresh cookie stays first-party (per `.env.staging.example` — same constraint applies to prod) | `[ ]` | |

## D.4 UI states — every page, every time

> Per `FEATURE-ROADMAP.md` DoD #4. Tick one row per page only when **all six** states render
> correctly in the production build.

| Page | Loading | Empty | Error + retry | Permission-denied | Offline | Partial/slow |
| --- | --- | --- | --- | --- | --- | --- |
| Login (4 role portals) | `[ ]` | n/a | `[ ]` | n/a | `[ ]` | `[ ]` |
| Change password | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Dashboard | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Projections | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Leads | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Orders | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Payments | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Follow-ups | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Customers | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Products | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Users (Users/Roles/Teams tabs) | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Data | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Managements / switcher | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Not-found (404) | n/a | n/a | n/a | n/a | n/a | `[ ]` |

## D.5 Forms & input

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| D.5.1 | Every form validates client-side **and** the server re-validates; the client is never the only gate | `[ ]` | |
| D.5.2 | Server field errors are mapped back onto the right form fields, not shown as a generic toast | `[ ]` | |
| D.5.3 | Double-submit is impossible: submit disabled while pending, and the mutation is idempotent or guarded | `[ ]` | |
| D.5.4 | Unsaved-changes guard on every modal/page that can lose user work | `[ ]` | |
| D.5.5 | Numeric/currency inputs handle locale, paste, and clipboard junk without producing `NaN` | `[ ]` | |
| D.5.6 | Date inputs are timezone-correct; the date the user picks is the date the server stores | `[ ]` | |
| D.5.7 | Long text is length-limited client-side to match the DB bound (A.1.13) | `[ ]` | |
| D.5.8 | File pickers (import) validate type and size before reading, and a huge file does not freeze the tab | `[ ]` | |

## D.6 Routing, auth & role gating

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| D.6.1 | Every protected route is behind a guard; a direct URL paste to any route while logged out lands on login | `[ ]` | |
| D.6.2 | After login the user returns to the originally requested URL | `[ ]` | |
| D.6.3 | Role gating in the UI **mirrors** server permissions and never grants more than the server allows (the UI hiding a button is cosmetic, not security) | `[ ]` | |
| D.6.4 | A role-gated route accessed directly by URL is denied by the server too — proven per route | `[ ]` | |
| D.6.5 | Deep links, browser back/forward, and refresh all behave correctly on every route | `[ ]` | |
| D.6.6 | The SPA fallback is configured in nginx so a hard refresh on `/customers` serves `index.html`, not a 404 | `[ ]` | |
| D.6.7 | Session expiry mid-action shows a clear re-auth path and does not lose the user's typed data | `[ ]` | |
| D.6.8 | Multi-tab: logging out in one tab logs out the others | `[ ]` | |
| D.6.9 | Tenant/management switch fully resets state — no data from the previous tenant is visible for even one frame | `[ ]` | |

## D.7 Frontend security

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| D.7.1 | 🔴 No token in `localStorage`/`sessionStorage`. The refresh token is an httpOnly cookie; the access token is in memory only. **Verify in the production build via DevTools → Application.** | `[ ]` | |
| D.7.2 | Zustand `persist` stores no credential and no PII | `[ ]` | |
| D.7.3 | No `dangerouslySetInnerHTML` anywhere; if one exists it is sanitised and justified | `[ ]` | |
| D.7.4 | A strict `Content-Security-Policy` is served by nginx and the app runs under it with zero violations (no `unsafe-inline`/`unsafe-eval`) | `[ ]` | |
| D.7.5 | Security headers on the web origin: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`, HSTS | `[ ]` | |
| D.7.6 | No user-controlled string reaches `href`/`src` without scheme validation (`javascript:` blocked) | `[ ]` | |
| D.7.7 | Client-side exports (xlsx) cannot leak data the user is not allowed to see — the data came from a permission-checked endpoint | `[ ]` | |
| D.7.8 | CSV/formula injection guarded on export (leading `=`, `+`, `-`, `@` escaped) | `[ ]` | |
| D.7.9 | `npm audit` / dependency scan clean of high+ severity, or each exception is written down | `[ ]` | |
| D.7.10 | Third-party scripts: none, or each is pinned with SRI and reviewed | `[ ]` | |

## D.8 Accessibility & UX quality

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| D.8.1 | Keyboard-only operation of every critical flow (login → create customer → create order → record payment) | `[ ]` | |
| D.8.2 | Focus is trapped in modals and returned to the trigger on close | `[ ]` | |
| D.8.3 | All interactive elements have accessible names; icon-only buttons have labels | `[ ]` | |
| D.8.4 | Colour contrast meets WCAG 2.2 AA in both themes | `[ ]` | |
| D.8.5 | Errors and toasts are announced to screen readers (`aria-live`) | `[ ]` | |
| D.8.6 | Form fields have real `<label>` associations and error text linked via `aria-describedby` | `[ ]` | |
| D.8.7 | Automated axe scan clean on every page | `[ ]` | |
| D.8.8 | Responsive down to the smallest supported width; tables degrade sensibly | `[ ]` | |
| D.8.9 | Browser support matrix defined and the production build tested on each | `[ ]` | |
| D.8.10 | An `ErrorBoundary` wraps the app **and** each route, showing a recoverable UI, and reports to the error tracker | `[ ]` | |
| D.8.11 | Text is externalised or a decision is recorded that v1 is English-only (currency/number/date formatting still locale-correct for India) | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
