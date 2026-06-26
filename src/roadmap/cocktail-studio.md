---
name: Cocktail Studio
status: planned
effort: large
description: Show the app your spirits shelf and get two or three cocktail recipes built around what you actually have — an improviser, not a recipe database.
---

SommSavvy knows spirits. Cocktail Studio turns that knowledge into a creative home bartender who works with what is in front of them. Tell the app what is on the shelf — or photograph it — and get cocktail recipes that are genuinely tailored to the inventory: not just classics the ingredients happen to support, but builds that make good use of the specific bottles in the cabinet.

## What it looks like

- A new mode on the camera home alongside Pocket Somm and Reverse Scan: "Make something."
- The user photographs their spirits shelf, liquor cabinet, or individual bottles. Or types what they have.
- If the Home Bar inventory is set up, it pre-populates the ingredient context automatically.
- The result is two or three recipes:
  - The recipe name, in the SommSavvy editorial voice (not "Boulevardier" — "A Boulevardier. Bitter, boozy, correct.")
  - Ingredients with quantities
  - Method in plain language
  - A glassware note without being precious about it
  - A one-sentence note on what makes it worth making
- A "One thing away" filter: show recipes that require only one additional ingredient the user doesn't have.
- Recipes can be saved to a "Recipes" section in the cellar alongside bottles.

## Key details

- The voice is the same SommSavvy voice — no recipe-website cheerfulness, no "Amazing cocktail." Dry, warm, direct.
- The system shines at inventive riffs given an unusual combination of bottles. Anyone can query a recipe database. Cocktail Studio improvises.
- Seasonal awareness: the results shift naturally with the time of year — stirred and warming in winter, long and effervescent in summer.
- Non-alcoholic and low-ABV options surface naturally when the ingredient list includes those items.
- Cocktail Studio covers the full spirits range: whisky, rum, mezcal, amaro, vermouth, and anything else the user has. It does not require a "complete" bar — three bottles is enough to start.

~~~
New method: buildCocktails({ inputText?, inputPhotoUrl?, availableIngredients?: string[], userId? }). Uses a task agent with analyzeImage for photo input. When homeBarInventory is available for the user, it is passed as availableIngredients automatically. The agent is prompted as a creative home bartender working with the given inventory. Structured output: { recipes: [{ name, tagline, ingredients: [{ item, amount }], method, glassware, note, missingIngredient?: string }] }. New table: saved_recipes with userId, recipeJson, savedAt. The camera home gains a third segment in the mode toggle. The Cocktail Studio scanning moment reuses the Pocket Somm status-line pattern with cocktail-appropriate copy: "Taking inventory." → "Finding the angle." → "Mixing something."
~~~
