# Roadmap — SommSavvy

> The cross-feature map individual specs lack. Maintained by Pax: persistent across sessions, updated rather than regenerated. A map, not a contract, it conveys direction and order, not promised dates. Read it at the start of a session to see the whole board.

**North-star:** The engaged enthusiast keeps adding tasted bottles to their cellar, so the taste profile sharpens and every recommendation feels more like theirs. Growth of tasted cellar entries per active user is the signal the product is working.

**Last updated:** July 2026 · **Currently building:** Smart Scan (shipped) → Scan Web Enrichment (next up)

---

## Now

### Smart Scan — Intent Routing & Capture-First Reverse Scan — `shipped`
- **What:** one scan surface that auto-routes a bottle to identify + capture and a dish/menu to pairings; capture-first save with tasted defaulting true.
- **Depends on:** MVP scan/cellar/auth (done), cost guardrails (done).
- **Unblocks:** faster cellar growth, richer taste profile, cleaner base for taste-seeding and cellar-intelligence.
- **Specs:** `.kiro/specs/smart-scan-intent-routing`, `.kiro/specs/smart-scan-frontend` (both shipped and merged to main).

### Scan Web Enrichment — `next up` (prioritized)
- **What:** after a bottle is identified, a bounded web-search pass grounds the card's tasting notes, value read, and producer/region context in real sources. Non-fatal, timeboxed, ships dark until a provider key is set. Strengthens the weakest part of the current scan.
- **Depends on:** Smart Scan (identification path).
- **Unblocks:** more trustworthy cards → more saves → richer taste profile. Also seeds a reusable `webSearch` capability for later features (The Hunt, Vintage Intelligence).
- **Spec:** `.kiro/specs/scan-web-enrichment` (requirements.md + design.md ready; tasks pending).
- **Why prioritized:** user-requested; directly lifts the quality of every scan, the top of the funnel.

---

## Next
*Sequenced from the Living Cellar lane, the taste flywheel first.*

### Taste Seeding
- **What:** warm up a new user's taste profile fast so recommendations feel personal before the cellar is deep.
- **Depends on:** Smart Scan (more entries), MVP taste profile.
- **Unblocks:** Cellar Intelligence.
- **Why it matters:** the profile is the differentiator; the sooner it is warm, the sooner retention.

### Tasted vs Owned (surface the two axes)
- **What:** make the tasted/owned distinction first-class in the UI (filters, toggles).
- **Depends on:** Smart Scan (sets tasted on capture).
- **Unblocks:** inventory features (drinking windows, home bar).
- **Why it matters:** separates the journal from the inventory; both flywheels need it.

### Cellar Intelligence
- **What:** patterns and prompts drawn from the cellar (leanings, gaps, gentle nudges).
- **Depends on:** Taste Seeding, a growing tasted cellar.
- **Unblocks:** Opening Notes, Drinking Windows, Year in Review.
- **First slice — Cellar Search:** natural-language search over the cellar ("a nice red for salmon"), interpreted against identity, notes, pairings, and occasion; returns owned bottles with a reason each, never a score. Stands alone (needs only the existing cellar), so it can ship ahead of the rest of the lane. **Spec:** `.kiro/specs/cellar-search` (requirements.md + design.md ready; tasks pending).

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