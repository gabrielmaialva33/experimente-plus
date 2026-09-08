# syntax=docker/dockerfile:1
ARG NODE_VERSION=24.13.0

# The runtime never inherits the native compilation toolchain.
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /app

FROM base AS toolchain
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
# Use the headers already shipped with the exact Node image, not a nodejs.org
# download during node-gyp. Bound native jobs independently of pnpm lifecycles.
ENV npm_config_nodedir=/usr/local
ENV npm_config_jobs=2
ENV MAKEFLAGS=-j2
RUN test -f /usr/local/include/node/node.h

FROM toolchain AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
RUN --mount=type=cache,id=experimente-pnpm-node24,target=/pnpm/store,sharing=locked \
  pnpm install --frozen-lockfile --child-concurrency=1
COPY . .
# V8 heap budget for the build only; this is not a container memory limit.
RUN NODE_OPTIONS=--max-old-space-size=2048 pnpm build

# Dependency installation is keyed only by manifests, not application source.
# A source-only release reuses this layer instead of rebuilding native modules.
FROM toolchain AS production-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
RUN --mount=type=cache,id=experimente-pnpm-node24,target=/pnpm/store,sharing=locked \
  pnpm install --prod --frozen-lockfile --child-concurrency=1

FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/build ./
COPY --from=production-deps /app/node_modules ./node_modules
COPY pnpm-workspace.yaml .pnpmfile.cjs ./
EXPOSE 3333
# Migrations stay in the one-shot deploy phase; startup serves only HTTP.
CMD ["node", "bin/server.js"]
