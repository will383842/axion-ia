# Inventaire crontab VPS — Axion-IA

> Source de vérité des tâches planifiées **côté VPS Hetzner** (hors GitHub Actions).
> À compléter via `ssh <vps> 'crontab -l'` (et `crontab -l -u <user>` pour chaque user concerné).
> Mettre à jour à chaque ajout/suppression de cron. Référencé par ADR 0022 / ADR 0032.

- **Dernière vérification** : 2026-06-03 (via SSH root, Claude Opus 4.8)
- **Hôte** : VPS Hetzner **CPX42** confirmé (`axionia-web`, id 130002660, IP 178.105.55.15, Ubuntu 6.8, disque 150G à 34%)
- **Hetzner Backups Auto** : ✅ **ACTIVÉ** (backup_window 10-14 UTC) — confirmé via API Hetzner.

---

## Entrées attendues (déclarées en commentaire dans les scripts)

| Schedule (UTC) | Commande | Source script | Présent sur VPS ? |
|---|---|---|---|
| `0 3 * * *` | `backup-postgres.sh` (daily) | backup-postgres.sh:22 | ⚠️ à confirmer |
| `0 4 * * 0` | `backup-postgres.sh --type weekly` | backup-postgres.sh:23 | ⚠️ à confirmer |
| `0 5 1 * *` | `backup-postgres.sh --type monthly` | backup-postgres.sh:24 | ⚠️ à confirmer |
| `0 3 * * *` | `backup-postgres-r2.sh` (daily) | backup-postgres-r2.sh:37 | ⚠️ à confirmer |
| `0 4 * * 0` | `backup-postgres-r2.sh --type weekly` | backup-postgres-r2.sh:38 | ⚠️ à confirmer |
| `0 5 1 * *` | `backup-postgres-r2.sh --type monthly` | backup-postgres-r2.sh:39 | ⚠️ à confirmer |

> ⚠️ Risque : les deux familles de scripts sont planifiées à `0 3 * * *` → deux `pg_dump` simultanés.
> ADR 0022 §pipeline prévoit un **écart de 15 min**. Vérifier que le crontab réel applique bien le décalage.

## Entrées à AJOUTER (ADR 0032 — backup étendu)

Espacer pour ne pas saturer pg_dump/CPU/disque. Charger les env via un fichier sourcé (ex. `/etc/axion-ia/backup.env`, perms 600).

| Schedule (UTC) | Commande | Composant |
|---|---|---|
| `30 2 * * *` | `backup-redis.sh` | Redis (RDB) |
| `45 2 * * *` | `backup-docuseal.sh` | Docuseal (DB + PDF) |
| `15 3 * * *` | `backup-image-bank-r2.sh --mode mirror` | Image-bank (sync incrémental) |
| `0 6 1 * *` | `backup-image-bank-r2.sh --mode archive --type monthly` | Image-bank (archive immuable) |
| `30 3 * * *` | `backup-plausible.sh` | Plausible (CH + PG) |
| `0 2 * * *` | `backup-secrets.sh` | Secrets/config (age → R2 immuable) |
| `0 1 * * 0` | `mirror-git-offsite.sh` | Mirror Git hebdo |
| `0 1 * * *` | `backup-pgbackrest.sh --type diff` | PITR Postgres (diff quotidien) |
| `0 1 * * 0` | `backup-pgbackrest.sh --type full` | PITR Postgres (full hebdo) |

> Note : pgBackRest archive les WAL en continu via `archive_command` (config Postgres), pas via cron.
> Le cron ne fait que les backups full/diff + `pgbackrest check`.

## Procédure de relevé

```bash
ssh <vps> 'crontab -l'                 # crontab root
ssh <vps> 'for u in $(cut -f1 -d: /etc/passwd); do echo "== $u =="; crontab -l -u "$u" 2>/dev/null; done'
ssh <vps> 'ls -la /etc/cron.d/ /etc/cron.daily/'   # cron système
```

Coller la sortie réelle ci-dessous à chaque relevé.

### Relevé du 2026-06-03 (crontab root réel)
```cron
0 3 * * *   /opt/axion-ia/run-r2-backup.sh daily   >> /var/log/r2-backup.log 2>&1
0 4 * * 0   /opt/axion-ia/run-r2-backup.sh weekly  >> /var/log/r2-backup.log 2>&1
0 5 1 * *   /opt/axion-ia/run-r2-backup.sh monthly >> /var/log/r2-backup.log 2>&1
0 */6 * * * docker image prune -af   >> /var/log/docker-image-prune.log 2>&1
0 */6 * * * docker builder prune -af --keep-storage 2GB >> /var/log/docker-builder-prune.log 2>&1
*/30 * * * * <alerte disque si usage / > 80% via logger>
```

