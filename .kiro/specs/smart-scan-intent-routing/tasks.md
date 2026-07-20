# Implementation Plan

## Overview

Smart Scan adds a single `smartScan` entry method that classifies a captured subject inside the existing analysis pass and routes to identification-and-capture (`reverseScan`) or pairings (`pocketSomm`) with no extra user step and no extra AI round-trip. It reuses the existing SSE streaming, portrait gating, guardrails, save path, and fire-and-forget taste regeneration. The `cellar_entries` table already carries `tasted`/`owned` with the correct defaults, so no schema change is required.

## Tasks

- [x] 1. Add subject classification to the analysis layer
  - Extend the vision analysis prompt in `server/src/ai/index.ts` so its structured JSON return includes `subjectClass` valued `bottle-like | pairing-like | ambiguous | none`, alongside the existing card fields
  - Extend the text path so a typed subject is classified in the same `generateText` call
  - Parse and type the new field with no extra provider dependency and no extra AI call
  - _Requirements: 2.1_

  - [ ]* 1.1 Unit test classification parsing
    - Feed stubbed analysis responses and assert `subjectClass` is parsed for each value
    - _Requirements: 2.1_

- [x] 2. Refactor reverseScan and pocketSomm into reusable internal functions
  - Extract the identification logic in `server/src/methods/reverseScan.ts` and the pairings logic in `server/src/methods/pocketSomm.ts` into internal functions callable by a router, preserving existing SSE streaming, portrait gating, and guardrail behavior
  - Keep the existing endpoints working unchanged
  - _Requirements: 2.2, 2.3_

- [x] 3. Implement the smartScan classify-and-route entry method
  - [x] 3.1 Create `server/src/methods/smartScan.ts` as an `sseMethod` accepting `{ imageUrl?, text?, depth?, forceMode?: 'identify' | 'pair' }`
    - Run one analysis pass, read `subjectClass`, and route: `bottle-like | ambiguous | none` to the reverse-scan internal function; `pairing-like` to the pocket-somm internal function
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 3.2 Carry routing metadata in the streamed result
    - Include a `mode` discriminator (`identify | pair`), `confidence`, and an `ambiguous` flag in `partialResult`/`result` so the client renders the right surface and a prominent override on ambiguous
    - _Requirements: 2.5, 4.2_

  - [x] 3.3 Register `smartScan` as an `sseMethod` route in `server/src/methods/routes.ts`
    - Inherit the existing per-IP rate limit and `401 sign_in_required` anonymous gate
    - _Requirements: 2.1_

- [x] 4. Harden the save path for scan captures
  - [x] 4.1 Add vintage range validation to `server/src/methods/saveCellarEntry.ts`
    - Reject a save when `vintage` is present and outside 1900 to current year + 1, with a friendly message and no row created
    - _Requirements: 4.5_

  - [x] 4.2 Set scan flags explicitly on save
    - Add `tasted`/`owned` to `SaveInput` and set `source: 'scan'`, `tasted: true`, `owned: false` on the scan path so behavior does not rely on table defaults alone
    - _Requirements: 1.3_

  - [ ]* 4.3 Unit test save flags and validation
    - A valid scan save yields exactly one entry with `source=scan`, `tasted=true`, `owned=false` (Property 1)
    - Invalid name, out-of-range vintage, or invalid kind is rejected with no row (Property 8)
    - _Requirements: 1.3, 4.5_

- [x] 5. Preserve taste-regeneration invariants
  - Confirm `runTasteSummaryRegen` fires only on saves, derives from tasted entries only, and is never invoked by toggling `owned`
  - _Requirements: 1.4_

  - [ ]* 5.1 Property test regen invariants
    - Over sequences of `owned` toggles, regen is never triggered (Property 2)
    - A `tasted=true` save triggers exactly one fire-and-forget regen
    - _Requirements: 1.4_

