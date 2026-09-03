# Requirements Document

## Introduction

Adding a wine club shipment one bottle at a time is tedious. Six or twelve bottles arrive with a packing list, and the current flow asks the user to photograph and confirm each bottle individually. That friction is exactly where an engaged enthusiast stops bothering, and a cellar that falls out of date stops being useful.

Bulk Import lets the user photograph a document that lists multiple drinks (a wine club packing slip, an invoice, a shipment email screenshot, a handwritten list), have the app read the bottles off it, review and correct what it found, and add them all to the cellar in one action.

Two things make this different from a scan, and both are deliberate:

- **These are bottles on hand, not bottles tasted.** A shipment is the canonical `owned = true, tasted = false` case: the user physically holds them but has not drunk them. This is the opposite of the Reverse Scan path (which records something tasted). Imported entries therefore must not shape the taste profile until the user actually tastes them.
- **Import is a list, not an editorial moment.** The app's voice is one considered card at a time. Import creates lightweight entries (identity plus availability) without the full editorial treatment or generated portraits. The rich treatment stays where it earns its place: on a real scan, or later on demand.

This feature adds no new tables. It uses the existing `cellar_entries` shape and the existing `owned` / `tasted` axes.

**Scope for v1:** an image of a document (photo or screenshot). PDF is out of scope for v1 because the current vision capability accepts image content only; supporting PDF requires a render-to-image step and is noted as a follow-up. Inbound email forwarding is also a follow-up, it needs a receiving address and parsing of arbitrary sender formats.

## Glossary

- **Cellar**: The user's persistent set of saved drinks (`cellar_entries`); the only persistent artifact and the source of the taste profile.
- **Cellar_Entry**: One saved drink, carrying identity (name, producer, region, vintage, kind), editorial fields, notes, and the tasted/owned axes.
- **Source_Document**: The user-supplied image that lists multiple drinks (packing slip, invoice, email screenshot, handwritten list).
- **Bulk_Import**: The end-to-end flow: supply a Source_Document, extract Parsed_Items, review them, and commit the confirmed ones to the Cellar.
- **Parsed_Item**: One candidate drink extracted from a Source_Document, carrying the identity fields plus an extraction confidence. Not yet saved.
- **Review_List**: The editable, confirmable list of Parsed_Items presented before anything is written to the Cellar.
- **Commit**: The single user action that writes the confirmed Parsed_Items to the Cellar as Cellar_Entries.
- **Identity_Fields**: name, producer, region, vintage, kind.
- **Import_Batch_Limit**: The configured maximum number of Parsed_Items accepted from one Source_Document.
- **Taste_Profile**: The single `tasteSummary` field, regenerated from tasted entries only.

## Requirements

### Requirement 1: Extract drinks from a document

**User Story:** As an enthusiast whose wine club just delivered, I want to photograph the packing list and have the app read the bottles off it, so that I do not have to enter six bottles by hand.

#### Acceptance Criteria

1. WHEN a signed-in user supplies a Source_Document image, THE Bulk_Import SHALL extract the drinks listed on it as Parsed_Items, each carrying whichever Identity_Fields are discernible and an extraction confidence.
2. WHEN a Source_Document lists multiple drinks, THE Bulk_Import SHALL return one Parsed_Item per distinct drink rather than collapsing them into a single item.
3. WHERE a Source_Document line does not state a field (for example no vintage or no region), THE Parsed_Item SHALL leave that field empty rather than inventing a value.
4. WHEN a drink's kind is not explicit on the Source_Document, THE Bulk_Import SHALL infer `wine`, `beer`, or `spirits` from the available context and mark the item's confidence accordingly.
5. THE Bulk_Import SHALL accept an image Source_Document and SHALL NOT claim support for document formats the underlying capability cannot read.
6. IF no drinks can be discerned from the Source_Document, THEN THE Bulk_Import SHALL return no Parsed_Items and present a warm, recoverable message offering another photo or manual entry.

