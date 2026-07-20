# Design Document

## Overview

Cellar Search replaces the substring filter behind the cellar search input with an AI interpretation step, while leaving the surface (input, placeholder, chips, mosaic) exactly as it is. The user types a real question; the backend interprets it against that user's own entries and returns a ranked subset with a one-line reason per bottle. When interpretation is unavailable, slow, or errors, the existing keyword filter serves the same query, so there is never a regression.

The work splits cleanly: a new backend method `searchCellar` that does the interpretation, and a frontend change in `Cellar.tsx` that calls it (debounced) instead of filtering in memory, with a keyword fallback retained. No schema changes; the data model stays `users` + `cellar_entries`.

## Architecture

```
Cellar.tsx (search input)
  │  debounced query + active filter
  ▼
api.searchCellar({ query, kind?, owned? })      (NEW rpc)
  ▼
server: searchCellar
  1. load caller's cellar (reuse listCellar's narrowing)
  2. apply active filter (kind / owned) to the candidate set
  3. if query empty  -> return candidates (today's behavior)
  4. interpret: AI call over a compact projection of candidates
  5. map model output -> ordered [{ entryId, reason }]
  6. resolve ids back to full CellarEntry objects, drop unknown ids
  7. return { matches: [{ entry, reason }], usedFallback }
     └─ on provider error/timeout: keyword filter -> matches with usedFallback:true
```

The interpretation never returns drink data itself; it only selects and orders IDs from the candidate set and supplies reasons. Full entry objects are resolved server-side from the caller's own rows. This structurally guarantees Requirement 1.2 (results are always the user's own saved bottles) and Requirement 4.2 (no cross-user data).

## Components and Interfaces

### New backend method: `searchCellar` (`server/src/methods/searchCellar.ts`)

```ts
interface SearchCellarInput {
  query: string;
  kind?: 'wine' | 'beer' | 'spirits';   // from active Filter_Chips
  owned?: boolean;                        // 'In the Rack' chip
}

interface CellarMatch {
  entry: CellarEntry;   // full row, resolved server-side
  reason: string;       // short, product-voice, depth-aware
}

interface SearchCellarResult {
  matches: CellarMatch[];
  usedFallback: boolean;  // true when keyword filter served the query
}

export async function searchCellar(input: SearchCellarInput): Promise<SearchCellarResult>;
```

Steps in detail:

1. **Auth + load.** Require `auth.userId` (Requirement 4.3). Load the caller's entries reusing the same user-narrowed query `listCellar` uses; apply `kind` / `owned` filtering to form the candidate set (Requirement 2.3).
2. **Empty query.** If `query.trim()` is empty, return the candidate set as matches with empty reasons and `usedFallback: false` (Requirement 2.5). The frontend treats empty reasons as "plain listing."
3. **Projection.** Build a compact JSON array of candidates carrying only what interpretation needs: `{ id, name, producer, region, kind, vintage, occasion, pairings, whyText, notes }`. This is the only cellar data sent to the model (Requirement 4.5).
4. **Interpret.** Call `mindstudio.generateText` with structured JSON output. The prompt states: you are matching the user's request to bottles they already own; select and rank only from the provided list; return `{ matches: [{ id, reason }] }` where reason is one short sentence in the depth voice; if nothing fits, return `{ matches: [] }`; never invent an id; never output a score. Include `VOICE_RULES` and `DEPTH_GUIDANCE[depth]`. The user's `tasteSummary` may be passed as light context but must not override the explicit request.
5. **Resolve + guard.** Map returned ids back to full `CellarEntry` objects; silently drop any id not in the candidate set (hallucination guard, Requirement 1.2). Preserve model ordering (Requirement 1.4).
6. **Fallback.** Wrap the interpret step in a timeout (`withTimeout`). On error/timeout, run the existing substring filter over the candidate set and return those matches (empty reasons) with `usedFallback: true` (Requirements 3.3, 4.1, 4.4).
7. **Empty.** Model returns `{ matches: [] }` -> return empty matches, `usedFallback: false`. Frontend shows the warm Empty_Result (Requirement 3.1).

Register in `server/src/methods/routes.ts` as a plain JSON method (not SSE) alongside `listCellar`.

### Frontend: `Cellar.tsx`

