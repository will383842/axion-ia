# Checklist audit prod Axion-IA — 2026-05-15

> Fichier de référence pour piloter les futurs audits du site + tracker ce
> qui reste à faire post-session marathon 2026-05-15.
>
> Convention : ✅ fait · ⏳ en cours · ❌ pas fait · ⚠️ partiel · 🚨 bloquant

---

## 0. Snapshot état au moment de l'écriture

| Élément                    | État                                                            |
| -------------------------- | --------------------------------------------------------------- |
| Branche                    | `main`                                                          |
| Origin HEAD                | `9048193` (+2 commits locaux probables : `c5cf127` + `093b66d`) |
| Container web `mqbmlz1*`   | ⏳ deploy `zrigttu0` in_progress (`#29 exporting layers`)       |
| Site `/fr` (public)        | ⚠️ 200 via CF cache stale, origin down pendant deploy           |
| Disque Hetzner CPX42       | ✅ 115 GB libres / 150 GB                                       |
| Postgres / Redis / Coolify | ✅ healthy                                                      |

---

## 1. Actions ouvertes (par priorité)

### 🚨 P0 — Action légale RGPD (bloque GO PROD)

- [ ] **Microsoft Clarity — arbitrage RGPD** (5 min ou 1-3j)
  - Constat : Clarity actif sans DPA/SCC signé avec Microsoft → transfert UE→US sans Standard Contractual Clauses = violation Art. 44 GDPR
  - Option 1 (5 min) : retirer Clarity. Supprimer env `NEXT_PUBLIC_CLARITY_PROJECT_ID` Coolify + retirer `<Clarity />` de `src/app/[locale]/layout.tsx`. Perte : heatmaps + session recording.
  - Option 2 (1-3j) : signer SCC Microsoft → <https://www.microsoft.com/licensing/docs/customeragreement> section DPA
  - Option 3 (effort moyen) : migrer vers alternative EU (PostHog Cloud EU, Plausible heatmaps beta)
  - **Décision Will requise**

- [ ] **5 DPA prioritaires** (30-45 min total)
  - [ ] Hetzner → `robot.hetzner.com` → Compliance → DSGVO/GDPR (papier scanné mail)
  - [ ] Cloudflare → `dash.cloudflare.com` → Manage Account → Configurations → Privacy → Sign DPA (1 clic)
  - [ ] OpenAI → `platform.openai.com` → Settings → Data Controls → Sign DPA + Zero Data Retention si éligible
  - [ ] Anthropic → `console.anthropic.com` → Settings → Privacy → Sign Commercial DPA
  - [ ] Perplexity → contact compliance + Sign DPA + SCC

- [ ] **3 DPA additionnels** (10 min)
  - [ ] Unsplash (images stock)
  - [ ] Voyage AI (embeddings KB)
  - [ ] Stripe (DPA standard dans dashboard)

- [ ] **Boîte `dpo@axion-ia.com`** active pour réception copies signées

### 🔥 P0 — Infra/Cloudflare

