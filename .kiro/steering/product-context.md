---
inclusion: always
---

# Product Context — SommSavvy

Standing context for every spec written for this product. Pax (and any agent) inherits this on every run. Do not contradict it without flagging the conflict explicitly.

## What it is

SommSavvy is a pocket sommelier for wine, beer, and spirits. The user points a camera (or speaks, or types) at a menu, dish, or bottle and gets warm, contextual, editorial guidance. Everything the user saves feeds a personal taste profile that sharpens the next recommendation. Multimodal in, editorial out.

## The user — the silent tiebreaker

Every product decision serves the **engaged enthusiast**: someone who already cares what's in their glass, keeps a "cellar" even if it's six bottles in a kitchen rack, opens the app once or twice a week and never deletes it. When a decision is ambiguous, ask: *does this serve the engaged enthusiast on a Tuesday evening?*

Two accommodated-but-not-centered audiences: the **curious newcomer** (welcomed, softer voice, never dilute the product for them) and the **enthusiast performing as expert** (the denser register is for them — NOT for actual sommeliers, who we explicitly do not build for). These are accommodations, not targets.

## Voice & brand

Warm, confident, dry self-aware humor about wine snobbery. Editorial, not transactional. Takes the craft seriously without taking itself seriously. The "monocle aside" is a deliberate device — used sparingly (at most one or two across a set of recommendations, never all). **Hard voice rules: no exclamation points, no emoji, no em dashes.** Match `src/interfaces/@brand/voice.md` when it exists.

We positioned *against* rating culture (Vivino). A wine is read out in its own words, never reduced to a score. There is no numeric rating field — qualitative notes carry the signal.

## Depth preference — a respect dial, not an info dial

Three modes: beginner / enthusiast / **expert**. Default is **enthusiast**. Set once in the profile, not surfaced as a header pill in the main UI. Beginner softens jargon and uses analogies; expert pushes density (vintage, producer, soil, technical pairings). Same warm voice across all three. Its job is to make the user feel seen. Anonymous users always run at the enthusiast default — depth is a personalization, and personalization is a sign-in moment.

## The three pillars

1. **Pocket Somm** — show it what you're eating/drinking-with, get 3–4 recommendations with editorial "why it works" copy.
2. **Reverse Scan** — show it a bottle/label/shelf, get a single editorial card (what it is, what to expect, pairings, price-vs-value, Tuesday-vs-special-occasion).
3. **Cellar & Journal** — everything saved lives here; it's the only persistent user artifact in the MVP and the source of truth for the taste profile.

All three share one multimodal entry surface and one visual language. Same brand everywhere; only content differs.

## Load-bearing constraints (don't quietly violate these)

- **The cellar is the only persistent artifact in the MVP.** Unsaved recommendations/scans are ephemeral, frontend-state only. Session history is roadmap, not MVP.
- **Anonymous use is first-class** for Pocket Somm and Reverse Scan. Sign-in is triggered only by saving, noting, or building a taste profile. Auth is **email-code only** — no SMS, no passwords, no social, no roles in the MVP.
- **The taste profile is the differentiator.** A single `tasteSummary` field, regenerated from the cellar (most recent ~50 entries, **tasted entries only**). Passed as soft context to recommendations — informs, never overrides the user's actual request.
- **`tasted` vs `owned` are independent axes.** Only `tasted` shapes the taste profile; `owned` drives inventory features. Toggling `owned` must never trigger a taste regen. Legacy null is treated as tasted=true / owned=false.
- Data model is intentionally small: `users` + `cellar_entries`. Resist adding tables or fields without a strong reason.

## Explicitly out of scope for the MVP (all roadmap)

Cocktail recipes / home-bar planning, multi-course pairing planner, restaurant wine-list value-scanning, social sharing, travel guides, live tastings, recommendation history, cellar export, push notifications, native iOS/Android. If a feature request lands here, name it as roadmap and confirm before specifying.

## Migration context — READ THIS FIRST

SommSavvy is **being ported from a Remy/MindStudio app into a fully Kiro-developed app.** This is a migration, not a greenfield build, and that distinction governs how every spec should be written.

**What is the source of truth vs. what is up for grabs:**

- **Behavior is preserved. Architecture is re-decided.** The existing Remy spec (the document this context was distilled from) defines *what SommSavvy does* — the pillars, the voice, the taste profile, the auth model, the data shape, the depth dial. That behavioral contract carries over and should be honored. But *how* it's implemented is now an open Kiro decision, not a given.
- **Treat MindStudio constructs as requirements to re-home, not patterns to copy.** The original spec is full of MindStudio-specific machinery: `mindstudio.runTask()`, `generateText()`, `transcribeAudio()`, MSFM annotations, scenario seeding, the spec→backend→interface compile model, the `@mindstudio-ai/agent` / `interface` SDKs. **None of that is preserved in the port.** Each one names a *capability the new build must provide*, and Pax's job is to spec that capability in stack-neutral terms so the Kiro build can implement it however it implements things.
  - e.g. `mindstudio.runTask()` with structured output → "an AI orchestration call that takes the multimodal input + taste context and returns structured recommendations"; the new stack picks the model, the SDK, and the streaming mechanism.
  - e.g. scenario seeding (`enthusiast-with-cellar`, etc.) → "seed/fixture data for each demo state"; how Kiro seeds is its call.
  - e.g. MSFM inline annotations → just prose requirements now.
- **Flag migration seams explicitly.** When a feature spec touches something the old app got "for free" from the MindStudio platform — managed auth code delivery, the platform-managed `email` column, managed DB, fire-and-forget background tasks, image generation — Pax must call it out as a **"platform capability to replace"** and note that the new Kiro build needs an explicit decision for it (which auth provider, which DB, which job runner, which image model). These are the highest-risk parts of the port; surface them, don't assume they're handled.

**Bottom line for Pax:** write specs in clean, stack-neutral Kiro-native requirements/design form. Preserve the behavioral contract from the original spec faithfully. Never carry MindStudio API names, SDKs, or compile-model assumptions into the new specs as if they're constraints — translate every one into a plain capability the Kiro build is free to satisfy its own way.

## Roadmap location & the existing Remy roadmap

- **The existing Remy roadmap files in `src/roadmap/` are read-only reference.** They describe what was planned and built under Remy/MindStudio. Treat them as source material for understanding the product's intended shape — like the original spec. Do not rewrite, overwrite, or delete them.
- **Pax's living roadmap lives at `src/roadmap/kiro-roadmap.md`.** This is the forward-looking migration map Pax owns and updates — what gets ported to Kiro, in what dependency order, and what each feature unblocks. It is deliberately separate from the Remy files so "what we're porting from" stays legible against "what we're building toward."
- On the first roadmap run, create `src/roadmap/kiro-roadmap.md` from the roadmap template, seeding it from the behavioral contract and the existing Remy roadmap. On every subsequent run, read and update that file — never start a new one.
