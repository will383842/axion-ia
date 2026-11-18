#!/usr/bin/env bash
# Paquets Ubuntu en CI : miroir de secours quand l'archive habituelle est injoignable.
#
# Pourquoi : le 11/11/2026, de 14 h 40 à plus de 17 h (heure de Paris), les machines
# de GitHub ne résolvaient plus `azure.archive.ubuntu.com`, `archive.ubuntu.com` ni
# `security.ubuntu.com` (« Temporary failure resolving »). Tout le reste du réseau
# marchait. Résultat : `playwright install --with-deps` (Gate B) et
# `apt-get install ffmpeg` (Gate D) échouaient après 12 à 15 minutes de tentatives,
# sur TOUTES les PR, et chaque job perdu occupait une machine pour rien.
#
# Ce que fait ce script, à lancer AVANT toute commande apt :
#   1. pose des délais courts sur apt (une panne se voit en secondes, pas en minutes) ;
#   2. teste le miroir habituel de l'image ;
#   3. s'il ne répond pas, ajoute des résolveurs de noms publics et reteste ;
#   4. s'il ne répond toujours pas, bascule sur le premier miroir de secours
#      joignable (noms hors `ubuntu.com`) ;
#   5. si aucun ne répond, échoue tout de suite avec un message clair.
#
# Sécurité : apt vérifie la signature de l'archive Ubuntu (fichier InRelease) quel
# que soit le miroir ; un miroir ne peut donc pas servir un paquet modifié.
set -euo pipefail

LISTE_MIROIRS="/etc/apt/apt-mirrors.txt"
MIROIRS_DE_SECOURS=(
  "https://mirrors.edge.kernel.org/ubuntu"
  "http://mirror.leaseweb.com/ubuntu"
  "https://ftp.fau.de/ubuntu"
  "https://mirror.csclub.uwaterloo.ca/ubuntu"
)

NOM_DE_VERSION="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
if [ -z "${NOM_DE_VERSION}" ]; then
  echo "::error::Version d'Ubuntu introuvable dans /etc/os-release : impossible de tester un miroir."
  exit 1
fi

# Un miroir est « joignable » s'il sert l'index signé de la version ET celui des
# correctifs de sécurité (les deux sont lus par `apt-get update`).
joignable() {
  local base="${1%/}"
  curl -fsS -L --max-time 15 --retry 2 --retry-delay 3 -o /dev/null \
    "${base}/dists/${NOM_DE_VERSION}/InRelease" &&
    curl -fsS -L --max-time 15 --retry 2 --retry-delay 3 -o /dev/null \
      "${base}/dists/${NOM_DE_VERSION}-security/InRelease"
}

printf '%s\n' \
  'Acquire::Retries "3";' \
  'Acquire::http::Timeout "20";' \
  'Acquire::https::Timeout "20";' |
  sudo tee /etc/apt/apt.conf.d/99-ci-resistant > /dev/null

if [ ! -s "${LISTE_MIROIRS}" ]; then
  echo "Pas de liste de miroirs (${LISTE_MIROIRS}) sur cette image : rien à basculer."
  exit 0
fi

MIROIR_HABITUEL="$(awk 'NF && $1 !~ /^#/ { print $1; exit }' "${LISTE_MIROIRS}")"
if [ -n "${MIROIR_HABITUEL}" ] && joignable "${MIROIR_HABITUEL}"; then
  echo "Miroir habituel joignable (${MIROIR_HABITUEL}) : rien à changer."
  exit 0
fi

# Premier secours : la panne du 11/11 était une panne de RÉSOLUTION des noms
# `*.ubuntu.com` par le résolveur de la machine. On ajoute des résolveurs publics
# sur l'interface par défaut (la machine est jetable), puis on reteste.
INTERFACE="$(ip route show default 2>/dev/null | awk '{ print $5; exit }' || true)"
if [ -n "${MIROIR_HABITUEL}" ] && [ -n "${INTERFACE}" ] && command -v resolvectl > /dev/null 2>&1; then
  sudo resolvectl dns "${INTERFACE}" 1.1.1.1 8.8.8.8 9.9.9.9 || true
  sudo resolvectl flush-caches || true
  sleep 3
  if joignable "${MIROIR_HABITUEL}"; then
    echo "::warning::Résolveur de noms de la machine en panne pour l'archive Ubuntu : résolveurs publics de secours activés."
    exit 0
  fi
fi

echo "Miroir habituel injoignable (${MIROIR_HABITUEL:-aucun}) : recherche d'un miroir de secours."
for miroir in "${MIROIRS_DE_SECOURS[@]}"; do
  if joignable "${miroir}"; then
    sudo cp "${LISTE_MIROIRS}" "${LISTE_MIROIRS}.origine"
    printf '%s/\tpriority:1\n' "${miroir}" | sudo tee "${LISTE_MIROIRS}" > /dev/null
    echo "::warning::Archive Ubuntu habituelle injoignable : paquets pris sur le miroir de secours ${miroir}."
    exit 0
  fi
  echo "Miroir de secours injoignable : ${miroir}"
done

echo "::error::Aucun miroir Ubuntu joignable (habituel et secours). Panne de réseau de la machine : relancer le job plus tard."
exit 1
