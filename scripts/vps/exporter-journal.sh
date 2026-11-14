#!/usr/bin/env bash
# exporter-journal.sh — Export compressé des 8 derniers jours du journal systemd (cron hebdomadaire,
# dimanche 05:10, installé par installer-garde-fous-disque.sh). journald est limité à 500 Mo : cet
# export garde une copie hors limite, avec un jour de recouvrement entre deux exports (aucun trou).
# Résultat : /root/archives-journal/journal-export-<date>.gz, vérifié par gzip -t ; sinon renommé
# .partiel et code de sortie 1. Ne supprime jamais rien.
set -u
set -o pipefail
DEST="${EXPORT_DEST:-/root/archives-journal}"
DATE="$(date +%F)"
install -d -m 700 "$DEST" || { echo "[exporter-journal] $DEST inutilisable"; exit 1; }
SORTIE="$DEST/journal-export-$DATE.gz"
[ -e "$SORTIE" ] && SORTIE="$DEST/journal-export-$DATE-$(date +%H%M%S).gz"
if ! journalctl --since "-8 days" -o export | gzip > "$SORTIE"; then
  echo "[exporter-journal] ÉCHEC de l'export : $SORTIE.partiel"; mv -f "$SORTIE" "$SORTIE.partiel"; exit 1
fi
if ! gzip -t "$SORTIE" || [ ! -s "$SORTIE" ]; then
  echo "[exporter-journal] archive invalide : $SORTIE.partiel"; mv -f "$SORTIE" "$SORTIE.partiel"; exit 1
fi
chmod 600 "$SORTIE"
echo "[exporter-journal] $(date +%FT%T) export vérifié : $SORTIE ($(stat -c %s "$SORTIE") octets)"
