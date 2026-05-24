# 🩺 PROMPT AUDIT E2E ROUTES HEALTH 2026 — vérification exhaustive bout-en-bout

> Audit master AUDIT-ONLY pour vérifier la santé de **TOUTES** les routes
> Axion-IA en production (`https://axion-ia.com` + admin `/<adminPrefix>/*`)
> + tester chaque page bilingue FR/EN + chaque API + chaque sitemap + chaque
> ressource (sitemaps, robots, llms.txt, IndexNow key) + l'admin complet
> (100+ pages) + le pipeline Content-Gen V1+V2 publié + la banque d'images
> (image-bank) une fois déployée + le pSEO villes (12 942 routes SSG).
>
> Déclenché par l'observation Will 2026-05-15 : `/fr/guide-ia`, `/fr/stack-ia`,
> `/fr/comparaisons` renvoient **500** et `/fr/admin-xfz5hk0j7hrk/login`
> affiche **« no available server »** (502/503 Coolify proxy). On veut une
> couverture **complète** + un diagnostic root-cause + le top patches priorisé.
>
> Mode **🔒 AUDIT-ONLY STRICT**. Zéro fix, zéro commit, zéro mutation prod.
> Production : **1 dossier** `_AUDIT/E2E-ROUTES-2026-XX-XX/` avec 11 fichiers.
>
> Score cible : **≥ 900 / 1000** (90 %) pour 🟢 GO « plateforme 100 % UP ».

---

```
Skill : axionia-core (mode 🔒 AUDIT E2E ROUTES HEALTH 2026)

Tu es l'auditeur de santé des routes Axion-IA en production. Tu n'as pas
le droit de coder, fixer, commiter, pousser, migrer, ni de déclencher
quoi que ce soit qui mute la prod. Tu OBSERVES + tu CARTOGRAPHIES +
tu MESURES + tu DIAGNOSTIQUES + tu PRESCRIS.

CONTEXTE OPÉRATIONNEL :
- Domaine prod : https://axion-ia.com (Cloudflare Free Phase 5 9/11 OK)
- Origin : Hetzner CPX42 178.105.55.15 Nuremberg, Coolify 4.0.0, Caddy 2
- Stack : Next 16 standalone + Postgres + Redis + BullMQ workers
- Stripe LIVE en mode V1, DocuSeal pending, Telegram alerts ON
- 8 jalons M1-M8 livrés + Sprints 15-24.1 + KB V4 + Content-Gen V1.0.3
- Admin scopé sous `/<locale>/<ADMIN_URL_PREFIX>/*` avec prefix random 32 chars
- Bilingue : FR canonical + EN miroir via `[locale]` segment
- Image-bank skill v1.1 prêt mais pages publiques `/galerie/*` PAS déployées
  (cf. mémoire `axionia_image_bank_skill_v1_1_2026-05-15.md`) — auditer
  l'EXISTENCE attendue + flagger les routes manquantes
- pSEO villes : 12 942 routes SSG (`/fr/implantations/[region]/[ville]`,
  `/audit/par-ville/[ville]`, `/interventions/par-ville/[ville]`,
  `/implementation/par-ville/[ville]`) — sample stratifié exigé

OBSERVATIONS USER 2026-05-15 (signaux faibles ROUTE-LEVEL) :
- /fr/guide-ia → 500
- /fr/stack-ia → 500
- /fr/comparaisons → 500
- /fr/admin-xfz5hk0j7hrk/login → « no available server » (502/503 Coolify)
- « plein d'autres pages » 500 (à inventorier exhaustivement)

CES PANNES ont des causes potentielles distinctes :
- 500 page-level = exception runtime React Server Component OU Prisma
  query échouée OU env var manquante OU import dynamique cassé OU
  catch-all /[...catchall] qui mange une route OU revalidate ISR qui
  re-build avec data corrompue OU schéma DB désynchro.
- « no available server » = Caddy/Coolify ne route pas vers le container
  → container DOWN, healthcheck rouge, OOM-killer, port mismatch, OU
  Coolify proxy mis-configuré sur le path admin.
- Plusieurs 500 simultanés = signal SYSTÉMIQUE (build artifact corrompu,
  variable d'env critique manquante, migration Prisma pending, lib
  partagée KO) — PAS de la mauvaise chance.

⛔ MODE AUDIT-ONLY STRICT — RÈGLES ABSOLUES :
- AUCUNE édition de code, AUCUN commit, AUCUN push, AUCUN migrate
- AUCUN appel API mutant (zéro POST/PUT/PATCH/DELETE sauf endpoints
  EXPLICITEMENT publics et idempotents type /api/indexnow GET)
- AUCUN restart Coolify, AUCUN deploy, AUCUN env var write
- Lighthouse / curl HEAD/GET / Playwright headless / Coolify API logs en
  LECTURE-SEULE autorisés
- Si un bug est trouvé : noter dans rapport → NE PAS fix
- Si une migration Prisma manque : noter → NE PAS migrate
- Si un env var manque : noter → NE PAS l'écrire en prod
- Seul livrable : dossier `_AUDIT/E2E-ROUTES-2026-XX-XX/`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

Référentiels mémoire + audits précédents :
1. _AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md (derniers patches V1.0.3)
2. _AUDIT/CHANGELOG-V1-BOOKING.md (état booking branch non mergée)
3. _AUDIT/PROMPT-CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL.md (réf perf 2026)
4. _AUDIT/PROMPT-PLATFORM-VERIFICATION-COMPLETE-2026.md (réf master cycle)
5. _AUDIT/PROMPT-E2E-DEEP-AUDIT-2026.md (réf master 5 phases V2.1)
6. _AUDIT/BACKLOG-ACTIONS-HUMAINES-2026-05-15.md (env vars à pousser)
7. _AUDIT/CI-SECRETS-REQUIRED.md (secrets requis prod)

Code stack — INVENTAIRE ROUTES :
8. axionia/src/app/[locale]/**/page.tsx (104 pages publiques)
9. axionia/src/app/[locale]/(admin)/[adminPrefix]/**/page.tsx (101 admin)
10. axionia/src/app/**/route.ts (32 routes API + sitemaps + textes)
11. axionia/src/app/[locale]/[...catchall]/page.tsx (catch-all fallback)
12. axionia/src/app/[locale]/not-found.tsx + error.tsx + loading.tsx
13. axionia/src/app/not-found.tsx (root 404)
14. axionia/src/app/maintenance/page.tsx (mode maintenance)
15. axionia/src/middleware.ts (rewrite locale + admin prefix + auth)
16. axionia/next.config.* (redirects + rewrites + headers)

