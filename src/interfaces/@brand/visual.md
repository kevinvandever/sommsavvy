---
name: Visual Identity
description: SommSavvy visual identity and aesthetic direction.
---

# Visual Identity

## The Big Idea: After Hours

The visual world is **the great wine bar at 10:47 pm**. The dinner rush is over. The somm leans on the bartop, candles burning low, polishing a glass while telling you about a Barolo. The walls are dark wood, there is a brass rail, the marble is cool under your hand, and the only people left are the ones who actually care.

That is the app.

## Why This Direction

Every competitor in the space looks wrong for the brand we are building. Vivino is a corporate fluorescent-blue database with photos. Untappd is a sports-bar checkin feed. Distiller is a dark utilitarian catalog. Delectable is a prettier feed. None of them feel like being at a great bar with someone who knows things. SommSavvy will.

The aesthetic is dark-mode-first, editorial, candlelit, confident, with a wink. Magazine-spread layouts. Chiaroscuro photography. Refined serif paired with a modern grotesque. The faux-snobby humor does not come from the visuals. The visuals are sophisticated as the baseline so the humor lands as a tonal break, not the whole brand. A sommelier who jokes is funny. A drunk uncle who jokes is annoying. The sophistication is what gives the humor its punch.

## Positioning

A pocket sommelier who reads Saveur, owns a monocle ironically, and never makes you feel small for liking what you like.

## Layout Sensibility

The texture we want: flipping through a thick thoughtful magazine while sitting at a candlelit bar. Generous negative space. Editorial type at scale. Photography that breathes. Asymmetry. Selective use of color. Information density only where it is earned (the result card detail view, the cellar list).

### Spatial architecture

- **Camera-first home.** The viewfinder is the page, not a feature. It fills the viewport on mobile. On [desktop]{Hold the viewfinder at a max width of ~480px, centered, surrounded by editorial atmosphere: running header, ambient bottle imagery in the margins, the cellar count in a corner. Do not stretch the viewfinder edge to edge on wide screens.}, it sits centered in a generous Midnight canvas surrounded by editorial atmosphere.
- **Cards as magazine pages, not tiles.** Result cards have generous internal padding ([32px on mobile, 48px on desktop]{padding: 32px on mobile, 48px on desktop. Full-bleed top photography. Display-scale Rowan titles.}), full-bleed top photography, and Display-scale Rowan titles.
- **Cellar as editorial archive.** Not a Vivino-style list. Mosaic of varying tile sizes, with key bottles getting magazine-feature treatment.

### Density gradient

- **Camera home:** very spacious. Almost empty. Just viewfinder, mode toggle, voice and text alternatives.
- **Result card:** medium. Editorial spread with generous breathing room around photography and headline. Information sectioned, not dumped.
- **Cellar/Journal:** dense at the index level (mosaic), spacious at the detail level.
- **Forms (auth, save flow):** spacious. Single field at a time when possible. Every form moment should feel like a refined exchange, not data entry.

### What to actively avoid

- Three-up feature grids on the home screen
- Center-aligned hero with subtitle and CTA below (the SaaS landing pattern)
- Tab bars with five icons. Use two or three.
- Cards inside cards inside cards
- Soft drop shadows at every elevation level. Depth here comes from warmth gradients between Midnight and Smoke, not blur.
- Pure white or pure black anywhere
- Cream-and-terracotta as the dominant palette (the AI-default look). Parchment is secondary.
- Numeric ratings of any kind — stars, dots, scores, slider values. SommSavvy does not rate. The user's own tasting note carries the qualitative read on every bottle; the editorial voice does the rest. Reducing a wine to a number contradicts the brand and creates rating-inflation noise that polluted every wine app before us.
- Generic SaaS empty states. Each empty state is a beat in the experience.
- Bottom tab bars with five items. We have at most three places to go (Home/Camera, Cellar, Profile).
- Toasts. Replace with the in-card "Saved" Verde transformation pattern.
- Skeleton shimmers. Use static skeletons with a subtle Bone-on-Smoke texture only.
- Lavender purples, baby-blue gradients, AI-sparkle iconography.

