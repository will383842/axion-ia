# R16 — Telegram bot token révoqué / invalide

- **Code** : R16
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟡 **P1 — important** (observabilité perdue)
- **Impact si non traité** : Will perd toutes les alertes (cost cap, KB not ready, deploy, incidents, web vitals). Sentry capture toujours mais sans push notification.

## Trigger

- Aucune alerte Telegram reçue depuis > 1h (Will remarque).
- App logs : `Telegram API 401 Unauthorized` ou `403 chat not found`.
- Test manuel : `curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe` → 401.

## Prérequis

- Accès `@BotFather` Telegram (créateur du bot, login Will).
- Accès Coolify env vars (token + chat_id).
- Connaissance `TELEGRAM_BOT_TOKEN` actuel + `TELEGRAM_CHAT_ID`.

## Étapes

### 1. Vérifier état du token

```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | jq .
# Attendu : { "ok": true, "result": { "id": ..., "username": "axion_ia_bot" } }
# Si 401 → token révoqué
# Si 200 mais aucune alerte → chat_id KO
```

### 2. Régénérer token via @BotFather

1. Telegram app → conversation `@BotFather`
2. `/mybots` → choisir `axion_ia_bot`
3. `API Token` → `Revoke current token` → confirme
4. Nouveau token affiché : `<NEW_TOKEN>`

### 3. Update env Coolify

```bash
curl -X PATCH "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -d "{\"key\":\"TELEGRAM_BOT_TOKEN\",\"value\":\"<NEW_TOKEN>\"}"
```

⚠️ N'oublier pas le worker (même env vars) :

```bash
# Si worker app a env séparé
curl -X PATCH "http://178.105.55.15:8000/api/v1/services/{WORKER_UUID}/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -d "{\"key\":\"TELEGRAM_BOT_TOKEN\",\"value\":\"<NEW_TOKEN>\"}"
```

Coolify auto-redeploy l'app + worker.

### 4. Update Uptime Kuma + Sentry webhook (configs externes)

- **Uptime Kuma** : `https://uptime.axion-ia.com` → Settings → Notifications → Telegram → update token.
- **Sentry webhook** (cf. `runbook-monitoring.md` §1) : Sentry → Project → Alerts → règle Telegram → édit URL avec nouveau token.

### 5. Test envoi

```bash
curl -X POST "https://api.telegram.org/bot${NEW_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟢 [TEST] Token rotated $(date +%Y-%m-%d_%H:%M)"
# Attendu : 200 + message reçu chez Will
```

### 6. Sauvegarder nouveau token

```bash
# Mettre à jour .secrets/api-tokens.env (machine Will, gitignored)
echo "TELEGRAM_BOT_TOKEN=<NEW_TOKEN>" >> /chemin/Axion-IA/.secrets/api-tokens.env
```

## Vérifications post-fix

- [ ] `curl getMe` retourne 200.
- [ ] Test message reçu Telegram.
- [ ] App envoie 1 alerte de routine dans l'heure suivante (ex : `[ℹ️ REVIEW]` ou `[BACKUP]`).
- [ ] Uptime Kuma + Sentry alertes test reçues.

## Rollback

- Token précédent est révoqué côté Telegram → pas de rollback simple.
- Si nouveau token compromis dans la foulée → re-rotater immédiatement (§2).

## Escalation

| Niveau | Contact | Quand                              |
| ------ | ------- | ---------------------------------- |
| L1     | Will    | toujours (Will = owner @BotFather) |

## Liens

- Mémoire `axionia_will_decisions_2026-05-09` — "pas de rotation pour l'instant" (à reconsidérer mensuel post-V1)
- R24 — SOP rotation préventive
- `runbook-monitoring.md` §4 (Telegram alert hub)
- Code : `src/lib/telegram.ts`
