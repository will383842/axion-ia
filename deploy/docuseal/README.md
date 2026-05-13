# Déploiement DocuSeal sur Coolify

Sprint X.3 — Booking V1 (ADR 0014).

DocuSeal self-hosted en mode SQLite embarqué — zero-config, monté sur un volume
persistent côté Coolify. À provisionner **une seule fois** dans l'UI Coolify.

---

## Étape 1 — Créer le service Coolify (5 min)

1. Va sur `http://178.105.55.15:8000` (Coolify UI)
2. **Project** `axion-ia` → onglet **Resources** → **+ New** → **Service** → **Docker Compose**
3. **Name** : `docuseal`
4. **Description** : `Signature électronique self-hosted (Booking V1)`
5. **Server** : `localhost` (le seul existant)
6. **Environment** : `production`
7. Colle le contenu de [`docker-compose.yml`](./docker-compose.yml) dans le champ Compose Editor
8. Clique **Save**

## Étape 2 — Configurer le domaine (2 min)

1. Onglet **Domains** du service docuseal qui vient d'être créé
2. Ajoute : `https://docuseal.axion-ia.com`
3. Clique **Save**
   → Coolify expose la variable `SERVICE_FQDN_DOCUSEAL=docuseal.axion-ia.com` au container.

## Étape 3 — Générer SECRET_KEY_BASE (1 min)

1. Onglet **Environment Variables** du service docuseal
2. Ajoute :
   ```
   SECRET_KEY_BASE=<64 caractères hex aléatoires>
   ```
   Génère localement :
   ```bash
   openssl rand -hex 32
   # ou en PowerShell :
   # -join ((1..64) | ForEach {'0123456789abcdef'[(Get-Random -Max 16)]})
   ```
3. Clique **Save**

## Étape 4 — DNS Cloudflare (3 min)

1. Va sur `https://dash.cloudflare.com` → zone `axion-ia.com` → **DNS**
2. **+ Add record**
3. **Type** : `A`
4. **Name** : `docuseal`
5. **IPv4** : `178.105.55.15` (IP VPS Hetzner)
6. **Proxy status** : `DNS only` (gris) — Let's Encrypt HTTP-01 challenge a besoin
   d'accès direct port 80 sans CF proxy au moment de la délivrance du cert.
7. **TTL** : `Auto`
8. **Save**

Une fois le SSL délivré (~30s à 2 min après le Deploy de l'étape 5),
tu pourras repasser sur **Proxied** (orange) pour profiter du cache + WAF.

## Étape 5 — Déployer (1 min)

1. Retour onglet **Deploy** du service docuseal
2. Clique **Deploy** (bouton vert)
3. Attends ~2 min :
   - Pull image `docuseal/docuseal:latest` (~ 300 MB)
   - Init SQLite + run migrations
   - Healthcheck `wget /up` → 200
4. **Verify** : `curl -I https://docuseal.axion-ia.com/up` doit retourner `200 OK`

## Étape 6 — Créer compte admin DocuSeal (2 min)

1. Va sur `https://docuseal.axion-ia.com`
2. Page d'accueil → **Sign up** (premier user = admin automatique)
3. Email : `contact@axion-ia.com` (boîte Zoho Mail active)
4. Password : génère un strong password (>16 chars) et stocke-le dans `.secrets/`
5. **Save** — tu es admin.

## Étape 7 — Générer API token pour Axion-IA app (1 min)

1. DocuSeal UI → **API & Settings** → **API**
2. Copier l'**Auth Token** affiché
3. Le rajouter dans `.secrets/api-tokens.env` :
   ```
   DOCUSEAL_API_KEY='ds_xxxxxxxxxxxx'
   ```

## Étape 8 — Configurer webhook DocuSeal → Axion-IA (3 min)

1. DocuSeal UI → **Settings** → **Webhooks**
2. **+ Add webhook**
3. **URL** : `https://axion-ia.com/api/docuseal/webhook`
4. **Events** : cocher
   - `form.viewed`
   - `form.started`
   - `form.completed`
   - `form.declined`
   - `submission.completed`
   - `submission.expired`
5. **Secret** : génère avec `openssl rand -hex 32` — c'est la valeur de
   `DOCUSEAL_WEBHOOK_SECRET` côté Axion-IA. Note-la dans `.secrets/`.
6. **Save**

## Étape 9 — Configurer env vars côté app axion-ia (2 min)

Dans **Coolify UI** → app `axion-ia` (UUID `mqbmlz1bcwsdwi3t9fxsllqt`) → **Environment Variables** :

```
DOCUSEAL_BASE_URL=https://docuseal.axion-ia.com
DOCUSEAL_API_KEY=<token étape 7>
DOCUSEAL_WEBHOOK_SECRET=<secret étape 8>
```

Clique **Save** → **Restart** l'app pour appliquer.

## Étape 10 — Vérification end-to-end (2 min)

```bash
# 1. App health (devrait toujours être OK même sans DocuSeal)
curl -s https://axion-ia.com/api/healthz | jq

# 2. DocuSeal up
curl -I https://docuseal.axion-ia.com/up

# 3. Webhook endpoint répond (devrait être 401 sans signature, jamais 503)
curl -X POST https://axion-ia.com/api/docuseal/webhook \
  -H 'content-type: application/json' \
  -d '{"event_id":"test","event_type":"form.viewed"}' -v
# Attendu : HTTP 401 invalid_signature → OK le wiring marche
```

---

## Rollback

Si quelque chose foire :

1. Coolify UI → service `docuseal` → **Stop** (le container s'arrête, le volume reste)
2. Code-side : tout fonctionne sans DocuSeal grâce à `isDocusealConfigured()` qui
   retourne `false` quand les env vars sont absentes. Les Server Actions
   fallback en mode hybride manuel (admin upload PDF signé physiquement).
3. Pour purger complètement : **Delete** le service Coolify + **rm volume** docuseal-data.

---

## Maintenance

- **Backup** : volume `docuseal-data` contient SQLite + PDFs signés. À ajouter
  au cron Cloudflare R2 backup (cf. `scripts/backup-db.sh` Sprint 22).
- **Mise à jour** : DocuSeal release notes sur GitHub. Bump via Coolify
  **Redeploy** (re-pull `latest`) après revue ADR si breaking change.
- **Monitoring** : ajouter `https://docuseal.axion-ia.com/up` à UptimeRobot
  (token déjà dans `.secrets/api-tokens.env`).
- **Rotation secrets** : `SECRET_KEY_BASE` invalide les sessions admin si rotaté.
  `DOCUSEAL_WEBHOOK_SECRET` rotation = recopier nouvelle valeur 2 endroits
  (DocuSeal UI + env app).
