---
name: Share the Glass
status: planned
effort: small
description: Turn any cellar entry into a beautiful styled card — the kind people actually want to post.
---

Every great bottle deserves a moment. Share the Glass generates a shareable image from any cellar entry: the chiaroscuro portrait, the name in Display Rowan, the user's tasting note if they want to include it, the producer and vintage in metadata. It looks like a magazine. It moves like word of mouth.

## What it looks like

- A "Share" option in the long-press menu and the entry detail of any cellar entry.
- A card preview sheet before sharing: the user toggles whether to include their tasting note or just the bottle identity.
- Three card formats:
  - **Portrait** (9:16, Instagram story ratio): the full editorial layout with the bottle portrait dominant.
  - **Square** (1:1, grid ratio): condensed version with name, producer, vintage, and a short note.
  - **Minimal** (text-forward, Twitter/X and message threads): just the bottle name, region, vintage, and one sentence of the user's note. No photography.
- The user saves the image to their camera roll or shares directly via the native share sheet.
- A quiet "via SommSavvy" credit in Bone at the bottom of portrait and square formats. Never a watermark. Just a credit.

## Key details

- Cards are generated server-side so they look consistent across devices and screen sizes.
- If the cellar entry has no photo, a new chiaroscuro portrait is generated before the card is composed.
- Tasting notes are truncated at 80 characters in the card image, with an ellipsis. Full note remains in the app.
- No auto-posting, no social graph, no SommSavvy accounts to follow. Sharing is a one-way export — the user's content, their choice of destination.

~~~
New method: generateShareCard({ entryId, format: 'portrait' | 'square' | 'minimal', includeNote: boolean }). If the entry has no photoUrl, call generateImage first with the standard chiaroscuro bottle prompt. Then compose the card image server-side using a canvas or image-generation capability. Return a temporary signed URL to the generated image. The frontend opens the Web Share API with the image file; falls back to a download button if the browser does not support Web Share. The card composition respects the brand: Midnight or Smoke background, Rowan for the name, Geist for metadata. No numeric ratings; the qualitative read comes from the optional note alone.
~~~
