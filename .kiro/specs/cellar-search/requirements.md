# Requirements Document

## Introduction

The cellar search today is a substring filter. It matches literal characters against name, producer, region, and notes. Ask it for "a nice red for my anniversary dinner" and it finds nothing, because none of those words appear in the entries. The prompt already invites a real question ("What are you looking for, Kevin?"), but the machinery behind it only does keyword matching, so the invitation overpromises.

This feature makes the cellar search understand intent. A person can ask in their own words, "a nice red to go with a salmon dinner," "something I noted was smoky," "a bottle for a celebration", and the search interprets the request against everything it knows about their cellar: identity, region, kind, editorial notes, pairings, occasion, and the user's own tasting notes. It returns a curated, ranked subset of the bottles they already own, each with a short reason it fits. It never invents bottles the user does not have, and it never reduces a wine to a score. When nothing genuinely fits, it says so warmly rather than forcing a stretch.

This is a first, concrete slice of the Cellar Intelligence lane on the roadmap. It builds on the existing cellar (`cellar_entries`) and email-code auth, adds no new tables, and keeps the existing filter chips and the search input's placement and voice. Only the interpretation behind the input changes, plus a new backend capability to serve it. It is stack-neutral: the interpretation runs through an AI orchestration call the build implements however it chooses.

**Platform capability to note:** interpreting a natural-language query against the cellar is a new AI orchestration call. The build decides the model and prompt; this spec specifies only the capability and its contract.

## Glossary

- **Cellar**: The user's persistent set of saved drinks (`cellar_entries`); the only persistent artifact and the source of the taste profile.
- **Cellar_Entry**: One saved drink, carrying identity (name, producer, region, vintage, kind), editorial fields (what-to-expect / whyText, pairings, occasion, value note), user notes, and the tasted/owned axes.
- **Cellar_Search**: The capability that interprets a natural-language query and returns a ranked subset of the user's own Cellar_Entries with a reason for each.
- **Search_Query**: The user's free-text request typed into the cellar search input.
- **Keyword_Filter**: The existing substring match over name, producer, region, and notes.
- **Match_Result**: One returned Cellar_Entry paired with a short editorial reason it fits the Search_Query.
- **Result_Set**: The ordered list of Match_Results returned for a Search_Query.
- **Empty_Result**: The state where no Cellar_Entry meaningfully fits the Search_Query.
- **Filter_Chips**: The existing All / Wine / Beer / Spirits / In the Rack controls above the search input.
- **Depth_Preference**: The user's beginner / enthusiast / expert setting, applied to the voice of the reasons.

## Requirements

### Requirement 1: Interpret a natural-language cellar query

**User Story:** As an enthusiast standing in front of my rack, I want to ask for what I feel like in plain language, so that the cellar answers the way a knowledgeable friend would rather than making me guess keywords.

#### Acceptance Criteria

1. WHEN a signed-in user submits a Search_Query that expresses intent (an occasion, a food pairing, a mood, or a taste characteristic), THE Cellar_Search SHALL interpret the query against the user's Cellar_Entries using their identity, region, kind, editorial fields, pairings, occasion, and user notes.
2. WHEN Cellar_Search interprets a Search_Query, THE Cellar_Search SHALL return a Result_Set drawn exclusively from the user's own Cellar_Entries and SHALL NOT include any drink the user has not saved.
3. WHEN Cellar_Search returns a Result_Set, THE Cellar_Search SHALL attach to each Match_Result a short reason, in the product voice, explaining why that entry fits the Search_Query.
4. WHEN a Result_Set is returned, THE Cellar_Search SHALL order it so that the entries judged the best fit for the Search_Query appear first.
5. THE Cellar_Search SHALL NOT introduce a numeric rating or score for any entry in the Result_Set.
6. WHERE the user has a Depth_Preference set, THE reason text on each Match_Result SHALL follow that depth's voice, and anonymous or unset users SHALL receive the enthusiast default voice.
7. THE reason text SHALL follow the brand voice constraints (no exclamation points, no emoji, no em dashes).

