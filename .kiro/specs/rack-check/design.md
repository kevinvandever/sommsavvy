# Design Document

## Overview

Rack check adds the following:

- one optional field
- one pure rules module, shared by two server methods
- one new server method
- three frontend surfaces

The scan, save, bulk import, search, and enrichment paths do not change. The one exception is the import confirmation copy.

```
Entry page (Ownership_Card)
  not on hand   "I have a bottle of this" switch   -> updateCellarEntry { owned: true }        count becomes 1
  on hand       count control [-] n [+]            -> updateCellarEntry { bottleCount: n }
                "Drank it" / "Gave it away"        -> recordBottleOutcomes { items: [one] }     NEW
                  after "Drank it": NoteSheet       -> updateCellarEntry { notes: existing + note }
  Undo (most recent on-hand action)                -> updateCellarEntry { inverse patch }

Cellar, "In the Rack" view
  "N bottles on hand" + "Rack check"               -> RackCheckSheet                            NEW
     mark rows locally (one tap = one bottle, with its outcome)
     confirm  -> recordBottleOutcomes { items: [every marked row] }   one request, at most one regen
     done     -> summary, rejected rows, links to the bottles marked "Drank it"

Server
  common/onHand.ts (NEW, pure)   bottlesOnHand, resolveOnHandPatch, applyOutcome
  updateCellarEntry              owned and bottleCount always resolved together through resolveOnHandPatch
  recordBottleOutcomes (NEW)     applyOutcome per entry, partial success, one regen only on a real tasted flip
```

The owned/bottleCount rules live in one pure module, which does two jobs. Every write path agrees on the rules, and the rules can be unit tested without a database.

## Decisions

### From the user

1. **Bottle counts: B1.** One optional numeric field. Each outcome removes one bottle, and the last one clears on hand. Bulk import is unchanged, so imported bottles read as one, and counts are fixed by hand on the entry page.
2. **Entry-level actions: R.** The "I have a bottle of this" switch shows only while the bottle is not on hand. While it is on hand, the card shows the two outcomes and the count control instead.
3. **Undo** after each entry-level action.

### Design decisions

**D1. Store the count as `bottleCount`, with absent meaning one.** The field is optional and has no table default.
- While `owned` is true, an absent or invalid value reads as 1.
- While `owned` is not true, the count reads as 0, whatever is stored.

Two alternatives were rejected:
- **A table default of 1.** It would write a count on entries that are not on hand, which contradicts the field's meaning.
- **A backfill.** It is a migration for no gain, because the reader rule already gives every legacy and imported entry the right value.

With the reader rule, `saveCellarEntry`, `saveCellarEntriesBulk`, and the MindStudio import script need no change. They never write `bottleCount`, and the entries they create cannot hold a stale count. Rows are jsonb, so there is no schema change.

**D2. The server owns the owned/bottleCount invariant, in one pure module.** Four user actions write on-hand state: the switch, the count control, an outcome, and Undo. Two server functions persist them, `updateCellarEntry` and `recordBottleOutcomes`, and both call `server/src/methods/common/onHand.ts`.

The web client mirrors these rules in `web/src/lib/onHand.ts`, but only to draw optimistic state. Every server response replaces the client's copy, so if the mirror ever drifts, the server corrects it on the next response.

**D3. Outcomes go through a dedicated batch method, not client-computed patches.** The alternative was for the client to compute `{ bottleCount: n - 1, tasted: true }` and send it through `updateCellarEntry`. It was rejected for three reasons:
- The decrement would be computed from client state that may be stale.
- A rack check would send one update per row, and each "Drank it" row would start its own taste regeneration.
- `updateCellarEntry` regenerates whenever `tasted` is in the patch, even when the value does not change.

`recordBottleOutcomes` decrements from the stored value. It regenerates once per request, and only when an entry actually went from untasted to tasted. The entry page calls it with one item, so both surfaces share one code path and one set of tests.

**D4. Undo reuses `updateCellarEntry` with an inverse patch.** For each applied item, `recordBottleOutcomes` returns the entry's `previous` state: `{ owned: true, bottleCount, tasted }`.
- Undoing an outcome sends `{ owned: true, bottleCount: previous.bottleCount }`, plus `tasted: previous.tasted` only when the outcome changed it. Undoing "Gave it away", or a "Drank it" on a bottle that was already tasted, therefore starts no regeneration.
- Undoing a switch-on sends `{ owned: false }`.

No undo endpoint is needed. This is also why "Drank it" does not stamp `tastedAt`. Restoring an absent `tastedAt` would need a way to clear a field over JSON, and `updateCellarEntry` does not have one.

**D5. The count control cannot take an entry off the rack.** The minus button stops at 1. Reaching zero takes an outcome, so every bottle that leaves the rack from the entry page leaves with a reason.

The minus button and "Gave it away" both lower the count without touching tasted. The minus button is a correction and "Gave it away" records an event, and the floor at 1 keeps the two from overlapping.

**D6. The rack check stages marks locally and commits once.** The rows are copied from the store when the sheet opens, so they do not move while the user marks them. Each tap on an outcome stages one bottle. Confirm sends `{ id, drank, gaveAway }` for each marked row.

This follows the bulk import review: nothing is written until the user commits, and the commit can succeed in part. The staging step is the rack check's safety net, so there is no Undo after confirming.

**D7. After "Drank it", reuse NoteSheet and append the note.** NoteSheet gains three optional props:
- The ownership row renders only when `onOwnedChange` is passed. Under B1, the count already covers holding another bottle.
- `placeholder` gives copy that invites "not for you".
- `error` keeps the sheet open when a save fails.

