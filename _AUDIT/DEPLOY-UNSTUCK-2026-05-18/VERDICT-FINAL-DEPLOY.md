# VERDICT FINAL — Deploy débloqué + admin crash résolu (2026-05-18)

## TL;DR

🟢 **DÉPLOIEMENT PROD 100% RÉUSSI** sur HEAD `229a0ff` (Dockerfile fix durable).

- Pipeline GHCR + Coolify + LHCI : ✅ vert sur 2 cycles successifs (`45ad1e1` puis `229a0ff`).
- Streak de 12+ failures depuis `fea4b2e` : **terminé**.
- Admin crash post-deploy (5 migrations Prisma manquantes depuis 2026-05-16) : **résolu**.
- Cause root identifiée + fix durable appliqué : pnpm symlinks brisés au runner stage Dockerfile → fresh prisma + engines installés via npm dans `/tmp/prisma-cli` au builder stage, COPY au runner stage, entrypoint mis à jour pour priorité.
- Smoke prod final : **10/10 routes vertes**, `x-axion-build-sha = 229a0ff…` partout, `db:ok, redis:ok`.

## Cycles autopilot

| Cycle  | Commit          | Stratégie                                                 | Durée        | Résultat                  |
| ------ | --------------- | --------------------------------------------------------- | ------------ | ------------------------- |
| 1      | `87f5ff8`       | audit fixes 12 routes V1/V2                               | ~38 min      | ❌ OOM-kill               |
| 2      | rerun `87f5ff8` | gh run rerun --failed                                     | ~38 min      | ❌ OOM-kill               |
| 3      | `0bdc46f`       | disable cache-to GHA                                      | ~40 min      | ❌ OOM-kill               |
| 4      | `f193e2e`       | NODE_OPTIONS 8192→6144                                    | ~41 min      | ❌ OOM-kill               |
| **5**  | `27d6e03`       | ubuntu-latest-large + S10 monitor                         | 9 min queued | ❌ runner indispo         |
| **6**  | `45ad1e1`       | revert ubuntu-latest + D4-QW1 (réduction SSG villes)      | 24 min 5 s   | ✅ DEPLOYED               |
| **6b** | (manuel)        | admin-emergency-migrate.yml fresh prisma + migrate deploy | 1 min 28 s   | ✅ admin débloqué         |
| **7**  | `229a0ff`       | Dockerfile fix durable (fresh prisma builder→runner)      | 34 min 48 s  | ✅ DEPLOYED (fix pérenne) |

## Cause racine identifiée (double)

### Cause #1 — Build OOM-kill silencieux

**Hypothèse principale (D2/D3/D4)** : peak RAM 14.8-16.2 GB / 16 GB runner = saturation 96.9%. SSG ~9 535 routes dont 6 450 villes (3 templates × 2150) au build → peak heap Node + RSS webpack + BuildKit layer export → OOM-killer Linux SIGKILL silencieux à T+37min42s-38min10s. Pattern déterministe (variance 28 sec).

**Fix appliqué (D4-QW1)** : env var `BUILD_SSG_VILLES_INDEXABLE_ONLY=true` au build → `getIndexableVilles()` (~1 ville = Paris) au lieu de toutes (2150) sur 3 templates. Réduit 6 450 pages SSG à 3 pages. Peak RAM observé via S10 monitor : **8.2 GB / 16 GB (51%)**. Pages non-indexables servies via ISR runtime (`dynamicParams=true` + `revalidate=86400`).

Cohérent SEO : villes sans `copy.services` sont déjà `noindex` côté metadata (anti-doorway HCU 2024).

### Cause #2 — Drift DB schema invisible

pnpm content-addressed store (`.pnpm/`) crée des symlinks dans `node_modules/@prisma/`. Dockerfile copie `node_modules/@prisma` au runner stage mais pas `.pnpm/` → symlinks pointent vers du vide → `@prisma/engines` introuvable → `prisma migrate deploy` au boot fail (`Cannot find module '@prisma/engines'`) → entrypoint catch silencieusement et continue boot → DB schema désynchro mais container démarre.

**Conséquence** : depuis le recovery 2026-05-16, **5 migrations Prisma étaient en attente** (Country, ImageBank ×2, ServiceSector, RGPD IP hash). Admin dashboard crash sur queries Prisma vers tables/colonnes manquantes.

**Fix immédiat** : workflow `admin-emergency-migrate.yml` SSH Hetzner + fresh prisma install dans `/tmp/prisma-fresh` + `prisma migrate deploy` → 5 migrations appliquées → container restart → healthz OK.

**Fix durable** : Dockerfile builder stage install fresh prisma + @prisma/engines via npm dans `/tmp/prisma-cli` → COPY au runner stage `/app/prisma-cli` → entrypoint mis à jour pour priorité. Coût : +200 MB image, +30 s build. Réversible.

