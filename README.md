# DailyFlow

Personal time-management app: the day is a living plan (plan × reality), not a static calendar or a todo list.

| Folder | What |
|---|---|
| `web/` | The app — Next.js 16 PWA, local-first (IndexedDB) with sync to Neon Postgres |
| `review/` | Living planning doc: stages, flows, wireframes, validation (published as a Claude artifact) |
| `design/` | Design system, tokens, icon and visual reference |
| `daily-os-product-functional-spec.md` | Product & functional spec |

## Run locally

```bash
cd web
cp .env.example .env.local   # fill DATABASE_URL (Neon dev branch), ACCESS_CODE_HASH, SESSION_SECRET
npm install
npm run dev
```

- `npm test` — unit tests (Vitest)
- `npm run hash-code -- "<code>"` — hash for a new access code
- Database schema: `web/db/schema.sql`

Deploys: every push to `main` deploys to production on Vercel (root directory `web`).
