---
name: Opening Notes
status: planned
effort: medium
description: A weekly editorial dispatch — personalized to your cellar, written in the SommSavvy voice, arriving in your inbox without asking for anything in return.
---

Every proactive intelligence feature in SommSavvy — Drinking Windows, Cellar Intelligence, Vintage Oracle — has the same quiet problem: it is only useful when the user decides to open the app. The somm cannot reach back if it has no channel to reach through. Opening Notes is the channel.

SommSavvy already holds every user's verified email address. No new permissions. No push notification ask. No friction of any kind. A cron job runs once a week, generates a personalized editorial email for each eligible user, and sends it. It reads like a column, not a notification. It arrives Sunday morning. The user did not ask for it; they are glad it came.

This is not another feature. It is the delivery mechanism for the entire proactive intelligence layer — the thing that turns intelligence people might discover into something that shows up.

Like Cellar Intelligence, Opening Notes has two halves. The journal beats ship immediately and serve every eligible user. The inventory beat activates when Drinking Windows is live.

## What it looks like

A beautifully typeset HTML email. Midnight background, Rowan headers, Bone body text, Ember accents. The brand, fully expressed, in an inbox. Structured in four beats, each short:

**Journal beats — ship with the initial launch:**

- **How your taste is shifting.** One sentence drawn from the taste profile — an observation about where the palate is going. "You have added four aged spirits in six weeks. Something is changing." Only surfaces when the profile has enough tasted entries to say something real.
- **One thing worth knowing.** A vintage note, a producer story, or a quiet gap observation. "Your tasted entries run heavily French. There is a producer in the Douro Valley worth knowing about." Keeps the voice curious and editorial without being a lesson.
- **A reason to open the app.** A single quiet call to action — never pushy, always earned by the content above it. "The Cellar Intelligence view has something to tell you." Or simply: "There are some gaps in that French-heavy collection worth looking at."

**Inventory beat — activates when Drinking Windows ships:**

- **This week in your cellar.** One owned bottle entering or approaching its drinking window. "The 2019 Domaine Tempier is ready. You have waited long enough." Before Drinking Windows ships, this beat is absent — the email launches with the three journal beats and is complete without it.

The email closes with a one-click unsubscribe.

## Key details

- Free tier. Opening Notes is the retention engine and the on-ramp to Pro intelligence features — not a Pro perk. The goal is every eligible user receiving it.
- Weekly cadence by default. A preference on the profile page — weekly, monthly, or off. No daily option.
- Eligibility guard: users with fewer than three tasted entries do not receive the dispatch. The bar is low, but the content must be personal rather than generic.
- Each user's email is generated independently. A failure on one user does not interrupt the batch.
- No tracking pixels, no open-rate optimization. The email earns its place through quality of content, not mechanics.
- The SommSavvy voice applies fully: warm, knowledgeable, faux-snobby when earned, never an exclamation point, never emoji.

~~~
New Cron interface — the first cron in the app. Weekly schedule (Sunday UTC 12:00 PM). Fires sendWeeklyDispatch().

sendWeeklyDispatch() runs with the system role. Flow:
1. Query all users WHERE dispatchPreference != 'off' AND tasted-entry count >= 3.
2. For each eligible user, call generateDispatchContent({ userId }).
3. sendEmail({ to: user.email, subject: 'Opening Notes', html: renderDispatchTemplate(content) }).
4. Per-user try/catch: failures logged, never break the batch. dispatchLastSentAt updated on success.

generateDispatchContent({ userId }):
- Journal path (always): reads cellar_entries WHERE tasted = 1 (most recent 30). Reads tasteSummary. Calls generateText to produce: { tasteShift: string | null, worthKnowing: string, appReason: string }. tasteShift is null when fewer than 5 tasted entries — omitted from template when null.
- Inventory path (conditional): when Drinking Windows is live, reads cellar_entries WHERE owned = 1 AND drinkingWindowNote IS NOT NULL. Finds entries at or approaching their window. If any found, produces cellarBeat: string. If none found or Drinking Windows not yet live, cellarBeat is omitted.
- Returns: { cellarBeat?: string, tasteShift?: string, worthKnowing: string, appReason: string }.

renderDispatchTemplate(content): HTML email with inline CSS only. Font stack: Georgia serif fallback (web fonts unreliable in email). Brand hex colors. Structure: "Opening Notes" wordmark in Ember, beats separated by hairline rules, footer with unsubscribe link.

New fields on users: dispatchPreference ('weekly' | 'monthly' | 'off', default 'weekly'), dispatchLastSentAt (number, unix ms, nullable). Profile page control: "Opening Notes — Weekly / Monthly / Off." Monthly cadence: cron runs weekly, skips users where dispatchLastSentAt is within 25 days.
~~~
