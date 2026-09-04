---
name: elicit
description: Turns a raw requirement document, brief, or feature request into a rigorous intent.md and spec.md by systematically hunting for what the source leaves out — missing actors, unowned constraints, and undecided decisions. Use whenever starting a new project or feature from a requirements doc, PRD, client brief, email, or meeting notes; whenever asked to write a spec, scope a build, or plan a new system; and before any significant greenfield implementation. Especially important when the request already looks clear enough to start building, because that is exactly when missing stakeholders and operational requirements slip through.
allowed-tools: Read Grep Glob AskUserQuestion Write
---

# Requirements elicitation

## Why this skill exists

You are good at reading a requirement document and reasoning about what it says.
You are measurably bad at noticing what it doesn't say.

The benchmark literature on conversational requirements elicitation (ReqElicitGym,
2026) found the best models surface under half of a user's implicit requirements,
and named the reason: models overwhelmingly favour **probing** — deepening what is
already stated — over **clarification** — finding what is absent. Probing feels
productive. It produces sharp, specific, impressive questions. And it will walk
you straight past the fact that nobody has said who administers the system.

That's the failure this skill exists to prevent. It isn't a knowledge gap, so
reading more carefully won't fix it. Absence has no cue to notice. The only
reliable counter is enumeration: work a fixed list of slots and categories, and
force yourself to write something in every one. An empty row you have to fill is
the cue that absence doesn't otherwise provide.

So: resist the urge to start with insight. Start with the checklists. The insight
is much better on the far side of them.

## Before you start

Read the source document completely. If the user named a file, read that; if not,
ask what to read rather than working from the conversation alone — the point of
this exercise is comparing a written source against a fixed checklist.

Then write a short **inventory of what is stated**: the entities, fields, actors,
and rules the document actually contains. Keep it factual. This is your baseline
for the two scans — everything else you produce will be an absence relative to it.

Do not propose an architecture, a tech stack, or a data model yet. Those decisions
quietly assume answers to questions you haven't asked.

## Step 1 — Stakeholder onion

Ian Alexander's onion model (IEEE Software, 2003) exists because "missing
stakeholders result in missing requirements." Its value isn't the taxonomy, it's
the discipline: pre-defined slots you must fill, rather than a blank page you
brainstorm into.

Reproduce this table in your response and fill every row. Where you can't identify
someone, write `UNRESOLVED` — never leave a cell blank. A blank cell reads as
"none"; `UNRESOLVED` reads as "not yet investigated", which is what it actually
means, and it survives into the questions you ask the user.

| Slot | Who, in this system | Source |
|---|---|---|
| Normal Operator | | doc / inferred / UNRESOLVED |
| Operational Support | | |
| Maintenance Operator | | |
| Interfacing systems | | |
| Functional Beneficiary | | |
| Purchaser | | |
| Political Beneficiary | | |
| Regulator | | |
| Negative Stakeholder | | |
| Sponsor / Champion | | |
| Developer / Maintainer | | |

Three slots go missing far more often than the rest, so give them real thought
rather than a quick fill:

- **Maintenance Operator** — in any system that stores data, somebody creates and
  deactivates accounts, assigns roles, restores backups, and runs the retention
  schedule. Requirement documents are written by and for the people doing the
  domain work, so this role is almost never in them. Its absence is what produces
  systems with no admin surface at all.
- **Negative Stakeholder** — who is worse off if this succeeds? Whoever currently
  owns the spreadsheet, whoever the reporting makes look bad, and whoever attacks
  it. These generate real requirements: migration, fairness of comparison, threat
  model.
- **Developer / Maintainer** — who owns this after the person who commissioned it
  moves on? Answering this honestly generates documentation and handover
  requirements that otherwise surface only when it's too late.

`references/probes.md` has probe questions per slot when a row is hard to fill.

## Step 2 — Coverage scan

Same principle applied to the requirements themselves rather than the people.
Mark every category `Clear`, `Partial`, or `Missing` against the source, and name
the specific gap. Writing `Missing` is the point of the exercise — a scan that
comes back all-Clear means you scanned the document you wished you had.

