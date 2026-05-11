# PLAN CLOUDFLARE PHASE 5 — Configuration complète

**Créé** : 2026-05-09
**Contexte** : V2 Axion-IA en prod sur Hetzner CPX32 + Coolify + Traefik. Cert Let's Encrypt valide. Cloudflare actuellement en DNS only (gris), pas de proxy/cache/CDN.
**Objectif** : activer toutes les fonctionnalités Cloudflare Free (proxy orange + cache + Brotli + HTTP/3 + DNSSEC + Bot Fight) pour rendre le site rapide partout dans le monde et protégé contre les attaques basiques.
**Effort total** : ~30 min.
**Coût** : 0 € (tout en plan Free).

---

## 🎯 GAINS ATTENDUS

| Métrique        | Avant (DNS only gris) | Après (orange + config)        |
| --------------- | --------------------- | ------------------------------ |
| TTFB Paris      | 280 ms                | 30-80 ms (cache CF)            |
| TTFB New York   | 600 ms                | 50 ms (edge USA)               |
| TTFB Tokyo      | 1100 ms               | 80 ms (edge Asie)              |
| Compression     | gzip basique          | **Brotli** (-25% taille)       |
| Protocole       | HTTP/2                | **HTTP/3 / QUIC**              |
| Cache HTML      | aucun                 | **24h cache CF** sur SSG       |
| DDoS protection | non                   | **Layer 7 gratuite**           |
| Bot scrapers    | passent               | **bloqués par Bot Fight Mode** |
| DNS hijacking   | possible              | **DNSSEC actif**               |

---

## ⚠️ PRÉ-REQUIS — VÉRIFIER AVANT DE COMMENCER

