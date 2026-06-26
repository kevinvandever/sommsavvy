---
name: Year in Drink
status: planned
effort: large
description: A personalized annual report on your year in drink — the highs, the patterns, the discoveries, and the bottle you kept going back to.
---

Once a year, SommSavvy compiles everything the user saved, tasted, and rated into a bespoke editorial report. Not a stats dashboard — a story. A real narrative about what kind of drinker they were this year, where they traveled in glass, what surprised them, and who they have become. The kind of thing people screenshot and send.

## What it looks like

- Generated each January, accessible year-round from the profile page under "Your years."
- Opens as a fullscreen editorial experience — paginated like a magazine, not a scrollable wall of stats.
- Sections:
  - **The year in numbers.** Total entries, bottles tasted, categories explored, most active month. Rendered as large editorial numerals in Display Rowan, not bar charts.
  - **Your signature pour.** The bottle that best represents what the user returned to. A full chiaroscuro portrait, the name in Display, a short paragraph in the SommSavvy voice.
  - **Discovery of the year.** A bottle the user had never saved before and clearly fell for — surfaced by qualitative signal in the notes ("incredible", "blew me away", repeat saves of the same producer after first encounter). "This was the one."
  - **Where you traveled.** Regions explored, rendered as a curated list with short editorial notes, not a map widget.
  - **The one that surprised you.** Best note relative to apparent price or category — derived from the qualitative read on each entry, not a numeric score.
  - **Your taste, this year.** A paragraph comparing this year's taste profile to the prior year's, or describing where the user started from as a first-year baseline.
- A "Share" option at the end generates a beautiful summary card (see Share the Glass).

## Key details

- Reports are generated for users with 10 or more entries in the calendar year. Below that threshold, the prompt reads: "Your year is still being written."
- The report generates automatically on January 1 via a cron job. Users can manually trigger a mid-year preview ("How is my year looking?") from the profile.
- Reports are stored and browsable for prior years.
- The voice in the annual report is the SommSavvy voice at its most expansive — warm, personal, occasionally self-aware about the enterprise of keeping a drinks journal.
- No gamification, no badges, no streaks. The report earns its moment through quality of writing, not mechanics.

~~~
New table: annual_reports with userId, year (integer), reportJson (structured sections), heroImageUrl, generatedAt. New method: generateAnnualReport({ userId, year }) — reads all cellar entries for the user in the given calendar year, runs a large task agent to produce structured section copy, generates 2-3 chiaroscuro images for key bottles using generateImage. A cron interface fires on January 1 for all users with qualifying entry counts. The reportJson is a typed array of sections: { type, headline, body, imageUrl?, metadata? }. The frontend renders sections as full-screen "pages" with motion/react crossfades between them. A listAnnualReports({ userId }) method returns the index for the profile page.
~~~
