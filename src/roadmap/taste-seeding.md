---
name: Taste Seeding
status: done
effort: small
description: A single welcome prompt that bootstraps your taste profile before a single bottle has been saved — so the first recommendation is already pointed at you.
---

The cold start is the one moment SommSavvy is weakest. The user has signed in (or hasn't), the cellar is empty, and the first Pocket Somm recommendation is necessarily generic. Taste Seeding fixes the cold start without a questionnaire — one open prompt, your words, and the profile is already running from your first scan.

## What shipped

- A quiet italic affordance on the third welcome slide: *"Tell me about your taste first."* Tap to expand inline into a textarea with the helper caption *"Optional. I will weave this into how I read you from your first scan."* The default path (tap CTA, go to camera) is unchanged — most users skip; the affordance is there for users who want to seed.
- Anonymous-user handoff: if the user is not signed in yet (most common case on first launch), the typed seed is stashed in localStorage under `somm-taste-seed-pending` and applied to the user's profile after the next auth resolves. App.tsx guards against overwriting an existing seed from another device.
- The seed is editable forever from the Profile page's new "In your own words" section. Saves on blur. Never overwritten by entries.
- The taste profile empty state is rewritten in voice: *"I am still getting to know you. Save a few bottles and patterns start to emerge. The note below seeds the rest."*

## How the seed shapes the profile

The seed and the cellar entries are two foundational sources of taste signal. The regeneration pipeline (`runTasteSummaryRegen`) reads both:

- **Seed alone (cold-start):** The seed becomes the basis of the summary; the model rewrites it in editorial voice. Profile generates meaningfully from day one — no entries required.
- **Entries alone (no seed):** Existing behavior — summary derived from cellar.
- **Seed + entries:** Both are merged with explicit guidance to reconcile contradictions in voice. *"The palate is less purist than the initial 'skip Chardonnay' stance implies"* is the kind of editorial reconciliation this enables.

The seed persists as a foundational signal forever. It is never silently overwritten or phased out — the user's own words shape the profile as long as they want them to.

~~~
Schema: users.tasteSeed (string, optional, ≤1500 chars). Backend: updateProfile accepts tasteSeed and fires runTasteSummaryRegen fire-and-forget when set. Frontend: Welcome.tsx slide 3 has an inline expand/textarea; PENDING_TASTE_SEED_KEY = 'somm-taste-seed-pending' carries the value through anonymous → authenticated handoff in App.tsx. Profile.tsx renders an editable textarea that saves on blur (only when value actually changed). No new methods. No origin field. Seed is a separate column from tasteSummary so it can coexist with derived signal forever.
~~~

## History

- **2026-05-17** — Built. Inline welcome affordance, anonymous-user localStorage handoff, profile-page editable seed, regen pipeline reads seed as foundational context. Approach diverged from the original spec (separate post-auth screen, dedicated method, origin field) in favor of a simpler design where the seed is just another foundational signal that persists alongside cellar-derived signals.
