# Probe questions

## Contents
- Onion slot probes
- Coverage category probes
- Domain-specific slot hints

Use these when a slot or category is hard to fill. They are prompts for your own
thinking first; only some of them are worth putting to the user directly.

---

## Onion slot probes

**Normal Operator** — Who touches this daily? Are there operator types with
genuinely different needs, or is "user" hiding three roles? Does anyone outside
the organisation operate it (customer, patient, supplier, member of the public)?

**Operational Support** — When an operator is stuck at 4pm, who do they contact?
Who trains new operators? Who resets a password, resends a link, fixes a
mistyped record? These are usually real jobs that need real screens.

**Maintenance Operator** — Who creates and deactivates accounts? Who assigns
roles? Who runs backups, and who has ever tested a restore? Who applies the
retention and deletion schedule? Who upgrades it? Who holds the credentials?
Note that offboarding is a distinct requirement from deletion: when a person
leaves, their access ends but their historical records usually must remain.

**Interfacing systems** — Where does this data live today? What system already
holds the authoritative version of any identifier this system stores? What must
this send onward, in whose format, on what schedule? Is there a national,
regulatory, or head-office return that has to be produced?

**Functional Beneficiary** — Who is better off, and how would they notice? Are
there beneficiaries who never touch the system? Are there future beneficiaries
(later cohorts, later customers) whose interests shape what must be recorded now?

**Purchaser** — Who pays for it, and what do they need to see to keep paying?
Is there a budget cycle or approval that constrains scope or timing?

**Political Beneficiary** — Whose standing improves if this works? What are they
going to want to show someone, and in what format? External reporting obligations
often hide here.

**Regulator** — Which regimes apply to this data and this activity? Who can
compel a change or stop the system? Does any automated calculation, scoring, or
recommendation change the system's regulatory classification? Is there an ethics,
approval, or certification route before go-live?

**Negative Stakeholder** — Who is worse off if this succeeds? Who currently owns
the process being replaced? Whose performance becomes visible? Who would want
this data, and what would they do with it? Each answer generates requirements:
migration, fairness and context in comparisons, threat model, access controls.

**Sponsor / Champion** — Who asked for this, and what outcome are they personally
accountable for? What happens to the project if they leave?

**Developer / Maintainer** — Who maintains this in a year? Is that a named team
or one person? What happens when they move on? This drives documentation,
handover, and bus-factor requirements that are invisible at build time and
decisive afterwards.

---

## Coverage category probes

**Functional scope** — What is explicitly NOT being built? An unstated
out-of-scope list is where scope creep comes from. What is v1 vs later?

**Domain model** — What are the entities, and what is each one's lifecycle from
creation to archive? Which relationships are one-to-many vs many-to-many? What
uniquely identifies each entity, and is that identifier stable?

**Derived vs entered** — Which listed fields determine each other? For each pair,
which is the input and which is computed? Storing both sides invites contradictory
data. Where a value is computed, what is the exact rule and where is it sourced
from? Never invent a threshold, band, or mapping.

**Roles and permissions** — What is the full role list, including administrative
ones? What can each role see and change? How does someone get a role, and how is
it removed? Is there an emergency access path, and if so how is it logged and
reviewed? Are permissions reviewed periodically, and by whom?

**Data lifecycle** — How long is each class of data kept, and on whose authority?
What triggers deletion, and is it deletion or anonymisation? Can a subject
request their data or its removal, and what is the process and time limit? What
export formats are needed, by whom, and does export need approval?

**Identity and auth** — How does each actor prove who they are, including any
actor outside the organisation? What is the session and credential policy? For
any tokenised or link-based access: who issues, who revokes, when does it expire,
what happens if it is forwarded to the wrong person?

**Audit** — What events are recorded? Specifically, are reads recorded or only
writes? Who reviews the log, how often, and what are they looking for? What
happens when the review finds something? An unreviewed log is not a control.

**Regulatory** — Which specific regimes apply? What assessment or approval is
required before go-live, and who signs it? Where must the data physically reside?
Are there sector-specific standards or certifications?

**Failure modes** — What happens when an integration is down, an import is
malformed, or a required field is missing at the moment of entry? Is degraded
operation acceptable, or must the system stop? What is the recovery objective —
how much data can be lost, and how long can it be down?

**Integration and migration** — What existing data must come in, in what shape,
and how is it reconciled? Is there a period where both old and new run together?
Who validates the migration, and what does "correct" mean?

**Observability** — How does anyone know it is working? What is monitored, who
is alerted, and to what? What operational reports does the running system need
about itself — incomplete records, failed imports, overdue actions?

**Ownership and handover** — Who owns it after delivery? What documentation must
exist for someone new to take over? What access and credentials transfer, and how?

---

## Domain-specific slot hints

These are patterns, not rules. Use them to spot a likely slot occupant faster,
then confirm rather than assume.

**Regulated data** (health, finance, education, children) — the Regulator slot is
never empty, and there is usually a named accountable individual inside the
organisation as well as an external body. A pre-go-live impact assessment is
common. Automated scoring or recommendation may change classification.

**Registry, audit, or benchmarking systems** — the Negative Stakeholder slot is
never empty: someone's numbers are being compared. Expect requirements about
context, case-mix, and who may see whose results.

**Anything replacing a spreadsheet** — the current spreadsheet owner is both a
Negative Stakeholder and the best source of undocumented rules. Migration is in
scope whether or not the document says so.

**Systems with an external, non-staff actor** (customer, patient, applicant) —
that actor needs its own identity story, its own support path when the link
fails, and usually its own consent record.

**Internal tools built by one person** — the Developer / Maintainer slot is the
project's main risk. Handover requirements belong in v1, not later.
