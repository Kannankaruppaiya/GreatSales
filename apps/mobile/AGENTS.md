# AGENTS.md — `apps/mobile` (GreatSales Expo app)

The repo-wide contract is [`../../AGENTS.md`](../../AGENTS.md); it governs, and this file
does not repeat it.

## Read the docs for the SDK this app is on

**Expo SDK 54** — `package.json` declares `expo: ~54.0.0`.

https://docs.expo.dev/versions/v54.0.0/

Keep this link in step with `package.json` whenever the SDK moves.

## Status: wired to the API, with two gaps named below

All ten Expo Router screens read the GreatSales API through `src/gs/api.ts` and the
hooks in `src/gs/queries/`. The `src/gs/mock.ts` in-memory store this file used to
describe is gone.

Things worth knowing before writing code here:

- **Lists are cursor-paginated through `useCursorList`** (`src/gs/queries/cursorList.ts`).
  Do not go back to a fixed `limit` — every list did that once, capped at 100 rows with
  the cursor discarded, and search filtered those 100 in JS. Filters belong in the query.
- **Screens that aggregate pass `autoFetchAll`** (kanban, report tabs, the follow-up
  buckets). Everything else follows the cursor on `onEndReached`.
- **Reference data comes from the API**, not `gs/domain.ts`. Principals are
  `/principals`, industries are `/industries`. `AREAS` is still a local constant —
  see the gap below.

Two gaps remain, and they are missing FEATURES rather than broken wiring:

- No order-create screen. Orders are created from the projections convert flow only.
- `AREAS` in `gs/domain.ts` is still a hardcoded list of Chennai localities, matching
  the web console's `INDUSTRIAL_AREAS`. There is no areas endpoint on either client.

Two items from [`../../checklists/05-MOBILE.md`](../../checklists/05-MOBILE.md) are still
open and worth knowing before writing any code:

- **Tokens go in the OS secure store** (Keychain / Keystore). `src/gs/api.ts` still
  persists the refresh token to `AsyncStorage`, which is readable on a rooted device.
- **A production build must point at the production API** — no localhost, no tunnel.

## Local check

`pnpm --filter mobile check-types` runs `tsc --noEmit`. It fails on a machine where this
workspace's dependencies were never installed (no local `typescript` binary) — that is an
install problem, not a code problem. It passes on a clean install, and CI runs it.

## Building an installable APK

Expo Go only ever proves the app on the phone that scanned the QR code — it does
not exercise the release bundle, the app icon, the launcher name, or the native
tab-bar insets. For anything device-shaped, build the APK:

```bash
pnpm apk        # works from the repo root or from apps/mobile
```

That is the `preview` profile in `eas.json`: an internal-distribution **APK**
(not an app bundle), installable on any Android phone without the Play Store.
EAS returns a download link when the build finishes. The `production` profile
builds the AAB that a Play Store upload needs.

Two things about this cost a failed run each to discover:

- **Call the CLI through `npx`.** This machine has two global `eas` binaries, and
  the one under `AppData\Roaming\npm` (16.28.0) comes first on PATH, ahead of the
  current 21.8.0 under nvm. A bare `eas` fails the `cli.version` constraint in
  `eas.json`; `npx eas` resolves to the newer one.
- **Both profiles pin `EXPO_PUBLIC_API_URL`.** A release build has no Metro host
  to infer the API from. `app.json`'s `extra.apiBaseUrl` is the fallback, but it
  is the field people edit for local work, so the build profile sets the real
  origin explicitly and wins.

The Expo project is `@kannankaruppaiya/greatsales`
(`d58801d6-32a3-4bf5-a4d4-3985f9859016`). The Android keystore lives in EAS and
is the same one Play Store updates will require — losing it means a new listing,
not a new upload.