The note is appended to the existing notes, never replacing them. Notes are the journal, and a second bottle of the same wine earns a second line. The entry page needs no "+ Add a note" link to reopen the sheet, because the page's own "Your notes" field sits just below the card.

**D8. One busy flag for the Ownership_Card.** Every control on the card is disabled while any on-hand request is in flight. That window is typically one database write, under 300 ms.

A debounced count write was considered, so that quick + taps would register faster. It was rejected because an outcome tapped during the debounce window would decrement a count the server has not seen yet. Count edits are rare, so the simpler flag wins.

## Technology Stack

The stack is locked for this feature. It is the existing stack, with no new dependencies.

- **Server:** Node 20+, TypeScript (strict, `noUncheckedIndexedAccess`), Hono routes in `server/src/methods/routes.ts`, and Postgres through the jsonb adapter in `server/src/db/adapter.ts`. Tests use Vitest with the in-memory stubs in `server/src/__tests__/stubs.ts`.
- **Web:** React 19, Vite, TypeScript, Zustand (`web/src/store.ts`), wouter, and motion. Icons come from `@tabler/icons-react`: `IconBottle`, `IconGlassFull`, `IconGift`, `IconListCheck`, `IconMinus`, and `IconPlus`, all present in the installed version. Vitest covers the pure modules.
- **Nothing else new:** no tables, config keys, or environment variables, and `/recordBottleOutcomes` is the only new endpoint. The test-only Vitest change is described under Testing Strategy.

## Data Model

`cellar_entries` gains one optional field, added in both `server/src/methods/tables/cellarEntries.ts` and `web/src/types.ts`:

```ts
// Bottles physically on hand. Meaningful only while owned is true: a whole
// number from 1 to 99, read as 1 when absent (legacy and bulk-imported rows).
// While owned is not true it reads as 0 and is cleared on the next on-hand
// write. Part of the owned axis: changing it never triggers a taste regen.
// An inventory quantity, never a rating.
bottleCount?: number;
```

The table `defaults` stay `{ tasted: true, owned: false }`, and nothing is backfilled. A shared snapshot type is added to `web/src/types.ts` and exported from `server/src/methods/common/onHand.ts`:

```ts
// An entry's on-hand state just before an outcome, returned so Undo can restore it.
export interface OnHandSnapshot {
  owned: true;
  bottleCount: number; // Bottles_On_Hand before the outcome, 1..99
  tasted: boolean;     // normalized: null reads as true
}
```

**Why the new field clears the "strong reason" bar.** The user holds several bottles of some wines. Without a count, drinking one of them either wrongly empties the rack or needs a manual fix. A rack check cannot catch a wine that was wrongly dropped, because it lists only bottles on hand.

One entry per bottle was ruled out. It would duplicate tiles and search hits, split notes across copies, count a wine twice in the taste profile, and require bulk import to stop merging lines. A count costs one optional number, plus its overlap with `owned`, which D2 contains.

## Components and Interfaces: Server

### `server/src/methods/common/onHand.ts` (new, pure, type-only imports)

```ts
export const MAX_BOTTLES = 99;

// True for an integer from 1 to MAX_BOTTLES.
export function isValidBottleCount(v: unknown): v is number;

// 0 when owned !== true; else bottleCount when valid; else 1.
export function bottlesOnHand(e: { owned?: boolean | null; bottleCount?: number | null }): number;

export type OnHandResolution =
  | { ok: true; fields: { owned: boolean; bottleCount: number | undefined } | null }
  | { ok: false; reason: string };

export function resolveOnHandPatch(
  existing: { owned?: boolean | null; bottleCount?: number | null },
  patch: Record<string, unknown>,
): OnHandResolution;

export type OutcomeResolution =
  | {
      ok: true;
      patch: { owned: boolean; bottleCount: number | undefined; tasted?: true };
      previous: OnHandSnapshot;
      tastedFlipped: boolean;
    }
  | { ok: false; reason: string };

export function applyOutcome(
  existing: { owned?: boolean | null; bottleCount?: number | null; tasted?: boolean | null },
  counts: { drank?: unknown; gaveAway?: unknown },
): OutcomeResolution;
```

**`resolveOnHandPatch`** reads only `patch.owned` and `patch.bottleCount`. A key whose value is `undefined` or `null` counts as not provided. Type checks run first: a provided `owned` must be a boolean ("On hand needs to be yes or no."), and a provided `bottleCount` must pass `isValidBottleCount` ("A bottle count runs from 1 to 99."). After that:

| `owned` in patch | `bottleCount` in patch | Entry on hand now | Result |
| --- | --- | --- | --- |
| not provided | not provided | any | `fields: null` (no on-hand change) |
| `false` | not provided | any | `{ owned: false, bottleCount: undefined }` |
| `false` | provided | any | reject: "A bottle count needs the bottle on hand." |
| `true` | not provided | yes | `{ owned: true, bottleCount: bottlesOnHand(existing) }` |
| `true` | not provided | no | `{ owned: true, bottleCount: 1 }` |
| `true` | `n` | any | `{ owned: true, bottleCount: n }` |
| not provided | `n` | yes | `{ owned: true, bottleCount: n }` |
| not provided | `n` | no | reject: "A bottle count needs the bottle on hand." |

**`applyOutcome`** applies these rules in order:

