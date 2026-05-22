# 04 — Deploy verification (Phase 5)

Généré : 2026-05-18 ~08:47 UTC.
2 cycles successifs ont déployé en prod ; verification effective de chacun.

## Cycle 6 (HEAD `45ad1e1`) — D4-QW1 (réduction SSG villes)

| Item                         | Valeur                                    | Statut                                                          |
| ---------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| Run                          | `26017304206`                             | https://github.com/will383842/axion-ia/actions/runs/26017304206 |
| Build & push job             | 15 min 1 s                                | ✅ success                                                      |
| Trigger Coolify deploy job   | 3 min 8 s                                 | ✅ success                                                      |
| Lighthouse CI gate           | 5 min 49 s                                | ✅ success                                                      |
| Image pushed GHCR            | `ghcr.io/will383842/axion-ia:sha-45ad1e1` | ✅                                                              |
| Container restart            | 06:46:43 UTC                              | ✅                                                              |
| Healthcheck                  | `db:ok, redis:ok`                         | ✅                                                              |
| Build SHA header en prod     | `x-axion-build-sha: 45ad1e1066…`          | ✅ MATCH HEAD                                                   |
| Peak RAM build (S10 monitor) | 8.2 GB / 16 GB (51%)                      | ✅ vs 14.8-16.2 GB sans D4-QW1                                  |
| Coût runner                  | $0 (ubuntu-latest standard)               | ✅                                                              |

### Incident post-deploy

Crash admin sur login : 5 migrations Prisma manquantes en DB (drift depuis 2026-05-16). Cf. `05B-ADMIN-CRASH-DIAGNOSTIC.md`. Résolu via workflow `admin-emergency-migrate.yml` (fresh prisma install + migrate deploy + restart container).

## Cycle 7 (HEAD `229a0ff`) — Dockerfile fix durable

| Item                       | Valeur                                    | Statut                                                          |
| -------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| Run                        | `26021119643`                             | https://github.com/will383842/axion-ia/actions/runs/26021119643 |
| Build & push job           | 25 min 9 s                                | ✅ success                                                      |
| Trigger Coolify deploy job | 3 min 5 s                                 | ✅ success                                                      |
| Lighthouse CI gate         | 6 min 34 s                                | ✅ success                                                      |
| Image pushed GHCR          | `ghcr.io/will383842/axion-ia:sha-229a0ff` | ✅                                                              |
| Container restart          | 08:40:17 UTC                              | ✅                                                              |
| Healthcheck                | `db:ok, redis:ok`                         | ✅                                                              |
| Build SHA header en prod   | `x-axion-build-sha: 229a0ff16…`           | ✅ MATCH HEAD                                                   |
| Image size                 | +200 MB (fresh prisma + engines)          | ✅ acceptable                                                   |

### Validation fix Dockerfile

Le nouveau container devrait avoir :

- `/app/prisma-cli/node_modules/.bin/prisma` (binaire fonctionnel)
- `/app/prisma-cli/node_modules/@prisma/engines/` (engines présents, pas de symlinks pnpm brisés)
- Au prochain restart, `docker-entrypoint.sh` détecte `/app/prisma-cli/` en priorité et utilise ce binaire pour `prisma migrate deploy` → réussit au lieu de fail silent.

**Conséquence** : drift DB ne peut plus passer inaperçu. Toute nouvelle migration sera appliquée au boot automatiquement.

## Phase 5 verdict

🟢 **DEPLOY EFFECTIVE CONFIRMÉ** sur HEAD `229a0ff` (Dockerfile fix durable, image pushée GHCR, Coolify a pull + restart container + healthcheck pass + LHCI gate vert).