## Recommandations long-terme

1. **Cron daily migration status check** : nouveau workflow scheduled qui run `prisma migrate status` chaque nuit → alerte si migrations pending > 0. Empêche le drift silencieux de revenir.
2. **Wrap admin home Prisma queries** dans `Promise.allSettled` au lieu de `Promise.all` → un crash sur 1 query ne propage pas à toute la page. Degrade gracefully.
3. **Activate paid larger runners** (`ubuntu-latest-large` 32 GB) sur le compte will383842 si Will veut récupérer la SSG complète des 2 150 villes. Actuellement `BUILD_SSG_VILLES_INDEXABLE_ONLY=true` est le workaround sur runner standard.
4. **Cleanup zombies** : 2 runs queued depuis 2026-05-15 (`25906878058` + `25906810693`) jamais démarrés (même problème larger runner). À cancel manuellement.
5. **Healthcheck Prisma drift** : ajouter dans `/api/healthz` une query sur un modèle récemment ajouté (e.g. `prisma.country.count()`) pour échouer fast si schema drift.

## Smoke prod final

```
/fr                                          -> 200 (build=229a0ff16ab8)
/fr/interventions                            -> 200 (build=229a0ff16ab8)
/fr/methodologie                             -> 200 (build=229a0ff16ab8)
/fr/reserver                                 -> 200 (build=229a0ff16ab8)
/fr/stack-ia                                 -> 200 (build=229a0ff16ab8)
/fr/audit                                    -> 200 (build=229a0ff16ab8)
/api/healthz                                 -> 200 (build=229a0ff16ab8)
/sitemap-index.xml                           -> 200 (build=229a0ff16ab8)
/fr/implantations/ile-de-france/paris        -> 200 (build=229a0ff16ab8)
/fr/admin-xfz5hk0j7hrk/login                 -> 200 (build=229a0ff16ab8)
```

JSON healthz : `{"status":"ok","db":"ok","redis":"ok"}`.

## Métriques session

| Métrique                    | Valeur                                                      |
| --------------------------- | ----------------------------------------------------------- |
| Phase 0→7 durée totale      | ~3 h (06:00 → 09:00 UTC)                                    |
| Sous-agents Phase 1         | 6 parallèles (D1-D6)                                        |
| Cycles autopilot (cycle 5+) | 3 (cycle 5 cancelled, 6 success, 7 success)                 |
| Commits cette session       | 4 (+ 1 emergency workflow inclus dans Manon commit 3b02200) |
| Coût runner                 | $0 (runner standard, larger runner indispo sur compte)      |
| Peak RAM build              | 8.2 GB / 16 GB (51%) avec D4-QW1                            |
| Image size delta            | +200 MB (fresh prisma standalone)                           |
| Pipeline final              | ✅ GREEN (build 25m + Coolify 3m + LHCI 6m34s)              |
| Downtime admin              | ~1 h (07:00 → 08:00 UTC)                                    |
| Downtime public             | 0                                                           |

## Tags

- `deploy-unstuck-2026-05-18-start` → `223d1f5` (pré-fix, rollback Level 1)
- À poser : `deploy-unstuck-2026-05-18-success` → `229a0ff` (Dockerfile fix durable)

## Livrables produits

```
axionia/_AUDIT/DEPLOY-UNSTUCK-2026-05-18/
├── 00-REALITY-CHECK.md
├── 01-DIAGNOSTIC-PROFOND.md
├── 02-PLAN-ESCALATION.md
├── 03-CYCLES-LOG.md
├── 04-DEPLOY-VERIFICATION.md
├── 05-SMOKE-PROD-LIVE.md
├── 05B-ADMIN-CRASH-DIAGNOSTIC.md
├── VERDICT-FINAL-DEPLOY.md            ← ce fichier
├── EXEC-SUMMARY-WILL.md
├── MANIFEST.md
└── transcripts/
    └── CONVERSATION-2026-05-18-AUTOPILOT-DEPLOY.md
```

Code fix livré :

- `.github/workflows/deploy-coolify.yml` : S10 instrumentation memory monitor + build-args `BUILD_SSG_VILLES_INDEXABLE_ONLY=true`.
- `.github/workflows/admin-emergency-migrate.yml` : workflow utilitaire dispatchable (fresh prisma install + migrate + restart).
- `Dockerfile` : builder stage install fresh prisma + engines, runner stage COPY + entrypoint priorité `/app/prisma-cli`.
- `scripts/docker-entrypoint.sh` : sélection `PRISMA_BIN` avec fresh > pnpm-local > npx.
- `src/components/sections/VilleServicePageTemplate.tsx` : `buildStaticParams()` conditionné par env var.

Tous les commits sur origin/main, GitHub Actions logs disponibles, rollback Coolify Level 2 préparé.
