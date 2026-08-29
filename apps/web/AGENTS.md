# GreatSales Web Admin — conventions

**Stack:** React 19 + Vite 6 + TypeScript (strict, `noUnusedLocals`/
`noUnusedParameters`) + Tailwind CSS v4 (CSS-first) + react-router v7 (data
router). This is a client-rendered SPA — there is no Next.js here despite any
older notes.

## Design system (match the mobile app)

Colors, type scale, spacing, and radii are the **same semantic tokens** as
`apps/mobile`. Never hard-code a color — use the token utilities:

- Surfaces: `bg-canvas`, `bg-surface`, `bg-surface-sunken`
- Text: `text-fg`, `text-fg-secondary`, `text-fg-muted`, `text-on-primary`
- Brand/status: `bg-primary` / `text-primary`, `*-success`, `*-warning`,
  `*-error`, `*-info` (each with a `-subtle` background variant)
- Borders: `border-border`, `border-divider`; radii `rounded-field` (12px) /
  `rounded-card` (16px); shadows `shadow-card` / `shadow-pop`
- Tokens live in `src/index.css` (light `:root`, dark `.dark`), mapped into
  Tailwind via `@theme inline`. Dark mode = `.dark` class on `<html>`, set by
  `src/theme/theme-provider.tsx`.

## Building UI

- Compose from `@/components/ui` (Button, Input, Card, Banner, Badge, Text,
  Skeleton, Loading/Empty/Error states). Add new primitives there.
- Icons: one family — `lucide-react`.
- Every data view renders Loading / Empty / Error (with Retry) — never a blank.
- Accessibility: real `<label>`s and headings, `aria-invalid`/`aria-describedby`
  on fields, `role="alert"` for errors, visible `focus-visible` rings, status
  never by color alone (pair with icon/text).

## Data & auth

- API access goes through `@/lib/api` (`apiFetch`, `auth: true` for protected
  calls — it handles timeouts, error mapping, and 401→refresh).
- Session state is in `@/lib/auth/auth-context` (`useAuth`).
- Add authorization/role gating once the API enforces RBAC (see the repo-root
  production-readiness audit — RBAC is defined but not yet enforced).
- Keep data honest: no placeholder KPIs until the endpoint is real.

## Config

Set `VITE_API_URL` (see `.env.example`). `pnpm dev` (port 5174),
`pnpm build`, `pnpm check-types`.
