# pgBackRest — PITR Postgres Axion-IA (ADR 0032)

Couche **additive** au-dessus des dumps `backup-postgres*.sh` (qui restent en place).
Objectif : **RPO < 1 h** via WAL archiving continu + restore point-in-time.

## Composants

| Fichier                                  | Rôle                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `pgbackrest.conf`                        | Config stanza `axionia`, repo R2 chiffré, rétention 4 full / 14 j diff. |
| `Dockerfile.postgres`                    | Image `postgres:16-alpine` + `pgbackrest` + `zstd`.                     |
| `docker-compose.override.pgbackrest.yml` | Active `archive_mode=on` + `archive_command` **en prod uniquement**.    |
| `../../scripts/backup-pgbackrest.sh`     | Backups full/diff + `pgbackrest check`.                                 |

## ⚠️ Garde-fous

- **N'active jamais `archive_command` en local / smoke-test** : sans repo R2 joignable, Postgres
  bloque les WAL → saturation disque (rappel incident CPX42). L'override est prod-only.
- `archive-async=y` + `pgbackrest check` (dans le cron) limitent le risque de pile-up.
- Repo pgBackRest **et** dumps logiques = defense in depth (si l'un se corrompt, l'autre reste).
- Le build app GHCR n'embarque PAS pgBackRest → contrat `stub.invalid` non impacté.

## Setup initial (VPS / Coolify — action propriétaire)

1. **R2** : créer le bucket `axion-ia-pgbackrest` + un token R2 (read/write/delete).
2. **Secrets** (env conteneur Postgres, via Coolify) :
   - `PGBACKREST_REPO1_S3_KEY`, `PGBACKREST_REPO1_S3_KEY_SECRET`
   - `PGBACKREST_REPO1_CIPHER_PASS` (générer `openssl rand -base64 48` → **coffre hors-système**)
3. Renseigner `__R2_ACCOUNT_ID__` dans `pgbackrest.conf` (endpoint R2).
4. **Build image** : `docker build -f infra/pgbackrest/Dockerfile.postgres -t axion-ia-postgres-pgbackrest:16 .`
5. **Déployer l'override** (fenêtre de redémarrage Postgres) :
   ```bash
   docker compose -f docker/docker-compose.production.yml \
                  -f infra/pgbackrest/docker-compose.override.pgbackrest.yml up -d postgres
   ```
   (ou configurer Coolify pour inclure ce fichier d'override.)
6. **Initialiser la stanza + premier full** :
   ```bash
   bash scripts/backup-pgbackrest.sh --stanza-create
   bash scripts/backup-pgbackrest.sh --type full
   ```
7. **Cron** (cf. `_AUDIT/CRON-VPS-INVENTORY.md`) :
   ```
   0 1 * * *  bash scripts/backup-pgbackrest.sh --type diff
   0 1 * * 0  bash scripts/backup-pgbackrest.sh --type full
   ```

## Restore point-in-time (runbook R33)

```bash
# Vers un PGDATA jetable (vérification / drill) :
docker exec -u postgres axion-ia-postgres-prod \
  pgbackrest --stanza=axionia --type=time \
  --target="2026-06-03 14:30:00+02" --target-action=promote \
  --pg1-path=/tmp/restore restore
```

Voir `docs/runbooks/R33-disaster-recovery-cold-start.md` pour la procédure DR complète.
