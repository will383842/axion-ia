# Actions manuelles Will — Sprint correctif P0 2026-05-11

Actions que je ne peux pas exécuter en autonome (classifier sécurité ou domaine externe).
Tout le reste du sprint P0 (code + commits) est traité automatiquement.

---

## 🚨 Hotfix urgent #1 — Turnstile DEV keys (1 min)

**Pourquoi** : `TURNSTILE_SECRET_KEY` absent + `NEXT_PUBLIC_APP_ENV=production` → `verifyTurnstile` retourne `false` (fail-closed). **Tous les forms échouent silencieusement en prod actuellement** (booking, contact, audit, implementation, newsletter).

**Solution courte (bypass) — à exécuter MAINTENANT** :

```bash
set -a && source .secrets/api-tokens.env && set +a

# 1. Turnstile secret server (always-pass dev key Cloudflare)
curl -X POST -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID/envs" \
  -d '{"key":"TURNSTILE_SECRET_KEY","value":"1x0000000000000000000000000000000AA","is_buildtime":false,"is_runtime":true}'

# 2. Site key public (always-pass)
curl -X POST -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID/envs" \
  -d '{"key":"NEXT_PUBLIC_TURNSTILE_SITE_KEY","value":"1x00000000000000000000AA","is_buildtime":true,"is_runtime":true}'

# 3. Redéployer
curl -X POST -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_URL/api/v1/deploy?uuid=$COOLIFY_APP_UUID&force=false"
```

→ Effet immédiat : `verifyTurnstile` retourne `true` (DEV_KEYS bypass — `turnstile.ts:13-17`). Forms débloqués. Anti-spam **reste assuré** par honeypot serveur (`formData.get("website")`) + rate-limit Redis. Sécurité dégradée le temps que tu crées un vrai site CF Turnstile.

**Solution propre — semaine prochaine** :

1. Cloudflare dashboard → Turnstile → "Add site" → domaine `axion-ia.com`.
2. Récupère `Site Key` (public) et `Secret Key` (privé).
3. Remplace les DEV keys ci-dessus par les vraies valeurs.
4. P0-09 (widget client) déjà câblé dans le code → le widget chargera automatiquement.

---

## 🚨 Hotfix urgent #2 — DMARC DNS (5 min via Namecheap)

**Pourquoi** : `_dmarc.axion-ia.com` retourne NXDOMAIN (Phase 4 P-03). Spoofing possible + deliverability dégradée.

**Action Namecheap** :

1. Namecheap → Domain List → `axion-ia.com` → Manage → Advanced DNS.
2. Add new record :
   - **Type** : TXT Record
   - **Host** : `_dmarc`
   - **Value** : `v=DMARC1; p=none; rua=mailto:dmarc@axion-ia.com; sp=none; pct=100; adkim=r; aspf=r`
   - **TTL** : Automatic
3. Save.

**Vérification (10 min après save)** :

```bash
nslookup -type=TXT _dmarc.axion-ia.com
```

→ doit retourner le record.

**Évolution** : laisser `p=none` 2-4 semaines (mode observation), surveiller le `rua` reports, puis passer à `p=quarantine` puis `p=reject`.

---

## 🚨 Hotfix urgent #3 — Cloudflare Managed Content `robots.txt` OFF (5 min)

**Pourquoi** : CF prepend `Disallow: /` pour ClaudeBot/GPTBot/Google-Extended au robots.txt en tête, neutralisant ton investissement AEO/GEO.

**Action Cloudflare dashboard** :

1. Cloudflare dashboard → Sélectionner zone `axion-ia.com`.
2. Menu gauche → **Security** → **Bots** (ou **AI Audit / Bots**).
3. Trouver "**Cloudflare Managed Content `robots.txt`**" ou "**AI Scrapers and Crawlers (managed robots.txt)**".
4. Toggle **OFF**.
5. Save.

**Vérification immédiate** :

```bash
curl -s https://axion-ia.com/robots.txt | head -10
```

→ Doit commencer par `User-Agent: *` `Allow: /` (origin Next), **plus de section "Cloudflare Managed Content"**.

**Effet attendu (semaines)** : visites depuis ChatGPT, Claude, Perplexity, Google AI Overviews apparaissent dans Plausible referrers. Cf. P-07 Indexation.

**Alternative API (si tu veux pas dashboard)** : la API CF expose les flags via `/zones/{zone_id}/settings` mais pour ce setting spécifique (Bots > Managed robots.txt), j'ai besoin de creuser le bon endpoint. **Plus rapide dashboard**.

---

## 📋 Actions papier RGPD (1 h cumulé)

### DPA Hetzner (15 min)

1. Hetzner Console → ton compte → DPA (Data Processing Agreement).
2. Accepter l'avenant en ligne (signature électronique).
3. Télécharger le PDF signé → archiver `axionia/legal-archives/DPA-Hetzner-2026-05-11.pdf` (hors git).
4. Mettre à jour `_AUDIT/DPA-REGISTER.md` : `Hetzner: 🟢 signed 2026-05-11`.

### DPA Cloudflare (15 min)

1. Cloudflare dashboard → ton compte (pas une zone) → **Settings** → **Trust hub** → **Compliance Documents** → **EU Cloud Region Data Processing Addendum**.
2. Accepter en ligne.
3. Idem archive PDF + update `DPA-REGISTER.md`.

### Boîte `dpo@axion-ia.com` (15 min)

1. Namecheap → Domain List → `axion-ia.com` → Advanced DNS → Email Forwarding.
2. Ajouter alias `dpo` → ta boîte personnelle.
3. Tester en envoyant un mail à `dpo@axion-ia.com` → reception confirmation.

### `registrikood` + EU VAT (5 min, copy paste)

1. Récupérer ton numéro `registrikood` (Estonia Business Register) et EU VAT number.
2. Patch `src/content/legal.ts` → `mentionsLegales.companyDetails.registrikood = "12345678"` (valeur réelle).
3. Idem EU VAT.

→ Hors P0 strict mais ferme P1-RGPD identifiés AGT-09.

---

## ✅ Actions automatiques en cours

Tout le reste du sprint P0 (P0-05 à P0-14) est traité par moi dans des commits sur main, avec PR ready. Je posterai le récap final dès que la dernière gate (typecheck + lint + test) passe.
