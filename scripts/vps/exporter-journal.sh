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
# Au moins 2 Go libres : sinon on ne tente rien (l'export est un doublon du journal, il ne doit pas saturer le disque).
LIBRE_MO="$(df -Pm "$DEST" | awk 'NR==2 {print $4}')"
if [ "${LIBRE_MO:-0}" -lt 2048 ]; then echo "[exporter-journal] $(date +%FT%T) ÉCHEC : seulement ${LIBRE_MO:-?} Mo libres dans $DEST (2048 Mo requis), export non tenté"; exit 1; fi
SORTIE="$DEST/journal-export-$DATE.gz"
[ -e "$SORTIE" ] && SORTIE="$DEST/journal-export-$DATE-$(date +%H%M%S).gz"
ERR="$(mktemp)" || exit 1
trap 'rm -f "$ERR"' EXIT
if ! journalctl --since "-8 days" -o export 2>"$ERR" | gzip > "$SORTIE" 2>>"$ERR"; then
  LIBRE_APRES="$(df -Pm "$DEST" | awk 'NR==2 {print $4}')"
  if grep -qi "no space" "$ERR" || [ "${LIBRE_APRES:-0}" -lt 512 ]; then
    # Faute de place : le fichier partiel n'est qu'un doublon du journal, on le supprime pour rendre la place.
    rm -f "$SORTIE"; echo "[exporter-journal] ÉCHEC faute de place : fichier partiel supprimé (doublon du journal)"; exit 1
  fi
  echo "[exporter-journal] ÉCHEC de l'export : $SORTIE.partiel ; cause : $(head -c 300 "$ERR" | tr '\n' ' ')"; mv -f "$SORTIE" "$SORTIE.partiel"; exit 1
fi
if ! gzip -t "$SORTIE" || [ ! -s "$SORTIE" ]; then
  echo "[exporter-journal] archive invalide : $SORTIE.partiel"; mv -f "$SORTIE" "$SORTIE.partiel"; exit 1
fi
chmod 600 "$SORTIE"
echo "[exporter-journal] $(date +%FT%T) export vérifié : $SORTIE ($(stat -c %s "$SORTIE") octets)"