| Category | Status | Gap |
|---|---|---|
| Functional scope, and explicit out-of-scope | | |
| Domain model: entities, attributes, lifecycle | | |
| Derived values vs entered values | | |
| Roles and permissions, and who administers them | | |
| Data lifecycle: retention, deletion, export | | |
| Identity and auth, including non-staff actors | | |
| Audit: what is recorded, and who reads it | | |
| Regulatory and compliance regime | | |
| Failure modes, recovery, and degraded operation | | |
| Integration and migration from what exists today | | |
| Observability and day-2 operations | | |
| Ownership and handover after delivery | | |

Two of these reward extra suspicion:

- **Derived vs entered** — when a document lists two fields that determine each
  other, storing both invites contradictory data. Say which is the input and which
  is computed, and make that a spec decision rather than an implementation
  accident.
- **Audit** — "log everything" is easy to write and means nothing on its own. A
  log nobody is assigned to read is not a control. Name the reader and the cadence,
  or record that as a gap.

`references/probes.md` expands each category into concrete questions.

## Step 3 — Ask, one question at a time

Turn the `UNRESOLVED` rows and `Missing` cells into questions, then order them by
blast radius: an answer that changes the data model outranks one that changes a
screen, because the first invalidates work already done and the second doesn't.

Ask with `AskUserQuestion`, one question per turn, folding each answer into your
notes before asking the next. Batching questions gets you shallower answers —
people answer the first properly and the rest in a rush — and it forfeits the
chance to let an answer reshape what you ask next.

Ask about five before writing. If more remain, write the documents with the rest
marked, and say plainly which decisions are still open.

Some questions aren't the user's to answer — a clinical threshold, a legal
retention period, a regulatory classification. Don't guess these and don't press
the user for them. Record the question, name who would know, and move on.

## Step 4 — Write the documents

Write `docs/specs/<slug>/intent.md` and `docs/specs/<slug>/spec.md` using the
templates in `assets/`. Read those before writing:

- `assets/intent-template.md` — problem, actors, success criteria, out of scope,
  and a constraints table where every constraint carries a named owner
- `assets/spec-template.md` — domain model, derived values, interfaces, and an
  end-to-end verification step

Two things carry most of the value:

**Every constraint gets an owner.** A constraint with no owner is a wish. The
intent template's governance table has an owner column for exactly this reason,
and filling it usually reveals a role nobody has assigned — which loops back to
the onion.

**Never substitute a plausible default for an answer you don't have.** Where a
value is genuinely undetermined, write it inline as:

```
[NEEDS CLARIFICATION: what is the retention period for archived cases?]
```

This matters more than it looks. A guessed default is indistinguishable from a
decided one three weeks later, and it will be built on. A marker stays visible and
stays cheap to resolve. A spec that still contains markers is not ready to plan
against — say so rather than proceeding.

**End the spec with a concrete verification step** — the observable sequence that
proves the thing works end to end. A spec that can't say how you'd know it worked
hasn't finished describing what it is.

## Step 5 — Absence pass

Before calling the spec done, dispatch a subagent with fresh context. This isn't
ceremony: you've been immersed in this document for the whole session, and by now
its shape feels complete to you. A reader who hasn't formed that impression will
see gaps you no longer can.

```
Read <spec.md>. You did not write it and have not seen the source document.

List every actor who must exist for this system to run in production but is not
named. List every stated constraint with no named owner. List every field that
appears to be both entered and derived.

Report absences only — not improvements, not style, not architecture opinions.
```

Fold real findings back into the documents, then report to the user: what you
wrote, which questions remain open, and who needs to answer each one.

## Output

- `docs/specs/<slug>/intent.md`
- `docs/specs/<slug>/spec.md`
- A short summary naming the open questions and their owners

Being visibly incomplete in a way that shows exactly what's missing is the goal
here. It beats being smoothly complete and quietly wrong.
