# PROMPT — SPRINT COMPLÉMENTAIRE SIGN-OFF PROD ABSOLU 2026

**Cible** : Axion-IA (`https://axion-ia.com`)
**Date prompt** : 2026-05-10
**Pré-requis** : Audit E2E V2.1 (`PROMPT-E2E-DEEP-AUDIT-2026.md`) déjà passé, verdict 🟢 ou 🟡, `WHAT-TO-DO-NOW.md` lu et P0 résolus.
**Mode** : **EXÉCUTION ENCADRÉE** — certaines actions touchent infra/prod. **Gates explicites** sur load test et DR drill.
**Output racine** : `_AUDIT/PROD-SIGNOFF-2026-05-10/`

Ce prompt couvre les **10 zones non validées** par l'audit V2.1 (cf. § 12 du master). Il transforme un "92-95 % prod-ready labo" en **sign-off prod absolu** (résilience sous charge + face attaquant + delivrability + RUM réel).

---

## 0. CONTRAT D'EXÉCUTION

Doctrine et garde-fous identiques à `PROMPT-E2E-DEEP-AUDIT-2026.md` § 0.1, 0.2, 0.4, 0.5. Lis-les avant.

### 0.1 Mode d'exécution

- **Phases 1→3 et 5→8** : auto-exécution (pas de gate).
- **Phase 4 (Load test)** : **GATE 1** — exige confirmation Will avant lancement (peut générer trafic réel).
- **Phase 9 (DR drill)** : **GATE 2** — exige environnement isolé confirmé Will (pas la DB prod).
- **Phase 10 (Pentest payloads actifs)** : auto-exécution **uniquement read-only probing**, jamais de payload destructif.

### 0.2 Périmètre prod live

- Load test → **staging dédié** OU **prod en heures creuses (3-5h UTC)** avec rate-limit 50 req/s max → confirmation Will obligatoire.
- DR drill → environnement isolé (Docker compose local OU snapshot Hetzner clone) → jamais sur prod.
- Pentest → prod live OK pour probing read-only (HEAD/GET avec payloads encodés non exécutables côté serveur).
- Email deliverability → envoi 5 emails test depuis `dpo@axion-ia.com` ou compte newsletter sandbox vers boîtes test (Gmail, Outlook, Yahoo, ProtonMail, OVH).
- Cross-browser → Playwright firefox + webkit en local **désactivés par défaut** (rappel mémoire : chromium only). Activer uniquement en CI ou avec `--reporter=list` minimal.

### 0.3 Livrables attendus

```
_AUDIT/PROD-SIGNOFF-2026-05-10/
├── MANIFEST.md
├── 01-LOAD-TEST/
│   ├── k6-script.js                ← script de charge
│   ├── results-baseline.json       ← métriques baseline
│   ├── results-stress.json         ← métriques stress
│   ├── REPORT-LOAD.md              ← analyse + verdict RPS supportés
├── 02-DR-DRILL/
│   ├── REPORT-DR-DRILL.md          ← restore réussi/échoué + RTO mesuré
│   ├── restore-log.txt             ← log brut du restore
├── 03-PENTEST/
│   ├── PENTEST-XSS.md
│   ├── PENTEST-SQLI.md
│   ├── PENTEST-IDOR.md
│   ├── PENTEST-SSRF-PROTO-POLLUTION.md
│   ├── PENTEST-HEADERS.md
│   ├── PENTEST-AUTH-SESSION.md
│   ├── REPORT-PENTEST-SYNTHESE.md
├── 04-EMAIL-DELIVERABILITY/
│   ├── mail-tester-results.txt     ← copie résultats mail-tester.com
│   ├── inbox-placement.md          ← Gmail/Outlook/Yahoo/Proton placement
│   ├── REPORT-EMAIL.md
├── 05-CRUX-RUM/
│   ├── crux-axion-ia-com.json      ← API CrUX response
│   ├── api-vitals-aggregation.md   ← /api/vitals aggregation 28 j
│   ├── search-console-coverage.md  ← [ACTION WILL screenshots]
│   ├── REPORT-CRUX-RUM.md
├── 06-CROSS-BROWSER/
│   ├── playwright-firefox.json
│   ├── playwright-webkit.json
│   ├── REPORT-CROSS-BROWSER.md
├── 07-MOBILE-REAL/
│   ├── lhci-mobile-throttled.json  ← Slow 4G + CPU 4× throttle
│   ├── playwright-mobile-iphone.json
│   ├── playwright-mobile-pixel.json
│   ├── REPORT-MOBILE.md
├── 08-ADMIN-RUNTIME/
│   ├── admin-routes-tested.md      ← après Will fournit creds sandbox
│   ├── REPORT-ADMIN.md
├── 09-STRIPE-PAYMENT/                ← si Stripe présent
│   ├── stripe-webhook-signature.md
│   ├── stripe-test-mode-flow.md
│   ├── REPORT-STRIPE.md
├── 10-LEGAL-DPA/
│   ├── DPA-CHECKLIST.md            ← items pour Will + DPO
│   ├── REPORT-LEGAL.md
├── SYNTHESE-SIGNOFF.md             ← verdict final 🟢 prod-ready ABSOLU / 🟡 conditionnel / 🔴
└── WHAT-TO-DO-FINAL.md             ← actionnable ≤ 3 p
```

