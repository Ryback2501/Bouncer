# syntax=docker/dockerfile:1
# Single Bouncer image: Express backend serves the API and the built React SPA from the
# same origin. Build stages keep dev deps and package managers out of the final image.
#
# `npm ci` runs with a BuildKit cache mount so the npm download cache speeds up rebuilds
# without being baked into any image layer.
#
# The Node and Alpine versions are pinned together: the runner is plain Alpine with only the
# `node` binary copied in, which must be linked against the same musl/libstdc++.
ARG NODE_IMAGE=node:24-alpine3.24
ARG ALPINE_IMAGE=alpine:3.24

# ── Frontend build ────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

# ── Backend build ─────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS backend-builder
WORKDIR /app
COPY backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
RUN npx prisma generate
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

# ── Production dependencies ───────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY backend/package*.json ./
# The Prisma CLI is a devDependency but also an optional peer of @prisma/client, so the lockfile
# marks its whole tree (studio, embedded Postgres, typescript, react…) "devOptional" and
# `--omit=dev` alone keeps it. Omitting optional too drops it (~250 MB); the only other optional
# runtime package is pg-cloudflare, which Node never loads. Migrations run through the built-in
# runner (src/lib/migrate.ts), so the CLI isn't needed here.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --omit=optional \
 && test ! -d node_modules/prisma \
 # @prisma/client ships WASM query compilers for five databases (~14 MB each) plus source maps;
 # Bouncer only talks to PostgreSQL. Keep every postgresql variant, drop the rest, and fail the
 # build if a Prisma upgrade renames the files (so this never silently prunes the wrong thing).
 && RT=node_modules/@prisma/client/runtime \
 && ls $RT/query_compiler_*.postgresql.* >/dev/null \
 && find $RT -name 'query_compiler_*' ! -name '*.postgresql.*' -delete \
 && find $RT -name '*.map' -delete \
 && ! ls $RT/query_compiler_* | grep -v '\.postgresql\.'
# Reuse the client generated in the build stage instead of running `prisma generate` again.
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma
RUN node -e "require('@prisma/client'); require('@prisma/adapter-pg'); require('pg'); require('pino-pretty')"

# ── Runner ────────────────────────────────────────────────────────────────────
# Plain Alpine + the node binary: no npm, npx, corepack or yarn in the shipped image.
FROM ${ALPINE_IMAGE} AS runner
ARG NODE_IMAGE

RUN apk add --no-cache libstdc++ \
 && addgroup -g 1000 node \
 && adduser -u 1000 -G node -s /bin/sh -D node
COPY --from=prod-deps /usr/local/bin/node /usr/local/bin/node
RUN node --version

ENV NODE_ENV=production
# Built SPA assets the backend serves via express.static. Backend reads this env at boot.
ENV STATIC_DIR=/app/public

WORKDIR /app
# App files stay root-owned (read-only for the app user); the process runs unprivileged.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY backend/prisma/migrations ./prisma/migrations
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/dist ./public

USER node
EXPOSE 3000

# Applies pending migrations itself on start (MIGRATE_ON_START, default true), then serves.
CMD ["node", "dist/index.js"]
