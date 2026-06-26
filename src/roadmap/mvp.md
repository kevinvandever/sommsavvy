---
name: SommSavvy MVP
status: done
effort: large
description: Pocket sommelier for wine, beer, and spirits — multimodal recommendations, bottle identification, and a personal cellar that learns your taste.
---

The foundation. Three pillars in one app: a Pocket Somm that reads your context and recommends what to drink, a Reverse Scan that identifies any bottle, and a personal Cellar that gets sharper as it grows. Multimodal entry (photo, voice, text) across all three. Anonymous use is fully supported — auth gates cellar saves only. The depth preference (beginner, enthusiast, expert) defaults to enthusiast and lives in the profile, where it belongs: a personalization that requires sign-in, like everything that makes the experience yours.

## What it looks like

- **The Camera Home.** The front door. A dark, candlelit viewfinder fills the viewport. Two modes: Pocket Somm and Reverse Scan. Photo, voice, or text for both.
- **Pocket Somm results.** Three or four editorial recommendation cards, each with a chiaroscuro bottle portrait, a "why this works" paragraph in the depth-appropriate voice, and a one-tap save. The monocle aside appears on at most one or two cards.
- **The Scanning Moment.** Reverse Scan's signature: the photo holds, dims, an Ember-glow line traces the label, status lines stream below. The result card slides up as a sheet on top of the bottle photo.
- **Reverse Scan card.** Single magazine-spread card: bottle identity, what to expect, pairings, value note, and occasion read.
- **The Cellar Mosaic.** An asymmetric editorial grid of every saved bottle. Recent additions and five-rated entries get larger tiles. Searchable, filterable by kind, sorted by saved or tasted date.
- **The Taste Profile.** A 2-3 sentence natural-language portrait of the user's preferences, automatically regenerated as the cellar grows. Passed as soft context into every future recommendation.
- **Auth flow.** Email-code only. Woven into the save interaction — not a separate gate. "Let's start your cellar." → six digit boxes → "Lovely choice."

## Key details

- Three seed scenarios ship on day one: empty anonymous state, a full enthusiast cellar (Sloane, 18 entries), and a beginner account (Theo, 3 entries).
- The taste profile only generates with 3+ entries. Below that, recommendations are good but generic.
- Anonymous sessions are ephemeral. Only signed-in users build a lasting profile.
- Depth preference is persisted to the account for signed-in users; anonymous users always run at the enthusiast default.
- Day mode (Parchment palette) is available behind a settings toggle.

~~~
Three AI-powered backend methods: pocketSomm (task agent with analyzeImage, searchGoogle, generateImage tools; returns structured recommendations array plus chiaroscuro portrait per item), reverseScan (same tooling, single-card output), and regenerateTasteSummary (background method, fire-and-forget from save/update/delete, reads last 50 entries). Frontend: React + Vite + TypeScript, mobile-first, motion/react for sheet transitions, Zustand for global state, wouter for routing. All cellar data loaded once on app start.
~~~

## History

### Done — May 8, 2026

Shipped in full. All three pillars working end-to-end: Pocket Somm returns editorial recommendation cards with chiaroscuro portraits and depth-aware copy, Reverse Scan runs the signature scanning moment with the Ember-glow label trace, and the Cellar mosaic displays Sloane's 18-entry enthusiast collection at remy@mindstudio.ai. The brand is fully realized: After Hours dark canvas, Ember accents, Rowan and Geist typography throughout, chiaroscuro bottle photography, the photo-becomes-hero layoutId morph on result card entry, the breathing pilot-light shutter animation, the candle voice overlay with amplitude-responsive flame, and the Verde "Lovely choice" transformation on auth success. Auth flow (email-code, anonymous-to-saved transition, six-digit boxes, post-verification save resume) works cleanly. Depth preference lives in the profile — defaulting to enthusiast, requiring sign-in to change. Day mode toggle functional. All three seed scenarios seeded and verified.
