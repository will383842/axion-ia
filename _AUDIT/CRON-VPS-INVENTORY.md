# Inventaire crontab VPS — Axion-IA

> Source de vérité des tâches planifiées **côté VPS Hetzner** (hors GitHub Actions).
> À compléter via `ssh <vps> 'crontab -l'` (et `crontab -l -u <user>` pour chaque user concerné).
> Mettre à jour à chaque ajout/suppression de cron. Référencé par ADR 0022 / ADR 0032.

- **Dernière vérification** : ⚠️ À RENSEIGNER (jamais inventorié au 2026-06-03)
- **Hôte** : VPS Hetzner CPX42 (à confirmer ; doc historique mentionne aussi CPX32)
- **Vérifié par** : —

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

### Relevé du <date>
```
⚠️ À COMPLÉTER
```
