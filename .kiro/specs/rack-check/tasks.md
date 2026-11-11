# Implementation Plan

## Overview

This feature adds four pieces:

- **A bottle count.** An optional `bottleCount` field on cellar entries.
- **On-hand rules.** A pure server module, shared by `updateCellarEntry` and a new `recordBottleOutcomes` method.
- **Entry-page actions.** "Drank it" and "Gave it away" replace the "I have a bottle of this" switch while a bottle is on hand, with a count control and Undo.
- **A rack check sheet.** It opens from the "In the Rack" view.

These follow the user's decisions: bottle counts B1, entry actions R, and Undo kept. Every rule referenced below is defined in design.md.

## Tasks

- [x] 1. Test environment and data model
  - [x] 1.1 Add the placeholder `env` block to `server/vitest.config.ts`, as specified under "Test-only configuration change" in design.md. Confirm that `npx vitest run` in `server/` passes all 60 existing tests without a `.env` file.
  - [x] 1.2 Add `bottleCount?: number`, with its comment from design.md, to `server/src/methods/tables/cellarEntries.ts` and `web/src/types.ts`. Add `OnHandSnapshot` to `web/src/types.ts`. Leave the table defaults unchanged.
  - _Requirements: 1.1, 1.2, 5.2_

- [x] 2. On-hand rules module (server)
  - [x] 2.1 Create `server/src/methods/common/onHand.ts` with these exports:
    - `MAX_BOTTLES`
    - `isValidBottleCount`
    - `bottlesOnHand`
    - `resolveOnHandPatch`, following the resolution table exactly
    - `applyOutcome`, following rules 1 to 6
    - `OnHandSnapshot`
  - [x] 2.2 Create `server/src/__tests__/onHand.test.ts` with the pure tests listed in design.md.
  - _Requirements: 1.1 to 1.7, 2.1 to 2.5, 5.3_

- [x] 3. `updateCellarEntry` resolves the on-hand fields together
  - [x] 3.1 Update `updateCellarEntry`:
    - Reject a patch that is not an object with "Nothing to update."
    - Strip `owned` and `bottleCount` from the write.
    - When either key is in the patch, apply `resolveOnHandPatch`. On a rejection, throw before writing anything.
    - Keep `profileFields` and the regeneration rule unchanged, and extend the invariant comment.
  - [x] 3.2 Create `server/src/__tests__/updateCellarEntryOnHand.test.ts`, using the stub pattern from `anonSaveContract.test.ts`. Cover the following:
    - Patches that change only `owned`, only the count, or both never regenerate. This is a Done-when check.
    - The clearing and defaulting rules.
    - Each rejection leaves the entry unchanged.
    - A null count is ignored.
    - The Undo patch restores the entry and regenerates.
    - A notes patch still regenerates.
  - _Requirements: 1.3 to 1.7, 3.8, 3.10, 5.1, 5.3_

- [x] 4. `recordBottleOutcomes` method
  - [x] 4.1 Add `BOTTLE_OUTCOMES` to `server/src/observability/events.ts`.
  - [x] 4.2 Create `server/src/methods/recordBottleOutcomes.ts`, following the flow in design.md:
    - Require auth and enforce the batch limits.
    - Validate each item and check that the caller owns the entry.
    - Apply `applyOutcome` to each item, allowing partial success.
    - Trigger one regeneration, and only when an entry's tasted flag actually flipped.
    - Log one event with counts.
  - [x] 4.3 Register `post('/recordBottleOutcomes', recordBottleOutcomes)` in `server/src/methods/routes.ts`, after `/updateCellarEntry`.
  - [x] 4.4 Create `server/src/__tests__/recordBottleOutcomes.test.ts`. Cover the following:
    - The two Done-when outcome cases: "Drank it" leaves the entry off the rack and tasted, and "Gave it away" leaves it off the rack with tasted unchanged.
    - Entries that are already tasted, and entries with a legacy null tasted value.
    - Counts.
    - One regeneration per batch.
    - Partial success, with each rejection reason.
    - The `previous` snapshot.
    - The auth and limit errors.
  - _Requirements: 2.1 to 2.8, 4.7, 4.8, 5.1, 5.4, 5.5_

- [x] 5. Web rules module and API
  - [x] 5.1 Create `web/src/lib/onHand.ts` with these functions:
    - `bottlesOnHand`
    - `previewOutcome`
    - `applyOnHandPatch`
    - `undoPatchFor`
    - `outcomeMessage`
    - `rowStatus`
    - the rack check staging helpers
  - [x] 5.2 Create `web/src/lib/onHand.test.ts`, covering every function and every copy case.
  - [x] 5.3 Add `api.recordBottleOutcomes` to `web/src/api.ts`.
  - _Requirements: 2.1 to 2.4, 3.8 to 3.10, 4.2 to 4.5, 5.6_

- [x] 6. NoteSheet optional props
  - Make `owned` and `onOwnedChange` optional. The ownership row renders only when `onOwnedChange` is passed.
  - Add the `placeholder` and `error` props.
  - Confirm that SaveWithNote renders exactly as before.
  - _Requirements: 3.5, 3.7, 3.13_

