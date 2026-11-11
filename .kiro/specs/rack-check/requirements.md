# Requirements Document

## Introduction

The cellar's "In the Rack" view is only as good as the `owned` flags behind it, and those flags go stale. In the user's words: "many times I forget to mark a bottle as no longer on the rack when I drink it." A stale flag misleads in three places. The "In the Rack" view lists bottles that are gone. Cellar Search tags them "In your rack". And a bottle that was imported untasted and then drunk never reaches the taste profile, because nothing in the app marks it tasted.

This feature adds three things:

1. **Rack check.** A stocktake opened from the "In the Rack" view. Every bottle marked on hand appears in one list. The user marks the ones that are gone, and each gone bottle gets one of two outcomes: "Drank it" or "Gave it away".
2. **Bottle outcomes on a single entry.** The same two outcomes on the entry page, so a bottle can be recorded as finished in one tap when it is opened. After "Drank it", the optional note is offered the way the save flow offers one. The user records bottles they did not like in that note.
3. **Bottle counts.** An optional count on each on-hand entry, because the user sometimes holds several bottles of one wine ("especially if I see a deal or really like something"). Each outcome removes one bottle, and the last one takes the entry off the rack.

"Drank it" is the first control in the app that marks a bottle tasted. It covers the bulk-import follow-up "Easy mark tasted on owned/imported entries".

## Decisions

The user settled both open decisions from the brief:

- **Bottle counts: B1.** Add an optional bottle count. Each outcome removes one bottle, and the last bottle clears on hand. Existing on-hand entries read as one bottle. Bulk import stays as it is: imported bottles land at one each, and the user fixes counts by hand.
- **Entry-level actions: R (replace).** While a bottle is not on hand, the entry keeps the "I have a bottle of this" switch. While it is on hand, the switch is replaced by "Drank it", "Gave it away", and the count control.
- **Undo** is kept after each entry-level action, as proposed, so a mis-tap on "Drank it" does not stay in the taste profile.

## Glossary

- **Cellar_Entry**: one saved drink in `cellar_entries`.
- **On_Hand**: the entry's `owned` flag is true. The "In the Rack" view shows On_Hand entries.
- **Bottle_Count**: the new optional `bottleCount` field. It is meaningful only while the entry is On_Hand.
- **Bottles_On_Hand**: the effective number of bottles. It is 0 when the entry is not On_Hand, otherwise the Bottle_Count, read as 1 when absent.
- **Tasted**: the entry's `tasted` flag. Only tasted entries shape the Taste_Profile. A null value reads as true.
- **Outcome**: how one bottle left the rack, either "Drank it" or "Gave it away".
- **Ownership_Card**: the card on the entry page under the metadata line. Today it holds the "I have a bottle of this" switch.
- **Rack_Check**: the stocktake sheet opened from the "In the Rack" view.
- **Note_Sheet**: the "Add a note" bottom sheet that the save flow opens after a save.
- **Taste_Profile**: the `tasteSummary` field, regenerated in the background from tasted entries only.

## Requirements

### Requirement 1: Bottle count on on-hand entries

**User Story:** As an enthusiast who buys two or three of a wine I like, I want the app to know how many I hold, so that drinking one does not drop the wine off my rack.

#### Acceptance Criteria

1. THE Cellar_Entry SHALL carry an optional Bottle_Count. It is a whole number from 1 to 99 and is meaningful only while the entry is On_Hand.
2. WHEN an entry is On_Hand and has no stored Bottle_Count, THE system SHALL treat it as holding one bottle. This covers every existing on-hand entry and every bulk-imported entry.
3. WHEN an entry is not On_Hand, THE system SHALL treat it as holding zero bottles, whatever count is stored.
4. WHEN an entry is turned On_Hand from not On_Hand and the write carries no count, THE system SHALL record one bottle.
5. WHEN an entry is turned off On_Hand, THE system SHALL clear its Bottle_Count.
6. IF a write does any of the following, THEN THE system SHALL reject it with a friendly message and leave the entry unchanged:
   - sets a Bottle_Count outside 1 to 99
   - sets a count on an entry that is not On_Hand without turning it On_Hand in the same write
   - turns an entry off On_Hand while setting a count
