---
name: Live Tastings
status: planned
effort: large
description: Audio-narrated pour-along experiences — scan any bottle for a tasting guide specific to that producer and vintage, or follow a curated flight any evening.
---

The on-the-fly mode is the reason this exists: scan any bottle and the app generates a narrated tasting guide built around that exact producer and vintage — what to look for in the glass, how this expression compares to the house style, when to drink it and with what. Then there is the curated library: guided pour-along flights on sessions that assume you already know the basics and want to go somewhere specific. A hosted tasting in your living room, any evening, no reservation required.

## What it looks like

- **On the fly.** From any Reverse Scan result, a new option: "Narrated tasting." The app generates a 10-15 minute audio guide specific to that producer, vintage, and style. The narration begins at the pour and walks through color, nose, palate, and finish — with context on what makes this particular bottle worth paying attention to.
- **Curated sessions.** A library of scripted pour-along flights: "Ardbeg, Lagavulin, Laphroaig: Three Readings of the Same Island," "Burgundy Premier Cru vs. Village: What the Label Doesn't Tell You," "The Saison at its Source: Wallonia to Brooklyn," "Armagnac vs. Cognac: Why the Obscure One Often Wins," "Natural Wine Without the Dogma: What the Movement Actually Got Right." These sessions assume you know what the category is. They take you somewhere inside it.
- Each session specifies the bottles to source — typically two to four — with alternatives at different price points for each.
- The experience is audio-led. Narration pauses at natural moments; a gentle visual breath indicates the user should taste. "Take your time."
- During pauses, a note-capture input appears. Optional — the app never demands reaction, only invites it.
- At the end, all tasted bottles can be saved to the cellar in one tap, with session notes attached.

## Key details

- Audio is AI-generated in the SommSavvy voice: warm, precise, unhurried, with the monocle pattern used sparingly and earned.
- Curated sessions are produced content — scripted and reviewed before publication. The on-the-fly mode is fully generated at runtime from the scan result.
- Pacing is generous. A standard session runs 15 to 25 minutes. The product earns the user's time or it does not deserve it.
- Sessions can be paused and resumed. Progress is saved.
- Available for wine, beer, and spirits. The on-the-fly mode works for any bottle the app can identify.
- The curated sessions library grows slowly, with quality as the only constraint.

~~~
New table: tasting_sessions with title, category, description, scriptJson (array of { segmentId, audioUrl, pauseAfter: boolean, notePrompt?: string }), requiredBottles (JSON array of { label, alternatives: Recommendation[] }), heroImageUrl, publishedAt. Session audio is generated from script text using a text-to-speech capability and stored as CDN-hosted audio segments. New table: user_session_progress with userId, sessionId, currentSegmentId, notes (JSON keyed by segmentId), completedAt. The frontend renders a full-screen "tasting mode" — the bottle's chiaroscuro portrait, audio controls, a progress indicator, and a note input that appears at pause points. The on-the-fly mode uses the reverseScan output as the basis for a generateTastingScript({ scanResult }) method that produces a narration script and then generates the audio segments on demand. Script generation runs as a background task; the user sees a "Preparing your tasting" loading state before audio begins.
~~~
