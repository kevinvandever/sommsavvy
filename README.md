# SommSavvy

A pocket sommelier for wine, beer, and spirits. Point a camera at a menu, dish,
or bottle (or speak, or type) and get warm, editorial guidance. Everything you
save lands in a personal cellar that learns your taste and sharpens the next
recommendation. Multimodal in, editorial out.

Originally built on the MindStudio/Remy platform and migrated to a
fully self-hosted stack. See [`docs/recommendations.md`](docs/recommendations.md)
for the post-migration backlog.

## The three pillars

- **Pocket Somm** — show it what you're eating or drinking with, get 3–4
  recommendations with editorial "why it works" copy and a generated portrait
  for each.
- **Reverse Scan** — show it a bottle or label, get a single editorial card:
  what it is, what to expect, pairings, and a price-vs-value read.
- **Cellar & Journal** — everything you save lives here, and it's the source of
  truth for your taste profile.

## Stack

| Concern | Choice |
| --- | --- |
| Backend | Hono (Node) — one route per method, SSE for streaming |
| Database | Postgres (a small adapter mirrors the original `db` API) |
| Auth | Email-code, JWT sessions; Resend for delivery |
| AI — text | Anthropic Claude Haiku (editorial copy, taste summaries) |
| AI — vision | Google Gemini Flash (label/scene reading) |
| AI — images | Google Gemini image model (chiaroscuro bottle portraits) |
| AI — voice | OpenAI transcription |
| Image storage | Cloudflare R2 (local disk in dev) |
| Hosting | Railway (backend), Netlify (frontend) |

## Repo structure

```
server/        Hono backend — methods, Postgres adapter, auth, AI layer, storage
  src/
    methods/     one file per method (pocketSomm, reverseScan, cellar CRUD, ...)
    db/          Postgres pool, adapter, migrations
    auth/        email-code + JWT
    ai/          provider layer (Claude / Gemini / OpenAI)
    storage/     blob storage (local disk now, R2 next) + file routes
    scripts/     seed.ts, import-mindstudio.ts
web/           React + Vite frontend (deploys to Netlify)
  src/lib/platform.ts   local shim replacing the old platform SDK
docs/          migration notes & recommendations
```

## Local development

Prerequisites: Node 20+, a local Postgres, and API keys for Anthropic, Google
(Gemini), and OpenAI.

### Backend

```bash
cd server
cp .env.example .env        # then fill in DATABASE_URL, JWT_SECRET, and AI keys
npm install
npm run migrate             # create tables
npm run dev                 # starts on http://localhost:8788
```

In dev, `AUTH_DEV_CODES=true` prints the email sign-in code to the backend
terminal instead of emailing it.

### Frontend

```bash
cd web
cp .env.example .env         # VITE_API_BASE_URL defaults to the local backend
npm install
npm run dev                  # starts on http://localhost:5173
```

Open http://localhost:5173 and sign in with any email.

## Scripts (run from `server/`)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the backend with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run migrate` | Create/update database tables |
| `npm run seed` | Load demo users (Sloane, Theo, Ines) |
| `npm run import -- <folder>` | Import a MindStudio data export |
| `npm run typecheck` | Type-check without emitting |

## Environment variables

See `server/.env.example` and `web/.env.example` for the full annotated list.
In production, secrets live in Railway and Netlify environment settings — never
commit `.env` files.