## Photography Style

Editorial chiaroscuro. Single subjects in warm raking candlelight. Deep shadows allowed. Shallow depth of field. Subtle film grain. Saveur, Conde Nast Traveler, Eater editorial. Never glossy product photography. Never bright e-commerce stock. Never overhead-perfect. Always atmosphere over information. The bottle is a character in a story, not a product spec.

When the app generates bottle photography for AI-returned recommendations, the prompt should specify editorial bottle portraits in chiaroscuro. Never product-shot-on-white. Never mix styles.

## Hero Imagery (Generated and Ready)

These images are generated and ready to use.

### App icon (primary)
![SommSavvy app icon. A wine coupe holding a single ember, against deep espresso black. Brass-S monogram subtle behind.](https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/1f098bdf-0693-4fe9-8a90-b6f7c52359da.png?w=1024&fm=webp)

### Brass-S monogram (alternate, for dense moments)
![Brass S monogram on dark espresso background. Used in auth sheets, settings, secondary surfaces.](https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/78406251-f219-452c-8d34-9bd5dbc2033d.png?w=1024&fm=webp)

### Splash and first-launch hero
![Wine coupe in candlelight, chiaroscuro lighting, dark espresso background, single point of warm amber light catching the rim of the glass.](https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/b8d7fb5e-6956-4c45-90e7-673e65290427.png?w=1200&fm=webp)

### Empty cellar state
![After-hours wine bar still life. A polished bartop, two empty glasses, a candle burning low, a folded white linen napkin. Editorial chiaroscuro.](https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/b99cf7d2-b486-4210-a8de-c3705f414684.png?w=1200&fm=webp)

### Reverse Scan onboarding
![Hand holding a wine bottle in chiaroscuro lighting. The label catches just enough warm amber light to read.](https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/2a7fc506-ecc5-4c2b-bc40-f8ac223b8696.png?w=1200&fm=webp)

### Multi-category onboarding (wine, beer, spirits in one frame)
![Editorial flat-lay still life with a wine glass, a beer glass with a finger of stout, and a rocks glass of whisky. Warm candle in background. Used for category onboarding and journal headers.](https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/0dcf0b20-68f9-48cb-85bc-a3c9469411de.png?w=1200&fm=webp)

## Component Tokens

These values must be the same everywhere. Codify them as CSS custom properties on day one.

~~~
```css
:root {
  /* Colors */
  --midnight: #14100D;
  --smoke: #1F1A15;
  --parchment: #F2E9D4;
  --ember: #E89B3C;
  --bordeaux: #7A1F2B;
  --verde: #7C8A5E;
  --bone: #C9BFA8;

  /* Borders, derived not hardcoded */
  --border-subtle: color-mix(in oklch, var(--bone) 12%, transparent);
  --border-strong: color-mix(in oklch, var(--bone) 22%, transparent);

  /* Radii */
  --radius-sm: 8px;     /* chips, tags, small badges */
  --radius-md: 14px;    /* cards, sheets, modals */
  --radius-lg: 22px;    /* hero cards, large surfaces */
  --radius-pill: 999px;

  /* Spacing scale, 4px base */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px; --s-9: 96px;

  /* Elevation, warmth not shadow */
  --lift-1: 0 1px 0 0 color-mix(in oklch, var(--bone) 8%, transparent) inset;
  --lift-2: 0 12px 32px color-mix(in oklch, var(--midnight) 70%, transparent),
            0 1px 0 0 color-mix(in oklch, var(--bone) 6%, transparent) inset;
  --glow-ember: 0 0 24px color-mix(in oklch, var(--ember) 35%, transparent);
}
```
~~~

## Buttons

