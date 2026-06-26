---
name: Home Bar
status: planned
effort: medium
description: A living inventory of every bottle on your shelf — so you always know what you have before you shop, and so the app can start working with what you actually own.
---

The cellar tracks what you have saved and tasted. The Home Bar is what is physically on your shelf right now — open bottles, sealed bottles, things you bought three months ago and forgot about. The practical counterpart to the aspirational cellar, and the foundation that makes Cocktail Studio possible.

## What it looks like

- An alternate view within the cellar, toggled by a new chip: "In the cellar" and "At home."
- Add bottles the same way as the cellar: scan with the camera, search by name, or manual entry.
- Each home bar entry has an additional status indicator: sealed, open, or almost gone. Set by the user, shown as a subtle icon on the tile.
- A "Low stock" badge on entries marked as almost gone.
- A "What's at home" section in the Pocket Somm flow: when the user asks for a pairing, the app can factor in what they already have. "You have a Côtes du Rhône at home that would work here."
- A "Gap filler" section in the profile: two or three suggestions for bottles to add based on the taste profile and what is missing from a well-rounded home bar.

## Key details

- Home bar entries are a flag on existing cellar entries, not a separate table. Any cellar entry can be marked as "at home."
- When a bottle is finished, the user marks it as empty — a small celebratory moment ("Finished well?") with a prompt to rate and note it if they have not already.
- The "at home" context is passed silently to Pocket Somm when the user asks for pairing recommendations.
- The gap filler uses the taste summary and current home bar to make targeted suggestions — typically one white, one red, one spirit or beer — not a generic "every bar needs these 12 bottles" list.

~~~
Add a homeBarStatus field to cellar_entries: null (not in home bar), 'sealed', 'open', 'almost-gone', 'empty'. A new listCellar param homeBarOnly filters to entries where homeBarStatus is not null and not 'empty'. The "gap filler" is a new method: suggestHomeBarGaps({ userId }) — reads tasteSummary and current home bar entries and calls mindstudio.generateText() to return 2-3 targeted suggestions. The pocketSomm method is updated to accept an optional homeBarContext param (a summary string of current home bar bottles) and reference it in the agent prompt.
~~~
