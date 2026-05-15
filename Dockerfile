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
FROM node:22-alpine AS deps
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
# BuildKit cache mount sur le pnpm store : survit aux builds Coolify même
# avec --no-cache (Coolify lance `docker build --no-cache`, ce qui invalide
# les layers mais PAS les cache mounts). Gain ~3 min sur builds successifs
# après le 1er. id=pnpm partagé pour qu'un autre service Coolify (worker
# image, etc.) puisse partager le store.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# -----------------------------------------------------------------------------
# Stage 2 : builder — compile Next 16 standalone
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
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
# Cap Node.js heap at 8 GB for the build — calibré pour Hetzner CPX42
# (16 GB RAM total, 8 cores, rescale 2026-05-14 depuis CPX32). Avant
# rescale on était à 4 GB pour éviter OOM sur 8 GB shared ; depuis CPX42
# on peut remonter sans risque. Default Node heap = ~75 % du host RAM
# ≈ 12 GB qui laisserait peu pour BuildKit ; 8 GB est un compromis sûr.
ENV NODE_OPTIONS=--max-old-space-size=8192
# Worker pool Next.js SSG : 4 sur les 8 cores du CPX42 (avant rescale
# c'était 2 sur 4 cores). Gain ~25-30 % sur SSG des 17 500 routes vs
# config CPX32. Chaque worker ~500 MB-1 GB → 4 × ~1 GB = ~4 GB peak,
# safe avec 16 GB host et heap cappé à 8 GB.
ENV NEXT_PRIVATE_WORKER_THREADS=4
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
# Generate Prisma client + build
RUN pnpm prisma:generate
# Cache mount sur .next/cache : Next 16 réutilise ses caches webpack +
# SSG entre builds si la config n'a pas changé. Combiné au cache mount
# pnpm ci-dessus, un build incrémental (pas de change de deps ni de
# config Next) tombe à ~5-8 min au lieu de ~15 min cold.
RUN --mount=type=cache,id=next,target=/app/.next/cache \
    pnpm build

# -----------------------------------------------------------------------------
# Stage 3 : runner — runtime slim avec sharp + .next/standalone
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
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

# Prisma migration runtime — schema + migrations + prisma CLI binary nécessaires
# pour que `prisma migrate deploy` tourne au démarrage container (entrypoint).
# Le standalone output exclut prisma/ par défaut, donc on copie explicitement.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Entrypoint script : prisma migrate deploy puis node server.js
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Sharp preinstalled dans builder, copié via standalone deps
USER nextjs

EXPOSE 3000

# Native Docker HEALTHCHECK — does not depend on orchestrator config.
# Pure Node so it always works regardless of which CLI tools are installed.
# start-period 120s lets Next 16 boot + warm Prisma + lazy queues without
# false negatives on first deploy of large bundles.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Entrypoint runs migrate deploy + starts Next standalone server.
ENTRYPOINT ["./docker-entrypoint.sh"]