---

## 1. PHASE 1 — LOAD TEST (k6) — GATE 1

**Objectif** : valider RPS supportés par CPX32 sans dégradation > p95 = 1500 ms.

### 1.1 Préparation (auto)

- Lire `Dockerfile`, `Caddyfile`, `next.config.ts` pour comprendre le sizing actuel.
- Identifier 5 routes représentatives : `/`, `/audit`, `/reserver`, `/implantations/ile-de-france/paris`, `/api/healthz`.
- Générer `k6-script.js` :
  - VU ramp 0→50 sur 1 min (baseline)
  - VU ramp 50→200 sur 2 min (stress)
  - hold 200 VU sur 3 min (saturation)
  - down 200→0 sur 1 min
  - thresholds : `http_req_duration p(95) < 1500ms`, `http_req_failed < 1%`

### 1.2 GATE 1 — confirmation Will requise

Avant lancement, écris dans console :

```
🛑 GATE 1 — LOAD TEST READY
Cible : https://axion-ia.com
Charge : 200 VU peak, 7 min total, ~14 000 requêtes
Heure UTC actuelle : <hh:mm>
Heures creuses recommandées : 03:00-05:00 UTC
Confirmer lancement ? (Will réponse explicite OUI/NON)
```

Si Will répond NON ou silence > 2 min → skip Phase 1, écrire `[SKIPPED — Will hold]` dans `REPORT-LOAD.md`.

### 1.3 Exécution

- `k6 run k6-script.js --out json=results-stress.json`
- Capturer Cloudflare analytics pendant le test (lecture API CF) : requests served from cache vs origin, 5xx count.
- Capturer Coolify CPU/RAM container pendant test (lecture API Coolify).

### 1.4 Analyse

- p50, p95, p99 latency par route
- error rate
- saturation point (RPS où p95 dépasse 1500 ms)
- bottleneck identifié (Caddy ? Next ? Postgres ? Redis ?)
- recommandation scaling (CPX32 → CPX42 nécessaire ? Cloudflare cache plus agressif ?)

---

## 2. PHASE 2 — DR DRILL — GATE 2

**Objectif** : prouver que `backup-postgres.sh` produit un dump **réellement restaurable** dans un délai RTO acceptable.

### 2.1 GATE 2 — environnement isolé

Avant lancement, écris :

```
🛑 GATE 2 — DR DRILL READY
Environnement cible : <à choisir>
  [A] Docker compose local (postgres-test container)
  [B] Snapshot Hetzner cloné en VM séparée
  [C] Sandbox Coolify (nouveau service postgres-dr-test)
NE PAS lancer sur la DB prod.
Will, choisis [A/B/C] ?
```

### 2.2 Procédure (option A par défaut si Will silence > 2 min)

1. `docker compose -f docker/docker-compose.yml up postgres` (DB locale propre).
2. Récupérer dernier dump Postgres (chemin selon `backup-postgres.sh`).
3. Lancer `restore-postgres-test.sh` chronométré.
4. Vérifier via `psql` :
   - count de chaque table principale (User, Booking, Lead, etc.)
   - intégrité référentielle (FK)
   - dernière migration appliquée (`_prisma_migrations`)
   - timezone DB UTC ?
5. Lancer `pnpm prisma:generate` + `pnpm typecheck` contre la DB restaurée.

