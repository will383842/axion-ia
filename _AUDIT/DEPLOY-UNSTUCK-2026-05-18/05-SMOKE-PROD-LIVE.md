# 05 — Smoke prod live (Phase 6)

Généré : 2026-05-18 ~08:47 UTC.

## Smoke V1 (default flag off) — 10 URLs

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

🟢 **10/10 URLs vertes**, toutes servent `229a0ff16ab8` = HEAD ✅.

## Healthz JSON

```json
{
  "status": "ok",
  "timestamp": "2026-05-18T08:47:09.683Z",
  "version": "0.1.0",
  "db": "ok",
  "redis": "ok"
}
```

🟢 DB + Redis OK runtime.

## Admin login

`/fr/admin-xfz5hk0j7hrk/login` → 200 OK (la page de login s'affiche).

Login form fonctionnel après migrations Prisma appliquées (5 migrations manquantes du 2026-05-16 résolues via workflow `admin-emergency-migrate.yml` à 07:51 UTC).

Le Dockerfile fix (HEAD `229a0ff`) pérennise la résolution : prochain redeploy aura `/app/prisma-cli/` avec prisma fonctionnel → migrations appliquées automatiquement au boot.

## Pipeline GH Actions résumé

| Métrique       | Cycle 6 (D4-QW1) | Cycle 7 (Dockerfile fix)         |
| -------------- | ---------------- | -------------------------------- |
| Build & push   | 15 min 1 s       | 25 min 9 s (+10 min npm install) |
| Coolify deploy | 3 min 8 s        | 3 min 5 s                        |
| Lighthouse CI  | 5 min 49 s       | 6 min 34 s                       |
| Total          | 24 min 5 s       | 34 min 48 s                      |
| Conclusion     | ✅ success       | ✅ success                       |

## Verdict smoke

🟢 **100% vert. Déploiement prod confirmé LIVE sur HEAD `229a0ff`**. Image GHCR pushée, Coolify a pull, container restarté + healthcheck OK, LHCI gate verte, build SHA header en prod = HEAD, /api/healthz JSON OK, admin login page render OK.
