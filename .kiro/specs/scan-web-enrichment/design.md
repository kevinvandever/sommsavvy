# Design Document

## Overview

Web-search enrichment strengthens the Reverse Scan card by grounding its editorial fields in real retrieved material. The change is contained almost entirely within the server identification path (`server/src/methods/common/reverseScanInternal.ts`) plus a new provider-neutral search capability in the AI layer (`server/src/ai/`). The scan entry surface, routing, cellar save, and data model are untouched.

The flow becomes: identify (vision or text) -> [gate on confidence + budget] -> web search on the identified drink -> synthesize an enriched card from the retrieved material -> stream the final card once. When the gate fails or any step errors or times out, the existing base card is returned unchanged. This preserves the "always returns a usable card" contract that the portrait-generation step already follows.

## Architecture

### Where it plugs in

```
smartScan (routing, unchanged)
  └─ reverseScanInternal
       1. identify drink            (existing: analyzeImage / generateText)
       2. gate: confidence high|medium AND budget available AND provider configured
       3. enrichmentPass(identity)  (NEW)
            a. buildSearchQuery(producer, name, vintage)
            b. webSearch(query)      (NEW ai-layer capability, provider-neutral)
            c. synthesize(base, retrievedMaterial)  (generateText)
       4. stream final card once    (existing partialResult stream)
       5. portrait generation       (existing, unchanged)
```

### New capability: `webSearch` in the AI layer

A narrow, provider-neutral interface added alongside the existing `mindstudio.*` methods, keeping the same "one object, stable shape" convention:

```ts
export interface WebSearchArgs {
  query: string;
  maxResults?: number;   // default from config
  timeoutMs?: number;    // default from config
}

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

// Returns [] on any failure (never throws to the caller). The caller treats
// an empty array as "no enrichment available" and falls back to the base card.
async function webSearch(args: WebSearchArgs): Promise<{ results: WebSearchResult[] }>;
```

- The concrete provider (You.com or equivalent) lives behind this interface. The build picks the provider; `reverseScanInternal` never names it.
- When the provider key is absent, `webSearch` short-circuits to `{ results: [] }` so enrichment silently no-ops (Requirement 5.1).
- The provider call is wrapped in its own timeout and try/catch; it resolves to `[]` rather than rejecting, so callers stay simple.

## Components and Interfaces

### `enrichmentPass` (new internal function in `reverseScanInternal.ts`)

```ts
interface EnrichmentInput {
  base: ScanResult;          // the identified base card (no imagePrompt stripping yet)
  depth: Depth;
  tasteSummary?: string;     // reuse the same soft-context the base pass uses
}

// Returns an enriched ScanResult, or the base card unchanged on any miss.
async function enrichmentPass(input: EnrichmentInput): Promise<ScanResult>;
```

Steps:
1. **Gate.** Return `base` immediately if `base.confidence === 'low'`, if the search budget is exhausted, or if the provider is unconfigured. (Requirements 2.3, 3.2, 5.1.)
2. **Query.** `buildSearchQuery` composes `[producer, name, vintage].filter(Boolean).join(' ')` plus a small fixed suffix like `wine tasting notes review price` tuned per `kind`. Bounded to one query per request by default (Requirement 3.1).
3. **Search.** Call `webSearch({ query })`. Empty results -> return `base` (Requirement 2.1).
4. **Synthesize.** Call `mindstudio.generateText` with a prompt that carries the base card, the retrieved snippets, the voice rules, and the depth guidance, instructing the model to rewrite `expect`, `valueNote`, `region`, and `producer` context using the material, keep identity fields intact, translate any numeric scores into qualitative language, and never emit ratings (Requirements 1.2, 1.4, 4 of the base contract). Parse loosely (reuse `parseJsonLoosely`).
5. **Merge.** Overlay only the editorial fields onto `base`; never let synthesis change `kind` to an invalid value or blank out `name`. On parse failure -> return `base` (Requirement 2.4).

### Timeout composition

`enrichmentPass` is wrapped by the caller in the existing `withTimeout` helper (or an enrichment-specific bound), so search + synthesis together cannot exceed `Enrichment_Timeout`. The overall scan remains within the existing 30s provider bound (Requirement 4.3). Suggested default `Enrichment_Timeout` is 8-10s; if exceeded, the base card is returned (Requirement 3.3).

