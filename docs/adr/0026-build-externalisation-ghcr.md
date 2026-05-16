# ADR 0026 — Build Docker externalisé sur GitHub Actions + GHCR

- **Statut** : Accepté
- **Date** : 2026-05-16
- **Auteur** : Will + Claude (Opus 4.7), suite à incident deploy recovery 2026-05-15→16
- **Référence** : `_AUDIT/SESSION-2026-05-16-DEPLOY-RECOVERY/`, `.github/workflows/deploy-coolify.yml`, `Dockerfile.coolify-pull`, mémoire `axionia_session_2026-05-16_deploy_recovery_resolved.md`

## Contexte

Le 2026-05-15 vers 12:20 UTC, le container web Coolify est tombé après un restart, et 9 tentatives de redeploy consécutives ont échoué pendant la nuit. Diagnostic root cause :

- **Disque VPS Hetzner CPX42 (150 GB) saturé** au peak du build Docker
- Le build SSG Next 16 de 17 629 routes (services × ~2150 villes × 2 langues + standards + admin) consomme ~117 GB de disque temporaire (cache mounts BuildKit + stages intermédiaires + export layers TAR + 25 GB déjà utilisés par OS + Postgres + Redis + Coolify)
- À chaque tentative, le build crashait soit en `exporting layers`, soit en OOM-kill, soit sur "no space left on device"
- Site origine 503 pendant ~22h (frontend tenait partiellement via Cloudflare cache stale)

Options envisagées au moment du blocage :

| Option                                                              | Coût           | Effort    | Robustesse                             |
| ------------------------------------------------------------------- | -------------- | --------- | -------------------------------------- |
| **A. Rescale CPX52** (16 vCPU, 32 GB RAM, **320 GB SSD**)           | +€6,50/mois HT | 10 min    | Définitive                             |
| **B. Hetzner Volume +100 GB** monté sur `/var/lib/docker`           | +€4,40/mois HT | 30 min    | Définitive                             |
| **C. Refactor SSG → ISR** pour les pSEO villes                      | €0             | 1-2 jours | Très bonne (réduit image 10 GB → 2 GB) |
| **E. Optimisations Dockerfile** (drop cache mounts, prune agressif) | €0             | 1h        | Incertaine (peak structurel ~117 GB)   |
| **F. Build externalisé sur GitHub Actions + push GHCR**             | €0             | 2-3h      | Très bonne, pas de charge sur le VPS   |