- Add `searchCellar` to `web/src/api.ts` as a JSON rpc (mirrors `listCellar`).
- Replace the in-memory `visible` `useMemo` search branch with a debounced (roughly 300-400ms) call to `api.searchCellar({ query, kind, owned })` when `search.trim()` is non-empty.
- Keep the filter-only path (empty query) fully client-side as today, so clearing the query is instant (Requirement 3.4).
- Hold `matches`, `loading`, and `usedFallback` in local state.
- Render the returned entries in the existing `CellarMosaic`. The per-entry reason is available for display (for example a subtle caption on the tile or on hover); exact placement is a visual detail for implementation, but the reason must be surfaced somewhere per Requirement 1.3.
- Loading: reuse the existing non-blocking loading treatment (Requirement 5.3).
- Empty_Result: warm copy in the existing `cellar__no-match` block, in voice, keeping the query editable (Requirements 3.1, 3.2).
- When `usedFallback` is true, show a quiet note that a simpler match was used (Requirement 3.3), without technical detail.

The chips, input, placeholder, and mosaic are unchanged (Requirement 5).

## Data Models

No schema changes. `searchCellar` reads existing `cellar_entries` fields. The projection sent to the model is a subset of those fields for the caller only. No new persisted state.

## Configuration

```
CELLAR_SEARCH_TIMEOUT_MS      # interpret time bound (default ~6000)
CELLAR_SEARCH_MAX_CANDIDATES  # cap entries sent to the model (default ~120)
```

`CELLAR_SEARCH_MAX_CANDIDATES` bounds token cost for very large cellars; when a cellar exceeds it, the projection is truncated to the most recent entries (the taste profile already favors recency), and the keyword filter remains available for exhaustive matching. If no AI provider is configured, `searchCellar` always uses the keyword path (Requirement 4.4).

## Error Handling

| Condition | Behavior |
| --- | --- |
| Anonymous caller | Reject; cellar already requires sign-in (Req 4.3) |
| Empty query | Return filtered candidates, no interpretation (Req 2.5) |
| Provider error / timeout | Keyword filter over candidates, `usedFallback: true` (Req 3.3, 4.1) |
| Provider unconfigured | Keyword filter path (Req 4.4) |
| Model returns unknown ids | Dropped during resolve (Req 1.2) |
| Model returns no matches | Empty_Result, warm message (Req 3.1) |

All model output is treated as selection metadata only; entry content always comes from the user's own rows, so the model cannot surface another user's data or fabricate a bottle.

## Testing Strategy

- **Unit (grounding):** model output containing an id not in the candidate set yields a Result_Set without that id.
- **Unit (fallback):** provider throw and timeout both produce keyword-filtered matches with `usedFallback: true`.
- **Unit (empty query):** returns the filtered candidate set unchanged, no provider call.
- **Unit (filter composition):** `kind`/`owned` restrict the candidate set before interpretation (Req 2.3).
- **Unit (no rating):** reasons contain no numeric score and no forbidden punctuation; depth voice is applied.
- **Unit (isolation):** a query for user A never returns user B's rows (enforced by user-narrowed load).
- All AI calls stubbed; no live network in tests.

## Migration and Rollout

Ships behind graceful degradation: with no AI provider configured, the cellar search behaves exactly as today (keyword filter). Enabling the provider turns on interpretation. Because the frontend keeps the keyword path for empty queries and for fallback, there is no regression risk to the existing cellar experience.

## Ownership awareness (Requirement 6)

The cellar spans two independent axes: `tasted` (shapes the taste profile) and `owned` (drives inventory / "In the Rack"). A whole-cellar search therefore includes bottles the user has tasted but no longer holds, which is correct for a journal but can surprise an occasion query ("what should I open tonight").

The blend:
- **"In the Rack" chip = hard filter.** Already implemented: `filter === 'rack'` sends `owned: true`, and `searchCellar` restricts the candidate set to `owned === true`. Results are only bottles on hand.
- **"All" / kind search = ownership-aware, not filtered.** The projection sent to the model carries an `owned` flag per entry, and the prompt states the cellar mixes on-hand and not-on-hand bottles. For drink-now/occasion requests the model prefers on-hand bottles but may still surface a strong non-owned match. Nothing is excluded.
- **Availability is rendered deterministically, not by the model.** The reason text describes fit only; the UI shows a per-tile availability tag ("In your rack" vs "You'll need a bottle") computed from `entry.owned`. This keeps availability accurate regardless of model phrasing and avoids the model asserting ownership it might get wrong. The tag is shown only during a whole-cellar search (`showAvailability = hasQuery && filter !== 'rack'`); in rack-only search every result is owned, so the tag and the photo owned-dot are suppressed as redundant.

This touches only the `owned` axis; `tasted` and the taste profile are unaffected.

## Relationship to the Roadmap

This is the first shipped slice of the **Cellar Intelligence** lane. It stands alone (needs only the existing cellar) and lays groundwork for later intelligence features (leanings, gaps, nudges) by proving the pattern of reasoning over a projection of the user's own entries.
