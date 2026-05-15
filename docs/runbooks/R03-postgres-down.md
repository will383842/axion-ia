# R03 — Postgres down (DB indisponible)

- **Code** : R03
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique**
- **Impact si non traité** : site DOWN. Tous workers (content-gen, booking, KB) crash. Healthz 503.

## Trigger

- `curl https://axion-ia.com/api/healthz` → `db: "error"` ou timeout.
- Sentry spike erreurs Prisma `Can't reach database server`.
- Telegram Uptime Kuma `Postgres TCP DOWN`.

## Prérequis

- SSH `root@178.105.55.15` (Hetzner CPX42).
- Coolify dashboard pour restart service.
- Backups Hetzner Storage Box (cf. R22 restore drill).

## Étapes

### 1. Diagnostiquer (60 secondes)

```bash
ssh root@178.105.55.15 "docker ps | grep postgres"
# Attendu : axion-ia-postgres-prod Up X minutes

ssh root@178.105.55.15 "docker logs --tail 50 axion-ia-postgres-prod"
# Chercher : ERROR, FATAL, "out of memory", "could not bind"
```

### 2. Restart container Postgres (si pas crash loop)

```bash
docker restart axion-ia-postgres-prod
# Attendre 15s
docker exec axion-ia-postgres-prod pg_isready -U axion_ia
# Attendu : accepting connections
```

### 3. Restart via Coolify API (si SSH inaccessible)

```bash
curl -X POST "http://178.105.55.15:8000/api/v1/services/{POSTGRES_UUID}/restart" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

`POSTGRES_UUID` documenté dans `coolify-procedures.md` + `.secrets/api-tokens.env`.

### 4. Si corruption / crash loop → restore depuis backup

→ Bascule sur **R22 restore drill** ou `docs/ops/runbook-incident.md` §4.2.

### 5. Re-démarrer workers content-gen post-restore

Les workers détectent Postgres up via `prisma.$connect()` retry exponential. Si bloqués :

```bash
docker restart axion-ia-worker-prod
```

### 6. RTO target

- Restart simple : ≤ 2 min
- Restore depuis backup : ≤ 30 min (cf. R22)
- Si > 30 min → notifier CNIL (RGPD Art. 32) si données users impactées.

## Vérifications post-fix

- [ ] `curl https://axion-ia.com/api/healthz | jq .db` → `"ok"`.
- [ ] Worker logs : 3 jobs consécutifs OK post-restart.
- [ ] `/fr/{ADMIN_URL_PREFIX}/content-gen` dashboard charge sans erreur.
- [ ] Aucune nouvelle Sentry erreur Prisma dans les 5 min suivantes.

## Rollback

Pas de rollback Postgres restart (idempotent). Si restore depuis backup → rollback = restore d'un backup plus récent encore.

## Escalation

| Niveau | Contact         | Quand                                      |
| ------ | --------------- | ------------------------------------------ |
| L1     | Will            | toujours (P0 site DOWN)                    |
| L2     | Hetzner support | si hardware fault / disk full hôte         |
| L3     | DPO             | si downtime > 4h ou données perdues → CNIL |

## Liens

- Legacy : `docs/ops/runbook-incident.md` §4 (corruption + restore détaillé)
- R22 — restore drill trimestriel
- `coolify-procedures.md` — UUIDs services + API
- ADR 0009 — hosting Hetzner CPX32 (rescale CPX42 cf. mémoire `axionia_hosting_hetzner`)
