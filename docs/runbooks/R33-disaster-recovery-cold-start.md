# R33 — Disaster Recovery : cold-start « VPS perdu → plateforme remontée »

- **Statut** : v1 (2026-06-03) — ADR 0032
- **Périmètre** : reconstruction complète après perte totale du VPS Hetzner (incendie DC,
  compromission compte, corruption irrécupérable). Pour une simple panne région, voir **R31**.
  Pour un drill de restauration Postgres seul, voir **R22**.

## Objectifs (à valider/mesurer au premier drill complet)

| Métrique                          | Cible                                             | Réalité (à mesurer) |
| --------------------------------- | ------------------------------------------------- | ------------------- |
| **RPO** Postgres                  | ≤ 1 h (PITR WAL, ADR 0032) — fallback dump ≤ 24 h | —                   |
| **RPO** fichiers/Docuseal/secrets | ≤ 24 h                                            | —                   |
| **RTO** plateforme complète       | ≤ X h (à chiffrer)                                | —                   |

## ⚠️ Prérequis HORS système (sans eux, restauration impossible)

Ces éléments NE sont PAS sur le VPS. Vérifier qu'ils sont accessibles **avant** un incident :

1. **`BACKUP_ENCRYPTION_PASSPHRASE`** (déchiffre dumps PG/Redis/Docuseal/images) — coffre 1Password + papier.
2. **`SOPS_AGE_KEY`** (clé privée age, déchiffre l'archive secrets) — coffre 1Password + papier.
3. **`PGBACKREST_REPO1_CIPHER_PASS`** (déchiffre le repo pgBackRest) — coffre.
4. Accès **R2** (Cloudflare) : où vivent les backups off-provider.
5. Accès **GitHub** (code) ou le **miroir Git off-site** (`REMOTE_GIT_OFFSITE`).
6. Accès **Cloudflare** (DNS) pour basculer le domaine.

## Procédure (ordre des dépendances)

### Étape 0 — Provisionner un nouvel hôte

1. Nouveau VPS (Hetzner ou autre provider). Installer Docker + Docker Compose + `aws-cli`, `age`, `openssl`, `pgbackrest`.
2. `git clone https://github.com/will383842/axion-ia.git` (ou depuis `REMOTE_GIT_OFFSITE` si GitHub indisponible).

### Étape 1 — Restaurer les secrets (débloque tout le reste)

3. Récupérer la dernière archive secrets depuis R2 immuable :
   ```bash
   aws --endpoint-url "$R2_ENDPOINT" s3 ls s3://axion-ia-backups-immutable/secrets/ | sort | tail -1
   aws --endpoint-url "$R2_ENDPOINT" s3 cp s3://axion-ia-backups-immutable/secrets/<archive>.tar.age .
   age -d -i <SOPS_AGE_KEY_FILE> <archive>.tar.age | tar -x
   ```
4. Reconstituer `.env.production` à partir de `coolify-envs.json` + `.secrets/` (creds Google, etc.).
   Re-set ces env vars dans Coolify (ou docker-compose `.env`).

### Étape 2 — Restaurer Postgres

> ⚠️ **Prérequis extensions** : le dump contient des colonnes `vector` (table `KnowledgeEmbedding`,
> pgvector) + `citext`/`pg_trgm`/`unaccent`/`uuid-ossp`. Le Postgres cible DOIT avoir **pgvector**
> installé (image `pgvector/pgvector:pg16`, pas `postgres:16-alpine`), sinon `pg_restore` échoue à
> créer les tables extension-dépendantes (`relation … does not exist`). Le drill CI mensuel le vérifie.

**Option A — PITR (RPO < 1h, recommandé)** : 5. Configurer pgBackRest (`infra/pgbackrest/pgbackrest.conf` + creds R2 + cipher pass).

```bash
pgbackrest --stanza=axionia --type=time --target="<dernier instant sain>" \
  --target-action=promote --pg1-path=/var/lib/postgresql/data restore
```

**Option B — dump (fallback)** :

```bash
bash scripts/backup-postgres-r2.sh --restore postgres/daily/<dernier>.dump.gz.enc
# puis pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" <fichier>
```

### Étape 3 — Démarrer la stack applicative

6. ```bash
   docker compose -f docker/docker-compose.production.yml up -d
   docker exec <app> pnpm prisma migrate deploy   # ou via entrypoint
   ```
   (ou via Coolify : pull image GHCR `ghcr.io/will383842/axion-ia:latest`).

### Étape 4 — Restaurer les données annexes

7. **Fichiers image-bank** : `aws s3 sync s3://<bucket>/image-bank/live/ /var/data/image-bank/` (ou restaurer une archive).
8. **Docuseal** : déchiffrer la dernière archive `docuseal/monthly/*.tar.gz.enc` → restaurer SQLite + PDF dans le volume.
9. **Redis** : (optionnel — queues reconstructibles) restaurer `dump.rdb` si besoin.
10. **Plausible** : restaurer PG + ClickHouse depuis `plausible/*` (non bloquant).

### Étape 5 — Bascule DNS + vérifications

11. Cloudflare → pointer `axion-ia.com` vers la nouvelle IP.
12. Vérifs : `curl https://axion-ia.com/api/healthz` ; `/fr` → 200 ; admin accessible ; sitemap.
13. Relancer pgBackRest `stanza-create` + premier full sur le nouvel hôte ; vérifier les cron backups.
14. Logguer le drill dans `_AUDIT/PG-RESTORE-DRILL-LOG.md` (RTO mesuré, composants restaurés).

## Post-incident

- Rotation des secrets potentiellement exposés (cf. `_AUDIT/SECRETS-ROTATION-LOG.md`).
- Mettre à jour les cibles RTO/RPO de ce runbook avec les valeurs mesurées.
