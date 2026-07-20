# Implementation Plan

## Overview

Cellar Search replaces the substring filter behind the cellar search input with AI interpretation of natural-language queries against the user's own entries, returning owned bottles with a reason each. It falls back to the keyword filter on error, timeout, or when no text provider is configured, and reuses the existing input, chips, and mosaic.

## Tasks

- [x] 1. Add configuration
  - Add a `cellarSearch` group (`timeoutMs`, `maxCandidates`) to `server/src/config.ts` and `server/.env.example`
  - _Requirements: 4.1, 4.4_

- [x] 2. Build the `searchCellar` backend method
  - [x] 2.1 Create `server/src/methods/searchCellar.ts`
    - Require auth; load the caller's entries (same narrowing as `listCellar`), newest first; apply `kind`/`owned` from the active chips to form the candidate set
    - Empty query returns the filtered set; empty cellar returns no matches
    - Cap candidates at `maxCandidates` (most recent) before interpretation
    - _Requirements: 1.1, 2.3, 2.5, 4.2, 4.3_
  - [x] 2.2 Interpret via the AI text capability
    - Send a compact projection (id, name, producer, region, kind, vintage, occasion, pairings, whyText, notes) with the query, voice rules, and depth guidance; request `{ matches: [{ id, reason }] }`
    - Apply the user's depth voice and pass `tasteSummary` as light context only; forbid numeric ratings
    - _Requirements: 1.1, 1.3, 1.5, 1.6, 1.7, 2.1, 2.4, 4.5_
  - [x] 2.3 Ground and rank the result
    - Resolve returned ids to full entries, drop unknown ids, de-duplicate, preserve model ordering
    - _Requirements: 1.2, 1.4_
  - [x] 2.4 Timeout and keyword fallback
    - Wrap interpretation in `withTimeout(cellarSearch.timeoutMs)`; on error/timeout/unconfigured provider, run the substring keyword filter and return `usedFallback: true`
    - _Requirements: 3.1, 3.3, 4.1, 4.4_
  - [x] 2.5 Register `/searchCellar` in `routes.ts` as a plain JSON method
    - _Requirements: 4.3_
  - [x]* 2.6 Unit test grounding and fallback
    - `resolveMatches`: drops hallucinated ids, de-dupes, preserves order, tolerates bad shapes
    - `keywordFallback`: matches across name/producer/region/notes, case-insensitive, empty on no match
    - _Requirements: 1.2, 1.4, 3.3_

- [x] 3. Wire the frontend (`Cellar.tsx`)
  - [x] 3.1 Add `searchCellar` to `web/src/api.ts`
    - _Requirements: 5.1_
  - [x] 3.2 Debounced backend search with client-side filter for empty query
    - Keep the empty-query filtered view instant and client-side; debounce non-empty queries to `api.searchCellar({ query, kind, owned })`; hold prior results while a new query is in flight
    - Derive `kind`/`owned` from the active chips; on unexpected client error, degrade to a local substring match
    - _Requirements: 2.3, 3.4, 5.1, 5.4_
  - [x] 3.3 Empty result, loading, and fallback notice
    - Warm no-fit message that keeps the query editable; non-blocking "looking through your cellar" indicator; quiet note when the keyword fallback was used
    - _Requirements: 3.1, 3.2, 3.3, 5.3_
  - [x] 3.4 Surface the per-entry reason
    - Thread `reasons` through `CellarMosaic` to `CellarTile`; render a quiet caption when present
    - _Requirements: 1.3, 5.2_

- [x] 4. Verify
  - Server typecheck + suite; web typecheck + build; confirm empty query and unconfigured provider keep the existing behavior
  - _Requirements: 4.4, 5.4_

## Notes

- Uses the existing AI text provider (no new key). With no provider configured, interpretation throws and the keyword fallback serves every query.
- Grounding is structural: the model only returns ids from the provided candidate set, and entries are resolved server-side from the caller's own rows.
- Voice rules apply to reasons: no exclamation points, no emoji, no em dashes; never a numeric score.
- Task 2.6 covers the pure grounding/fallback units. Full orchestration (auth + db + provider) is integration-level and relies on the same stubbing approach used elsewhere.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["2.6", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["4"] }
  ]
}
```
