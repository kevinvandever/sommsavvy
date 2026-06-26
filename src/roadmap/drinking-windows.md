---
name: Drinking Windows
status: planned
effort: medium
description: AI-powered aging intel on every bottle you own — know when each one is at its peak, and get a quiet warning when you have already waited too long.
---

A cellar is only useful if you know when to open what is in it. Drinking Windows adds a layer of aging intelligence to every owned bottle — not a database lookup, but a contextual read on the specific producer, vintage, and region. The inventory becomes a living guide to what to open tonight versus what to hold.

## What it looks like

- Each owned cellar entry gains a "Drinking Window" note in the detail view: a single editorial sentence. "Drink between 2026 and 2031. Probably fine now, better in two years." Or: "This has been ready for a while. It is not getting better."
- The "In the rack" filter view gains a secondary sort: "Open Soon" — owned bottles currently inside their drinking window or entering it within the next twelve months.
- A small summary header when Open Soon is active: "Three bottles worth opening this year."
- For bottles well past their window: "Past its peak. Drink up." Honest. No softening.

## Key details

- Drinking Windows operates exclusively on owned=true entries. Windows for tasted-only bottles (things already consumed) are neither generated nor displayed. This is foundational: a drinking window for a bottle you have already finished is useless.
- Depends on the Tasted & Owned data model. Must ship after that foundation is live and ownership data has been accruing.
- **Sequencing rationale:** this feature was originally positioned first in the post-MVP queue. The Tasted & Owned insight moved it to fourth. Had it shipped first, it would have launched against empty owned-bottle data — nobody had the ownership toggle yet, so nobody had marked anything as held. Building Cellar Intelligence and Opening Notes first means weeks of passive ownership data accumulate in the background. Drinking Windows launches populated, not empty.
- Wines get the most meaningful windows. Most beers and spirits return "Drink now" by default, with exceptions for barrel-aged beers, vintage ports, Armagnac, and aged rum.
- When the system genuinely cannot make a confident call — unusual producers, obscure grapes, limited vintage data — it says so plainly: "This one is harder to call. I would ask the producer."
- The voice stays editorial throughout. No clinical "PEAK: 2024–2027" boxes.

~~~
Depends on: Tasted & Owned (cellar_entries.owned field must exist). The "Open Soon" filter passes owned=true to listCellar in addition to the window date evaluation.

New fields on cellar_entries: drinkingWindowNote (text), drinkingWindowUpdatedAt (number). New background method: generateDrinkingWindow({ entryId }) — validates that the entry has owned=true before running; returns early if not. Uses mindstudio.generateText() with bottle name, producer, vintage, and region as context, with a searchGoogle call when more data would improve confidence. Runs lazily when getEntry is called for an owned entry and the window field is null or stale (>30 days old). The "Open Soon" display is derived from the drinkingWindowNote text — the generation prompt instructs the model to include a machine-readable date range marker (e.g. WINDOW:2025-2028) alongside the editorial sentence so the filter can evaluate it without re-parsing prose. Window generation is queued, not blocking — the detail view shows "Calculating window" in Bone while it runs.
~~~