- **Primary:** Ember fill, Midnight text, Geist 500, full-pill (`radius-pill`), 14px by 24px padding for default, 18px by 32px for hero shutter.
- **Secondary:** Smoke fill, Bone text, full-pill.
- **Tertiary (text):** No fill, Bone text, Ember on hover.
- **Loading state:** Replace label with a `loader-2` Tabler icon spinning. [Fix button width with `min-width`]{Use min-width on the button at the natural width of its label so the spinner-vs-label swap never resizes the button. This is critical for layout stability.} to prevent layout shift.

## Inputs

- Smoke fill, no border by default, 1px Ember border on focus (animated 180ms).
- 14px Geist, 12px by 16px padding, `radius-md`.
- Placeholder in Bone at 50% opacity.

## Sheets and Modals

- Smoke surface, `radius-lg` top-only on mobile, full radius centered on desktop.
- Slide up from bottom on mobile, centered with backdrop on desktop.
- Backdrop: `rgba(20, 16, 13, 0.6)` with `backdrop-filter: blur(12px)`.
- Tap-outside-to-dismiss enabled. Escape key on desktop.
- Drag handle at top: a 36px wide, 4px tall Bone pill at 30% opacity.

## Icons

Tabler outline at stroke-width 1.5. 18px in body context, 20px in buttons, 24px in nav. Always `currentColor`.

## Motion

The motion vocabulary is slow, settled, confident, like wine being poured. Productivity-app snappiness is wrong here.

### Easing curves

- Standard: `cubic-bezier(0.32, 0.72, 0.24, 1)`. Settled, slightly anticipatory.
- Entrance: `cubic-bezier(0.18, 0.89, 0.32, 1.05)`. Small overshoot.
- Exit: `cubic-bezier(0.4, 0, 0.6, 1)`. Clean.

### Durations

- Micro (hover, tap): 180ms
- Standard (most transitions): 380ms
- Hero (sheet sliding, mode switch): 560ms
- Scan reveal (the signature moment): 800ms+

### Specific motion specs

1. **Mode switch (Somm to Scan).** Cards crossfade with a slight 8px lateral parallax offset, 380ms. Not slide-replace. Crossfade.
2. **Save-to-cellar.** When tapped, the bookmark icon fills with Ember (200ms), the button label briefly changes to "Saved" in Verde for 800ms, then the result card itself gently scales to 0.96 and fades to 0.4 opacity as it tucks away (480ms), revealing whatever was beneath. Layout must be reserved during this.
3. **Card entry from scan.** Spring physics, stiffness 240, damping 30, mass 1. Slides up from below, settles with soft overshoot.
4. **Depth toggle copy crossfade.** [180ms out, then 220ms in, fixed-height container]{Reserve the height of the longest variant. Never let the container resize when copy swaps. This is critical for layout stability.}.
5. **Camera shutter.** Subtle 0.96 scale-in on press (60ms), brief 30% white flash overlay on release (140ms).
6. **Cellar tile hover (desktop).** Tile lifts via `translateY(-2px)` plus a subtle Ember-glow box-shadow `0 12px 32px color-mix(in oklch, #E89B3C 18%, transparent)`. 280ms.
7. **Voice flame.** Continuously breathing animation (scale 1.0 to 1.05 over 1.8s, ease-in-out, infinite alternate), with audio-input scale modulation layered on top.
8. **Drag-to-dismiss thresholds for sheets.** Dismiss if dragged below 35% of sheet height OR release velocity exceeds 480 px/s. Otherwise spring back (stiffness 320, damping 28).

Use `motion/react` (Motion library) for sheet transitions, layout animations, and gesture-driven interactions. Use raw CSS for hover and tap states.

## Day Mode (Inverse)

A secondary day-mode palette swap (Midnight to Parchment, Smoke to a slightly warmer Parchment shade, Bone to a deeper Bone-on-paper variant) is available behind a settings toggle. Day mode is for reading the cellar in bright sunlight or for users who prefer light interfaces. The dark mode is the default and the brand. Day mode is a feature, not the canvas.
