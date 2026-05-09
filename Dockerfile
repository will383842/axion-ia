# Dockerfile production Axion-IA — patch D2 cert 2026-05-08.
#
# Multi-stage : deps (resolved pnpm install) → builder (next build standalone)
# → runner (slim runtime). Cible image < 250 MB. Aligné ADR 0009 (Hetzner CPX32 +
# Coolify + Caddy 2 + Cloudflare Free).
#
# Pré-requis : `next.config.ts` `output: "standalone"` actif (déjà OK depuis
# commit ed674cf). Le runtime ne pull pas node_modules complet — uniquement
# les deps server-only nécessaires (`.next/standalone/node_modules` slim).
#
# Build local pour smoke test :
#   docker build -t axion-ia:latest .
#   docker run --rm -p 3000:3000 --env-file .env.production axion-ia:latest
#
# Sur Hetzner CPX32 : Coolify déploie via Nixpacks par défaut, mais ce
# Dockerfile versionné garantit reproductibilité + override possible
# (Settings → "Use Dockerfile").

# -----------------------------------------------------------------------------
# Stage 1 : deps — résoud les deps via pnpm cached layer
# -----------------------------------------------------------------------------
FROM node:20.18.0-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy lockfile + package.json pour cache Docker layer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./

# Active corepack (pnpm sans install global) + fetch deps.
# COREPACK_INTEGRITY_KEYS=0 contourne le bug de signature pnpm@10.x avec
# les clés embarquées dans Node 20.18 (corepack ne reconnaît pas la nouvelle
# clé pnpm). Voir https://github.com/nodejs/corepack/issues/612.
ENV COREPACK_INTEGRITY_KEYS=0
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
RUN pnpm install --frozen-lockfile --prefer-offline

# -----------------------------------------------------------------------------
# Stage 2 : builder — compile Next 16 standalone
# -----------------------------------------------------------------------------
FROM node:20.18.0-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Build env vars publiques (clientside) — fournies via --build-arg
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV:-production}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV COREPACK_INTEGRITY_KEYS=0
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
# Generate Prisma client + build
RUN pnpm prisma:generate
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 3 : runner — runtime slim avec sharp + .next/standalone
# -----------------------------------------------------------------------------
FROM node:20.18.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# curl for orchestrator healthchecks (Coolify falls back to wget busybox
# which is unreliable; with curl present the same path /api/healthz works
# the same way locally, in Coolify, and in CI smoke tests).
RUN apk add --no-cache curl

# User non-root pour sécurité
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy standalone output + assets statiques + public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Sharp preinstalled dans builder, copié via standalone deps
USER nextjs

EXPOSE 3000

# Native Docker HEALTHCHECK — does not depend on orchestrator config.
# Pure Node so it always works regardless of which CLI tools are installed.
# start-period 120s lets Next 16 boot + warm Prisma + lazy queues without
# false negatives on first deploy of large bundles.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# server.js exposé par Next 16 standalone
CMD ["node", "server.js"]
