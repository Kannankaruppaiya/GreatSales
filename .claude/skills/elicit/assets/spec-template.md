# Spec: <system name>

Source: docs/specs/<slug>/intent.md

## Domain model
<Entities, their fields, and their lifecycle. Mark identifiers. Mark which
entities hold sensitive or regulated data and note how they are separated.>

## Derived values
<Anything computed rather than entered. Each row needs an exact rule and a
source. If a rule is not sourced, mark it NEEDS CLARIFICATION rather than
inventing a plausible one — a guessed threshold is indistinguishable from a
decided one once it is built on.>

| Value | Derived from | Rule | Source |
|---|---|---|---|
| | | | |

## Roles and permissions
<Full role list including administrative roles. What each can read and write,
how roles are granted and removed, and any emergency access path.>

| Role | Read | Write | Granted by |
|---|---|---|---|
| | | | |

## Interfaces
<Screens, APIs, imports, exports, and scheduled jobs. For each import, say
whether it writes directly or produces a draft for human confirmation.>

## Non-functional
<Retention, audit, availability, recovery objectives, data residency, and any
compliance regime. Only what is actually required — an aspirational number here
becomes a real cost later.>

## Out of scope
<Carried from intent.md, plus anything ruled out during design.>

## Open questions
<Every NEEDS CLARIFICATION marker in this document, collected. If this section
is non-empty, the spec is not ready to plan against.>

## Verification
<The observable end-to-end sequence that proves this works. Name the starting
state, the actions, and what someone would check to confirm success. A spec that
cannot say how you would know it worked has not finished describing what it is.>