### Requirement 2: Ground results in the cellar and refine on more detail

**User Story:** As a user, I want to add detail and have the suggestions tighten, so that "a nice wine" and then "a nice wine for salmon" feel like a conversation, not two unrelated searches.

#### Acceptance Criteria

1. WHEN a Search_Query names or implies a kind, region, or characteristic that some Cellar_Entries satisfy, THE Cellar_Search SHALL prefer those entries over entries that do not.
2. WHEN a subsequent Search_Query adds constraints to a prior request, THE Cellar_Search SHALL evaluate the new query against the full Cellar independently, returning results consistent with the added constraints.
3. WHEN the active Filter_Chips restrict the Cellar to a kind or to owned bottles, THE Cellar_Search SHALL interpret the Search_Query only against the entries permitted by the active Filter_Chips.
4. WHEN a Search_Query references the user's own tasting notes (for example a remembered descriptor), THE Cellar_Search SHALL consider the notes field of Cellar_Entries when selecting the Result_Set.
5. IF a Search_Query is empty or whitespace, THEN THE Cellar_Search SHALL NOT run interpretation and THE Cellar SHALL display the entries permitted by the active Filter_Chips as it does today.

### Requirement 3: Handle no-fit gracefully

**User Story:** As a user, I want an honest answer when nothing fits, so that I trust the suggestions I do get.

#### Acceptance Criteria

1. IF no Cellar_Entry meaningfully fits the Search_Query, THEN THE Cellar_Search SHALL return an Empty_Result with a warm message rather than forcing an ill-fitting entry into a Result_Set.
2. WHEN an Empty_Result is shown, THE Cellar SHALL keep the Search_Query editable and the Filter_Chips available so the user can adjust without starting over.
3. IF interpretation cannot be completed (provider error or timeout), THEN THE Cellar_Search SHALL fall back to the existing Keyword_Filter for the same Search_Query and SHALL indicate that a simpler match was used, without exposing technical error details.
4. WHEN the user clears the Search_Query, THE Cellar SHALL restore the unfiltered view permitted by the active Filter_Chips.

### Requirement 4: Keep it fast, bounded, and private

**User Story:** As the operator, I want intelligent search to be responsive and bounded, so that it helps without adding latency spikes or unbounded cost.

#### Acceptance Criteria

1. WHEN a Search_Query is submitted, THE Cellar_Search SHALL return a Result_Set or an Empty_Result within a configured time bound, and on exceeding it SHALL fall back to the Keyword_Filter.
2. THE Cellar_Search SHALL operate only on the requesting user's own Cellar_Entries and SHALL NOT read or return another user's entries.
3. THE Cellar_Search SHALL require a signed-in user, consistent with the existing cellar, and SHALL NOT run for anonymous sessions.
4. WHERE the interpretation capability is unavailable or unconfigured, THE Cellar SHALL continue to serve the existing Keyword_Filter with no behavioral regression.
5. THE Cellar_Search SHALL send only the requesting user's cellar data necessary for interpretation and SHALL NOT transmit it to any destination other than the interpretation capability.

### Requirement 5: Preserve the existing surface and feel

**User Story:** As a returning user, I want the cellar to look and feel the same, so that the search just quietly gets smarter.

#### Acceptance Criteria

1. THE Cellar_Search SHALL reuse the existing search input, its personalized placeholder, and its placement above the mosaic without introducing a separate search screen.
2. WHEN a Result_Set is displayed, THE Cellar SHALL present the matching entries in the existing mosaic layout.
3. WHILE a Search_Query is being interpreted, THE Cellar SHALL show a non-blocking progress indication consistent with the existing loading treatment.
4. THE Filter_Chips SHALL continue to function as they do today and SHALL compose with the Search_Query per Requirement 2.3.
