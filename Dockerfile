# syntax=docker/dockerfile:1
# Single Bouncer image: Express backend serves the API and the built React SPA from the
# same origin. Three build stages keep dev deps out of the runner.
#
# `npm ci` runs with a BuildKit cache mount so the npm download cache (~85 MB) speeds up
# rebuilds without being baked into any image layer.

# ── Frontend build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

# ── Backend build ─────────────────────────────────────────────────────────────
FROM node:24-alpine AS backend-builder
WORKDIR /app
COPY backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
RUN npx prisma generate
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

ENV NODE_ENV=production
# Built SPA assets the backend serves via express.static. Backend reads this env at boot.
ENV STATIC_DIR=/app/public

WORKDIR /app

COPY backend/package*.json ./
# The Prisma CLI is a devDependency but also an optional peer of @prisma/client, so the lockfile
# marks its whole tree (studio, embedded Postgres, typescript, react…) "devOptional" and
# `--omit=dev` alone keeps it. Omitting optional too drops it (~250 MB); the only other optional
# runtime package is pg-cloudflare, which Node never loads. Migrations run through the built-in
# runner (src/lib/migrate.ts), so the CLI isn't needed here.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --omit=optional \
 && test ! -d node_modules/prisma

# Reuse the client generated in the build stage instead of running `prisma generate` again.
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma
RUN node -e "require('@prisma/client'); require('@prisma/adapter-pg'); require('pg'); require('pino-pretty')"

COPY backend/prisma/migrations ./prisma/migrations
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/dist ./public

EXPOSE 3000

# Applies pending migrations itself on start (MIGRATE_ON_START, default true), then serves.
CMD ["node", "dist/index.js"]