### Mécanisme réel des backups (important)
- `/opt/axion-ia/run-r2-backup.sh` (script maison, **PAS** un checkout git) lance un container
  **`postgres:16-alpine` éphémère** sur le réseau `coolify`, injecte l'env depuis le container app
  (`docker exec <app> printenv …`), puis **télécharge `scripts/backup-postgres-r2.sh` depuis GitHub
  `main`** (`raw.githubusercontent.com`) et l'exécute. → Le script repo à jour est donc toujours
  celui qui tourne (auto-pull). Aucun outil backup n'est requis sur l'hôte.
- ⚠️ **Seul le backup Postgres → R2 est planifié.** La variante **Hetzner Storage Box**
  (`backup-postgres.sh`) **n'est PAS dans le cron** → contrairement à ADR 0022, il n'y a en pratique
  qu'**une seule destination de dump** (R2). À corriger (ajouter le cron Storage Box) ou acter.
- Outils hôte : `docker`, `openssl`, `rsync`, `curl` présents ; **absents** : `age`, `aws`,
  `pgbackrest`, `sqlite3`, `pg_dump`, `redis-cli` (tous obtenus via container éphémère).

### Containers identifiés (2026-06-03)
- App Next : `mqbmlz1bcwsdwi3t9fxsllqt-112101635989`
- App Postgres : `u7zlql3bpb1xy5t4kg6jnvpm` (postgres:16-alpine)
- App Redis : `hdfknlij6yqebr09p379m9q6` (redis:7-alpine)
- Plausible : `plausible_db-…`, `plausible_events-…`, `plausible-…` (service Coolify `plausible-ce`)
- Mail : `mail-vl41…`

### État du provisioning backup étendu (ADR 0032) au 2026-06-03
- ✅ `BACKUP_INGEST_SECRET` : posé dans Coolify (RUN) + GitHub Actions secret (même valeur).
- ✅ Secrets CI drill posés dans GitHub : `R2_*` (5), `BACKUP_ENCRYPTION_PASSPHRASE`, `TELEGRAM_*`.
- ✅ Var GitHub `MONTHLY_RESTORE_DRILL_ENABLED=true` ; `NIGHTLY_BACKUP_DRILL_ENABLED` absent = activé par défaut.
- ✅ **FAIT 2026-06-03** : `run-r2-backup.sh` injecte `BACKUP_REPORT_URL` + `BACKUP_INGEST_SECRET`
  + télécharge `backup-lib.sh` → le dump Postgres remonte au dashboard (testé OK).
- ✅ **FAIT 2026-06-03** : `/opt/axion-ia/run-docuseal-backup.sh` (Docuseal volume entier, tar
  crash-consistent → AES → R2 `docuseal/daily/`, cron 02:45) + `/opt/axion-ia/run-secrets-backup.sh`
  (export env Coolify via API → AES → R2 `secrets/`, cron 02:00). Tous deux testés OK + reporting dashboard.
- ⏳ **Reste (non fait)** : redis/plausible (reconstructibles, non-critiques) ; pgBackRest (downtime
  Postgres) ; buckets R2 + Object Lock (tokens sans droit) ; clé age asymétrique (AES utilisé en
  attendant) ; Healthchecks.io (pas de compte) ; mirror Git (pas de 2e provider).
- ⚠️ **image-bank** : l'app n'a AUCUN volume local + pas de `HETZNER_STORAGE_*` en env Coolify →
  stockage image non configuré en prod (probablement inutilisé). Si l'image-bank devient actif,
  configurer le stockage + son backup off-Hetzner.

### Nouvelles entrées cron (2026-06-03)
```cron
0 2 * * *   /opt/axion-ia/run-secrets-backup.sh        >> /var/log/secrets-backup.log 2>&1
45 2 * * *  /opt/axion-ia/run-docuseal-backup.sh daily  >> /var/log/docuseal-backup.log 2>&1
```
Wrappers self-contained (container postgres:16-alpine éphémère + auto-pull backup-lib.sh GitHub main +
reporting HMAC dashboard). Déchiffrement : AES-256 avec `BACKUP_ENCRYPTION_PASSPHRASE` (coffre).
