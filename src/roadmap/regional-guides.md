---
name: Regional Deep-Dives
status: planned
effort: large
description: Immersive editorial guides to the great wine regions, brewing traditions, and spirit categories — travel writing for your glass.
---

Tasting School teaches you what to know. Regional Deep-Dives take you somewhere. A guide to Burgundy reads like a travel feature in a great food magazine — history, geography, the hierarchy of appellations, the producers worth knowing, what the locals drink and why, and what to order when you are there or when you are wishing you were. This is the content layer that makes SommSavvy the reference you open before the trip, not just during the dinner.

## What it looks like

- Accessible from the cellar, result cards, and the profile as a browsable destination.
- Full-screen editorial experience for each guide: long-form prose broken into sections with chiaroscuro photography, pull quotes in Display Rowan, and embedded bottle recommendations.
- Guides organized by category: Wine Regions, Beer Origins, Spirit Schools.
- Priority regions at launch: Burgundy, Loire, Champagne, Barolo and Barbaresco, Rioja, Napa, Willamette Valley; Islay, Highlands, Speyside, Irish whiskey, Japanese whisky; Belgium (Trappist and saison), German wheat beer, Czech pilsner.
- Linked from cellar entries: a saved Côte de Nuits wine surfaces a "Go deeper on Burgundy" link in the entry detail.
- Each guide ends with "Bottles to Know" — three to five canonical examples, each linkable into Pocket Somm or Reverse Scan.

## Key details

- Guides are human-written and edited to the SommSavvy standard. They are not dynamically generated at runtime. The voice is held to a higher bar here than in ephemeral recommendations.
- Each guide is periodically updated for notable vintage news, producer changes, or appellation developments.
- The "Bottles to Know" picks are not the most expensive or most famous options — they are the most instructive ones, in the voice of someone who genuinely knows the region.
- Reading a guide can surface contextual Tasting School modules if a user has not completed the relevant lesson.
- The photography for guides uses the chiaroscuro prompt style: vineyards at dusk, barrels in raking light, not tourist-brochure sunshine.

~~~
New table: regional_guides with title, category ('wine' | 'beer' | 'spirits'), regionSlug (unique, used for URL routing and cellar entry matching), heroImageUrl, bodyJson (array of { type: 'heading' | 'body' | 'pullquote' | 'image', content: string, imageUrl?: string }), bottlesToKnow (JSON array of partial Recommendation objects), publishedAt, updatedAt. New methods: listRegionalGuides({ category? }) and getRegionalGuide({ slug }). The getEntry method checks the guide table for a matching regionSlug from the entry's region field and returns a guideSlug if found. The frontend renders this as a "Go deeper" link on the entry detail. No admin UI in the first version — guides are seeded manually via JSON. Regional guide photography is commissioned as a batch of chiaroscuro editorial images at content-build time.
~~~
