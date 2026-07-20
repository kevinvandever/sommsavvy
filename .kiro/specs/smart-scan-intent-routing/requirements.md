# Requirements Document

## Introduction

Smart Scan removes the mode-choice the scan surface currently forces on the user. Today a person must declare intent (pairings versus identification) before the camera has seen anything, which routinely mis-routes the most common moment: an enthusiast points at a bottle they just enjoyed, expecting to identify and save it, and instead receives pairing suggestions.

This feature makes the subject of the capture decide the route. A bottle, label, or can routes to a capture-first identification flow with a one-tap path into the cellar. A dish, menu, or ingredient routes to pairings. The user can override the guess in a single tap, edit the identified details before saving, and recover gracefully when a scan fails. Because the cellar is the only persistent artifact and the sole source of the taste profile, reducing capture friction directly feeds the product's core flywheel.

This is a migration from a Remy/MindStudio implementation to a Kiro-native build. Requirements are written in stack-neutral terms and preserve the behavioral contract. This feature builds on the existing analysis/identification path, the pairings path, the cellar save path, email-code authentication, and the single taste-summary regeneration. The data model stays `users` + `cellar_entries` with no new tables.

**Dependency:** The image-allowance cost guardrails (see the `cost-gaurdrails` spec) already gate portrait generation and image quotas. This feature consumes that behavior as an existing dependency and does not redefine it.

## Glossary

- **Scan_Router**: The component that classifies a submitted scan subject and selects the destination flow (identification-and-capture or pairings) as part of the existing analysis step, without an added user step.
- **Reverse_Scan**: The identification-and-capture flow that returns a single editorial identification card for a bottle-like subject and offers a save action into the cellar.
- **Pocket_Somm**: The pairings flow that returns editorial drink recommendations for a dish-, menu-, or ingredient-like subject.
- **Identification_Card**: The single editorial result of Reverse_Scan, containing identity fields plus editorial context (what to expect, pairings, value note, occasion) and an optional bottle portrait.
- **Identity_Fields**: The set of editable fields describing the identified drink: name, producer, vintage, region, and kind.
- **Cellar**: The persistent store of a user's saved drinks; the only persistent user artifact in the MVP and the source of the taste profile. Backed by the `cellar_entries` data.
- **Cellar_Entry**: One saved drink in the Cellar, carrying `source`, `tasted`, `owned`, identity, and editorial fields.
- **Taste_Summary_Regeneration**: The single background process that regenerates the user's `tasteSummary` from the most recent tasted Cellar entries.
- **Auth_Service**: The email-code sign-in flow. Email-code only; no passwords, SMS, social, or roles.
- **Image_Guardrails**: The existing cost-guardrails behavior that gates whether a bottle portrait is generated and enforces image quotas. Owned by the `cost-gaurdrails` spec.
- **Confidence_Level**: The identification certainty reported with an Identification_Card, one of high, medium, or low.
- **Bottle-like subject**: A scan subject classified as a wine, beer, or spirit bottle, label, or retail shelf.
- **Pairing-like subject**: A scan subject classified as a dish, menu, or other food/drink-with context.
- **Provider_Timeout**: The condition in which the AI provider returns no response within 30 seconds of the request.

## Requirements

### Requirement 1: Identify and capture a bottle

**User Story:** As an enthusiast who just finished a bottle, I want to point my camera at the bottle and receive its identity with a one-tap way to save it, so that my cellar and taste profile grow without manual data entry.

#### Acceptance Criteria

1. WHEN a scan subject is classified as a bottle-like subject, THE Reverse_Scan SHALL return exactly one Identification_Card containing all five of the following fields populated: identity, what-to-expect text, pairings, a value note, and an occasion, and SHALL NOT include a numeric rating field.
2. WHEN a scan subject is classified as a bottle-like subject, THE Reverse_Scan SHALL present a single primary save action labeled for adding the drink to the Cellar.
3. WHEN a signed-in user invokes the save action on an Identification_Card, THE Cellar SHALL create exactly one Cellar_Entry with source set to scan, tasted set to true, and owned set to false.
4. WHEN a Cellar_Entry with tasted set to true is created, THE Cellar SHALL trigger a single Taste_Summary_Regeneration as a background process that does not block the user, and that regeneration SHALL derive from tasted entries only.
5. IF the user is anonymous WHEN the user invokes the save action, THEN THE Auth_Service SHALL start the email-code sign-in flow without creating a Cellar_Entry, and SHALL retain the Identification_Card contents as pending frontend-only state.
6. WHEN the email-code sign-in flow completes successfully for a save that was initiated while anonymous, THE Cellar SHALL create exactly one Cellar_Entry using the pending Identification_Card contents, with source set to scan, tasted set to true, and owned set to false.
7. IF a scan subject cannot be classified as a bottle-like subject, THEN THE Reverse_Scan SHALL NOT return an Identification_Card and SHALL return an indication that the subject was not recognized as a bottle.
8. IF creation of a Cellar_Entry fails, THEN THE Cellar SHALL NOT persist a partial Cellar_Entry, SHALL NOT trigger Taste_Summary_Regeneration, and SHALL return an indication that the save did not complete while retaining the Identification_Card contents.
9. IF the email-code sign-in flow is canceled or does not complete for a save initiated while anonymous, THEN THE Cellar SHALL discard the pending Identification_Card contents without creating a Cellar_Entry.