### 2.3 Métriques

- **RTO mesuré** : durée totale restore (dump → DB queryable)
- **RPO théorique** : âge du dernier dump (depuis cron schedule)
- **Data integrity** : counts +/- 0 par rapport au dump source
- Verdict : 🟢 si RTO ≤ 30 min ET RPO ≤ 24 h, sinon dégradé.

---

## 3. PHASE 3 — PENTEST READ-ONLY (auto)

**Périmètre** : payloads d'attaque encodés, **non exécutables côté serveur**. Lecture HTTP responses uniquement. Aucun écrit DB, aucun email forcé.

### 3.1 XSS (`PENTEST-XSS.md`)

- Tester payloads classiques (`<script>alert(1)</script>`, `<img src=x onerror=…>`, `javascript:`, encodés URL/HTML/unicode) sur :
  - tous query params publics (`/recherche?q=`, `/blog?tag=`, etc.)
  - tous form fields publics (`/reserver`, `/contact`, newsletter)
- Vérifier que la response **sanitize** ou rejette (Zod) le payload, et que CSP nonce empêche l'exécution.
- **Ne pas soumettre** les forms en POST (eviter pollution DB) → utiliser `dry-run` côté audit OU vérifier le code de la server action.

### 3.2 SQLi (`PENTEST-SQLI.md`)

- Audit code Prisma : tout `$queryRaw` / `$executeRaw` ?
- Si présents → vérifier paramétrage strict.
- Probing endpoints API publics avec patterns `' OR 1=1--`, `'; DROP TABLE`, etc. → attendre 4xx propre, jamais 500 ni leak.

### 3.3 IDOR (`PENTEST-IDOR.md`)

- Endpoints exposant un ID dans URL ou body → vérifier scoping user-side (session.userId checked vs entity.userId).
- Tester accès anonyme à `/api/gdpr-export?userId=<random>` etc.
- Tester escalade entre rôles (USER → ADMIN).

### 3.4 SSRF + Prototype Pollution (`PENTEST-SSRF-PROTO-POLLUTION.md`)

- Y a-t-il un fetch côté serveur d'URL fournie par user (image upload from URL, webhook, etc.) ?
- Si oui → whitelist domaines ?
- Lib parsing JSON sécurisée (pas `merge` deep sans whitelist) ?

### 3.5 Headers (`PENTEST-HEADERS.md`)

- Re-check intégral : CSP nonce, HSTS, COOP/COEP/CORP, Permissions-Policy, Referrer-Policy, X-Content-Type-Options, X-Frame-Options/frame-ancestors.
- Tester `Origin` malicieux pour CORS.
- Tester `Host` header injection.

### 3.6 Auth/Session (`PENTEST-AUTH-SESSION.md`)

- JWT revocation effective ? (Sprint 24 fix)
- Cookie flags : Secure + HttpOnly + SameSite=Lax/Strict ?
- Session fixation possible ?
- Brute-force login : rate-limit en place ?
- Reset password token : single-use, expire ≤ 1 h, sécurisé ?

### 3.7 Synthèse

`REPORT-PENTEST-SYNTHESE.md` : top vulns trouvées par CVSS, recommandations, status (corrigé / à corriger / accepté).

---

## 4. PHASE 4 — EMAIL DELIVERABILITY (auto sauf envoi)

### 4.1 Validation structure

- `dig TXT axion-ia.com` SPF
- `dig TXT default._domainkey.axion-ia.com` DKIM (selector réel à découvrir via Resend)
- `dig TXT _dmarc.axion-ia.com` DMARC (policy quarantine/reject ?)
- `dig TXT _bimi.axion-ia.com` BIMI (bonus brand)
- TLS-RPT, MTA-STS si présents

### 4.2 Envoi test (5 boîtes)

**ACTION WILL** : confirmer 5 adresses test (Gmail, Outlook/Office365, Yahoo, ProtonMail, OVH/free). Sinon utiliser temp inboxes (mail-tester.com).

Envoyer :

- 1 email transactionnel via `/reserver` flow (sandbox booking)
- 1 email newsletter
- 1 email confirmation contact

Vérifier :

- inbox / spam / promo placement
- DKIM signature valide
- SPF aligned
- DMARC compliant
- mail-tester.com score ≥ 9/10

