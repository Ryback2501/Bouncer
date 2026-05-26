# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
