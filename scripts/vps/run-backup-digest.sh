#!/usr/bin/env bash
# run-backup-digest.sh — Bilan quotidien UNIQUE des sauvegardes Axion-IA.
# Remplace les pings Telegram par-run (silenciés) par 1 seul message/jour.
# Lit l'état REEL dans R2 (prouve l'atterrissage off-site), calcule l'âge du
# dernier objet par composant, classe frais / périmé / absent, envoie 1 Telegram.
# Ajouté 2026-07-11. Cron : 30 6 * * * (08h30 Paris, après les backups de nuit).
set -e
APP_CT=$(docker ps --filter "name=mqbmlz1bcwsdwi3t9fxsllqt" --format '{{.Names}}' | head -1)
docker run --rm \
  --network=coolify \
  -e AWS_ACCESS_KEY_ID="$(docker exec $APP_CT printenv R2_ACCESS_KEY_ID)" \
  -e AWS_SECRET_ACCESS_KEY="$(docker exec $APP_CT printenv R2_SECRET_ACCESS_KEY)" \
  -e AWS_REGION=auto \
  -e AWS_PAGER= \
  -e R2_ENDPOINT="$(docker exec $APP_CT printenv R2_ENDPOINT)" \
  -e R2_BUCKET_NAME="$(docker exec $APP_CT printenv R2_BUCKET_NAME)" \
  -e TELEGRAM_BOT_TOKEN="$(docker exec $APP_CT printenv TELEGRAM_BOT_TOKEN)" \
  -e TELEGRAM_CHAT_ID="$(docker exec $APP_CT printenv TELEGRAM_CHAT_ID)" \
  postgres:16-alpine \
  bash -c '
    set -e
    apk add --no-cache aws-cli curl bash coreutils >/dev/null
    MSGF=/tmp/digest-msg.txt
    BODY=/tmp/digest-body.txt
    : > "$BODY"
    NOW=$(date -u +%s)
    NB_OK=0; NB_WARN=0; NB_KO=0

    s3ls() { aws --endpoint-url "$R2_ENDPOINT" s3 ls --recursive "s3://$R2_BUCKET_NAME/$1" 2>/dev/null | sort | tail -1; }

    # check <label> <prefix> <max_age_min> <min_size_bytes> [emptyok]
    # emptyok : si fourni, une archive sous min_size reste OK (info)
    #           ex. fichiers utilisateurs pas encore uploades.
    check() {
      local label="$1" prefix="$2" maxmin="$3" minsize="$4" emptyok="${5:-}"
      local row d t size epoch age_min human ageh
      row="$(s3ls "$prefix")"
      if [ -z "$row" ]; then
        printf "%s\n" "🔴 ${label} : AUCUNE sauvegarde trouvée dans R2" >> "$BODY"
        NB_KO=$((NB_KO+1)); return
      fi
      d=$(echo "$row"  | awk "{print \$1}")
      t=$(echo "$row"  | awk "{print \$2}")
      size=$(echo "$row" | awk "{print \$3}")
      epoch=$(date -u -d "$d $t UTC" +%s 2>/dev/null || echo "$NOW")
      age_min=$(( (NOW - epoch) / 60 )); [ "$age_min" -lt 0 ] && age_min=0
      if   [ "$size" -ge 1048576 ]; then human="$((size/1048576)) Mo"
      elif [ "$size" -ge 1024 ];    then human="$((size/1024)) Ko"
      else human="${size} o"; fi
      if [ "$age_min" -ge 60 ]; then ageh="il y a $((age_min/60)) h"; else ageh="il y a ${age_min} min"; fi
      if [ "$age_min" -gt "$maxmin" ]; then
        printf "%s\n" "🔴 ${label} : PÉRIMÉ (${ageh}) · ${human}" >> "$BODY"; NB_KO=$((NB_KO+1))
      elif [ "$size" -lt "$minsize" ]; then
        if [ -n "$emptyok" ]; then
          printf "%s\n" "✅ ${label} : ${ageh} · vide (aucun fichier uploadé — normal)" >> "$BODY"; NB_OK=$((NB_OK+1))
        else
          printf "%s\n" "⚠️ ${label} : ${ageh} · ${human} (quasi vide, à vérifier)" >> "$BODY"; NB_WARN=$((NB_WARN+1))
        fi
      else
        printf "%s\n" "✅ ${label} : ${ageh} · ${human}" >> "$BODY"; NB_OK=$((NB_OK+1))
      fi
    }

    check "Base Postgres (horaire)"        "postgres/hourly/"    90    100000
    check "Base Postgres (daily off-site)" "postgres/daily/"     1560  100000
    check "Fichiers (CV / docs / avis)"    "files/daily/"        1560  1000   emptyok
    check "Secrets (env chiffrés)"         "secrets/"            1560  1000
    check "Docuseal (docs signés)"         "docuseal/daily/"     1560  1000
    check "Plausible — base (config)"      "plausible/pg/daily/" 1560  1000
    check "Plausible — visites (events)"   "plausible/ch/daily/" 1560  1000
    printf "%s\n" "ℹ️ Redis (file/cache) : non sauvegardé — normal (reconstruisible)" >> "$BODY"

    if   [ "$NB_KO"   -gt 0 ]; then HEAD="🔴 <b>Sauvegardes — bilan 24h</b> (${NB_KO} problème(s))"
    elif [ "$NB_WARN" -gt 0 ]; then HEAD="🟠 <b>Sauvegardes — bilan 24h</b> (${NB_WARN} à vérifier)"
    else                            HEAD="✅ <b>Sauvegardes — bilan 24h</b> (tout OK)"; fi

    { printf "%s\n\n" "$HEAD"; cat "$BODY"; } > "$MSGF"

    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
      curl -fsS -m 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" -d "parse_mode=HTML" \
        --data-urlencode "text@${MSGF}" >/dev/null 2>&1 || true
    fi
    echo "digest envoyé : ok=${NB_OK} warn=${NB_WARN} ko=${NB_KO}"
    cat "$MSGF"
  '
