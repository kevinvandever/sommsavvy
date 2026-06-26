---
name: Somm Sessions
status: planned
effort: small
description: Browse and revisit every Pocket Somm recommendation and Reverse Scan from past sessions — the somm who remembers every conversation.
---

Right now, a recommendation that the user does not save disappears when they close the app. Somm Sessions is the searchable history of every interaction — where the user was, what they were eating, what was recommended, whether they ever tried it.

## What it looks like

- A "Sessions" tab accessible from the cellar, showing every past Pocket Somm and Reverse Scan grouped by date.
- Each session is a collapsed row: the context (the dish, setting, or bottle name), the date, and a thumbnail of the first recommendation or scanned bottle.
- Tapping a session expands it into the full original result — all recommendation cards or the full scan card, exactly as they appeared.
- Any item from a past session can still be saved to the cellar from here, same save flow as the live result.
- Sessions are searchable by context, drink name, or date.

## Key details

- Sessions persist for signed-in users only. Anonymous sessions remain ephemeral.
- Session records are lightweight: the structured result output, the user's input context (text, transcribed voice, or photo thumbnail), and the timestamp.
- A session with no cellar saves shows a quiet Bone caption: "Nothing saved from this one."
- Sessions are read-only. They cannot be edited, only browsed and saved from.
- Deleting a session does not delete any cellar entries that originated from it.

~~~
New table: somm_sessions. Columns: userId, mode ('somm' | 'scan'), inputText, inputPhotoUrl, resultJson, createdAt. pocketSomm and reverseScan methods get a persistSession flag that fires for all signed-in users. New method: listSessions({ cursor?, limit? }) for paginated date-desc results. The frontend uses a simple "Load more" pattern at the bottom of the sessions list. The session detail rehydrates the result JSON and renders it using the same result-card components as the live flow.
~~~
