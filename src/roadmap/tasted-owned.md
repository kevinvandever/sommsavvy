---
name: Tasted & Owned
status: done
effort: small
description: Mark any entry as tasted, owned, or both — the two-dimension foundation that keeps taste intelligence honest and unlocks inventory features across the app.
---

The cellar has always been two things at once. A taste journal — the record of every bottle experienced, which powers the taste profile, the recommendations, and every intelligence feature. And a bottle inventory — the record of what is actually sitting unopened in the rack, which powers drinking windows and "what to open this weekend."

Until now, the app treated every saved entry as both, by default. That works until the intelligence layer tries to use it. An owned-but-untasted bottle must not shape the taste profile. Including it would mean the app assumes the user likes something they have never had — corrupting the personalization moat that is the entire point. The fix is a clean data model: two independent boolean dimensions on every cellar entry. Ownership appears as a single quiet toggle in the save flow and on each entry detail. It is the foundation the entire intelligence stack is built on.
## What it looks like

- The save sheet (which already opens after a save for notes) gains one new row: "I have a bottle of this." Off by default. A single tap. The common case — logging something you drank at a restaurant, recording a bottle from a dinner — is completely untouched.
- Entries can be any combination:
  - **Tasted only** (the default): the journal entry, driving taste intelligence. The vast majority of entries live here.
  - **Owned only**: bought but not yet opened. Drives inventory features. Less common, but real — the Burgundy someone is holding for a special occasion.
  - **Both**: drank one, have more. Common for bottles the user loves and keeps stocked.
  - Neither is the Hunt List — a separate concept for bottles wanted but not yet had.
- The cellar mosaic gains a new filter chip: "In the rack." Surfaces every entry where owned=true. Sits beside the existing kind chips. For most users this is a small subset of their cellar — and that is expected.
- An owned entry shows a quiet Bone dot in its mosaic tile. No label. The tile is otherwise identical to a tasted entry.
- From any entry detail, the owned state can be toggled at any time. Finishing a bottle is the natural moment to un-check it.

## Key details

- The regen pipeline (`regenerateTasteSummary`) now filters exclusively to `tasted = true` entries. Owned-only bottles are fully excluded from taste signal. This rule is permanent and never relaxed: the taste profile is built from experience, not possession.
- All existing entries receive `tasted = true, owned = false` on migration. This is the correct interpretation of what the journal has been to date — a record of things experienced and remembered, not a physical inventory.
- Drinking Windows operates exclusively on owned=true entries. Calculating a drinking window for a bottle the user has already finished is both wrong and useless.
- Cellar Intelligence reads both dimensions intentionally: tasted entries only for taste analysis; owned entries for the "Open Now" inventory read; both combined for "What to Add" gap analysis (own data prevents recommending a bottle you already hold — it does not weight that bottle for taste).
- Opening Notes' cellar beat draws only from owned entries when surfacing drinking windows. Its taste-evolution and editorial beats are unaffected — those read tasted entries and fire from day one.

~~~
Two new boolean fields on cellar_entries: tasted (boolean, default true) and owned (boolean, default false). Both may be null in the migration window; application code treats null as the default.

Migration: one-time on deploy — UPDATE cellar_entries SET tasted = 1, owned = 0 WHERE tasted IS NULL. No data loss. No user-visible change to existing entries beyond the new mosaic filter.

Save flow: the NoteSheet (already opens post-save) gains an "I have a bottle of this" toggle. Implemented as a patch via updateCellarEntry({ id, patch: { owned: true } }) when tapped — the entry is already persisted at this point. Toggle default is off. The save call itself (saveCellarEntry) is unchanged — one-tap save behavior is fully preserved.

regenerateTasteSummary: update the listCellar query used internally to filter WHERE tasted = 1. The prompt and summarization logic are unchanged. This is the only modification.

listCellar: new optional param owned (boolean). When true, returns only owned=true entries. Used by the new "In the rack" filter chip and internally by Drinking Windows' "Open Soon" filter.

TypeScript interface update for CellarEntry:
  tasted?: boolean;  // default true; null treated as true
  owned?: boolean;   // default false; null treated as false
~~~

## History

- **2026-06-23** — Built. Two boolean dimensions added to cellar_entries with `defaults: { tasted: true, owned: false }` in defineTable. A shared `Switch` primitive (44x26 Bone-on-state track, Midnight knob, one-shot pop, reduced-motion aware) now drives ownership in two places: a quiet row in the post-save NoteSheet (off by default, persists independently of the note) and a card on the entry detail page under the metadata line (the management surface — mark the whisky and gin you hold, un-mark when you finish a bottle). The cellar mosaic gained an "In the Rack" filter chip and a quiet Bone dot (with dark halo, suppressed under the rack filter) on owned tiles. The regen pipeline filters to `tasted !== false` in JS (avoiding the SQLite null trap), and updateCellarEntry triggers a regen on `tasted` changes but never on `owned`. Existing rows backfilled to tasted=true, owned=false. Implementation note: there is no "tasted" toggle in the UI — everything logged is tasted by default; ownership is the only dimension the user actively flips. Deviated from the original spec's `listCellar` owned param (deferred — the cellar is fully hydrated client-side, so the "In the Rack" filter runs in the Zustand store; the backend param will be added when Drinking Windows needs server-side filtering).