### 4.3 Templates Resend

- Audit visuel + accessibilité de chaque template (`_react-email-preview` ou `email/dev`)
- alt text images, font fallback, dark mode support
- unsubscribe link 1-click (RFC 8058)
- list-unsubscribe header

---

## 5. PHASE 5 — CrUX RUM 28 jours (auto)

### 5.1 CrUX API publique

```
curl -X POST 'https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=<API_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"origin":"https://axion-ia.com","formFactor":"PHONE"}'
```

Récupérer : LCP p75, INP p75, CLS p75, FCP p75, TTFB p75 — pour PHONE et DESKTOP.

Si CrUX dataset insuffisant (site trop jeune, peu de trafic) → noter `[CrUX INSUFFICIENT DATA — RUM trop jeune]`.

### 5.2 `/api/vitals` aggregation interne

- Lire la DB (modèle `WebVital` ou équivalent) pour 28 derniers jours.
- Aggréger p75 par route + global.
- Comparer avec CrUX si dispo.

### 5.3 Search Console

**ACTION WILL** : screenshots Search Console "Core Web Vitals" rapport mobile + desktop. Inclure dans `search-console-coverage.md`.

### 5.4 Verdict CrUX

- 🟢 vert si LCP < 2.5 s ET INP < 200 ms ET CLS < 0.1 (p75 mobile)
- 🟡 orange si l'un en `Needs Improvement`
- 🔴 rouge si l'un en `Poor`

---

## 6. PHASE 6 — CROSS-BROWSER (auto, prudence)

### 6.1 Pré-flight

- Vérifier que `pnpm exec playwright install firefox webkit` est OK (peut télécharger ~300 MB).
- Si environnement Windows local et la mémoire dit "chromium only" → **basculer en CI** (GitHub Actions) ou skip + flag.

### 6.2 Suite minimale

- 5 flows critiques (booking, contact, recherche, mega-menu, /reserver) sur firefox + webkit.
- Capture screenshots pour comparaison visuelle.
- Vérifier que le CSS terracotta + hero schema 576² + typo `titleEm` rendent identiques.

### 6.3 Verdict

- 🟢 si 0 différence fonctionnelle, ≤ 3 différences cosmétiques mineures.
- 🟡 si 1-2 différences fonctionnelles non bloquantes.
- 🔴 si flow booking cassé sur firefox ou webkit.

---

## 7. PHASE 7 — MOBILE REAL-DEVICE SIMULATION (auto)

### 7.1 Lighthouse mobile throttled

`lhci collect --url=http://localhost:3000/fr --preset=mobile-throttled --emulatedFormFactor=mobile --throttling.cpuSlowdownMultiplier=4` sur 5 URLs.

### 7.2 Playwright device emulation

- iPhone 14 (`devices['iPhone 14']`)
- Pixel 7 (`devices['Pixel 7']`)
- Galaxy S22 (`devices['Galaxy S22']` si dispo)

Tester : booking, mega-menu mobile, hero hauteur, tap targets ≥ 24×24, scroll-locked elements.

### 7.3 BrowserStack si budget

**ACTION WILL** : si tu acceptes ~$30/mois BrowserStack, lancer suite réelle iPhone/Pixel/Samsung. Sinon `[ACTION WILL — budget required]`.

---

## 8. PHASE 8 — ADMIN RUNTIME (semi-auto)

### 8.1 ACTION WILL

Will fournit :

- URL admin (`ADMIN_URL_PREFIX` actuel)
- email + password sandbox d'un compte ADMIN test
- précision : sandbox ou prod ?

### 8.2 Tests

Pour chaque section M9 (14 sections) :

- accès page (200)
- CRUD basique sur entité test (create + read + update + delete) — **uniquement en sandbox**
- export CSV / JSON si dispo
- droits ADMIN vs USER vérifiés (USER bloqué)
- audit-log écrit ?

### 8.3 Sécurité admin

- ADMIN_URL_PREFIX bien obscur ?
- 2FA disponible / forcé ?
- session timeout court (≤ 1 h) ?
- IP allowlist option ?

---

## 9. PHASE 9 — STRIPE / PAIEMENT (conditionnel)

### 9.1 Détection

- Grep `stripe`, `@stripe/`, `STRIPE_` dans le code.
- Si absent → `[N/A — pas de Stripe dans le périmètre]` et skip phase.

