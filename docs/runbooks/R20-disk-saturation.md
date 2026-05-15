# R20 — Saturation disque Hetzner CPX42

> Runbook créé suite à incident 2026-05-15 : tous les deploys Coolify ont
> échoué avec `No space left on device` lors du `tee docker-compose.yaml`.
> Cause root : 320 GB disque plein (build cache Docker + images zombies
> accumulés depuis plusieurs semaines sans cleanup automatique).

## Trigger

L'alerte Telegram tag `INCIDENT` arrive quand le cron `disk-cleanup.sh`
détecte :

- Usage disque root > 85 % (configurable via `DISK_WARN_PCT`)
- OU espace libre < 10 GB (configurable via `DISK_WARN_FREE_GB`)

## Mitigation rapide (5 min — débloque le deploy)

```bash
# Via SSH sur le serveur, ou Coolify Dashboard → Terminal :

# 1. Espace dispo
df -h /

# 2. Docker prune agressif (garde uniquement images en cours d'exécution)
docker system prune -a -f --volumes
docker builder prune -a -f

# 3. Coolify : builds artefacts > 7 jours
find /data/coolify/applications/*/builds -maxdepth 1 -type d -mtime +7 \
  | tail -n +6 | xargs -r rm -rf

# 4. Logs anciens
find /var/log -type f -name "*.log.gz" -mtime +30 -delete
find /data/coolify -type f -name "*.log" -size +500M -mtime +14 -delete

# 5. Re-vérifier
df -h /
```

Attendu : libère 50-150 GB.

## Mitigation préventive (déjà en place)

Le script `scripts/ops/disk-cleanup.sh` est exécuté chaque nuit à 03h00 :

```cron
0 3 * * * /opt/axion-ia/scripts/ops/disk-cleanup.sh >> /var/log/axion-disk-cleanup.log 2>&1
```

À installer sur le serveur prod via :

```bash
# SSH Hetzner CPX42 (axion-ia.com — 178.105.55.15)
sudo cp scripts/ops/disk-cleanup.sh /opt/axion-ia/scripts/ops/disk-cleanup.sh
sudo chmod +x /opt/axion-ia/scripts/ops/disk-cleanup.sh
# Charger env vars Telegram dans le cron
sudo crontab -e
# Ajouter :
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx
0 3 * * * /opt/axion-ia/scripts/ops/disk-cleanup.sh >> /var/log/axion-disk-cleanup.log 2>&1
```

## Investigation racine (si cleanup ne suffit pas)

```bash
# Top 20 dossiers les plus volumineux
du -h --max-depth=2 / 2>/dev/null | sort -hr | head -20

# Images Docker hors-runtime
docker images --filter "dangling=false" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k3 -hr

# Volumes Docker
docker system df -v
```

Suspects fréquents :

- `/data/coolify/applications/*/builds/` — artefacts builds (peut atteindre 50+ GB)
- `/var/lib/docker/overlay2/` — layers images (à purger via `docker system prune -a`)
- `/data/coolify/databases/*-logs.tar.gz` — backups logs anciens
- `/data/coolify/proxy/logs/*` — logs Caddy / Traefik
- `/var/log/journal/` — systemd journal (limiter via `journalctl --vacuum-size=500M`)

## Escalade (si saturé répété malgré cleanup)

1. Augmenter disque Hetzner CPX42 (cher — préférer V2 add storage volume)
2. Migrer build cache vers stockage objet (R2 Cloudflare via Buildkit)
3. Réduire fréquence builds CI (limit GitHub Actions concurrent)

## Permissions Claude Code sandbox (autoriser cleanup via autopilot)

Par défaut, Claude Code sandbox refuse les opérations server-wide
(protection prod). Pour autoriser le cleanup Docker via API Coolify, ajouter
dans `~/.claude/settings.local.json` (ou `.claude/settings.local.json` du
projet parent `Axion-IA/`) :

```json
{
  "permissions": {
    "allow": [
      "Bash(curl * http://178.105.55.15:8000/api/v1/servers/l877luxxpv1mx96sss7tc6zj/cleanup *)",
      "Bash(curl * http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/execute *)"
    ]
  }
}
```

**Risque** : exec arbitraire sur container prod + cleanup server-wide. À
n'activer que pour les sessions où le besoin est explicite. Préférer
exécution manuelle via Coolify Dashboard ou SSH.

## Liens

- Hetzner Cloud Console : <https://console.hetzner.cloud/projects>
- Coolify Dashboard : <http://178.105.55.15:8000>
- Script : `scripts/ops/disk-cleanup.sh`
