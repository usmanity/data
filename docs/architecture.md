# data.usmanity.com - Architecture Design

> Personal data hub. One place for all my data - public, browsable, and mine.

## What This Is

A single website at `data.usmanity.com` that aggregates everything I track:
music, books, movies, games, bikes, code activity, health, finances, bookmarks,
and anything else I decide to add later.

It replaces and absorbs standalone microsites like `bikes.usmanity.com`.

## Implementation notes (2026-10-18)

This doc predates the repo. Where it disagrees with the code, the code and
`~/ai/plans/active/data-usmanity.md` win:

- Repo is `data-usmanity` in `~/projects`, not `datahub`.
- One package, `packages/hub`, holds both the Worker and the React app. The Cloudflare
  Vite plugin builds them together, so separate `api`/`web` packages aren't needed.
- The `cf` CLI with `cloudflare.config.ts` replaces `wrangler` and `wrangler.toml`.
- Raw D1 SQL with numbered migrations so far, matching `bikes`. Drizzle vs raw SQL is still decision 3 in the plan.

## Status

**Picked back up 2026-10-18.** Current phase: Phase 0 (decisions + repo prep).

| Decision | State |
|---|---|
| Repo strategy | ✅ Monorepo, with an API external services can talk to |
| Which repo | ⏳ Open - new repo vs unarchive `datahub` |
| Frontend | ✅ Vite + React, served from Cloudflare Workers static assets |
| Schema (Option A vs B) | ⏳ Open - weigh before Phase 1 step 2 |
| Always-running server | ⏳ Open - research cheapest option |

---

## Design Principles

1. **One schema, one database, one API** - no split-brain across repos or databases
2. **Add new data types without redesigning** - the system should be a framework for data, not a hardcoded set of tables
3. **Automated where possible, manual where needed** - Last.fm pulls itself, books get logged by hand
4. **Public showcase** - this is a personal data résumé, not a private dashboard
5. **Simple to maintain** - one person, long-term, no ops burden

---

## Recommended Stack

### Why All-Cloudflare

| Concern | Choice | Rationale |
|---|---|---|
| **API** | Cloudflare Workers | Already set up, zero cold starts, free tier = 100k req/day |
| **Database** | Cloudflare D1 (SQLite) | Free, serverless, no connection pooling headaches, 5GB free |
| **Frontend** | Vite + React on Workers Static Assets | Cloudflare's recommended path for new apps (over Pages); same Worker serves the SPA and the API |
| **Cron/Ingestion** | Workers Cron Triggers | Built-in, runs fetchers on schedule, no external scheduler needed |
| **File Storage** | Cloudflare R2 (if needed) | For images (bike photos, book covers), S3-compatible, free egress |

**Why not PostgreSQL?** The current `datahub` uses MySQL/PostgreSQL via Prisma.
For a personal project with <100k rows across all data types, D1 (SQLite) is simpler:
no server to maintain, no connection strings, no Prisma, no migrations complexity.
Drizzle ORM on D1 is lightweight and type-safe.

**Why not Vercel for the frontend?** Workers Static Assets is free, deploys from git
(Workers Builds), and lives in the same Worker as the API. No cross-origin complexity,
no separate billing, and no Pages ↔ Workers routing split.

**Why Workers Static Assets over Pages?** Cloudflare now steers new projects to
Workers, and Pages gets fewer new features. One Worker serving both the built
Vite bundle and `/api/*` means one deploy, one config, and shared bindings
(D1, R2) with no Service Binding glue. The `@cloudflare/vite-plugin` runs the
Worker inside the Vite dev server so local dev matches prod.

**Why not keep MySQL/Prisma from datahub?** Prisma adds significant cold-start
overhead on serverless, the MySQL instance needs hosting somewhere (PlanetScale
deprecated free tier), and it's a separate system to maintain. D1 is built in.

---

## Repo Strategy: Monorepo

