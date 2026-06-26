---
name: Ask the Somm
status: planned
effort: medium
description: Follow up on any recommendation or scan with questions — go as deep as you want on the producer, the region, the vintage, or the alternatives.
---

Right now, every SommSavvy result is a finished statement. Ask the Somm opens a conversation on top of any result. "Why this vintage?" "Is there a cheaper alternative at this restaurant?" "What should I look for when I open this in five years?" The sommelier at the bar, willing to keep talking.

## What it looks like

- A persistent "Ask" pill at the bottom of any result card — Pocket Somm or Reverse Scan — below the save action.
- Tapping it opens a minimal chat sheet that pre-loads the original result as context. The user types or speaks a follow-up.
- The thread is rendered simply: user messages right-aligned in Bone, SommSavvy responses in the full editorial voice, left-aligned.
- Responses respect the user's current depth preference.
- Up to ten turns per session before the thread is considered complete.
- Any specific bottle mentioned in the conversation gets an inline "Save this" chip that triggers the standard save flow.

## Key details

- The conversation is anchored to the original result. It is not a general chatbot. Questions entirely outside the context of what was recommended or scanned get a gentle redirect: "I work best with something in front of us."
- The monocle pattern applies here too. The voice does not become a support agent.
- The thread is ephemeral — session state, not persisted to the database. When the user leaves the screen, it ends.
- If Somm Sessions is live, the thread is appended to the session record so it can be revisited.
- Responses stream token by token — the conversation feels live.

~~~
New method: askSomm({ messages: { role: 'user' | 'assistant', content: string }[], resultContext: object, userId?, depthPreference }). The resultContext is the original Pocket Somm or Reverse Scan output, passed as part of the system prompt. Uses a conversational agent with streaming enabled. The system prompt grounds the model in the original result: "You are SommSavvy, and the user is asking follow-up questions about the following result: [resultContext]. Stay anchored to this result and the world of drinks." Each call passes the full message history for multi-turn continuity. The frontend chat sheet uses use-stick-to-bottom for auto-scroll on new tokens. The inline save chip is rendered when the response contains a bottle name pattern that can be parsed into a partial CellarEntry.
~~~
