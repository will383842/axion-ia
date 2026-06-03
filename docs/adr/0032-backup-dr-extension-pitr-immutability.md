# ADR 0032 — Extension Backup/DR : périmètre complet, PITR, immuabilité, secrets chiffrés

- **Statut** : Accepté
- **Date** : 2026-06-03
- **Auteur** : Will + Claude (Opus 4.8), suite à `_AUDIT/AUDIT-BACKUP-DR-2026-06-03.md`
- **Référence** : ADR 0022 (backup scripts-only, Postgres), ADR 0026 (build externalisé GHCR), ADR 0025 (PII at-rest), audit Pr-04
- **Supersede partiellement** : ADR 0022 « Alternatives écartées » (PgBackRest classé V2) → adopté ici.

## Contexte

L'audit DR 2026-06-03 établit que **seul Postgres est sauvegardé**. Angles morts P0 : fichiers
image-bank (copie unique), Docuseal (PDF signés), secrets (non chiffrés/offsite, passphrase dans le
système qu'elle protège), discipline de drill non prouvée. P1 : Redis, Plausible, pas de
dead-man's-switch, pas d'immuabilité, RTO/RPO non chiffrés, code Git sans mirror.

Décision du propriétaire : traiter **P0 + P1 + dashboard admin en une fois**, activer les quatre
couches (R2 Object Lock, Healthchecks.io, PITR pgBackRest, mirror Git), chiffrer les secrets via age.

## Décision

### 1. Périmètre élargi — scripts backup (étend ADR 0022)

Bibliothèque commune `scripts/backup-lib.sh` (helpers `notify_telegram`, `record_fail/success`,
`s3()`, `require_var`, `healthcheck_ping()`, `report_backup_run()`), puis un script par composant,
**calqués sur `backup-postgres-r2.sh`** (chiffrement `openssl aes-256-cbc -pbkdf2 -iter 100000`
homogénéisé, GFS 7/4/12, double destination R2 + Storage Box) :

- `backup-image-bank-r2.sh` — modes `mirror` (s3 sync incrémental) + `archive` (tar chiffré GFS immuable).
- `backup-docuseal.sh` — SQLite `.backup`/`VACUUM INTO` (cohérent) + tar PDF → chiffré.
- `backup-redis.sh` — `BGSAVE` + `dump.rdb` chiffré (RPO lâche, confort).
- `backup-plausible.sh` — ClickHouse (`clickhouse-backup`) + `pg_dump` Plausible.
- `backup-secrets.sh` — `.secrets/` + export env Coolify → **age** → R2 immuable.
- `mirror-git-offsite.sh` — clone bare dédié → `git push --mirror`.

### 2. PITR Postgres via pgBackRest (couche additive)

WAL streaming continu → **RPO < 1 h** (vs 24 h des dumps). Repo sur **R2 S3** (`repo1-cipher-type=aes-256-cbc`,
`archive-async=y`). Les dumps `backup-postgres*.sh` **restent** (defense in depth : si le repo
pgBackRest se corrompt, les dumps plain/custom restent restaurables indépendamment).

Intégration : image `postgres:16-alpine` **custom** (+`pgbackrest`), `archive_mode=on`,
`archive_command='pgbackrest --stanza=axionia archive-push %p'` appliqué **uniquement via l'override
prod Coolify** (`infra/pgbackrest/docker-compose.override.pgbackrest.yml`), jamais dans
`docker-compose.production.yml` (smoke local) ni dans l'image app GHCR.

### 3. Immuabilité — R2 Object Lock (anti-ransomware)

Bucket dédié `axion-ia-backups-immutable` (Object Lock à la création) pour : **secrets**,
**monthly Postgres**, **pgBackRest full** (`s3api put-object --object-lock-mode COMPLIANCE
--object-lock-retain-until-date`). Un attaquant ayant le VPS ne peut plus effacer ces backups.

### 4. Dead-man's-switch — Healthchecks.io

Ping par composant×type (`HEALTHCHECK_URL_*`) en fin de chaque script (racine = succès, `/fail` =
échec). Détecte le cas « le cron n'a pas tourné du tout » (que Telegram ne peut pas signaler).

### 5. Secrets chiffrés — age asymétrique

`age -r $AGE_RECIPIENT` (clé **publique** seule sur le VPS). La clé **privée** (`SOPS_AGE_KEY`) reste
**hors-système** (1Password + papier). Résout l'angle mort « restore from cold ».

### 6. Suivi — table Prisma + dashboard admin

Tables `BackupRun` / `RestoreDrill` (journal d'ops, `cuid`, pas de FK). Les scripts POSTent leur
statut sur **`/api/internal/backups`** (auth **HMAC** calquée sur `kb/ingest`, `X-Backup-Signature`

- `X-Idempotency-Key`) — seule voie cohérente pour cron VPS **et** drill CI (le CI ne peut pas
  joindre le Postgres prod). Page admin `/infra/backups` (FR-only, force-dynamic) : vue d'ensemble par
  composant, historique paginé, drills, bandeau « backup manqué ». Alerting branché sur l'existant
  (`/alerts` + Telegram), pas de système parallèle.

### 7. Drill mensuel prouvé

`.github/workflows/restore-drill-monthly.yml` (gardé par `vars.MONTHLY_RESTORE_DRILL_ENABLED`) :
restore multi-composant sur cibles jetables, écrit un `RestoreDrill` + Telegram + Healthchecks.

## RTO / RPO cibles (à chiffrer après premier drill)

| Classe                     | RPO actuel  | RPO cible (ADR 0032) | RTO cible                            |
| -------------------------- | ----------- | -------------------- | ------------------------------------ |
| Postgres métier            | 24 h (dump) | **< 1 h** (PITR WAL) | ≤ 30 min (dump) / PITR point-in-time |
| Fichiers image-bank        | ∞ (1 copie) | ≤ 24 h (mirror)      | best-effort                          |
| Docuseal                   | ∞           | ≤ 24 h               | ≤ 1 h                                |
| Secrets/config             | ∞           | ≤ 24 h               | inclus dans cold-start               |
| Whole-platform (VPS perdu) | —           | —                    | ≤ Xh (runbook DR à mesurer)          |

## Conséquences

### Positives

- Couverture 3-2-1-1-0 étendue à tous les composants critiques (vs Postgres seul).
- Immuabilité + dead-man's-switch ferment les failles ransomware et échec silencieux.
- Restore from cold redevient possible (secrets chiffrés offsite + clé hors-système).
- Visibilité opérationnelle via le dashboard admin (fin de l'audit « à l'aveugle »).

### Négatives

- Surface de maintenance accrue (≈8 scripts + pgBackRest). Mitigation : `backup-lib.sh` mutualise.
- pgBackRest : risque de **WAL pile-up → saturation disque** (rappel incident CPX42). Mitigation :
  `archive-async=y` + `pgbackrest check` monitoré + alerte.
- Object Lock : `s3 rm` refusé sous lock (≠ échec ; rotation = expiration de rétention).
- Dépendances VPS à provisionner : `age`, `clickhouse-backup`, `pgbackrest`, `sqlite3`.

## Alternatives considérées

- **wal-g / barman** au lieu de pgBackRest — pgBackRest retenu (repo S3 natif chiffré + retention + Object Lock-compatible).
- **Insertion psql directe** du statut depuis les scripts — écartée (le drill CI ne peut pas joindre Postgres prod ; couplage schéma fragile). API HMAC retenue.
- **Coolify backup feature** — toujours écartée (cf. ADR 0022 : lock-in, mono-destination).

## Suivi

- Actions console (propriétaire) : buckets R2 + Object Lock, `age-keygen`, image Postgres custom +
  override Coolify + `stanza-create`, Healthchecks.io checks, remote git off-GitHub, crontab VPS,
  secrets `BACKUP_INGEST_SECRET`/`MONTHLY_RESTORE_DRILL_ENABLED`. Cf. `_AUDIT/CI-SECRETS-REQUIRED.md`.
- Confirmer : Hetzner Backups Auto (activés ? rétention ?), `NIGHTLY_BACKUP_DRILL_ENABLED`, stack
  Plausible déployée. Cf. `_AUDIT/CRON-VPS-INVENTORY.md`.
- Runbook DR chiffré RTO/RPO : `docs/runbooks/R33-disaster-recovery-cold-start.md`.
