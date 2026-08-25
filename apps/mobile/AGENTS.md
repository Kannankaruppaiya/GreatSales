# AGENTS.md — `apps/mobile` (GreatSales Expo app)

The repo-wide contract is [`../../AGENTS.md`](../../AGENTS.md); it governs, and this file
does not repeat it.

## Read the docs for the SDK this app is on

**Expo SDK 54** — `package.json` declares `expo: ~54.0.0`.

https://docs.expo.dev/versions/v54.0.0/

Keep this link in step with `package.json` whenever the SDK moves.

## Status: this is a UI prototype, not an application

Read this before planning any work here. All nine Expo Router screens read
`src/gs/mock.ts` through an in-memory store. There is **no API client, no auth, and no
network layer at all** — nothing in this app has ever talked to the GreatSales API.

So a change here does not make a feature work end to end, and no roadmap slice can claim
mobile coverage until that changes.

The scope decision — ship mobile properly, or cut it from v1 and stop implying it exists —
is recorded as still open in
[`../../checklists/05-MOBILE.md`](../../checklists/05-MOBILE.md), along with what "ship it
properly" would require. Two items there are worth knowing before writing any code:

- **Tokens go in the OS secure store** (Keychain / Keystore), never `AsyncStorage`.
- **A production build must point at the production API** — no localhost, no tunnel.

## Local check

`pnpm --filter mobile check-types` runs `tsc --noEmit`. It fails on a machine where this
workspace's dependencies were never installed (no local `typescript` binary) — that is an
install problem, not a code problem. It passes on a clean install, and CI runs it.