- [x] 7. Entry page
  - [x] 7.1 Create `web/src/components/OnHandCard.tsx`, with:
    - the two states, plus the count control and the outcome buttons
    - the caption slot, which shows Undo when one is available
    - the error line
    - the `.edet__own*` styles moved over from EntryDetail and renamed `.onhand*`
  - [x] 7.2 Wire up `web/src/routes/EntryDetail.tsx`:
    - Add the `commit` helper, which writes through `upsertEntry`.
    - Add the `turnOn`, `changeCount`, `recordOutcome`, `runUndo`, and `saveDrankNote` handlers. Each uses the busy flag, the snapshots, the rollbacks, and the messages from design.md.
    - Open NoteSheet after "Drank it", with the drank placeholder and without the ownership row.
    - Remove the old inline card.
  - _Requirements: 3.1 to 3.12, 5.6_

- [x] 8. Rack check
  - [x] 8.1 Create `web/src/components/RackCheckSheet.tsx`, with:
    - rows snapshotted on open via `useStore.getState()`
    - the review stage
    - a blocking sheet while saving
    - the done stage, with the summary, the links to bottles marked "Drank it", and the rejected rows
  - [x] 8.2 In `web/src/routes/Cellar.tsx`, add the rack bar ("{n} bottles on hand" and "Rack check") and render the sheet. Show the bar only in the "In the Rack" view and only when at least one entry is on hand.
  - _Requirements: 4.1 to 4.12, 5.6_

- [x] 9. Import confirmation copy
  - Replace the done-state lede in `web/src/components/ImportSheet.tsx` with the import copy from the table in design.md.
  - _Requirements: 1.9, 5.6_

- [x] 10. Roadmap and spec bookkeeping
  - [x] 10.1 Update `src/roadmap/kiro-roadmap.md`:
    - Set "Last updated" to the current month.
    - Set "Currently building" to "Rack check (first slice of Tasted vs Owned), spec `.kiro/specs/rack-check`".
    - Under Next, tag Tasted vs Owned `in progress`. Add a "First slice: Rack check" bullet stating:
      - what it adds: the rack check, "Drank it" and "Gave it away", and bottle counts
      - the user's decisions: B1 and R
      - that it adds one optional field, `bottleCount`, to `cellar_entries`
      - that "Drank it" is the first UI path that marks a bottle tasted, which closes the bulk-import follow-up
      - the spec path
    - Keep the item in Next. Shipped means merged and verified in production.
    - Do not touch the Remy files in `src/roadmap/`.
  - [x] 10.2 In `.kiro/specs/cellar-bulk-import/tasks.md`, under "Candidate follow-ups", mark the "Easy mark tasted on owned/imported entries" bullet as covered. Keep the original text and append: "**Covered** by `.kiro/specs/rack-check`: Drank it on the entry page marks the bottle tasted and takes it off the rack in one tap."
  - _Requirements: none (bookkeeping requested in the brief)_

- [x] 11. Verify
  - Run every command in "Verification Commands" in design.md and confirm the expected results. Under `web/tsconfig.app.json`, the two pre-existing errors must be the only errors.
  - If a browser is available, run these manual checks:
    - Entry not on hand: turning the switch on shows "In the rack", 1 bottle, and "In the rack. Undo". Undo returns the card to the switch.
    - Raise the count to 3, then tap "Drank it". The card shows 2 bottles and "One down. 2 left.", and the note sheet opens without the ownership row. Tap Skip, then Undo. The card is back to 3 bottles, and tasted is back to its earlier value.
    - "Gave it away" on the last bottle shows the switch, off, with "Off the rack. Undo".
    - A note written after "Drank it" appears below the existing notes, separated by a blank line.
    - Rack check: open it from "In the Rack", mark rows, then tap "Never mind". Nothing changes. Open it again, mark rows, and confirm. The mosaic updates, and each link on the done screen opens its entry.
    - The save flow's note sheet still shows "I have a bottle of this".
  - _Requirements: all_

## Notes

- **User decisions:** B1 (optional count, one bottle per outcome, bulk import unchanged), R (the switch only while a bottle is not on hand), and Undo after each entry-level action.
- **Done-when tests:** the "Drank it" and "Gave it away" outcome tests are in `recordBottleOutcomes.test.ts`. The test showing that `owned`-only changes trigger no regeneration is in `updateCellarEntryOnHand.test.ts`.
- **Data model:** no new tables, and one new optional field, with no migration or backfill. The table defaults are unchanged. Readers treat an absent count as 1 while the entry is on hand.
- **Vitest config:** the `server/vitest.config.ts` change is test-only. It lets the suite run without `.env`, and tests never connect to a database.
- **Web typecheck:** `npx tsc --noEmit` in `web/` checks no files. Use `-p tsconfig.app.json` for the real check.
- **Voice:** all copy follows the brand voice: no exclamation points, no emoji, no em dashes, and no score language.
- **No optional tasks:** every test is required, because the brief's Done-when depends on them.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "4.1", "6", "9"] },
    { "id": 1, "tasks": ["2.1", "5.1", "5.3"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.2", "5.2", "7.1"] },
    { "id": 3, "tasks": ["3.2", "4.3", "4.4", "7.2", "8.1"] },
    { "id": 4, "tasks": ["8.2", "10.1", "10.2"] },
    { "id": 5, "tasks": ["11"] }
  ]
}
```