### Streaming order (the key UX decision)

The base identification pass currently streams the text card via `defaultStream({ partialResult: earlyResult })` *before* portrait generation. With enrichment, that early stream would show base text that then gets rewritten by the enriched result, reintroducing the "text changes while I read" problem that was just fixed.

**Decision: enrich before the first card stream.** The sequence is:
1. `stream({ status: 'Reading the label...' })` (existing)
2. identify
3. `stream({ status: 'Looking it up...' })` (new, covers the search wait — Requirement 4.1)
4. enrichmentPass (or skip)
5. `stream({ partialResult: finalCardText })` — streamed once, already enriched (Requirement 4.2)
6. `stream({ status: 'Pouring...' })` + portrait (existing)
7. return final card

Tradeoff: this adds the search+synthesis latency (bounded by `Enrichment_Timeout`) before the first card paint. The status message keeps the wait legible. The alternative (stream base, then patch) was rejected because it rewrites text mid-read. When enrichment is skipped, step 3-4 are omitted and the existing single-stream behavior is preserved exactly (Requirement 4.4).

## Data Models

No schema changes. `ScanResult` is unchanged; enrichment only rewrites the values of existing editorial fields. No new persisted fields, no new tables. The enriched card is saved through the identical cellar path as any scan (Requirement 2.5).

## Configuration

New `config` entries (all optional; absence disables enrichment):

```
WEB_SEARCH_API_KEY            # provider credential; unset => enrichment off
WEB_SEARCH_PROVIDER           # provider id, defaults to the chosen default
SCAN_ENRICH_MAX_RESULTS       # results fed to synthesis (default 5)
SCAN_ENRICH_TIMEOUT_MS        # Enrichment_Timeout (default 9000)
SCAN_ENRICH_CALLS_PER_MIN     # per-window Search_Call_Budget backstop (default e.g. 30)
```

These follow the existing `optional()` / `Number(optional())` pattern in `config.ts` and appear in `.env.example`. The per-window budget reuses the same in-memory counter approach as the cost-guardrails rate limiter (Requirement 3.2).

## Error Handling

| Failure | Behavior |
| --- | --- |
| Provider unconfigured | `webSearch` returns `[]`; base card returned; no call made (Req 5.1, 3.4) |
| Provider error / 4xx / 5xx | Caught inside `webSearch`; returns `[]`; base card returned (Req 2.1) |
| No results | Base card returned (Req 2.1) |
| Enrichment timeout | Base card returned; wait bounded (Req 2.2, 3.3) |
| Synthesis parse/gen failure | Base card returned (Req 2.4) |
| Low confidence | Enrichment skipped; base card returned; no call (Req 2.3, 3.4) |

All retrieved text is treated as untrusted: the synthesis prompt frames it as reference material to summarize, and prompt-injection style instructions inside snippets are ignored (Requirement 5.4). No secret values are logged (Requirement 5.3).

## Observability

Extend the existing event logging (`server/src/observability/events.ts`) with an enrichment event carrying `{ outcome: 'enriched' | 'skipped' | 'failed', reason?, resultCount?, elapsedMs }`. This makes it possible to see hit rate and latency without exposing content or keys (Requirement 5.3).

## Testing Strategy

- **Unit (gate logic):** low confidence, unconfigured provider, and exhausted budget each return the base card and issue zero search calls.
- **Unit (non-fatal paths):** provider throws, provider returns `[]`, synthesis throws, and timeout each yield the complete base card.
- **Unit (synthesis contract):** given fixture retrieved material with a numeric score, the output contains no numeric rating field and no forbidden punctuation; identity fields are preserved.
- **Unit (budget):** the (N+1)th call within a window is skipped.
- **Integration (stream order):** when enrichment runs, the card text is streamed once and equals the enriched text; a `Looking it up...` status precedes it. When skipped, the stream matches the current unenriched behavior.
- All external calls (search provider, generateText) are stubbed; no live network in tests.

## Migration and Rollout

Ships dark: with no `WEB_SEARCH_API_KEY` set, behavior is identical to today. Enable by setting the key in the target environment. Because it is gated, timeboxed, and non-fatal, it can be turned off instantly by unsetting the key with no redeploy of logic.