1. `drank` and `gaveAway` default to 0. Each must be an integer from 0 to `MAX_BOTTLES`, and their sum must be at least 1. Otherwise reject with "Nothing to record."
2. Let `n = bottlesOnHand(existing)`. If `n === 0`, reject with "Not on hand anymore."
3. If `drank + gaveAway > n`, reject with "Only {n} on hand."
4. Let `left = n - drank - gaveAway`. The patch is `owned: left > 0` and `bottleCount: left > 0 ? left : undefined`, plus `tasted: true` when `drank >= 1`. When `drank` is 0, `tasted` is left out of the patch entirely.
5. `tastedFlipped = drank >= 1 && existing.tasted === false`. A legacy null reads as tasted, so it never flips.
6. `previous = { owned: true, bottleCount: n, tasted: existing.tasted !== false }`.

### `server/src/methods/updateCellarEntry.ts` (modified)

1. Normalize the input first. If `input.patch` is not a non-null, non-array object, throw "Nothing to update." Today an undefined patch fails inside the `in` checks with a technical message, after an empty write.
2. Build `safe` as today, stripping `userId` and `savedAt`. Also delete `owned` and `bottleCount` from `safe`.
3. If `'owned' in patch || 'bottleCount' in patch`, call `resolveOnHandPatch(existing, patch)`.
   - On `ok: false`, throw `new Error(reason)` before any write.
   - On `ok: true` with non-null `fields`, run `Object.assign(safe, fields)`.

   A `bottleCount: undefined` key makes the adapter delete the stored field, because `Table.update` deletes keys whose value is `undefined`.
4. Leave the regeneration rule unchanged. `profileFields` stays `['notes', 'tastedAt', 'kind', 'producer', 'tasted']` and is still checked against the keys of the incoming patch. Extend the invariant comment to say that `owned` and `bottleCount` form the owned axis and are deliberately absent from `profileFields`.

### `server/src/methods/recordBottleOutcomes.ts` (new)

```ts
export const MAX_OUTCOME_ITEMS = 200;

export interface BottleOutcomeItem {
  id: string;
  drank?: number;
  gaveAway?: number;
}

export interface RecordBottleOutcomesInput {
  items: BottleOutcomeItem[];
  surface?: 'entry' | 'rack_check'; // observability only
}

export interface RecordBottleOutcomesResult {
  applied: Array<{ id: string; entry: Hydrated<CellarEntry>; previous: OnHandSnapshot }>;
  rejected: Array<{ id: string; reason: string }>;
}
```

The method runs these steps:

1. If `auth.userId` is missing, throw "Sign in to edit your cellar." This is the same message `updateCellarEntry` uses, and the route maps it to 400 `method_error`.
2. Read `items = Array.isArray(input?.items) ? input.items : []`. If it is empty, throw "Nothing to update." If it is longer than `MAX_OUTCOME_ITEMS`, throw "That is more than 200 at once." Neither case writes anything.
3. Process the items one at a time, in order:
   - Trim `id`. It must be a non-empty string of at most 100 characters, otherwise reject the item with "Not a valid entry." Echo the id as `String(item?.id ?? '')`, cut to 100 characters.
   - If the id already appeared earlier in the batch, reject the item with "Listed twice."
   - Inside a try block, call `CellarEntries.get(id)`.
     - If the entry is missing or has another `userId`, reject with "Not in your cellar."
     - Otherwise call `applyOutcome(existing, item)`. Pass its reject reasons through.
     - On success, call `CellarEntries.update(id, patch)` and push `{ id, entry, previous }`.
   - If `get` or `update` throws, reject the item with "Could not be updated." and log `console.error('Bottle outcome failed:', { entryId: id }, err)`.
4. If any applied item had `tastedFlipped`, call `runTasteSummaryRegen(userId).catch((err) => console.error('Background taste regen failed:', err))` exactly once. This is the existing fire-and-forget pattern.
5. Call `logEvent(BOTTLE_OUTCOMES, { userId, surface, applied, rejected, drank, gaveAway, tastedFlipped })`. Every value except `userId` and `surface` is a count. `surface` is the input value when it is `'entry'` or `'rack_check'`, and `'unknown'` otherwise.
6. Return `{ applied, rejected }`.

Each item costs a `get` and an `update`, which is a handful of small queries. That suits realistic rack checks, which change a few rows and at most 200. Loading all the user's entries once with `filter` was considered. It would save the per-item `get`, but the shared test stub's `filter` is not awaitable, and the saving is small at this size.

### Routes and events (modified)

- `server/src/methods/routes.ts`: add `post('/recordBottleOutcomes', recordBottleOutcomes);` after `/updateCellarEntry`, as a plain JSON method.
- `server/src/observability/events.ts`: add `export const BOTTLE_OUTCOMES = 'bottle_outcomes';`.

## Components and Interfaces: Web

### `web/src/lib/onHand.ts` (new, pure)

```ts
export const MAX_BOTTLES = 99;
export type Outcome = 'drank' | 'gave_away';

export function bottlesOnHand(e: Pick<CellarEntry, 'owned' | 'bottleCount'>): number; // mirrors the server
export function previewOutcome(e: CellarEntry, outcome: Outcome): CellarEntry;        // one bottle, applyOutcome rules
export function applyOnHandPatch(e: CellarEntry, patch: Partial<CellarEntry>): CellarEntry;
export function undoPatchFor(previous: OnHandSnapshot, after: Pick<CellarEntry, 'tasted'>): Partial<CellarEntry>;
export function outcomeMessage(outcome: Outcome, left: number): string;                // Undo line copy

// Rack check staging
export interface RackRow { entry: CellarEntry; onHand: number; drank: number; gaveAway: number }
export function toRackRows(cellar: CellarEntry[]): RackRow[];
export function rowLeft(row: RackRow): number;                 // onHand - drank - gaveAway
export function stage(row: RackRow, outcome: Outcome): RackRow; // +1 to that outcome; unchanged when rowLeft is 0
export function resetRow(row: RackRow): RackRow;
export function rowStatus(row: RackRow): string | null;         // null while unmarked
export function outcomeItems(rows: RackRow[]): Array<{ id: string; drank: number; gaveAway: number }>;
export function stagedBottles(rows: RackRow[]): number;
```

