# Design — [Feature / Product Name]

> Companion to the requirements doc. This covers *how* it works: data, flows, states, and the decisions a builder would otherwise have to invent. Kiro reads this alongside requirements to generate tasks.

## 1. Overview

[2–3 sentences on the shape of the solution. The mental model someone needs before reading the rest.]

## 2. Data model

The core entities and their relationships. Keep it concrete.

| Entity | Key fields | Notes / relationships |
| --- | --- | --- |
| [Entity] | [field: type, field: type] | [belongs to / has many / etc.] |
| [Entity] | [...] | [...] |

[If helpful, a one-line description of each relationship: "A [X] has many [Y]; a [Y] belongs to one [X]."]

## 3. Roles & permissions

| Role | Can do | Cannot do |
| --- | --- | --- |
| [role] | [...] | [...] |

[Omit this section if the product is single-user with no auth.]

## 4. Primary user flow

The main path, step by step. This is the happy path the build must nail first.

1. [User does X] → [system responds with Y]
2. [...]
3. [...]

## 5. States to handle

Don't let the build forget these. For each major screen/surface:

- **Empty state:** [what the user sees before any data exists.]
- **Loading state:** [what's shown while waiting.]
- **Error state:** [what happens when something fails — and how the user recovers.]
- **First-run / onboarding:** [the very first experience, if different.]

## 6. Key decisions & tradeoffs

Document the calls so they aren't silently re-litigated mid-build.

- **Decision:** [what was decided]. **Why:** [rationale]. **Tradeoff:** [what we gave up].
- **Decision:** [...]. **Why:** [...]. **Tradeoff:** [...].

## 7. Edge cases & error handling

- [Edge case] → [intended behavior].
- [Concurrency / empty input / oversized input / network failure as relevant] → [behavior].

## 8. Multi-perspective review notes

*(Pax fills this in after the three-lens pass. Surfaces only issues that change the build.)*

- **UX:** [finding or "clean — primary flow is unambiguous."]
- **Technical:** [finding or "no hidden complexity flagged."]
- **Executive:** [finding or "scope proves the metric at minimum cost."]
