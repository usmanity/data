# Tasks

Phase 0 (repo setup). Plan: `~/ai/plans/active/data-usmanity.md`.

## Next: data.usmanity.com as a consumer of the abbey API (morning of 2026-11-08)

How it fits together:

```
browser → data.usmanity.com (Cloudflare Worker: React SPA + /api/*)
            └─ server-side fetch, Authorization: Bearer $HUB_TOKEN (never sent to the browser)
               → abbey.usmanity.com/data/api/* → Caddy → data-hub.service (D1 on abbey)
```

The same Worker code runs in both places. On abbey it answers from its local D1; on Cloudflare an
"edge mode" (on when `HUB_URL` is set) answers `/api/*` by forwarding an allowlist of GET routes to
abbey with the `data-site` token. It caches the responses, so the site keeps working, slightly stale,
when abbey is down. Anything edge mode forwards becomes public, so the allowlist is the privacy line.
Already in place: `cf` is logged in, `usmanity.com` is an active zone on the account, the `data-site`
token (`finances:read`) exists on abbey, and the `/data/api` route works through the tunnel.

- [ ] **Decide** what data.usmanity.com shows for net worth. Edge mode is built around this answer:
  - A: full dollar figures, public
  - B: relative only (month-over-month %, trend line with no dollar axis); the edge Worker strips `*_cents`
  - C: nothing public yet; ship the site with health/other data and keep finances behind a login (Cloudflare Access) later
- [ ] Review the `networth-endpoint` branch, then push and merge it to `main` (or ask Claude to)
- [ ] Check the `data-site` token is saved in your password manager (it only prints once; if lost, revoke it and create a new one)
- [ ] Ask Claude to build edge mode:
  - `HUB_URL` var + `HUB_TOKEN` secret; GET allowlist per the decision above, everything else 404
  - Cache API with a short fresh window (~15 min) and a stale fallback when abbey errors or times out
  - D1 binding stays for later but edge mode doesn't touch it. Deploying still needs a real D1 id in
    `cloudflare.config.ts` (create an empty one with `cf d1 create`, or make the binding optional)
  - A first net worth page in the SPA that reads `/api/networth`
- [ ] Deploy: `npx cf workers secrets update HUB_TOKEN` (paste the `data-site` token), add
  `domains: ["data.usmanity.com"]` to `cloudflare.config.ts`, `npm run deploy -w hub`
- [ ] Verify: `curl https://data.usmanity.com/api/health`, the allowed net worth route, a non-allowlisted
  route (expect 404), and the SPA in a browser. Then stop `data-hub` for a minute and confirm the site serves stale data

## Now (works offline)

- [ ] Try the local app: `npm run dev`, open http://localhost:8795, confirm "API ok · 1 migration applied"
- [ ] Review the scaffold diff, then commit it (or ask Claude to "ready to commit")
- [ ] Answer plan decisions 1-4: repo visibility, bikes stays separate, raw D1 SQL, NAS as always-on server
- [ ] Decide schema A / B / C before Phase 1
  - Context: `docs/architecture.md` (Option A/B) and the plan doc (Option C)
- [ ] Pick the next data API after music
  - Context: `~/ai/plans/active/data-usmanity-api-ideas.md`

- [ ] Net worth: decide whether `/api/networth` stays token-only or goes public (the site is meant as a public showcase; it's private for now)
- [ ] Net worth: check 2026-04 and 2026-10, which repeat the previous month's figures in the sheet, then fix them with `PUT /api/networth/:month`
- [ ] Net worth: Dec 2021 - Feb 2022 liabilities jump to ~$1.38M and drop back in March 2022 (two mortgages overlapping?); add a note with `PUT` if that's right
- [ ] Net worth: `networth_snapshots` is its own table, ahead of the schema A/B/C decision. Revisit once that's decided

- [x] Self-hosting on abbey: install the Caddy route for `/data/api/*` (done 2026-11-08; works through the tunnel)
- [ ] Self-hosting: nightly `sqlite3 .backup` of the hub database
- [ ] Self-hosting: `vite preview` doesn't fire cron triggers; add a systemd timer that POSTs to the local scheduled endpoint once fetchers exist

## When back online

- [x] Log in: `cf auth login` (logged in as of 2026-11-08)
- [ ] Create the remote database: `cf d1 create --name data-usmanity --primary-location-hint wnam`
  - Done when: the new UUID replaces the placeholder in `packages/hub/cloudflare.config.ts` and in the `migrate:local` script, then `npm run migrate:local && npm run smoke` still passes
- [ ] Apply migrations remotely: `cd packages/hub && npx cf d1 migrations apply <uuid>`
- [ ] Load net worth history remotely: `npm run import:networth -w hub -- ../../private/networth-road-to-10.csv --remote` (copy `private/` over from abbey first), then `npm run token:create -w hub -- <name> "finances:read finances:write" --remote`
- [ ] Deploy: `npm run deploy -w hub`, then `curl https://<worker>.workers.dev/api/health`
- [ ] Add the custom domain: `domains: ["data.usmanity.com"]` in `cloudflare.config.ts`, redeploy, `curl https://data.usmanity.com/api/health`
- [ ] Create the GitHub repo `usmanity/data-usmanity` and push `main`
- [ ] Move the Last.fm keys from `~/github/datahub/.env` into `packages/hub/.dev.vars` (gitignored) and `npx cf workers secrets update LASTFM_API_KEY`
- [ ] Archive `data-api` and `data-ui` on GitHub and `data` on GitLab
- [ ] Check the font headers after deploy: `curl -sI https://<worker>/fonts/iosevka/iosevka.css` shows `access-control-allow-origin: *` and `cache-control: public, max-age=31536000, immutable`

## Later

- [ ] Move Iosevka to fonts.usmanity.com once it exists
  - Context: regenerate with `~/ai/scripts/bin/subset-iosevka.py` (runbook in `~/ai/scripts/docs/`)
  - Done when: the two URLs in `packages/hub/index.html` point at fonts.usmanity.com and `packages/hub/public/fonts/` is deleted
