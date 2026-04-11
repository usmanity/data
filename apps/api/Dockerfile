FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY packages/config ./packages/config

RUN pnpm install --frozen-lockfile

EXPOSE 2001

CMD ["pnpm", "--filter", "@fernloop/api", "start"]
