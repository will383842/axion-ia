# Procédures Coolify — référence transverse

> Référence procédurale Coolify v4 pour ops Axion-IA. Toutes les actions
> versionnables ici ; les secrets (token, UUIDs) restent dans `.secrets/api-tokens.env`
> (gitignored) — voir mémoire `axionia_infra_tokens_pointer`.
>
> Coolify URL : `http://178.105.55.15:8000` (HTTP direct VPS, pas Cloudflare).

## 1. Variables d'environnement transverses (à charger en début de session)

```bash
set -a && source /chemin/Axion-IA/.secrets/api-tokens.env && set +a
# Variables exposées :
#   COOLIFY_API_TOKEN     — token Sanctum v4
#   COOLIFY_API_URL       — http://178.105.55.15:8000
#   COOLIFY_APP_UUID      — mqbmlz1bcwsdwi3t9fxsllqt (app axion-ia)
#   COOLIFY_WORKER_UUID   — UUID service worker (à documenter)
#   COOLIFY_POSTGRES_UUID — UUID service postgres
#   COOLIFY_REDIS_UUID    — UUID service redis
#   HETZNER_API_TOKEN     — Hetzner Cloud
#   CF_API_TOKEN          — Cloudflare
#   CF_ZONE_ID            — axion-ia.com zone ID
#   TELEGRAM_BOT_TOKEN    — bot Telegram
#   TELEGRAM_CHAT_ID      — chat Will
```

## 2. Login dashboard Coolify (UI)

- URL : `http://178.105.55.15:8000`
- Credentials : Will personnels (PAS partagés en doc).
- 2FA recommandé : Settings → 2FA → enable.

## 3. Logs container

### Via SSH direct

```bash
ssh root@178.105.55.15 "docker logs --tail 100 --since 10m axion-ia-app-prod"
ssh root@178.105.55.15 "docker logs --tail 100 --since 10m axion-ia-worker-prod"
ssh root@178.105.55.15 "docker logs -f --tail 50 axion-ia-postgres-prod"  # live
```

### Via Coolify API

```bash
curl -s "${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}/logs?lines=200" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

### Via Coolify UI

Application → Logs → live tail.

## 4. Update env vars

### Lister env vars

```bash
curl -s "${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" | jq 'map({key, is_build_time})'
```

### Ajouter / update

```bash
curl -X PATCH "${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"key":"VAR_NAME","value":"value","is_build_time":false}'
```

⚠️ `is_build_time: true` → nécessite re-build (Coolify re-build image). Sinon update env runtime + restart container.

### Supprimer

```bash
curl -X DELETE "${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}/envs/<env-uuid>" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

### Via UI

Application → Environment Variables → edit / add / delete.

## 5. Restart service

### Restart application

```bash
curl -X POST "${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}/restart" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

### Restart service (postgres / redis / worker)

```bash
curl -X POST "${COOLIFY_API_URL}/api/v1/services/${COOLIFY_REDIS_UUID}/restart" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

### Stop / start

```bash
curl -X POST "${COOLIFY_API_URL}/api/v1/services/${UUID}/stop" -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
curl -X POST "${COOLIFY_API_URL}/api/v1/services/${UUID}/start" -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

## 6. Deploy manuel

### Via GitHub Action (recommandé)

```bash
gh workflow run deploy-coolify.yml --ref main
```

### Via Coolify API direct

```bash
curl -X POST "${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}/deploy" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

### Rollback version précédente

```bash
# Lister deployments
curl -s "${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}/deployments" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" | jq '.[] | {id, status, created_at}'

# Rollback
curl -X POST "${COOLIFY_API_URL}/api/v1/applications/${COOLIFY_APP_UUID}/rollback/{PREVIOUS_DEPLOYMENT_ID}" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

## 7. Snapshot Hetzner pré-modif risquée

> ⚠️ Discipline forte : faire un snapshot AVANT toute migration SQL, rotation de
> secret critique, ou changement d'infra (rescale, volume).

### Lister snapshots

```bash
curl -s "https://api.hetzner.cloud/v1/images?type=snapshot" \
  -H "Authorization: Bearer ${HETZNER_API_TOKEN}" | jq '.images[] | {id, description, created}'