The less obvious functions behave as follows:

- **`applyOnHandPatch`** mirrors `resolveOnHandPatch` for valid patches and spreads any other patch fields, such as `tasted`:
  - `owned: false` clears `bottleCount`.
  - `owned: true` uses the patch count, or else the current count if the entry is on hand, or else 1.
  - A count alone sets `owned: true`.
- **`undoPatchFor`** returns `{ owned: true, bottleCount: previous.bottleCount }`. It adds `tasted: previous.tasted` only when `previous.tasted !== (after.tasted !== false)`.
- **`toRackRows`** keeps entries with `owned === true`. It sorts them by `name`, then `producer`, using `localeCompare` with `sensitivity: 'base'`.
- **`outcomeItems`** returns only rows with at least one bottle marked.

### `web/src/api.ts` (modified)

```ts
recordBottleOutcomes(input: {
  items: Array<{ id: string; drank?: number; gaveAway?: number }>;
  surface?: 'entry' | 'rack_check';
}): Promise<{
  applied: Array<{ id: string; entry: CellarEntry; previous: OnHandSnapshot }>;
  rejected: Array<{ id: string; reason: string }>;
}> {
  return rpc('/recordBottleOutcomes', input);
},
```

### `web/src/components/NoteSheet.tsx` (modified)

- `owned` and `onOwnedChange` become optional. The hairline divider and the ownership row render only when `onOwnedChange` is passed, using `owned ?? false`. SaveWithNote still passes both, so the save flow renders exactly as before.
- New optional `placeholder?: string`. It defaults to today's placeholder text.
- New optional `error?: string`. It renders under the hint as a `t-caption` line with `role="alert"`, in the Bordeaux error color that ImportSheet uses.
- `handleSave` is unchanged. The parent decides whether the sheet closes.

### `web/src/components/OnHandCard.tsx` (new)

This component replaces the inline ownership card in EntryDetail. The `.edet__own*` styles move here, renamed to `.onhand*`, and are deleted from EntryDetail.

```ts
interface Props {
  entry: CellarEntry;
  busy: boolean;               // disables every control
  undoMessage: string | null;  // when set, the caption slot shows it plus an "Undo" button
  error: string | null;        // inline, role="alert", under the card
  onTurnOn: () => void;
  onCountChange: (next: number) => void;
  onOutcome: (outcome: Outcome) => void;
  onUndo: () => void;
}
```

The card has two states:

- **Not on hand** (`bottlesOnHand(entry) === 0`). This is today's row: bottle glyph, the label "I have a bottle of this", the caption slot, and a `Switch` with `checked={false}`. The whole row is tappable, as today. Both the row and the switch call `onTurnOn`, and both are disabled while `busy`.
- **On hand.** A header row with the bottle glyph, the label "In the rack", the caption slot, and a count control. The count control is a minus button, the count in a `tnum` span with `aria-live="polite"`, and a plus button. Minus is disabled at 1 and plus at 99, and both are disabled while `busy`. Below the header, an actions row has two buttons: "Drank it" (`IconGlassFull`) and "Gave it away" (`IconGift`). Each is at least 44 px tall and disabled while `busy`.

The caption slot keeps today's reserved two-line height, so swapping its text or showing Undo never shifts the layout.

### `web/src/routes/EntryDetail.tsx` (modified)

**New state:** `busy`, `undo: { message: string; patch: Partial<CellarEntry> } | null`, `onHandError`, `drankNoteOpen`, and `noteError`. A helper, `commit(next)`, calls `setEntry(next)` and `upsertEntry(next)`. On-hand writes use `upsertEntry`, which replaces the whole entry so cleared keys clear, instead of `patchEntry`. The existing notes-field blur save is unchanged.

**On-hand handlers.** Each one returns early if `busy`. Otherwise it saves a `snapshot` of the entry, sets `busy`, and clears `onHandError`. On a thrown error it logs with `console.error` and a short label, commits `snapshot`, and sets `onHandError`. It always clears `busy` when the request ends.

- **`turnOn`**
  1. Commit `applyOnHandPatch(entry, { owned: true })`.
  2. Call `api.updateCellarEntry({ id, patch: { owned: true } })`.
  3. On success, commit the server entry and set Undo to `{ message: 'In the rack.', patch: { owned: false } }`.
- **`changeCount(next)`**
  1. Clear Undo and commit `applyOnHandPatch(entry, { bottleCount: next })`.
  2. Send `{ bottleCount: next }` through `api.updateCellarEntry`.
  3. Commit the server entry.
- **`recordOutcome(outcome)`**
  1. Clear Undo and commit `previewOutcome(entry, outcome)`.
  2. Call `api.recordBottleOutcomes({ items: [{ id, drank: outcome === 'drank' ? 1 : 0, gaveAway: outcome === 'gave_away' ? 1 : 0 }], surface: 'entry' })`.
  3. If `applied[0]` exists:
     - Commit its entry.
     - Set Undo to `{ message: outcomeMessage(outcome, bottlesOnHand(applied[0].entry)), patch: undoPatchFor(applied[0].previous, applied[0].entry) }`.
     - For "Drank it", also clear `noteError` and open the Note_Sheet.
  4. If the item is in `rejected` instead:
     - Commit `snapshot` and set `onHandError` to the server's reason.
     - Reload the entry with `api.getEntry`. Commit the result, and ignore a failed reload.
