# Requirements Document

## Introduction

Smart Scan Frontend removes the manual mode toggle from the Home capture surface and replaces it with a single-path flow that calls the unified `smartScan` SSE endpoint. The backend classifies the subject and routes to identification or pairings automatically. The frontend's job is to consume the SSE stream, render the correct result surface based on routing metadata emitted early in the stream, offer single-tap overrides when the user disagrees with the classification, handle editable identity fields before save, and degrade gracefully when context expires or the stream errors.

This spec also covers the migration seam from the `@mindstudio-ai/interface` SDK to a direct fetch-based SSE client that POSTs to the self-hosted Hono backend, and the replacement of `platform.uploadFile` with the server's own upload endpoint.

## Glossary

- **SSE_Client**: The fetch-based streaming client that POSTs to the backend's `/api/smartScan` endpoint and parses Server-Sent Events, replacing the MindStudio SDK's `createClient` and `onStreamData` mechanism.
- **Routing_Metadata**: The early `partialResult` event emitted by the SSE stream containing `{ mode: 'identify' | 'pair', ambiguous: boolean, confidence: 'high' | 'medium' | 'low' }`, used to select which result surface to render.
- **Result_Surface**: The UI surface shown after a scan completes: either an Identification_Card (when mode is identify) or Pairings_View (when mode is pair).
- **Identification_Card**: The single editorial scan result card displaying identity fields, editorial context, and a save action.
- **Pairings_View**: The editorial pairings result displaying a summary and recommendation cards.
- **Override_Action**: A single-tap control on a Result_Surface that re-calls `smartScan` with `forceMode` set to the opposite branch, reusing the captured image or text from session state.
- **Session_Context**: The image URL or text input captured during the current scan session, held in frontend memory state for reuse by overrides and the pending-save flow.
- **Identity_Fields**: The editable fields on an Identification_Card: name, producer, region, vintage, and kind.
- **Confidence_Level**: The identification certainty (`high`, `medium`, or `low`) reported in Routing_Metadata and on the Identification_Card.
- **Upload_Client**: The frontend mechanism that uploads a captured image to the server's upload endpoint and returns a URL, replacing `platform.uploadFile`.
- **Capture_Surface**: The Home route with the viewfinder, shutter, voice, and text inputs where the user initiates a scan.
- **Pending_Save**: The pattern where an Identification_Card (including user edits) is held in frontend session state when a save is initiated by an anonymous user, replayed after successful authentication.

## Requirements

### Requirement 1: Replace the mode toggle with unified smartScan

**User Story:** As a user, I want to capture without choosing a mode first, so that the app figures out my intent from what I show it.

#### Acceptance Criteria

1. THE Capture_Surface SHALL NOT display a mode toggle or any control requiring the user to choose between identification and pairings before initiating a scan.
2. WHEN the user initiates a scan via photo capture, photo library pick, text input, or voice input, THE SSE_Client SHALL POST the captured input to the `/api/smartScan` endpoint as a single request.
3. WHEN a scan is initiated, THE SSE_Client SHALL include the user's depth preference and the captured image URL or text in the request body.
4. WHEN a scan is initiated via voice input, THE Capture_Surface SHALL transcribe the voice to text before passing it to the SSE_Client as the text parameter.

### Requirement 2: Consume the SSE stream and render the routed surface

**User Story:** As a user, I want to see the correct result type as soon as the backend decides, so that there is no jarring layout change mid-stream.

#### Acceptance Criteria

1. WHEN the SSE stream emits a Routing_Metadata event, THE Result_Surface SHALL render the layout matching the reported mode (Identification_Card for identify, Pairings_View for pair) before the full data arrives.
2. WHILE the SSE stream emits status events, THE Capture_Surface SHALL display each status string in the scanning overlay.
3. WHEN the SSE stream emits partial result data after Routing_Metadata, THE Result_Surface SHALL progressively populate the rendered layout with the arriving fields.
4. WHEN the SSE stream emits the final result event, THE Result_Surface SHALL replace any partial data with the complete result including photo URLs.
5. IF the SSE stream emits an error event, THEN THE Result_Surface SHALL display the error message without exposing technical details or stack traces, and SHALL keep the Capture_Surface accessible.

### Requirement 3: Show override actions

**User Story:** As a user who disagrees with the automatic routing, I want to switch to the other intent in one tap without re-scanning, so that a misclassification costs one tap.

#### Acceptance Criteria

1. WHILE an Identification_Card is displayed, THE Result_Surface SHALL show exactly one override action labeled for requesting pairings, reachable in a single tap without scrolling.
2. WHILE a Pairings_View is displayed, THE Result_Surface SHALL show exactly one override action labeled for identifying and saving, reachable in a single tap without scrolling.
3. WHEN a user taps an override action, THE SSE_Client SHALL re-call `/api/smartScan` with the Session_Context (image URL or text) and `forceMode` set to the opposite branch, without initiating a new capture.
4. WHEN an override call completes, THE Result_Surface SHALL replace the current view with the new result matching the forced mode.
5. WHILE the Routing_Metadata indicates `ambiguous: true`, THE Result_Surface SHALL render the override action with increased visual prominence so the user knows the routing was uncertain.

### Requirement 4: Handle CONTEXT_EXPIRED error on override

**User Story:** As a user whose session context has expired, I want to be returned to the capture surface with a clear message, so that I know to scan again.

#### Acceptance Criteria

