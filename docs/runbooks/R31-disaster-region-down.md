# R31 — Disaster total région Hetzner (Nuremberg down)

- **Code** : R31
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique majeur** (très rare mais total)
- **Impact si non traité** : site DOWN long. Perte de revenus + SEO + bookings + emails. RTO cible 4 h, RPO cible 24 h.

## Trigger

- Hetzner Statuspage Nuremberg incident niveau "majeur" (`https://status.hetzner.com/`)
- Pinging `178.105.55.15` ne répond plus depuis > 30 min
- Coolify dashboard inaccessible
- Cloudflare frontend retourne 521 (origin down) en continu malgré cache stale
- Confirmation par support Hetzner d'un incident datacenter-wide

## Pré-requis

- Tokens chargés : `set -a && source .secrets/api-tokens.env && set +a` (HETZNER_API_TOKEN + CF_API_TOKEN + CF_ZONE_ID + COOLIFY_API_TOKEN si encore exploitable)
- 1Password / KeePass accessible pour `BACKUP_ENCRYPTION_PASSPHRASE` (cf. `_AUDIT/SECRETS-ROTATION-LOG.md` §1)
- Backup R2 dernier daily récupérable (R2 = Cloudflare, indépendant Hetzner ✅)
- Compte Hetzner Cloud encore opérable (l'API marche depuis Helsinki/Falkenstein même si Nuremberg down)

## Cibles mesurées

- **RTO** (Recovery Time Objective) : ≤ 4 h
- **RPO** (Recovery Point Objective) : ≤ 24 h (dernier daily R2 disponible)

## Étapes

### 1. Confirmer le diagnostic (5 min)

```bash
# 1.1 Hetzner status
curl -s https://status.hetzner.com/api/v1/incidents | jq '.incidents[] | select(.status=="open")'

# 1.2 ICMP serveur
ping -c 5 178.105.55.15

# 1.3 Tentative API Hetzner depuis ailleurs
curl -fsS "https://api.hetzner.cloud/v1/servers/$HETZNER_SERVER_ID" \
  -H "Authorization: Bearer ${HETZNER_API_TOKEN}" | jq '.server.status'
# Attendu : "running" (si API ok mais ping fail = problème réseau régional)
# "off" / "migrating" = serveur impacté
```

### 2. Notifier maintenance + estimation (5 min)

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🔴 [DR] Disaster région Hetzner Nuremberg confirmée. Bascule Falkenstein démarrée. ETA prod up : 4h."
```

Message client à préparer (page maintenance temporaire CF Workers ou simple
Cloudflare "Always Online" si activé).

### 3. Réduire le TTL DNS (5 min — à faire AVANT bascule pour propager)

```bash
# Récupérer record A axion-ia.com
RECORD_ID=$(curl -fsS "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&name=axion-ia.com" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" | jq -r '.result[0].id')

# Update TTL à 300s (5min)
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${RECORD_ID}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ttl":300}'
```

> ⚠️ Idéalement le TTL est déjà à 300 s en steady state — voir P1 #8 du
> backlog audit `_AUDIT/CONTENT-GEN-AUDIT-D5-D6-DR-2026-05-15.md`.

### 4. Provisionner nouvelle VM Hetzner Falkenstein (15 min)

```bash
# Lister snapshots disponibles (les snapshots Hetzner sont par projet, accessibles cross-DC)
SNAPSHOT_ID=$(curl -fsS "https://api.hetzner.cloud/v1/images?type=snapshot&sort=created:desc" \
  -H "Authorization: Bearer ${HETZNER_API_TOKEN}" | jq -r '.images[0].id')
echo "Snapshot le plus récent : ${SNAPSHOT_ID}"

# Créer nouvelle VM Falkenstein (fsn1) ou Helsinki (hel1) à partir du snapshot
NEW_SERVER=$(curl -fsS -X POST "https://api.hetzner.cloud/v1/servers" \
  -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"axion-ia-prod-dr-$(date +%Y%m%d)\",
    \"server_type\": \"cpx42\",
    \"image\": ${SNAPSHOT_ID},
    \"location\": \"fsn1\",
    \"start_after_create\": true
  }")
NEW_IP=$(echo "$NEW_SERVER" | jq -r '.server.public_net.ipv4.ip')
echo "Nouvelle VM : ${NEW_IP}"
```

Coût additionnel : ~12,49 €/mois HT pour la nouvelle VM (l'ancienne sera
supprimée post-recovery, ou conservée temporairement pour debug).

### 5. Si snapshot trop vieux → restore depuis backup R2 (30 min)

Le snapshot Hetzner est généralement < 24 h (Backups Auto quotidiens).
Si la perte de données depuis le snapshot est inacceptable, on superpose
un restore Postgres depuis R2 :

```bash
# SSH vers nouvelle VM
ssh root@${NEW_IP}

# Charger les secrets (si scriptables) ou les coller depuis 1Password
# (BACKUP_ENCRYPTION_PASSPHRASE en particulier)

# Trouver le dernier backup daily R2
LATEST_R2=$(aws --endpoint-url $R2_ENDPOINT s3 ls s3://$R2_BUCKET_NAME/postgres/daily/ \
  | awk '{print $4}' | sort -r | head -1)

# Restore (cf. backup-postgres-r2.sh --restore)
bash /opt/axion-ia/scripts/backup-postgres-r2.sh --restore postgres/daily/$LATEST_R2

# Suivre les instructions affichées (pg_restore --clean --if-exists)
```

### 6. Bascule DNS Cloudflare vers nouvelle IP (5 min)

```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${RECORD_ID}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"${NEW_IP}\",\"ttl\":300}"

# Vérifier propagation
dig +short A axion-ia.com @1.1.1.1
dig +short A axion-ia.com @8.8.8.8
```

### 7. Purge cache Cloudflare (1 min)

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
```

### 8. Smoke tests prod (5 min)

```bash
# Healthz
curl -fsS https://axion-ia.com/api/healthz | jq .

# Pages critiques
for url in / /fr/audit /fr/reserver /fr/implantations/ile-de-france/paris; do
  echo "→ ${url}"
  curl -s -o /dev/null -w "  HTTP %{http_code} (%{time_total}s)\n" "https://axion-ia.com${url}"
done

# Login admin (depuis browser via ADMIN_URL_PREFIX)
```

### 9. Re-Coolify (si snapshot ne contenait pas Coolify state)

Si Coolify était dans le snapshot → automatiquement up.
Sinon → réinstaller Coolify + reconfigurer app via cli :

```bash
ssh root@${NEW_IP} "curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash"
# Puis reconfigurer app via UI ou import config
```

### 10. RTO / RPO measured

```bash
echo "Disaster start: $(date -d @$INCIDENT_DETECTED_TS)"
echo "Recovery end: $(date)"
RTO_MIN=$(( ($(date +%s) - INCIDENT_DETECTED_TS) / 60 ))
RPO_HOURS=$(( ($(date +%s) - $(stat -c%Y backup_used_file)) / 3600 ))
echo "RTO measured: ${RTO_MIN} min · RPO measured: ${RPO_HOURS} h"
```

Logger dans `_AUDIT/PG-RESTORE-DRILL-LOG.md` (entrée type `incident-cross-dc`).

### 11. Nettoyage post-incident

- [ ] Une fois Nuremberg de retour, décider : garder Falkenstein ou re-bascule Nuremberg ?
- [ ] Si re-bascule : refaire snapshot Falkenstein → restore Nuremberg → DNS Cloudflare
- [ ] Si garder Falkenstein : update mémoire `axionia_hosting_hetzner` + ADR 0009 amendement
- [ ] Supprimer ancienne VM Nuremberg si abandonnée
- [ ] Reset TTL DNS à valeur normale (1 h ou auto) si on souhaite cache plus long
- [ ] Post-mortem Telegram + ajout entrée drill log

## Vérifications post-fix

- [ ] `curl https://axion-ia.com/api/healthz` → 200 OK + `db: "ok"`
- [ ] Login admin OK + dashboard charge KPIs
- [ ] 1 booking smoke test E2E OK
- [ ] Sentry pas de spike erreurs nouvelles
- [ ] Pages clés ≤ 2 s p75 (CDN Cloudflare absorbe)
- [ ] Email outbound OK (test : trigger un transactional)

## Rollback

Si bascule échoue → re-pointer DNS vers ancienne IP Nuremberg (si elle remonte) :

```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${RECORD_ID}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d '{"content":"178.105.55.15","ttl":300}'
```

Aucun rollback Postgres restore (idempotent + DB drill isolée).

## Escalation

| Niveau | Contact               | Quand                                                                                |
| ------ | --------------------- | ------------------------------------------------------------------------------------ |
| L1     | Will                  | toujours (P0 majeur)                                                                 |
| L2     | Hetzner support       | confirmation incident DC + ETA recovery                                              |
| L3     | DPO                   | si downtime > 4 h ET données users impactées (RGPD Art. 32 — notification 72 h CNIL) |
| L4     | Communication clients | par email / status page si downtime > 1 h                                            |

## Liens

- R03 — Postgres down (single-DB scenario)
- R22 — PG restore drill (procédure restore Postgres détaillée)
- `coolify-procedures.md` §7 — snapshot Hetzner API
- `_AUDIT/SECRETS-ROTATION-LOG.md` §1 — recovery passphrase
- ADR 0009 — hosting Hetzner CPX42 + Cloudflare Free
- ADR 0022 — backup strategy (créé dans cet audit)
- Audit source : `_AUDIT/CONTENT-GEN-AUDIT-D5-D6-DR-2026-05-15.md` §10 P1-8