- **`runUndo`**
  1. Commit `applyOnHandPatch(entry, undo.patch)`.
  2. Send `undo.patch` through `api.updateCellarEntry`.
  3. On success, commit the server entry and clear Undo. On failure, keep Undo so the user can try again.
- **Error messages.** A thrown error shows "That did not take. Try again?" for `turnOn`, `changeCount`, and `recordOutcome`. For `runUndo` it shows "Could not undo that. Try again?"

**Note after "Drank it": `saveDrankNote(note)`.**
1. Clear `noteError`.
2. Let `base = notes.trim()`, the page's notes field, and `combined = base ? base + '\n\n' + note : note`.
3. Await `api.updateCellarEntry({ id, patch: { notes: combined } })`.
4. On success, commit the server entry, call `setNotes(saved.notes || '')`, and close the sheet.
5. On failure, log with `console.error`, set `noteError` to "That note did not save. Try again?", and keep the sheet open with its text.

**The sheet.** The page renders:

```tsx
<NoteSheet
  open={drankNoteOpen}
  onClose={() => setDrankNoteOpen(false)}
  onSave={saveDrankNote}
  drinkName={entry.name}
  contextLine={[entry.producer, entry.region, entry.vintage].filter(Boolean).join(' · ') || undefined}
  placeholder={DRANK_NOTE_PLACEHOLDER}
  error={noteError}
/>
```

It passes no `onOwnedChange`, so the ownership row does not render. The context line uses the same format as ResultCard and ScanCard.

**Undo lifetime.** Undo state is local to the component, so it ends when the user leaves the page. Every on-hand handler except `runUndo` clears it before acting.

### `web/src/components/RackCheckSheet.tsx` (new)

**Props and stages.** Props are `{ open: boolean; onClose: () => void }`. The component renders `Sheet` with `blocking={stage === 'saving'}` and moves through three stages: `'review'`, `'saving'`, and `'done'`.

**Opening.** When `open` turns true, an effect runs `setRows(toRackRows(useStore.getState().cellar))`, sets the stage to `'review'`, and clears the error and the result. The rows are a snapshot and are not rebuilt while the sheet is open.

**Review.** The sheet shows a headline, a lede, and one row per entry. Each row shows:
- the name, and a meta line with producer and vintage
- a count line, when `onHand > 1`
- the `rowStatus` line, once the row is marked
- "Drank it" and "Gave it away" buttons, disabled when `rowLeft` is 0
- a "Reset" tertiary button, once the row is marked

The rows scroll inside the sheet with `max-height: 46dvh`, as in ImportSheet. The footer has an error line, a primary button, and "Never mind". The primary button reads "Take {k} {bottle|bottles} off the rack" and is disabled when `k = stagedBottles(rows)` is 0. "Never mind" closes the sheet and writes nothing.

**Confirm.**
1. Call `api.recordBottleOutcomes({ items: outcomeItems(rows), surface: 'rack_check' })`.
2. On success, run `upsertEntry` for each applied entry and move to `'done'`.
3. On any thrown error, log with `console.error`, set the error "Could not update the rack. Try again?", and return to `'review'` with the rows intact.

The message is fixed for two reasons. A network failure surfaces as a technical `TypeError` message. And the batch-level server errors (an empty batch, more than 200 items) cannot come from this UI.

**Done.** The headline depends on the outcome: "The rack is current." when nothing was rejected, "Mostly current." when some rows were rejected, and "Nothing changed." when no row applied.
- When at least one row applied, a summary line reads "{k} {bottle|bottles} off the rack.", where `k` is the sum over applied items of `previous.bottleCount - bottlesOnHand(entry)`.
- Bottles that were marked "Drank it" and applied are listed under "You drank these. Tap one to add a note." Each one is a button that calls `onClose()` and then `navigate('/cellar/' + id)`.
- Rejected rows are listed as `{name}: {reason}`, with each name taken from the snapshot row.
- A "Done" button closes the sheet.

**Accessibility.** Each row button has an `aria-label` that includes the drink name, for example "Drank it: Bandol Rouge".

### `web/src/routes/Cellar.tsx` (modified)

- Add `onHand = useMemo(() => cellar.filter((e) => e.owned === true), [cellar])` and `bottlesTotal`, the sum of `bottlesOnHand` over `onHand`.
- When `filter === 'rack' && onHand.length > 0`, render a `cellar__rackbar` row between the chips and the search. It holds the caption "{bottlesTotal} {bottle|bottles} on hand" and a tertiary "Rack check" button with `IconListCheck` that opens the sheet. The row does not depend on the search query.
- Render `<RackCheckSheet open={rackCheckOpen} onClose={() => setRackCheckOpen(false)} />` next to `<ImportSheet>`.

The mosaic, tiles, and search do not change. Once the store updates, the rack view drops entries that are no longer on hand. An active search re-runs on its own, because its effect depends on the filtered list.

### `web/src/components/ImportSheet.tsx` (copy only)

Replace the done-state lede with the import copy in the table below. Nothing else in the file changes.

## User-Facing Copy

Every string was checked against the voice rules: no exclamation points, no emoji, no em dashes, and no scores. "Saving…" is the existing NoteSheet string.

