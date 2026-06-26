---
name: Web Interface
description: SommSavvy web interface. Mobile-first camera surface with editorial result cards and an asymmetric cellar mosaic. Looks great on desktop too.
---

# Web Interface

The web interface is mobile-first and feels like a native iOS app while remaining beautiful on desktop. The camera is the front door. Everything else flows from there.

~~~
Use Vite + React with TypeScript. The frontend lives at `dist/interfaces/web/`. Set `defaultPreviewMode: "mobile"` in `web.json` since this is a mobile-first product.

The viewport meta should disable user scaling: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`. Set `user-select: none` on app-chrome elements (camera surface, mode toggle, cellar tiles, header) to feel native; allow it on user-content surfaces (notes, entry detail prose).

Use `motion/react` for sheet transitions, layout animations, and gestures. Use Zustand for global state (current user, depth preference, cellar entries, current result). Use `wouter` for routing. Use `react-textarea-autosize` for the text-input mode. Use `use-stick-to-bottom` if scrolling is needed in any chat-like view (probably not in MVP). Use `@tabler/icons-react` for iconography.

Load all of the user's cellar in one call on app start (Zustand store). With small numbers of entries per user, in-memory rendering is faster than per-route fetching. Optimistic mutations everywhere.

Always reserve container heights to prevent layout shift, especially around streaming AI text and depth-toggle copy swaps.
~~~

## Routes

The app has these routes. All others 404 to a custom page.

- `/` - Camera home. The front door. Camera surface, mode toggle, voice and text alternatives.
- `/result` - The result view. Holds the current result in state. Reachable only after a Pocket Somm or Reverse Scan completes. Refreshing this route returns the user to `/`.
- `/cellar` - The cellar mosaic. Filter chips, search, the editorial archive.
- `/cellar/:entryId` - A single cellar entry detail page.
- `/profile` - The user's profile, taste summary, depth preference, and a sign-out button.
- `/welcome` - First-launch sequence. Three slides. Shown to new users on first ever load (tracked client-side).

There is no separate sign-in page. Auth happens contextually inside a sheet when the user attempts to save.

## The Camera Home

The viewport is Midnight with a subtle inner-glow vignette (a faint Ember radial in the bottom third at about 3% opacity). The viewfinder occupies the center vertical zone.

### Layout, top to bottom
1. **Quiet header** with the brass-S monogram (24-32px) at left. At right: the cellar count for signed-in users ("47 in cellar"), or a small "Sign in" tertiary button for anonymous users. The center is intentionally empty — the header is meant to recede. The depth preference is not surfaced here. It lives in the profile.
2. **Mode toggle** just above the viewfinder. Horizontal segmented label: "Pocket Somm | Reverse Scan". The active mode uses a Smoke pill background with an Ember underline. Inactive is Bone text with no fill. [Sliding underline animates between modes]{Use an absolutely-positioned indicator that animates `left` and `width` to match the active button. Use the standard easing curve (cubic-bezier(0.32, 0.72, 0.24, 1)) and 380ms duration.}.
3. **The viewfinder**. On mobile, fills the available vertical space between header and shutter, with `radius-lg` corners. On desktop, held at max-width 480px, centered, with editorial atmosphere in the surrounding canvas. Live camera feed when permission granted, a fallback hero image (the candlelit coupe) when not. [A small glass-on-glass pill anchored to the lower-left of the viewfinder reads *"From the camera roll"*]{The pill is a compact 36px tall button with a photo-library glyph and the verbatim "From the camera roll" label. Surface: `color-mix(in oklch, var(--midnight) 62%, transparent)` with `backdrop-filter: blur(10px) saturate(120%)` and a hairline Bone-at-18% border. Positioned absolutely at `left: 12px, bottom: 64px` so it clears both the corner brackets (at `bottom: 16px`) and the fallback "Tap the shutter to begin." caption (at `bottom: 28px`, centered) with ~16px of breathing room above the caption. Tapping it triggers a hidden `<input type="file" accept="image/*">` (no `capture` attribute, so iOS surfaces both "Take Photo" and "Photo Library" with library presented first). On selection: the picked image renders in the viewfinder immediately via FileReader as an optimistic preview, the file uploads to the CDN in parallel, then the current mode (Somm or Scan) fires just like a shutter capture would. The pill hides (opacity 0, slight downward translate) the moment scanning starts or a captured frame is held, so it does not compete with the active capture moment. Anchored to the viewfinder rather than the icon cluster because it is an alternate camera input, not a peer of voice/text.}.
4. **The shutter cluster**. A single big circular shutter (Ember fill, 72px on mobile, 88px on desktop), flanked symmetrically by a smaller voice icon button (left, 44px Smoke circle, microphone glyph) and text icon button (right, 44px Smoke circle, keyboard glyph). The size asymmetry communicates that photo is primary, voice and text are equal alternatives.
5. **Tagline strip**. A single line of italic Rowan beneath the shutter cluster, mode-aware:
   - Pocket Somm: *"What goes with what is in front of you."*
   - Reverse Scan: *"Aim and identify."*

~~~
The tagline used to vary by depth as well as mode, but with depth moved to the profile it would feel disconnected from the UI. Mode-only keeps the tagline in dialogue with the most visible control on the screen.
~~~

### No bottom tab bar on the home

The home is a destination. The cellar is one swipe up or one tap on the cellar count badge in the header. It opens as a sheet, not a tab. Settings and profile live behind a tap on the brass-S monogram.

### Camera permission flow

On first attempt to use the camera, request permission contextually with a styled sheet that explains why. Do not request on app load. If permission is denied, the viewfinder falls back to the candlelit-coupe hero image and the shutter remains tappable but routes to a "use your photos" file picker.

## Voice Input ("the candle")

When the user taps the voice icon, the screen transitions to a fullscreen Midnight surface with a single animated candle flame centered.

The flame is rendered as a soft Ember radial gradient with subtle SVG turbulence. It scales and breathes in response to audio amplitude (1.0 to 1.15 scale, tied to mic input level). Below the flame: live transcription appearing word by word in Geist, slightly muted. A small "Done" pill at the bottom commits the input. A small "Cancel" tertiary button returns to the home.

~~~
- Use the Web Audio API for amplitude detection (AudioContext + AnalyserNode + getByteFrequencyData on the mic stream).
- Render the flame as inline SVG with a feTurbulence + radial gradient. Animate the turbulence baseFrequency on a slow loop and tie the SVG group's transform: scale to a CSS variable updated from the analyser.
- Speech-to-text uses the Web Speech API where available (live partial transcripts) and falls back to recording the audio and calling `transcribeVoice` on submit.
- No waveform. Waveforms are everywhere. The breathing flame is ours.
~~~

## Text Input

When the user taps the text icon, a sheet slides up with a single auto-growing textarea (Geist, 18px), the placeholder "*Tell me what you are having.*" in italic Rowan at 50% Bone, and an Ember "Pour" button.

The sheet is at most 60% of viewport height, with a generous top margin. Submitting fires the same pocketSomm or reverseScan call as the photo flow.

## The Scanning Moment (Reverse Scan)
This is the signature moment of the app. Get it right.

When the user takes a photo in Reverse Scan mode:

1. The captured photo holds in place full-screen. After a 200ms beat, it gently darkens by 30% with a slow 600ms fade.
2. An Ember-glow line slowly [traces across the full viewport]{The line is a plain absolutely-positioned div, not an SVG rect — Safari and Chrome render CSS transforms on SVG children inconsistently when the parent uses preserveAspectRatio="none", which previously caused the bar to travel only a fraction of the viewport on iOS. The translateY keyframe runs from -6px to 100dvh so the bar traverses the full dynamic viewport height even as the iOS address bar collapses or expands.} like a sommelier reading the etiquette. The line takes 1.3 seconds from one side to the other.
3. Below: small mono text streams a status line, replaced every 200ms with a 200ms fade between lines: *"Reading the label..." → "Locating the producer..." → "Checking the vintage..."*
4. Total scan animation is held to a minimum of 1.6 seconds and a maximum of 2.4 seconds. If the AI returns sooner, hold for the minimum. If it takes longer, the status line becomes "Confirming..." and the trace line continues a slow loop. Cap at 30 seconds with a graceful timeout.
5. When the result lands, the dimming lifts and the result card slides up from the bottom as a sheet, partially overlapping the bottle photo so the photo becomes the card's hero image. Spring physics (stiffness 240, damping 30, mass 1).

For Pocket Somm, the scanning moment is similar but the status lines are different: *"Reading the room..." → "Considering pairings..." → "Pouring three glasses..."* and the result card is the recommendation set rather than a single bottle.

[The opener adapts to the input source]{Photo input gets the literal verb: "Reading the room..." for Pocket Somm, "Reading the label..." for Reverse Scan. Text and voice input both use "Considering..." — by the time the user has tapped Done on the voice sheet or hit submit on the text sheet, the listening or typing moment is over and the somm is thinking. Voice transcribes to text upstream, so both modes look identical to the backend. The branch lives in the frontend's initial setStatus and in each method's first stream call.}. Subsequent status lines ("Considering pairings...", "Pouring...") are the same regardless of input source.

## The Result Card (Pocket Somm)

A vertical scroll of three or four recommendation cards, each with a full-bleed editorial photograph at top fading via a subtle gradient into the Smoke card body (never a hard edge). The photo aspect ratio is 4:5. The card has internal padding of 32px on mobile and 48px on desktop, `radius-lg` corners.

### Card content, top to bottom

1. **The chiaroscuro photograph**, full-bleed top.
2. **A category eyebrow** in Label style. "WINE", "BEER", "SPIRITS".
3. **The drink name** in Display Rowan.
4. **A metadata line** in Caption style, dot-separated: producer · region · vintage · ABV. Skip values that are unknown.
5. **The "why this works" paragraph** in WhyThisWorks style (Geist 18px). When a monocle aside is present, render it inline in italic Rowan at 90% size, in Bone color, set off with em-dashes. The honest answer follows in upright WhyThisWorks.
6. **A horizontal divider** in `border-subtle` color.
7. **A pairings strip** with two to four short text chips in a horizontal row. Smoke fill, Bone text, `radius-pill`.
8. **A save pill at the bottom**: Ember fill, Midnight text, `radius-pill`, with a small bookmark icon at left. Label "Save to Cellar".

Above the card stack, a single line in italic Rowan: the agent's overall summary line ("Three pours that all earn their place at this table.").

Below the card stack, a tertiary "Try again" button that returns to the camera home.

### Save interaction

When the user taps Save:

1. The bookmark icon fills with Ember (200ms).
2. The button label briefly changes to "Saved" in Verde for 800ms.
3. The result card itself gently scales to 0.96 and fades to 0.4 opacity as it tucks away (480ms), revealing the next card or, if it was the last one, the camera-home CTA.
4. [Layout is reserved during this entire sequence.]{The card's container holds its original height even after the card itself fades. Otherwise the layout shifts as cards collapse, which feels broken.}

If the user is anonymous, tapping Save instead opens the auth sheet. After auth completes, the save resumes automatically and the saved-state animation plays.

## The Result Card (Reverse Scan)

A single editorial card, larger than a Somm card, structured like a magazine spread:

1. The chiaroscuro photograph (4:5), full-bleed top.
2. The producer name in Label style as eyebrow.
3. The drink name in Display Rowan, possibly two lines.
4. A metadata line in Mono style: vintage · ABV · region.
5. **What to expect** section: a small Label heading, then two depth-appropriate sentences in WhyThisWorks. Monocle aside as inline italic Rowan when present.
6. A horizontal divider.
7. **Pairings** section: Label heading, three to five chips.
8. **Value note** section: Label heading, a single sentence in Body. The voice is honest. "$55. A serious pour for the price." or "Overpriced for what it is. Look at Bandol Tempier instead."
9. **Occasion** section: Label heading, one short sentence. "Sunday dinner with people who care."
10. The save pill.
11. [The save tap is integrated with the note capture moment]{Tapping "Save to Cellar" does two things in sequence: the save fires immediately (one-tap preserved — the pill flips to Verde "Saved" and the entry is in the cellar), and the note sheet (NoteSheet) auto-opens as the natural next beat. The sheet contains: an "Add a note" eyebrow label, the drink name in t-headline, an optional producer/region/vintage context line, an autofocused textarea with placeholder *"What's the moment? Where did you find it? What was on the plate? Any of it. All optional."*, the closing line *"Notes shape how I read you. Skip is fine. Honesty helps."*, and Skip + Save note buttons. Skipping is a first-class action — empty notes are treated as a skip, swiping down or tapping the backdrop dismisses without penalty. If the user dismisses without typing, a quiet *"+ Add a note"* tertiary link appears beneath the pill as a re-opener. After a non-empty note is saved, that link is replaced by a *"Noted. Edit from the cellar."* caption. The Save call is optimistic — the store is patched immediately, the API call follows in parallel, and the server-side updateCellarEntry triggers a taste-summary regeneration whenever notes change. Notes carry the entire qualitative signal for the entry — there is no rating field — so the regeneration prompt reads each note verbatim as the bottle's character. The sheet auto-opens via a one-shot ref guard (autoOpenedRef) that fires on either the direct save path (handleSave returns entry id) or the auth-resolved path (parent supplies savedEntryId after auth success), but never twice for the same save event. The capture moment lives in a bottom sheet rather than inline on the card because the editorial cards are deliberately not cluttered — a textarea would break their composition. Beneath the note field, separated by a full-width hairline divider, sits a quiet ownership row: a bottle glyph, the label "I have a bottle of this", and the shared ownership Switch, off by default. Most saves are things tasted, not bottles held, so it stays unobtrusive. Toggling it persists immediately and independently of the note (the entry is already saved), via updateCellarEntry({ patch: { owned } }) — so dismissing with Skip never loses an ownership choice. When on, the glyph and label brighten to full Bone/Parchment alongside the Bone switch.}.

## The Cellar Mosaic
Filter chips at the top in a horizontal row: [All / Wine / Beer / Spirits / In the Rack]{Text-only chips in Label style (no glyphs). The first four filter by kind; "In the Rack" is the ownership filter, showing only entries where owned is true. Active chip is Ember fill, Midnight text (filters use the interactive Ember register, never the Bone ownership register). Inactive is Smoke fill, Bone text. On mobile the five chips wrap to a second line cleanly. When "In the Rack" is active and nothing is owned yet, show an in-voice empty state: heading "Nothing in the rack yet.", caption "Mark a bottle as on hand from any entry and it shows up here.", and a "Back to all" tertiary button.}. 

Below the chips, a search input. The [placeholder personalizes to the signed-in user]{Reads "*What are you looking for, [first name]?*" when the user has a displayName on file. Falls back to a neutral "*What are you looking for?*" otherwise. The new-user case shouldn't pretend to know you, so "friend" is not used as a fallback.} in italic Rowan at 50% Bone. On desktop, a `Cmd-K` keyboard shortcut focuses the search.

The mosaic itself is an asymmetric grid of varying tile sizes. Recent additions get larger tiles. Other entries get standard tiles. [The grid uses CSS Grid with explicit row and column spans on featured tiles.]{Use a 12-column CSS Grid on desktop and a 6-column grid on mobile. Most tiles take 4 columns. Featured tiles take 8 columns and span 2 rows. Newest entries (savedAt within the last seven days) get a featured slot, capped at one in five entries so the mosaic stays rhythmic. Use grid-auto-flow: dense to fill gaps neatly.}

Each tile is a card with a chiaroscuro photo of the bottle, the name in Rowan, and a Caption row with producer and vintage. [Owned entries carry a single quiet Bone dot in the top-right of the photo]{A 7px (8px on featured tiles) Bone dot at top:12px right:12px, with a dark halo (box-shadow 0 0 0 3px midnight-at-55%) for legibility over chiaroscuro highlights. No glow — ownership is a stated fact, not an achievement, so it borrows neither Ember's loudness nor Verde's celebratory energy. The dot is suppressed when the "In the Rack" filter is active (every tile would be dotted — noise). There is no numeric rating anywhere on the tile; the dot is the only marker, and it signals ownership, not quality.}.

### Tile interactions

- Tap (mobile) or click (desktop) opens the entry detail.
- Long-press (mobile) or right-click (desktop) reveals a quick-actions menu: View, Edit Notes, Remove.
- Hover (desktop): tile lifts via `translateY(-2px)` plus a subtle Ember-glow box-shadow (`0 12px 32px color-mix(in oklch, #E89B3C 18%, transparent)`). 280ms.

### Empty state

The after-hours still-life photo full-bleed at top. Below, in Display Rowan: *"Your cellar is quiet."* Subtitle in Body: "Open the camera and tell me about the last good thing you drank." A tertiary button: "Open camera" that routes to `/`.

For anonymous users on the cellar route, show the same empty state but with an additional Ember pill button: "Sign in to start saving." that opens the auth sheet.

## The Cellar Entry Detail
A magazine-spread layout. Full-bleed photograph at top, then:

1. Category eyebrow in Label.
2. Drink name in Display Rowan.
3. Metadata line.
4. [**Ownership card**]{A Smoke-on-Midnight card with a bottle glyph, the label "I have a bottle of this" in Geist 16/500 Parchment, a fixed-height caption (reserves the taller variant so toggling never shifts layout), and the shared ownership Switch on the right. Placed immediately under the metadata line, above the AI context, so it is discoverable as the management surface for the held subset — this is where the user marks the whisky and gin they actually own, and turns a bottle off once they finish it. Caption OFF: "Mark it when you keep a bottle on hand." Caption ON: "In the rack. Turn this off when you finish the bottle." Toggling persists optimistically via updateCellarEntry({ id, patch: { owned } }); it does NOT trigger a taste regen (ownership has no effect on taste signal). The switch's on-state is Bone — the same color as the owned dot on the tile.}.
5. **Notes** section: editable inline. Tap to edit. Geist Body. Save on blur. Optimistic update. Notes carry the entire qualitative signal for the entry — there is no numeric rating.
6. **Tasted on** section: a date picker (or "tap to set"). Optional.
7. **What we know about it** section: an AI-generated paragraph or two of context, regenerated lazily. This pulls from the original recommendation or scan and is also regeneratable on demand.
8. **Remove from cellar** as a tertiary button at the bottom in Bordeaux color text. Confirmation sheet on tap.

~~~
There is no rating control anywhere in the app — removed by intent (see the brand anti-patterns). The structured signal an entry carries is the two booleans tasted and owned; the qualitative signal is the user's note. The depth dial belongs on the Profile page, not here.
~~~

## Auth Sheet

The plan calls for try-first auth: anonymous use, sign in to save. The auth gate must feel like a moment, not a wall.

When the user hits Save anonymously, slide up a sheet (not a full screen) on top of the result, which dims to 0.5 opacity behind it. The sheet contains:

1. The brass-S monogram at top, 32px.
2. A line in Display Rowan (smaller, 32px): *"Let's start your cellar."*
3. A subline in Body: "Email and a six-digit code. No passwords."
4. A single email input. Geist 17px, Smoke fill, Ember focus border.
5. An Ember "Send code" pill button. Spinner replaces label on tap, with `min-width` reserving the button width.

After send, the email input collapses with a short animation and is replaced by **six individual digit boxes** in a row. Each is 48px square, Smoke fill, Bone text in Display Rowan size. Auto-advance between boxes as the user types. Paste fills all six. On the sixth digit being entered (or after a paste), the verification fires automatically.

On verification success, the sheet does not dismiss generically. It transforms:

1. The brass-S monogram fades to a thumbnail of the bottle the user was about to save.
2. The line changes to *"Lovely choice."* in italic Rowan.
3. After 1.2 seconds, the sheet dismisses, and the cellar count in the header animates up by one.

On verification failure (wrong code), an inline error appears below the digit boxes in Bordeaux-text Body: "Wrong code. Try again, or send a new one." A "Resend code" tertiary button is always available beneath the boxes.

~~~
Use `auth.sendEmailCode(email)` and `auth.verifyEmailCode(verificationId, code)` from `@mindstudio-ai/interface`. Listen via `auth.onAuthStateChanged` to update the global user state. Test bypass: `remy@mindstudio.ai` with code `123456`.
~~~

## The Welcome Sequence (First Launch)
Three full-screen slides shown to first-time visitors only. Stored in localStorage so it does not repeat. A small "Skip" tertiary button at top-right on every slide.

1. **Slide 1: the candlelit coupe hero.** Display Rowan title: *"Hello, friend."* Body: "I am SommSavvy. I help you find what to drink and what you are drinking. The voice has a sense of humor. The recommendations do not. Curious, comfortable, or serious — your call, in profile." The closing clause is the only place in the welcome where the depth dial is acknowledged. It is intentionally short and respectful of all three audiences. None is framed as easier or harder than another.
2. **Slide 2: the multi-category flat-lay hero.** Title: *"Photo, voice, or text."* Body: "Wine, beer, spirits — all three. Show me what you are having and I will find the pour." The multimodal capability headlines this slide; categories ride along in the body.
3. **Slide 3: the empty cellar hero.** Title: *"Your cellar grows."* Body: "Save what you love. The more you save, the better the recommendations get. No pressure." [Between the body and the CTA, a quiet italic affordance reads *"Tell me about your taste first."*]{Tapping the link expands inline into a textarea (rowan-italic placeholder, ~4 rows, 1500 char max) where the user can describe their taste in their own words. A small helper caption beneath the textarea reads *"Optional. I will weave this into how I read you from your first scan."* The seed persists when the user taps the final CTA — for signed-in users via `updateProfile({ tasteSeed })`, for anonymous users by stashing the text under the `somm-taste-seed-pending` localStorage key. App.tsx picks up the pending seed after the next auth resolves and applies it via the same updateProfile call, then clears the key. The seed is the cold-start mitigation: until the cellar has enough entries to derive a profile, the user's own words ARE the taste profile. The regeneration pipeline reads the seed as foundational context forever after, so even after entries accumulate the user's stated preferences keep shaping the summary.}

Each slide has a "Continue" Ember button at the bottom. The third slide's button says "Open the camera" and routes to `/`.

~~~
Welcome should not gate the app. Anyone can skip. The skip simply marks the localStorage flag and routes to `/`. The slides use the hero images already sourced from the design expert. Each slide uses Motion crossfades on advance, 480ms, with a slight 12px parallax of the photo and 8px parallax of the text in opposite directions to feel like flipping a magazine page.
~~~

## Profile Page
Accessed by tapping the brass-S monogram in the header. A sheet slides up with:

- **Display name**, editable.
- **Email**, read-only display.
- **How I read you**, a three-position segmented toggle (Beginner, Enthusiast, Expert) — the user's default depth for new sessions. Below the toggle, a single line of t-aside copy describes the [character of the selected mode]{The descriptions are character beats, not skill ratings. They describe how the writing changes, not who the user is. Beginner: "More context. The why and how behind each pick." Enthusiast: "Confident and quick. On the level." Expert: "Tight, technical, no preamble." The container reserves a min-height of 1.4em so swapping descriptions does not shift surrounding sections.}. None of the three is framed as easier, harder, or for a particular kind of person. A beginner can pick Expert because they want it terse; an expert can pick Beginner because they want longer notes to share with a friend. This is a respect dial, not a skill rating.
- **Day mode toggle**, a small switch labeled "Daylight". Inverts the palette (Midnight becomes Parchment, etc.). Off by default.
- **Your taste profile**, a paragraph rendered in WhyThisWorks size, italic Rowan first sentence, Body for the rest. Empty state in italic Rowan: *"I am still getting to know you. Save a few bottles and patterns start to emerge. The note below seeds the rest."* — in voice, candid that the profile is still forming, and points to the seed below. A "Refresh" tertiary button at right that re-runs the regeneration.
- **In your own words**, an editable textarea that holds the user's taste seed. Helper caption above: *"Whatever you want me to know. Producers you reach for, things you avoid, the dinner that converted you. I weave this in."* Saves on blur via `updateProfile({ tasteSeed })`, which triggers a server-side regeneration that incorporates the seed alongside cellar entries.
- **Sign out** as a tertiary button in Bordeaux-text Body at the bottom.

## Loading and Streaming

All AI methods stream progress to the frontend. The frontend reflects this contextually:

- **During Pocket Somm or Reverse Scan**: the status lines in the scanning moment update from the stream events.
- **During taste-summary regeneration**: the profile sheet shows a small Bone-on-Smoke skeleton in place of the summary text and updates live as tokens arrive.
- **During photo generation for recommendations**: a Bone-on-Smoke aspect-locked rectangle holds the space, with a faint pulsing Ember glow. When the image arrives, it crossfades in over 380ms.

~~~
Use `useSWR` for cellar data fetching with the `mutate` function for after-mutation revalidation. Combine with the Zustand store: SWR is the cache, Zustand is the active session state. For streaming, use the `stream: true` option on method calls and update local state from `onToken`.

Reserve heights everywhere. Loading-to-loaded transitions must not change container size. The "why this works" text container holds the height of the longest variant across all three depth modes. The card stack reserves the height of three or four cards even before the photos arrive.
~~~

## Errors and Fallbacks

All errors render in the brand voice (see voice.md for full guidance). They are inline, not toasts.

- **Camera permission denied**: viewfinder shows the candlelit coupe hero with a small Bone caption "I cannot see without the camera. Want to enable it?" and an Ember "Allow camera" button.
- **Photo upload failed**: replace the viewfinder briefly with the same hero plus "The image came through blurry. One more try?" and a "Try again" Ember button.
- **AI method timed out**: replace the scanning moment with the empty cellar hero plus "Need a moment. Take a sip." and a "Try again" Ember button.
- **Auth code wrong**: inline error beneath the digit boxes (see auth flow above).
- **Network offline**: a small Bone strip at the top of the screen: "Offline. Saving when you reconnect." Disables shutter while offline.

## Mobile Specifics

- Viewport meta with `maximum-scale=1.0, user-scalable=no` to feel native.
- `dvh` for any 100vh usage to handle mobile safe areas.
- Tap targets are at least 44px square.
- Sheets respect the iOS safe area insets via `env(safe-area-inset-bottom)`.
- The save pill on the result card sticks to the bottom of the card, not the viewport.
- Camera uses the `environment` (rear) camera by default. A small flip icon in the viewfinder corner switches to user-facing.

## Desktop Specifics

- The camera home centers content with a max-width of 480px for the viewfinder cluster, surrounded by Midnight canvas with ambient bottle imagery in the margins (low-opacity hero photos floating at corners).
- The cellar uses the 12-column grid.
- Hover states on every interactive element.
- Keyboard shortcuts: `Cmd-K` opens search on the cellar, `/` focuses the text input from the home, `Escape` dismisses sheets.
- The auth sheet centers in the viewport rather than slides from the bottom.
- The voice and text alternative buttons on the home are larger on desktop (56px circles).

## Accessibility

- All interactive elements have accessible names.
- The depth toggle and mode toggle are radio groups with proper roles.
- The candle flame has `aria-hidden` and the live transcription has `aria-live="polite"`.
- Color contrast: Ember on Midnight passes AA. Bone on Midnight is 7:1. Ember on Smoke passes AA.
- Reduce motion: respect `prefers-reduced-motion` everywhere. Replace springs with 0.01s instant transitions, replace flame breathing with a static glow, replace card scale-down on save with an opacity dip only.
- Focus visible: every focusable element has a visible focus ring in Ember.