Configs critiques :
17. axionia/.env.production.example (vars attendues prod)
18. axionia/Dockerfile (build + healthcheck)
19. axionia/coolify/*.yml (compose Coolify si versionné)
20. axionia/prisma/schema.prisma (modèles + migrations état)
21. axionia/src/lib/auth.ts (next-auth config + JWT)
22. axionia/src/lib/i18n.ts ou similar (locales FR + EN)
23. axionia/src/server/queue/workers/*.ts (workers BullMQ healthcheck)
24. axionia/src/app/api/healthz/route.ts (endpoint santé)

Sitemaps + référencement :
25. axionia/src/app/sitemap.ts + sitemap-index.xml/route.ts + sitemap-news.xml
26. axionia/src/app/llms.txt/route.ts + llms-full.txt/route.ts + ai.txt/route.ts
27. axionia/src/app/robots.ts ou similar
28. axionia/src/app/api/indexnow/key/route.ts (clé IndexNow exposée)

╔═══════════════════════════════════════════════════════════════════════╗
║                  INVENTAIRE EXHAUSTIF DES URLs (≈ 320 routes audit)   ║
╚═══════════════════════════════════════════════════════════════════════╝

L'auditeur DOIT générer un fichier `urls.tsv` exhaustif et le tester.
Catégories à couvrir SANS EXCEPTION :

──────────────────────────────────────────────────────────────────────────
A. PAGES PUBLIQUES STATIQUES (104 routes FR × 2 locales = 208 URLs)
──────────────────────────────────────────────────────────────────────────

Racines principales (test FR + EN systématique) :
- / (home)
- /a-propos /accessibilite /actualites /audit /audit/cible /audit/demande
- /audit/flash /audit/strategique-eti /audit/strategique-pme
- /blog /cas-concrets /centre-aide /comparaisons /components (à exclure
  si page de dev — flagger)
- /conditions-generales /confirmation /confirmation/newsletter /contact
- /cookies /demande-devis /demande-devis/confirmation /desabonnement
- /design (à exclure si page de dev — flagger) /equipe /faq /glossaire
- /guide-ia 🚨 (signalé 500 par user)
- /guides /implantations /implementation /implementation/agents
- /implementation/chatbot /implementation/crm-erp /implementation/documents
- /implementation/ia-custom /implementation/integrations
- /implementation/no-code /implementation/par-techno
- /implementation/processus /implementation/structuration
- /interventions (hub) + 17 sous-pages :
  /interventions/approfondie /interventions/atelier-ia-cible
  /interventions/claude-dirigeant /interventions/claude-implementation-individuel
  /interventions/coaching-avance /interventions/coaching-decouverte
  /interventions/collectives /interventions/conference
  /interventions/conference-keynote /interventions/conference-pleniere
  /interventions/demande /interventions/demarrage-ia-express
  /interventions/dirigeant-productivite /interventions/dirigeant-vision-strategique
  /interventions/dirigeants /interventions/essentielle
  /interventions/gagner-du-temps /interventions/individuel
  /interventions/intervention-claude
  /interventions/collectives/4h /interventions/collectives/1-jour
  /interventions/collectives/2-jours /interventions/collectives/3-jours-plus
- /mentions-legales /mes-donnees /mes-donnees/export /mes-ressources
- /methodologie /politique-confidentialite /politique-deplacement
- /preferences-cookies /presse /recherche /reserver /ressources /rgpd /roi
- /sections (à exclure si dev) /sous-processeurs
- /stack-ia 🚨 (signalé 500 par user)
- /comparaisons 🚨 (signalé 500 par user)

Pour CHAQUE : tester `https://axion-ia.com/fr/<path>` ET `https://axion-ia.com/en/<path>`.
Vérifier aussi la racine sans locale (`https://axion-ia.com/<path>`) : doit
redirect 308 vers `/fr/<path>` (cf. middleware locale).

──────────────────────────────────────────────────────────────────────────
B. PAGES PUBLIQUES DYNAMIQUES — DETAIL [slug]/[id]/[ville] (≈ 80 URLs sample)
──────────────────────────────────────────────────────────────────────────

Pour chaque type, prendre 5 slugs réels via DB ou sitemap (NE PAS deviner) :
- /actualites/[slug] × 5 articles factory récents (priorité Content-Gen V2)
- /blog/[slug] × 5 (héritage avant V2)
- /blog/auteur/[slug] × 2 (auteur Manon + admin)
- /blog/categorie/[slug] × 3
- /blog/secteur/[slug] × 3
- /blog/service/[slug] × 3
- /blog/tag/[slug] × 3
- /blog/taille/[slug] × 4 (TPE/PME/ETI/Grand Compte)
- /cas-concrets/[slug] × 5 case studies réels
- /cas-concrets/secteur/[slug] × 3
- /centre-aide/[slug] × 5 help articles
- /centre-aide/categorie/[slug] × 3
- /comparaisons/[slug] × 5 comparatifs réels
- /equipe/[slug] × 1 (manon disclosed)
- /faq/[slug] × 5 FAQ slugs
- /guides/[slug] × 5
- /implantations/[region] × 13 (toutes régions INSEE)
- /implantations/[region]/[ville] × 10 sample stratifié :
  - Paris + Lyon + Marseille (top 3 grandes)
  - 4 villes moyennes random Auvergne-Rhône-Alpes
  - 3 villes petites random (Nouvelle-Aquitaine, Bretagne, Occitanie)
- /implementation/par-fonction/[slug] × 5
- /implementation/par-ville/[ville] × 5 (sample stratifié)
- /audit/par-ville/[ville] × 5 (sample stratifié)
- /interventions/par-ville/[ville] × 5 (sample stratifié)
- /booking/[token]/cancel × 1 (token de test admin)
- /booking/[token]/reschedule × 1

Volume sample : ≈ 80 URLs × 2 locales = **160 URLs dynamiques testées**.
Si pSEO villes : étendre à 50 sample (5 par région × 13 régions) si timing.

──────────────────────────────────────────────────────────────────────────
C. ADMIN — ESPACE PRIVÉ (101 pages SOUS PREFIX ENV)
──────────────────────────────────────────────────────────────────────────

Préfixe admin : `$ADMIN_URL_PREFIX` (32 chars random côté Coolify env vars).
Will doit fournir le prefix actuel OU il est lu depuis `.env.production` si
versionné OU vérifier dans Coolify env vars via API LECTURE-SEULE.

🚨 PANNE ACTUELLE OBSERVÉE : `/fr/admin-xfz5hk0j7hrk/login` → « no available
server ». Diagnostic prioritaire (cf. AGENT 9 root-cause).

Pour CHAQUE page admin, tester :
1. **Non authentifié** → doit retourner 200 sur `/login` OU redirect 307 vers
   `/<adminPrefix>/login` si protégée
2. **Authentifié admin** (avec session test si Will fournit cookie) → doit
   retourner 200 sans erreur RSC

Catégories admin (101 pages) :
- /admin (dashboard root)
- /admin/login (entrée auth) 🚨 (signalé KO)
- /admin/2fa/setup
- /admin/activity-logs /admin/alerts /admin/analytics
- /admin/blog + /admin/blog/new + /admin/blog/[id]
- /admin/calendrier + /admin/calendrier/heatmap + /admin/calendrier/reschedule
- /admin/case-studies + /admin/case-studies/new + /admin/case-studies/[id]
- /admin/categories + /admin/categories/new + /admin/categories/[id]
- /admin/connaissances + /admin/connaissances/nouvelle
  + /admin/connaissances/[id] + /admin/connaissances/[id]/apercu
- **/admin/content-gen** (sous-tree 40 pages) :
  - / (dashboard) /author/manon /costs /coverage /coverage/new /coverage/[id]
  - /geo /geo/batches /geo/batches/new /geo/batches/[id] /geo/history
  - /geo/[villeSlug]/generate
  - /jobs /jobs/[id] /kb-readonly /kb-readonly/[id] /keyword-tracking
  - /landing-variants /landing-variants/[variant] /onboarding /orchestrator
  - /publications /publications/[id]/edit /publications-status /quality /queue
  - /review-queue /review-queue/[id] /rss /rss/new /rss/[id]
  - /settings + 12 sous-pages (audience-mix, banned-phrases, batches,
    coverage-distribution, kb-ingest, kill-switch, llms-txt, policies,
    providers, qa-policies, quality-loop, search-intent-distribution)
  - /similarity-monitor /templates /templates/new /templates/[id]
