#!/usr/bin/env bash
# Banc @formateurs — démarre le stockage R2 SIMULÉ (`stockage-r2-simule.mjs`).
#
#   1. un certificat auto-signé pour `banc.r2.cloudflarestorage.com` et ses seaux ;
#   2. ces noms pointés vers 127.0.0.1 (`/etc/hosts`) — sur la machine du banc SEULE ;
#   3. le serveur, en tâche de fond, sur le port 443 ;
#   4. la PREUVE que le nom mène bien au serveur local, sinon échec : un banc qui
#      parlerait au vrai R2 avec des clés fictives ne prouverait rien.
#
# Usage : demarrer-stockage-r2.sh <dossier de travail> <seau>
set -euo pipefail
TRAVAIL="${1:?dossier de travail}"
SEAU="${2:?seau}"
HOTE="banc.r2.cloudflarestorage.com"
ICI="$(cd "$(dirname "$0")" && pwd)"
SUDO=""; [ "$(id -u)" = "0" ] || SUDO="sudo"

mkdir -p "$TRAVAIL/objets"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=$HOTE" \
  -addext "subjectAltName=DNS:$HOTE,DNS:*.$HOTE" \
  -keyout "$TRAVAIL/cle.pem" -out "$TRAVAIL/cert.pem" 2>/dev/null

for nom in "$HOTE" "$SEAU.$HOTE"; do
  grep -q " $nom\$" /etc/hosts || echo "127.0.0.1 $nom" | $SUDO tee -a /etc/hosts >/dev/null
done

$SUDO nohup node "$ICI/stockage-r2-simule.mjs" "$TRAVAIL/cert.pem" "$TRAVAIL/cle.pem" \
  "$TRAVAIL/objets" 443 > "$TRAVAIL/r2.log" 2>&1 &

for i in $(seq 1 20); do
  if curl -sf --noproxy "*" --cacert "$TRAVAIL/cert.pem" -X PUT --data "sonde" \
    "https://$SEAU.$HOTE/sonde-du-banc" >/dev/null; then
    curl -sf --noproxy "*" --cacert "$TRAVAIL/cert.pem" "https://$SEAU.$HOTE/sonde-du-banc" | grep -q sonde
    echo "stockage R2 simulé prêt (https://$SEAU.$HOTE → 127.0.0.1)"
    exit 0
  fi
  sleep 1
done
echo "::error::le stockage R2 simulé ne répond pas"
cat "$TRAVAIL/r2.log" || true
exit 1
