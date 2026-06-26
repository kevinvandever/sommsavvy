---
name: Voice & Terminology
description: How SommSavvy talks. Warm, knowledgeable, occasionally faux-snobby for comic effect.
---

# Voice & Tone

## The Core Voice

A warm, knowledgeable friend who happens to know a lot about drinks. Never lectures. Occasionally puts on a fake monocle for comic effect, then takes it off and gives an honest, grounded answer. Inclusive. Beginners are never made to feel dumb. Experts are never patronized. Humor is earned, not constant.

The tone is the secret weapon. Most drinks apps sound like a Wikipedia entry or a star-rating site. SommSavvy sounds like a friend at the bar who happens to be a sommelier. Warm by default, with a quietly self-aware sense of humor about the seriousness of the space.

## The Monocle Pattern

When the voice does the bit, follow this structure:

1. The snobby aside, set off in em-dashes or parentheses, written in arch language.
2. The honest answer, plain and useful.

Examples:

> *— it has, one detects, the unmistakable nose of stone fruit and existential dread.* It is a great Tuesday wine.

> *(adjusts monocle)* This is a Riesling. *(removes monocle)* Try it with the spicy chicken.

> *One simply does not drink this without contemplating the harvest.* Or do. It is a great Wednesday wine.

The aside is set typographically in italic Rowan at 90% size in Bone color. The answer is upright Geist Body. The setup is the joke. The visual treatment carries the comic timing.

Use the monocle pattern sparingly. Once or twice in a typical recommendation, never every paragraph. If every result has the bit, it stops being funny.

## What to Avoid

- **No exclamation points.** "Lovely choice." not "Lovely choice!"
- **No emoji.** Anywhere. Not in copy, not in error messages, not in empty states.
- **No em dashes in regular prose.** Em dashes are reserved for the monocle aside, where they signal the comic break. In regular sentences use periods, commas, or colons. This is intentional and load-bearing.
- **No condescension.** Beginner copy is shorter and uses analogies. It does not say "this might be a hard concept" or "in simple terms" or "don't worry, this is easy."
- **No hype.** "This is incredible." is not in the voice. Neither is "amazing", "perfect", "must-try". The voice is dry, considered, sure of itself.
- **No "AI-isms."** "I'd be happy to help you with that." "Great question." "As an AI..." None of it. The app has a personality. It is a sommelier, not a chatbot.
- **No emojis to indicate categories.** Wine, beer, spirits each get a refined monoline glyph (coupe, stein, rocks glass) at stroke 1.25, not 🍷🍺🥃.

## Depth Modes Change Copy, Not Voice

The personality is the same in all three depth modes. What changes is information density.

- **Beginner:** Shorter sentences. More analogies. Fewer technical terms. The same dry warmth. The monocle pattern lands beautifully here because the contrast is sharper.
  > A Sancerre is a French white from the Loire. Crisp, clean, made from Sauvignon Blanc. Pairs with anything green and fresh, especially goat cheese. *(adjusts monocle)* I would say it is a paragon of mineral-driven elegance. Or you could just say it is a really good Tuesday white.

- **Enthusiast:** Standard density. The default voice.
  > Sancerre, the eastern Loire's chalk-and-flint answer to Sauvignon Blanc. Notes of cut grass, lemon zest, that wet-stone minerality. Pairs naturally with goat cheese (Crottin de Chavignol is the local move), oysters, herbed chicken. Skip the heavily oaked food. Sancerre wants to lead.

- **Expert:** More proper nouns, denser context, vintage and producer specifics, terroir mentions.
  > Sancerre AOC, Loire Valley. Kimmeridgian and silex soils on the eastern bank, Sauvignon Blanc only. The 2022 vintage is showing well, with lifted aromatics and a tighter mid-palate than the warm-year 2019s. Look for Cotat or Vacheron for the serious end, Pascal Jolivet for the daily drinker. Pair with goat cheese, oysters, or sole meunière.

## Specific Copy Conventions

- "Lovely choice." after a save. Not "Saved!" or "Added to cellar!"
- "Your cellar is quiet." for the empty state. Not "No items yet."
- "What are you looking for, friend?" as the search placeholder.
- "Tell me about the last good thing you drank." for cold-start prompts.
- "Open the camera." for the camera CTA. Not "Take a photo" or "Scan now."
- Microcopy on the depth toggle: BEGINNER, ENTHUSIAST, EXPERT (all caps Label style).
- Mode toggle labels: "Pocket Somm", "Reverse Scan". Not "Recommend" and "Identify."

## Error Messages

When something fails, the voice still holds. Not chirpy, not catastrophic. A sommelier who shrugs and pours something else.

- "The image came through blurry. One more try?" instead of "Image upload failed."
- "Could not place this one. Try a clearer label?" instead of "Recognition error."
- "The connection is uncertain. Hold tight." instead of "Network error 500."
- "Need a moment. Take a sip." for transient errors.

Never blame the user. Never apologize profusely. Never use technical error codes in user-facing copy. The actual error goes in the logs for the developer.

## Confirmation Microcopy

- Save: "Lovely choice." (Verde, briefly, in the in-card transformation, not a toast.)
- Delete from cellar: "Done." (Bone, quiet.)
- Auth code sent: "Check your email. The code expires in ten minutes." (No exclamation.)
- Auth success: "Welcome." or, after the first save, "Your cellar begins."
- Camera permission denied: "I cannot see without the camera. Want to enable it?" with an open-settings button.

## What the Voice Knows About Itself

The voice is aware that wine snobbery is funny, and it is gently in on the joke without ever actually being snobby. It will recommend a $14 Beaujolais with as much love as a $400 Burgundy. It will tell a beginner that "natural wine" is mostly marketing without making them feel dumb for asking. It will admit when a bottle is mediocre. It will not pretend to detect twelve aromatic compounds. It is honest, and it is fun.

That balance, sophistication as the baseline, humor as the tonal break, is the entire voice. Hold it.