| Where | Copy |
| --- | --- |
| Card, not on hand | Label "I have a bottle of this". Caption "Mark it when you keep a bottle on hand." Both unchanged. |
| Card, on hand | Label "In the rack". Caption "1 bottle on hand." or "{n} bottles on hand." |
| Count control | aria-labels "One fewer bottle" and "One more bottle" |
| Outcome buttons (card and rack check) | "Drank it", "Gave it away" |
| Undo line after switch-on | "In the rack." followed by an "Undo" button |
| Undo line after "Drank it" | Last bottle: "Finished." Bottles left: "One down. {n} left." Both followed by "Undo". |
| Undo line after "Gave it away" | Last bottle: "Off the rack." Bottles left: "One given away. {n} left." Both followed by "Undo". |
| Card errors | "That did not take. Try again?", "Could not undo that. Try again?", or the server's reason, such as "Not on hand anymore." |
| Note_Sheet after "Drank it" | Placeholder "How did it drink? What was on the plate? If it was not for you, say so. All optional." Eyebrow and hint unchanged. Error "That note did not save. Try again?" |
| Rack bar | "{n} bottles on hand" or "1 bottle on hand", with the button "Rack check" |
| Rack check, review | Headline "Rack check". Lede "Everything I have on the rack. For each bottle that is gone, tap how it left. Nothing changes until you confirm." |
| Rack check row | Count line "{n} bottles". Status for a one-bottle row: "Drank it." or "Gave it away." Status for a larger row: see the rule below this table. Reset button "Reset". |
| Rack check footer | "Take 1 bottle off the rack" or "Take {k} bottles off the rack", and "Never mind" |
| Rack check, saving | "Updating the rack" |
| Rack check, done | Headline "The rack is current.", "Mostly current.", or "Nothing changed." Summary "{k} {bottle\|bottles} off the rack." Drank list "You drank these. Tap one to add a note." Rejected list "Could not update {r}:" then one "{name}: {reason}" line per row. Button "Done". |
| Rack check, error | "Could not update the rack. Try again?" |
| Import, done lede | "They are marked as on hand and not yet tasted, one bottle each. When you open one, tap Drank it on its page and it starts shaping your profile. Have more than one of something? Set the count there too." |
| Server item reasons | "Nothing to record.", "Not on hand anymore.", "Only {n} on hand.", "Not in your cellar.", "Listed twice.", "Not a valid entry.", "Could not be updated." |
| Server errors | "Nothing to update.", "That is more than 200 at once.", "A bottle count runs from 1 to 99.", "A bottle count needs the bottle on hand.", "On hand needs to be yes or no.", "Sign in to edit your cellar." |

`rowStatus` builds the status line for a row with more than one bottle:

1. Take the parts `Drank {d}` and `gave away {g}`, keeping each only when its number is above 0.
2. Join the parts with ", " and capitalize the first letter.
3. Add `. {left} left.`, or `. None left.` when nothing is left.

For example, "Drank 1, gave away 1. 1 left." and "Drank 2. None left."

## Validation Rules

| Input | Required | Type and limits | On failure |
| --- | --- | --- | --- |
| `recordBottleOutcomes.items` | yes | Array of 1 to 200 items | Throws, 400, nothing written |
| `items[].id` | yes | Non-empty string, at most 100 characters after trimming, unique within the batch | That item is rejected; the others continue |
| `items[].drank`, `items[].gaveAway` | no, default 0 | Integer from 0 to 99. The sum is at least 1 and at most Bottles_On_Hand. | That item is rejected; the others continue |
| `recordBottleOutcomes.surface` | no | `'entry'` or `'rack_check'` | Logged as `'unknown'`; not an error |
| `updateCellarEntry.patch` | yes | Non-null, non-array object | Throws "Nothing to update.", 400 |
| `patch.owned` | no | Boolean. `null` counts as not provided. | Throws, 400, entry unchanged |
| `patch.bottleCount` | no | Integer from 1 to 99. `null` counts as not provided. The entry must be on hand already or be turned on hand in the same patch. | Throws, 400, entry unchanged |

The client applies the same limits. The count control stays within 1 to 99, and a rack check row cannot mark more bottles than it holds. These client limits are a convenience. The server checks are the ones that hold.

## Error Handling

| Operation and condition | Recoverable | Caller receives | Logged |
| --- | --- | --- | --- |
| Outcome or update while signed out | Yes, after sign-in | 400 `method_error`, "Sign in to edit your cellar." | No |
| `recordBottleOutcomes` with no items or more than 200 | Yes | 400 with a friendly message; nothing written | No |
| One item is invalid, someone else's, missing, stale, or over the count | Yes | 200. The item is in `rejected` with its reason; the other items apply. | Counts in the `bottle_outcomes` event |
| The database read or write for one item throws | Yes, by retrying | 200. The item is rejected with "Could not be updated." | `console.error` with the entry id |
| Background regeneration fails | Not applicable | Nothing; the outcome stands | `console.error`, the existing helper behavior |
| `updateCellarEntry` gets an invalid on-hand patch | Yes | 400 with the reason; entry unchanged | No |
| Entry-page action or Undo hits a network or server error | Yes | The card returns to its snapshot and shows a friendly inline error. After a failed Undo, Undo stays available. | `console.error` in the browser |
| Entry-page outcome is rejected because the entry changed elsewhere | Yes | The card returns to its snapshot, shows the reason, and reloads the entry | No |
| Saving the note after "Drank it" fails | Yes | The sheet stays open with the text and shows an inline error | `console.error` in the browser |
| Rack check confirm throws | Yes | The marks are kept; inline error; the user can retry | `console.error` in the browser |
| Rack check partly succeeds | Yes | Applied rows update. Rejected rows are listed with their reasons on the done screen. | Event counts |