Will a refusé A et B (réduire au max les coûts d'abonnement Hetzner). C est correct long-terme mais 1-2 jours hors de portée immédiate. E incertain. **F retenu**.

## Décision

Bascule du build Docker depuis Coolify (VPS) vers GitHub Actions (runners gratuits, ~70 GB disque dispo après cleanup, repo public = quotas Actions illimités). L'image est pushée sur GHCR (`ghcr.io/will383842/axion-ia`, publique, gratuite illimitée pour repos publics). Coolify ne fait plus que **pull** cette image au lieu de la rebuilder.

### Architecture

```
git push main
   ↓
.github/workflows/deploy-coolify.yml (job: build)
  - GH Actions ubuntu-latest, ~75 GB free après cleanup agressif
  - docker build axionia/Dockerfile (multi-stage : deps → builder → runner)
    avec ARGs : SKIP_ENV_VALIDATION=true, DATABASE_URL=stub, REDIS_URL=stub,
    BULLMQ_DISABLED=true
  - docker push ghcr.io/will383842/axion-ia:latest + :sha-XXXXXXX + :main
  - Durée : ~25 min (sans cache mounts pour limiter disque peak)
   ↓
.github/workflows/deploy-coolify.yml (job: deploy)
  - POST Coolify /api/v1/deploy
  - Coolify build axionia/Dockerfile.coolify-pull (un-liner `FROM ghcr.io/...:latest`)
  - docker pull image GHCR (~30s à 28min selon layers diff)
  - container start + entrypoint (prisma migrate deploy) + healthcheck
   ↓
.github/workflows/deploy-coolify.yml (purge step)
  - Cloudflare purge_everything
   ↓
.github/workflows/deploy-coolify.yml (job: lhci)
  - Lighthouse CI gate post-deploy (5 URLs stratégiques)
```

### Pièces ajoutées

1. **`axionia/Dockerfile.coolify-pull`** (nouveau) — Dockerfile minimaliste pour Coolify :

   ```dockerfile
   FROM ghcr.io/will383842/axion-ia:latest
   ```

   Hérite tous les ENTRYPOINT, EXPOSE, HEALTHCHECK, USER, ENV du runner stage du Dockerfile multi-stage.

2. **`axionia/.github/workflows/deploy-coolify.yml`** (refactor) — 2 jobs séquentiels + LHCI :
   - `build` : free disk space agressif (~75 GB) → buildx → docker login GHCR → metadata-action → build-push-action@v6 avec `cache-to: type=gha,mode=min`
   - `deploy` : POST Coolify API + poll status + dump logs si fail
   - `purge` : POST CF purge_everything
   - `lhci` : Lighthouse CI gate (5 URLs)
   - Input `workflow_dispatch.skip_deploy` pour bootstrap (build seul, pas de Coolify call)

3. **`axionia/Dockerfile`** (patché) — au builder stage :
   - `ARG SKIP_ENV_VALIDATION` → bypass Zod env.ts validation au build
   - `ARG DATABASE_URL` (stub default `postgresql://stub:stub@stub.invalid:5432/stub`) → init Prisma client OK, queries fail → catch
   - `ARG REDIS_URL` (stub default `redis://stub.invalid:6379`)
   - `ENV BULLMQ_DISABLED=true` au build (queue/worker n'existent qu'au runtime container séparé `Dockerfile.worker`)
   - Cache mounts BuildKit retirés (pour limiter peak disque GH Actions runner)

4. **`axionia/src/lib/prisma.ts`** (patché) — Proxy stub si `DATABASE_URL.includes("stub.invalid")` :
   - `findMany` / `findFirst` / `findUnique` / `count` / `aggregate` / `groupBy` → `[] / null / 0 / { _count: { _all: 0 } } / []`
   - `$queryRaw` / `$transaction` → no-op
   - Mutations (`create` / `update` / `delete` / `upsert`) → throw (au build aucun call ne devrait muter)

5. **`axionia/src/lib/redis.ts`** (patché) — Proxy stub si `REDIS_URL.includes("stub.invalid")` :
   - Toutes les commandes ioredis (get/set/del/hget/...) → resolve null
   - `on` / `off` / `removeListener` → return stub (chainable)
   - `quit` / `disconnect` → no-op

6. **`axionia/src/server/exporters/knowledge-rss.ts`** + **`knowledge-sitemap.ts`** (patchés) :
   - Early-exit si `DATABASE_URL.includes("stub.invalid")` → `[]` / `0`
   - Catch large : P2021 (table missing) + P1001 / P1012 (DB unreachable) + ECONNREFUSED + ENOTFOUND

## Trade-offs assumés

1. **Build time** : sans cache mounts, ~25 min vs ~10 min potentiel. Restaurable à `mode=max` + cache mounts après 5+ deploys stables.
2. **SSG des pages DB-dependent au build** : rendues vides au build (knowledge-\* sub-sitemaps, /fr/ressources entries). ISR `revalidate=3600` ou première visite réactive en runtime.
3. **Premier deploy Coolify lent** : ~28 min pour pull 5.92 GB layer principale. Builds futurs : ~30s à 2 min (que les layers diff).
4. **Image GHCR publique** : code source déjà public (repo `will383842/axion-ia` public), donc l'image compilée n'ajoute pas de surface d'attaque significative. Aucun secret baked-in (`.dockerignore` exclut `.env*`, ARGs ne sont que des stubs ou des `NEXT_PUBLIC_*`).
5. **Pattern stub magic string** : `DATABASE_URL.includes("stub.invalid")` est le trigger. Si quelqu'un change cette string sans la propager, bug silencieux au build. Documenté dans `AGENTS.md`.

## Alternatives écartées

- **A. Rescale CPX52** : refusé par Will pour ne pas augmenter l'abonnement Hetzner. Reste l'option si F devient instable.
- **B. Volume Hetzner** : économique mais ajoute complexité opérationnelle (remount sans perdre data Docker). Reportable si F insuffisant.
- **C. SSG → ISR** : meilleure solution long-terme (image 10 GB → 2 GB, builds 10× plus rapides) mais 1-2 jours de dev + risque SEO sur les pages pSEO villes. À planifier en Sprint dédié.
- **E. Dockerfile optimisations seules** : peak structurel ~117 GB, optimisations ne suffisent pas seules.

## Plan de durcissement futur

1. **Court terme (après 5+ deploys stables)** :
   - Restaurer `cache-to: type=gha,mode=max` dans le workflow
   - Restaurer `--mount=type=cache,id=pnpm` et `id=next` dans le Dockerfile builder stage
   - Cible build : ~10 min au lieu de ~25 min
2. **Moyen terme (Sprint dédié)** :
   - Refactor SSG → ISR pour les pSEO villes (option C)
   - Réduit l'image standalone à ~2 GB
3. **Long terme** :
   - Tag versions semantic + release notes auto
   - Promote `latest` seulement après LHCI gate green

## Critères de succès

- ✅ Build GH Actions reproductible (≥ 5 deploys consécutifs sans intervention)
- ✅ Site UP < 5 min après `git push main` (sur layers diff petits)
- ✅ Pas de saturation disque CPX42 jamais
- ✅ LHCI gate green post-deploy (Web Vitals budgets respectés)

## Références

- Mémoire : [`axionia_session_2026-05-16_deploy_recovery_resolved.md`](../../../.claude/projects/C--Users-willi/memory/axionia_session_2026-05-16_deploy_recovery_resolved.md)
- Mémoire historique blocage : `axionia_session_2026-05-16_deploy_recovery_blocked.md`
- Image GHCR : https://github.com/will383842/axion-ia/pkgs/container/axion-ia
- Workflow : https://github.com/will383842/axion-ia/actions/workflows/deploy-coolify.yml
