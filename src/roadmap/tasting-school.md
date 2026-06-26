---
name: Tasting School
status: planned
effort: medium
description: Short, opinionated lessons on grapes, regions, and styles — written in the SommSavvy voice, so they are actually worth reading.
---

Your depth preference handles the register in the moment. Tasting School builds the knowledge underneath it over time. Short, opinionated lessons on the things a genuine enthusiast wants to go deeper on — how to actually read a Burgundy label, why Islay scotch tastes like it does, what distinguishes a saison from a witbier and why that distinction matters. Not a certification course. A friend explaining something over a drink, and stopping when the explanation is complete.

## What it looks like

- Accessible from the cellar and the profile: "Learn something."
- Modules organized by category: Wine Regions, Grapes to Know, Beer Styles, Spirits Schools, How to Taste.
- Each module is 3-5 screens: an editorial opener with a chiaroscuro image, two or three explanation cards, and a "try this" recommendation that launches directly into Pocket Somm.
- Contextual triggers surface inline: after saving a Barolo for the first time, a quiet chip appears — "Curious about Piedmont?" — linking to the Barolo module. Dismissible. Appears once per module.
- Completed modules show a faint Verde mark in the module list.
- Progress is remembered. Completed means read once through.

## Key details

- No quizzes, no certificates, no streaks, no gamification of any kind. The lessons earn their moment through quality of writing, not mechanics.
- Contextual triggers appear at most once per module and only after a relevant cellar save. They are not notifications.
- The "try this" recommendation at the end links into Pocket Somm with a pre-filled context: "Suggest something in the style of a classic Côte de Nuits red."
- Modules are curated content — produced and reviewed by the team, not fully dynamically generated. The team writes them; the SommSavvy voice is held to a higher standard in educational content than in ephemeral recommendations.
- Initial catalog covers roughly twenty modules at launch, with expansion tied to the Regional Guides lane.
- The modules assume baseline curiosity, not baseline ignorance. The Barolo module does not explain what Italy is. It explains what the Serralunga d'Alba subzone tastes like and why it is different from La Morra.

~~~
New table: lessons with title, category, regionSlug (optional), bodyJson (array of slide objects: { headline, body, imageUrl }), recommendationSeed (optional text passed to pocketSomm for the "try this" CTA), and triggerKind (the cellar entry kind/region that surfaces the contextual prompt). New table: lesson_completions with userId, lessonId, completedAt. New methods: listLessons({ category? }) and getLesson({ id }). The contextual trigger fires in a post-save hook: after saveCellarEntry completes, check lessons whose triggerKind matches the new entry's region or kind and which the user has not completed. Return up to one trigger flag to the frontend. Images for lessons are pre-generated chiaroscuro images commissioned at content time, not generated at runtime.
~~~
