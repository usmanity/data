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
- `GET /api/summary` is fetched from the hub with the token. Responses are cached for 15 minutes,
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

## Backups

Everything lives in `$HUB_STATE_DIR/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`. Back it up with
`sqlite3 <file> ".backup <dest>"` (safe while the server runs), not a plain copy of a WAL-mode file.
