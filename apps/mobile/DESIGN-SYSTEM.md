# GreatSales Mobile — Design System & Auth Slice

This app was reset from the Expo starter to a **production-grade foundation**: a
tokenized design system, an accessible component library, and one fully-wired
workflow (authentication). Build every new screen on these pieces — do not
introduce ad-hoc colors, spacing, or one-off components.

## Architecture

```
src/
  theme/            design tokens + theme context
    tokens.ts         color (light/dark), typography, spacing, radii, elevation, motion
    theme-provider.tsx  <ThemeProvider> + useTheme()  (follows OS scheme)
    navigation.ts     bridges tokens → navigator chrome
  components/ui/     the component library (import from '@/components/ui')
    text, button, text-field, card, list-row, banner, badge,
    divider, icon, screen, skeleton, states (Loading/Empty/Error)
  lib/
    config.ts         EXPO_PUBLIC_API_URL, request timeout
    storage.ts        secure token storage (Keychain/Keystore; web fallback)
    api/              client (timeouts, error mapping, 401→refresh), auth-api, types, errors
    auth/auth-context.tsx  session state machine (boot / login / refresh / sign-out)
  app/              expo-router routes
    _layout.tsx       providers + bootstrap gate
    sign-in.tsx       login workflow (real, wired)
    (app)/            protected group (redirects if no session)
      _layout.tsx     tab shell (Home, Account)
      index.tsx       Home — real profile + honest "coming soon" modules
      account.tsx     Profile + confirmed sign-out
```

## Design tokens (the rules)

- **Color** — semantic only (`primary`, `surface`, `textSecondary`, `error`…),
  defined for light **and** dark. Status is never color-only: every status
  component pairs color with an icon and/or text. Body text targets ≥ 4.5:1.
- **Type** — one scale: `display, h1, h2, h3, bodyLg, body, bodySm, label,
  caption, button`. Font scaling is **on** (capped, never disabled).
- **Spacing** — 4pt scale (`xs=4 … 6xl=64`). No arbitrary margins.
- **Radii** — `sm/md/lg/xl/pill`. **Elevation** — 4 levels, restrained,
  platform-aware (dark leans on surface color, not shadows).
- **Touch targets** — ≥ 48dp Android / ~44pt iOS via `hitTarget`; visible
  control may be smaller, the hit area may not.
- **Motion** — short and purposeful; animations honor OS **Reduce Motion**.
- **Icons** — one family: Ionicons via `@/components/ui/icon`.

## Every data screen must handle its states

Use the shared views — never a blank screen or bare spinner:
`LoadingState`, `EmptyState`, `ErrorState` (with Retry). See Home/Account for
the loading → ready / error pattern, and `Banner` for inline, recoverable
messages.

## Auth slice (what's real)

`/auth/login → /auth/me`, tokens in the OS keychain, transparent
`/auth/refresh` on 401 (single-flight), and best-effort local sign-out. The
login screen covers the real failure paths: wrong credentials (401), offline,
timeout, and expired-session return — and never discards entered data.

> The API has no `/auth/logout` (stateless JWTs), so sign-out is a local clear.
> When a revocation endpoint lands, call it in `auth-context.ts` before clearing.

## Building the next screens (customers, leads, orders, …)

1. Add typed endpoints in `lib/api/` (reuse `apiFetch`, `auth: true`).
2. Compose from `@/components/ui` inside a `<Screen>`; wire Loading/Empty/Error.
3. Add authorization/role checks once the API enforces RBAC (see the
   repo-root production-readiness audit — RBAC is defined but not yet enforced).
4. Keep data honest: no placeholder numbers until the endpoint is real
   (Home currently shows modules as disabled "Soon", not faked metrics).

## Config

Set `EXPO_PUBLIC_API_URL` (see `.env.example`). Install the token store with
the SDK-matched version: `npx expo install expo-secure-store`.
