# TierMade

Rank anything, then compare your taste with your friends'.

TierMade lets you build **ranked lists** and **tier lists** of albums, songs, video games, films and TV shows. You add items by searching a real database inside the app, with no typing titles or hunting for cover art. Then you compare any two lists in the same category side by side and get a taste-match score.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **PostgreSQL** via Drizzle ORM. Locally it can run on embedded **PGlite**, so Docker isn't required.
- **Better Auth** (email + password, usernames)
- **dnd-kit** for drag and drop. **TanStack Query** for search.
- External data: **Deezer** (music, no key), **IGDB** (games), **TMDB** (films + TV)

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in BETTER_AUTH_SECRET + API keys
npm run db:migrate
npm run dev                    # http://localhost:3000
```

### API keys (all free)

| Category | Env vars | Where |
|---|---|---|
| Albums, Songs | none | Deezer public API |
| Films, TV shows | `TMDB_API_TOKEN` | themoviedb.org → Settings → API → *API Read Access Token* |
| Video games | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | dev.twitch.tv/console/apps → register an app (IGDB uses Twitch auth) |

If a key is missing, only that category's search fails, with a clear message. Everything else works.

### Database options

- `DATABASE_URL=pglite://./.data/pglite` is embedded Postgres stored on disk. It's the zero-setup default. Use one process at a time (stop `npm run dev` before running `npm run db:migrate`).
- `DATABASE_URL=postgres://tiermade:tiermade@localhost:5432/tiermade` together with `docker compose up -d` runs a real Postgres.
- On Vercel, use a Neon connection string.

Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, then run `npm run db:migrate`.

## Deploying (Vercel + Neon)

1. Import the GitHub repo at vercel.com/new. The Next.js preset is detected.
2. In the project, go to **Storage → Create → Neon** and connect it to all environments. This sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`.
3. Under **Settings → Environment Variables**, add `BETTER_AUTH_SECRET` (a new random value, not your local one), `TMDB_API_TOKEN`, `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. `BETTER_AUTH_URL` is optional; set it only if you add a custom domain.
4. Redeploy. `vercel.json` runs `npm run db:migrate` before every build, so the schema is always up to date.

Auth accepts localhost, the `BETTER_AUTH_URL` host and the URLs Vercel injects (production, branch and per-deployment), so preview deployments can sign in too.

## Scripts

| | |
|---|---|
| `npm run dev` | dev server |
| `npm test` | unit and integration tests (Vitest; the integration tests run on in-memory Postgres) |
| `npm run test:e2e` | Playwright end-to-end workflow (run `npx playwright install chromium` once first; needs network for Deezer) |
| `npm run typecheck` / `npm run lint` | |

## Architecture

```
src/
  app/            pages (server components) + api/ route handlers (the REST layer)
  services/       business rules + authorization (access.ts is the single source of truth for who can see a list)
  repositories/   all SQL lives here (Repository pattern)
  catalog/        one adapter per external API behind a common interface (Adapter pattern)
  lib/compare.ts  pure taste-match scoring
  components/     UI (list editor, tier board, search panel…)
```

- **Adding a category** means writing or reusing an adapter in `src/catalog/adapters/`, registering it in `src/catalog/registry.ts`, and adding its metadata in `src/catalog/categories.ts`. TV shows were added this way, reusing the TMDB adapter.
- **Items are shared.** Every list entry points at one canonical `items` row per (source, category, external id), so comparing two lists is a join on item id.
- **Access rules:** the owner can always see a list. Anyone else needs either a direct share (friends only) or `visibility = friends` plus an accepted friendship. Only the owner can edit. Unfriending revokes direct shares.
- **Taste match** is `30% × overlap (Jaccard) + 70% × agreement on shared items`. Agreement is a normalized Spearman footrule for ranked vs ranked, and mean tier distance for tier lists. Ranked lists get bucketed into tiers when compared with a tier list.

## Local test accounts

The local PGlite database created during development has two test accounts, `alice_test` (alice@example.test) and `bob_test` (bob@example.test), both with the password `tiermade-dev-pass`. They exist only in `.data/pglite`. Delete that folder and run `npm run db:migrate` to start fresh.

## Roadmap (stretch goals from the proposal)

- Custom categories with manual entries
- Group comparisons (3+ friends)
- Recommendations from friends' lists
- Editable tier labels and colors
