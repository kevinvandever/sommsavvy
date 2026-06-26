---
name: Cellar Intelligence
status: planned
effort: medium
description: A strategic read on your taste and your collection — what your palate reveals, where the genuine gaps are, and what one well-chosen addition would do for it.
---

The enthusiast with thirty bottles knows each one individually. Cellar Intelligence reads the collection from the outside — how the palate has shaped itself, where the gaps are, what a single well-chosen addition would do. The trusted merchant's eye, applied to everything you have tried and everything you hold.

This feature has two halves that ship independently. The journal half serves every user from day one. The inventory half requires Drinking Windows.

## The journal half — ships first

This is the intelligence built from tasted entries: the record of what the user has actually experienced. It is available to every user with 10 or more tasted entries. No owned bottles required.

**The Shape of the Cellar.** An honest read on what the collection reveals about the palate, in the SommSavvy voice. "Heavily weighted toward Italian red. One serious white. No sparkling at all. Interesting." It reads the taste profile and tasted entry history together. It points out patterns the user may not have noticed. It is not a stat summary — it is a characterization.

**What to Add.** Three to five specific bottle recommendations to fill genuine gaps — built from the user's taste profile, their tasted-entry composition, and what is genuinely underrepresented. These are full recommendation cards, rendered and saveable exactly like any Pocket Somm result. The gap analysis queries owned entries only to avoid recommending something already held — it does not treat owned entries as taste signal.

Both sections are accessible from an "Intelligence" view in the cellar header. They refresh on demand. Not a live dashboard — a deliberate assessment.

## The inventory half — activates after Drinking Windows

**Open Now.** Every owned bottle at or entering its drinking window this year. "Eight bottles worth opening this year. Four of them are not getting better past the next eighteen months." This section is built on Drinking Windows data and is only meaningful once that feature is live and the user has marked bottles as owned. Before Drinking Windows ships, the Intelligence view omits this section without explanation — the journal half stands alone cleanly.

## Key details

- The threshold of 10 entries applies to tasted entries only. A user who owns ten bottles they have never opened does not see the journal half of Cellar Intelligence — the profile has no experiential data to read.
- The shape analysis is opinionated without being prescriptive. "Your call, but the cellar is very French right now" — not a directive, an observation. The voice throughout is the trusted merchant: direct, warm, specific. No percentages, no charts, no scores.
- "What to Add" picks are specific, not generic. Someone with twenty Burgundy tasted entries and one Riesling gets a very different set than someone starting from scratch.
- The full Intelligence view (all three sections) is the payoff after both features are live. The experience getting there is not a degraded version — the journal half is complete on its own terms.

~~~
The journal half (Shape of the Cellar + What to Add) has no dependency beyond the Tasted & Owned data model and 10+ tasted entries.

generateCellarIntelligence({ userId }):
- Phase 1 (journal): reads all cellar_entries WHERE tasted = 1, groups by kind/region/producer, reads tasteSummary. Constructs a shape summary object. Runs a generateText call (or optionally a youDotComWebResearch call for the "What to Add" section — see implementation option below) to produce shapeAnalysis (string) and whatToAdd (Recommendation[]).
- Phase 2 (inventory, only when Drinking Windows is live): reads all cellar_entries WHERE owned = 1, filters by drinkingWindowNote to find entries at or entering their window. Produces openNow (string). If drinkingWindowNote is absent on all owned entries (feature not yet live), this section is omitted from output.
- Output: { shapeAnalysis: string, whatToAdd: Recommendation[], openNow?: string }. The "What to Add" section uses the same Recommendation type as pocketSomm. Output is not persisted — generated fresh each time.
- View shows a considered loading state: "Reading your cellar… finding gaps… sourcing bottles…" Total: 10-25 seconds.

New method: generateCellarIntelligence({ userId }) — requires auth, validates userId === auth.userId.

## Implementation option: You.com Research API for "What to Add"

The initial implementation uses a single task agent call for the full journal report. The "What to Add" section specifically benefits from grounded web research — an ungrounded model may hallucinate producers, vintages, or importers under the pressure of recommending specific bottles.

Proposed architecture for "What to Add" (deferred to build time):
- Use youDotComWebResearch with researchEffort: 'standard' and outputSchema matching the Recommendation[] type.
- Input phrasing: "Recommend three specific, purchasable bottles to add to a cellar weighted toward [region/style summary] with a taste profile that loves [tasteSummary distillation]. Fill genuine gaps and complement existing strengths. Do not suggest bottles from these producers or regions the user already has extensively: [owned + tasted summary]."
- sourceControl.includeDomains: ['wine-searcher.com', 'jancisrobinson.com', 'vinous.com', 'klwines.com', 'chambersstreetwines.com'].
- Decision deferred: start with single task agent for the first cut; layer in youDotComWebResearch for the "What to Add" section only if early user testing reveals hallucinated or unavailable bottles.

Latency note: adding a Research API call pushes total generation to 20-30 seconds. Worth it — this is a considered assessment, not a dashboard. Loading state communication matters.
~~~