- /admin/devis + /admin/devis/new + /admin/devis/[id]
- /admin/echeanciers /admin/factures + /admin/factures/[id]
- /admin/faq + /admin/faq/new + /admin/faq/[id]
- /admin/help + /admin/help/new + /admin/help/[id]
- /admin/infra (monitoring)
- /admin/newsletter
- /admin/options + /admin/options/[id]
- /admin/paiements /admin/reservations + /admin/reservations/[id]
- /admin/settings + /admin/settings/new + /admin/settings/[key]
- /admin/submissions + /admin/submissions/[id]
- /admin/testimonials + /admin/testimonials/new + /admin/testimonials/[id]
- /admin/users + /admin/users/new + /admin/users/[id]
- /admin/web-vitals (Sprint 16 livré)

Si Will fournit creds admin test :
- Tester 100 % admin authentifié
- Smoke navigation (3 clics depuis dashboard)
- Tester /admin/content-gen/* CŒUR du runtime factory

Si Will ne fournit PAS creds :
- Tester accès anonyme uniquement (status code + redirect chain)
- Noter que coverage authentifié est PARTIEL

──────────────────────────────────────────────────────────────────────────
D. ROUTES API + WEBHOOKS (32 endpoints)
──────────────────────────────────────────────────────────────────────────

API publiques (test GET idempotent) :
- GET /api/healthz → 200 + JSON { status, version, db, redis, queue }
- GET /api/indexnow/key → 200 + clé text/plain
- GET /api/og?title=... → 200 image/png 1200×630
- GET /api/markdown/[type]/[slug] (type=actualites|faq|connaissances|cas)
  → 200 text/markdown si activé sinon 404
- GET /api/vitals → 405 Method Not Allowed (endpoint POST-only)

API webhooks (vérifier 405 sur GET, 401 sur POST sans sig) :
- POST /api/stripe/webhook (sans signature → 401/400)
- POST /api/docuseal/webhook (sans signature → 401/400)
- POST /api/auth/[...nextauth] (NextAuth flows)
- POST /api/indexnow (sans token → 401)
- POST /api/internal/revalidate (sans secret → 401)
- POST /api/internal/kb/ingest (sans secret → 401)
- GET /api/internal/kb/search (sans secret → 401)
- POST /api/gdpr-export (anon → 401)
- POST /api/gdpr-export/request (anon → 401)
- POST /api/unsubscribe (sans token → 400)
- POST /api/content-gen/export (admin-only → 401)
- POST /api/content-gen/geo-events (admin-only → 401)
- GET /api/content-gen/jobs/[id]/stream (SSE — vérifier 401 sans auth)
- GET /api/content-gen/preview/[jobId] (admin-only → 401)

Admin downloads (vérifier 401 sans auth, pas de fuite anon) :
- GET /api/admin/invoices/[id]/pdf
- GET /api/admin/newsletter/export
- GET /api/admin/submissions/export

──────────────────────────────────────────────────────────────────────────
E. SITEMAPS + RÉFÉRENCEMENT (10 ressources critiques)
──────────────────────────────────────────────────────────────────────────

- GET /sitemap.xml → 200 application/xml (root ou sitemap-index)
- GET /sitemap-index.xml → 200 application/xml (split)
- GET /sitemap-news.xml → 200, < 1000 URLs récentes (< 48h Google News)
- GET /sitemap-pages.xml (si présent — sinon flagger)
- GET /sitemap-faq.xml (si présent)
- GET /sitemap-villes.xml (si présent — 12 942 URLs split)
- GET /sitemap-connaissances.xml (si présent)
- GET /robots.txt → 200, lignes Allow/Disallow cohérentes, Sitemap pointing
- GET /llms.txt → 200 text/plain markdown structuré
- GET /llms-full.txt → 200 text/plain (version exhaustive LLM)
- GET /ai.txt → 200 (opt-in/out training IA)
- GET /<INDEXNOW_KEY>.txt → 200, contenu = clé brute (vérification Bing)

──────────────────────────────────────────────────────────────────────────
F. ROUTES IMAGE-BANK (future-proof, skill v1.1 prêt)
──────────────────────────────────────────────────────────────────────────

Cf. mémoire `axionia_image_bank_skill_v1_1_2026-05-15.md` : skill prêt
mais pages publiques `/galerie/*` PAS encore en prod. Auditer :
- /galerie (hub) → 404 attendu OU 200 si déployé entre temps
- /galerie/[slug] → idem
- /sitemap-images.xml → 404 attendu OU 200
- /api/image-bank/* (upload, variants, license) → admin scope
- /admin/image-bank (si déployé)

Si tout 404 : noter dans rapport « image-bank pas encore en prod, skill
v1.1 prêt, P1 deploy à planifier ».

──────────────────────────────────────────────────────────────────────────
G. ROUTES SPÉCIALES + FALLBACKS
──────────────────────────────────────────────────────────────────────────

- /maintenance → 200 si mode maintenance ON, sinon 404
- /<locale>/[...catchall] → tester 5 URLs random invalides → doit retourner
  404 propre (pas 500, pas blank) avec page custom not-found.tsx
- Test asset 404 : /favicon.ico /apple-touch-icon.png /opengraph-image.png
  /robots.txt /sitemap.xml (déjà testés)
- Test redirect locale : `/about` (sans locale) → 308 vers `/fr/a-propos`
- Test redirect 404 → not-found
- Test redirect EN ↔ FR via switcher (hreflang round-trip)

╔═══════════════════════════════════════════════════════════════════════╗
║                  10 AGENTS PARALLÈLES                                 ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 1 — Inventaire + matrice HTTP status (CŒUR) ════════════════ /200

Générer le fichier `urls.tsv` exhaustif (≈ 320 URLs avec colonnes :
url, category, locale, expected_status, dynamic, auth_required, source).

Tester CHAQUE URL via curl headless :
- HEAD first (économie bande passante)
- Si HEAD 405/501 → fallback GET
- Suivre redirects (max 5)
- Timeout 10s

Colonnes mesurées par URL :
- final_status (200/301/302/304/307/308/401/403/404/410/500/502/503/504)
- redirect_chain (liste des Location)
- ttfb_ms (curl -w time_starttransfer)
- total_ms (curl -w time_total)
- content_type
- content_length
- cf_cache_status (HIT/MISS/EXPIRED/DYNAMIC/BYPASS)
- cf_ray (debug Cloudflare)
- x_powered_by (Next-On-Coolify ? Caddy ?)
- server (Caddy ? Cloudflare ?)

Script type (à inclure dans `agent1-crawl.sh`) :
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="https://axion-ia.com"
OUT="agent1-status.tsv"
echo -e "url\tstatus\tttfb_ms\ttotal_ms\tctype\tcf_cache\tcf_ray\tlocation" > "$OUT"
while IFS=$'\t' read -r url _; do
  resp=$(curl -sIL --max-time 10 -A "Mozilla/5.0 AxionAuditor/1.0" \
    -w "\n%{http_code}\t%{time_starttransfer}\t%{time_total}\t%{content_type}" "$url" || true)
  # parse + write...
done < urls.tsv
```

Gates ROUGE :
- TOUT 500/502/503/504 sur page publique = ROUGE
- TOUT 500 sur API publique (healthz, indexnow/key) = ROUGE
- TOUT 401/403 sur page publique non-auth-gated = ROUGE
- `/admin/<adminPrefix>/login` ≠ 200 = ROUGE 🚨
- TOUT 404 sur page listée dans sitemap.xml = ROUGE
- TOUT 200 sur page admin sans auth (fuite) = 🚨 CRITIQUE
- `/sitemap.xml` ≠ 200 = ROUGE
- `/llms.txt` ≠ 200 (depuis Sprint 22) = ROUGE
- TTFB > 1500 ms sur 10 %+ pages = ROUGE (Cloudflare ou origin lent)

Livrable AGENT 1 :
- `urls.tsv` (inventaire complet)
- `agent1-status.tsv` (matrice mesures)
- `agent1-crawl.sh` (script reproductible)
- `agent1-summary.md` (TOP 30 URLs cassées + heatmap par catégorie)

═══ AGENT 2 — HTML quality + RSC integrity ═══════════════════════════ /150

Pour 50 URLs sample (couvrant les 7 catégories) télécharger le HTML rendu
côté serveur (curl GET, suivre redirects) et auditer la qualité du DOM
sans exécuter JS.

Checks par page :
- `<title>` présent, < 60 chars, unique
- `<meta name="description">` présent, 120-160 chars
- `<link rel="canonical">` cohérent avec URL
- `<link rel="alternate" hreflang="fr">` + `hreflang="en">` + `x-default`
- `<meta property="og:*">` (title, description, image, type, url)
- `<meta name="twitter:*">` (card, title, description, image)
- `<meta name="robots">` (index|noindex cohérent avec route type)
- `<html lang="fr">` ou `lang="en">` selon locale
- JSON-LD `<script type="application/ld+json">` présent
  - Pages produit → Service / Offer
  - Articles → Article + author + datePublished
  - FAQ → FAQPage
  - Pages ville → LocalBusiness ? Place ?
  - Home → Organization + WebSite + SearchAction
  - Breadcrumb → BreadcrumbList sur 100 % pages
- Pas d'erreur dans HTML : balises non fermées, doctype OK
- Pas de placeholder visible type `{{TBD}}` `[TODO]` `lorem ipsum` `XXX`
- Pas de leak prod : pas de chemin `/Users/willi/`, pas de SECRET visible,
  pas de stacktrace embeddé
- RSC payload `__next_f` présent et bien-formé (pas tronqué)
- Pas de class `error` ou de message « error » dans body principal

Gates ROUGE :
- Titre dupliqué entre > 5 pages = ROUGE
- Canonical pointant vers domaine wrong (localhost, axionia.eu, etc.) = ROUGE
- Hreflang manquant sur page bilingue = ROUGE
- JSON-LD invalide (parse error JSON) = ROUGE
- Placeholder visible sur page indexable = ROUGE
- Leak chemin local ou secret = 🚨 CRITIQUE

Livrable AGENT 2 :
- `agent2-html.tsv` (50 URLs × 20 critères)
- `agent2-jsonld/<slug>.json` (extraits JSON-LD parsés)
- `agent2-issues.md`

═══ AGENT 3 — Diagnostic 500 root-cause (FORENSIQUE) ═════════════════ /150

Pour CHAQUE page qui retourne 500 (cf. AGENT 1) :

3.1 — Récupérer logs Coolify
- Coolify API LECTURE-SEULE (mémoire `axionia_coolify_api_authorization.md`) :
  GET /api/v1/applications/{uuid}/logs?lines=500&since=10m
- Filtrer stacktrace Next.js correspondant à l'URL
- Identifier : module file:line, error message, cause root (Prisma ? RSC ?
  env var ? import ? null pointer ?)

3.2 — Hypothèses à valider (par ordre de probabilité)
- **H1 — env var manquante** : grep `src/app/<route>/page.tsx` pour
  `process.env.*` et vérifier que chaque var est listée dans Coolify env vars
  (lecture API). Ex : `NEXT_PUBLIC_SITE_URL`, `STRIPE_SECRET_KEY`,
  `RESEND_API_KEY`, `DATABASE_URL`, `INDEXNOW_KEY`, `ADMIN_URL_PREFIX`.
  Mémoire pointe `NEXT_PUBLIC_SITE_URL` comme action humaine pending.
- **H2 — Prisma migration pending** : comparer `prisma/migrations/*` HEAD
  vs prod `_prisma_migrations` table. Si lag → toute query échoue.
- **H3 — Build artifact corrompu** : mémoire signale Next 16 + Windows
  `prerender-manifest.json` peut être tronqué. Vérifier déploiement
  date et hash commit en prod via `/api/healthz` ou Coolify.
- **H4 — Catch-all greedy** : `/[...catchall]/page.tsx` mange peut-être
  des routes valides. Tester `/fr/foo-bar-inexistant` → doit être 404.
- **H5 — Import dynamique cassé** : si une page import un module supprimé
  ou un Server Component qui throw au render → 500.
- **H6 — Data DB manquante** : ex `/blog/categorie/[slug]` si la catégorie
  n'existe plus → si pas de `notFound()`, throw → 500.
- **H7 — DOM diffing RSC** : Next 16 peut throw sur mismatch hydration
  → vérifier console browser via Playwright headless.

3.3 — Pour les 3 routes signalées par user (/fr/guide-ia, /fr/stack-ia,
/fr/comparaisons) : faire le diagnostic complet H1 → H7 et conclure root cause.

3.4 — Pour `/fr/admin-<prefix>/login` « no available server » :
- Vérifier Coolify status container : RUNNING ? healthcheck rouge ?
- Vérifier port mapping Caddy : 3000 → container ?
- Vérifier mémoire/CPU container (OOM-killed récemment ?)
- Vérifier middleware.ts : segment `(admin)` est-il correctement mappé ?
- Tester sans le préfix locale : `https://axion-ia.com/admin-<prefix>/login`
  (le préfix locale `/fr/` est-il obligatoire ou middleware le tolère ?)
- Vérifier dans Coolify si le path admin a une règle proxy spécifique
  (rare mais possible si Will a configuré quelque chose pour l'admin)

Gates ROUGE :
- > 3 routes en 500 sans root cause identifiée = ROUGE
- Admin login 502/503 sans cause identifiée = 🚨 CRITIQUE
- Migration Prisma pending détectée = ROUGE
- env var critique manquante en prod = ROUGE

Livrable AGENT 3 :
- `agent3-500-rootcause.md` (synthèse par URL cassée → hypothèse retenue)
- `agent3-logs-coolify.txt` (extraits logs pertinents)
- `agent3-env-diff.md` (env vars attendues vs présentes en prod)

═══ AGENT 4 — Auth + admin coverage (espace privé) ═══════════════════ /120

Tester l'espace admin de façon STRUCTURÉE :

4.1 — Sans authentification (toutes les pages admin)
- Chaque URL `/<locale>/<adminPrefix>/<page>` doit retourner :
  - 200 sur `/<adminPrefix>/login` (page publique d'entrée)
  - 307 vers `/<adminPrefix>/login?next=...` sur tout autre admin path
  - JAMAIS 200 sur admin protégé sans session
  - JAMAIS 500
  - JAMAIS « no available server » (502/503)

4.2 — Vérifier rate limiting sur /login
- 10 tentatives en < 1 min : doit déclencher 429 ou captcha (Turnstile)
- Sans dépasser ce seuil pour pas pourrir les logs

4.3 — Si Will fournit cookie admin valide (variable optionnelle `ADMIN_SESSION_COOKIE`)
- Tester les 101 pages admin authentifiées
- Mesurer status 200 + TTFB
- Vérifier que `/admin` dashboard charge sans erreur RSC
- Vérifier sous-tree `/admin/content-gen/*` (40 pages CŒUR de la factory)
- Vérifier `/admin/web-vitals` Sprint 16
- Vérifier `/admin/infra` (monitoring)
- Vérifier `/admin/reservations` + `/admin/factures` + `/admin/devis`

4.4 — 2FA flow (si activé)
- `/admin/2fa/setup` accessible après auth ?
- Cookies de session vivants après refresh ?

4.5 — Permissions / rôles
- Si Will a multi-rôles (admin, editor, viewer) : tester chaque rôle
- Si pas implémenté : flagger comme info, pas bloquant

4.6 — Admin command palette (Cmd+K)
- Mémoire signale `AdminCommandPalette` livré (V1.0.3 fixes)
- Vérifier que la palette est accessible sur toutes les pages admin

Gates ROUGE :
- Page admin protégée retournant 200 sans session = 🚨 CRITIQUE
- /login retournant 500/502/503 = ROUGE
- Pas de redirect vers login sur path admin protégé = ROUGE
- > 10 % pages admin authentifiées en 500 = ROUGE

Livrable AGENT 4 :
- `agent4-admin-anon.tsv` (101 URLs × status anon)
- `agent4-admin-auth.tsv` (101 URLs × status auth, si cookie fourni)
- `agent4-admin-issues.md`

═══ AGENT 5 — Bilingue FR ↔ EN parity ════════════════════════════════ /80

Pour CHAQUE page publique (104 routes) :
- Tester `/fr/<path>` ET `/en/<path>`
- Vérifier hreflang dans `<head>` :
  - `<link rel="alternate" hreflang="fr" href="https://axion-ia.com/fr/...">`
  - `<link rel="alternate" hreflang="en" href="https://axion-ia.com/en/...">`
  - `<link rel="alternate" hreflang="x-default" href="https://axion-ia.com/fr/...">`
- Vérifier que le switcher de locale dans header pointe vers la VRAIE
  page miroir (pas vers home EN générique)
- Détecter contenu FR servi sur path EN (et inverse) :
  - Heuristique : présence de mots typiquement FR/EN dans `<h1>` et `<title>`
- Détecter slug FR vs EN cohérent
  (ex : `/a-propos` FR ↔ `/about` EN, ou même slug si choix global)

Gates ROUGE :
- > 20 % pages EN servent du FR = ROUGE (contenu manquant en EN)
- Hreflang `x-default` absent sur > 50 % pages = ROUGE
- Hreflang pointant vers URL 404 = ROUGE

Livrable AGENT 5 :
- `agent5-bilingue.tsv` (104 routes × 8 critères)
- `agent5-content-gaps.md` (pages EN qui mirror mal le FR)

═══ AGENT 6 — Performance Web Vitals smoke (10 routes critiques) ═════ /80

Pas un audit perf exhaustif (cf. PROMPT-CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL)
mais un smoke test sur 10 routes critiques pour détecter régression majeure :

Routes smoke (Lighthouse mobile + desktop) :
1. /fr (home)
2. /fr/interventions
3. /fr/reserver
4. /fr/contact
5. /fr/audit/flash
6. /fr/actualites (liste factory)
7. /fr/actualites/<slug-récent> (un article récent)
8. /fr/implantations/ile-de-france/paris (pSEO pilote)
9. /fr/faq
10. /fr/<adminPrefix>/login (admin public entry)

Métriques mesurées :
- LCP / INP / CLS / TTFB / FCP
- Score Lighthouse Perf
- Bundle JS first-load (gzip)
- Console errors browser (réseau 4xx/5xx + JS exceptions)

Gates ROUGE :
- LCP > 2.5 s mobile sur 5+ routes = ROUGE
- Score Perf < 70 sur 3+ routes = ROUGE
- Console errors > 5 sur une page = ROUGE
- Asset 404 dans console (CSS/JS/image manquant) = ROUGE

Livrable AGENT 6 :
- `agent6-vitals.tsv`
- `agent6-lh/*.json` (rapports Lighthouse bruts)
- `agent6-console-errors.md`

═══ AGENT 7 — Sitemap + référencement crawlability ═══════════════════ /80

7.1 — Vérifier intégrité sitemaps
- /sitemap.xml ou /sitemap-index.xml retourne 200 + bien formé XML
- Compter URLs totales annoncées
- Pour chaque sous-sitemap : compter URLs + valider lastmod ISO 8601
- Détecter URLs en sitemap qui retournent 404/500 (cf. AGENT 1) → ROUGE
- Détecter URLs en prod indexables qui ne sont PAS en sitemap → ORANGE
- Vérifier sitemap-news.xml : < 1000 URLs, toutes < 48h

7.2 — robots.txt
- Cohérence avec stratégie (cf. mémoire AEO/GEO) :
  - Allow Googlebot, Bingbot, ClaudeBot, OAI-SearchBot, PerplexityBot,
    GPTBot (training : décision Will)
  - Disallow /admin/*, /api/*, /booking/*/cancel, /booking/*/reschedule
- Directive Sitemap: présente et correcte

7.3 — llms.txt + llms-full.txt + ai.txt
- /llms.txt format markdown : titre + résumé + sections de liens
- /llms-full.txt : version exhaustive avec contenu inline
- /ai.txt : opt-in/out training cohérent

7.4 — IndexNow
- /<INDEXNOW_KEY>.txt retourne 200 + clé brute en text/plain
- Pas de fuite de clé en clair dans HTML

Gates ROUGE :
- Sitemap.xml 404/500 = ROUGE
- > 5 % URLs sitemap en 404 = ROUGE
- > 10 % URLs sitemap en 500 = ROUGE
- robots.txt bloque accidentellement / (Disallow: /) = 🚨 CRITIQUE
- ClaudeBot/OAI-SearchBot/PerplexityBot bloqués = ROUGE (perte GEO)
- llms.txt 404 = ORANGE (P1)

Livrable AGENT 7 :
- `agent7-sitemap-coverage.tsv`
- `agent7-robots.md`
- `agent7-indexnow.md`

═══ AGENT 8 — Sécurité headers + CSP + cookies ═══════════════════════ /80

Pour 20 URLs sample (publiques + admin + API) vérifier headers HTTP :

Headers OBLIGATOIRES (sinon ROUGE) :
- `Content-Security-Policy` avec nonce (Sprint 24 livré)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` ou CSP frame-ancestors
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: ...` (caméra, micro, géoloc OFF par défaut)
- `Cross-Origin-Opener-Policy: same-origin` (Sprint 24)
- `Cross-Origin-Embedder-Policy: require-corp` ou `credentialless`

Cookies de session admin :
- `Secure` flag ON
- `HttpOnly` flag ON
- `SameSite=Lax` ou `Strict`
- Pas de cookie sensible exposé en clair

CSP audit specifique :
- Pas de `'unsafe-inline'` sur script-src (sauf avec nonce)
- Pas de `'unsafe-eval'`
- Domaines tiers whitelistés : Plausible, Clarity, Stripe, Cloudflare,
  Turnstile, Sentry — pas plus
- Reporting endpoint configuré (report-uri ou report-to)

Gates ROUGE :
- CSP absent sur page admin = 🚨 CRITIQUE
- HSTS absent ou max-age < 6 mois = ROUGE
- Cookie session sans HttpOnly = 🚨 CRITIQUE
- CSP avec `'unsafe-eval'` ou `*` wildcard = ROUGE

Livrable AGENT 8 :
- `agent8-headers.tsv` (20 URLs × 12 headers)
- `agent8-csp-analysis.md`
- `agent8-cookies.md`

═══ AGENT 9 — Infra + container + healthcheck (root cause 502/503) ══ /80

CŒUR du diagnostic « no available server » sur /admin/login.

9.1 — Coolify API LECTURE-SEULE
- GET /api/v1/applications/{uuid} → status container
- GET /api/v1/applications/{uuid}/logs?lines=200 → last logs
- GET /api/v1/applications/{uuid}/environment → env vars list (clés seules,
  PAS de valeurs)
- GET /api/v1/applications/{uuid}/deployments → 5 derniers deploys

9.2 — Healthcheck endpoint
- `/api/healthz` retourne quoi ? Container considéré healthy par Coolify ?
- Si healthcheck rouge → Coolify retire le container du pool → « no
  available server » du proxy Caddy → C'est probablement ÇA

9.3 — Mémoire/CPU container
- Dernière utilisation RAM ? Si proche 16 GB CPX42 → OOM-killer
- CPU 100 % soutenu ?

9.4 — Workers BullMQ
- Lecture `src/server/queue/workers/*.ts`
- Vérifier en logs Coolify qu'aucun worker n'est en boucle crash
  (mémoire signale 3 alertes Telegram câblées Sprint S0bis)
- Vérifier Telegram channel : alertes récentes ?

9.5 — Postgres + Redis
- Connexions actives ? Pool saturé ?
- Redis maxmemory atteint ?

9.6 — Caddy reverse proxy config
- Lecture `axionia/Dockerfile` ou Coolify Caddyfile
- Vérifier que ALL routes (publiques + admin) pointent vers même upstream
- Vérifier ports + timeouts (read/write)

9.7 — Deploys récents
- Dernier deploy = succès ? Build OK ? Container UP après ?
- Mémoire signale `pfndla7bebvzz5velmyerntz` finished comme dernier OK
- Y a-t-il eu un deploy depuis ?

Gates ROUGE :
- Container DOWN/UNHEALTHY actuellement = 🚨 CRITIQUE
- Healthcheck rouge = 🚨 CRITIQUE
- RAM > 90 % = ROUGE
- Worker en crash loop = ROUGE
- Dernier deploy en échec = ROUGE

Livrable AGENT 9 :
- `agent9-coolify-state.md`
- `agent9-container-health.md`
- `agent9-deploy-history.md`

═══ AGENT 10 — Content-Gen + Image-Bank pipeline integrity ═══════════ /80

10.1 — Content-Gen factory (V1.0.3 tag livré 2026-05-14)
- /admin/content-gen/queue : combien de jobs PENDING/RUNNING/FAILED ?
- /admin/content-gen/jobs : taux d'échec dernières 24h ?
- /admin/content-gen/costs : coût Anthropic API derniers 7j ? kill-switch armé ?
- /admin/content-gen/publications-status : publications réussies / échouées
- /actualites : combien d'articles publiés visibles ? lastmod cohérent ?
- /faq /etudes-de-cas /aide /connaissances : pareil
- Sitemap-news.xml : URLs vraiment fraîches ?
- IndexNow ping : derniers logs OK ? (mémoire commit b7cbfb4)
- Google Indexing API : quota consumé / 200/jour ?

10.2 — Image-Bank (skill v1.1, deploy pending)
- /admin/image-bank existe-t-il ? (si non → P1 deploy)
- /galerie existe-t-il ? (si non → P1)
- /sitemap-images.xml existe-t-il ? (si non → P1)
- Si oui : tester 5 images aléatoires → variants WebP/AVIF/LQIP servis ?
- Tester JSON-LD ImageObject sur 3 images
- License CC BY 4.0 affichée ?
- Watermark download fonctionnel ? (sans le déclencher mutativement)

10.3 — KB V4 publique
- /connaissances → 200 avec liste articles publiés
- /connaissances/[slug] sur 3 articles : 200, JSON-LD Article, sitemap inclut
- /admin/connaissances : Will peut administrer ? (si cookie fourni)

10.4 — Booking V1 (branche feature non mergée)
- /reserver : 200 avec calendrier
- Tester sélection format → bouton Stripe checkout (NE PAS submit)
- /booking/<token>/cancel : 404 attendu si token invalide (test sécurité)

Gates ROUGE :
- Factory en crash loop (> 50 % FAILED jobs 24h) = ROUGE
- Aucun article récent publié alors que cron tourne = ROUGE
- Image-Bank déployé mais pages publiques 404 = ROUGE
- /reserver KO = ROUGE (booking = revenu)

Livrable AGENT 10 :
- `agent10-content-gen-state.md`
- `agent10-image-bank-state.md`
- `agent10-kb-state.md`
- `agent10-booking-state.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LIVRABLES (dossier complet)                          ║
╚═══════════════════════════════════════════════════════════════════════╝

Dossier unique : `_AUDIT/E2E-ROUTES-2026-XX-XX/`

Contenu obligatoire (11 fichiers + sous-dossiers agents) :
1. `README.md` — TL;DR exécutif + score /1000 + verdict + 5 P0 immédiats
2. `urls.tsv` — inventaire exhaustif (≈ 320 URLs auditées)
3. `agent1-status.tsv` + `agent1-summary.md` + `agent1-crawl.sh`
4. `agent2-html.tsv` + `agent2-jsonld/*.json` + `agent2-issues.md`
5. `agent3-500-rootcause.md` + `agent3-logs-coolify.txt` + `agent3-env-diff.md`
6. `agent4-admin-anon.tsv` + `agent4-admin-auth.tsv` + `agent4-admin-issues.md`
7. `agent5-bilingue.tsv` + `agent5-content-gaps.md`
8. `agent6-vitals.tsv` + `agent6-lh/*.json` + `agent6-console-errors.md`
9. `agent7-sitemap-coverage.tsv` + `agent7-robots.md` + `agent7-indexnow.md`
10. `agent8-headers.tsv` + `agent8-csp-analysis.md` + `agent8-cookies.md`
11. `agent9-coolify-state.md` + `agent9-container-health.md`
12. `agent10-content-gen-state.md` + `agent10-image-bank-state.md`
    + `agent10-kb-state.md` + `agent10-booking-state.md`
13. `TOP-PATCHES-PRIORISES.md` — 30 patches P0/P1/P2/P3 avec :
    - URL/route concernée
    - Symptôme observé (status, message)
    - Hypothèse root cause (H1-H7 cf. AGENT 3)
    - Patch recommandé (1 phrase, sans coder)
    - Effort estimé (minutes/heures)
    - Risque non-fix (revenu perdu / SEO / sécurité)
14. `VERDICT.md` — GO/CONDITIONAL/NO-GO + conditions de levée

**Scoring /1000 :**
- AGENT 1 Inventaire + matrice HTTP : /200 ← **POIDS LE PLUS FORT**
- AGENT 2 HTML quality + RSC : /150
- AGENT 3 Diagnostic 500 root-cause : /150
- AGENT 4 Auth + admin coverage : /120
- AGENT 5 Bilingue FR/EN parity : /80
- AGENT 6 Web Vitals smoke : /80
- AGENT 7 Sitemap + référencement : /80
- AGENT 8 Sécurité headers + CSP : /80
- AGENT 9 Infra + container health : /80
- AGENT 10 Content-Gen + Image-Bank + KB + Booking : /80

**Seuils verdict :**
- ≥ 900 (90 %) : 🟢 **GO** — plateforme saine, monitoring continu
- 750-899 (75-89 %) : 🟡 **CONDITIONAL** — P0 < 24h obligatoire
- 500-749 (50-74 %) : 🟠 **SPRINT CORRECTIF** — fix-it-now nécessaire
- < 500 (50 %) : 🔴 **NO-GO** — escalade, mode dégradé / maintenance ON

╔═══════════════════════════════════════════════════════════════════════╗
║                  STRUCTURE TECHNIQUE ROBUSTE                          ║
╚═══════════════════════════════════════════════════════════════════════╝

L'auditeur doit produire des scripts **REPRODUCTIBLES** pour que Will
puisse re-jouer la vérification en 1 commande après chaque deploy.

Scripts obligatoires :
- `agent1-crawl.sh` (bash + curl, idempotent, < 2 min sur 320 URLs)
- `agent2-html.sh` (bash + curl + python ou node pour parse JSON-LD)
- `agent3-coolify-logs.sh` (curl Coolify API, lecture seule)
- `agent6-lh.sh` (lighthouse CLI, 10 URLs × 2 devices)
- `run-all.sh` — orchestrateur qui lance les 10 agents en parallèle

Format fichier `urls.tsv` (gold standard) :
```
url	category	locale	expected_status	dynamic	auth	source
https://axion-ia.com/fr	public_home	fr	200	no	no	manual
https://axion-ia.com/fr/guide-ia	public_guide	fr	200	no	no	manual
https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login	admin_login	fr	200	no	no	env
...
```

Convention `expected_status` :
- 200 pour pages publiques
- 200 pour /<adminPrefix>/login
- 307 pour pages admin protégées (redirect vers login)
- 404 pour catchall + image-bank-not-deployed
- 405 pour API webhooks GET
- 401 pour API admin

═══ Idempotence garantie ═══
- Aucun script ne mute prod
- Aucun POST sauf endpoints publics idempotents (GET déguisé)
- Tous les agents peuvent être ré-exécutés sans effet de bord

═══ Scalabilité (rejouable post-deploy) ═══
- Un Github Action peut rejouer `run-all.sh` après chaque deploy
- Sortie en TSV → ingérable dans dashboard
- Coût zéro : tout en stdlib (curl, jq, lighthouse CLI gratuit)

╔═══════════════════════════════════════════════════════════════════════╗
║                  CONTRAINTES INTOUCHABLES                             ║
╚═══════════════════════════════════════════════════════════════════════╝

- Stack Hetzner CPX42 + Coolify + CF Free (budget zéro)
- Pas de re-architecture, pas de framework swap
- Direction visuelle commitée HEAD intouchable (terracotta header)
- Naming "Axion-IA" partout (FR + EN)
- Persona Manon disclosed (AI Act 2026)
- AUDIT-ONLY : zéro édition code, zéro commit, zéro deploy
- Pas de fuite de secrets en logs/rapport (masquer adminPrefix dans
  livrables publics : utiliser `<ADMIN_PREFIX>` placeholder)

╔═══════════════════════════════════════════════════════════════════════╗
║                  HEURISTIQUES DIAGNOSTIC 2026                         ║
╚═══════════════════════════════════════════════════════════════════════╝

- **500 simultanés sur plusieurs routes** = problème systémique
  (env var, migration, build artifact, lib partagée KO) — PAS du hasard
- **« no available server »** = couche proxy/container, PAS code Next.js
  (Coolify → Caddy → container)
- **404 sur route en sitemap** = drift entre sitemap dynamique et data DB
- **200 anon sur admin** = fuite sécurité gravissime → escalade
- **Console errors > 5 sur page** = JS broken, monitoring non câblé,
  ou CSP trop stricte
- **Hreflang manquant** = SEO multi-pays perdu (Google ne croise pas EN/FR)
- **CSP nonce manquant** = Sprint 24 régression, audit à creuser
- **Container UNHEALTHY** = healthcheck `/api/healthz` rouge → Coolify le
  retire du pool → 502/503 généralisé
- **Cache CF agressif sur /admin** = 🚨 critique (fuite données privées)
- **TTFB > 3 s** = origin malade (Postgres slow query ? RAM swap ?)
- **Sitemap > 50k URLs / fichier** = Google ignore → split obligatoire
```

---

## Phrase d'invocation (à coller dans nouvelle session fraîche)

> Lance l'audit `_AUDIT/PROMPT-E2E-ROUTES-HEALTH-2026.md` en mode AUDIT-ONLY STRICT. 10 agents parallèles, scoring /1000. Inventorie EXHAUSTIVEMENT les ≈ 320 routes (104 pages publiques × 2 locales + 80 dynamiques sample × 2 locales + 101 admin + 32 API + 10 ressources SEO + image-bank future-proof + catchall + maintenance). Mesure HTTP status + TTFB + cf-cache + redirects sur toutes. Audite HTML quality (title, meta, hreflang, JSON-LD, RSC) sur 50 sample. Diagnostique forensiquement les 500 observés (`/fr/guide-ia`, `/fr/stack-ia`, `/fr/comparaisons`) avec hypothèses H1-H7 (env var, migration Prisma, build artifact, catchall greedy, import cassé, data DB, hydration). Diagnostique le « no available server » sur `/fr/<adminPrefix>/login` via Coolify API lecture-seule (container health, healthcheck, RAM, deploys, Caddy proxy). Audite admin (101 pages) anon + auth si cookie fourni. Vérifie parity FR ↔ EN (104 routes × hreflang × switcher × contenu miroir). Smoke Web Vitals sur 10 routes critiques. Vérifie sitemaps + robots.txt + llms.txt + IndexNow. Audite security headers (CSP nonce Sprint 24, HSTS preload, COOP/COEP, cookies admin Secure+HttpOnly). Vérifie pipeline Content-Gen V1.0.3 (queue, jobs, costs, publications, sitemap-news) + image-bank skill v1.1 deploy status + KB V4 publique + Booking V1. Produis le dossier `_AUDIT/E2E-ROUTES-2026-05-15/` avec urls.tsv exhaustif + 10 dossiers agents + TOP-PATCHES-PRIORISES.md (30 patches P0-P3) + VERDICT.md. Aucun fix, aucun commit, aucune mutation prod. Scripts bash idempotents reproductibles par Will post-deploy. Verdict /1000 avec conditions de levée si CONDITIONAL/NO-GO.
