# Tasks

Phase 0 (repo setup). Plan: `~/ai/plans/active/data-usmanity.md`.

## Now (works offline)

- [ ] Try the local app: `npm run dev`, open http://localhost:8795, confirm "API ok · 1 migration applied"
- [ ] Review the scaffold diff, then commit it (or ask Claude to "ready to commit")
- [ ] Answer plan decisions 1-4: repo visibility, bikes stays separate, raw D1 SQL, NAS as always-on server
- [ ] Decide schema A / B / C before Phase 1
  - Context: `docs/architecture.md` (Option A/B) and the plan doc (Option C)
- [ ] Pick the next data API after music
  - Context: `~/ai/plans/active/data-usmanity-api-ideas.md`

## When back online

- [ ] Log in: `cf auth login`
- [ ] Create the remote database: `cf d1 create --name data-usmanity --primary-location-hint wnam`
  - Done when: the new UUID replaces the placeholder in `packages/hub/cloudflare.config.ts` and in the `migrate:local` script, then `npm run migrate:local && npm run smoke` still passes
- [ ] Apply migrations remotely: `cd packages/hub && npx cf d1 migrations apply <uuid>`
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
