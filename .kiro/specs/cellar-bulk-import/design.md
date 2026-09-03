# Design Document

## Overview

Bulk Import adds two backend methods and one frontend flow. Nothing about the existing scan, save, search, or taste-profile paths changes.

```
Cellar screen
  └─ "Add a shipment" entry point
       1. pick/capture a document image  -> uploadImage()      (existing)
       2. parseCellarDocument({ imageUrl })                     (NEW)
            -> vision extraction -> ParsedItem[]
       3. Review_List: edit / exclude rows (local state only)
       4. Commit -> saveCellarEntriesBulk({ entries })           (NEW)
            -> N cellar_entries, owned=true, tasted=false
            -> NO taste regen, NO portrait generation
       5. refresh cellar, land the user back in the Cellar
```

The two-step shape (parse, then commit) is what makes the review gate possible: extraction never writes, and the commit persists exactly what the user confirmed.

## Components and Interfaces

### `parseCellarDocument` (new, `server/src/methods/parseCellarDocument.ts`)

```ts
interface ParseCellarDocumentInput {
  imageUrl: string;
}

interface ParsedItem {
  name: string;
  kind: 'wine' | 'beer' | 'spirits';
  producer: string | null;
  region: string | null;
  vintage: number | null;
  abv: number | null;
  confidence: 'high' | 'medium' | 'low';
}

interface ParseCellarDocumentResult {
  items: ParsedItem[];
  truncated: boolean;   // true when the document listed more than the batch limit
}
```

- Requires `auth.userId` (Requirement 5.1). Writes nothing.
- One `mindstudio.analyzeImage` call per request (Requirement 4.2), wrapped in a timeout; on failure or timeout, throws a friendly error (Requirement 4.3).
- The prompt instructs: list every distinct drink; leave a field null rather than guessing; infer `kind` from context and lower `confidence` when inferring; return `{ items: [...] }` only.
- Server-side normalization before returning: coerce `kind` to the valid enum (default `wine` with `confidence: 'low'` if unrecognized), clamp `vintage` to 1900..currentYear+1 or null, trim strings to 200 chars, drop items with a blank name, and slice to `importBatchLimit` setting `truncated` accordingly (Requirements 1.3, 1.4, 4.1).
- Empty result is a valid, non-error outcome; the frontend shows the warm recoverable message (Requirement 1.6).

**Image-only constraint.** `mindstudio.analyzeImage` fetches the URL and forces a non-`image/*` content type to `image/jpeg`, so a PDF would be sent mislabeled and fail or return noise. v1 therefore accepts images only, and the frontend file picker restricts to `image/*` (Requirement 1.5). PDF support needs a render-to-image step and is a follow-up, not a silent partial behavior.

### `saveCellarEntriesBulk` (new, `server/src/methods/saveCellarEntriesBulk.ts`)

```ts
interface BulkEntryInput {
  name: string;
  kind: 'wine' | 'beer' | 'spirits';
  producer?: string;
  region?: string;
  vintage?: number;
  abv?: number;
}

interface SaveBulkResult {
  saved: Hydrated<CellarEntry>[];
  rejected: Array<{ index: number; reason: string }>;
}
```

- Requires `auth.userId` (Requirement 5.1); writes only to that user (5.2).
- Rejects a batch larger than `importBatchLimit` outright.
- Validates each item with the same rules as `saveCellarEntry` (name required, kind valid, vintage range). **Partial success:** valid items are saved, invalid ones are returned in `rejected` with a reason; the batch is never discarded wholesale (Requirement 4.4).
- Each created entry sets `source: 'import'`, `owned: true`, `tasted: false`, `savedAt: db.now()` (Requirements 3.1, 3.3).
- **No taste regeneration.** Every imported entry is `tasted: false`, and the Taste_Profile derives from tasted entries only, so a regen would be a no-op at best and N redundant background jobs at worst. Skipping it also preserves the existing invariant that regen fires on saves of tasted material, removes, profile-relevant updates, and explicit refresh (Requirement 3.2).
- **No image generation** (Requirement 3.4). Imported entries carry no `photoUrl`; the cellar tile already falls back to a deterministic placeholder keyed by entry id, so the mosaic stays visually intact.
- Logs one observability event for the batch (`CELLAR_IMPORTED`) with counts only.

