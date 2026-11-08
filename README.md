# data-usmanity

Personal data hub served at `data.usmanity.com`. See `docs/vision.md` for the why and
`docs/architecture.md` for the design.

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

## Notes

- `.npmrc` sets `install-strategy=linked` so `packages/hub/node_modules` exists. `cf dev`
  looks for `@cloudflare/vite-plugin` there and fails on hoisted workspace installs.
- `cf d1 migrations apply` only accepts a database UUID. The id in `cloudflare.config.ts`
  is a local-only placeholder until the remote database is created.
- Iosevka 34.9.0 lives in `packages/hub/public/fonts/iosevka/` until fonts.usmanity.com exists.
  Regenerate with `~/ai/scripts/bin/subset-iosevka.py`.
