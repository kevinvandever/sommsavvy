# Requirements — [Feature / Product Name]

> Source spec authored by Pax (PM persona). This document is the source of truth for *what* gets built and *why*. The design doc covers *how*. Kiro generates tasks from these two.

## 1. Problem & context

**The problem:** [One or two sentences. The real user pain, not the feature.]

**Who has it:** [Primary user. Be specific — role, situation, what they're trying to get done.]

**Why now:** [What makes this worth building. The trigger or opportunity.]

## 2. Goals & success

**North-star metric:** [The single number that tells us this worked.]

**Secondary signals:** [1–3 supporting indicators, optional.]

**Non-goals:** [What this explicitly does NOT try to do. Protects scope.]

## 3. Scope

| In v1 | Not now (deferred) |
| --- | --- |
| [capability] | [capability] — *why deferred* |
| [capability] | [capability] — *why deferred* |

## 4. User stories & acceptance criteria

Each story uses the form: *As a [user], I want [capability], so that [outcome].*
Acceptance criteria use **WHEN / THEN / SHALL** so they are directly testable.

### Story 1 — [short name]
**As a** [user], **I want** [capability], **so that** [outcome].

**Acceptance criteria:**
- WHEN [trigger/condition] THEN the system SHALL [observable behavior].
- WHEN [trigger/condition] THEN the system SHALL [observable behavior].
- IF [edge case] THEN the system SHALL [handling].

### Story 2 — [short name]
**As a** [user], **I want** [capability], **so that** [outcome].

**Acceptance criteria:**
- WHEN [...] THEN the system SHALL [...].

> Repeat per story. Keep stories small enough that each maps to a clear slice of work.

## 5. Constraints & assumptions

- **Stack / platform:** [known constraints — e.g. must run on X, integrate with Y.]
- **Riskiest assumption:** [the thing that, if wrong, breaks the plan.]
- **Out-of-scope dependencies:** [anything this relies on that someone else owns.]

## 6. Open questions

- [ ] [Anything genuinely unresolved. Empty is good — means the spec is ready.]
