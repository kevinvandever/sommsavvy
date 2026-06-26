---
inclusion: always
---

# Product Context — [PROJECT NAME]

> This is the one file that's unique per project. It loads on **every** Pax run, so keep it lean — only the things that shape *every* future decision belong here. Fill in the blanks below, delete the guidance notes, and delete any section that doesn't apply.
>
> Fastest way to fill this in: hand Pax (or Claude) this project's existing spec, README, or codebase and ask it to distill a product-context. That's how the SommSavvy one was built.

## What it is

[One or two sentences. The product in plain language — what it does and the core user value. No marketing.]

## The user — the silent tiebreaker

[Who is the single user every decision serves? Be specific about their situation, not a demographic. When a decision is ambiguous, what question settles it? e.g. "does this serve [user] doing [thing] in [context]?"]

[Optional: any secondary audiences that are accommodated but NOT centered — and an explicit note that they don't get to dilute the product.]

## Voice & brand

[How does the product sound and feel? Any hard rules — words to avoid, tone, formatting constraints, things it positions against? If there's a voice doc in the codebase, point to it.]

## Core experiences / pillars

[The 2–4 things the product fundamentally does. One line each. This is the spine every feature hangs off.]

1. **[Pillar]** — [what it is]
2. **[Pillar]** — [what it is]
3. **[Pillar]** — [what it is]

## Load-bearing constraints (don't quietly violate these)

[The non-negotiables. Architectural commitments, data-model rules, auth decisions, things that are deliberately small or deliberately excluded. The stuff that, if a spec violates it, the spec is wrong. Be specific — these are the guardrails that make Pax's specs trustworthy.]

- [constraint]
- [constraint]
- [constraint]

## Explicitly out of scope (roadmap, not now)

[Deliberate exclusions. If a feature request lands here, Pax should name it as roadmap and confirm before specifying. Prevents scope creep.]

[list, or delete if not applicable]

## Platform / stack note

[What's the build target? Greenfield in [stack]? A migration from one stack to another? If it's a migration, say what's preserved (behavior) vs. re-decided (architecture), and name the platform capabilities the old stack provided that the new build must now supply explicitly. This section is where Pax learns how literally to take any existing spec. Delete if it's a straightforward greenfield build in a single known stack.]
