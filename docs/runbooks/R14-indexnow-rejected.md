# R14 — IndexNow ping rejected (key invalide)

- **Code** : R14
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟡 **P1 — important** (SEO impact différé)
- **Impact si non traité** : Bing/Yandex/Google ne reçoivent plus les notifs URLs neuves/modifiées → délai indexation 7-30j au lieu de < 24h.

## Trigger

- Worker logs `content-indexnow-worker` : `api.indexnow.org 403 invalid key`.
- Sentry alert IndexNow worker fail rate > 50 % sur 1 h.
- Manual check : `curl https://www.bing.com/indexnow?url=https://axion-ia.com&key=...` retourne 403.

## Prérequis

- Accès Coolify env vars (token cf. `coolify-procedures.md`).
- Accès file system Coolify pour `public/{INDEXNOW_KEY}.txt`.
- Connaissance helper centralisé `src/lib/seo/indexnow.ts` (commit `b7cbfb4` mémoire `axionia_session_2026-05-13_seo_email_stack`).

## Étapes

### 1. Vérifier key actuelle

```bash
# Env Coolify
curl -s "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" | jq '.[] | select(.key == "INDEXNOW_KEY")'

# Fichier public correspondant
curl -fsS "https://axion-ia.com/${INDEXNOW_KEY}.txt"
# Doit retourner exactement INDEXNOW_KEY (raw text, pas HTML)
```

Causes possibles :

- Fichier `public/{key}.txt` absent ou contenu ≠ key.
- Key révoquée côté Bing (rare).
- Caractères non hex dans la key.

### 2. Régénérer key (32 chars hex)

```bash
# Génération
INDEXNOW_KEY_NEW=$(openssl rand -hex 16)
echo "New key: ${INDEXNOW_KEY_NEW}"
```

### 3. Update env Coolify

```bash
curl -X PATCH "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"INDEXNOW_KEY\",\"value\":\"${INDEXNOW_KEY_NEW}\"}"
```

### 4. Update fichier public

Le fichier `public/{INDEXNOW_KEY}.txt` est servi via Next.js `app/` route ou fichier statique. Vérifier la stratégie :

```bash
# Option A : route dynamique
grep -rn "INDEXNOW_KEY" axionia/src/app
# Si existe → revalidatePath après update env → Coolify auto-rebuild
```

```bash
# Option B : fichier statique committed
ls axionia/public/*.txt
# Si fichier nommé avec ancienne key → rename via commit
```

Workflow option B :

```bash
cd axionia
git mv public/${INDEXNOW_KEY_OLD}.txt public/${INDEXNOW_KEY_NEW}.txt
echo "${INDEXNOW_KEY_NEW}" > public/${INDEXNOW_KEY_NEW}.txt
git add -A
git commit -m "chore(seo): rotate INDEXNOW_KEY (R14 runbook)"
git push origin main
# Coolify auto-deploy
```

### 5. Re-déclencher batch indexnow-worker

```bash
docker exec axion-ia-worker-prod node -e "
  const { Queue } = require('bullmq');
  const q = new Queue('content-indexnow', { connection: { url: process.env.REDIS_URL } });
  q.add('retry-failed-after-rotation', { all: true });
"
```

Ou via admin (si UI Sprint 4 expose retry batch).

### 6. Vérifier ping OK

```bash
curl -fsS "https://www.bing.com/indexnow?url=https%3A%2F%2Faxion-ia.com%2Ffr&key=${INDEXNOW_KEY_NEW}"
# Attendu : 200 OK + body vide
```

## Vérifications post-fix

- [ ] `curl https://axion-ia.com/{INDEXNOW_KEY_NEW}.txt` retourne 200 + key exacte.
- [ ] Bing ping retourne 200 (pas 403).
- [ ] Worker `content-indexnow-worker` logs : 5 pings successifs OK.
- [ ] Plus d'alerte Sentry sur worker indexnow dans la prochaine heure.

## Rollback

⚠️ Difficile — l'ancienne key est révoquée côté Bing après update. En cas d'erreur :

1. Restaurer ancienne key env Coolify + ancien fichier public.
2. Re-vérifier `curl /{old}.txt` retourne 200.
3. Si Bing a déjà cache l'ancienne key comme invalide, attendre 24h ou re-rotater proprement.

## Escalation

| Niveau | Contact                  | Quand                     |
| ------ | ------------------------ | ------------------------- |
| L1     | Will                     | toujours (impact SEO)     |
| L2     | Microsoft Bing Webmaster | support indexnow protocol |

## Liens

- Code : `src/lib/seo/indexnow.ts` (helper centralisé, commit `b7cbfb4`)
- Code : `src/server/queue/workers/content-indexnow-worker.ts`
- Mémoire `axionia_session_2026-05-13_seo_email_stack` — fix bug urls/urlList
- Master prompt § 9.8 (indexation perfection 2026)