## Invariants and Enforcement

1. **`owned` and `bottleCount` agree.** The server enforces this in `onHand.ts`, through `updateCellarEntry` and `recordBottleOutcomes`. Those are the only writers of `bottleCount`. The paths that create entries never write it, so they cannot break the rule. Readers go through `bottlesOnHand`, so a legacy or corrupt value still reads correctly.
2. **On-hand changes never change tasted, and tasted changes never change on hand.** The server enforces this. `resolveOnHandPatch` emits only `owned` and `bottleCount`. The one coupling is the requested one: `applyOutcome` sets `tasted: true` for "Drank it", and its Undo restores the earlier value.
3. **Changes to only `owned`, only the count, or both never regenerate the taste profile.** The server enforces this. `profileFields` excludes both fields, and `recordBottleOutcomes` regenerates only on a real false-to-true flip.
4. **An outcome request triggers at most one regeneration.** The server enforces this in `recordBottleOutcomes`.
5. **Users change only their own entries.** The server checks `userId` per item. Entries that belong to someone else get the same reason as missing ones, so their existence is not revealed.
6. **Bottles removed never exceed bottles on hand.** The server enforces this in `applyOutcome`. The client limits are a convenience only.
7. **From the entry page, a bottle leaves the rack only through an outcome or Undo.** This is a UI rule, enforced by OnHandCard: the minus button stops at 1, and the switch shows only when the entry is not on hand. The server still accepts `{ owned: false }`, because Undo and the save flow's NoteSheet switch rely on it.

## Edge Cases

- **Legacy and bulk-imported entries.** They have no `bottleCount` and read as one bottle. The first count change writes an explicit value.
- **Corrupt stored count.** A value of 0, a negative, a fraction, or a string reads as 1 while the entry is on hand, and is replaced on the next on-hand write.
- **Stale client state from another tab or device.**
  - An outcome on an entry that is already off the rack is rejected with "Not on hand anymore."
  - An outcome for more bottles than the server holds is rejected with "Only {n} on hand."
  - The entry page reloads the entry. The rack check lists the row on its done screen.
- **Two writes to one entry within milliseconds.** One write can be lost, because the adapter reads and then writes without a row lock. This covers two outcome requests, or enrichment finishing at the same moment as an outcome. The busy flag and the rack check's single request make it unlikely for one user. A transactional decrement would need SQL outside the adapter. This is existing adapter behavior and is not addressed here.
- **Undo after writing a note.** Undo restores on hand, the count, and tasted. The note stays, and the user can edit it in "Your notes".
- **Two regenerations close together.** "Drank it" on an untasted bottle starts one, and saving the note starts another. The save flow does the same today. The later one usually lands last because it starts later, but nothing guarantees that. This is not addressed here.
- **Unsaved text in "Your notes" when "Drank it" is tapped.** The tap blurs the field, which fires its save. The appended note is built from the field's current text, so neither is lost.
- **Rack check opened during a search.** The list ignores the query and shows every on-hand entry.
- **Cellar loaded from getMe's recent entries.** This is the fallback when listCellar fails at boot. The rack check then lists only those entries. The server still checks every row.
- **Entry opened by URL before the cellar loads.** `upsertEntry` adds the entry to the store, and the boot load later replaces the whole list.
- **Beer and spirits.** They use the same word, "bottle", as the rest of the app.

## Testing Strategy

The server tests are split into three files so that tasks running in parallel never edit the same test file.

### `server/src/__tests__/onHand.test.ts` (new, pure, no mocks)

- **`bottlesOnHand`:** owned true, false, and null, each with the count absent, valid, and invalid.
- **`resolveOnHandPatch`:** every row of the resolution table, the invalid-type rejections, and null handling.
- **`applyOutcome`:**
  - "Drank it" and "Gave it away" on the last bottle and with bottles left
  - the mixed case `{ drank: 1, gaveAway: 1 }`
  - `tasted` left out of the patch for "Gave it away"
  - `tastedFlipped` set only when tasted was explicitly false; a legacy null tasted does not flip
  - each rejection reason
  - the `previous` snapshot

### Method tests: shared setup

The two method test files use the stub pattern from `anonSaveContract.test.ts`:

- `vi.mock` for `../methods/tables/cellarEntries`, backed by the in-memory store.
- `vi.mock` for `../methods/common/regenerateTasteSummaryInternal`, with `runTasteSummaryRegen: vi.fn`.
- `vi.mock` for `../observability/events`, with `logEvent: vi.fn` and the event constants the module under test imports.
- Each method is called through `runWithContext({ userId })`.

The regeneration helper is called synchronously before the method returns, so call counts can be asserted right after the `await`.

The stub's `update` spreads the patch, so a cleared count shows up as a key holding `undefined`. Assert cleared fields with `toBeUndefined()`, which holds for both the stub and the real adapter.

### `server/src/__tests__/updateCellarEntryOnHand.test.ts` (new)

- **No regeneration (Done-when):** `{ owned: false }`, `{ owned: true }`, and `{ bottleCount: 4 }` each trigger no regeneration.
- **Count rules:**
  - `owned: false` clears the count.
  - `owned: true` on an entry that is off the rack sets the count to 1.
  - `owned: true` on an entry that is on hand keeps its count.
- **Rejections:** each of the following is rejected and leaves the entry unchanged:
  - invalid counts: 0, 100, 2.5, and "3"
  - a count on an entry that is not on hand
  - a count combined with `owned: false`
  - a non-boolean `owned`
  - a missing patch
