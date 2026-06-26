---
name: SommSavvy
description: A pocket sommelier for wine, beer, and spirits. Multimodal recommendations and bottle analysis with a personal cellar that learns your taste.
---

# SommSavvy

A pocket sommelier that actually knows you. Point your camera at a menu, a dish, or a bottle, and SommSavvy gives you smart, contextual guidance. Every drink you save, rate, or note feeds a personal taste profile that makes the next recommendation sharper. The voice is warm and confident, with a self-aware sense of humor about the seriousness of wine snobbery, set against an editorial visual world that takes the craft seriously.

## Audience

SommSavvy is built for the [engaged enthusiast]{The center of gravity for every product decision. This is the person who already cares about what is in their glass — who remembers the bottle from that dinner, who reads back labels at the wine shop, who has a 'cellar' even if it is six bottles in a kitchen rack. They open the app once or twice a week and never delete it. Every flagship moment in the product (the cellar, the taste summary, Pocket Somm, Reverse Scan, the entire roadmap) is designed to feel essential to them.}. Two adjacent audiences are welcomed but not centered:

- **The curious newcomer.** Friends of enthusiasts, people who tasted something on a trip and want to learn more. They arrive via word of mouth, not by searching the App Store. The product treats them with respect and offers a softer voice register, but it does not dilute itself for them.
- **The enthusiast performing as expert.** Sometimes our enthusiast wants the denser register — vintage talk, soil notes, producer specifics. Expert mode is for them, not for actual sommeliers. Real professionals have their own tools and their own knowledge, and they would spot the AI's confident wrongness within minutes. We are not building for them.

~~~
This audience framing is the silent tiebreaker for design and product decisions. When in doubt, ask whether the choice serves the engaged enthusiast on a Tuesday evening. The other two audiences are accommodations, not targets.
~~~


## The Three Pillars

The app has three core experiences. They share a multimodal entry surface (photo, voice, or text) and a single visual language. The brand is the same across all three. Only the content differs.

### Pocket Somm
The user shows the app something they want to drink with. A photo of a menu, a dish, or a setting. A voice description ("we are having lasagna and a salad"). A typed sentence. SommSavvy returns three or four drink recommendations across the relevant categories, each with a short editorial explanation of why it works. The recommendations respect the user's [depth preference]{One of three modes: beginner, enthusiast, expert. Set once in the profile and effectively forgotten — not surfaced in the main UI as a header pill. Default is enthusiast, the sweet spot for the audience. Beginner softens jargon and uses analogies. Expert pushes density: vintage, producer, soil, technical pairings. Same warm voice across all three. The toggle is a respect dial more than an information dial — its job is to make the user feel seen.} and, when the user is signed in, their taste profile.

### Reverse Scan

The user shows the app a bottle, a label, a shelf, or types a name. SommSavvy returns a single editorial card: what it is, what to expect, what to pair it with, whether it is worth the price, and a Tuesday-vs-special-occasion read. Same multimodal entry. Opposite direction.

### Cellar and Journal

Everything the user saves lives in a personal cellar. Cellar entries can come from a Pocket Somm result, a Reverse Scan result, or a manual add. Each entry holds the bottle's identity (name, kind, region, vintage, ABV, producer), the user's own notes, and a chiaroscuro photograph. The cellar is searchable, filterable by kind, and the source of truth for the user's evolving taste profile.

~~~
The cellar is the only persistent user artifact in the MVP. Recommendations and scan results that the user does not save are ephemeral. They live only in frontend state for the duration of the session. This is intentional to keep the data model lean. A "session history" feature for revisiting past recommendations is on the roadmap, not in the MVP.
~~~

## Users and Auth

The app supports anonymous use for Pocket Somm and Reverse Scan. A user can open the camera, take a photo, get a result, and read it without an account. The moment they want to save something to their cellar, add a note, or build a taste profile, they sign in.

