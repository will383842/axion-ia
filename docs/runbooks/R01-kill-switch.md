# R01 — Kill switch d'urgence content-gen

- **Code** : R01
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique**
- **Impact si non traité** : génération non maîtrisée (provider IA hacké → leak credentials, coût qui explose au-delà du cap, ou doctrine massive violée → publication SIREN/agence/formation interdite à grande échelle).

## Trigger — quand activer ce runbook

- Alerte Telegram `[🔴 COÛT 100 %]` (déclenchée par `cost-tracker.ts` — kill switch auto déjà engagé, valider quand même).
- Alerte Sentry "Provider API key compromised" / leak credentials détecté GitGuardian.
- Audit manuel observe ≥ 5 articles publiés avec SIREN/"agence"/"formation" en < 1h.
- Will reçoit notification facturation provider > $50/h.
- Suspicion de boucle infinie content-quality-improver consommant tokens.

## Prérequis

- Accès Coolify dashboard `http://178.105.55.15:8000` (token dans `.secrets/api-tokens.env`).
- Accès admin Axion-IA `/fr/{ADMIN_URL_PREFIX}/content-gen/settings/kill-switch`.
- Postgres SSH access via `docker exec axion-ia-postgres-prod psql -U axion_ia`.

## Étapes (action immédiate)

### 1. Engager kill switch admin UI (10 secondes)

```
https://axion-ia.com/fr/{ADMIN_URL_PREFIX}/content-gen/settings/kill-switch
→ bouton "Engage kill switch"
→ Server Action `engageKillSwitchAction` (src/server/actions/content-gen/kill-switch.ts)
```

Effet immédiat :

- `ContentGenConfig` clé `kill_switch` → `true`
- Tous workers content-gen-worker checkent ce flag avant chaque job (`assertKillSwitchInactive`)
- Jobs en cours laissés finir (graceful), nouveaux jobs rejetés.

### 2. Si admin UI inaccessible — fallback DB direct

```bash
ssh root@178.105.55.15
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  INSERT INTO \"ContentGenConfig\" (key, \"valueJson\", \"createdAt\", \"updatedAt\")
  VALUES ('kill_switch', '{\"engaged\":true,\"reason\":\"R01-manual-$(date +%Y%m%d-%H%M)\"}', NOW(), NOW())
  ON CONFLICT (key) DO UPDATE
  SET \"valueJson\" = EXCLUDED.\"valueJson\", \"updatedAt\" = NOW();
"
```

### 3. Stop workers Coolify (si suspicion compromise > kill switch logique)

```bash
# Via Coolify API (cf. coolify-procedures.md)
curl -X POST "http://178.105.55.15:8000/api/v1/services/{WORKER_UUID}/stop" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"

# OU SSH direct
ssh root@178.105.55.15 "docker stop axion-ia-worker-prod"
```

### 4. Si provider IA compromis — révoquer clé immédiatement

```
- OpenAI : https://platform.openai.com/api-keys → bouton "Revoke"
- Anthropic : https://console.anthropic.com/settings/keys → "Disable"
- Perplexity : https://www.perplexity.ai/settings/api → "Delete"
- Unsplash : https://unsplash.com/oauth/applications → "Reset secret"
- Voyage AI : https://dash.voyageai.com/api-keys → "Delete"
```

Puis update env var Coolify (cf. `coolify-procedures.md` §4) avec nouvelle clé.

### 5. Notifier Telegram statut

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🔴 [INCIDENT] Kill switch content-gen ENGAGED ($(date +%H:%M)) — raison : <cost|doctrine|leak>"
```

## Vérifications post-fix

- [ ] `ContentGenConfig.kill_switch.engaged === true` (vérif via admin UI ou `psql`).
- [ ] `/fr/{ADMIN_URL_PREFIX}/content-gen` dashboard affiche bandeau rouge "Kill switch engaged".
- [ ] Worker logs (`docker logs --tail 50 axion-ia-worker-prod`) montrent `[content-gen-worker] kill-switch engaged, skipping job` sur les jobs poppés.
- [ ] BullMQ queue `content-gen` accumule en `waiting` mais aucun `active` ne progresse.
- [ ] Aucun nouvel `Article` créé en DB dans les 5 min suivant l'activation :
  ```sql
  SELECT COUNT(*) FROM "Article" WHERE "createdAt" > NOW() - INTERVAL '5 minutes';
  ```

## Rollback — désactiver kill switch proprement

⚠️ **Seulement après** investigation root cause + correction du problème.

### 1. Désactiver via admin UI

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/kill-switch
→ bouton "Release kill switch"
→ champ obligatoire "Reason for release" (audit trail)
```

### 2. Vérifier audit log

```sql
SELECT * FROM "KnowledgeAuditLog"
WHERE "eventKind" IN ('kill_switch_engaged', 'kill_switch_released')
ORDER BY "createdAt" DESC LIMIT 10;
```

### 3. Re-démarrer workers si stoppés

```bash
curl -X POST "http://178.105.55.15:8000/api/v1/services/{WORKER_UUID}/start" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

### 4. Test smoke (1 job manuel)

```
/fr/{ADMIN_URL_PREFIX}/content-gen → bouton "Générer landing ville…"
→ choisir Lyon (ou ville-test)
→ vérifier que job traverse complet : queued → running → published
```

### 5. Notifier Telegram

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟢 [INCIDENT] Kill switch content-gen RELEASED ($(date +%H:%M)) — fix : <résumé>"
```

## Escalation

| Niveau    | Contact                               | Quand                                                                                         |
| --------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| L1        | Will (`williamsjullin@gmail.com`)     | toujours en premier                                                                           |
| L2        | Coolify support `support@coollabs.io` | si worker ne stoppe pas / API token KO                                                        |
| L3        | Provider IA support                   | OpenAI : help.openai.com · Anthropic : support@anthropic.com · Perplexity : api@perplexity.ai |
| L4 (RGPD) | DPO `contact@axion-ia.com`            | si leak credentials touche données utilisateurs → CNIL 72h                                    |

## Liens

- ADR 0021 — Content Generator V1 skeleton vs deep impl
- Master prompt § 12.3bis (alertes Telegram) + § 13.3 (monitoring)
- Mémoire `axionia_coolify_api_authorization` — autorisation API Coolify
- Code : `src/server/content-gen/lib/cost-tracker.ts` (auto-trigger sur cost cap 100 %)
- Code : `src/server/actions/content-gen/kill-switch.ts` (Server Actions admin)
- Code : `src/lib/knowledge/kill-switch.ts` (helper `assertKillSwitchInactive`)