### Data model note: the `source` enum

`source` gains `'import'` alongside `'somm' | 'scan' | 'manual'`. This is a new value on an existing field, not a new field or table (Requirement 5.3). It is worth the small contract change: imported rows are AI-parsed, owned, and untasted, and being able to identify them later (to review them, or to treat them differently in future cellar features) is genuinely useful. `manual` would misrepresent them as hand-typed. The frontend `Source` type is widened to match. No migration is required since rows are JSON.

## Frontend

### Entry point

A quiet "Add a shipment" action on the Cellar screen, next to the filter chips. The Cellar is already a signed-in surface and is where bottles live, so this does not disturb the single multimodal capture surface on Home (which remains the place for scanning one drink).

### `ImportSheet` (new component)

A sheet with three states, reusing the existing `Sheet` primitive:

1. **Pick.** Camera capture or file pick, restricted to `image/*`. On selection, `uploadImage()` then `parseCellarDocument`. Upload failure shows an inline error, keeps the selection where possible, offers retry, and makes no parse call (Requirement 4.5).
2. **Review.** The Review_List: one editable row per `ParsedItem` with name, producer, vintage, and a compact kind selector, plus an include/exclude toggle per row. Low-confidence rows are marked visually (Requirement 2.4). Validation mirrors `ScanCard`: blocks Commit with field-level errors while retaining edits (Requirement 2.2). No rating field (Requirement 2.7). A `truncated` response shows a note that some rows were not included (Requirement 4.1).
3. **Result.** After Commit, a short confirmation of how many were added, plus any rejected rows and why (Requirement 4.4). Then the cellar list refreshes.

All state is local to the sheet until Commit, so abandoning the flow leaves the cellar untouched (Requirement 2.6).

### Store and API

- `api.parseCellarDocument` and `api.saveCellarEntriesBulk` added as plain JSON rpc wrappers.
- On successful commit, the saved entries are pushed into the store via the existing `upsertEntry`, so the mosaic updates without a refetch.

## Configuration

```
IMPORT_BATCH_LIMIT        # max Parsed_Items per document (default 50)
IMPORT_PARSE_TIMEOUT_MS   # extraction time bound (default 30000)
```

Both follow the existing `Number(optional(...))` pattern in `config.ts`.

## Error Handling

| Condition | Behavior |
| --- | --- |
| Anonymous caller | Rejected; import requires sign-in (Req 5.1) |
| Upload fails | Inline error, selection retained, retry offered, no parse call (Req 4.5) |
| Extraction fails / times out | Friendly message, no technical detail, cellar unchanged (Req 4.3) |
| No drinks discerned | Warm recoverable message, offer another photo or manual entry (Req 1.6) |
| Document exceeds batch limit | Present items up to the limit, note the truncation (Req 4.1) |
| Some committed rows invalid | Save the valid ones, report the rejected ones (Req 4.4) |
| User abandons before Commit | Cellar unchanged (Req 2.6) |

Extracted text is treated as untrusted data: it is parsed into fields and normalized server-side, never executed, and any instruction-like content in the document is ignored.

## Testing Strategy

- **Unit (normalization):** invalid/unknown `kind` coerces to a valid enum with low confidence; out-of-range and non-numeric vintages become null; blank-name items are dropped; over-limit lists truncate and set `truncated`.
- **Unit (bulk validation/partial success):** a batch mixing valid and invalid items saves the valid ones and reports the rest; an over-limit batch is rejected.
- **Unit (invariants):** committed entries are `owned: true`, `tasted: false`, `source: 'import'`, carry no `photoUrl`, and trigger no taste regeneration.
- All AI and db calls stubbed using the existing `stubs.ts` approach; no live network.

## What this deliberately does not do

- No PDF parsing (needs a render-to-image step) — follow-up.
- No inbound email forwarding (needs a receiving address and per-sender parsing) — follow-up.
- No portrait generation for imported bottles, by design and for cost.
- No editorial card generation at import time. Imported entries are identity plus availability; the richer treatment can be added later on demand without changing this contract.

## Relationship to the Roadmap

This is a new capability in the Living Cellar lane and a natural companion to **Tasted vs Owned**: it produces the canonical owned-but-untasted entries that feature is designed around, and it makes keeping a rack current low-effort enough that the ownership axis becomes trustworthy.
