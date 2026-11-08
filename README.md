# data-usmanity

Personal data hub served at `data.usmanity.com`. See `docs/vision.md` for the why and
`docs/architecture.md` for the design. For now the API is self-hosted on a home server and
data.usmanity.com consumes it; see `docs/self-hosting.md`.

## Layout

```
packages/hub/            one Cloudflare Worker
  cloudflare.config.ts   Worker config for the cf CLI (bindings, assets, cron)
  src/worker/            Hono API under /api/*, scheduled() for fetchers
  src/client/            Vite + React SPA, built into the Worker's static assets
  migrations/            numbered D1 SQL migrations
smoke.sh                 boots cf dev against local D1 and asserts routes
```

## Local development

Requires Node 24 (pinned in `.mise.toml`) and the `cf` CLI.

```sh
npm install
npm run migrate:local   # apply migrations to local D1 (.cloudflare/state)
npm run dev             # http://localhost:8795
npm run typecheck
npm run smoke
```

Trigger the cron handler locally while `npm run dev` is running:

```sh
curl -X POST "http://localhost:8795/cdn-cgi/local/explorer/api/local/scheduled?worker=data-usmanity" \
  -H 'content-type: application/json' -d '{"cron":"*/30 * * * *"}'
```

## API

Authenticated routes take `Authorization: Bearer <token>`. Tokens live hashed in `api_tokens`;
create one with `npm run token:create -w hub -- <name> "<scopes>"` (add `--remote` for prod).

### Summary (public)

`GET /api/summary` → `{"items":[{"id":"networth","label","unit","month","value","previous_month","change"}]}`.
Values are whole dollars rounded to thousands; it's what the data.usmanity.com homepage shows.

### Net worth (`finances:read`, `finances:write`)

Monthly snapshots in `networth_snapshots`. Amounts are integer cents (USD); `liabilities_cents`
is the amount owed as a positive number and `net_worth_cents = assets_cents - liabilities_cents`.

```
GET /api/networth?from=YYYY-MM&to=YYYY-MM   snapshots, oldest first (both bounds optional)
GET /api/networth/latest                    newest snapshot + change from the previous and first month
PUT /api/networth/YYYY-MM                   upsert a month: {"assets_cents", "liabilities_cents", "note"?, "source"?}
```

History (March 2021 onward) comes from the Overview tab of the "Road to 10" Google Sheet. The
repo is public, so the export stays in the gitignored `private/` folder:

```sh
# CSV columns as shown in the sheet: Month, Net worth, Assets, Liabilities
npm run import:networth -w hub -- ../../private/networth-road-to-10.csv            # local D1
npm run import:networth -w hub -- ../../private/networth-road-to-10.csv --remote   # prod D1
```

The import checks every row adds up (assets + liabilities = net worth), is safe to re-run, and
skips months that were since edited through `PUT` (their `source` is no longer `road-to-10`).

## Notes

- `.npmrc` sets `install-strategy=linked` so `packages/hub/node_modules` exists. `cf dev`
  looks for `@cloudflare/vite-plugin` there and fails on hoisted workspace installs.
- `cf d1 migrations apply` only accepts a database UUID. The id in `cloudflare.config.ts`
  is a local-only placeholder until the remote database is created.
- Iosevka 34.9.0 lives in `packages/hub/public/fonts/iosevka/` until fonts.usmanity.com exists.
  Regenerate with `~/ai/scripts/bin/subset-iosevka.py`.
