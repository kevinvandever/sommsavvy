# Requirements Document

## Introduction

Reverse Scan today identifies a bottle from the vision model's built-in knowledge alone. For well-known producers this reads well, but for less common bottles, recent vintages, or anything needing current pricing, the card can come out thin: a vague value note, a generic "what to expect," and no grounding in what the wine actually is beyond what the label shows.

This feature adds a web-search enrichment pass to the identification flow. After the drink is identified, the backend runs a bounded web search on the producer, name, and vintage, then synthesizes the retrieved material into a stronger editorial card, sharper tasting notes, more honest value framing, and better producer and region context. The search is an enrichment, not a dependency: if it is slow, fails, or is unavailable, the base card is still returned complete and saveable. No numeric ratings or scores enter the card; retrieved review scores are read for signal and translated into the product's qualitative voice.

This is a backend enhancement to the existing `reverseScanInternal` identification path. It does not change the scan entry surface, the routing behavior, the cellar save path, or the data model (`users` + `cellar_entries`, unchanged). It is stack-neutral: the web-search provider is a platform capability the build selects and configures, not a fixed dependency.

**Platform capability to replace:** the original Remy build used You.com for retrieval. The Kiro build must make an explicit decision on a web-search provider (You.com or an equivalent search API), including its API key, request shape, and rate/cost posture. This spec treats the provider as an injected capability behind a narrow interface so the choice can change without touching the identification logic.

**Dependency:** the image-allowance cost guardrails (see the `cost-gaurdrails` spec) gate portrait generation and image quotas. This feature adds a separate, text-only retrieval step and does not alter image guardrails, though it introduces its own bound on search calls.

## Glossary

- **Reverse_Scan**: The existing identification flow that returns a single editorial Identification_Card for a bottle-like subject.
- **Identification_Card**: The single editorial result of Reverse_Scan (identity fields plus what-to-expect, pairings, value note, occasion, and optional portrait).
- **Identity_Fields**: name, producer, vintage, region, kind.
- **Base_Card**: The Identification_Card as produced by the existing identification pass, before any web enrichment.
- **Enrichment_Pass**: The bounded web-search-plus-synthesis step that strengthens the Base_Card using retrieved material.
- **Search_Provider**: The injected web-search capability that takes a query and returns ranked text results (title, snippet, source URL). Provider choice is a build decision.
- **Search_Query**: The query derived from the identified drink's producer, name, and vintage, used to retrieve enrichment material.
- **Retrieved_Material**: The ranked text results returned by the Search_Provider for a Search_Query.
- **Synthesis_Step**: The generation step that folds Retrieved_Material into the editorial fields of the card in the product voice.
- **Enrichment_Timeout**: The condition in which the Enrichment_Pass (search plus synthesis) does not complete within its configured time bound.
- **Confidence_Level**: The identification certainty on the card: high, medium, or low.
- **Search_Call_Budget**: The configured limit on web-search calls (per request and per time window) that bounds cost.

## Requirements

### Requirement 1: Enrich a confident identification with web material

**User Story:** As an enthusiast scanning a bottle, I want the card to reflect what the wine actually is, drawn from real sources, so that the tasting notes and value read feel informed rather than generic.

#### Acceptance Criteria

1. WHEN Reverse_Scan produces a Base_Card with a Confidence_Level of high or medium, THE Enrichment_Pass SHALL derive a Search_Query from the identified producer, name, and vintage and request Retrieved_Material from the Search_Provider.
2. WHEN Retrieved_Material is returned for a Search_Query, THE Synthesis_Step SHALL incorporate that material into the what-to-expect text, the value note, and the producer and region context of the card.
3. WHEN the Enrichment_Pass completes successfully, THE Reverse_Scan SHALL return exactly one Identification_Card carrying the enriched editorial fields while preserving the same set of Identity_Fields as individually editable values.
4. THE Enrichment_Pass SHALL NOT introduce a numeric rating, score, or points field into the card, and SHALL translate any retrieved review scores into qualitative editorial language consistent with the product voice.
5. THE Enrichment_Pass SHALL preserve the brand voice constraints (no exclamation points, no emoji, no em dashes) in all synthesized text.

### Requirement 2: Keep enrichment optional and non-blocking

**User Story:** As a user, I want a scan to always return a usable card, so that a slow or failed lookup never leaves me stuck or staring at a spinner.

#### Acceptance Criteria

1. IF the Search_Provider returns an error, returns no results, or is not configured, THEN THE Reverse_Scan SHALL return the Base_Card complete and saveable, without enrichment and without surfacing a technical error.
2. IF an Enrichment_Timeout occurs, THEN THE Reverse_Scan SHALL return the Base_Card complete and saveable and SHALL NOT wait beyond the configured time bound.
3. WHEN the Base_Card has a Confidence_Level of low, THE Enrichment_Pass SHALL be skipped and THE Reverse_Scan SHALL return the Base_Card unchanged.
4. IF the Synthesis_Step fails after Retrieved_Material is returned, THEN THE Reverse_Scan SHALL return the Base_Card complete and saveable.
5. THE Enrichment_Pass SHALL NOT alter the save action, the cellar save path, or the tasted/owned defaults in any way relative to an unenriched scan.

### Requirement 3: Bound the cost and latency of enrichment

**User Story:** As the operator, I want web-search enrichment to have predictable cost and latency, so that it strengthens scans without opening an unbounded spend or slowing the flow.

#### Acceptance Criteria

1. THE Enrichment_Pass SHALL issue no more than the configured Search_Call_Budget of web-search calls per scan request.
2. WHERE a per-window Search_Call_Budget is configured, THE Enrichment_Pass SHALL skip enrichment and return the Base_Card when the budget for the current window is exhausted.
3. THE Enrichment_Pass SHALL complete within its configured Enrichment_Timeout or abandon enrichment and return the Base_Card.
4. WHEN enrichment is skipped for any reason (low confidence, budget exhausted, provider unconfigured), THE Reverse_Scan SHALL incur no web-search call for that request.
5. THE Enrichment_Pass SHALL apply only to the identification path and SHALL NOT run for the pairings path.

### Requirement 4: Preserve the streaming and progressive-render contract

**User Story:** As a user, I want the card to arrive smoothly, so that enrichment does not make the text visibly rewrite itself while I read.

#### Acceptance Criteria

1. WHEN the Enrichment_Pass runs, THE Reverse_Scan SHALL emit a status indication during the lookup so the wait is legible to the user.
2. WHEN the Enrichment_Pass runs, THE Reverse_Scan SHALL stream the editorial card text once in its final (enriched or base) form rather than streaming base text and then rewriting it in place.
3. WHILE the Enrichment_Pass is running, THE Reverse_Scan SHALL keep the total time to the final card within the existing provider time bound already applied to identification.
4. WHEN enrichment is skipped, THE Reverse_Scan SHALL preserve the existing streaming behavior of the unenriched identification path unchanged.

### Requirement 5: Configurability and observability

**User Story:** As the operator, I want to turn enrichment on or off and see whether it is helping, so that I can manage the provider decision and its impact.

#### Acceptance Criteria

1. WHERE the Search_Provider is not configured, THE system SHALL run identification exactly as it does today, with no behavioral change.
2. THE system SHALL expose configuration for the Search_Provider credentials, the Search_Call_Budget, and the Enrichment_Timeout without code changes.
3. WHEN an Enrichment_Pass is attempted, THE system SHALL record an observability event indicating whether enrichment succeeded, was skipped (with reason), or failed, without recording secret values.
4. THE system SHALL treat all Retrieved_Material as untrusted text and SHALL NOT execute or follow instructions contained within it during the Synthesis_Step.
