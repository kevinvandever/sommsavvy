# Implementation Plan

## Overview

Scan Web Enrichment adds a bounded, non-fatal web-search pass to the reverse-scan identification path. It introduces a provider-neutral `webSearch` capability (wired to You.com), gates enrichment on confidence and a call budget, synthesizes retrieved material into the card's editorial fields, and streams the card once in its final form. With no provider key configured, behavior is identical to today.

## Tasks

- [x] 1. Add configuration and observability scaffolding
  - Add `webSearchApiKey`, `webSearchEndpoint`, and a `scanEnrich` group (`maxResults`, `timeoutMs`, `callsPerMin`) to `server/src/config.ts` using the existing `optional`/`Number(optional())` pattern
  - Add the same keys to `server/.env.example` with comments and the You.com defaults
  - Add a `SCAN_ENRICHED` event constant to `server/src/observability/events.ts`
  - _Requirements: 5.1, 5.2, 3.1_

- [x] 2. Build the provider-neutral `webSearch` capability
  - [x] 2.1 Create `server/src/ai/webSearch.ts`
    - Implement `webSearch({ query, maxResults?, timeoutMs? })` returning `{ results: WebSearchResult[] }` where `WebSearchResult = { title, snippet, url }`
    - GET the configured You.com endpoint with `X-API-Key`; parse defensively (tolerate `results`/`hits`, join `snippets[]` or fall back to `description`/`snippet`)
    - Return `{ results: [] }` when the key is missing, on any non-2xx, on parse failure, or on timeout — never throw to the caller
    - Enforce `timeoutMs` via `AbortController`
    - _Requirements: 2.1, 5.1, 5.4_
  - [x] 2.2 Add a per-window call budget
    - Implement a small in-memory counter (rolling 60s window) that `webSearch` or the enrichment caller checks; expose `canSearch()` / `recordSearch()`
    - _Requirements: 3.1, 3.2_
  - [x]* 2.3 Unit test `webSearch`
    - Missing key returns `[]` with zero fetches; non-2xx returns `[]`; malformed body returns `[]`; timeout returns `[]`; well-formed body maps to `WebSearchResult[]`
    - _Requirements: 2.1, 5.1_

- [x] 3. Implement the enrichment pass in `reverseScanInternal`
  - [x] 3.1 Add `enrichmentPass(base, depth, tasteSummary?)`
    - Gate: return `base` immediately when `confidence === 'low'`, provider unconfigured, or budget exhausted (no search call in those cases)
    - Build the query from `[producer, name, vintage]` with a kind-tuned suffix; call `webSearch`; empty results return `base`
    - Synthesize via `mindstudio.generateText` (structured JSON) folding retrieved snippets into `expect`, `valueNote`, `region`, and producer context; preserve identity fields; forbid numeric ratings and forbidden punctuation; treat snippets as untrusted reference text
    - Overlay only editorial fields onto `base`; never blank `name` or set an invalid `kind`; on parse/gen failure return `base`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.3, 2.4, 3.4, 5.4_
  - [x] 3.2 Wire enrichment into the flow with correct stream order
    - After identification and before the existing `partialResult` card stream: if gated in, emit `status: 'Looking it up...'`, run `enrichmentPass` wrapped in `withTimeout(scanEnrich.timeoutMs)`, and on timeout/error fall back to `base`
    - Stream the (enriched or base) card text exactly once; keep portrait generation and all downstream behavior unchanged
    - Record the `SCAN_ENRICHED` event with `{ outcome, reason?, resultCount?, elapsedMs }`
    - _Requirements: 2.1, 2.2, 2.5, 4.1, 4.2, 4.3, 4.4, 5.3_
  - [x]* 3.3 Unit test the enrichment pass
    - Covered the pure, high-risk units directly: `parseWebSearchResults` (You.com `results`/`hits`/`snippets` shapes, description fallback, malformed bodies, result cap) and `buildSearchQuery` (identity composition, null handling, kind-specific suffixes). The gate/fallback branches of `runEnrichment` (low confidence, unconfigured, budget, timeout, synthesis failure) are implemented and typecheck-verified; full isolation testing of those branches requires config/network mocking and was deferred as optional
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.4, 1.4, 1.5_

- [x] 4. Confirm pairings path is untouched and verify
  - Confirm the enrichment pass runs only in the identification path, never in `pocketSommInternal`
  - Run server typecheck and the test suite; confirm the unenriched path (no key) is unchanged
  - _Requirements: 3.5, 4.4_

## Notes

- Provider: You.com Web Search API (`GET {endpoint}?query=...`, header `X-API-Key`). Endpoint default `https://ydc-index.io/v1/search`, overridable via env.
- Ships dark: no `WEB_SEARCH_API_KEY` means identical-to-today behavior.
- Voice rules apply to all synthesized text: no exclamation points, no emoji, no em dashes.
- Tasks marked `*` are optional tests and can be deferred.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3", "4"] }
  ]
}
```