Auth is [email-code only]{Email verification with a six-digit code. No SMS in the MVP. No passwords. No social sign-in. The platform handles code delivery and verification.}. After verification, the user lands back on the screen they were on, with their just-viewed result still on screen and ready to be saved.

~~~
Auth is configured in the manifest with `email-code` as the only method. The auth table is `users`. The `users` table has email (managed by platform, read-only from code) plus user-defined fields: displayName (optional, defaults to the local part of the email), depthPreference, tasteSummary, and createdAt-style timestamps that come automatically from the platform.

No roles in the MVP. Every authenticated user is the same. The system role exists by default for any platform-triggered methods, but we do not have any cron or webhook interfaces yet.
~~~

### What anonymous users can do
- Open the camera, take a photo, and get a Pocket Somm or Reverse Scan result.
- Speak or type a question and get a result.
- Read the result fully, including the monocle moments and the editorial copy.
- View the empty cellar state, which doubles as the "sign in to start saving" prompt.

~~~
Anonymous users always run at the enthusiast default. They cannot adjust depth in the main UI; the setting lives in the profile, which requires sign-in. This is intentional: the depth dial is a personalization, and personalization is a sign-in moment.
~~~

### What signed-in users can do

Everything anonymous users can do, plus:

- Save any result to the cellar.
- Rate cellar entries (one to five Ember dots).
- Add personal notes to entries.
- Filter the cellar by kind (wine, beer, spirits) and saved-vs-tasted.
- Search the cellar.
- See a derived taste profile that automatically updates as the cellar grows.
- Get recommendations that take the taste profile into account.

## Data Model

The data model is intentionally small for the MVP.

### Users

[The auth table.]{This is the table referenced by `auth.table.name = 'users'` in the manifest. The `email` column is managed by the platform and read-only from code. Other columns are fully ours. New auth-created users have email populated and everything else null until they complete onboarding.} Each user has:

- An email (managed by the platform).
- An optional displayName, defaulting to the local part of the email.
- A depthPreference: beginner, enthusiast, or expert. Defaults to enthusiast.
- A tasteSummary: a 2-3 sentence natural-language description of their preferences. Computed from their cellar. Empty for new users.
- A timestamp for when the taste summary was last regenerated.

~~~
TypeScript interface for the users table:

```ts
interface User {
  email: string;                                    // managed by platform
  displayName?: string;
  depthPreference?: 'beginner' | 'enthusiast' | 'expert';  // defaults to 'enthusiast'
  tasteSummary?: string;                            // empty for new users
  tasteSummaryUpdatedAt?: number;                   // unix ms; null until first regeneration
}
```

Use `defaults: { depthPreference: 'enthusiast' }` so a new user gets a sensible default without explicit writes. Do not include id, created_at, updated_at, or last_updated_by in the interface. The platform adds those automatically.
~~~

### Cellar Entries

Each cellar entry is one drink the user has saved or tasted. Fields:

- userId: the owner of the entry.
- kind: wine, beer, or spirits. Drives filter chips and the category glyph (coupe, stein, rocks glass).
- name: the canonical drink name, set by the AI on save or typed manually.
- producer: optional. The winery, brewery, or distillery.
- region: optional. The region or appellation, when known.
- vintage: optional. The year, when known.
- abv: optional. Alcohol by volume as a number.
- photoUrl: optional. Either the user's own scan photo, or an AI-generated chiaroscuro bottle portrait.
- source: somm, scan, or manual. Records how the entry came into the cellar.
- notes: optional. The user's personal tasting note. Plain text. [Notes carry the entire qualitative signal for an entry — there is no numeric rating field]{Removed by intent. Star/dot ratings reduce a wine to a number and contradict the brand's editorial voice (we positioned against Vivino's rating culture). Notes carry richer signal for the taste-summary regen than a 1-5 scale ever did, and they don't suffer from rating inflation. The cellar reads each bottle out in its own words, never as a score.}.
- tastedAt: optional. Unix ms timestamp for when the user actually drank it. Distinct from when they saved it.
- savedAt: required. Unix ms timestamp for when the entry was added to the cellar. Used as the default sort.
- tasted: [whether the user has experienced this drink]{Defaults true — the cellar is primarily a journal of things drunk. Drives the taste profile: only tasted entries shape it. Null on pre-migration rows is treated as true everywhere in code. Toggling this changes the taste signal, so it triggers a regen.}. The taste profile is built only from tasted entries.
- owned: [whether the user physically holds this bottle, unopened]{Defaults false. Drives inventory features (the "In the Rack" filter now, Drinking Windows and the rest of the inventory layer later). Null treated as false. Has no effect on the taste profile — you can own a bottle you have never tried — so toggling it never triggers a taste regen. The two dimensions are independent: tasted-not-owned (the restaurant pour, most of the journal), tasted-and-owned (drank one, have more), owned-not-tasted (bought it, unopened), or neither (that is the Hunt List, a separate concept).}.

