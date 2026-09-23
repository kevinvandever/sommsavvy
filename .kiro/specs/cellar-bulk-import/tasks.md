# Implementation Plan

## Overview

Bulk Import adds a document-extraction method, a bulk-save method, and an import sheet on the Cellar screen. Imported bottles land as owned/untasted with no portraits and no taste regeneration. Nothing in the existing scan, save, search, or taste-profile paths changes.

## Tasks

- [x] 1. Configuration and provenance
  - Add `importBatchLimit` and `importParseTimeoutMs` to `server/src/config.ts` and `server/.env.example`
  - Widen the `source` union to include `'import'` in `server/src/methods/tables/cellarEntries.ts` and `web/src/types.ts`
  - Add a `CELLAR_IMPORTED` event constant to `server/src/observability/events.ts`
  - _Requirements: 3.3, 4.1, 5.3_

- [x] 2. Build `parseCellarDocument`
  - [x] 2.1 Create `server/src/methods/parseCellarDocument.ts`
    - Require auth; one `analyzeImage` call per request wrapped in a timeout; friendly error on failure/timeout; writes nothing
    - Prompt: list every distinct drink, leave unknown fields null, infer `kind` from context and lower confidence when inferring, return `{ items: [...] }` only
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.2, 4.3, 5.1_
  - [x] 2.2 Normalize extracted items server-side
    - Coerce `kind` to the valid enum (fallback `wine` + low confidence), clamp `vintage` to 1900..currentYear+1 or null, trim strings, drop blank-name items, slice to `importBatchLimit` and set `truncated`
    - _Requirements: 1.3, 1.4, 4.1_
  - [x] 2.3 Register `/parseCellarDocument` in `routes.ts` as a plain JSON method
    - _Requirements: 5.1_
  - [x]* 2.4 Unit test normalization
    - Unknown kind coerces with low confidence; bad/out-of-range vintage becomes null; blank-name items dropped; over-limit truncates and flags `truncated`
    - _Requirements: 1.3, 1.4, 4.1_

- [x] 3. Build `saveCellarEntriesBulk`
  - [x] 3.1 Create `server/src/methods/saveCellarEntriesBulk.ts`
    - Require auth; reject an over-limit batch; validate each item with the same rules as `saveCellarEntry`
    - Partial success: save valid items, return `rejected: [{ index, reason }]`, never discard the batch
    - Set `source: 'import'`, `owned: true`, `tasted: false`, `savedAt: db.now()`; no `photoUrl`
    - Skip taste regeneration entirely (imported entries are untasted); log one `CELLAR_IMPORTED` event with counts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.4, 5.1, 5.2_
  - [x] 3.2 Register `/saveCellarEntriesBulk` in `routes.ts`
    - _Requirements: 5.1_
  - [x]* 3.3 Unit test validation, partial success, and invariants
    - Mixed batch saves valid and reports invalid; over-limit rejected; saved entries are owned/untasted/source=import with no photoUrl and no regen call
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.4_

- [x] 4. Frontend API and types
  - Add `parseCellarDocument` and `saveCellarEntriesBulk` to `web/src/api.ts`; export the `ParsedItem` shape
  - _Requirements: 5.1_

- [x] 5. Build the import flow
  - [x] 5.1 Create `web/src/components/ImportSheet.tsx` (pick state)
    - Camera capture or file pick restricted to `image/*`; `uploadImage()` then `parseCellarDocument`
    - Upload failure: inline error, retain selection where possible, offer retry, make no parse call
    - Empty extraction: warm recoverable message offering another photo or manual entry
    - _Requirements: 1.5, 1.6, 4.5_
  - [x] 5.2 Review state
    - One editable row per item (name, producer, vintage, compact kind selector) plus an include/exclude toggle
    - Mark low-confidence rows; show a note when `truncated`; validation mirrors `ScanCard` (blocks Commit with field-level errors, retains edits); no rating field
    - All state local until Commit so abandoning leaves the cellar unchanged
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 4.1_
  - [x] 5.3 Commit and result state
    - Send only included rows with edited values; show how many were added plus any rejected rows and why; push saved entries into the store via `upsertEntry`
    - _Requirements: 2.5, 4.4, 3.6_
  - [x] 5.4 Add the entry point on the Cellar screen
    - A quiet "Add a shipment" action near the filter chips; opens `ImportSheet`
    - _Requirements: 5.1_

- [x] 6. Verify
  - Server typecheck + suite; web typecheck + build
  - Confirm imported entries appear under the "In the Rack" filter and that the taste summary is unchanged after an import
  - _Requirements: 3.2, 3.6_

## Notes

- v1 is image-only. `analyzeImage` forces non-`image/*` content to `image/jpeg`, so PDFs would fail or return noise; PDF needs a render-to-image step (follow-up). Email forwarding is also a follow-up.
- No portraits and no editorial card generation at import time, by design and for cost. Imported tiles use the existing deterministic placeholder.
- `source: 'import'` is a new value on an existing field, not a new field or table.
- Voice rules apply to all copy: no exclamation points, no emoji, no em dashes; never a score.
- Tasks marked `*` are optional tests and can be deferred.

## Post-launch refinements (shipped)

First real use showed imported entries were too thin: every tile fell back to the same stock coupe placeholder, and opening one gave no wine detail at all. Two fixes shipped:

- **Kind-tinted stand-in.** Entries without a photo now render a designed placeholder (kind-tinted gradient plus the bottle's initial) instead of a shared stock photo, so a mixed rack reads as varied and deliberate. Also removes the dependency on the old MindStudio CDN images. Chose a designed placeholder over per-kind stock photos because no real per-kind assets exist to source, and over per-bottle generation because that reintroduces the cost and mismatch problems photo-first just removed.
- **Fire-on-open enrichment.** `enrichCellarEntry` fills in the editorial context (what to expect, pairings, occasion, value) for any entry lacking it, the first time that entry is opened, then caches it. Chosen over a "tell me about this one" button so imported and scanned entries converge instead of behaving differently. Idempotent (no call when context already exists), non-fatal, and **never rewrites identity**, which also keeps it clear of the taste-regen trigger. Cost is bounded by entries actually opened, not bottles imported.

## Candidate follow-ups (deferred, not committed)

Captured from usage discussion; build only if real use shows the need.

- **Easy "mark tasted" on owned/imported entries.** Imported bottles land owned/untasted and only shape the taste profile once opened and marked tasted. If flipping that on the entry detail page is not already one obvious tap, a clearer affordance would make the flywheel turn. Verify the current entry detail page first.
- **"Exclude from taste profile" per-entry flag.** Raised because `tasted` currently does two jobs: "I have experienced this" (journal fact) and "let this shape my profile" (signal). They usually coincide, but occasionally a user tastes something they do not want influencing recommendations. Decision: do NOT build yet. The escape hatch today is simply not saving forgettable bottles (the user's own filter: "I only save it if it was worth remembering"), plus recency-weighted regen dilutes the odd off bottle. Revisit only if recommendations demonstrably drift because of bottles the user did not care about. A rating/affinity signal was considered and parked as it conflicts with the anti-rating-culture stance.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2"] },
    { "id": 3, "tasks": ["2.4", "3.3", "4"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4"] },
    { "id": 6, "tasks": ["6"] }
  ]
}
```
