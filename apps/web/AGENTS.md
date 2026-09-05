# AGENTS.md — `apps/web` (GreatSales web console)

The repo-wide contract is [`../../AGENTS.md`](../../AGENTS.md); it governs, and this file
does not repeat it. What follows is only what is specific to this workspace.

## What this app is

Vite 6 + React 19 SPA. React Router 7, TanStack Query 5, Zustand, Tailwind 4,
react-hook-form + zod, `xlsx`. No SSR, no framework router, no server components.

Build is `tsc --noEmit && vite build`; the artifact is static files served by nginx.
`tsconfig.json` has `strict: true` — keep it that way.

## Things that are true here and easy to get wrong

**`VITE_*` values are baked in at build time, and they are PUBLIC.** They are compiled into
the bundle, so an image built with staging values *is* a staging image and can never be
promoted to production. Never put a secret in one.
See [`../../checklists/11-BUILD-INFRA.md`](../../checklists/11-BUILD-INFRA.md) K.1.3.

**Anything reachable from `main.tsx` ships to every visitor, before they log in.** Check
what you pull into the app shell. One constant imported from the wrong module once dragged
a 33,000-line dataset of real customer records into the pre-login entry chunk — see
[`../../checklists/07-SECURITY.md`](../../checklists/07-SECURITY.md) G.3.9.

**The mock modules are being removed, not extended.** `src/data/mock.ts`,
`src/data/pocSeedData.ts` and `src/store/trackerStore.ts` are legacy client-side fixtures
holding real records. Do not add a new import of any of them. The one remaining consumer
is the management feature (roadmap F14), which is tracked as unfinished for this reason.

**Role gating in the UI is cosmetic.** Hiding a button is not authorization — the server
decides. Every role-gated route must also be denied by the API; assume a user will paste
the URL directly.

**Tenant id belongs in every query key.** Without it, switching tenant can serve the
previous tenant's cached data. Logout must clear the whole query cache.

## Before claiming something works

The gate is a **production build**, never the dev server: `pnpm --filter web build`, then
inspect `dist/`. A passing unit test and a working `vite dev` are not evidence. The
evidence rule and this workspace's checklist live in
[`../../checklists/04-FRONTEND-WEB.md`](../../checklists/04-FRONTEND-WEB.md), which is
where findings get recorded.

`pnpm --filter web test` runs vitest. Two route tests cross lazy boundaries and carry
explicit waits with the reason written at the call site; if you add another lazy boundary,
expect to extend those rather than dismiss the result as a flake.

## Repo-root reports are not evidence

`FRONTEND-PRODUCTION-READINESS-QUESTIONNAIRE.md` is a question bank, not a status report. The
generated audit files that used to sit beside it were deleted on 2026-09-04 for claiming a
parity the code never had — do not regenerate them. Verify against the source and a running
production build instead.