7. WHEN a write changes only On_Hand, Bottle_Count, or both, THE system SHALL NOT trigger a Taste_Profile regeneration and SHALL NOT change Tasted.
8. THE bulk import and scan save paths SHALL stay unchanged. Imported entries land On_Hand at one bottle, and scanned entries land not On_Hand.
9. WHEN a bulk import finishes, THE import confirmation SHALL tell the user three things: each bottle lands as one, "Drank it" on a bottle's page marks it tasted, and the count can be set there.

### Requirement 2: Recording how a bottle left

**User Story:** As a user, I want to say whether I drank a bottle or it left another way, so that my rack is accurate and only bottles I drank shape my taste profile.

#### Acceptance Criteria

1. WHEN the user records "Drank it" for an On_Hand entry, THE system SHALL remove one bottle and set Tasted to true.
2. WHEN the user records "Gave it away" for an On_Hand entry, THE system SHALL remove one bottle and leave Tasted unchanged.
3. WHEN the removed bottle was the last one, THE entry SHALL stop being On_Hand, its Bottle_Count SHALL be cleared, and it SHALL leave the "In the Rack" view.
4. WHEN bottles remain after an Outcome, THE entry SHALL stay On_Hand with its Bottle_Count reduced by the number removed.
5. IF an Outcome targets an entry that is not On_Hand, or would remove more bottles than are on hand, THEN THE system SHALL reject it with a friendly reason and leave the entry unchanged.
6. WHEN one request records Outcomes for one or more entries, THE system SHALL trigger at most one Taste_Profile regeneration, and only when at least one entry went from not tasted to tasted. Neither "Gave it away" nor "Drank it" on an entry that is already tasted SHALL trigger one.
7. THE Outcomes SHALL never delete an entry or change its notes, identity, or editorial fields.
8. THE system SHALL NOT record a rating or score for any Outcome.

### Requirement 3: Entry-level actions

**User Story:** As a user opening a bottle, I want to record it as finished in one tap from its page and add a line about how it drank, so that I do not have to remember to do it later.

#### Acceptance Criteria

1. WHILE an entry is not On_Hand, THE Ownership_Card SHALL show the existing "I have a bottle of this" switch, off. Turning it on SHALL make the entry On_Hand with one bottle.
2. WHILE an entry is On_Hand, THE Ownership_Card SHALL replace the switch with a "Drank it" action, a "Gave it away" action, and a count control showing Bottles_On_Hand.
3. THE count control SHALL adjust the count between 1 and 99 and SHALL NOT take the entry off On_Hand. From the entry page, an entry leaves the rack only through an Outcome or an Undo.
4. WHEN the user taps "Drank it" or "Gave it away", THE system SHALL record that Outcome for exactly one bottle.
5. WHEN "Drank it" succeeds, THE app SHALL open the Note_Sheet as the next step, as the save flow does. The sheet SHALL be skippable, SHALL show the drink name and context line, and SHALL NOT show the "I have a bottle of this" row.
6. WHEN the user saves a non-empty note from that Note_Sheet, THE app SHALL add it to the entry's existing notes, separated by a blank line, without replacing them. The save SHALL follow the existing notes behavior, including Taste_Profile regeneration.
7. IF saving that note fails, THEN THE Note_Sheet SHALL stay open with the text intact and show a friendly message.
8. WHEN the user turns the switch on, taps "Drank it", or taps "Gave it away", THE Ownership_Card SHALL offer Undo for that action. Undo SHALL restore On_Hand, Bottle_Count, and Tasted to their values before the action.
9. THE Undo SHALL cover only the most recent of those actions. It SHALL stay available until the user leaves the page or makes another on-hand change. It SHALL NOT be offered for count changes, which reverse with the opposite button.
10. WHEN Undo reverses a "Drank it" that changed Tasted from false to true, THE system SHALL set Tasted back to false, which triggers a Taste_Profile regeneration. An Undo that changes only On_Hand and Bottle_Count SHALL NOT trigger one.
11. WHILE an on-hand request is in flight, THE Ownership_Card SHALL disable its controls, so that a double tap cannot remove two bottles.
12. IF an entry-level action or Undo fails, THEN THE app SHALL restore the card to its previous state and show a friendly message with no technical detail. WHERE the server reports that the entry changed elsewhere, THE app SHALL show that reason and reload the entry.
13. THE save flow's Note_Sheet SHALL keep its "I have a bottle of this" switch unchanged.

