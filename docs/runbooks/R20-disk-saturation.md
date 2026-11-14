# R20 — Saturation disque du VPS (axion-prod, 178.105.55.15)

> Réécrit le 2026-11-14 (audit disque Opus). L'ancienne version recommandait
> `docker system prune -a --volumes` et un cron quotidien de purge : c'est
> **interdit** (efface les images de retour arrière du Studio et les volumes
> de conteneurs arrêtés : Plausible, sonde Postgres...). Le script
> `scripts/ops/disk-cleanup.sh` et le workflow `disk-cleanup-prod.yml` sont
> supprimés, et un test (`disque-vps-aucune-purge-dangereuse.spec.ts`) interdit
> leur retour.

## Règle de fer

Jamais de purge Docker large : ni `system prune`, ni `image prune -a`, ni
`volume prune`, ni `--volumes`. On ne touche jamais aux volumes, bases,
sauvegardes, `cv-storage`, `f0-facecam`, `medias-reels`,
`contenu-reel-hors-depot`, `avant-reconciliation-*`, ni aux images `studio-*`
(retours arrière).

## Surveillance (cron hôte, `scripts/vps/`)

- `surveiller-disque.sh` : toutes les 10 min ; alerte Telegram (salon « 🔧
  Axion-IA — Technique ») à 75 % (info, 1×/jour), 85 % (alerte, 1×/6 h),
  90 % (critique, 1×/30 min) avec les 5 premières causes, le « plein dans N
  jours » et le pic des 7 derniers jours. Ne fait que mesurer et prévenir.
- `menage-tmp.sh` : quotidien 04:40 ; archive puis supprime les gros vieux
  dossiers de `/tmp` (voir le script).
- `journald-axion.conf` : journald limité à 500 Mo.
- Installation : `scripts/vps/installer-garde-fous-disque.sh` (voir
  `scripts/vps/README.md`, section « Garde-fous disque »).

## Quand l'alerte arrive

```bash
df -h /
# Qui occupe l'espace (lecture seule)
du -xh --max-depth=1 /tmp /root /opt /var/lib/docker /var/lib/containerd /var/log 2>/dev/null | sort -hr | head -20
docker ps -s --format 'table {{.Names}}\t{{.Size}}'   # couche écrite des conteneurs
docker system df                                      # lecture seule
journalctl --disk-usage
```

Actions sûres, dans l'ordre :

1. `/tmp` : lancer `/opt/axion-ia/menage-tmp.sh --essai`, puis sans `--essai`
   (il archive dans `/root/archives-tmp/` avant de supprimer).
2. Cache de build seulement : `docker builder prune -f --keep-storage 2GB`.
3. Journal : `journalctl --vacuum-size=500M`.
4. Sessions Claude : travailler dans `/root/travaux-claude/<date>-<session>/`
   et nettoyer en partant (jamais dans `/tmp`).
5. Le reste (clones du Studio, vidéos `cv-storage`, journaux ClickHouse) :
   décision du fondateur ou de la session Studio, jamais de suppression
   automatique.

## Suspects fréquents (audit du 14/11/2026)

- Pics lors de mises en ligne rapprochées (image du site ≈ 8,3 Go, 2-3 images
  coexistent) et builds du Studio (cache ≈ 8 Go).
- Couche écrite du conteneur du site (cache ISR, borné par l'élagueur).
- `/tmp` des sessions Claude (th-*, tf-*, tg-*).
- journald (limité depuis ce lot), journaux ClickHouse (Plausible).

## Escalade

Disque > 90 % malgré ces actions : prévenir le fondateur (agrandir le disque
Hetzner ou déplacer des vidéos vers R2 sont des décisions à lui).

## Liens

- Scripts : `scripts/vps/surveiller-disque.sh`, `scripts/vps/menage-tmp.sh`
- Hetzner Cloud Console : <https://console.hetzner.cloud/projects>
