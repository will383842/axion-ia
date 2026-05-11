# PLAN D'ACTION POST-DEPLOY V2 — Axion-IA

**Créé** : 2026-05-09
**Contexte** : V2 (commit `d98a8c1`) déployée avec patches lazyConnect Redis + Dockerfile HEALTHCHECK + CI gate-c-docker + COEP credentialless. Suite à 5h de session de débuggage prod.
**Objectif** : faire passer Axion-IA de "ça marche" à "robuste palier 2/4" en suivant un plan séquentiel concret.

---

## 🎯 OÙ ON EN EST

✅ HTTPS UP sur `https://axion-ia.com` (Let's Encrypt R13, valide 9 mai → 7 août 2026, auto-renew Traefik)
✅ Container boot OK (lazyConnect Redis, healthcheck natif Dockerfile)
✅ Pages s'affichent (COEP `credentialless` après deploy `d98a8c1`)
✅ CI gate-c-docker actif (filet smoke test)
⚠️ Redis `status: "error"` → `REDIS_URL` à updater avec bon password
⚠️ Cloudflare en DNS only gris (perfs sub-optimales, pas de DDoS protection)
❌ Pas d'uptime monitor externe
❌ Pas d'alertes Sentry actives
❌ Backups DB jamais testés en restore

**Score reliability estimé** : ~280/600 (cible robuste 480/600).

---

## 📍 PHASE 1 — MAINTENANT (~30 min, finir la session courante)

### 1.1 Vérifier le deploy `d98a8c1`

**Goal** : confirmer que le fix COEP est bien live.

**Steps** :

1. Coolify → app `axion-ia-web` → onglet **Deployments**
2. Vérifier qu'un deploy avec commit `d98a8c1` est `Success` (et pas `Failed` ou `In Progress`)
3. Si pas démarré : clic **Redeploy** manuellement (le webhook GitHub a foiré 2× cette session, bug Coolify connu)
4. Vérifier le header live :
   ```bash
   curl -sI -k https://axion-ia.com/fr | grep -i "cross-origin-embedder"
   ```
   Doit afficher : `Cross-Origin-Embedder-Policy: credentialless`

**Verification** :

- Reload `https://axion-ia.com/fr` dans navigateur → contenu **entier** visible (pas juste header)
- Inspect F12 → onglet Console → 0 erreur "blocked by COEP"

⏱️ **5 min** + temps build (~5 min)

---

### 1.2 Update `REDIS_URL` avec bon password

**Goal** : faire marcher Redis (login admin, rate limit, queues d'emails).

**Pourquoi** : actuellement `/api/healthz` renvoie `"redis": "error"` — le password REDIS_URL a été mal lu depuis screenshot (chars `l/I` et `0/O` ambigus).

**Steps** :

1. Coolify → app `axion-ia-web` → menu **Environment Variables**
2. Trouver la ligne `REDIS_URL`
3. **Edit** → remplacer la valeur par exactement :
   ```
   redis://default:ITIt4N2p1pvPOPMXurMBYDrV8e1OtBjbz7OEO6Zbpgp8jw8o0kZfYS9eUyA0zh68@hdfknlij6yqebr09p379m9q6:6379/0
   ```
   ⚠️ Copy-paste depuis ce fichier, **PAS** depuis screenshot.
4. Cocher **Is Secret** (masque dans l'UI)
5. **Save**
6. Bouton **Redeploy** sur axion-ia-web

**Verification** :

```bash
curl -s -k https://axion-ia.com/api/healthz
```

Doit afficher : `"status":"ok","redis":"ok"` (au lieu de `"degraded"` + `"redis":"error"`).

⏱️ **2 min** + redeploy 5-8 min

---

### 1.3 Commit le prompt audit + plans d'action

**Goal** : versionner les docs d'aujourd'hui pour que tu puisses les retrouver.

**Steps** :

```bash
cd C:\Users\willi\Documents\Projets\Axion-IA\axionia
git add _AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md _AUDIT/PLAN-ACTION-POST-DEPLOY-V2.md _AUDIT/PLAN-CLOUDFLARE-PHASE-5.md
git commit -m "docs(ops): add deploy reliability prompt v1.1 + action plans post-V2"
git push
```

**Verification** : `git log --oneline -1` montre le commit.

⏱️ **2 min**

---

## 🟡 PHASE 2 — CE WEEK-END (~3-4h, dormir tranquille)

### 2.1 Cloudflare Phase 5 — bascule en proxy orange

**Goal** : site 2-5x plus rapide pour les visiteurs hors France + protection DDoS gratuite.

**Pourquoi** : actuellement Cloudflare est en DNS only (gris) — il ne fait QUE résoudre le DNS, sans cache CDN ni protection. Tu paies déjà 0 € pour le plan Free, autant l'activer.

**Steps détaillés** : voir fichier dédié `_AUDIT/PLAN-CLOUDFLARE-PHASE-5.md`

**Verification** :

- `curl -sI https://axion-ia.com/fr | grep -i cf-cache-status` → doit afficher `HIT` ou `DYNAMIC`
- `curl -sI https://axion-ia.com/fr | grep -i alt-svc` → doit afficher `h3=":443"` (HTTP/3 actif)
- Reload site depuis VPN US/Asie → TTFB <100ms (vs 600ms+ avant)

⏱️ **30 min**

---

### 2.2 Installer Uptime Kuma

**Goal** : être notifié dans la minute si le site tombe.

**Pourquoi** : si ton VPS crash entièrement, Sentry ne peut pas alerter (il est sur le même VPS). Uptime Kuma est un monitor externe (ou peut être hosté ailleurs si tu veux paranoia level).

**Steps** :

1. Coolify → ton Project → bouton **+ New Resource**
2. Choisir **Docker Image** (custom)
3. Image name : `louislam/uptime-kuma:1`
4. Port : `3001` (par défaut Uptime Kuma)
5. Volume persistant : monter `/app/data` sur volume nommé (`uptime-kuma-data`)
6. Domains : `https://uptime.axion-ia.com` (ajouter sous-domaine dans Cloudflare DNS)
7. Deploy
8. Une fois UP, accéder à `https://uptime.axion-ia.com` → setup admin (user/pass)
9. **Add New Monitor** :
   - Type : HTTP(s) — Keyword
   - Name : `axion-ia-prod-healthz`
   - URL : `https://axion-ia.com/api/healthz`
   - Heartbeat Interval : `60` seconds
   - Retries : `2`
   - Keyword : `"status":"ok"` (cherche cette string dans la réponse)
10. **Setup Notifications** → Telegram (créer bot via @BotFather, copier token + chat ID) ou email

**Verification** :

- Stop manuellement axion-ia-web container → tu reçois notif Telegram dans <2 min
- Restart → tu reçois "back to up"

⏱️ **45 min** dont 15 min pour setup Telegram bot

---

### 2.3 Configurer alertes Sentry

**Goal** : être notifié quand des erreurs runtime arrivent en prod.

**Pourquoi** : Sentry est installé (`@sentry/nextjs` 10.51.0) mais aucune rule active = aucune notif. Une erreur peut s'accumuler des jours sans que tu le saches.

**Steps** :

1. Sentry self-hosted (sur ton VPS) ou Sentry cloud SaaS (à confirmer où c'est hosté)
2. Login → Project `axion-ia` → **Alerts** → **New Alert Rule**
3. Configuration :
   - **Trigger** : "When an issue is created"
   - OU "When an issue happens X times in Y minutes" (X=5, Y=1)
   - **Filter** : Environment = production
   - **Action** : Send notification → Telegram webhook (utilise le même bot que Uptime Kuma)
4. Save

**Verification** :

- Trigger une erreur volontaire en prod (ex : une route qui throw) → notif Telegram dans <30s
- Vérifier dans Sentry dashboard que l'issue apparaît avec stack trace

⏱️ **20 min**

---

### 2.4 Test restore backup DB une fois

**Goal** : prouver que tes backups sont restaurables — sans ça, tu as un faux sentiment de sécurité.

**Pourquoi** : tu as `BACKUP_ENCRYPTION_PASSPHRASE` set, mais rien ne prouve que :

- Le cron Hetzner Storage tourne réellement
- Les backups sont chiffrés correctement (et déchiffrables)
- La structure DB est restaurable
- La passphrase est bien la bonne

**Steps** :

1. SSH sur VPS Hetzner (ou Terminal Coolify)
2. Vérifier qu'un backup existe :
   ```bash
   ls -lh /var/backups/ 2>/dev/null || ls -lh ~/backups/ 2>/dev/null
   ```
   (Adapter le path selon où le script `backup-postgres.sh` écrit)
3. Si pas de backup local : vérifier sur Hetzner Object Storage via `s3cmd ls` ou interface web Hetzner
4. Pull dernier backup (extension probable : `.sql.gz.enc` ou `.dump.enc`)
5. Décrypter :
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -in backup.sql.gz.enc -out backup.sql.gz \
     -pass pass:"$BACKUP_ENCRYPTION_PASSPHRASE"
   ```
6. Décompresser : `gunzip backup.sql.gz`
7. Lancer Postgres temporaire :
   ```bash
   docker run -d --name pg-test -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:15-alpine
   sleep 5
   ```
8. Restore :
   ```bash
   docker exec -i pg-test psql -U postgres < backup.sql
   ```
9. Vérifier intégrité :
   ```bash
   docker exec pg-test psql -U postgres -c "\dt"
   docker exec pg-test psql -U postgres -c "SELECT count(*) FROM \"User\";"  # ou autre table connue
   ```
10. Cleanup :
    ```bash
    docker rm -f pg-test
    rm backup.sql backup.sql.gz
    ```

**Verification** :

- Toutes les tables attendues sont présentes
- Le count d'au moins une table est cohérent avec la prod
- Tu peux mettre à jour une mémoire interne : "DR test passed 2026-05-XX"

**Si ça foire** :

- Backup absent → cron pas configuré → fix dans Coolify cron jobs ou crontab VPS
- Décryption échoue → mauvaise passphrase → vérifier dans `.secrets-coolify/axion-ia-prod-env.txt`
- Restore échoue → schema incompatible → investigate

⏱️ **1h** dont 20 min de check par requêtes

---

### 2.5 Activer Cloudflare DNSSEC

**Goal** : protéger ton domaine contre DNS hijacking / poisoning.

**Pourquoi** : sans DNSSEC, quelqu'un peut potentiellement faire pointer `axion-ia.com` vers un autre serveur (cache poisoning). Avec DNSSEC, c'est cryptographiquement signé.

**Steps** :

1. Cloudflare → **DNS** → **Settings** (en haut à droite)
2. Section **DNSSEC** → toggle **Enable DNSSEC**
3. Cloudflare affiche un **DS record** (Digest, Algorithm, Public Key, etc.)
4. Note : copier la valeur du DS record
5. Aller chez **Namecheap** → Domain List → axion-ia.com → **Manage** → onglet **Advanced DNS**
6. Section **DNSSEC** → **Add DS record**
7. Coller les valeurs depuis Cloudflare :
   - Key Tag
   - Algorithm
   - Digest Type
   - Digest
8. Save Namecheap
9. Retour Cloudflare → bouton **Verify DS record** (peut prendre 24h)

**Verification** :

```bash
dig +dnssec axion-ia.com | grep -i RRSIG
```

Doit afficher des records signés.

Ou via web : https://dnssec-analyzer.verisignlabs.com/axion-ia.com

⏱️ **15 min** + 24h propagation

---

## 🟠 PHASE 3 — CETTE SEMAINE (~6-8h, audit dirigé partiel)

### 3.1 Lance l'audit reliability — 3 agents prioritaires

**Goal** : trouver et fixer les ~15 trous P0/P1 critiques restants.

**Pourquoi** : on a fixé 6 bugs aujourd'hui mais il y en a probablement d'autres similaires (eager inits, observability gaps, security holes).

**Phrase d'invocation** (dans une **nouvelle session Claude** pour contexte clean) :

> Lance les Agents 1, 5, 6 du prompt `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md`. Phase 1 lecture-seule, livrables séparés `_AUDIT/RELIABILITY-2026/01-eager-inits.md`, `05-observability.md`, `06-security.md`. STOP & ASK avant Phase 3 patches.

**Pourquoi ces 3 agents en priorité** :

- **Agent 1 (Eager Inits)** : trouver tous les bugs comme `lib/redis.ts` qu'on n'a pas encore vus
- **Agent 5 (Observability + DR)** : étendre Sentry alerts + automatiser restore test + écrire runbook
- **Agent 6 (Security)** : headers HTTP corrects + Renovate + scan vuln (trivy)

**Output attendu** :

- 3 livrables Markdown dans `_AUDIT/RELIABILITY-2026/`
- Score partiel /300 (3 agents × /100)
- Liste P0 + patches diff prêts

⏱️ **6-8h** dont 4h LLM + 2-4h toi pour valider

---

### 3.2 Applique les patches P0 trouvés

**Goal** : ferme les trous critiques identifiés.

**Workflow** :

1. Pour chaque P0 listé → branche `chore/reliability-2026-XX`
2. Apply diff fournit par l'agent
3. Push → CI gate-a + gate-b + gate-c-docker doivent pass
4. PR → review → merge
5. Coolify auto-deploy ou Redeploy manuel
6. Vérifier que rien ne casse via `https://axion-ia.com/api/healthz`

**Patches typiquement attendus** (selon ce que l'agent trouve) :

- `chore/reliability-2026-01` : refactor `queues.ts` lazy factories
- `chore/reliability-2026-02` : healthz multi-niveau (liveness/readiness/deep)
- `chore/reliability-2026-03` : SIGTERM handler dans server.js
- `chore/reliability-2026-09` : Renovate config + `pnpm audit` gate CI
- `chore/reliability-2026-10` : Headers HTTP sécurité OWASP 2026
- `chore/reliability-2026-11` : `trivy` scan image dans gate-c-docker
- `chore/reliability-2026-12` : Restore test backup automatisé (cron CI hebdo)
- `chore/reliability-2026-14` : Rate limit middleware Redis-backed sur /api/\*

⏱️ **3-5h** total pour 6-10 patches

---

## 🔵 PHASE 4 — CE MOIS-CI (~12-18h, audit complet + vérification)

### 4.1 Lance les 3 agents restants (2, 3, 4)

**Phrase** :

> Lance les Agents 2, 3, 4 du prompt `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md`.

- **Agent 2 (Resilience)** : circuit breakers, error wrapping
- **Agent 3 (Container)** : image 8.58 GB → < 1.5 GB, Hadolint, perf budgets
- **Agent 4 (CI/CD)** : extension gate-c-docker, env coverage check, staging.yml

⏱️ **6-8h LLM + 2-4h toi**

---

### 4.2 Phase 4 du prompt — Vérification chaos + load

**Goal** : prouver que les patches tiennent en conditions réelles.

**Tests à faire** :

- ✅ **Stop Redis** → `/api/healthz` 200, `/api/readyz` 503, site SSG sert OK
- ✅ **Stop Postgres** → mêmes attentes
- ✅ **Restart Redis** → reconnect < 30 s
- ✅ **SIGTERM** : `docker stop --time 30 <container>` → exit 0 dans le délai, queues drainées
- ✅ **Load test k6** : 1000 req/s pendant 5 min, p95 latency < 500 ms, error rate < 0.1%
- ✅ **DR drill** : simuler perte VPS → suivre playbook → site UP nouveau VPS < 1h

⏱️ **3-4h**

---

### 4.3 Score final + sign-off

**Output** : `_AUDIT/RELIABILITY-2026/99-verdict.md`

- Score post-patches /600 (cible 480+)
- Liste P0 fixés ✅ / reportés ⏳
- Comparatif perf : build / boot / image size / latency avant/après
- Sign-off : « GO ROBUSTE 2026 »

---

## ♻️ PHASE 5 — ONGOING (tous les 6 mois)

### 5.1 Re-run l'audit

**Phrase** :

> Re-run audit deploy reliability `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md`. Compare avec dernière entrée `_AUDIT/RELIABILITY-2026/HISTORY.md`.

**Triggers obligatoires** :

- Tous les 6 mois (calendrier)
- Avant chaque Sprint majeur (15+, nouveau module)
- Après chaque incident P0/P1 prod
- Major upgrade Next.js / Node (ex : 16 → 17)

⏱️ **6-8h tous les 6 mois**

---

## 📊 TABLEAU DE BORD GLOBAL

| Phase                                | Quand           | Effort | Score gain |
| ------------------------------------ | --------------- | ------ | ---------- |
| **1** Maintenant (résiduel session)  | Aujourd'hui     | 30 min | +5 pts     |
| **2** Week-end P0 RUSH               | Sam-Dim         | 3-4h   | +60 pts    |
| **3** Audit dirigé 3 agents          | Cette semaine   | 6-8h   | +90 pts    |
| **4** Audit complet 6 agents + vérif | Ce mois         | 12-18h | +90 pts    |
| **5** Re-audit /6 mois               | Tous les 6 mois | 6-8h   | maintien   |

**Score cible post-Phase 4** : 480/600 (« robuste »).

---

## 🚨 SI TU N'AS LE TEMPS QUE D'UN SEUL TRUC CE WEEK-END

Fais Phase 2.1 (Cloudflare orange) + 2.2 (Uptime Kuma) + 2.4 (test restore).

Ça = ~2.5h, et ça te met de **« V2 sort de l'œuf »** à **« je peux dormir tranquille en attendant l'audit »**.

---

## 📚 RÉFÉRENCES

- Prompt audit complet : `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md`
- Plan Cloudflare Phase 5 : `_AUDIT/PLAN-CLOUDFLARE-PHASE-5.md`
- Backup secrets : `C:\Users\willi\Documents\Projets\Axion-IA\.secrets-coolify\axion-ia-prod-env.txt` (gitignored)
- Coolify : `http://178.105.55.15:8000`
- Hetzner Cloud Console : https://console.hetzner.cloud/
- Repo GitHub : https://github.com/will383842/axion-ia

---

**FIN DU PLAN.**
