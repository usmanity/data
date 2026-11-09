# Self-hosting the hub

Short term, the hub runs on a home server instead of Cloudflare: the same Worker code runs in
`workerd` through `vite preview`, and D1 is a local SQLite file. Nothing in the app is
self-host specific, so moving to Cloudflare later is `cf d1 create` + `cf deploy` (see TASKS.md),
then `npm run import:networth -w hub -- <csv> --remote` (or copy the rows over).

## How it runs

```sh
export HUB_STATE_DIR=~/.local/share/data-usmanity/state   # keeps prod data apart from dev/smoke
npm run migrate:local -w hub
npx -w hub vite build
PORT=8083 HUB_ALLOWED_HOSTS=abbey.usmanity.com npm run serve -w hub   # http://127.0.0.1:8083/api/health
```

`HUB_STATE_DIR` is read by `vite.config.ts` (D1 location for the server), `migrate:local`, and
`scripts/d1.mjs` (imports and `token:create`). `HUB_ALLOWED_HOSTS` lists the public hostnames the
reverse proxy forwards; without it `vite preview` answers 403 to every Host but localhost. Run those scripts with the same value to hit the
self-hosted database. On abbey all of this is a systemd user unit (`data-hub.service`) that
migrates and rebuilds on every start: `systemctl --user restart data-hub` after pulling.

## Exposure

Only `/api/*` may be reachable from outside. The preview server also serves a database explorer
under `/cdn-cgi/` and a `/__debug` page, and both are unauthenticated.

On abbey, Caddy maps `https://abbey.usmanity.com/data/api/<x>` to `http://127.0.0.1:8083/api/<x>`:

- Browsers holding the abbey key cookie can use the API (still subject to API tokens).
- Server-to-server callers send `Authorization: Bearer <token>`. Any 401/403/404 from the hub is
  turned into a bare 404, so without a valid token the URL looks like nothing is there.

## data.usmanity.com: edge mode

The public site is the same Worker deployed to Cloudflare in edge mode (`cloudflare.config.ts` with
`--mode edge`): no database, the `data.usmanity.com` custom domain, `HUB_URL` set to
`https://abbey.usmanity.com/data`, and a `HUB_TOKEN` secret. Its `/api/*` (`src/worker/edge.ts`):

- `GET /api/health` answers locally: `{"ok":true,"mode":"edge"}`.
- `GET /api/summary` is fetched from the hub with the token. Responses are cached for 1 minute (browsers revalidate every load),
  and kept for 30 days as a fallback, so the site serves stale data (`x-cache: stale`) while the
  hub is down. `x-cache` is `miss`, `fresh` or `stale`.
- Everything else is a 404. **Whatever this allowlist forwards is public**, so add routes deliberately.

`/api/summary` on the hub returns each data item rounded to thousands of dollars (net worth plus
its month-over-month change) and needs no token. The exact figures stay behind `finances:read`.

```sh
# on the home server: a token for the edge Worker (summary only)
HUB_STATE_DIR=~/.local/share/data-usmanity/state npm run token:create -w hub -- data-edge-worker "summary:read"
# deploy (from packages/hub)
npx cf workers secrets update HUB_TOKEN      # paste the token
npx cf deploy --mode edge
```

Try edge mode locally with the token in `packages/hub/.dev.vars` (`HUB_TOKEN=...`, gitignored):
`npx vite build --mode edge && npx vite preview --mode edge --port 8798`.

Give tokens only the scopes they need. Revoke one with
`UPDATE api_tokens SET revoked_at = unixepoch() WHERE name = '<name>'`.

## App databases (bikes and future projects)

Other apps can keep their data in the hub instead of their own D1. Each app gets its own database
(`appDatabases` in `cloudflare.config.ts` → a D1 binding `APP_<NAME>`, its own SQLite file on abbey),
and talks to it over HTTP:

```
POST /api/apps/<app>/query        Authorization: Bearer <token>
{ "statements": [{ "sql": "SELECT * FROM bikes WHERE id = ?", "params": [1] }] }
→ { "results": [{ "results": [rows], "meta": { "changes", "last_row_id", "duration" } }] }
```

- Statements run as one batch (a transaction). Blobs travel as `{ "$blob": "<base64>" }`.
- `<app>:write` may run anything in that app's database; `<app>:read` only single SELECTs. Nothing
  can reach the hub's own tables or another app's database.
- The app owns its schema: it keeps `migrations/` and applies them through the endpoint.
- Edge mode doesn't forward `/api/apps/*`; apps call `https://abbey.usmanity.com/data/api/apps/...`.

Bringing a new app over:

1. Add `<app>: "<fresh uuid>"` to `appDatabases`, commit, `systemctl --user restart data-hub`.
2. `npm run token:create -w hub -- <app>-worker "<app>:read <app>:write"` (with `HUB_STATE_DIR`).
3. In the app, copy `src/db/hub.ts` from the bikes repo and, when `HUB_URL` is set, use
   `hubDatabase({ url, app, token, cacheOrigin })` in place of the D1 binding.
4. Copy bikes' `scripts/migrate-hub.mjs` (and `copy-d1-to-hub.mjs` for existing data), set the
   app name, run them, then set `HUB_URL` + the `HUB_TOKEN` secret on the app and deploy.

## Backups

Everything lives in `$HUB_STATE_DIR/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`, one file for the
hub and one per app database. Back it up with
`sqlite3 <file> ".backup <dest>"` (safe while the server runs), not a plain copy of a WAL-mode file.
