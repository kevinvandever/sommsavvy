---
name: Typography
type: design/typography
description: Type system for SommSavvy. Editorial serif paired with a modern grotesque.
---

The pairing is the brand. Rowan provides warmth: a high-contrast transitional serif with ball terminals, just personality enough to feel like a real magazine without becoming aggressive Didone. Geist provides precision: a neutral modern grotesque, never sterile because it lives next to Rowan. The contrast is the point. Classical knowledge delivered through a modern interface.

```typography
fonts:
  Rowan:
    src: https://api.fontshare.com/v2/css?f[]=rowan@300,400,500,600,700&display=swap
  Geist:
    src: https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap

styles:
  Display:
    font: Rowan
    size: 56px
    weight: 400
    letterSpacing: -0.02em
    lineHeight: 1.04
    description: Hero headlines, recommendation card titles, marquee moments. Rowan's high-contrast serif does the heavy lifting of "this is a magazine, not a spreadsheet."
  DisplayItalic:
    font: Rowan
    size: 56px
    weight: 400
    style: italic
    letterSpacing: -0.02em
    lineHeight: 1.04
    description: The faux-snobby moments. Used when the sommelier voice is doing a bit ("adjusts monocle"). Italic Rowan is the typographic cue for tonal shift.
  Headline:
    font: Rowan
    size: 32px
    weight: 500
    letterSpacing: -0.015em
    lineHeight: 1.15
    description: Section titles, modal headers, cellar entry titles.
  Subhead:
    font: Geist
    size: 17px
    weight: 500
    letterSpacing: -0.005em
    lineHeight: 1.4
    description: Card subtitles, key supporting text.
  Body:
    font: Geist
    size: 16px
    weight: 400
    lineHeight: 1.55
    description: Default reading text for recommendations, tasting notes, descriptions. The cool counterweight to Rowan's warmth.
  WhyThisWorks:
    font: Geist
    size: 18px
    weight: 400
    lineHeight: 1.55
    description: The "why this works" body copy on result cards. One step larger than standard body to give the explanation room to breathe.
  Label:
    font: Geist
    size: 12px
    weight: 500
    letterSpacing: 0.08em
    lineHeight: 1.2
    case: uppercase
    description: All-caps eyebrow labels above section headers ("REGION", "PAIRINGS", "FROM YOUR CELLAR"). The editorial micro-detail that telegraphs sophistication.
  Caption:
    font: Geist
    size: 13px
    weight: 400
    lineHeight: 1.45
    description: Metadata, timestamps, fine print, tasting note attribution.
  Mono:
    font: ui-monospace, SFMono-Regular, Menlo, monospace
    size: 12px
    weight: 500
    letterSpacing: 0.02em
    description: Scan readouts, technical metadata such as vintage years, ABV, and region codes. The "this is a precision instrument" texture during reverse-scan moments.
```

~~~
Critical implementation rules:

- **Two registers, two type styles for voice.** The friend voice is set in upright Geist Body. The faux-snobby aside is set in italic Rowan, often em-dashed off the main thought. This is the typographic hook for the joke-then-answer pattern returned by AI methods.

- **The "monocle moment" pattern.** When AI output contains a snob aside marked off (em-dashes, parentheses, or a dedicated `aside` field in structured output), render it in italic Rowan, 90% size, in Bone color. The honest answer follows in upright Body. The visual setup is the joke.

- **Beginner mode does not change typography.** It changes copy. Same type system, simpler sentences. No question-mark icons, no glossary tooltips beside terms. That is how Vivino telegraphs condescension.

- **Expert mode does not change typography.** It changes copy. Denser information, more proper nouns. Same type system.

- **Avoid these fonts entirely:** Inter, Plus Jakarta, Outfit, Lora, Playfair Display. Every AI-default font will undermine this direction. Rowan + Geist only.

- **Never use exclamation points or emoji in any AI-generated copy or static UI copy.** "Lovely choice." not "Lovely choice!"
~~~
