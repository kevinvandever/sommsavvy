# Deploy — Railway (backend) + Netlify (frontend)

Order matters because the two sides reference each other's URLs. Follow the
steps top to bottom; the cross-wiring at the end is expected.

## 0. Push to GitHub

Both Railway and Netlify deploy from a Git repo. From the project root:

```bash
git init
git add .
git commit -m "SommSavvy: migrated off MindStudio to self-hosted stack"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

`.env` files are gitignored, so no secrets are committed. (Confirm with
`git status` that no `.env` shows up.)

## 1. Railway — backend + database

1. Create a new Railway project from your GitHub repo.
2. In the service settings, set **Root Directory** to `server`. Railway will
   detect Node, run `npm run build` (tsc), then `npm start` (node dist/index.js).
3. Add a **PostgreSQL** database to the project (New → Database → PostgreSQL).
4. In the backend service's **Variables**, add a reference to the database's
   `DATABASE_URL` (Railway can link it automatically, or paste the value).
5. Add the remaining variables (see the list below).
6. Deploy. On boot the server runs migrations automatically, so the tables are
   created on first deploy. Watch the logs for `listening on port ...` and
   `Storage: Cloudflare R2`.
7. Copy the service's public URL (e.g. `https://sommsavvy-server.up.railway.app`).
   You'll need it for Netlify and for `PUBLIC_BASE_URL`.

### Railway environment variables

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | from the Railway Postgres service |
| `JWT_SECRET` | a long random string (see below) |
| `JWT_EXPIRES_IN` | `30d` |
| `AUTH_DEV_CODES` | `false` |
| `RESEND_API_KEY` | from your Resend account |
| `EMAIL_FROM` | `SommSavvy <onboarding@resend.dev>` |
| `ANTHROPIC_API_KEY` | your key |
| `GEMINI_API_KEY` | your key |
| `OPENAI_API_KEY` | your key |
| `R2_ACCOUNT_ID` | from `server/.env` |
| `R2_ACCESS_KEY_ID` | from `server/.env` |
| `R2_SECRET_ACCESS_KEY` | from `server/.env` |
| `R2_BUCKET` | `sommsavvy` |
| `R2_PUBLIC_BASE_URL` | `https://pub-f5ee5235596a4b8cbbd8813292aade96.r2.dev` |
| `PUBLIC_BASE_URL` | the Railway service URL (set after step 7) |
| `CORS_ORIGINS` | the Netlify URL (set in step 4 below) |

Generate `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 2. Load your data into the Railway database

Once the Railway Postgres exists, copy its **public** connection string from the
database service (the external/proxy URL). Then from `server/` locally:

```bash
DATABASE_URL="<railway-public-database-url>" npm run import -- \
  "/Volumes/Kevin SSD/kev-dev/ad1a1167-5544-4ea0-a251-eb720bc78033_1782337739007"
```

This creates your account + 14 entries in the Railway DB and (re)uploads the
images to R2. Do NOT run `npm run seed` against production — that's demo data.

## 3. Netlify — frontend

1. Create a new Netlify site from the same GitHub repo.
2. The committed `netlify.toml` already sets base = `web`, build =
   `npm run build`, publish = `web/dist`, and the SPA redirect — so you
   shouldn't need to configure build settings manually.
3. Add an environment variable: `VITE_API_BASE_URL` = your Railway service URL.
4. Deploy, then copy the Netlify site URL (e.g. `https://sommsavvy.netlify.app`).

## 4. Cross-wire and redeploy

1. Back in Railway, set `CORS_ORIGINS` to your Netlify URL and
   `PUBLIC_BASE_URL` to the Railway URL. Redeploy the backend.
2. Done. Open the Netlify URL on your phone, sign in with
   `kevin.vandever@mac.com`, and the real code will arrive by email (Resend).

## Notes

- Resend's `onboarding@resend.dev` sender only delivers to your own Resend
  account address — fine for solo testing. Verify a sending domain in Resend
  before letting others sign in.
- Before sharing the URL publicly, add rate limiting to the AI endpoints (see
  `docs/recommendations.md` §1.2) — they're unauthenticated and generate
  images, which costs money.
