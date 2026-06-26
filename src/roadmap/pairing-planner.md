---
name: Pairing Planner
status: planned
effort: medium
description: Build a full multi-course menu and get a complete drinks program for the evening — from aperitif through dessert wine, with quantities and a shopping list.
---

Pocket Somm handles one dish. Pairing Planner handles the whole dinner party. The user describes their menu — oysters to start, duck confit for the main, a cheese plate to end — and gets a complete drinks program: one or two pours per course, bottle counts for the table, an estimated budget, and a shopping list. The sommelier who shows up when you are the host.

## What it looks like

- A new entry point from the Pocket Somm home: "Plan a dinner."
- A single open text or voice input: "We are doing oysters to start, duck for the main, and a cheese plate. Six guests. Budget around $200 for the wine." No forms, no dropdowns.
- The result is a structured drinks program card:
  - Each course listed with one or two drink recommendations, the "why" note, and a suggested pour size.
  - Total bottles needed and estimated cost at the bottom.
  - A pour sequence note ("Start with the Champagne, move to the Burgundy with the duck, hold the Sauternes for the blue cheese").
- A "Shopping list" view collapses the whole program into a clean to-buy list, copyable to the clipboard.
- If the user has bottles in their cellar that fit, they are surfaced inline: "You have the Vouvray already."

## Key details

- The system always suggests the minimum number of bottles for variety without overwhelming the host. Six guests get one bottle per course, not three.
- The voice is the host's advisor, not a maître d'. It will prefer a right-priced Côtes du Rhône over an obvious expensive Burgundy if the match is better and the budget calls for it.
- Handles omnivore, vegetarian, and vegan menus naturally — no extra input required.
- A rough budget is optional but strongly improves the output. Without it, the system defaults to enthusiast tier pricing.
- Planning sessions are saved to Somm Sessions like any other interaction.

~~~
New method: planDinner({ menuText, guestCount, budget?, userId? }). Uses a task agent with the user's cellar and tasteSummary as optional context (passed if signed in). The agent is prompted as a knowledgeable dinner-party consultant. Structured output: { courses: [{ courseName, pours: [{ recommendation: Recommendation, bottlesNeeded: number }] }], totalBottles: number, estimatedCost: number, sequenceNote: string, shoppingList: string[] }. Cellar matching: before generating, call listCellar for the signed-in user and pass a summary of what they have (name, kind, vintage) to the agent so it can flag owned bottles in its output.
~~~