~~~
TypeScript interface for cellar_entries:

```ts
interface CellarEntry {
  userId: string;
  kind: 'wine' | 'beer' | 'spirits';
  name: string;
  producer?: string;
  region?: string;
  vintage?: number;
  abv?: number;
  photoUrl?: string;
  source: 'somm' | 'scan' | 'manual';
  notes?: string;
  tastedAt?: number;        // unix ms; distinct from savedAt
  savedAt: number;          // unix ms; default sort key (most recent first)
  tasted?: boolean;         // defaults true; only tasted entries shape the taste profile
  owned?: boolean;          // defaults false; drives inventory features (In the Rack, Drinking Windows)
}
```

Table name: `cellar_entries` (snake_case). No unique constraints. Index nothing manually; SQLite handles small tables well and we expect under a few hundred entries per user in the MVP.

For all queries that filter on `userId`, use the bindings form so the predicate compiles to SQL:
```ts
CellarEntries.filter((e, $) => e.userId === $.userId, { userId: auth.userId })
// bindings: lifts closure var so filter compiles to SQL
```
~~~

## AI-Powered Methods

The app's intelligence comes from three orchestrated method flows. Each runs as a fire-and-forget background task with streaming progress updates so the UI stays responsive.

### pocketSomm

Takes a photo, voice transcript, or text input plus a depth and an optional userId. Returns three or four drink recommendations.

