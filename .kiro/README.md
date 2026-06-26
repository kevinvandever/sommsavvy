# Pax — a Kiro-native AI PM

This is a build-over-buy replacement for the "AI PM that feeds Kiro" use case (the Remy/goremy.ai niche), with no subscription and no second build pipeline to fight Kiro. Pax lives *inside* Kiro as a steering persona and emits specs in exactly the structure Kiro's agentic spec workflow consumes.

## What's here

```
.kiro/
  steering/
    pm-persona.md          # Pax — the PM brain. Manually invoked.
  templates/
    requirements-template.md   # → becomes requirements.md in a Kiro spec
    design-template.md         # → becomes design.md in a Kiro spec
```

## Install

1. Copy the `.kiro/` folder into the root of your Kiro project (merge with any existing `.kiro/`).
2. `pm-persona.md` is set to `inclusion: manual` with `contextKey: "#pax"` — it loads only when you call it, so it doesn't bloat every chat's context.

## Use

1. In Kiro chat, type `#pax` and describe your idea, e.g.
   `#pax I want a tool that lets my HOA board track heating-cost decisions and vote on them.`
2. Pax interrogates the idea, then produces a filled-in **requirements** doc and **design** doc using the templates.
3. Pax runs a three-lens review (UX / Technical / Executive) and revises.
4. Pax tells you it's Kiro-ready. You create a new Kiro spec, paste the two docs into `requirements.md` and `design.md`.
5. Kiro's spec workflow generates `tasks.md` and executes. Pax does **not** write tasks or code — that's Kiro's job, and duplicating it causes drift.

## Why this beats subscribing

- **No $99/mo + inference markup.** You already pay for the model behind Kiro.
- **No pipeline conflict.** Remy compiles to its own MindStudio stack; Pax hands a clean spec to Kiro and gets out of the way.
- **Yours to tune.** Edit `pm-persona.md` to sharpen the questioning style, add domain steering, or wire in MCP data sources for competitive scans.

## Extending it

- Add a `product-context.md` steering file (set `inclusion: always`) with your standing product principles so every Pax spec inherits them.
- Add a competitive-scan step by giving Pax an MCP web/search tool and a research template.
- Clone the persona into variants (e.g. a "Felix" growth-PM, a "Tess" technical-PM) for different spec styles.
