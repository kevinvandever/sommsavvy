---
name: List Intelligence
status: planned
effort: large
description: Photograph any restaurant wine list and instantly see the best-value picks at every price point — with honest notes on what to skip.
---

The most stressful three minutes at any nice restaurant is when the wine list arrives. List Intelligence is Pocket Somm applied to the whole room: photograph the list, get the four or five genuinely good picks at different price tiers, a note on what is overpriced for the appellation, and what the kitchen hid on page three. Never hold the list like a menu you are pretending to understand again.

## What it looks like

- A new entry point in Pocket Somm mode: "Scan a wine list." The user photographs one or more pages of the list.
- Multi-page capture: photograph as many pages as needed. The app stitches them together before analysis.
- The result is a curated set of four to six picks across price tiers — not every bottle annotated, just the ones worth knowing about:
  - **The smart move** (best value on the list)
  - **The interesting choice** (something less obvious)
  - **The safe bet** (reliable, crowd-pleasing, hard to get wrong)
  - **The splurge** (if the occasion calls for it)
- Each pick includes the list price, a single-sentence note ("Underpriced for the appellation by about $20"), and a brief reason.
- A "For this meal" follow-up: after scanning the list, describe what everyone is eating and get the top two picks from the curated set matched to the table's order.
- An honest bottom-line: "This list is mostly safe commodity bottles. The Burgundy section is where the character is."

## Key details

- The system flags value plays (known producers priced below market), obvious commodity markups, and hidden gems.
- It will tell the user when the list is genuinely mediocre and to consider the cocktails or the by-the-glass section instead. Honesty is the value.
- Works for beer and spirits lists, not just wine.
- List scans are saved as sessions (see Somm Sessions) but individual bottles from the picks can still be saved to the cellar.
- The picks respect the user's taste profile when signed in — a user who only drinks natural wine gets natural wine flagged when present.

~~~
List scan extends pocketSomm with a new mode: 'list'. The method accepts up to 6 image URLs. The task agent runs analyzeImage in sequence to extract all visible bottle names and prices, then cross-references market prices via searchGoogle for anomaly detection. System prompt instructs the agent to act as an experienced wine buyer identifying value, not as a critic scoring bottles. Output: { tiers: [{ tierLabel, pick: Recommendation, listPrice, valueNote }], bottomLine: string, avoidNote?: string }. A new somm_sessions record is created with mode: 'list-scan' and the picks stored in resultJson. The frontend adds a multi-frame capture UI to the camera home when list-scan mode is selected — a simple capture-and-stack flow that shows thumbnails of captured pages before analysis.
~~~