### Requirement 2: Route by scan subject

**User Story:** As a user, I want the app to determine whether I am asking what a subject is or what pairs with a subject, so that I do not have to pick a mode before showing the camera anything.

#### Acceptance Criteria

1. WHEN a scan is submitted as a photo or as text naming a subject, THE Scan_Router SHALL classify the subject as bottle-like or pairing-like within the existing analysis step, without an additional user prompt or step.
2. WHEN the Scan_Router classifies the subject as bottle-like, THE Scan_Router SHALL route the scan to Reverse_Scan.
3. WHEN the Scan_Router classifies the subject as pairing-like, THE Scan_Router SHALL route the scan to Pocket_Somm.
4. IF the Scan_Router determines the subject is ambiguous, THEN THE Scan_Router SHALL route the scan to Reverse_Scan.
5. WHILE an ambiguous subject is routed to Reverse_Scan, THE Reverse_Scan SHALL present the override action to switch to Pocket_Somm as a persistent, visible control requiring no scrolling or extra interaction to find.
6. IF a submitted scan is empty, unreadable, or has no discernible subject, THEN THE Scan_Router SHALL route the scan to Reverse_Scan.

### Requirement 3: Override the routing guess

**User Story:** As a user, I want to switch to the other intent when the app routes incorrectly, so that a misclassification costs one tap rather than a re-scan.

#### Acceptance Criteria

1. WHILE an Identification_Card is shown, THE Reverse_Scan SHALL display exactly one override action, reachable in a single tap, that requests pairings for the same subject through Pocket_Somm.
2. WHILE Pocket_Somm results are shown for a subject, THE Pocket_Somm SHALL display exactly one override action, reachable in a single tap, that identifies and saves the same subject through Reverse_Scan.
3. WHEN a user invokes an override action, THE system SHALL reuse the image or text context already captured for the current session without prompting for a new image or text input.
4. WHEN a user invokes an override action, THE system SHALL start the redirected flow using only the retained context and SHALL NOT initiate a new camera, voice, or text capture.
5. IF the redirected flow does not return a result, THEN THE system SHALL show an error indication that the override could not complete and SHALL retain the original result and its context so the user can remain on the current view or retry.
6. IF the already-captured context is no longer available in session state when an override action is invoked, THEN THE system SHALL show an indication that a new capture is required and SHALL return the user to the multimodal entry surface.

### Requirement 4: Correct a misidentification before saving

**User Story:** As an enthusiast, I want to fix the identified details before the entry lands in my cellar, so that my cellar and taste profile stay trustworthy.

#### Acceptance Criteria

1. WHEN an Identification_Card is shown, THE Reverse_Scan SHALL present each of the Identity_Fields (name, producer, vintage, region, kind) as an individually editable value before the save action is invoked, where name, producer, and region each accept up to 200 characters, vintage accepts a 4-digit year between 1900 and the current calendar year plus 1, and kind accepts one of the enumerated values wine, beer, or spirit.
2. WHILE the Confidence_Level of an Identification_Card is low, THE Reverse_Scan SHALL display an uncertainty indicator that is visually distinct from the state shown when the Confidence_Level is not low.
3. WHILE the Confidence_Level of an Identification_Card is low, THE Reverse_Scan SHALL defer treating the save action as settled until the user has either confirmed the presented Identity_Fields or edited at least one Identity_Field.
4. WHEN a user edits one or more Identity_Fields and then invokes the save action, THE Cellar SHALL persist the user-edited values instead of the original identification values, and SHALL retain those edited values on subsequent retrieval without reverting to the original identification values.
5. IF the save action is invoked while the name Identity_Field is empty, the vintage is outside the range 1900 to the current calendar year plus 1, or the kind is not one of wine, beer, or spirit, THEN THE Reverse_Scan SHALL reject the save, present an error indication identifying the invalid field, and retain all current field edits without creating a Cellar entry.
6. THE Reverse_Scan SHALL NOT present a numeric rating field among the Identity_Fields or as part of the Identification_Card.

### Requirement 5: Recover from failed scans

**User Story:** As a user, I want clear recovery when a scan fails, so that I am never stuck at a dead end.

#### Acceptance Criteria

1. IF no recognizable subject is detected in a submitted scan, THEN THE system SHALL return an unreadable-scan message that offers both a retake-photo option and a typed-name option.
2. WHEN no recognizable subject is detected, THE Image_Guardrails SHALL leave image counters unchanged so that no quota is charged for that failed identification.
3. IF the AI provider returns an error or a Provider_Timeout occurs, THEN THE system SHALL return a retry message that excludes technical error details and stack traces.
4. IF the AI provider returns an error or a Provider_Timeout occurs, THEN THE Cellar SHALL leave Cellar contents unchanged and SHALL NOT persist a partial or placeholder Cellar_Entry.
5. IF a bottle portrait cannot be produced because of an Image_Guardrails limit or a provider failure, THEN THE Reverse_Scan SHALL return the complete text Identification_Card with the portrait absent.
6. WHERE a bottle portrait is absent, THE Reverse_Scan SHALL keep the save action available.
7. WHEN a scan failure occurs, THE system SHALL keep the scan and typed-name entry actions available so the user is never at a dead end.