✦ MU: Decided 2026-10-18 - monorepo going forward, with options to let external services talk to it ✦

**Decision: Consolidate into `datahub` as a monorepo.** See [External Access](#external-access) for how outside services connect.

```
datahub/
├── docs/                    # Design docs, ADRs, notes (this file)
├── packages/
│   ├── api/                 # Cloudflare Worker (Hono + Drizzle + D1)
│   │   ├── src/
│   │   │   ├── routes/      # Route handlers per data type
│   │   │   ├── db/          # Drizzle schema + migrations
│   │   │   ├── fetchers/    # Cron-triggered data pullers
│   │   │   └── index.ts     # Hono app entry
│   │   ├── wrangler.toml
│   │   └── package.json
│   ├── web/                 # Vite + React SPA (built into the Worker's static assets)
│   │   ├── src/
│   │   │   ├── pages/       # Route pages
│   │   │   ├── components/  # UI components
│   │   │   └── lib/         # API client, utilities
│   │   └── package.json
│   └── shared/              # Shared types, constants
│       ├── types.ts
│       └── package.json
├── package.json             # Workspace root
└── turbo.json               # Turborepo config (optional)
```

**Why monorepo?**
- Shared TypeScript types between API and frontend (no drift)
- Single `git push` deploys both
- One place to manage dependencies
- Easy to add a new data type end-to-end (schema → route → UI)

**What happens to the old repos?**
- `data-api` → archived, code migrated to `packages/api/`
- `data-ui` → archived, fresh build in `packages/web/`
- `datahub` → becomes the single repo

---

## Database Schema Design

### Core Philosophy: Entity + Collection Pattern

Every "thing" you track (a book, a scrobble, a bike) is an **Item** that
belongs to a **Collection**. This lets you add new data types by defining
a new collection rather than a new database table.

### Option A: Flexible Schema (Recommended)

```sql
-- Collections define data types
CREATE TABLE collections (
  id         TEXT PRIMARY KEY,  -- e.g. "music", "books", "bikes"
  name       TEXT NOT NULL,     -- Display name: "Music", "Books"
  slug       TEXT UNIQUE NOT NULL,
  icon       TEXT,              -- Emoji or icon identifier
  schema     TEXT,              -- JSON Schema defining fields for this collection
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Items are the actual data entries
CREATE TABLE items (
  id            TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id),
  title         TEXT NOT NULL,
  data          TEXT NOT NULL,   -- JSON blob conforming to collection's schema
  rating        REAL,           -- Universal: 0-10 scale (nullable)
  status        TEXT,           -- Universal: "completed", "in-progress", "dropped", "planned"
  date          TEXT,           -- Universal: when it happened/was consumed
  image_url     TEXT,           -- Cover art, photo, etc.
  source        TEXT,           -- "manual", "lastfm", "github", etc.
  external_id   TEXT,           -- ID from source system (Last.fm track ID, ISBN, etc.)
  notes         TEXT,
  is_public     INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_items_collection ON items(collection_id);
CREATE INDEX idx_items_date ON items(date);
CREATE INDEX idx_items_source ON items(source);
CREATE UNIQUE INDEX idx_items_external ON items(collection_id, source, external_id);

-- Tags for cross-cutting categorization
CREATE TABLE tags (
  id   TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE item_tags (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);
```

**Why this over one-table-per-type?**
- Adding "recipes" or "travel" later = one INSERT into `collections`, zero schema migrations
- The `data` JSON column holds type-specific fields (author for books, artist for music, etc.)
- The `schema` column on collections can store a JSON Schema for validation
- Universal fields (`rating`, `status`, `date`) live as proper columns for indexing and querying
- SQLite's JSON functions (`json_extract`) let you query into `data` when needed

**Tradeoff:** JSON columns sacrifice some type safety at the DB level. Drizzle + TypeScript
at the application layer compensate for this - you define typed interfaces per collection.

### Option B: One Table Per Type (Traditional)

Separate `books`, `music`, `movies`, `games`, `bikes` tables (what data-api currently has).

**Pros:** Cleaner SQL, better indexing on type-specific fields
**Cons:** Every new data type = new table + migration + new route file + new UI page.
For a project meant to grow organically, this gets tedious.

✦ MU: Not sure about schema yet - come back to this and weigh A vs B. (A is more flexible, B is more traditional; recommendation is A.) ✦

---

## API Design

### Framework: Hono on Cloudflare Workers

```
Base URL: https://data.usmanity.com/api

GET    /api/collections                   → List all collections
GET    /api/collections/:slug             → Get collection metadata + schema
GET    /api/collections/:slug/items       → List items (paginated, filterable)
GET    /api/collections/:slug/items/:id   → Get single item
POST   /api/collections/:slug/items       → Create item (manual entry)
PUT    /api/collections/:slug/items/:id   → Update item
DELETE /api/collections/:slug/items/:id   → Delete item

GET    /api/stats                         → Global dashboard stats
GET    /api/stats/:collection             → Per-collection stats
GET    /api/search?q=...                  → Full-text search across all items
GET    /api/activity                      → Recent activity feed (cross-collection)

GET    /api/tags                          → List all tags
GET    /api/tags/:name/items              → Items by tag
```

### Routing pattern in Hono

```typescript
// packages/api/src/index.ts
import { Hono } from 'hono';
import { collections } from './routes/collections';
import { items } from './routes/items';
import { stats } from './routes/stats';

const app = new Hono();
app.route('/api/collections', collections);
app.route('/api/stats', stats);
app.route('/api/search', search);
app.route('/api/activity', activity);

export default {
  fetch: app.fetch,
  scheduled: handleCron,  // Cron triggers for fetchers
};
```

---

## Data Ingestion: Fetchers

Each automated data source gets a **fetcher** - a function that runs on a
Cloudflare Workers Cron Trigger and upserts data into D1.

### Fetcher Registry

| Collection | Source | Method | Frequency | Priority |
|---|---|---|---|---|
| Music | Last.fm API | `user.getRecentTracks` | Every 30 min | ✅ Build first (existing code) |
| Music | Spotify API | Listening history | Daily | Later |
| Code | GitHub API | Contributions, repos | Daily | Medium |
| Books | Manual entry | UI form | On demand | Medium |
| Movies/TV | Manual entry (or TMDB API) | UI form + optional lookup | On demand | Medium |
| Games | Manual entry | UI form | On demand | Medium |
| Bikes | Manual entry | UI form | On demand | Medium (migrate from bikes.usmanity.com) |
| Health | Apple Health export / Strava | File import or API | Weekly | Later |
| Finances | Manual entry | UI form | On demand | Later |
| Bookmarks | Raindrop.io / manual | API or import | Daily | Later |

### Fetcher Architecture

```typescript
// packages/api/src/fetchers/base.ts
interface Fetcher {
  name: string;
  collectionSlug: string;
  schedule: string;  // cron expression
  fetch(env: Env): Promise<FetchResult>;
}

interface FetchResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// packages/api/src/fetchers/lastfm.ts
export const lastfmFetcher: Fetcher = {
  name: 'lastfm',
  collectionSlug: 'music',
  schedule: '*/30 * * * *',
  async fetch(env) {
    // Port existing lastfmFetcher.ts logic here
    // Use D1 instead of Prisma/MySQL
    // Upsert into items table with collection_id = 'music', source = 'lastfm'
  }
};
```

### Cron Trigger in wrangler.toml

```toml
[triggers]
crons = ["*/30 * * * *"]  # Runs every 30 minutes
```

The `scheduled` handler dispatches to the appropriate fetcher(s) based on timing.

---

## Frontend Design

### Framework Choice

✦ MU: Decided 2026-10-18 - Vite + React, whatever's better on Cloudflare infra ✦

**Decision: Vite + React SPA, deployed as Workers Static Assets.** The API is the
brain and the frontend is a display layer, so there's no need for Next.js SSR.
Vite + React is a first-class template on Workers (`npm create cloudflare@latest
-- --framework=react`), and the Cloudflare Vite plugin gives local dev with real
D1/R2 bindings.

### Page Structure

```
/                        → Dashboard (activity feed, stats, recent items)
/music                   → Music collection (scrobbles, listening stats)
/books                   → Books collection (reading list, ratings)
/movies                  → Movies collection (watchlist, ratings)
/games                   → Games collection
/bikes                   → Bikes collection (migrated from bikes.usmanity.com)
/code                    → Code/GitHub activity
/:collection             → Generic collection page (auto-generated for new types)
/:collection/:id         → Item detail page
/about                   → About / what this is
```

### Dashboard Concepts

The root page (`/`) should feel like a **personal data portrait**:

- **Activity timeline** - most recent items across all collections
- **Stats cards** - "423 scrobbles this week", "12 books this year", etc.
- **Collection grid** - visual cards linking to each collection
- **Now/Currently** - what I'm currently reading, playing, listening to

### UI Component Pattern

Since every collection renders similarly (list of items with type-specific fields),
the UI can be **schema-driven**:

```
CollectionPage
├── CollectionHeader (name, icon, description, stats)
├── FilterBar (search, sort, status filter)
├── ItemGrid / ItemList
│   └── ItemCard (title, image, rating, date, type-specific fields from data JSON)
└── Pagination
```

Adding a new collection to the UI = zero new components if the schema is well-defined.

---

## Deployment & Routing

```
data.usmanity.com  → one Cloudflare Worker
├── /api/*     → Hono app (packages/api)
├── /*         → Static assets: Vite build of packages/web (SPA fallback)
```

### How to set this up

1. `packages/web` builds with Vite into `packages/web/dist`
2. The Worker's wrangler config points `assets.directory` at that build, with
   `not_found_handling = "single-page-application"` so client routes resolve to `index.html`
3. Set `run_worker_first = ["/api/*"]` so API requests hit Hono before the asset lookup
4. Deploy with `wrangler deploy` (or Workers Builds on git push), custom domain `data.usmanity.com`

---

## External Access

Monorepo doesn't mean closed. The API is the one entry point for outside services.

| Direction | Mechanism | Examples |
|---|---|---|
| **Read (public)** | `GET /api/*` - no auth for `is_public = 1` items, CORS allowlist for browser clients | Personal site widgets, other microsites |
| **Write (push)** | `POST /api/ingest/:source` with a scoped API token (`Authorization: Bearer ...`) | iOS Shortcuts, scripts, Apple Health exporters, the always-running server |
| **Webhooks (inbound)** | `POST /api/webhooks/:source` with per-source signature check (HMAC) | GitHub, Strava, Raindrop |
| **Webhooks (outbound)** | Later - fire on new item per collection | Notify other services |

- Tokens live hashed in an `api_tokens` table (name, scopes like `music:write`, `last_used_at`, `revoked_at`)
- Every write records `source`, so it's always traceable which service added what
- Rate-limit token-authenticated routes with the Workers Rate Limiting binding

---

## Always-Running Server

✦ MU: Need to figure out if we can have an always running server somewhere that will handle all this - cheapest possible at first ✦

**Short-term decision (2026-11-08):** self-host the whole hub on the home server ("Home machine +
Cloudflare Tunnel" below), with data.usmanity.com consuming its API. See `docs/self-hosting.md`.

**Status: open, needs research.** Workers are request/cron driven - no process runs
between invocations. That already covers 30-min polling (cron) and inbound webhooks.
An always-on box is needed only for things Workers can't do well: long-running jobs,
persistent connections (e.g. a Last.fm "now playing" poll every few seconds), heavy
imports, or tools that need a real filesystem.

Candidates to price out, cheapest first:

| Option | Rough cost | Tradeoff |
|---|---|---|
| Home machine / Raspberry Pi + Cloudflare Tunnel | $0 extra | Uptime tied to home power/internet |
| Oracle Cloud Always Free (ARM VM) | $0 | Signup friction, idle instances can be reclaimed |
| Small VPS (Hetzner, DigitalOcean, etc.) | Low single-digit $/mo | Real ops burden (updates, security) - conflicts with principle 5 |
| Cloudflare Durable Objects + Alarms | Free tier / Workers Paid | Stays all-Cloudflare; "always addressable", not truly always running |
| Cloudflare Containers | Workers Paid + usage | Sleeps when idle, so not cheap if kept awake |

Whatever wins talks to the hub through the External Access write API - no direct DB access,
so the server stays swappable. *Verify current pricing before deciding - numbers above are placeholders.*

### bikes.usmanity.com migration

- Add a redirect rule: `bikes.usmanity.com/*` → `data.usmanity.com/bikes`
- Migrate bike data into the `items` table under the `bikes` collection
- Keep the redirect live indefinitely

---

## Migration Plan (High Level)

### Phase 0: Decisions + Repo Prep (current)
1. Decide: start a new repo, or unarchive `usmanity/datahub` (currently archived - read-only)
   ✦ MU: Not sure if I wanna unarchive this old repo or start a new one - needs extra planning ✦
2. If unarchiving: close the Renovate onboarding PR (#1). If new repo: leave `datahub` archived as history
3. Decide schema: Option A vs B
4. Research and pick the always-running server option
5. Commit this doc

### Phase 1: Foundation
1. Set up monorepo structure in `datahub`
2. Create D1 database and apply schema (collections + items + tags)
3. Port Hono API with the new entity/collection pattern
4. Port Last.fm fetcher to Workers cron + D1
5. Verify: API returns real scrobble data

### Phase 2: Frontend
1. Build the frontend shell (layout, navigation, collection pages)
2. Build the dashboard page
3. Build the music collection page (first real data)
4. Deploy as Workers Static Assets at `data.usmanity.com`

### Phase 3: Expand
1. Add manual entry UI for books, movies, games
2. Migrate bikes data from bikes.usmanity.com
3. Add GitHub activity fetcher
4. Add more collections as desired

### Phase 4: Polish
1. Search
2. Stats/charts
3. Tags and cross-collection features
4. Health, finances, bookmarks (lower priority)

---

## Open Questions

✦ MU: Review and decide on these before implementation begins ✦

1. **Schema approach** - Option A (flexible JSON) or Option B (table-per-type)?
   Recommendation: A. ⏳ Open - weigh before Phase 1.

2. **Frontend framework** - ✅ Decided: Vite + React on Workers Static Assets.

3. **Music granularity** - Should every Last.fm scrobble be an item (could be 100k+ rows),
   or should we aggregate into "songs I've listened to" with a listen count?
   Recommendation: Store every scrobble. D1 handles it fine, and it enables
   time-based charts ("what did I listen to in March 2024?").

4. **Image storage** - Use R2 for uploaded images (bike photos, custom book covers),
   or hotlink to external URLs (TMDB posters, Last.fm album art)?
   Recommendation: Hotlink where possible, R2 for user-uploaded images.

5. **Do you want an admin UI** for manual entry, or is a simple API + scripts enough
   to start? Recommendation: Build a minimal admin UI in Phase 2 - even a basic
   form is better than hitting the API with curl.

6. **Always-running server** - where does it live, cheapest first?
   ⏳ Open - see [Always-Running Server](#always-running-server).

---

## Reference: What Gets Archived

| Repo | Fate | Salvageable Code |
|---|---|---|
| `data-api` | Archive on GitHub | Wrangler config patterns, some route structure |
| `data-ui` | Archive on GitHub | Nothing (pure scaffold) |
| `datahub` | Becomes the mono repo | Last.fm fetcher logic, Prisma schema as reference |
