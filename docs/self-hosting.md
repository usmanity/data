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
PORT=8083 npm run serve -w hub                           # http://127.0.0.1:8083/api/health
```

`HUB_STATE_DIR` is read by `vite.config.ts` (D1 location for the server), `migrate:local`, and
`scripts/d1.mjs` (imports and `token:create`). Run those scripts with the same value to hit the
self-hosted database. On abbey all of this is a systemd user unit (`data-hub.service`) that
migrates and rebuilds on every start: `systemctl --user restart data-hub` after pulling.

## Exposure

Only `/api/*` may be reachable from outside. The preview server also serves a database explorer
under `/cdn-cgi/` and a `/__debug` page, and both are unauthenticated.

On abbey, Caddy maps `https://abbey.usmanity.com/data/api/<x>` to `http://127.0.0.1:8083/api/<x>`:

- Browsers holding the abbey key cookie can use the API (still subject to API tokens).
- Server-to-server callers send `Authorization: Bearer <token>`. Any 401/403/404 from the hub is
  turned into a bare 404, so without a valid token the URL looks like nothing is there.

## data.usmanity.com as a consumer

The public site's Worker calls the self-hosted API with a token stored as a Worker secret:

```sh
# on the home server
HUB_STATE_DIR=~/.local/share/data-usmanity/state npm run token:create -w hub -- data-site finances:read
# on Cloudflare (once logged in)
npx cf workers secrets update HUB_TOKEN
```

```ts
const res = await fetch("https://abbey.usmanity.com/data/api/networth", {
	headers: { authorization: `Bearer ${env.HUB_TOKEN}` },
});
```

Give the site token only the read scopes it needs. Revoke a token with
`UPDATE api_tokens SET revoked_at = unixepoch() WHERE name = '<name>'`.

## Backups

Everything lives in `$HUB_STATE_DIR/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`. Back it up with
`sqlite3 <file> ".backup <dest>"` (safe while the server runs), not a plain copy of a WAL-mode file.