- [x] 6. Enforce the identification-card contract and edited-value persistence
  - Ensure the identify path exposes editable identity fields (`name`, `producer`, `region`, `vintage`, `kind`) and contains no numeric rating field
  - Ensure the save persists client-supplied values, not the original model guess, and that they survive re-fetch
  - _Requirements: 4.1, 4.3, 4.4, 4.6_

  - [ ]* 6.1 Property test edit persistence
    - Any valid edit to an identity field is the value persisted and returned on re-fetch (Property 4)
    - _Requirements: 4.4_

- [x] 7. Implement override handling
  - Make `smartScan` honor `forceMode` by bypassing classification and running the specified branch against the supplied `imageUrl`/`text`, initiating no new capture
  - Return a recoverable "capture again" signal when context is missing
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [ ]* 7.1 Unit test override behavior
    - `forceMode='pair'` on an identified subject returns pairings from the same context; `forceMode='identify'` on a paired subject returns the card; missing context yields the recovery signal
    - _Requirements: 3.3, 3.4, 3.6_

- [x] 8. Implement failure and recovery paths
  - [x] 8.1 Unrecognized subject
    - Return a recoverable message inviting a clearer photo or typed name, with no card and no image counter increment
    - _Requirements: 5.1, 5.2_

  - [x] 8.2 Provider error or 30-second timeout
    - Emit a single friendly `{ error }` event with no stack trace, and create no entry
    - _Requirements: 5.3, 5.4_

  - [x] 8.3 Portrait unavailable
    - Return the complete text card with the portrait absent and keep the save action available
    - _Requirements: 5.5, 5.6, 5.7_

  - [ ]* 8.4 Property test failure paths
    - Failed scans never create entries (Property 3); failed identification never increments the image counter (Property 6); a portrait-absent card is still saveable (Property 7)
    - _Requirements: 5.2, 5.4, 5.7_

- [x] 9. Cover the anonymous save-and-resume contract
  - Confirm the server returns `401 sign_in_required` on an anonymous save, a replayed save after authentication produces exactly one entry, and a canceled sign-in produces none (resume orchestration is frontend-side; the server contract is the integration point)
  - _Requirements: 1.5, 1.6, 1.9_

  - [ ]* 9.1 Property test resume idempotency
    - A pending card saved after successful sign-in yields exactly one entry; a canceled sign-in yields zero (Property 9)
    - _Requirements: 1.6, 1.9_

- [x] 10. Property-based test harness and routing determinism
  - [x] 10.1 Wire or extend the project's property-based testing setup so Properties 1 through 9 run against stubbed analysis/model responses, integrated into the existing test command
    - _Requirements: all Correctness Properties_

  - [ ]* 10.2 Deterministic routing property test
    - For a fixed analysis response with a given `subjectClass`, routing always resolves to the same branch (`bottle-like | ambiguous | none -> identify`; `pairing-like -> pair`) (Property 5)
    - _Requirements: 2.2, 2.3, 2.4, 2.6_

## Notes

- Tasks marked with `*` are optional test tasks and can be deferred for a faster path to a working flow
- No schema change: `cellar_entries` already defines `tasted`/`owned` with defaults `{ tasted: true, owned: false }`
- `kind` uses the codebase enum `wine | beer | spirits`; reconcile the requirements' `spirit` wording to `spirits`
- Vintage range validation (Task 4.1) is a genuine gap in the current `saveCellarEntry`
- `smartScan` reuses existing SSE, portrait gating, guardrails, and fire-and-forget regen rather than reimplementing them
- Anonymous resume and override are frontend-orchestrated; the server exposes the contract they build on

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "4.1", "4.2", "10.1"] },
    { "id": 1, "tasks": ["1.1", "3.1", "4.3", "5", "6"] },
    { "id": 2, "tasks": ["3.2", "3.3", "5.1", "6.1", "9"] },
    { "id": 3, "tasks": ["7", "8.1", "8.2", "8.3", "9.1"] },
    { "id": 4, "tasks": ["7.1", "8.4", "10.2"] }
  ]
}
```
