---
name: The Hunt List
status: planned
effort: small
description: A personal wishlist of bottles you are looking for — and a quiet alert when Reverse Scan finds one.
---

Every enthusiast has a mental list. The Barolo from that dinner in Turin. The producer a friend mentioned twice. The vintage that was gone before they got there. The Hunt List makes the mental list real — and when Reverse Scan recognizes a bottle from the list, the app notices.

The Hunt List is the passive half of the hunt. The Pursuit is the active half. Together they handle both scenarios: stumbling on a wanted bottle, and going to work when you cannot wait to stumble.

## What it looks like

- A "Hunting" section accessible from the cellar, beside the main archive.
- Add a bottle to the Hunt List from any Reverse Scan result, any Pocket Somm recommendation card, or manually by name and producer.
- Each entry is simple: name, producer, and an optional freeform note ("saw this at $45 in Paris — importers may carry it").
- When the user runs a Reverse Scan and the result matches something on their list, an Ember flash and a quiet confirmation: "You found it." The hunt entry promotes to a full cellar entry in one tap, with the scan photo pre-loaded.
- Entries that have been on the list for more than a year show a quiet Bone caption: "This one is proving elusive." — and a "Pursue it" action that hands the entry to The Pursuit.
- The Hunt List is browsable and searchable. Items can be removed when the hunt is called off.

## Key details

- The "found it" match is producer-level fuzzy, not exact-vintage. If you were hunting the 2019 and you found the 2021, the match still fires — the app notes the discrepancy and lets you decide whether it counts.
- Hunt entries have no ratings, no photos. They are intentions, not records. They become records when found.
- Cap at 50 active entries. The Hunt List is aspirational, not a task management system.
- No price tracking, no availability alerts, no retail integrations in the Hunt List itself. That is The Pursuit's job.
- Any entry can trigger The Pursuit at any time — not just after a year. "Pursue it" is available from the entry detail from day one.

~~~
New table: hunt_list with userId, name, producer, notes, addedAt, foundAt (nullable), pursuitResultJson (text, nullable), pursuitRunAt (number, nullable). foundAt is set when the entry is promoted to a cellar entry. pursuitResultJson and pursuitRunAt are written by The Pursuit feature when pursueHuntEntry is called.

New methods: addToHuntList({ name, producer, notes? }), listHuntList(), removeFromHuntList({ id }), markFound({ id, cellarEntryId }).

The match logic runs inside reverseScan after the result is returned: when the user is signed in, query hunt_list for any entry where producer matches the scan result's producer (case-insensitive, substring). If a match is found, include a huntMatch: { huntEntryId, producerMatch, vintageMatch } flag in the reverseScan response. The frontend renders the Ember flash and "You found it" state when huntMatch is present. Promoting to cellar calls saveCellarEntry with the scan result pre-populated, then calls markFound to set foundAt on the hunt entry.

The Hunt List entry detail view shows "Pursued [date]" state with a chevron to expand the stored pursuit result when pursuitRunAt is set.
~~~
