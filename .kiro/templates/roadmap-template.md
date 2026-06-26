# Roadmap — [PROJECT NAME]

> The cross-feature map individual specs don't have. Maintained by Pax: persistent across sessions, updated rather than regenerated. It's a map, not a contract — it conveys direction and order, not promised dates. Read it at the start of a session to see the whole board.

**North-star:** [the one signal that says the product is working — pulled from product-context]

**Last updated:** [date] · **Currently building:** [feature or "—"]

---

## Now
*Building, or the very next thing up. Usually one item, two at most.*

### [Feature name] — `building` | `next up`
- **What:** [one line]
- **Depends on:** [what must exist first — or "nothing / done"]
- **Unblocks:** [what this opens the door to]
- **Spec:** [link/path to its Kiro spec, or "in progress" / "not yet specced"]

---

## Next
*Committed and sequenced. The order here is a dependency order, not a wish order.*

### [Feature name]
- **What:** [one line]
- **Depends on:** [feature(s) that must ship first]
- **Unblocks:** [what it enables]
- **Why it matters:** [tie to north-star or user value]

### [Feature name]
- **What:** [one line]
- **Depends on:** [...]
- **Unblocks:** [...]

---

## Later
*Intended, not yet sequenced. Directionally committed; details deliberately loose.*

- **[Feature]** — [one line]. Depends on: [...].
- **[Feature]** — [one line]. Depends on: [...].

---

## Someday / Won't
*Explicitly parked. This section is the discipline that keeps the roadmap honest — naming what you're NOT doing prevents silent scope creep. Move things here on purpose, with a reason.*

- **[Feature]** — [one line]. *Parked because:* [reason — too early, out of scope, low value, etc.]

---

## Dependency view (optional)
*When the order gets non-obvious, sketch it so buildable sequence is unambiguous. Especially useful in a migration.*

```
[foundational thing]
   └─ unblocks → [feature A]
                    └─ unblocks → [feature B]
[independent thing] → [feature C]
```