### Requirement 2: Review and correct before anything is saved

**User Story:** As a user, I want to see and fix what the app read before it lands in my cellar, so that a misread label does not quietly pollute my records.

#### Acceptance Criteria

1. WHEN Parsed_Items are returned, THE Bulk_Import SHALL present them as a Review_List and SHALL NOT write any Cellar_Entry until the user performs the Commit action.
2. THE Review_List SHALL allow the user to edit each Parsed_Item's Identity_Fields before Commit, with the same field rules the app applies elsewhere (name required; vintage empty or a year between 1900 and next year; kind one of wine, beer, spirits).
3. THE Review_List SHALL allow the user to exclude an individual Parsed_Item so that it is not committed.
4. WHERE a Parsed_Item was extracted with low confidence, THE Review_List SHALL indicate that visually so the user knows which rows deserve a second look.
5. WHEN the user performs Commit, THE Bulk_Import SHALL persist exactly the confirmed, edited values, not the original extracted values.
6. IF the user abandons the flow before Commit, THEN THE Cellar SHALL be unchanged.
7. THE Review_List SHALL NOT present a numeric rating field for any Parsed_Item.

### Requirement 3: Commit as on-hand, untasted bottles

**User Story:** As an enthusiast, I want imported bottles to count as things I have but have not opened, so that my rack is accurate and my taste profile is not polluted by wine I have not tried.

#### Acceptance Criteria

1. WHEN Parsed_Items are committed, THE Bulk_Import SHALL create each Cellar_Entry with `owned` true and `tasted` false.
2. WHEN Parsed_Items are committed, THE Bulk_Import SHALL NOT trigger a Taste_Profile regeneration, because untasted entries do not contribute to the Taste_Profile.
3. WHEN Parsed_Items are committed, THE Bulk_Import SHALL record the entries' provenance distinctly from somm, scan, and manual entries.
4. WHEN Parsed_Items are committed, THE Bulk_Import SHALL NOT generate portraits or other images for the created entries.
5. WHEN a committed entry is later marked as tasted by the user, THE existing tasted-driven behavior SHALL apply unchanged, including Taste_Profile regeneration.
6. THE committed entries SHALL appear in the Cellar and SHALL be included by the "In the Rack" ownership filter.

### Requirement 4: Keep the operation bounded and honest about failure

**User Story:** As the operator, I want import to have predictable cost and to fail safely, so that one odd document cannot run up spend or corrupt a cellar.

#### Acceptance Criteria

1. THE Bulk_Import SHALL accept no more than the Import_Batch_Limit of Parsed_Items from one Source_Document, and WHERE a document exceeds it SHALL present the items up to that limit and tell the user some rows were not included.
2. THE Bulk_Import SHALL issue at most one document-extraction call per submitted Source_Document.
3. IF extraction fails or exceeds its time bound, THEN THE Bulk_Import SHALL present a friendly message with no technical details and SHALL leave the Cellar unchanged.
4. WHEN a Commit contains items that fail validation, THE Bulk_Import SHALL persist the valid items, report which items were not saved and why, and SHALL NOT discard the whole batch.
5. IF the document upload fails, THEN THE Bulk_Import SHALL report it, retain the user's selected document where possible, offer retry, and make no extraction call.

### Requirement 5: Respect the existing auth and cellar model

**User Story:** As a returning user, I want import to behave like the rest of the app, so that nothing surprising happens to my account or my data.

#### Acceptance Criteria

1. THE Bulk_Import SHALL require a signed-in user, consistent with every other path that writes to the Cellar.
2. THE Bulk_Import SHALL write only to the requesting user's own Cellar and SHALL NOT read or modify another user's entries.
3. THE Bulk_Import SHALL introduce no new persisted tables and SHALL reuse the existing Cellar_Entry shape.
4. THE Bulk_Import SHALL follow the brand voice in all user-facing copy (no exclamation points, no emoji, no em dashes) and SHALL NOT introduce score or rating language.
