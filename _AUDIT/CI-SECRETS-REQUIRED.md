# Secrets & variables requis — GitHub Actions + Coolify + cron VPS

> Les **valeurs** ne sont jamais ici (non exportables / sensibles). Ce fichier liste les **noms**,
> leur usage, leur scope et leur statut « set ». Permet de vérifier qu'une reconstruction from cold
> dispose de tout. Référencé par ADR 0022 / ADR 0032.

- **Dernière revue** : 2026-06-03
- ⚠️ GitHub Actions n'expose pas les valeurs via API → vérifier « set » dans Settings → Secrets, ou via `gh secret list`.

---

## A. GitHub Actions — secrets (build & drills)

| Nom | Usage | Set ? |
|---|---|---|
| `COOLIFY_API_TOKEN` | Trigger deploy Coolify (deploy-coolify.yml) | ⚠️ |
| `COOLIFY_URL` / `COOLIFY_APP_UUID` | Endpoint + app cible | ⚠️ |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` | Purge cache | ⚠️ |
| `SENTRY_AUTH_TOKEN` | Upload sourcemaps | ⚠️ |
| `GITHUB_TOKEN` | Push GHCR (auto-injecté) | ✅ auto |
| `DATABASE_URL` | drill (dump source si applicable) | ⚠️ |
| `BACKUP_ENCRYPTION_PASSPHRASE` | déchiffrement drill dumps | ⚠️ |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | accès R2 (drill download) | ⚠️ |
| `R2_ENDPOINT` / `R2_BUCKET_NAME` / `R2_ACCOUNT_ID` | cible R2 | ⚠️ |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | alertes drill | ⚠️ |
| **`BACKUP_INGEST_SECRET`** (ADR 0032) | HMAC POST `/api/internal/backups*` depuis le drill CI | 🆕 à set |
| `DATABASE_URL_TEST` (optionnel) | restore réel sur PG jetable | ⚠️ |

## B. GitHub Actions — variables (repo `vars`)

| Nom | Usage | Valeur attendue |
|---|---|---|
| `NIGHTLY_BACKUP_DRILL_ENABLED` | active le drill nightly existant | `true` (⚠️ confirmer) |
| `MONTHLY_RESTORE_DRILL_ENABLED` (ADR 0032) | active `restore-drill-monthly.yml` | `true` 🆕 |

## C. Coolify — env vars runtime (scope RUN)

Secrets prod injectés au container. Backup via `scripts/vps/run-secrets-backup.sh` (export API Coolify de toute l'instance → archive AES → R2 `secrets/`).

| Nom | Usage | Set ? |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Postgres | ✅ |
| `REDIS_URL` / `REDIS_PASSWORD` | Redis | ✅ |
| `AUTH_SECRET` / `ADMIN_URL_PREFIX` | Auth + admin | ✅ |
| `PII_ENCRYPTION_KEY` / `IP_HASH_SALT` | RGPD at-rest | ⚠️ confirmer set prod |
| `BACKUP_ENCRYPTION_PASSPHRASE` | dumps | ✅ |
| `HETZNER_STORAGE_*` | Storage Box | ✅ |
| `R2_*` | R2 | ✅ |
| `TELEGRAM_*` | alertes | ✅ |
| **`BACKUP_INGEST_SECRET`** (ADR 0032) | auth ingestion statut backups | 🆕 à set |
| **`AGE_RECIPIENT`** (ADR 0032) | clé publique age (chiffrement secrets) | 🆕 à set |

## D. Cron VPS — env (fichier sourcé `/etc/axion-ia/backup.env`, perms 600)

À ajouter aux env existants pour que les nouveaux scripts tournent en cron : `R2_*` (aujourd'hui
seulement en CI), `R2_BUCKET_IMMUTABLE`, `HEALTHCHECK_URL_*` (par composant), `BACKUP_REPORT_URL`
(= `http://localhost:3000`), `BACKUP_INGEST_SECRET`, `AGE_RECIPIENT`, `COOLIFY_API_TOKEN`/`COOLIFY_URL`/`COOLIFY_APP_UUID`,
`PGBACKREST_REPO1_CIPHER_PASS`, `PGBACKREST_REPO1_S3_KEY`/`_SECRET`, `REMOTE_GIT_OFFSITE`.

> 🔒 **Hors-système** (coffre 1Password + papier, jamais sur le VPS) : `SOPS_AGE_KEY` (clé **privée** age)
> et `BACKUP_ENCRYPTION_PASSPHRASE` (copie de secours). Sans elles, aucun backup n'est déchiffrable.
