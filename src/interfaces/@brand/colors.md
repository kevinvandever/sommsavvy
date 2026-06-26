---
name: Colors
type: design/color
description: Brand palette for SommSavvy. Candlelit wine bar at midnight.
---

The palette lives in two registers: a deep warm near-black canvas as the primary surface, with candleflame amber as the signature interactive color, plus a small supporting cast of jewel tones. Parchment is the inverse, secondary canvas for day mode and inversion moments. Pure white and pure black are not used anywhere in the app. They will look wrong against this palette.

```colors
Midnight:
  value: "#14100D"
  description: Primary canvas. A near-black with deep espresso warmth, the bartop at midnight, never sterile, never blue-black. All hero surfaces, the camera viewfinder, the home screen.
Smoke:
  value: "#1F1A15"
  description: Elevated surfaces such as cards, sheets, and modals. Lifted off Midnight by warmth and lightness, never by shadow. Roughly 6% lighter than Midnight, slightly warmer in hue.
Parchment:
  value: "#F2E9D4"
  description: The inverse canvas. Warm cream of expensive matchbook paper, slightly more yellow than typical off-white. Used for day mode, light card variants, and inversion moments.
Ember:
  value: "#E89B3C"
  description: The signature brand color. Beeswax candleflame caught at the perfect moment, honey-amber, warm, alive. Every interactive accent, every active state, every CTA, every save-confirmation glow. This is the color the brand owns.
Bordeaux:
  value: "#7A1F2B"
  description: Editorial accent. Used sparingly for category emphasis on wine, serif italic flourishes, and decorative typographic moments. Never for UI affordance, Ember does that work. Bordeaux is decorative, not functional.
Verde:
  value: "#7C8A5E"
  description: Affirmation and saved states. A dusty olive sage, the unexpected counterpoint to the warm palette. Used for success ticks, "in your cellar" badges, and quiet positive feedback. Reads as herbal and earthen, like rosemary on a charcuterie board.
Bone:
  value: "#C9BFA8"
  description: Secondary text on Midnight. Muted parchment that reads as 60% opacity but holds its warmth. Used instead of gray-white for body copy, captions, and labels in dark mode.
```

~~~
Implementation specifics for code generation:

- Borders should always be derived, never hardcoded gray. Use `color-mix(in oklch, var(--bone) 12%, transparent)` for subtle borders and `color-mix(in oklch, var(--bone) 22%, transparent)` for stronger ones.
- Use `oklch` color space for any gradients to keep warmth intact: `linear-gradient(180deg in oklch, #14100D, #1F1A15)`.
- Selected and focused states use Ember at full saturation. Hover states use `color-mix(in oklch, var(--ember) 85%, transparent)`.
- Never ship `#FFFFFF` or `#000000` in this app. The palette is calibrated to warmth, and pure values break it.
- Save-action glow uses `0 0 24px color-mix(in oklch, var(--ember) 35%, transparent)` rather than a solid box-shadow.
- Verde is used for "Saved" confirmation, in-cellar badges, and success ticks only. Never for general affirmation in body text.

Define these as CSS custom properties on `:root` immediately so every component derives from them.
~~~
