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
# `openssl` requis aussi côté deps stage car `prisma generate` peut se déclencher
# pendant `pnpm install` via postinstall hook.
RUN apk add --no-cache libc6-compat openssl
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
# Sprint recovery 2026-05-16 build #5 : cache mount pnpm retiré pour
# limiter le peak disque GH Actions (no space left on device sur runner
# ubuntu-latest même avec cleanup). Coût : +1-2 min sur builds successifs
# (pas de cache pnpm), gain : ~3-5 GB de peak BuildKit.
RUN pnpm install --frozen-lockfile --prefer-offline

# -----------------------------------------------------------------------------
# Stage 2 : builder — compile Next 16 standalone
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
# `openssl` CLI requis pour que Prisma 5.x détecte la version OpenSSL et choisisse
# le bon binaire query-engine (`linux-musl-openssl-3.0.x.so.node` au lieu du
# legacy `linux-musl.so.node` qui dépend de libssl 1.1, absente d'Alpine 3.x).
# Sans ça : `prisma:warn Prisma failed to detect libssl/openssl, Defaulting to
# "openssl-1.1.x"` puis crash au SSG (Failed to collect page data /sitemap/...).
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Build env vars publiques (clientside) — fournies via --build-arg
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV:-production}
ENV NEXT_TELEMETRY_DISABLED=1

# Bypass Zod env.ts validation au build (option F.1 recovery 2026-05-16).
# @t3-oss/env-nextjs supporte SKIP_ENV_VALIDATION=true pour permettre le build
# sans les secrets prod (AUTH_SECRET, STRIPE_*, PII_ENCRYPTION_KEY, etc.).
# Les vraies valeurs sont injectées au RUNTIME par Coolify (66 env vars de
# l'app sont [RUN] mode, donc absentes du build GH Actions). La validation
# Zod s'exécute normalement au démarrage du container (server.js boot) avec
# les vraies valeurs Coolify. Si une valeur manque → crash startup, pas un
# faux positif au build.
ARG SKIP_ENV_VALIDATION
ENV SKIP_ENV_VALIDATION=${SKIP_ENV_VALIDATION:-false}

# DATABASE_URL + REDIS_URL stubs au build (option F.1 recovery 2026-05-16).
# Prisma 5 SCHEMA validation exige que DATABASE_URL existe au build pour
# instancier `new PrismaClient()`. Sans URL → error P1012 "Environment
# variable not found: DATABASE_URL" même si on n'exécute aucune query.
# Stub vers un host invalide : init OK, queries fail à la connexion →
# catch dans sitemap.ts + knowledge-sitemap.ts → fallback gracieux
# (sitemap.xml généré sans chunks knowledge-*). DB réelle injectée par
# Coolify au runtime via env vars [RUN].
#
# Idem REDIS_URL : modules importés au SSG peuvent essayer d'instancier
# ioredis. Stub évite le ECONNREFUSED localhost:6381 inutile.
ARG DATABASE_URL
ARG REDIS_URL
ENV DATABASE_URL=${DATABASE_URL:-postgresql://stub:stub@stub.invalid:5432/stub}
ENV REDIS_URL=${REDIS_URL:-redis://stub.invalid:6379}

# BullMQ : pas de queue/worker au build. Le worker permanent tourne dans
# un container séparé sur le VPS (Dockerfile.worker). Au runtime du
# container web, BullMQ s'active normalement (env [RUN] Coolify).
ENV BULLMQ_DISABLED=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV COREPACK_INTEGRITY_KEYS=0
# Audit 2026-05-15 incident OOM swap pendant export layers Docker.
# Constat : heap 8 GB + 4 workers + Postgres + Redis + Coolify (~3-4 GB
# baseline) + BuildKit overlay2 = ~15+ GB peak demand sur 16 GB total.
# Le swap se déclenche, le build ralentit, l'export layers timeout
# à 14 min avec exit 255 (container killed par buildkit).
#
# Heap 8 GB + workers 1 (was 10/2) — 2026-05-16 v2 recovery : heap 10 GB
# a permis SSG + collect traces mais BuildKit `exporting layers` (17629
# routes Next standalone) OOM kill exit 255 silencieux. Réduction de
# pression mémoire pour donner du headroom à BuildKit qui ré-encode
# tous les layers. CPX42 16 GB : 8 heap + 2 worker + 2 pg + 0.5 redis
# + 1 system + 2 BuildKit = 15.5 GB, marge 0.5 GB. Build ~25 min vs 20.
ENV NODE_OPTIONS=--max-old-space-size=8192
ENV NEXT_PRIVATE_WORKER_THREADS=1
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
# Generate Prisma client + build
RUN pnpm prisma:generate
# BUILD_TIME injecté au build (ISO 8601 UTC) — utilisé par `next.config.ts`
# pour figer `dateModified` + sitemap `lastModified`. Avant ce patch, fallback
# `new Date().toISOString()` au runtime worker → mensonge fraîcheur à chaque
# cold start. Audit 2026-05-15 — wire défini par seo.ts + sitemap.ts existant.
ARG BUILD_TIME
ENV BUILD_TIME=${BUILD_TIME}
# Phase 8.bis bonus — runbook deploy recovery 2026-05-17 §15.3.
# BUILD_SHA = github.sha propagé via deploy-coolify.yml build-args.
# Utilisé par next.config.ts headers pour exposer `x-axion-build-sha`
# (assertion prod SHA === HEAD main au smoke 30+ routes).
ARG BUILD_SHA
ENV BUILD_SHA=${BUILD_SHA:-dev}
# Sprint recovery 2026-05-16 build #5 : cache mount .next/cache retiré
# pour limiter le peak disque GH Actions. Coût : +2-3 min sur builds
# successifs (webpack rebuild from scratch), gain : ~10-15 GB de peak
# BuildKit. Le BUILD_TIME reste injecté via ARG, BUILD_TIME stable dans
# next.config.ts pour figer lastModified sitemap/dateModified.
RUN BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}" pnpm build

# -----------------------------------------------------------------------------
# Stage 3 : runner — runtime slim avec sharp + .next/standalone
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# curl pour healthchecks orchestrator + libc6-compat + openssl REQUIS pour
# Prisma runtime. Sans openssl au runner stage, Prisma détecte "no openssl"
# au boot → cherche binary "linux-musl" alors que pnpm prisma:generate
# (builder stage avec openssl) a produit "linux-musl-openssl-3.0.x" →
# `Prisma Client could not locate the Query Engine for runtime "linux-musl"`
# → tout call DB crash 500 (admin login, sitemap, queries SSG, etc.).
# Bug confirmé sur prod 2026-05-16 sur admin POST /login. Pattern aligné
# Dockerfile.worker qui a déjà ce fix depuis audit 2026-05-15 AGENT 9.
RUN apk add --no-cache curl libc6-compat openssl

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