```

### Créer snapshot

```bash
# Server ID = trouver via "axion-ia-prod"
SERVER_ID=$(curl -s "https://api.hetzner.cloud/v1/servers" \
  -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
  | jq -r '.servers[] | select(.name=="axion-ia-prod") | .id')

curl -X POST "https://api.hetzner.cloud/v1/servers/${SERVER_ID}/actions/create_image" \
  -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
  -d '{"type":"snapshot","description":"pre-R<XX>-runbook-'$(date +%Y%m%d-%H%M)'"}'
```

Coût : ~0,01 €/GB/mois (260 GB → ~2,60 €/mois si gardé). Drop quand modif validée stable.

### Restore depuis snapshot

```bash
curl -X POST "https://api.hetzner.cloud/v1/servers/${SERVER_ID}/actions/rebuild" \
  -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
  -d '{"image":<snapshot-id>}'
```

⚠️ Rebuild = perte volume data si non démarré stop+detach. À faire en collaboration avec L2 Hetzner support si production critique.

## 8. Voir resources (RAM/CPU/disk)

### Via SSH

```bash
ssh root@178.105.55.15 "docker stats --no-stream"
ssh root@178.105.55.15 "df -h"
ssh root@178.105.55.15 "free -h"
ssh root@178.105.55.15 "docker system df"
```

### Via Coolify API

```bash
curl -s "${COOLIFY_API_URL}/api/v1/servers/{SERVER_UUID}/usage" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

## 9. App UUID + Service UUIDs (à documenter dans secrets)

| Service                    | UUID                           | Source                                      |
| -------------------------- | ------------------------------ | ------------------------------------------- |
| App axion-ia (Next 16)     | `mqbmlz1bcwsdwi3t9fxsllqt`     | mémoire `axionia_coolify_api_authorization` |
| Postgres                   | `<COOLIFY_POSTGRES_UUID>`      | Coolify UI → Services → Postgres → URL      |
| Redis                      | `<COOLIFY_REDIS_UUID>`         | idem                                        |
| Worker (si service séparé) | `<COOLIFY_WORKER_UUID>`        | idem                                        |
| Plausible                  | `<PLAUSIBLE_UUID>`             | idem                                        |
| Uptime Kuma                | `<UPTIME_KUMA_UUID>`           | idem                                        |
| Caddy                      | géré par Coolify proxy interne | n/a                                         |

UUIDs réels à compléter dans `.secrets/api-tokens.env` par Will (action humaine, hors versionnement).

## 10. Récupérer token API si perdu

⚠️ Tokens Sanctum Coolify v4 : **plaintext shown ONCE**. Si perdu :

1. Coolify UI → Settings → API tokens → Revoke ancien.
2. Generate new → copier immédiatement dans `.secrets/api-tokens.env`.
3. Update Memory `axionia_infra_tokens_pointer` si format changé.
4. Documenter rotation dans `_AUDIT/SECRETS-ROTATION-LOG.md`.

## 11. Limitations / Bugs connus

- Coolify v4 API pas 100 % stable — certains endpoints `/api/v2/...` plus fiables (vérifier docs Coolify courantes).
- Webhook GitHub App parfois invalid signature (mémoire `axionia_session_2026-05-09_cloudflare_postdeploy_incident`). Workaround : GitHub Actions → API direct (mémoire `axionia_cicd_github_actions_coolify`).
- `is_build_time` env vars nécessitent full re-build → planifier en off-hours.
- Logs API limit ~5 000 lignes — utiliser SSH pour historique long.

## Liens

- Mémoire `axionia_coolify_api_authorization` — autorisation permanente Will
- Mémoire `axionia_infra_tokens_pointer` — emplacement secrets
- Mémoire `axionia_cicd_github_actions_coolify` — workflow CI/CD
- Mémoire `axionia_session_2026-05-09_stabilisation_complete` — lessons learned
- ADR 0009 — hosting Hetzner CPX32/42 + Coolify
- Docs Coolify v4 : https://coolify.io/docs/
