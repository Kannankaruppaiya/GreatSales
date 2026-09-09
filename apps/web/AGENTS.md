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

**The client-side mock modules are gone.** `src/store/trackerStore.ts` and
`src/data/demoSeedData.ts` were legacy fixtures holding real records; the management
feature was their last consumer and now reads `/managements`, `/dashboard` and `/users`,
so both files were deleted. Do not reintroduce a client-side dataset — if a page needs
numbers, it needs an endpoint.

**Role gating in the UI is cosmetic.** Hiding a button is not authorization — the server
decides. Every role-gated route must also be denied by the API; assume a user will paste
the URL directly.

**Tenant id belongs in every query key.** Without it, switching tenant can serve the
previous tenant's cached data. Logout must clear the whole query cache.

## The design system, and why pages drift away from it

The tokens live in [`src/index.css`](src/index.css) under `@theme`: colours (`--color-ink`,
`--color-muted`, `--color-line`, `--color-surface`, `--color-brand`, plus the status
colours), the radius and shadow scales, `Plus Jakarta Sans`, and a type scale. Tailwind 4
generates the utilities from them, so the token names *are* the class names —
`text-ink`, `text-muted`, `border-line`, `bg-surface`, `bg-brand`.

**Use the token, not the palette colour behind it.** `border-slate-200` and `border-line`
render the same pixels today and stop being the same the moment the brand changes.
A survey on 2026-09-07 found 182 raw palette classes sitting beside the tokens that
already named those colours.

**Pick a rung on the type scale, not a pixel.** This is a dense CRM, so the ladder runs
below Tailwind's default: `text-3xs` (10px), `text-2xs` (11px), then the stock `text-xs`
(12px), `text-sm` (14px), `text-base` (16px). The same survey found 296 ad-hoc sizes
across nine values — `text-[10.5px]`, `text-[11.5px]`, `text-[12.5px]` and friends. Nine
sizes with no scale is the single loudest reason the console reads as unfinished, and no
individual instance ever looks wrong enough to fix on its own.

**Reuse the primitives before writing a new one.** Cards, tables, badges, modals and the
shell already exist in [`src/components/ui.tsx`](src/components/ui.tsx),
[`common.tsx`](src/components/common.tsx) and [`layout.tsx`](src/components/layout.tsx).
A new page that rolls its own card is how two cards end up with different padding.

`pnpm design` enforces all three. It is a ratchet, not a clean bill of health: the counts
that exist today are recorded per file in `scripts/design-baseline.json`, and the check
fails when a file's count goes **up**. Existing drift can be paid down whenever; new drift
cannot be added. It runs inside `pnpm verify`. `--update` accepts the current counts —
that is for lowering the baseline after a cleanup, so raising it means writing drift into
the repo on purpose and the commit should say why.

## Look at the page before you say it looks right

**A UI change is not done until it has been rendered and looked at.** CSS that reads
correctly can still render wrong — a wrapper that collapses, a grid that overflows at
1280px, contrast that dies against `--color-canvas`. None of that shows up in `tsc`, in
vitest, or in a diff.

So after any change to a page's markup or styling: start the dev server, open the affected
route in the browser pane, screenshot it, and compare what is on screen against what was
asked for. Check a narrow width too if the layout has a grid or a table. Fix what the
screenshot shows, then look again. This loop is most of the difference between a page that
is technically correct and one that looks finished.

The production-build gate below is about correctness and still applies; this is about
whether anyone has actually looked at the result.

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
