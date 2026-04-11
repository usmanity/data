# Fernloop Template

This directory holds the default Fernloop application template.

## Local development

The primary local app entrypoint is:

- `http://localhost:2002`

The initial local stack includes:

- `apps/web`: Vite + React + TanStack Router
- `apps/api`: Fastify API
- `packages/config`: shared env parsing and public/server config rules
- `packages/contracts`: shared Zod API contracts
- `packages/db`: Drizzle schema, migrations, and internal user model
- local Postgres via `docker compose`

## Expected toolchain

- `mise`
- Docker Desktop or a compatible Docker runtime

## First-time setup

1. Run `mise install`.
2. Run `mise trust` if your local setup requires it.
3. Copy `.env.example` to `.env`.
4. Run `pnpm install` from the repo root.
5. Start Postgres with `pnpm db:up`.
6. Generate migrations with `pnpm db:generate`.
7. Run migrations with `pnpm db:migrate`.
8. Start the app stack with `pnpm dev`.
9. Open `http://localhost:2002`.

## Ports

- Web app: `2002`
- API: `2001`
- Postgres: `5432`

## Configuration rules

The template standard for config and secrets is:

- all environment parsing lives behind `packages/config`
- browser-visible variables must use the `VITE_` prefix
- server-only secrets must never use the `VITE_` prefix
- local development reads from the root `.env`
- committed defaults and placeholders live in `.env.example`
- every app validates its env at startup instead of reading `process.env` or `import.meta.env` ad hoc

Current ownership:

- [packages/config/src/index.ts](/Users/muhammad/github/fernloop/template/packages/config/src/index.ts): shared env helpers
- [apps/api/src/env.ts](/Users/muhammad/github/fernloop/template/apps/api/src/env.ts): server-only runtime config
- [apps/web/src/env.ts](/Users/muhammad/github/fernloop/template/apps/web/src/env.ts): public browser config

Naming rules:

- `VITE_*`: safe to expose to the browser bundle
- non-`VITE_*`: server-only, secrets or backend runtime config

Local workflow:

1. Copy `.env.example` to `.env`
2. Fill in secrets only in `.env`
3. Keep `.env.example` limited to placeholders and non-sensitive defaults
4. Restart the relevant app after env changes

Current secret-bearing variables:

- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY`

Current public variables:

- `VITE_API_BASE_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`

## Deployment baseline

The deployable template shape is:

- one Railway service for `apps/api`
- one Railway service for `apps/web`
- one Railway Postgres instance
- Cloudflare in front for DNS, CDN, and WAF

Container entrypoints:

- API Dockerfile: [apps/api/Dockerfile](/Users/muhammad/github/fernloop/template/apps/api/Dockerfile)
- Web Dockerfile: [apps/web/Dockerfile](/Users/muhammad/github/fernloop/template/apps/web/Dockerfile)

Health checks:

- API: `GET /health`
- Web: `GET /healthz`

### Railway setup

Create three Railway resources:

1. `api`
2. `web`
3. `postgres`

Recommended service config:

- `api`
- Root directory: repo root
- Dockerfile path: `apps/api/Dockerfile`
- Public domain: `api.<your-domain>`

- `web`
- Root directory: repo root
- Dockerfile path: `apps/web/Dockerfile`
- Public domain: `app.<your-domain>`

Required API variables:

- `PORT`
- `DATABASE_URL`
- `API_BASE_URL`
- `APP_ORIGIN`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY` if using offline JWT verification
- `CLERK_AUTHORIZED_PARTIES`

Required web variables:

- `VITE_API_BASE_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`

Notes:

- Railway should point the API health check to `/health`.
- Railway should point the web health check to `/healthz`.
- `VITE_*` values are build-time inputs for the web app. If they change, rebuild the web service.
- `PORT` should be set by Railway for each service. The API now honors `PORT` before local defaults.

## API contract pattern

The template standard for API contracts is:

- Zod schemas live in `packages/contracts`
- Fastify routes import those schemas directly
- `fastify-type-provider-zod` drives request validation and response serialization
- `@fastify/swagger` and `@fastify/swagger-ui` generate docs from the same route schemas

Current example routes:

- `GET /health`
- `GET /v1/meta`
- `GET /v1/greetings/:name?excited=true`
- `GET /v1/me`
- `GET /documentation`

## Database pattern

The template standard for user identity persistence is:

- the database owns an internal `users.id` UUID primary key
- Clerk user IDs are stored separately as `clerk_user_id`
- business tables should reference the internal UUID, not the Clerk ID
- `packages/db` exposes a `findOrCreateUserByClerkUserId` helper that later auth middleware can call

## Clerk setup

The template still boots without Clerk keys, but protected routes stay disabled until you add:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY` if you want offline JWT verification
- `CLERK_AUTHORIZED_PARTIES` with allowed frontend origins such as `http://localhost:2002`

## Notes

- The web app is pinned to port `2002` with `strictPort: true` so it fails fast instead of shifting ports.
- The worker is intentionally not part of the first local-development bootstrap.
- `mise.toml` pins the default toolchain for local development.
