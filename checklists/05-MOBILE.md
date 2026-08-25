# E. Mobile — Expo App — Production Checklist

> **apps/mobile · React Native + Expo Router**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 26

**Gate:** SCOPE DECISION REQUIRED before this layer can be planned — see the top of the file.

**Depends on:** [C. API](03-API.md).

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

> 🔴 **Verified 2026-08-25: the mobile app has NO API client.** Every screen reads
> `src/gs/mock.ts` through an in-memory store. There is no auth, no network layer, no
> persistence. It is a UI prototype, not an application.
>
> **A decision is required before this section can be planned:**
> `[ ]` **Ship mobile in v1** (then everything below is in scope) ·
> `[ ]` **Cut mobile from v1** (mark this whole section `[-]`, remove it from the release, and
> make sure no store listing or customer promise implies it exists).

**Decision:** _______________ **Decided by:** _______________ **Date:** __________

## E.1 Make it a real app (blocking prerequisites)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| E.1.1 | An API client exists, pointed at the real API, with the same auth contract as web | `[ ]` | |
| E.1.2 | Real login/logout against `/auth/*`, including refresh | `[ ]` | |
| E.1.3 | 🔴 Tokens stored in the OS secure store (Keychain/Keystore) — **never `AsyncStorage`** | `[ ]` | |
| E.1.4 | Every screen reads live data; `src/gs/mock.ts` deleted from the production path | `[ ]` | |
| E.1.5 | Server-driven permissions honoured; the mobile UI cannot show a sales user another rep's data | `[ ]` | |
| E.1.6 | Error, empty, loading, and permission-denied states on all 9 screens | `[ ]` | |

## E.2 Mobile production build

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| E.2.1 | EAS build profiles for `production` exist and are distinct from dev/staging | `[ ]` | |
| E.2.2 | Production build points at the production API — no localhost, no tunnel, no ngrok | `[ ]` | |
| E.2.3 | App signing: iOS certificates/provisioning and Android keystore stored securely with a documented recovery path | `[ ]` | |
| E.2.4 | Bundle identifiers, app name, version, and build number set for production | `[ ]` | |
| E.2.5 | Icons and splash screens at every required density | `[ ]` | |
| E.2.6 | `expo-updates` / OTA channel strategy defined: what may ship OTA vs. what needs a store release | `[ ]` | |
| E.2.7 | Minimum supported OS versions declared and tested | `[ ]` | |
| E.2.8 | Release build tested on a **physical** device of each platform, not only a simulator | `[ ]` | |
| E.2.9 | ProGuard/R8 and Hermes configured; release bundle size recorded | `[ ]` | |
| E.2.10 | Crash reporting wired into the release build (source maps uploaded) | `[ ]` | |

## E.3 Mobile behaviour

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| E.3.1 | Offline behaviour defined: what is cached, what is queued, what is refused | `[ ]` | |
| E.3.2 | Poor-network behaviour: timeouts, retries, and a visible offline indicator | `[ ]` | |
| E.3.3 | Background/foreground transitions do not lose state or leak a stale session | `[ ]` | |
| E.3.4 | Deep links / universal links defined and tested (or explicitly not supported) | `[ ]` | |
| E.3.5 | Force-update mechanism exists for a breaking API change (ties to C.1.15) | `[ ]` | |
| E.3.6 | Battery/data usage sane — no aggressive polling | `[ ]` | |
| E.3.7 | Sensitive data not shown in the app switcher preview | `[ ]` | |
| E.3.8 | Screenshots/store listing/privacy nutrition labels prepared | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
