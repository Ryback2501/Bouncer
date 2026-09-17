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
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
# Reuse the client generated in the build stage instead of running `prisma generate` again.
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/dist ./public

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
