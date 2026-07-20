# Roadmap — SommSavvy

> The cross-feature map individual specs lack. Maintained by Pax: persistent across sessions, updated rather than regenerated. A map, not a contract, it conveys direction and order, not promised dates. Read it at the start of a session to see the whole board.

**North-star:** The engaged enthusiast keeps adding tasted bottles to their cellar, so the taste profile sharpens and every recommendation feels more like theirs. Growth of tasted cellar entries per active user is the signal the product is working.

**Last updated:** July 2026 · **Currently building:** nothing in flight — Smart Scan, Scan Web Enrichment, and Cellar Search all shipped. Next up: Taste Seeding.

---

## Shipped
*Merged to main and verified in production.*

### Smart Scan — Intent Routing & Capture-First Reverse Scan
- **What:** one scan surface that auto-routes a bottle to identify + capture and a dish/menu to pairings; capture-first save with tasted defaulting true.
- **Unblocked:** faster cellar growth, richer taste profile, the base for enrichment / cellar search.
- **Specs:** `.kiro/specs/smart-scan-intent-routing`, `.kiro/specs/smart-scan-frontend`.

### Scan Web Enrichment
- **What:** after a bottle is identified, a bounded web-search pass (You.com) grounds the card's tasting notes, value read, and producer/region context in real sources. Non-fatal, timeboxed, ships dark until a provider key is set; translates any retrieved scores into qualitative voice (no numeric ratings).
- **Verified:** live in production (`scan_enriched` / `outcome: enriched` in logs); no score leakage confirmed.
- **Unblocked:** more trustworthy cards → more saves; a reusable `webSearch` capability for later features (The Hunt, Vintage Intelligence).
- **Spec:** `.kiro/specs/scan-web-enrichment`.

### Cellar Search (+ ownership awareness) — first slice of Cellar Intelligence
- **What:** natural-language search over the cellar ("a nice red for salmon"), interpreted against identity, notes, pairings, and occasion; returns the user's own bottles with a reason each, never a score. Grounded strictly in the user's own rows; keyword fallback so it never regresses. Whole-cellar search flags availability ("in your rack" vs "you'll need a bottle") and prefers on-hand bottles for occasion queries; the "In the Rack" chip is a hard owned-only filter.
- **Unblocked:** proves the reasoning-over-a-projection pattern the rest of the Cellar Intelligence lane builds on.
- **Spec:** `.kiro/specs/cellar-search` (PRs #5, #8).

---

## Next
*Sequenced from the Living Cellar lane, the taste flywheel first.*

### Taste Seeding — `up next`
- **What:** warm up a new user's taste profile fast so recommendations feel personal before the cellar is deep.
- **Depends on:** Smart Scan (more entries), MVP taste profile.
- **Unblocks:** Cellar Intelligence.
- **Why it matters:** the profile is the differentiator; the sooner it is warm, the sooner retention.

### Tasted vs Owned (surface the two axes)
- **What:** make the tasted/owned distinction first-class in the UI (filters, toggles).
- **Depends on:** Smart Scan (sets tasted on capture).
- **Unblocks:** inventory features (drinking windows, home bar).
- **Why it matters:** separates the journal from the inventory; both flywheels need it.

### Cellar Intelligence (deeper)
- **What:** the standing-insight layer beyond on-demand search — passive patterns and gentle nudges drawn from the cellar (leanings, gaps, "you keep coming back to structured Rhône reds," "your whites are thin," time-of-year prompts).
- **Depends on:** Taste Seeding, a growing tasted cellar. Builds on the reasoning-over-a-projection pattern proven by Cellar Search (shipped).
- **Unblocks:** Opening Notes, Drinking Windows, Year in Review.

---

## Later
*Intended, not yet sequenced.*

- **Opening Notes / Drinking Windows / Vintage Intelligence** — cellar-depth features. Depend on: Cellar Intelligence.
- **The Hunt (hunt-list, pursuit)** — camera fires on a wanted bottle, plus active sourcing. Depends on: reliable identification from Smart Scan.
- **At the Table (restaurant-scanner, pairing-planner, somm-chat)** — expand Pocket Somm. restaurant-scanner absorbs the menu/wine-list scanning deferred from Smart Scan.
- **Session History** — recommendation history (roadmap per product context).
- **Share Cards / Year in Review** — shareable editorial artifacts.

---

## Someday / Won't
*Explicitly parked, on purpose.*

- **In-store value/price check** — *parked:* needs real pricing data and cuts against the anti-rating positioning.
- **The Home Bar (home-bar-inventory, cocktail-studio)** — *parked:* cocktails and home-bar planning are explicitly out of scope for the MVP.
- **Know Your Drink (tasting-school, regional-guides, live-tastings)** — *parked:* reference and immersive layer, a later horizon.
- **Cellar Export, Push Notifications, Native iOS/Android** — *parked:* explicitly out of scope for the MVP per product context.

---

## Dependency view

```
Smart Scan (identification + capture)
   └─ unblocks → Taste Seeding → Cellar Intelligence → Opening Notes / Drinking Windows / Year in Review

Smart Scan (reliable identity)
   └─ unblocks → The Hunt (hunt-list → pursuit)

Tasted vs Owned
   └─ unblocks → inventory features (Home Bar, Drinking Windows)
```