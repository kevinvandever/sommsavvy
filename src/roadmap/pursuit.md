---
name: The Pursuit
status: planned
effort: large
description: When you can't get the bottle — honest access reality, a worth-it verdict, and three alternatives that deliver the same experience for what it actually costs.
---

This is what a real sommelier does when the restaurant is out of the wine you ordered. They do not shrug. They tell you the truth about access, make a judgment about whether chasing it is worth it at all, and then redirect you to something that delivers the same experience. Wine-Searcher finds you the bottle. The Pursuit finds you the experience — even when the bottle is out of reach.

## What it looks like

- Entry points anywhere a bottle appears: any Reverse Scan result, any Hunt List entry (via a "Pursue it" action on that entry), or a standalone text or voice search by name.
- The feature runs a grounded research session and returns a structured three-part report:
  - **Access Reality.** What the bottle actually costs through legitimate channels right now. Whether it is available through authorized retailers, or effectively limited to allocations and waitlists. When the honest answer is "you cannot get this at a fair price through legal means," the report says so plainly and explains why. No secondary market links. No gray-market sources.
  - **Worth-It Verdict.** One editorial sentence in the SommSavvy voice. At the price this is actually trading at, would the somm pull the trigger? "At $240 on the open market, no. The experience does not scale with the price. Here is what does." The verdict will tell the user not to buy the bottle. That is the point.
  - **The Alternatives.** Three recommendation cards — rendered, saveable, and shareable exactly like any Pocket Somm result. Built from the user's taste profile and what they love about the target bottle. Real bottles, available right now, in a stated price range. Not "similar in style" in a generic sense — specifically what the user will experience opening them, based on everything the cellar knows.
- Before running, the user sets a budget ceiling. The alternatives respect it.
- Any alternative can be saved to the cellar or added to the Hunt List in one tap.
- When triggered from a Hunt List entry, the report ties back to that entry — the hunt entry shows "Pursued" state and the result is accessible from the Hunt List view as a resolved chapter.

## Key details

- The legal guardrail is a design constraint, not a disclaimer. The feature searches only legitimate retailers and editorial sources. When the honest answer is that a bottle only trades at scale on secondary markets — which are illegal for alcohol resale in most US jurisdictions — it says so and pivots to alternatives. The brand voice already does brutal honesty about price and value. This is the same instinct applied to access.
- The substitution quality scales directly with the taste profile. A user with a thin cellar gets broadly stylistic alternatives. A user with forty entries and two years of notes gets precise, specific ones. The taste profile is the moat here — no aggregator has it.
- This is not a price alert, a stock watcher, or a listing aggregator. It is a one-time active research session. The result is a snapshot, not a live feed.
- The worth-it verdict is opinionated and signed by the voice. It will recommend against buying a bottle. That is not a bug.
- The Access Reality section acknowledges state-level alcohol shipping restrictions when relevant. "Ships to most US states" vs. "restricted — check your state" is useful, real information.
- Spirits collectors are the highest-value segment for this feature. The bourbon and whisky allocated-bottle problem — where a bottle retails at $60 and trades at $400 and the only legitimate path is a distillery lottery — is exactly the scenario The Pursuit was built to address honestly.

~~~
New method: pursueBottle({ name, producer?, region?, vintage?, budgetMax?, userId? }). Orchestrated as a runTask autonomous agent. The agent:
1. Uses youDotComWebResearch to search for the bottle across legitimate retailer domains (wine.com, klwines.com, totalwine.com, flaviar.com, masterofmalt.com, thewhiskyexchange.com, producer direct sites). Constrains search to these domains explicitly. Never searches social media, BST groups, or secondary market platforms (Unicorn Auctions, WineCommune, etc).
2. Synthesizes real availability and price from the search results. Notes where allocation or waitlist is the only realistic path.
3. Evaluates worth-it verdict using the SommSavvy voice guidelines and the user's tasteSummary as context.
4. Generates three alternative Recommendation objects using the same structure as pocketSomm output — same card component, same save flow, same chiaroscuro portrait generation. Alternatives draw on the taste profile and the target bottle's flavor/style characteristics, not retailer data.
5. Returns: { accessReality: string, worthItVerdict: string, alternatives: Recommendation[], sourceUrls: string[] }.

New method: pursueHuntEntry({ huntEntryId }). Reads the hunt_list entry by id, validates owner, calls pursueBottle() with the entry's name and producer. Writes pursuitResultJson (the full PursuitResult) and pursuitRunAt (unix ms) back to the hunt_list row. The Hunt List view shows "Pursued [date]" state for entries with pursuitRunAt set, with a chevron to expand the result.

New fields on hunt_list table: pursuitResultJson (text, nullable), pursuitRunAt (number, nullable).

The feature renders in a bottom-sheet result view below the hunt entry or scan result. The three alternative cards use the existing recommendation card component. Loading state: a considered progress sequence — "Checking availability", "Reading the market", "Finding your alternatives" — over 15-30 seconds total. Never streams partial results; delivers the full report at once.
~~~
