---
name: greatsales-check
description: Use when asked what exists in this application, whether a feature is wired, or to verify the app end to end — "how many pages", "is X wired", "check everything", "verify", "ellam wire aaguma". Answers from generated reports instead of re-reading the repository.
---

# GreatSales — check what exists and whether it works

Every fact about this application is derived from the code by a script. Run the
script. Do **not** re-read controllers, seed files, `.env` or the router to
answer a question these already answer — that rediscovery is the thing this
skill exists to prevent.

## Answering a question about the app

```bash
pnpm facts
```

Feature-by-feature matrix (page · route · mobile screen · endpoints wired ·
tests · roles) plus totals and the environment: ports, tenant, demo login, seed
and verify commands. `pnpm facts --json` for a machine-readable form.

That covers: how many pages/features/screens/endpoints, which roles reach a
surface, which features have no tests, which endpoints no client calls.

For "what is missing on mobile?" / "web la irukka feature mobile la illa":

```bash
pnpm parity
```

Per feature, the endpoints web calls that mobile does not, plus any mobile query
hook nothing outside `gs/queries` imports — the case `pnpm wiring` scores as
wired because the hook exists while no screen calls it.

## Verifying the app actually runs

Only when asked to check, verify, or prove something works — in this order:

1. `docker compose up -d` — Postgres on the port `pnpm facts` reports.
2. Start the servers through the Browser pane (`.claude/launch.json` defines
   `api` and `web`). Never run a dev server with Bash.
3. `pnpm smoke` — logs in and GETs every feature's read endpoint. It names the
   fix itself when the API is down or the database holds the wrong dataset.
4. `pnpm wiring` — static frontend↔backend endpoint diff, no server needed.
5. `pnpm verify` — smoke plus both test suites in one command.

Report the real output. A claim that something works without one of these
behind it is not evidence.

## Two traps

- **The API e2e suite reseeds the shared Postgres** and wipes the Promech
  dataset. After running it, re-seed with the command `pnpm facts` prints.
- **The repository's markdown files are not status.** Checklists and roadmaps
  record intent; only the generated reports above record what is true.