1. IF the SSE stream returns an error with code `CONTEXT_EXPIRED` during an override call, THEN THE Result_Surface SHALL navigate the user back to the Capture_Surface.
2. IF the SSE stream returns a `CONTEXT_EXPIRED` error, THEN THE Capture_Surface SHALL display a message indicating that a new capture is needed, without exposing technical error codes.
3. IF Session_Context is absent or null when the user taps an override action, THEN THE Result_Surface SHALL navigate the user back to the Capture_Surface with an indication that a new capture is needed, without calling the backend.

### Requirement 5: Editable identity fields on Identification_Card

**User Story:** As an enthusiast, I want to correct the identified details before saving, so that my cellar stays trustworthy.

#### Acceptance Criteria

1. WHEN an Identification_Card is displayed, THE Result_Surface SHALL present each Identity_Field (name, producer, region, vintage, kind) as an individually editable value before the save action is invoked.
2. THE Identity_Fields SHALL enforce the following constraints: name accepts up to 200 characters, producer accepts up to 200 characters, region accepts up to 200 characters, vintage accepts a 4-digit year between 1900 and the current calendar year plus 1, and kind accepts exactly one of wine, beer, or spirits.
3. WHILE the Confidence_Level is low, THE Identification_Card SHALL display an uncertainty indicator that is visually distinct from the state shown when Confidence_Level is not low.
4. WHILE the Confidence_Level is low, THE Identification_Card SHALL defer treating the save action as settled until the user has either confirmed the presented Identity_Fields or edited at least one Identity_Field.
5. WHEN the user edits one or more Identity_Fields and invokes the save action, THE Result_Surface SHALL send the user-edited values (not the original identification values) to the save endpoint.
6. IF the save action is invoked while the name field is empty, vintage is outside the valid range, or kind is not one of the enumerated values, THEN THE Identification_Card SHALL reject the save, present an error indication identifying the invalid field, and retain all current field edits.
7. THE Identification_Card SHALL NOT present a numeric rating field among the Identity_Fields or anywhere on the card.

### Requirement 6: Anonymous save-and-resume

**User Story:** As an anonymous user who just scanned a bottle, I want to save it without losing my result, so that sign-in does not feel like a penalty.

#### Acceptance Criteria

1. WHEN an anonymous user invokes the save action on an Identification_Card, THE Result_Surface SHALL store the Identification_Card contents (including user edits) as a Pending_Save in frontend session state and open the authentication flow.
2. WHEN the authentication flow completes successfully, THE Result_Surface SHALL replay the Pending_Save by calling the save endpoint with the stored card contents (including user edits), producing exactly one cellar entry.
3. IF the authentication flow is canceled or does not complete, THEN THE Result_Surface SHALL discard the Pending_Save without calling the save endpoint.
4. WHILE a Pending_Save is held, THE Result_Surface SHALL retain the Identification_Card contents in session state so the user can see the card throughout the authentication flow.

### Requirement 7: Migrate from MindStudio SDK to direct SSE client

**User Story:** As the development team, I want the frontend to communicate directly with the self-hosted Hono backend via fetch-based SSE, so that the app no longer depends on the MindStudio platform SDK.

#### Acceptance Criteria

1. THE SSE_Client SHALL use a fetch-based POST request to initiate SSE streams to `/api/smartScan`, parsing each `data:` line as a JSON event.
2. THE SSE_Client SHALL support the following event shapes from the stream: status events, partialResult events, final result events, and error events.
3. THE Upload_Client SHALL upload captured images to the server's upload endpoint and return a URL string, replacing `platform.uploadFile`.
4. THE SSE_Client SHALL include authentication credentials (JWT bearer token when available) in request headers.
5. IF the SSE stream returns a 401 status before opening, THEN THE SSE_Client SHALL treat the response as a sign-in trigger consistent with the anonymous-save pattern.
6. FOR ALL valid smartScan responses, parsing the SSE stream and serializing the result into the store SHALL produce an equivalent object to the final result event (round-trip property between stream parsing and store state).

### Requirement 8: Update store to remove input mode and track result mode

**User Story:** As the system, I want the store to reflect the routed result rather than a user-chosen input mode, so that the UI renders from a single source of truth.

#### Acceptance Criteria

1. THE store SHALL NOT contain an input mode field that the user sets before initiating a scan.
2. WHEN a scan completes, THE store SHALL hold a result mode value (identify or pair) derived from the Routing_Metadata, along with the ambiguous flag and Confidence_Level.
3. THE store SHALL hold the Session_Context (image URL or text) used for the current scan so that override actions can reuse it without prompting for new input.
4. THE store SHALL hold the full result data (Identification_Card data or Pairings data) so that the Result_Surface can render from store state after navigation.
5. WHEN the user navigates back to the Capture_Surface, THE store SHALL clear the previous result and session context.

### Requirement 9: Capture and upload images without platform dependency

**User Story:** As a user, I want to capture or pick a photo and have it uploaded reliably, so that scans work without the legacy platform.

#### Acceptance Criteria

1. WHEN the user captures a photo via the shutter or picks one from the library, THE Upload_Client SHALL upload the image file to the server's upload endpoint.
2. WHEN the upload completes, THE Upload_Client SHALL return the URL of the uploaded image for use as the `imageUrl` parameter in the smartScan request.
3. IF the upload fails, THEN THE Capture_Surface SHALL display an error message and retain the captured preview so the user can retry.
4. THE Upload_Client SHALL send the image as a multipart form upload.