- **No-op:** `{ bottleCount: null }` on its own changes nothing on hand.
- **Undo:** the patch `{ owned: true, bottleCount: 3, tasted: false }` restores the state and regenerates. `{ owned: true, bottleCount: 1 }` does not regenerate.
- **Unchanged behavior:** a notes patch still regenerates.

### `server/src/__tests__/recordBottleOutcomes.test.ts` (new)

- **"Drank it" (Done-when):** on a single on-hand, untasted bottle, the entry ends up not on hand, with no count, `tasted: true`, and exactly one regeneration.
- **"Gave it away" (Done-when):** on a single on-hand, untasted bottle, the entry ends up not on hand, still `tasted: false`, with no regeneration. On a tasted bottle, `tasted` stays true.
- **No regeneration for "Drank it"** on a bottle that is already tasted, or has a legacy null `tasted`.
- **Counts:** "Drank it" on 3 bottles leaves 2, still on hand, with `tasted: true`. A legacy on-hand entry with no count leaves the rack.
- **Batch:** two untasted "Drank it" rows and one "Gave it away" row trigger exactly one regeneration.
- **Partial success:** each of the following is rejected with its reason and left unchanged, while the valid rows in the same batch still apply:
  - another user's entry
  - a missing entry
  - a duplicate id
  - a count larger than what is on hand
  - an entry that is not on hand
- **`previous`:** each applied item returns the expected snapshot.
- **Errors:** a signed-out caller, an empty batch, and a batch over 200 each throw and write nothing.

### Web: `web/src/lib/onHand.test.ts` (new)

- **`bottlesOnHand`:** matches the server rules.
- **`previewOutcome`:** agrees with the server's `applyOutcome` for every case.
- **`applyOnHandPatch`:** follows the client mirror rules.
- **`undoPatchFor`:** includes `tasted` only when it changed.
- **Copy:** `outcomeMessage` and `rowStatus` produce the copy for every case.
- **Rack check staging:**
  - `toRackRows` filters to on-hand entries and sorts them.
  - `stage` stops at zero bottles left.
  - `resetRow`, `outcomeItems` (marked rows only), and `stagedBottles`.

### Not automated

Component behavior in OnHandCard, EntryDetail, and RackCheckSheet is not automated. The repo has no DOM test tooling, and adding it is out of scope. That is why every decision those components make (preview, inverse patch, staging, copy) lives in the pure web module. tasks.md lists the manual checks.

### Test-only configuration change

`server/src/config.ts` requires `DATABASE_URL` and `JWT_SECRET` at import time. The worktree has no `.env`, because the file is gitignored, so `npx vitest run` fails before any test runs. With placeholder values, all 60 existing tests pass.

Add this to the `test` block of `server/vitest.config.ts`:

```ts
// config.ts requires these at import. Tests stub the database and never
// connect, so placeholders let the suite run without a .env (for example in
// a git worktree). A value already set in the shell wins.
env: {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://test:test@localhost:5432/sommsavvy_test',
  JWT_SECRET: process.env.JWT_SECRET ?? 'test-only-secret',
},
```

Vitest 4.1.10 supports `test.env`, which it assigns to `process.env` before running tests. `dotenv` does not override variables that are already set. As a result, tests in the main checkout also get the placeholders. That is harmless, and safer, since no test may touch a real database. `server/tsconfig.json` includes only `src/**`, so the config file stays outside `tsc`.

## Verification Commands

Baseline on this branch before any change:

- **Server:** `tsc` passes, and Vitest passes 60 tests (6 todo) once placeholder env vars are set.
- **Web:** Vitest passes 7 tests, and `vite build` passes.

| Directory | Command | Expected |
| --- | --- | --- |
| `server/` | `npx tsc --noEmit` | Passes. |
| `server/` | `npx vitest run` | Passes, including the three new files. This relies on the config change above. |
| `web/` | `npx tsc --noEmit` | Passes, but checks **zero files**. The root `tsconfig.json` has `"files": []` and only project references. |
| `web/` | `npx tsc --noEmit -p tsconfig.app.json` | This is the real type check. Only two errors may remain, both pre-existing: `src/components/TextInputSheet.tsx:14` (`mode` does not exist on `Store`) and `src/lib/upload.test.ts:19` (fetch mock type). No error may point at a file this feature touches. Fixing those two is out of scope. |
| `web/` | `npx vitest run` | Passes, including `onHand.test.ts`. |
| `web/` | `npx vite build` | Passes. It writes `web/dist/`, which is gitignored. |

## Migration Seams

This feature adds no new seams. Its only background work is the existing in-process, fire-and-forget taste regeneration, which already replaced the MindStudio platform task runner. It adds no auth, storage, image, or AI capability.

## What This Deliberately Does Not Do

- **No quantity reading in bulk import.** Option B2 was not chosen.
- **No other count or tasted surfaces.** Counts do not appear on cellar tiles or in search, there is no tasted toggle, and "Drank it" does not stamp `tastedAt`.
- **No outcome history.** The cellar stores only current state.
- **No Undo after a rack check is confirmed, and no raising counts inside it.**
- **No changes to scan saves, Cellar Search, enrichment, or the save flow's NoteSheet switch.**

## Relationship to the Roadmap

This is the first slice of **Tasted vs Owned**, which sits under Next in `src/roadmap/kiro-roadmap.md`.

- It makes the `owned` axis trustworthy.
- Through "Drank it", it gives untasted bottles a one-tap path into the taste profile. That closes the bulk-import follow-up "Easy mark tasted on owned/imported entries".

The implementation step makes both bookkeeping edits, which are listed in tasks.md. This spec does not make them.
