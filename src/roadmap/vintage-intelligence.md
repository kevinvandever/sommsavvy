---
name: Vintage Oracle
status: planned
effort: medium
description: One editorial sentence on any vintage, for any region — the answer to the question every enthusiast has at the shelf.
---

The enthusiast standing at a wine shop or reading down a restaurant list has one urgent question: is this a good year? Vintage Oracle bakes the answer into every bottle the app touches — and makes it available as a standalone lookup for any moment the user is not scanning anything. Not a score out of 100. A sentence that tells you something real about what happened in that place, that year, and what it means for what's in the bottle.

## What it looks like

- Every Reverse Scan card gains a "Vintage" line below the bottle details — a single editorial sentence. "2020 was Barolo's hottest harvest in a decade. The Nebbiolo got structure and concentration; the patient growers made exceptional wine."
- A standalone "Vintage" lookup accessible from the camera home: select a region, type a year, get the oracle's read in seconds.
- When a vintage appears in a Pocket Somm recommendation card, the same sentence surfaces inline below the producer note.
- Cellar entries with a known vintage surface the oracle sentence in the entry detail, under the bottle identity — a reminder every time the user looks at a bottle they own.

## Key details

- The context is AI-generated at query time with a live web search for the specific vintage and region — not a static database of historical scores.
- The voice is editorial and opinionated. Not "2020 scored 95 points." More: "2020 rewarded the growers who did not pick early. Patience made the difference."
- The oracle is honest about uncertainty. For obscure appellations or limited vintage data, it says so plainly: "This one is harder to call. I would take the producer's word for it."
- Available for all three categories, with calibrated scope: spirit vintages matter only for dated expressions — vintage Cognac, Armagnac by year, vintage port, dated rum. The oracle knows when vintage year is genuinely meaningful and when it is decorative.
- For non-vintage bottles (NV Champagne, blended scotch, most beer), the oracle explains why vintage does not apply and what the house style or batch variation actually signals instead.
- Vintage context for a closed year is cached on the cellar entry for 6 months. The oracle can be manually refreshed.

~~~
New method: getVintageContext({ region, vintage, kind, name? }) — runs a targeted web search using searchGoogle for "[vintage] [region] harvest conditions" and "[producer] [vintage] notes" when a name is provided. Uses generateText to synthesize a single editorial sentence from the search results. The result is cached on cellar_entries using two new fields: vintageContext (text) and vintageContextUpdatedAt (number). For reverseScan, the context is fetched inline and included in the response payload. For the standalone lookup, getVintageContext is exposed directly to the frontend. Cellar entry detail calls getVintageContext lazily when vintage is populated and vintageContext is null. Cache TTL is 6 months (180 days * 86400000 ms).
~~~

## Implementation option: You.com Research API

~~~
The initial implementation note above uses searchGoogle + generateText as two separate steps. The MindStudio SDK now exposes `mindstudio.youDotComWebResearch()` which runs the entire search + extraction + synthesis pipeline in one call and returns a grounded answer with citations baked in. This is a strong architectural fit for Vintage Oracle because:

1. **The pipeline collapses.** Today's plan is: searchGoogle for harvest conditions → searchGoogle for producer notes → generateText to synthesize. With You.com Research, that becomes a single call: `youDotComWebResearch({ input: 'Was 2019 a strong year for Saint-Joseph?', researchEffort: 'standard', outputSchema: <our editorial sentence schema>, sourceControl: { includeDomains: ['jancisrobinson.com', 'wine-searcher.com', 'decanter.com', 'wine-spectator.com'] } })`. One round-trip instead of three.

2. **`outputSchema` forces structured JSON.** We can specify the editorial sentence directly — no separate generateText step needed to coerce the answer into the right shape. Output schema is supported on `standard`, `deep`, `exhaustive` (not `lite`).

3. **Citations come back automatically.** A future "see sources" affordance on the vintage line could surface the underlying articles without us building citation tracking ourselves.

4. **Domain control is built in.** We can constrain the search to trusted wine sources via `sourceControl.includeDomains` so the oracle reads from the actual canon (Jancis, Decanter, Wine Searcher) rather than blog posts and aggregators. The original plan's searchGoogle has no equivalent surgical control.

Gotchas:

- The output is `{ data: object | unknown[] }` — not strongly typed. Budget a half-day of schema exploration before wiring it in.
- For obscure appellations and limited vintage data (the case where the spec says "This one is harder to call"), We'll need to detect low-confidence responses from the You.com data and gracefully fall back to a humble sentence. The `outputSchema` should include a confidence indicator.
- For spirit vintages (vintage Cognac, dated rums), the search corpus is thinner and trusted sources are different. We may need a different `includeDomains` set per kind.

Decision deferred to build time: start with searchGoogle + generateText if it ships faster, switch to youDotComWebResearch if quality or latency favor it. The two implementations produce the same user-facing line; the user never sees the difference.
~~~