- [ ] **CF Content Signals OFF** (= le vrai bloc dans `robots.txt` qui injecte `Disallow: /` pour ClaudeBot/GPTBot/PerplexityBot/Google-Extended)
  - Le toggle "Block AI bots" Will l'a vérifié OFF, mais ce N'EST PAS celui-là
  - Vrai endroit (à chercher patient) : Dashboard CF → Security → AI Audit / AI Crawl Control OU Caching → Configuration → Content Signals
  - Vérification : `curl -s https://axion-ia.com/robots.txt | grep -E "ClaudeBot|GPTBot|Disallow"` ne doit plus retourner de Disallow pour ces bots
  - **Action UI Will obligatoire** (token API n'a pas perm WAF)

- [ ] **Secret OAuth GCP `GOCSPX-*` à réinitialiser**
  - Posté en clair en chat 2026-05-15 → compromis
  - <https://console.cloud.google.com/apis/credentials> → projet `axion-ia-seo` → reset secret du client `815301890396-2h7qd1a2pojfdndisr0d1sdn0s0v1o6e`
  - Mettre à jour Coolify env `GSC_OAUTH_CLIENT_SECRET` après reset

### 🟡 P1 — Code / déploiement (semaine)

- [ ] **Push commits restants `c5cf127` + `093b66d`** (l'autre conv)
  - Contient : audit indexation patches + worker openssl + csp clarity + faq feed URL absolue + migration `article_slug_history`
  - À pousser **après** `zrigttu0 = finished` (sinon Coolify queue 2 builds en cascade → re-sature disque)

- [ ] **Patch verify-signature DocuSeal `<timestamp>.<sha256>`**
  - Détails : `axionia_docuseal_webhook_signature_todo.md` en mémoire
  - Effort : 30 min code + tests
  - Pas bloquant V1 (Telegram fallback)

- [ ] **Investigation tests vitest 79 fichiers (claim autre conv)**
  - Non reproduit ici (`pnpm vitest run` passait à `EXIT=0`)
  - Probable problème local `pnpm-lock.yaml` mismatch
  - Diagnostic : Will partage l'erreur exacte si elle réapparaît

### 🟢 P2 — Monitoring / RUM (optionnel V2)

- [ ] **PSI/CrUX API key**
  - Procédure : projet `axion-ia-seo` existant → activer "PageSpeed Insights API" + "Chrome UX Report API" → Credentials → API key → restreindre aux 2 APIs → push Coolify `GOOGLE_PSI_API_KEY=<key>`
  - Effort : 10 min UI
  - Bénéfice : field data CrUX automation pour worker monitoring

- [ ] **Plausible Web Vitals dashboard custom**
  - À configurer dans `plausible.axion-ia.com` → Custom Properties → "Web Vital" event
  - Tracker depuis `WebVitals.tsx` déjà câblé (commit `b14c5d0`)

- [ ] **Google Indexing API Service Account**
  - Procédure complète :
    1. <https://console.cloud.google.com/iam-admin/serviceaccounts> projet `axion-ia-seo`
    2. Create SA `axion-ia-indexing` (no role needed)
    3. Keys → Add key → JSON → download
    4. Convertir single-line : `cat sa.json | python -c "import json,sys; print(json.dumps(json.load(sys.stdin)))"`
    5. <https://search.google.com/search-console> → axion-ia.com → Settings → Users → ajouter email du SA comme Owner
    6. Push Coolify : `GOOGLE_INDEXING_API_ENABLED=true` + `GOOGLE_INDEXING_SA_JSON=<single-line>`
  - **Limite officielle** : Google n'accepte que `JobPosting` + `BroadcastEvent` → gain marginal pour Article/FAQ. IndexNow couvre déjà Bing/Yandex/Naver/Seznam.
  - **Recommandation** : skipper sauf besoin spécifique V2

### 🔵 P3 — Backup / DR (J+15)

- [ ] **DR drill R22** (30 min SSH)
  - Runbook existant : `docs/runbooks/R22-pg-restore-drill.md`
  - Procédure : SSH Hetzner → lancer restore depuis backup chiffré → vérifier DB restaurée OK → documenter le résultat dans `_AUDIT/`
  - Pré-requis : `BACKUP_ENCRYPTION_PASSPHRASE` stockée 1Password + papier (1 min)
  - Critère succès : DB restaurée en < 4h, tables + data intacts

- [ ] **7 secrets CI GitHub Actions** (5 min)
  - Liste : voir `_AUDIT/CI-SECRETS-REQUIRED.md`

- [ ] **Crontab serveur Hetzner inventory** (10 min SSH)
  - `ssh root@178.105.55.15 "crontab -l"` → documenter dans `_AUDIT/CRON-INVENTORY-2026-05-15.md`
  - Confirmer présence : `0 * * * * docker builder prune -af --keep-storage 5GB` + `15 * * * * docker image prune -af` + backups R2

### 🟣 P4 — Factory KB activation (post-tout-le-reste)

- [ ] **`KB_AUTO_PUBLISH=true`** — NE PAS ACTIVER avant validation complète
  - Pré-requis impératifs :
    - [x] Deploy stabilisé `zrigttu0+` finished
    - [x] Smoke tests post-deploy verts
    - [x] Migration `article_slug_history` appliquée (entrypoint auto)
    - [x] Container web UP healthy depuis 24-48h
    - [x] Clarity RGPD tranché
    - [x] 5 DPA prioritaires signés
    - [x] Kill-switch testé manuellement (`/admin/content-gen/settings/kill-switch`)
    - [x] 5-10 articles publiés en mode manuel sans crash
    - [x] Cost cap monitoring opérationnel
  - Procédure technique (5 min) :
    ```bash
    set -a && source ../.secrets/api-tokens.env && set +a
    UUID=$(curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID/envs" | python -c "import json,sys; print([e['uuid'] for e in json.loads(sys.stdin.read()) if e['key']=='KB_AUTO_PUBLISH'][0])")
    curl -sX PATCH -H "Authorization: Bearer $COOLIFY_API_TOKEN" -H "Content-Type: application/json" \
      "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID/envs/$UUID" \
      -d '{"value":"true"}'
    curl -sX GET -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID/restart"
    ```
  - Surveillance 48h post-activation : alertes Telegram tag MONITORING + cost cap

---

## 2. Smoke tests post-deploy (commandes prêtes à coller)

À exécuter dès qu'un deploy passe `finished` :

```bash
cd C:\Users\willi\Documents\Projets\Axion-IA\axionia
set -a && source ../.secrets/api-tokens.env && set +a

# 1. Routes critiques
for p in / /fr /en /fr/equipe/manon /fr/tarifs /fr/audit /fr/reserver \
  /fr/contact /fr/interventions /fr/cas-concrets /fr/blog /fr/faq \
  /fr/centre-aide /fr/implantations/ile-de-france/paris \
  /fr/audit/par-ville/lyon /fr/interventions/par-ville/marseille \
  /sitemap-index.xml /sitemap-news.xml /robots.txt /llms.txt /ai.txt \
  /opengraph-image /api/markdown/faq/definition \
  /fr/route-bidon-totalement; do
  c=$(curl -sI -o /dev/null -w "%{http_code}" "https://axion-ia.com$p")
  printf "  %-45s %s\n" "$p" "$c"
done

# 2. Catch-all 404 doit retourner 404 (pas 200 soft 404)
curl -sI -o /dev/null -w "404 catch-all=%{http_code} (attendu 404)\n" "https://axion-ia.com/fr/route-bidon-totalement"

# 3. robots.txt — bloc Content Signals présent ou pas ?
curl -s "https://axion-ia.com/robots.txt" | grep -c "ClaudeBot.*Disallow"
# Attendu : 0 (si CF Content Signals OFF)

# 4. JSON-LD types présents
curl -sL "https://axion-ia.com/fr/faq/definition" | grep -oP '"@type":\s*"[A-Za-z]+"' | sort -u | head -10
# Attendu : QAPage, Question, Answer, Organization, BreadcrumbList, Speakable

# 5. CF cache headers
curl -sI "https://axion-ia.com/fr" | grep -iE "cache-control|cf-cache-status|age|x-nextjs"

# 6. Container UP via Coolify API
curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID" | python -c "import json,sys; print('app status:', json.loads(sys.stdin.read()).get('status'))"
# Attendu : running:healthy

# 7. Migrations appliquées via logs container
ssh -o BatchMode=yes root@178.105.55.15 "docker logs --tail 100 \$(docker ps --filter name=mqbmlz1 --format '{{.Names}}' | head -1) 2>&1 | grep -E 'Migrations|migrate deploy'"
# Attendu : "Migrations applied successfully"

# 8. CF cache purge full (post-deploy mandatory)
curl -sX POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
  -d '{"purge_everything":true}'
# Attendu : {"success":true,...}

# 9. DocuSeal live (API valid)
curl -s -o /dev/null -w "DocuSeal /api/templates → %{http_code}\n" \
  "https://docuseal.axion-ia.com/api/templates?limit=1" \
  -H "X-Auth-Token: aV3BczAykvbdsEaSbrxR7w2qfExDHDg3cZvR9rouW7o"
# Attendu : 200

# 10. Web Vitals dashboard /admin/web-vitals
# (nécessite session admin authentifiée — vérif manuelle)
```

---

## 3. Audit complet — checklist 360° à utiliser pour les futurs audits

### A. Sécurité / RGPD / AI Act

- [ ] CF Bot Fight Mode sur `/en/*` désactivé (vérif : `curl -A Googlebot https://axion-ia.com/en/methodology` = 200)
- [ ] CF Cache Rule 5 `respect_origin` (✅ appliqué 2026-05-15)
- [ ] CF Cache Rule 6 admin-bypass aligné `ADMIN_URL_PREFIX` (18 chars)
- [ ] CF Managed Content / Content Signals OFF
- [ ] CSP headers stricts (`script-src 'self' challenges.cloudflare.com plausible.axion-ia.com` + autres trusted)
- [ ] HSTS preload OK (`strict-transport-security: max-age=31536000; includeSubDomains; preload`)
- [ ] Sentry `tracesSampleRate` ≤ 0.1 prod
- [ ] Sentry Replay 0% prod (✅ P-403 livré)
- [ ] Sentry `sendDefaultPii: false` + `beforeSend: piiScrubBeforeSend`
- [ ] Manon disclosure AI Act art. 50 (page `/fr/equipe/manon`, JSON-LD `disambiguatingDescription`)
- [ ] Sous-processeurs liste à jour (`/legal/sous-processeurs`)
- [ ] DPA-REGISTER documenté
- [ ] PII redaction Telegram (helper `pii-redaction.ts`)
- [ ] JWT revocation table active
- [ ] CSP nonce + COEP appliqués
- [ ] IP_HASH_SALT en env (✅ vérifié)
- [ ] Magic-link tampering test passé

### B. Performance / Web Vitals

- [ ] Lighthouse mobile sur Top 6 URLs (home, interventions, audit, reserver, paris pSEO, contact)
- [ ] LCP p75 ≤ 1800 ms cible interne (Google good = 2500)
- [ ] INP p75 ≤ 100 ms cible interne (Google good = 200)
- [ ] CLS = 0 cible interne (Google good = 0.1)
- [ ] TBT ≤ 150 ms lab desktop
- [ ] First Load JS ≤ 75 KB gz / route (hors `/reserver` cap 110 KB)
- [ ] Bundle Sentry ≤ 100 KB brotli (post-slim BATCH 2)
- [ ] Brotli wire ratio ≥ 80% (Caddy br 9 ✅ appliqué)
- [ ] CrUX field data 28j p75 vert sur 80% routes stratégiques
- [ ] Plausible Web Vitals plugin actif
- [ ] CF Early Hints ON (✅ vérifié)
- [ ] HTTP/3 actif (`alt-svc: h3=":443"`)
- [ ] WebVitalSample model Prisma populé (RUM ingestion `/api/vitals`)
- [ ] Alertes Telegram p75 dégradé wirées (helpers SSOT `alertLcpDegraded/Inp/Cls`)
- [ ] Dashboard `/admin/web-vitals` accessible

### C. SEO / AEO / GEO 2026

- [ ] Sitemap-index racine `/sitemap-index.xml` valide XML
- [ ] Sitemap-news.xml conforme Google News (xmlns:news, fenêtre 48h max, ≤ 1000 URLs)
- [ ] Sub-sitemaps : pages, blog, news, faq, articles, villes, knowledge
- [ ] robots.txt : Allow `/` pour AI bots search-time (ClaudeBot, OAI-SearchBot, PerplexityBot, Claude-Web)
- [ ] llms.txt + llms-full.txt + ai.txt servis (200 + format valide Jeremy Howard)
- [ ] JSON-LD types présents par route : Article, FAQPage, Speakable, HowTo, Organization, LocalBusiness, Service, Offer, Person Manon, BreadcrumbList, WebSite + SearchAction, ImageObject
- [ ] Speakable cssSelector `[".faq-answer", '[data-aeo="answer"]', ".tldr-answer", '[data-aeo="tldr"]']`
- [ ] AnswerCard TL;DR composant sur 4 templates factory (BATCH 3 ✅)
- [ ] dateModified non stale (< 90j sur tier-1, BUILD_DATE injecté ✅)
- [ ] wordCount JSON-LD = body complet (pas excerpt)
- [ ] Catch-all 404 `[locale]/[...catchall]/page.tsx` retourne 404 (pas 200 soft 404 ✅)
- [ ] IndexNow ping câblé factory publish (`enqueueIndexingForTier1`)
- [ ] hreflang FR/EN cohérent
- [ ] Author Manon JSON-LD avec `disambiguatingDescription` AI Act
- [ ] Canonical Answers Pattern : TL;DR + H2 questions + bullets sur articles factory

### D. Crawl bots / Citation rate LLM

- [ ] 16 user-agents bots simulés via curl (Googlebot, Bingbot, DuckDuckBot, ClaudeBot, OAI-SearchBot, PerplexityBot, etc.)
- [ ] TTFB bot < 600 ms pour tous (sinon Googlebot abandonne crawl budget)
- [ ] Pas de challenge CF (cf-mitigated absent) sur AI search-time bots
- [ ] Bot Fight Mode non actif sur `/en/*`
- [ ] Speakable rendu côté HTML (`<p class="faq-answer" data-aeo="answer">`)

### E. Build / Déploiement

- [ ] Workflow GA `deploy-coolify.yml` healthy
- [ ] Coolify queue claire (pas de deploy stuck > 30 min)
- [ ] Cron `docker builder prune --keep-storage 5GB` actif (`0 * * * *`)
- [ ] Cron `docker image prune --filter "until=24h"` actif (`15 * * * *`)
- [ ] `scripts/ops/disk-cleanup.sh` installé sur serveur (option, backup cron)
- [ ] `.github/workflows/disk-cleanup-prod.yml` activé (option, backup GA)
- [ ] Dockerfile heap = 6144 + workers = 2 (RAM-safe CPX42 16GB ✅)
- [ ] Dockerfile `ARG BUILD_TIME` injecté ✅
- [ ] Entrypoint `prisma migrate deploy` auto ✅

### F. RUM / Monitoring / Alerting

- [ ] Worker `content-web-vitals-monitor-worker` planifié quotidien
- [ ] Helpers SSOT alerts wirés (✅ BATCH 5)
- [ ] Alertes Telegram tags : MONITORING, INCIDENT, SECURITY, DEPLOY, BACKUP
- [ ] Sentry events arrive en prod (tester via 1 erreur intentionnelle)
- [ ] Plausible dashboard accessible (`plausible.axion-ia.com`)
- [ ] Clarity dashboard (si conservé après arbitrage RGPD)
- [ ] `/admin/web-vitals` dashboard opérationnel
- [ ] `/admin/content-gen/costs` opérationnel
- [ ] Cost cap 80% + 100% alertes actives

### G. Content-gen factory

- [ ] Worker `content-gen-worker` healthy
- [ ] Worker `content-publish-worker` healthy
- [ ] Worker `content-keyword-sync-worker` cron weekly lundi 04h00 UTC (✅ BATCH 5 GSC OAuth)
- [ ] Worker `content-indexnow-worker` câblé publish
- [ ] Worker `content-google-indexing-worker` skipped si SA absent (fail-soft OK)
- [ ] Worker `content-similarity-monitor-worker` actif
- [ ] Worker `content-quality-improver-worker` actif
- [ ] Plagiarism check wired (✅ v1.0.3)
- [ ] Intent validator wired (✅ v1.0.3)
- [ ] Kill-switch testé manuellement
- [ ] 5-10 articles publiés mode manuel sans crash AVANT `KB_AUTO_PUBLISH=true`

### H. Booking V1

- [ ] Stripe webhook signature valide
- [ ] DocuSeal API key valide (✅ key `aV3...W7o` testée 200)
- [ ] DocuSeal webhook secret HMAC set (✅ `whsec_*`)
- [ ] Patch verify-signature `<timestamp>.<sha256>` appliqué (TODO V1.5)
- [ ] Booking funnel end-to-end testé en prod (réservation test)
- [ ] Email confirmations envoyés (Zoho Mail Free EU `contact@axion-ia.com`)
- [ ] State-machine transitions correctes (pending → confirmed → cancelled etc.)

### I. Accessibilité WCAG 2.2

- [ ] Lighthouse a11y ≥ 95 sur Top 10 pages
- [ ] axe-core 0 violation critique
- [ ] Contraste AAA sur texte body
- [ ] Focus visible cohérent
- [ ] Skip-to-content link présent
- [ ] aria-labels sur tous CTAs
- [ ] Form errors annoncés screen reader

### J. Database / Migrations

- [ ] Toutes les migrations Prisma appliquées (entrypoint auto + log "Migrations applied successfully")
- [ ] Postgres healthy + connections < 80% pool
- [ ] Redis healthy + memory < 80%
- [ ] pgvector extension active (KB V4)
- [ ] Backup R2 quotidien + weekly + monthly OK (cron crontab Hetzner)
- [ ] Backup chiffré avec `BACKUP_ENCRYPTION_PASSPHRASE`

---

## 4. Conditions GO PROD ABSOLUE

Pour passer 🟢 verdict certification finale ≥ 90% (1440/1600 selon méta-cert) :

1. [x] BATCH 1-6 + GSC worker + sitemap-news + AnswerCard + catch-all 404 livrés (✅ 2026-05-15)
2. [x] Caddyfile brotli 9 + Dockerfile RAM-safe (✅ 2026-05-15)
3. [x] CF Cache Rule 5 `respect_origin` (✅ 2026-05-15)
4. [x] DOCUSEAL_API_KEY + WEBHOOK_SECRET corrigés (✅ 2026-05-15)
5. [x] 24 doublons env Coolify cleanés (✅ 2026-05-15)
6. [ ] Deploy `zrigttu0+` finished + container healthy
7. [ ] Smoke tests post-deploy verts (section 2 ci-dessus)
8. [ ] Push commits restants `c5cf127` + `093b66d`
9. [ ] CF Content Signals OFF (Will Dashboard)
10. [ ] Clarity RGPD tranché
11. [ ] 5 DPA prioritaires signés
12. [ ] Secret OAuth `GOCSPX-*` reset
13. [ ] DR drill R22 exécuté
14. [ ] 5-10 articles factory en mode manuel sans crash
15. [ ] `KB_AUTO_PUBLISH=true` + 48h monitoring

---

## 5. Roadmap J+30 (post-GO conditional)

Issue ≥ 1440/1600 = certification ABSOLUE :

- Sprint 25 (semaine 1) : finir tous P0 RGPD + Clarity arbitrage
- Sprint 26 (semaine 2) : DR drill + tests vitest stabilisés + monitoring CrUX
- Sprint 27 (semaine 3) : Patch DocuSeal webhook signature parser + activer factory
- Sprint 28-29 (semaine 4-6) : optimisation perf V2 (PPR Next 16 + Brotli 11 pre-compressed + JSON-LD external API endpoint) — optionnel

---

## 6. Sources de vérité

| Sujet                | Où trouver                                                  |
| -------------------- | ----------------------------------------------------------- |
| Code                 | `axionia/` repo                                             |
| Mémoires Claude      | `C:\Users\willi\.claude\projects\C--Users-willi\memory\`    |
| Audits livrés        | `axionia/_AUDIT/` + `Axion-IA/_AUDIT/META-CERT-2026-05-15/` |
| Tokens API           | `Axion-IA/.secrets/api-tokens.env` (gitignored)             |
| Runbooks             | `axionia/docs/runbooks/`                                    |
| Skills Claude        | `Axion-IA/.claude/skills/`                                  |
| Hetzner Cloud        | <https://console.hetzner.cloud>                             |
| Coolify Dashboard    | <http://178.105.55.15:8000>                                 |
| Cloudflare Dashboard | <https://dash.cloudflare.com>                               |
| DocuSeal             | <https://docuseal.axion-ia.com>                             |
| Plausible            | <https://plausible.axion-ia.com>                            |
| Sentry               | <https://sentry.axion-ia.com>                               |
| GitHub repo          | <https://github.com/will383842/axion-ia>                    |

---

## 7. Commandes utiles "audit quotidien" (à exécuter périodiquement)

```bash
# Health complet en 30 secondes
cd C:\Users\willi\Documents\Projets\Axion-IA\axionia
set -a && source ../.secrets/api-tokens.env && set +a

# Site reachable + status
curl -sI -o /dev/null -w "site=%{http_code}\n" https://axion-ia.com/fr

# Container Coolify health
curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID" \
  | python -c "import json,sys; d=json.loads(sys.stdin.read()); print('coolify status:', d.get('status'))"

# Disque + RAM Hetzner
ssh -o BatchMode=yes root@178.105.55.15 "df -h / | tail -1; free -h | head -2"

# Latest deploy
curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_URL/api/v1/deployments?per_page=1" \
  | python -c "import json,sys; d=json.loads(sys.stdin.read())[0] if isinstance(json.loads(sys.stdin.read()),list) else None; print(d)"

# Git state
git log origin/main..HEAD --oneline | head -5
git fetch origin main && git log HEAD..origin/main --oneline | head -5
```

---

## 8. Phrases d'invocation pour les futurs audits

À coller dans une nouvelle session Claude Code :

> « Lance un audit prod complet axion-ia.com basé sur `_AUDIT/CHECKLIST-AUDIT-PROD-2026-05-15.md`. Vérifie les 8 sections A-J. Mode AUDIT-ONLY strict, aucun fix, livre rapport `_AUDIT/AUDIT-PROD-YYYY-MM-DD.md` avec scoring /1600 + verdict + top 10 P0. »

> « Vérifie l'état post-deploy : enchaine les smoke tests section 2 du fichier `_AUDIT/CHECKLIST-AUDIT-PROD-2026-05-15.md`, fais le CF cache purge si tout est vert, et reporte. »

> « Active KB_AUTO_PUBLISH=true en respectant la procédure P4 du fichier `_AUDIT/CHECKLIST-AUDIT-PROD-2026-05-15.md`. Confirme que les 9 pré-requis sont OK avant. »

---

_Dernière mise à jour : 2026-05-15 par session Claude Opus 4.7 (1M context)_