### Requirement 4: Rack check

**User Story:** As a user who forgets to mark bottles as gone, I want to walk my rack against the app's list and fix it in one pass, so that "In the Rack" matches what is on the shelf.

#### Acceptance Criteria

1. WHILE the "In the Rack" view is active and at least one entry is On_Hand, THE cellar SHALL show the total bottles on hand and a "Rack check" action.
2. WHEN the user opens the Rack_Check, THE sheet SHALL list every On_Hand entry in one list, whatever the search query. Each row SHALL show the name, the producer and vintage when known, and the bottle count when it is more than one.
3. THE list SHALL be sorted by name, then by producer.
4. Each row SHALL offer "Drank it" and "Gave it away". Each tap SHALL mark one bottle gone with that Outcome, and the row SHALL show what is marked and how many bottles are left.
5. A row SHALL NOT allow more bottles to be marked gone than it has on hand, and SHALL offer a reset that clears its marks.
6. THE Rack_Check SHALL write nothing until the user confirms. Closing it before confirming SHALL leave the cellar unchanged.
7. WHEN the user confirms, THE Rack_Check SHALL send every marked row in one request, subject to the regeneration rule in 2.6.
8. WHEN some rows cannot be applied, for example because the entry changed elsewhere, THE Rack_Check SHALL apply the rest and report each failed row with its reason.
9. IF the whole request fails, THEN THE Rack_Check SHALL keep the user's marks, show a friendly message, and allow a retry.
10. WHEN the request succeeds, THE cellar SHALL show the updated entries without a reload, and entries with no bottles left SHALL leave the "In the Rack" view.
11. THE Rack_Check SHALL NOT open a note sheet for each bottle. Its confirmation SHALL list the bottles marked "Drank it", and tapping one SHALL open its entry, where a note can be added.
12. WHILE the confirm request is in flight, THE Rack_Check SHALL NOT be dismissible.

### Requirement 5: Boundaries

**User Story:** As the operator, I want the feature to respect the existing auth, data model, and voice, so that nothing surprising happens to a user's data.

#### Acceptance Criteria

1. THE Outcome and count operations SHALL require a signed-in user and SHALL read and change only that user's entries. An entry that belongs to someone else SHALL be reported the same way as a missing one.
2. THE system SHALL add no tables and exactly one optional field, `bottleCount`, to `cellar_entries`, with no migration or backfill.
3. THE Tasted and On_Hand axes SHALL stay independent. No on-hand or count change SHALL alter Tasted, and no Tasted change SHALL alter on hand. The only exceptions are the explicit "Drank it" Outcome and its Undo.
4. THE system SHALL accept at most 200 entries per Outcome request and SHALL reject a larger request with a friendly message.
5. THE Outcome operations SHALL make no AI calls other than the background Taste_Profile regeneration allowed by 2.6.
6. ALL user-facing copy SHALL follow the brand voice: no exclamation points, no emoji, no em dashes, and no rating or score language.

## Assumptions

These were inferred while specifying. The design review can overturn any of them.

1. The count runs from 1 to 99 per entry.
2. The second outcome keeps the user's label, "Gave it away". It also stands for any bottle that left without being drunk.
3. "Drank it" does not set `tastedAt`. Nothing reads that field today, and leaving it alone lets Undo restore the entry exactly.
4. The note written after "Drank it" is appended to the existing notes, separated by a blank line.
5. Undo is single-level and has no timer.
6. The rack check lists entries from the cellar already loaded in the app. The server checks every row again on confirm.
7. Raising a count or adding a bottle happens on the entry page, not in the rack check.

## Out of Scope

Offered to the user but not chosen:

- Scans recognizing a bottle that is already on hand.
- An in-app "still have these?" prompt.
- Photographing the rack to audit it.

Also out of scope:

- Reading quantities during bulk import (option B2, not chosen).
- Bottle counts on cellar tiles or in search results.
- A tasted toggle on the entry page.
- A history of when and how bottles left. Only the current state is stored.
- Undo after a rack check is confirmed. Marks can be changed until the user confirms.
- Changing the scan save path, including its lack of a check for an existing entry.
- A per-entry "exclude from taste profile" flag.