The flow uses a [task agent]{Use `mindstudio.runTask()` with structured output. Tools available to the agent: analyzeImage (for the user's input photo), searchGoogle (for unknown menu items, regional context), and generateImage (for the chiaroscuro bottle portraits accompanying recommendations). The model interprets the input, decides whether to look anything up, and produces structured recommendations.} that:

1. Analyzes the input (photo, voice, or text) to understand the dining or drinking context.
2. Considers the user's taste profile (when signed in) and depth preference.
3. Selects three or four drinks that fit, balanced across categories when appropriate.
4. Writes a "why this works" editorial paragraph for each, using the depth-appropriate voice. Includes a monocle aside on at most one or two recommendations across the set, never all of them.
5. Generates a chiaroscuro photograph for each recommendation in parallel.

~~~
Implementation details:

- Use `mindstudio.runTask<{ recommendations: Recommendation[]; summary: string }>()` with `claude-sonnet-4-5` or whatever the latest Claude Sonnet model is at build time. Look up the actual ID with `askMindStudioSdk` before writing the code.

- The system prompt tells the agent: "You are SommSavvy, a pocket sommelier with a warm voice and occasional dry humor. Recommend three or four drinks based on what the user shows you. Use the depth-appropriate voice (beginner, enthusiast, or expert). Include a monocle aside on at most one or two recommendations, never all of them. Never use exclamation points or emoji. Match the voice in src/interfaces/@brand/voice.md."

- Pass the user's tasteSummary and depthPreference in the input. The user's input (text or transcribed voice) goes in too. The image URL is provided to the agent so it can analyze it.

- Structured output example:
  ```ts
  {
    recommendations: [
      {
        name: 'Sancerre',
        kind: 'wine',
        producer: 'Pascal Jolivet',
        region: 'Loire Valley, France',
        vintage: 2022,
        why: 'The flint-and-citrus profile cuts the richness of the lemon butter sauce.',
        monocleAside: 'One detects, of course, the unmistakable suggestion of wet stone.',
        priceTier: '$$',
      },
    ],
    summary: 'Three pours that all earn their place at this table.',
  }
  ```

- After the task returns, generate chiaroscuro photographs for each recommendation in parallel using `executeStepBatch` with `generateImage`. The prompt template: "editorial chiaroscuro bottle portrait of {{name}}, single subject in warm raking candlelight, deep shadows, shallow depth of field, subtle film grain, dark espresso background, no glossy product photography, no bright e-commerce stock". Use a photo-realistic image model.

- The method streams progress to the frontend via `stream()`: "Reading the room", "Considering pairings", "Pouring three glasses". Total time should feel considered, around 8-15 seconds end to end.

- The method returns synchronously after the task completes. It does not persist the recommendation result. The frontend keeps it in state until the user saves an item to the cellar.

- All methods that take user input must validate that input (image URL is reachable, text is under a length limit, voice transcript exists). On invalid input, throw a clean user-facing error in the brand voice ("The image came through blurry. One more try?").
~~~

### reverseScan

Takes a photo of a bottle, label, or shelf, or a typed name, plus depth and optional userId. Returns a single editorial card.

Same task-agent shape as pocketSomm, simpler output: one drink with name, producer, region, vintage, ABV, "what to expect" in two depth-appropriate sentences, a pairings list of three to five items, a price-vs-value note, and a Tuesday-vs-special-occasion read. Plus a chiaroscuro photo.

~~~
Implementation details:

- Same model and tooling as `pocketSomm`. Single result instead of an array.

- The agent should:
  1. Read the label using analyzeImage. If the label is unclear, search the web for the producer and the bottle to confirm details.
  2. Cross-reference vintage, region, and ABV from web sources when the label provides a name.
  3. Write the editorial card content in the depth-appropriate voice.
  4. Note a price-vs-value read honestly. The voice will tell the user when something is overpriced or when a $14 bottle punches above its weight.

- Structured output example:
  ```ts
  {
    name: 'Domaine Tempier Bandol Rouge',
    kind: 'wine',
    producer: 'Domaine Tempier',
    region: 'Bandol, Provence, France',
    vintage: 2020,
    abv: 13.5,
    expect: 'A wild, savory red with serious tannic structure...',
    monocleAside: '— evocative of the garrigue at high noon, if you must know.',
    pairings: ['Lamb', 'Wild mushroom risotto', 'Aged cheese'],
    valueNote: 'Steady at $55. A serious pour for the price.',
    occasion: 'Sunday dinner with people who care.',
  }
  ```

- Pad the response time to feel considered. The "scanning" animation in the frontend expects at least 1.6 seconds. If the agent returns faster, hold the response in the method until the minimum has elapsed. Cap at 30 seconds.

- Same "Lovely choice" save flow as pocketSomm.
~~~

### saveCellarEntry

Takes a partial cellar entry. Persists it. Triggers a fire-and-forget taste-summary regeneration.

~~~
- Requires `auth.userId`. Throws 401 if anonymous.
- Validates the entry: kind is one of wine/beer/spirits, name is non-empty.
- Calls `CellarEntries.push()` with userId and savedAt = `db.now()`.
- After the push resolves, fires `regenerateTasteSummary({ userId: auth.userId })` without awaiting. The taste summary updates eventually; the user does not wait.
- Returns the new entry.
~~~

### updateCellarEntry, removeCellarEntry, listCellar, getEntry

Standard CRUD on cellar_entries. All require auth. All filter by `auth.userId` so users can only see their own entries.

~~~
- `listCellar({ kind?, search?, sort? })` - returns the user's entries. `kind` filters by category. `search` does a simple substring match on name, producer, and notes. `sort` is one of `'recent'` (savedAt desc, default) or `'tasted'` (tastedAt desc).

- `updateCellarEntry({ id, patch })` - partial update. Validates owner. Returns updated row.

- `removeCellarEntry({ id })` - hard delete. Validates owner. Triggers fire-and-forget taste regeneration since the cellar shape changed.

- `getEntry({ id })` - single entry detail.

All filters use the bindings form so userId checks compile to SQL. See the data model section above for the canonical predicate.
~~~

### regenerateTasteSummary

Background method. Takes a userId. Reads up to the most recent fifty cellar entries for that user, then considers only the tasted ones. Calls a small text generation pass to produce a 2-3 sentence taste summary. Writes it back to the user record.

~~~
- Internal method, not exposed to the frontend. Called fire-and-forget from `saveCellarEntry`, `updateCellarEntry` (only when a taste-affecting field changes — notes, tastedAt, kind, producer, or tasted; never on an owned-only change), and `removeCellarEntry`.
- Filters to tasted entries only: `entries.filter(e => e.tasted !== false)`. This includes explicit-true AND legacy-null rows, excluding only entries the user has explicitly un-marked as tasted. An owned-but-untasted bottle (bought, not yet opened) must never shape the taste profile — the user has not experienced it. The filter is done in JS rather than a SQL `tasted = 1` predicate to avoid SQLite's three-valued-logic null trap, which would silently drop legacy rows.
- Also incorporates the user's tasteSeed (their own words) as foundational context — see Taste Seeding.
- Uses `mindstudio.generateText()` with a focused prompt: "Read these cellar entries and write a 2-3 sentence taste profile. Use the SommSavvy voice: warm, knowledgeable, never snobby. No exclamation points, no emoji, no em dashes. Examples..."
- For users with fewer than 3 tasted entries and no seed, sets tasteSummary to empty and skips the AI call. The summary becomes meaningful around 5-10 entries.
- Updates the user row with the new summary and the timestamp.
~~~

### transcribeVoice

Takes an audio URL. Returns the transcript text.

~~~
- Wraps `mindstudio.transcribeAudio()`. No additional logic.
- Anonymous-callable. Frontend calls this to convert mic input before sending to pocketSomm or reverseScan.
- Streaming is not necessary here; transcription is fast enough.
~~~

## How the Taste Profile Works

This is the differentiator. The first recommendation any user gets is good but generic. The fiftieth one is sharp because it knows the user.

The taste profile is a single field on the user record: `tasteSummary`. It is a 2-3 sentence natural-language description, written in the SommSavvy voice. Examples:

> Leans toward bold reds with structure. Loves Italian. Tolerates oak in moderation. Has been exploring sherry. Would never order a chardonnay unless pushed.

> Beer-forward. Strong preference for Belgian and German styles, especially saisons and weizens. Avoids hop-bombs. Has rated three stouts highly.

> Mostly Sancerre and Sauvignon Blanc. Has dipped a toe into Chablis. Cool-climate whites are the safe bet.

The summary is regenerated automatically whenever the cellar changes (a save, an update, or a delete). The most recent fifty entries are used as input. New users with fewer than three entries get an empty summary, which the recommendation flow handles gracefully.

When `pocketSomm` or `reverseScan` runs for a signed-in user, the user's tasteSummary is passed into the task agent's input. The agent uses it as soft context. It does not override the user's actual request, but it informs the choice when there are several reasonable options.

## Anonymous-to-Saved Transition

The user is on the result screen. They tap "Save to Cellar". They are not signed in. The save sheet slides up with the brass-S monogram and the line "Let's start your cellar." The user enters their email, gets a code, enters the code. On verification, the same save call fires, the entry persists, the sheet transforms into the saved-bottle moment ("Lovely choice."), and the user is back on their result with the entry now in their cellar.

~~~
Frontend keeps the active result in client state. After auth verification, the frontend re-invokes `saveCellarEntry` with the same payload. No server-side anonymous session is needed. The client simply remembers what the user wanted to save and submits it once auth completes.
~~~

## Scenarios

The app ships with these scenarios so the user can experience every state immediately.

### empty-anonymous

A blank database. Lets the user open the app fresh, no users, no entries. Shows the camera home, the first-launch flow, and the unauthenticated path through Pocket Somm and Reverse Scan.

~~~
Empty seed function. The dev sandbox truncates all tables; this scenario does no further setup. Roles array is empty.
~~~

### enthusiast-with-cellar

A signed-in user (Sloane Marchetti) with around 18 cellar entries spanning wine, beer, and spirits. Includes notes on several, a meaningful tasteSummary, and a mix of sources (somm, scan, manual). Used to demonstrate the cellar mosaic, the taste profile, and what a healthy account looks like.

~~~
- Create a user via `Users.upsert('email', { email: 'sloane@example.com', displayName: 'Sloane', depthPreference: 'enthusiast' })`. The user already exists in scenarios that re-impersonate, so use upsert.
- Push 18 entries with realistic names, producers, regions, vintages, photo URLs (use the chiaroscuro hero images sourced from the design expert as placeholders or have the design expert source a small batch of bottle imagery before writing this scenario).
- Mix: ~10 wine, ~4 beer, ~4 spirits. Producers should be real and varied: Pascal Jolivet, Domaine Tempier, Allagash, Russian River Brewing, Westvleteren, Westland Distillery, Smith & Cross, Lustau.
- Ratings: ~12 entries rated, mix of 3-5 dots, a couple of 2s.
- Notes: ~6 entries have notes in the user's voice ("the steak wine", "Tuesday", "would buy again", "interesting but not for me").
- Set tasteSummary to a hand-written 3-sentence summary in the brand voice that matches the entries.
- savedAt should span the last 6 months, with most in the last few weeks.
- Roles array on the scenario: empty (default user).
~~~

### beginner-fresh-cellar

A newly signed-up user (Theo Park) with three entries. depthPreference is beginner. tasteSummary is empty (not enough entries yet). Used to demonstrate what a fresh signed-in account looks like and how the depth toggle changes the experience.

~~~
- Create a user with `depthPreference: 'beginner'`, displayName 'Theo', empty tasteSummary.
- Three entries with savedAt in the last week. Two wine, one beer.
- No notes yet. The user has barely started.
~~~

### expert-deep-cellar

A signed-in user (Ines Falcón) with 25+ cellar entries weighted toward fine wine. depthPreference is expert. Used to demonstrate the expert-mode voice and a populated mosaic.

~~~
- Create a user with `depthPreference: 'expert'`, displayName 'Ines', a rich tasteSummary that mentions specific grapes, regions, and producers.
- 25 entries: ~18 wine (heavy on Burgundy, Piedmont, Loire), ~3 beer (Trappist), ~4 spirits (Armagnac, Highland scotch, mezcal).
- Ratings: most rated, several 5s.
- Notes: ~10 entries, in expert language ("structured tannins, will improve", "underwhelming for the vintage", "verticals from this domain are non-negotiable").
- savedAt span: the last 12 months.
~~~

## Out of Scope for the MVP

These are deliberate exclusions, all on the roadmap:

- Cocktail recipes and home-bar planning. The plan keeps the MVP focused on recommendation, identification, and journaling.
- Pairing planner for full multi-course menus.
- Restaurant wine-list scanning that surfaces best-value picks at every price tier (a more advanced version of Pocket Somm).
- Social sharing of cellar entries as styled cards.
- Travel and regional deep-dive guides.
- Live tastings with audio narration.
- Recommendation history (the somm session list).
- Export of the cellar to PDF or CSV.
- Multi-device sync history beyond what email-code auth provides naturally.
- Push notifications.
- Native iOS or Android apps.
