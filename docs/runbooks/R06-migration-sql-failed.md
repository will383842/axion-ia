# R06 — Migration SQL ratée prod

- **Code** : R06
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique**
- **Impact si non traité** : schema drift entre code et DB → app crash 5xx en cascade dès qu'un code path touche un champ migré.

## Trigger

- GitHub Action `deploy-coolify.yml` log : `prisma migrate deploy` exit code ≠ 0.
- Coolify deploy fail post-prisma step.
- Sentry erreurs `column "foo" does not exist` ou `relation "Bar" does not exist`.
- Healthz 200 mais features récentes 5xx.

## Prérequis

- SSH `root@178.105.55.15`.
- DB shell `docker exec axion-ia-postgres-prod psql -U axion_ia`.
- Backup PG récent (cf. R22).

## Étapes

### 1. Identifier la migration fautive

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  SELECT migration_name, finished_at, rolled_back_at, logs
  FROM _prisma_migrations
  ORDER BY started_at DESC LIMIT 10;
"
```

État `rolled_back_at` non NULL → migration a échoué en cours.
État `finished_at` NULL → migration toujours en cours (deadlock ?).

### 2. Diagnostiquer cause

| Cause                | Vérif                                                   | Fix                              |
| -------------------- | ------------------------------------------------------- | -------------------------------- |
| Lock long-held       | `SELECT * FROM pg_stat_activity WHERE state = 'active'` | `pg_terminate_backend(<pid>)`    |
| Contrainte FK violée | logs migration                                          | Backfill data avant migration    |
| Type incompatible    | logs migration                                          | Migration intermédiaire (cast)   |
| Out of disk space    | `df -h`                                                 | Cleanup ou resize Hetzner volume |

### 3. Rollback Prisma (rare — pas de down migration)

Prisma ne génère PAS de down migrations. Si rollback nécessaire :

**Option A — Restore DB depuis backup pré-migration** :
→ Voir R22 §4. RTO ~30 min.

**Option B — Migration corrective manuelle** :

```sql
-- Annuler les changements visibles (DROP COLUMN si déjà appliqué partiellement)
DROP COLUMN IF EXISTS "Article"."newFieldThatBroke";
DELETE FROM _prisma_migrations WHERE migration_name = '<failed-migration>';
```

Puis re-deploy avec la version précédente du schema.prisma.

### 4. FTS migration (raw SQL hors Prisma)

Si la migration ratée est FTS (`prisma/migrations_fts/`) :

```bash
docker exec -T axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod \
  < axionia/prisma/migrations_fts/0002_fts_setup.sql
```

### 5. Re-tester migration en branche

Avant re-deploy main :

```bash
git checkout -b fix/migration-r06
# Corriger schema.prisma + migration SQL
pnpm prisma migrate dev --name fix_migration_r06
pnpm test
git push origin fix/migration-r06
# Smoke test sur staging (à câbler V1.5) ou local
```

### 6. Re-deploy via push main

```bash
git checkout main
git merge fix/migration-r06
git push origin main
# Coolify auto-deploy → migrate deploy
```

## Checklist pré-migration (préventif)

À chaque PR touchant `schema.prisma` :

- [ ] Migration testée localement `pnpm prisma migrate dev` OK
- [ ] Backfill data si nouveau champ NOT NULL sur table volumineuse
- [ ] Indexes ajoutés concurrently (`CREATE INDEX CONCURRENTLY`) si > 100k rows
- [ ] Pas de DROP COLUMN immédiat — soft-deprecate puis DROP en migration suivante
- [ ] Snapshot Hetzner pré-deploy (cf. `coolify-procedures.md` §7)

## Vérifications post-fix

- [ ] `_prisma_migrations` table : dernière entrée `finished_at` NOT NULL + `rolled_back_at` NULL.
- [ ] Sentry pas d'erreur Prisma colonnes manquantes dans les 10 min suivantes.
- [ ] Healthz `db: "ok"` + 1 feature récente testée OK.
- [ ] Worker logs : pas de crash Prisma.

## Rollback

⚠️ **Prisma n'a pas de down migration**. Rollback = restore DB depuis backup pré-migration.

Procédure complète : voir R22 §4.2 et `docs/ops/runbook-incident.md` §4.2.

## Escalation

| Niveau | Contact | Quand                                          |
| ------ | ------- | ---------------------------------------------- |
| L1     | Will    | toujours (P0)                                  |
| L2     | DPO     | si downtime > 4h ou données perdues → CNIL 72h |

## Liens

- Legacy `docs/ops/runbook-deploy.md` §6 (rollback Prisma)
- R22 — restore drill PG
- ADR 0021 — V1 stockage ContentGenConfig vs tables dédiées (évite migrations bloquantes)
- Mémoire `axionia_session_2026-05-14_sprint_s0bis` — migrations KB-V4