### 9.2 Si présent

- Mode test/live : env vars
- Webhook signature vérifiée (`stripe.webhooks.constructEvent`) ?
- Idempotency keys utilisés sur create paiement ?
- PCI scope minimal (Elements / Checkout, jamais carte raw côté serveur) ?
- Replay attack protection ?
- Refund flow audité ?
- Test 3DS forcé (carte test `4000 0027 6000 3184`) ?

---

## 10. PHASE 10 — LEGAL / DPA (action Will)

### 10.1 Checklist Will (`DPA-CHECKLIST.md`)

- [ ] DPA Hetzner papier signé (Allemagne, hébergeur principal)
- [ ] DPA Cloudflare online accepté (sous-processeur CDN)
- [ ] DPA Resend signé (sous-processeur email)
- [ ] DPA Sentry accepté (sous-processeur monitoring + PII)
- [ ] DPA Telegram (statut sous-processeur ? PII redaction Sprint 24.1 OK)
- [ ] Boîte `dpo@axion-ia.com` provisionnée et redirigée
- [ ] Mentions légales OÜ estonienne : registre, capital, siège complet
- [ ] CGV/CGU validées juriste (B2B EU)
- [ ] Politique cookies à jour avec sous-processeurs réels
- [ ] Registre traitements RGPD (`DPA-REGISTER.md`) à jour
- [ ] Consentement bannière conforme CNIL/EDPB 2024 (refus aussi simple qu'accepter)

### 10.2 Pas de bloquant code → bloquant légal

Si checklist incomplète : verdict global ne peut pas dépasser 🟡.

---

## 11. PHASE 11 — SYNTHÈSE & VERDICT SIGN-OFF

### 11.1 `SYNTHESE-SIGNOFF.md`

**Score consolidé** :
| Phase | Poids | Score |
|---|---|---|
| 01 Load test | ×1.5 | NN |
| 02 DR drill | ×1.5 | NN |
| 03 Pentest | ×1.5 | NN |
| 04 Email | ×1.0 | NN |
| 05 CrUX RUM | ×1.3 | NN |
| 06 Cross-browser | ×1.0 | NN |
| 07 Mobile | ×1.2 | NN |
| 08 Admin runtime | ×1.2 | NN |
| 09 Stripe | ×1.0 (si présent) | NN |
| 10 Legal/DPA | ×1.5 | NN |

**Verdict** :

- 🟢 **SIGN-OFF PROD ABSOLU** : score ≥ 92, 0 P0, RTO ≤ 30 min, p95 ≤ 1500 ms à 200 VU, CrUX p75 vert, Pentest 0 high, mail-tester ≥ 9/10, DPA complet
- 🟡 **CONDITIONAL SIGN-OFF** : score ≥ 85, P0 ≤ 2 mitigés
- 🔴 **NO SIGN-OFF** : sinon

### 11.2 `WHAT-TO-DO-FINAL.md` (≤ 3 p)

Format ultra-actionnable Will :

```markdown
# Axion-IA — Sign-off prod absolu

## Verdict : 🟢 / 🟡 / 🔴

## ⚡ Bloquant sign-off (P0)

- [ ] …

## 🎯 Recommandé (P1)

- [ ] …

## 🔍 Action Will (hors code)

- [ ] DPA Hetzner papier
- [ ] …

## 📁 Détails

- Synthèse : SYNTHESE-SIGNOFF.md
- Détails par phase : 01-LOAD-TEST/, 02-DR-DRILL/, …
```

---

## 12. PHRASE D'INVOCATION

> Lis `axionia/_AUDIT/PROMPT-PROD-SIGNOFF-COMPLEMENTAIRE-2026.md` et exécute-le intégralement Phase 1 → 11. Mode encadré : auto sur 1-3 et 5-8 et 10-11, **GATE 1** avant Phase 1 Load Test (confirmer fenêtre horaire), **GATE 2** avant Phase 2 DR Drill (confirmer environnement isolé). Pentest Phase 3 = read-only probing strict, jamais de payload destructif. Tous livrables dans `axionia/_AUDIT/PROD-SIGNOFF-2026-05-10/`. Termine par `WHAT-TO-DO-FINAL.md`.

---

**FIN DU PROMPT — V1.0 SIGN-OFF — 2026-05-10**