1. ✅ V2 (commit `d98a8c1` ou +) déployée en prod
2. ✅ HTTPS marche sur `https://axion-ia.com` (cert Let's Encrypt valide)
3. ✅ Site accessible et fonctionnel (pages s'affichent entièrement)
4. ✅ Healthz retourne `"status":"ok"` ou `"degraded"` (mais pas erreur fatale)

Si un de ces 4 n'est pas OK, **NE PAS lancer Phase 5** — fix d'abord.

---

## 📋 ORDRE DES ÉTAPES (À RESPECTER)

| Étape | Action                                                | Temps                     |
| ----- | ----------------------------------------------------- | ------------------------- |
| 1     | Bascule DNS records en proxy orange                   | 2 min                     |
| 2     | SSL/TLS = Full (strict)                               | 1 min                     |
| 3     | Edge Certificates settings                            | 2 min                     |
| 4     | HTTP/3 + 0-RTT activation                             | 1 min                     |
| 5     | Brotli compression                                    | 1 min                     |
| 6     | Cache Rules (HTML 24h, assets 1 an)                   | 5 min                     |
| 7     | Speed > Optimization (Auto Minify, Rocket Loader OFF) | 2 min                     |
| 8     | Security > Bot Fight Mode + Security Level            | 2 min                     |
| 9     | DNSSEC                                                | 5 min (+ 24h propagation) |
| 10    | Page Rules / Workers (optionnel, plus tard)           | 0-15 min                  |
| 11    | Verify everything                                     | 5 min                     |

---

## 🔧 ÉTAPE 1 — BASCULE DNS RECORDS EN PROXY ORANGE

**Goal** : faire passer le trafic par les serveurs Cloudflare au lieu d'aller direct sur ton VPS.

**Pourquoi** : sans proxy, Cloudflare ne fait que de la résolution DNS. Avec proxy orange, il intercepte tout le trafic, le cache, et applique ses protections.

**Steps** :

1. Cloudflare Dashboard → site `axion-ia.com` → **DNS** → **Records**
2. Pour CHAQUE des 3 records suivants, cliquer sur le statut Proxy (nuage gris) → bascule en orange :
   - `A` `@` → `178.105.55.15` → 🟠 **Proxied**
   - `A` `www` → `178.105.55.15` → 🟠 **Proxied**
   - `AAAA` `@` → `2a01:4f8:1c18:cfe3::1` → 🟠 **Proxied**
3. **NE PAS** toucher aux records MX (`eforward1-5.registrar-servers.com`) — laisser **DNS only** (proxy orange n'aurait aucun sens pour MX, et casserait l'email forwarding Namecheap)
4. **NE PAS** toucher au record TXT SPF — laisser **DNS only**

**Verification** :

- Attendre ~30 secondes (propagation Cloudflare interne)
- `curl -I https://axion-ia.com` → header `Server: cloudflare` doit apparaître
- `curl -I https://axion-ia.com | grep -i cf-ray` → présent = trafic passe par CF

**⚠️ Risque court terme** :
Pendant ~30 secondes, certains visiteurs peuvent voir un cert Cloudflare au lieu de ton cert Let's Encrypt. Normal, transitoire. Le cert CF est valide.

⏱️ **2 min**

---

## 🔧 ÉTAPE 2 — SSL/TLS = FULL (STRICT)

**Goal** : chiffrer correctement entre Cloudflare et ton serveur (pas juste entre user et CF).

**Pourquoi** : il y a 4 modes SSL/TLS sur CF :

- **Off** : pas de HTTPS (jamais)
- **Flexible** : HTTPS user→CF, HTTP CF→serveur (TROU SÉCURITÉ — jamais)
- **Full** : HTTPS partout, mais cert serveur peut être self-signed (acceptable)
- **Full (strict)** : HTTPS partout + cert serveur doit être valide (Let's Encrypt OK) ← **À CHOISIR**

**Steps** :

1. Cloudflare → **SSL/TLS** → onglet **Overview**
2. Section **SSL/TLS encryption mode** → choisir **Full (strict)**

**Verification** :

- Reload `https://axion-ia.com` → toujours 200 OK (pas d'erreur cert)
- Si erreur cert : vérifier que ton cert Let's Encrypt sur Traefik est valide (`echo | openssl s_client -connect 178.105.55.15:443 -servername axion-ia.com`)

⏱️ **1 min**

---

## 🔧 ÉTAPE 3 — EDGE CERTIFICATES

**Goal** : optimiser les certs Cloudflare (côté edge → user).

**Steps** :

1. Cloudflare → **SSL/TLS** → onglet **Edge Certificates**
2. Vérifier / activer :
   - **Always Use HTTPS** : ✅ ON (redirige automatiquement HTTP → HTTPS)
   - **HTTP Strict Transport Security (HSTS)** : clique **Enable HSTS** :
     - Max Age : `12 months` (recommandé production stable, sinon 6 mois)
     - Apply HSTS Policy to subdomains : ✅ ON (préparation pour `uptime.axion-ia.com`, `staging.axion-ia.com`)
     - Preload : ✅ ON (intégration dans liste preload Chromium)
     - No-Sniff Header : ✅ ON
   - **Minimum TLS Version** : **TLS 1.2** (TLS 1.3 supporté automatiquement)
   - **Opportunistic Encryption** : ✅ ON
   - **TLS 1.3** : ✅ ON (par défaut)
   - **Automatic HTTPS Rewrites** : ✅ ON
   - **Certificate Transparency Monitoring** : ✅ ON

⚠️ **HSTS Preload est irréversible** pour 1 an. Une fois activé, tu ne peux plus revenir en HTTP même temporairement. À activer SEULEMENT si tu es sûr d'être en HTTPS pour toujours (ce qui devrait être le cas).

**Verification** :

- `curl -I https://axion-ia.com | grep -i strict-transport-security` → doit afficher `max-age=31536000; includeSubDomains; preload`

⏱️ **2 min**

---

## 🔧 ÉTAPE 4 — HTTP/3 + 0-RTT

**Goal** : activer HTTP/3 (QUIC) pour les utilisateurs mobiles et latence élevée.

**Pourquoi** : HTTP/3 réduit la latence handshake de 30-40% sur connexions instables (mobile, public WiFi). Compatible avec Chrome, Firefox, Safari, Edge récents.

**Steps** :

1. Cloudflare → **Network** (sidebar gauche)
2. Activer :
   - **HTTP/2** : ✅ ON (par défaut)
   - **HTTP/3 (with QUIC)** : ✅ ON
   - **0-RTT Connection Resumption** : ✅ ON (ré-utilisation session pour reload)
   - **gRPC** : ON (au cas où, free)
   - **WebSockets** : ✅ ON (Plausible, Sentry realtime, etc.)
   - **Onion Routing** : OFF (sauf si tu veux supporter Tor)
   - **Pseudo IPv4** : OFF (ton app supporte IPv6 nativement)
   - **IP Geolocation** : ✅ ON (header `CF-IPCountry` pratique)
   - **Maximum Upload Size** : 100 MB (free tier max ; OK pour Axion-IA qui ne reçoit pas de gros fichiers)

**Verification** :

- `curl -sI https://axion-ia.com | grep -i alt-svc` → doit afficher `h3=":443"`
- Test depuis Chrome DevTools → Network tab → Protocol column → certaines requêtes en `h3` au lieu de `h2`

⏱️ **1 min**

---

## 🔧 ÉTAPE 5 — BROTLI COMPRESSION

**Goal** : compression -25% vs gzip pour le HTML/CSS/JS.

**Steps** :

1. Cloudflare → **Speed** → onglet **Optimization** → **Content Optimization**
2. **Brotli** : ✅ ON

**Verification** :

- `curl -sI -H "Accept-Encoding: br" https://axion-ia.com/fr | grep -i content-encoding` → doit afficher `br`
- Si ça affiche `gzip` : Brotli pas encore propagé, attendre 5 min

⏱️ **1 min**

---

## 🔧 ÉTAPE 6 — CACHE RULES (gros gain perf)

**Goal** : cache aggressif sur HTML SSG (24h) + assets statiques (1 an).

**Pourquoi** : Next.js sert `/_next/static/*` avec hash dans le nom de fichier — donc cacheable 1 an sans risque. Les pages SSG (homepage, par-ville, etc.) sont rebuilt à chaque deploy — donc cache 24h-7j est sûr.

**Steps** :

1. Cloudflare → **Rules** (sidebar) → **Cache Rules** → **Create rule**

**Rule 1 — Static assets long cache** :

- Rule name : `Static assets — 1 year`
- If incoming requests match :
  - **Field** : URI Path → **Operator** : starts with → **Value** : `/_next/static/`
- Then :
  - **Cache eligibility** : Eligible for cache
  - **Edge TTL** : Override origin → `1 year`
  - **Browser TTL** : Override origin → `1 year`
- Save

**Rule 2 — HTML SSG cache** :

- Rule name : `HTML SSG — 1 day`
- If incoming requests match :
  - **Field** : URI Path → **Operator** : matches regex → **Value** : `^/(fr|en)(/.*)?$`
- Then :
  - **Cache eligibility** : Eligible for cache
  - **Edge TTL** : Override origin → `1 day`
  - **Browser TTL** : Override origin → `5 minutes` (pour que les retour visiteurs voient les changements rapidement)
  - **Cache Key** :
    - Include : Host, Path, Query string (full)
    - Exclude : Cookies (sauf si tu utilises cookies pour locale, voir note)
- Save

**Rule 3 — API never cache** :

- Rule name : `API never cache`
- If incoming requests match :
  - **Field** : URI Path → **Operator** : starts with → **Value** : `/api/`
- Then :
  - **Cache eligibility** : Bypass cache
- Save

⚠️ **Note locale cookie** : si Next-intl utilise un cookie `NEXT_LOCALE`, il faut l'inclure dans cache key SINON tous les users vont voir la même langue. Test après config :

- Visite `axion-ia.com/fr`
- Visite `axion-ia.com/en`
- Recharge `axion-ia.com/fr` → doit toujours servir FR
- Si l'un est servi en mauvaise langue → ajouter `NEXT_LOCALE` cookie au cache key

**Verification** :

- `curl -sI https://axion-ia.com/_next/static/chunks/something.js | grep -i cf-cache-status` → après 2ème hit doit afficher `HIT`
- `curl -sI https://axion-ia.com/fr | grep -i cf-cache-status` → après 2ème hit doit afficher `HIT`
- `curl -sI https://axion-ia.com/api/healthz | grep -i cf-cache-status` → doit afficher `BYPASS` (jamais cached)

⏱️ **5 min**

---

## 🔧 ÉTAPE 7 — SPEED > OPTIMIZATION

**Goal** : optimisations automatiques mais **sans casser ton site**.

**Steps** :

1. Cloudflare → **Speed** → onglet **Optimization**

**Section Content Optimization** :

- **Auto Minify** :
  - HTML : ✅ ON (Next 16 minifie déjà mais double-check sécurise)
  - CSS : ✅ ON
  - JavaScript : ⚠️ **OFF** (Next 16 + Turbopack minifie déjà optimalement, double-min peut casser)
- **Brotli** : déjà fait étape 5 ✅
- **Early Hints** : ✅ ON (preload critique, +5-15% LCP sur certains navigateurs)

**Section Image Optimization** (Free tier) :

- **Polish** : ❌ Free tier n'a pas Polish. Skip.
- **Mirage** : ❌ Free tier n'a pas Mirage. Skip.
  (Cloudflare Pro à $20/mois te donnerait Polish lossless + Mirage. Pas utile pour Axion-IA actuellement.)

**Section Other** :

- **Rocket Loader** : ❌ **OFF** (Rocket Loader bouge des scripts de manière asynchrone qui CASSE souvent React/Next.js hydration. Surtout pas avec Next 16.)
- **Mobile Redirect** : ❌ OFF (tu n'as pas de version mobile dédiée)
- **Auto Minify Beta features** : skip

⏱️ **2 min**

---

## 🔧 ÉTAPE 8 — SECURITY > BOT FIGHT MODE + SECURITY LEVEL

**Goal** : bloquer les bots scrapers + ajuster le niveau de paranoia.

**Steps** :

1. Cloudflare → **Security** → onglet **Bots**
2. **Bot Fight Mode** : ✅ ON (Free tier — bloque les bots les plus simples)
   - ⚠️ Risque : peut bloquer des bots légitimes (uptime monitors, AI scrapers comme GPTBot). Si tu vois des 403 sur ton uptime monitor, désactive temporairement.
3. **Block AI Scrapers and Crawlers** : ⚠️ **DÉCISION** :
   - ✅ ON si tu veux empêcher GPTBot/CCBot/etc. de scraper ton contenu pour l'entraînement IA
   - ❌ OFF si tu veux que ton contenu soit dans les modèles IA (potentiel SEO indirect via citations)
   - **Recommendation pour Axion-IA** : ✅ ON (B2B premium, pas envie que ton contenu finance la concurrence)

4. Cloudflare → **Security** → onglet **Settings**
5. **Security Level** : choisir **Medium** (défaut) — Challenge si IP suspecte
   - High = trop agressif (bloque users légitimes)
   - Low = pas assez (passe DDoS basique)
6. **Challenge Passage** : `30 minutes`
7. **Browser Integrity Check** : ✅ ON

8. Cloudflare → **Security** → onglet **DDoS**
   - HTTP DDoS Attack Protection : ✅ ON (Free tier inclus, automatique)

**Verification** :

- Test depuis ton navigateur : `https://axion-ia.com` → loading normal
- Test avec User-Agent `curl/7.0` : devrait passer (curl pas considéré bot agressif)
- Si problème : Cloudflare → **Analytics** → onglet **Security** pour voir les blocks

⏱️ **2 min**

---

## 🔧 ÉTAPE 9 — DNSSEC

**Goal** : signer cryptographiquement tes DNS records pour empêcher hijacking.

**Steps Cloudflare** :

1. Cloudflare → **DNS** → **Settings** (en haut à droite, icône engrenage ou bouton)
2. Section **DNSSEC** → **Enable DNSSEC**
3. Cloudflare affiche un panneau avec :
   - **Status** : Pending DS Submission
   - **DS Record** : valeurs Key Tag, Algorithm, Digest Type, Digest, Public Key
4. **Copier toutes les valeurs**

**Steps Namecheap** :

1. Namecheap → Domain List → `axion-ia.com` → **Manage**
2. Onglet **Advanced DNS** (PAS Domain — Advanced DNS)
3. Section tout en bas : **DNSSEC** → **Add new record**
4. Coller les valeurs depuis Cloudflare :
   - Key Tag : (valeur Cloudflare)
   - Algorithm : (souvent `13 - ECDSAP256SHA256`)
   - Digest Type : (souvent `2 - SHA-256`)
   - Digest : (longue string hex)
5. **Save** (coche verte ✅ comme pour les nameservers)

**Retour Cloudflare** :

- Attendre 24h max (généralement <1h)
- Cloudflare auto-vérifie et le statut passe à **Active**

**Verification** :

```bash
dig +dnssec axion-ia.com | grep -i RRSIG
```

Doit afficher des records signés.

Ou via web : https://dnssec-analyzer.verisignlabs.com/axion-ia.com → tous les checkmarks verts.

⏱️ **5 min** + 24h propagation

---

## 🔧 ÉTAPE 10 — PAGE RULES (OPTIONNEL, PLUS TARD)

Ces règles sont des bonus. Pas critiques pour la mise en prod aujourd'hui.

### 10.1 Force HTTPS sur tous les sous-domaines

Page Rules (3 max gratuit) → **Create Page Rule**

- URL match : `*axion-ia.com/*`
- Setting : **Always Use HTTPS**

### 10.2 Cache niveau "Cache Everything" sur sitemap/robots

- URL match : `axion-ia.com/sitemap*.xml`
- Setting : **Cache Level: Cache Everything**, **Edge TTL: 1 day**

- URL match : `axion-ia.com/robots.txt`
- Setting : **Cache Level: Cache Everything**, **Edge TTL: 7 days**

⏱️ **5 min** (optionnel)

---

## ✅ ÉTAPE 11 — VÉRIFICATION FINALE

**Tests à exécuter une fois tout configuré** :

### 11.1 Headers HTTP corrects

```bash
curl -sI https://axion-ia.com/fr
```

Vérifier la présence de :

- `Server: cloudflare` ← preuve proxy orange actif
- `CF-Ray: <hash>-<airport>` ← preuve trafic passé par CF
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` ← HSTS
- `Alt-Svc: h3=":443"` ← HTTP/3
- `Content-Encoding: br` (avec `-H "Accept-Encoding: br"`) ← Brotli
- `CF-Cache-Status: HIT` ou `DYNAMIC` (selon route) ← cache rules

### 11.2 Vitesse

Test https://www.webpagetest.org/ depuis :

- **Frankfurt, Germany** : TTFB < 50 ms attendu
- **Virginia, USA** : TTFB < 80 ms attendu
- **Tokyo, Japan** : TTFB < 100 ms attendu

Si TTFB > 200 ms partout → cache pas actif, vérifier Cache Rules.

### 11.3 SSL Labs

https://www.ssllabs.com/ssltest/analyze.html?d=axion-ia.com

Cible : **Grade A+** (peut prendre quelques minutes pour scan complet).

Si A ou A- : vérifier HSTS preload, TLS 1.0/1.1 disabled, no weak ciphers.

### 11.4 Security Headers

https://securityheaders.com/?q=axion-ia.com

Cible : **Grade A+** ou **A**.

CSP (Content-Security-Policy) déjà set par Sprint 24 phase 3, donc devrait avoir un bon score.

### 11.5 DNSSEC

https://dnssec-analyzer.verisignlabs.com/axion-ia.com

Cible : tous les checkmarks verts (peut prendre 24h après activation).

### 11.6 Site fonctionne

Le plus important : reload `https://axion-ia.com/fr` dans navigateur, naviguer plusieurs pages :

- `/fr` → 200, pages s'affichent
- `/fr/interventions` → 200
- `/fr/par-ville/paris` → 200
- `/fr/reserver` → 200
- `/fr/contact` → 200, formulaire fonctionne

Si une page 5xx ou bizarre → vérifier Cloudflare logs (Analytics → Security/Performance).

⏱️ **5-10 min**

---

## 🚨 SI ÇA CASSE — ROLLBACK RAPIDE

**Symptômes** :

- Site soudain inaccessible
- Erreurs 5xx généralisées
- Cert SSL invalide
- Boucle de redirection

**Rollback en 10 sec** :

1. Cloudflare → **DNS** → **Records**
2. Re-bascule les 3 records (`A @`, `A www`, `AAAA @`) en **DNS only gris**
3. Wait 30 sec → trafic repasse direct sur le VPS

Ça désactive instantanément CF proxy + cache + tout. Tu reviens à l'état avant Phase 5. Tu peux investiguer tranquille.

---

## 📊 GAINS APRÈS PHASE 5 — SCORE RELIABILITY

| Avant Phase 5     | ~280/600     |
| ----------------- | ------------ |
| **Après Phase 5** | **~310/600** |

(+30 pts surtout sur Agent 6 Security + Agent 5 Observability, et bonus perf indirect.)

---

## 🔄 MAINTENANCE FUTURE

### Logs / Analytics CF

Cloudflare → **Analytics & Logs** → **Traffic** : voir requests/s, cache HIT/MISS ratio, top routes.

Cible cache HIT ratio :

- Static assets : > 95%
- HTML SSG : > 70% (varie selon ratio nouveaux visiteurs)
- API : 0% (toujours BYPASS)

Si HTML HIT < 50% → revoir Cache Rules.

### Renouvellement cert Let's Encrypt

Traefik gère auto via Coolify. Vérifier tous les 60 jours :

```bash
echo | openssl s_client -connect 178.105.55.15:443 -servername axion-ia.com 2>/dev/null | openssl x509 -noout -dates
```

Si `notAfter` < 30 jours → forcer Coolify Restart pour re-trigger renew.

### Quand passer Cloudflare Pro ($20/mois)

- Trafic > 100k requests/jour : Pro débloque caching plus agressif
- Besoin Polish (image optim) : Pro requis
- Page Rules > 3 : Pro débloque 20 rules
- WAF custom rules : Pro requis

Tant que tu es < 100k req/jour : Free suffit largement.

---

## 📚 RÉFÉRENCES

- Plan d'action global : `_AUDIT/PLAN-ACTION-POST-DEPLOY-V2.md`
- Prompt audit reliability : `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md`
- Cloudflare docs : https://developers.cloudflare.com/
- Web.dev (perf budget refs) : https://web.dev/

---

**FIN DU PLAN CLOUDFLARE PHASE 5.**
