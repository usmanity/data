FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages/contracts ./packages/contracts

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fernloop/web build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve@14.2.6

COPY --from=build /app/apps/web/dist ./dist

ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
