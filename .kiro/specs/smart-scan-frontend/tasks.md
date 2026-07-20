# Implementation Plan

## Overview

Smart Scan Frontend rewires the web client to the unified `smartScan` backend. It replaces the MindStudio `@mindstudio-ai/interface` SDK with a fetch-based SSE client and a multipart upload client, removes the pre-capture mode toggle, renders the result surface from routing metadata, adds editable identity fields with validation, wires one-tap overrides that reuse captured context, and preserves the anonymous save-and-resume flow. The persisted store slice (`depth`, `theme`, `hasSeenWelcome`) is unchanged; session context stays in memory.

## Tasks

- [x] 1. Build the transport layer that replaces the MindStudio SDK
  - [x] 1.1 Create the SSE client `web/src/lib/sse.ts`
    - Implement `streamSmartScan(body, handlers, signal?)`: fetch POST to `/api/smartScan`, read `response.body` via a reader + `TextDecoder`, buffer and split on blank lines, strip the leading `data:`, and parse each line as JSON
    - Classify events: top-level `status` string -> `onStatus`; `partialResult` containing `mode` -> `onRouting`; `partialResult` without `mode` -> `onPartial`; `result` -> `onResult`; `error` -> `onError`
    - Attach `Authorization: Bearer <jwt>` when a token is present; on a non-2xx before the first read, reject with `{ code: 'sign_in_required' }` for 401 and a friendly generic message otherwise
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 1.2 Create the upload client `web/src/lib/upload.ts`
    - Implement `uploadImage(file)`: multipart `FormData` POST to `/api/upload` with the bearer token, returning the URL string; throw a friendly error on failure
    - _Requirements: 7.3, 9.1, 9.2, 9.4_

  - [x] 1.3 Migrate `web/src/api.ts` off `createClient`
    - Replace the `@mindstudio-ai/interface` client with fetch-based JSON wrappers for the plain RPC methods (`saveCellarEntry`, `listCellar`, `getEntry`, `updateCellarEntry`, `removeCellarEntry`, `getMe`, `updateProfile`, `regenerateTasteSummary`, `transcribeVoice`), attaching the bearer token and mapping `401` on save to a `sign_in_required` signal
    - Expose `smartScan` built on `streamSmartScan`; remove `pocketSomm`/`reverseScan` client methods
    - _Requirements: 7.1, 7.4, 7.5_

  - [x]* 1.4 Unit test the SSE parser and upload client
    - Cover status/routing/partial/final/error classification, `data:` lines split across chunk boundaries, 401-before-stream rejection, and multipart shape + friendly upload failure
    - _Requirements: 7.1, 7.2, 7.6, 9.3_

- [x] 2. Migrate the store to routing state and session context
  - Remove `mode`/`setMode` and the split `pocketSommResult`/`scanResult`; fold `capturedImageUrl` into a memory-only `session: { imageUrl?, text? }`
  - Add `resultMode`, `ambiguous`, `confidence`, `result`, `session`, plus `setRouting`, `setResult`, `setSession`, and `clearScan`; keep the persisted slice limited to `depth`, `theme`, `hasSeenWelcome`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x]* 2.1 Unit test store transitions
    - `setRouting` sets `resultMode`/`ambiguous`/`confidence`; `clearScan` wipes result, routing, and session; store never holds a user-chosen input mode (Property 8)
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 3. Update shared types `web/src/types.ts`
  - Remove `Mode`; add `ResultMode = 'identify' | 'pair'`, `RoutingMeta`, and a `SmartScanResult` mirroring the backend contract
  - _Requirements: 8.1, 8.2_

- [x] 4. Rewire the Capture_Surface (`Home.tsx`)
  - [x] 4.1 Remove `ModeToggle` from the layout and delete `web/src/components/ModeToggle.tsx`
    - _Requirements: 1.1_

  - [x] 4.2 Unify capture to a single smartScan call
    - Photo: `uploadImage(blob)` -> set `session.imageUrl` -> `streamSmartScan({ imageUrl, depth })`; text: set `session.text` -> `streamSmartScan({ text, depth })`; voice: transcribe to text first, then the text path
    - Drive the scanning overlay from status events and navigate to `/result` on the first routing event
    - _Requirements: 1.2, 1.3, 1.4, 2.2_

  - [x] 4.3 Handle upload failure on capture
    - Show an inline error, retain the captured preview, offer retry, and make no smartScan call
    - _Requirements: 9.3_

- [x] 5. Render the routed Result_Surface (`Result.tsx`)
  - [x] 5.1 Render by `resultMode`
    - `identify` -> `ScanCard`; `pair` -> `ResultCard`; progressively populate from partial events and replace with the final result including photo URLs
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 5.2 Show a single override action per surface
    - identify: one "Pair this instead"; pair: one "Identify and save"; render with increased prominence when `ambiguous` is true
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 5.3 Implement `runOverride(target)`
    - If `session` has no `imageUrl`/`text`, route to Home with a capture-again notice and no backend call; otherwise `streamSmartScan({ ...session, forceMode: target })` and replace the surface on completion; retain the current result if the override yields nothing
    - _Requirements: 3.3, 3.4, 4.3_

  - [x] 5.4 Handle stream errors on the surface
    - Show a friendly message with no technical details and keep Home reachable; on `code === 'CONTEXT_EXPIRED'` route to Home with a capture-again notice
    - _Requirements: 2.5, 4.1, 4.2_

  - [x]* 5.5 Test surface selection and override routing
    - Correct surface per `resultMode` with exactly one override action (Property 2); prominent override on ambiguous; empty-session and `CONTEXT_EXPIRED` both route to Home (Properties 6, 7)
    - _Requirements: 2.1, 3.1, 3.2, 3.5, 4.1, 4.3_

- [x] 6. Make the identification card editable (`ScanCard.tsx`)
  - [x] 6.1 Add editable Identity_Fields
    - Present `name`, `producer`, `region` (text, max 200), `vintage` (numeric, 1900..currentYear+1, empty allowed), and `kind` (segmented `wine | beer | spirits`) as local editable state initialized from the result and never mutating the store until save; no numeric rating field
    - _Requirements: 5.1, 5.2, 5.7_

  - [x] 6.2 Low-confidence handling
    - Keep the visually distinct uncertainty indicator and treat the save action as unsettled until the user confirms or edits at least one field
    - _Requirements: 5.3, 5.4_

  - [x] 6.3 Client-side validation and edited-value save
    - Block save on empty name, out-of-range vintage, or invalid kind with a field-level error while retaining edits; build the save payload from edited values, not the original model values
    - _Requirements: 5.5, 5.6_

  - [x]* 6.4 Test editing and validation
    - Edits update local state only; invalid inputs block the save call and retain edits (Property 4); edited values flow into the payload (Property 3); low-confidence save is unsettled until confirm/edit
    - _Requirements: 5.2, 5.3, 5.5, 5.6_

- [x] 7. Preserve anonymous save-and-resume
  - Build the save payload from edited fields with `source: 'scan'`; signed-in saves once; on `401 sign_in_required` store the payload as `pendingSave`, keep the card visible, and open `AuthSheet`
  - Replay `pendingSave` exactly once on auth success; discard it on cancel
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x]* 7.1 Test resume idempotency
    - 401 opens the auth flow; success replays exactly one save (Property 5); cancel issues zero saves
    - _Requirements: 6.2, 6.3_

## Notes

- Tasks marked with `*` are optional test tasks and can be deferred for a faster path to a working flow
- `kind` uses the codebase enum `wine | beer | spirits`
- Session context is memory-only and never persisted to localStorage
- The `/api/upload` endpoint is assumed available from the backend; confirm its response shape (`{ url }`) during task 1.2
- All user-facing copy follows brand voice: no exclamation points, no emoji, no em dashes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2", "3"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1", "4.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "6.1"] },
    { "id": 3, "tasks": ["5.1", "5.2", "6.2", "6.3"] },
    { "id": 4, "tasks": ["5.3", "5.4", "7", "6.4"] },
    { "id": 5, "tasks": ["5.5", "7.1"] }
  ]
}
```
