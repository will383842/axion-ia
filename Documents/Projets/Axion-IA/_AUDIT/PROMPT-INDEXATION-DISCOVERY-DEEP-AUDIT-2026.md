# 🔍 PROMPT AUDIT INDEXATION + DISCOVERY + GSC + SITEMAPS DEEP 2026 (v2 Option B)

> Audit AUDIT-ONLY **end-to-end** du fonctionnement d'indexation
> **complet** de la plateforme `https://axion-ia.com` :
> sitemaps (index + 9 sous-sitemaps statiques + ~13 sub-sitemaps villes
> dynamiques + knowledge-N chunkés DB + sitemap-news + 2 image-sitemaps +
> RSS/Atom feeds + HTML `/plan-du-site`), robots.txt + 11 bots IA +
> Bingbot crawl-delay, IndexNow multi-moteurs, Google Indexing API +
> URL Inspection API, Google Search Console + Bing Webmaster, hreflang,
> canonicals + cross-check sitemap≠canonical + redirect chains, JSON-LD +
> opengraph-image + favicon + manifest, llms.txt + ai.txt, cron /
> scheduler de ré-soumission, factory content-gen V1.0.3 + 100 articles/
> jour, pSEO villes (~13K routes), KB DB-aware chunkée, image-bank V1
> (`/galerie/*`), internal link graph (BFS + orphans + click depth),
> Google Discover eligibility, edge cases (404/410/Soft 404, cloaking,
> CMP impact, Vary/CSP, mobile-first, server logs raw).
>
> **Déclenché par observation Will 2026-05-17** : au début 284 URLs
> découvertes dans GSC, maintenant chute à **147** → régression
> dramatique inexpliquée. Objectif business : **chaque jour, de nouvelles
> URLs sortent en indexation** sans intervention manuelle, en respectant
> le crawl budget Googlebot, sans casser AEO/GEO ni provoquer de
> doorway HCU 2024.
>
> Mode **🔒 AUDIT-ONLY STRICT**. Zéro fix, zéro commit, zéro push,
> zéro mutation prod, zéro submit URL manuel. Lecture-seule de tout.
>
> Production : **1 dossier** `_AUDIT/INDEXATION-DISCOVERY-2026-XX-XX/`
> avec **16 fichiers** (12 agents + 3 synthèses + 1 verdict final).
>
> Score cible : **≥ 2 174 / 2 415** (90 %) pour 🟢 GO « indexation
> discovery prod-grade 2026 ».
>
> **v2 Option B (2026-05-17)** : intègre 16 gaps P0+P1 vs v1 (RSS/Atom,
> HTML sitemap, Image sitemap deep, cross-check canonical, 404/410/Soft 404,
> CMP/cookie consent, cloaking/UA sniffing, redirect chains, internal link
> graph, URL Inspection API, mobile-first, lastmod gaming, Google Discover,
> server logs raw, Vary/CSP, opengraph-image/favicon/manifest).

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT INDEXATION DISCOVERY DEEP 2026)

Tu es l'auditeur indexation + discovery end-to-end perfection 2026 pour
Axion-IA. Tu n'as PAS le droit de coder, fixer, commiter, pousser,
migrer, ni de submit aucune URL nulle part (GSC, Bing, IndexNow,
Google Indexing API — tout est read-only).

Tu OBSERVES (curl en HEAD/GET seulement, lecture API GSC read-only,
lecture Bing Webmaster API read-only, lecture sub-agents Playwright en
headless, lecture logs Coolify/BullMQ, lecture DB Prisma SELECT-only).

Tu CARTOGRAPHIES (chaque sub-sitemap, chaque URL émise, chaque
JSON-LD, chaque hreflang, chaque worker indexation, chaque scheduler).

Tu MESURES (volume URLs réel vs attendu, lastmod différenciation,
crawl rate Googlebot, latence IndexNow, taux indexation GSC,
quota Indexing API consommé, hit rate cache CDN sur sitemaps).

Tu DIAGNOSTIQUES (root-cause de la chute 284 → 147 URLs : EN locale
désactivé 2026-05-16, BUILD_TIME stable, exclusions HCU récentes,
filter `getIndexableVilles()` Phase 1 Paris-only, DB-aware kbCount=0
si stub.invalid au build, dédup excludeSlugsByType trop agressif,
GSC validation re-soumission, Cloudflare cache MISS sitemap, etc.).

Tu PRESCRIS (top 30 patches priorisés P0/P1/P2 avec effort + impact
+ risque de régression chiffré).

═══════════════════════════════════════════════════════════════════
CONTEXTE OPÉRATIONNEL CRITIQUE — LIRE AVANT TOUT
═══════════════════════════════════════════════════════════════════

- Domaine prod : `https://axion-ia.com` (apex), Cloudflare Free
- Origin : Hetzner CPX42 178.105.55.15 Nuremberg, Coolify 4.0.0, Caddy 2
- Stack : Next 16 standalone + Postgres + Redis + BullMQ workers
- Build : externalisé GH Actions → GHCR → Coolify pull (ADR 0026)
- ⚠️ Build utilise `DATABASE_URL=...stub.invalid...` → tous les builders
  DB-aware (knowledge-N, blog DB-merge, sitemap-news, lastmod) sont
  short-circuit Proxy au build. ISR `revalidate=3600` repopule au
  runtime sous 1h. **CECI EST CRITIQUE** : un sitemap servi juste
  après deploy peut être vide pour les blocs DB-aware.
- BUILD_TIME injecté `next.config.ts` → `lastModified` SSG figé au build
- EN locale **désactivé** 2026-05-16 via `EN_LOCALE_ENABLED!=true` :
  `routing.locales` garde ["fr","en"] mais `effectiveLocales` filtre EN,
  `filterEnIfDisabled()` strip URLs `/en/*` de chaque sub-sitemap,
  robots.txt ajoute `Disallow: /en/` global, proxy.ts 301 `/en/*` → `/fr/*`.
  **CECI EXPLIQUE peut-être ~50 % de la chute 284 → 147** si avant
  le 2026-05-16 les URLs EN étaient comptées dans GSC discovery.
- pSEO villes : ~17 500 routes SSG existent physiquement mais
  `getIndexableVilles()` filtre sur `copy` présent → V1 = **Paris seul**
  pour `villes-<region>(-<n>).xml`. Stubs structurels noindex hors sitemap.
- Services × villes : 3 templates `audit / interventions / implementation`
  par-ville-only si `ville.copy.services.<svc>` présent → V1 = 6 URLs
  (3 services × 2 locales × Paris uniquement, MAIS EN désactivé → 3 URLs).
- KB V4 DB-aware : `countKnowledgePublicEntries()` lit Prisma au build.
  Si stub.invalid → `kbCount=0` → **0 knowledge-N sub-sitemap émis**.
  Au runtime ISR ça se repopule mais le sitemap-index lui-même est
  figé SSG donc `generateSitemaps()` reste sans knowledge-N pendant
  les premières heures post-deploy. **À VÉRIFIER CRITIQUE**.
- Factory content-gen V1.0.3 : si `KB_AUTO_PUBLISH=true`, jusqu'à
  ~100 articles/jour publiés → ~36 500 articles/an. Nécessite IndexNow
  + Google Indexing API trigger par publish + sitemap re-emit ISR.
- Image-bank V1 livré commit `feat/image-bank-v1` non mergé (mémoire
  2026-05-16) → `/sitemaps/images-fr.xml` + `images-en.xml` référencés
  dans sitemap-index mais Route Handlers existence à confirmer (le P0-3
  audit FR 2026-05-15 disait 404 systématique avant V1 livré).
- Cloudflare : règle CDN cache sur `/sitemap*.xml` ? Si TTL > 1h alors
  les sub-sitemaps reflètent un état périmé → discovery rate dégradée.

═══════════════════════════════════════════════════════════════════
OBSERVATION USER 2026-05-17 — SIGNAL FAIBLE PRINCIPAL
═══════════════════════════════════════════════════════════════════

« au début il y avait 284 pages de découverte dans les sitemaps mais
maintenant on n'est plus qu'à 147 »

**INTERPRÉTATION CANDIDATE** (à valider, ne pas conclure prématurément) :
- GSC > Indexation > Pages > « Découvertes ‑ actuellement non indexées »
  est passée de 284 à 147. Ce n'est PAS le total indexé : c'est la file
  d'attente de pages que Googlebot a vues mais pas encore crawlées/indexées.
- Une **chute** de cette file peut signifier :
  (a) bonne nouvelle : 137 URLs sont passées en « Indexées » (vérifier)
  (b) mauvaise nouvelle : 137 URLs ont été retirées du sitemap →
      Google les a dé-priorisées (sortie de file de découverte)
  (c) Google a appliqué un filtre qualité (HCU) → URLs jugées thin,
      sortent de la file sans être indexées
  (d) Cloudflare/Caddy a servi un sitemap tronqué/erreur 5xx →
      Google a invalidé une partie de la file
  (e) IndexNow OFF / cron failed → pas de re-ping, URLs vieillissent,
      sortent de la file naturellement
- L'auditeur DOIT distinguer ces 5 hypothèses avec données réelles.
  Si pas d'accès GSC OAuth, demander à Will l'export CSV
  « Coverage > All known pages » dernier 28j.

**OBJECTIF BUSINESS** explicite : « il faudrait pas qu'il y ait tous
les jours de nouvelles pages et URLs découvertes ? » → cadence quotidienne
de nouvelles URLs entrant dans la file de découverte, échelonné pour
respecter le crawl budget. Idéal : 20-50 nouvelles URLs/jour discovery,
80-90 % passent indexées sous 7 jours.

═══════════════════════════════════════════════════════════════════
MODE AUDIT-ONLY STRICT — RÈGLES ABSOLUES
═══════════════════════════════════════════════════════════════════

✅ AUTORISÉ :
- `curl -I` / `curl -s` sur endpoints publics (sitemaps, robots, llms.txt)
- Lecture API Google Search Console (READ scopes seulement :
  `webmasters.readonly`, `webmasters.sitemaps.readonly`)
- Lecture API Bing Webmaster (status, GetUrlSubmissionsStatus)
- Lecture API IndexNow status (read-only)
- Lecture DB Prisma SELECT-only sur Article, KnowledgeEntry, Page
- Lecture logs Coolify, BullMQ (queue stats), Cloudflare (analytics)
- Lecture fichiers code (lecture-seule)
- Playwright headless sur sub-sitemaps publics (GET seulement)
- Lighthouse en mode `--only-categories=seo` (lab read-only)

❌ INTERDIT :
- Toute édition de code, tout commit, tout push, tout migrate
- Toute soumission manuelle URL (zéro POST/PUT/PATCH/DELETE mutant
  sauf endpoints `/api/indexnow GET` strictement publics idempotents)
- Tout submit GSC, tout submit Bing Webmaster, tout publish Indexing API
- Tout restart container, tout deploy, tout env var write
- Toute purge Cloudflare, tout invalidate cache
- Tout appel IA externe payant (OpenAI, Anthropic, Voyage, Perplexity)
  sauf si STRICTEMENT nécessaire pour AGENT 9 GEO et borné < $1
- Si bug trouvé → noter dans rapport, NE PAS fix
- Si migration manquante → noter, NE PAS migrate
- Si env var manquante → noter, NE PAS l'écrire
- Si Cloudflare règle absurde → noter, NE PAS la changer

Seul livrable : dossier `_AUDIT/INDEXATION-DISCOVERY-2026-XX-XX/`
(14 fichiers Markdown, format strict défini en bas).

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE (préalable)                      ║
╚═══════════════════════════════════════════════════════════════════════╝

**Référentiels mémoire + audits précédents** :
 1. `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-INDEXATION-FR-2026.md` (audit
    précédent 8 agents /700, focus France) — PRÉDÉCESSEUR de cet audit
 2. `_AUDIT/CONTENT-GEN-AUDIT-INDEXATION-FR-2026-05-15.md` (rapport
    livré 2026-05-15 — lire root-causes déjà identifiés, ne pas
    re-cataloguer, juste vérifier ce qui a été fixé depuis)
 3. `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL.md` (AGENT 4
    crawl budget — référentiel)
 4. `_AUDIT/E2E-ROUTES-2026-05-15/` (cartographie 320 routes)
 5. `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` (état V1.0.3 actuel)
 6. `_AUDIT/DEPLOY-RECOVERY-2026-05-17/` (post-mortem incident
    déploiement — contexte stub.invalid + ISR)
 7. Mémoire `axionia_session_2026-05-09_sprints_15-23_audits.md`
 8. Mémoire `axionia_pr14_image_bank_v1_2026-05-16.md` (état
    `/sitemaps/images-fr.xml` + `images-en.xml`)
 9. Mémoire `axionia_session_2026-05-16_image_bank_v1_post_audit_patches.md`

**Code stack — INVENTAIRE INDEXATION** :
10. `axionia/src/app/sitemap.ts` (generateSitemaps + 8 builders)
11. `axionia/src/app/sitemap-index.xml/route.ts` (index racine)
12. `axionia/src/app/sitemap-news.xml/route.ts` (Google News)
13. `axionia/src/app/sitemaps/images-fr.xml/route.ts`
14. `axionia/src/app/sitemaps/images-en.xml/route.ts`
15. `axionia/src/app/robots.ts` (rules + bots IA + Bingbot delay)
16. `axionia/src/app/llms.txt/route.ts` (?) + `axionia/src/app/llms-full.txt/route.ts`
17. `axionia/src/app/ai.txt/route.ts` (?)
18. `axionia/src/app/<INDEXNOW_KEY>.txt/route.ts` (clé file)
19. `axionia/src/lib/indexnow.ts` (helper centralisé)
20. `axionia/src/lib/seo.ts` (SITE_URL, canonical, hreflang, JSON-LD)
21. `axionia/src/server/content-gen/indexing/enqueue.ts`
22. `axionia/src/server/content-gen/indexing/url-builder.ts`
23. `axionia/src/server/content-gen/seo/indexing-client.ts`
24. `axionia/src/server/content-gen/seo/gsc-client.ts`
25. `axionia/src/server/queue/workers/content-indexnow-worker.ts`
26. `axionia/src/server/queue/workers/content-google-indexing-worker.ts`
27. `axionia/src/server/exporters/knowledge-sitemap.ts`
28. `axionia/src/server/exporters/knowledge-rss.ts`
29. `axionia/src/content/regions.ts` (12 régions indexable + Corse noindex)
30. `axionia/src/content/villes.ts` (`getIndexableVilles()` filtre copy)
31. `axionia/src/content/blog/index.ts` (`getIndexableBlogPosts()` tier-1)
32. `axionia/src/content/transversal.ts` (faq, help, glossaire)
33. `axionia/src/content/case-studies.ts`
34. `axionia/src/content/comparaisons.ts`
35. `axionia/src/content/automatisations.ts` (slugs FR + EN)
36. `axionia/prisma/schema.prisma` (Article, KnowledgeEntry, Page,
    indexationTier, isNews, audience, status, deletedAt)
37. `axionia/src/middleware.ts` + `axionia/src/proxy.ts`
    (EN→FR 301 redirect)
38. `axionia/next.config.ts` (BUILD_TIME injection + redirects/rewrites)
39. `axionia/Dockerfile` + `Dockerfile.coolify-pull` (stub.invalid)

**Données prod (read-only — Will fournit si besoin)** :
40. GSC export CSV « Coverage > All known pages » 28j
41. GSC export CSV « Sitemaps > processed sitemaps » dernier mois
42. Bing Webmaster « URL Inspection » sample
43. Cloudflare Analytics > Cache Analytics > sitemap*.xml
44. Coolify logs dernière fenêtre 7 jours
45. BullMQ queue stats : `indexnow-batch`, `google-indexing`,
    `content-publish` (depth, processed, failed, delay)

╔═══════════════════════════════════════════════════════════════════════╗
║         12 AGENTS PARALLÈLES — SCORE TOTAL /2415 (v2 Option B)        ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 1 — Sitemap-index racine + cohérence sub-sitemaps ═════════ /220

**1.1 — Endpoint `/sitemap-index.xml`** (35 pts)
- `GET https://axion-ia.com/sitemap-index.xml` → status 200
- Content-Type `application/xml; charset=utf-8`
- Format strict `<?xml … ?><sitemapindex xmlns="…/sitemap/0.9">` valide
- Cache-Control `public, max-age=3600, s-maxage=86400` cohérent
- Cloudflare cache HIT/MISS observé (curl répété)
- ⚠️ Vérifier que `/sitemap.xml` retourne 404 ou 308 vers
  `/sitemap-index.xml` (sinon double convention Next 16 metadata)

**1.2 — Enumération exhaustive sub-sitemaps réellement émis** (50 pts)
Lister UN PAR UN ce que renvoie `generateSitemaps()` au build courant :
- `pages` (statiques routing.pathnames moins EXCLUDED_FROM_INDEX)
- `blog` (FS tier-1 + DB merge `indexationTier=tier_1_indexable isNews=false`)
- `faq`, `help`, `cas-concrets`, `comparaisons`, `implementation`,
  `implantations`, `services-villes-{audit,interventions,implementation}`
- `villes-<region>` × régions indexable (V1 : seules régions avec ville
  ayant copy → Île-de-France si Paris dans, sinon 0)
- `villes-<region>-<chunk>` si > SITEMAP_CHUNK_SIZE=1000 URLs (PAS
  attendu V1, mais V2-V3)
- `knowledge-<chunk>` où chunkCount = ceil((kbCount × 2) / 1000)
  ⚠️ Si build stub.invalid → kbCount=0 → 0 knowledge-* → AUDIT POINT P0
- Customs : `/sitemap-news.xml`, `/sitemaps/images-fr.xml`,
  `/sitemaps/images-en.xml`

**Pour chaque ID listé** :
- Sub-sitemap `GET https://axion-ia.com/sitemap/<id>.xml` → status 200
- Compter `<url>` (parser XML)
- Vérifier `<loc>` absolu HTTPS, `<lastmod>` ISO 8601, `<changefreq>`
- Vérifier hreflang `<xhtml:link rel="alternate" hreflang="…">`
  (toutes URLs FR doivent avoir hreflang="fr" + x-default si EN OFF)
- Compter URLs EN orphelines (devraient être 0 si EN_LOCALE_ENABLED!=true)

**1.3 — Compte total URLs émises vs URLs annoncées vs URLs SSG réelles** (40 pts)
- Compter URLs total dans tous sub-sitemaps
- Comparer au nombre attendu théorique (annoncé mémoire : ~17 500 SSG)
- Si delta > 30 %, drill-down par catégorie
- Identifier les pages SSG qui existent (filesystem `/app/.next/server`)
  mais ne sont PAS dans le sitemap → orphelines crawl-impossibles
- Identifier les pages dans le sitemap qui retournent 404/410/500
  (sample 100 random URLs) → fantômes sitemap

**1.4 — Lastmod différencié par catégorie** (25 pts)
Lire `getDifferentiatedLastmod()` dans `sitemap-index.xml/route.ts` :
- 3 queries Prisma `findFirst` orderBy updatedAt desc :
  news, blog, knowledge
- Au build stub.invalid → 3 catch silencieux → `FALLBACK_LASTMOD =
  new Date().toISOString()` qui est figé au module load
- ⚠️ Vérifier que `FALLBACK_LASTMOD` est bien recalculé à chaque
  request runtime (`new Date()` au top-level module = figé à
  l'instantiation worker Node) → si tous figés à la valeur du démarrage
  worker, Google reçoit lastmod CONSTANT → ignore le signal

**1.5 — Cohérence sitemap-index ↔ robots.txt** (20 pts)
- `robots.txt` ligne `Sitemap: https://axion-ia.com/sitemap-index.xml`
- Une seule directive Sitemap (pas multiple incohérent)
- ⚠️ Vérifier que GSC pointe vers `/sitemap-index.xml` (pas `/sitemap.xml`
  qui serait le path metadata Next 16 conflictuel)

**1.6 — Lastmod gaming detection** (P1 — v2 Option B, ajouté 2026-05-17) (20 pts)
Google détecte si lastmod est bumped artificiellement sans changement
contenu réel → arrête de tenir compte du signal pour CE site (long terme).
Tests :
- Hash SHA-256 du body HTML d'un échantillon 20 URLs T0
- Récupérer même URLs T+24h, comparer hash + comparer lastmod sitemap
- Si lastmod bumped mais hash identique = 🔴 P0 lastmod gaming
- Vérifier que `Article.updatedAt` n'est pas bump sur opérations
  non-éditoriales (re-index, re-translate, cache flush)
- Vérifier que `BUILD_TIME` env ne bump pas tous les lastmod statiques
  à chaque redeploy (déjà discuté §1.4 mais score séparé ici)
- Si oui : préférer lastmod conditionnel (bump seulement si content hash
  diffère) pour ne pas leak « tout vient de changer » à chaque deploy

**1.7 — Build vs runtime ISR repop** (30 pts)
- Mesurer le délai entre deploy et apparition réelle des knowledge-N
  dans `/sitemap-index.xml` (ISR revalidate=3600 → max 1h)
- ⚠️ ATTENTION : `generateSitemaps()` est appelé dans la route handler
  `/sitemap-index.xml/route.ts` GET → s'exécute au runtime, PAS au build.
  Donc `countKnowledgePublicEntries()` lit la DB runtime réelle, PAS
  le stub. → CECI POURRAIT INVALIDER l'hypothèse P0 « stub kbCount=0 ».
  À CONFIRMER en regardant strictement où `generateSitemaps()` est appelé :
  (1) `app/sitemap.ts` au build SSG par Next 16 metadata convention,
  (2) `app/sitemap-index.xml/route.ts` au runtime via import.
  Si (1) prévaut pour l'enumération, et (2) sert juste à servir l'index,
  alors knowledge-N peut être bloqué côté (1) pendant tout le build,
  et au runtime `/sitemap/knowledge-1.xml` n'existerait même pas
  (404 Next 16 si pas dans generateSitemaps build-time).
  → CETTE NUANCE EST CRITIQUE. À investiguer code en main.

**Gates AGENT 1** :
- `/sitemap-index.xml` status ≠ 200 = 🔴 ROUGE BLOQUANT
- knowledge-N absent du sitemap-index alors que DB > 0 entries = 🔴 P0
- URLs EN présentes alors que EN désactivé = 🔴 P0 (waste crawl 301)
- lastmod tous identiques cross-sub-sitemaps = 🟠 P1 (Google ignore signal)
- Page SSG existante hors sitemap = 🟠 P1 (orphan crawl)
- Page dans sitemap retournant 5xx = 🔴 P0 (Google déclasse le site)

═══ AGENT 2 — Robots.txt + Bots IA + llms.txt + ai.txt + IndexNow key ═ /150

**2.1 — `robots.txt` complet** (30 pts)
- `GET /robots.txt` status 200, `text/plain; charset=utf-8`
- `User-agent: *` allow `/` + disallow `COMMON_DISALLOW` (10 paths)
- `Disallow: /en/` présent SI EN_LOCALE_ENABLED!=true (dynamique)
- `Sitemap: https://axion-ia.com/sitemap-index.xml` présent
- `Host: https://axion-ia.com` présent
- Pas de Allow `/api/` (sinon Googlebot crawl API routes)

**2.2 — Bingbot Crawl-delay** (15 pts)
- Bloc Bingbot dédié avec `crawl-delay: 1`
- Vérifier que Bingbot ne fait PAS partie de `AI_BOTS_ALLOWED.filter(u => u !== "Bingbot")`
  (déjà géré dans le code commit `audit indexation 2026-05-15 P1-16`)

**2.3 — Bots IA — Doctrine `ALLOW search-time + ALLOW training Big Tech`** (30 pts)
Vérifier blocs dédiés (chacun avec allow `/` + disallow same as `*`) :
- ✅ GPTBot, OAI-SearchBot, ChatGPT-User
- ✅ ClaudeBot, anthropic-ai, Claude-Web
- ✅ PerplexityBot, Perplexity-User
- ✅ Google-Extended, Applebot-Extended
- ✅ Mistral-User, Meta-ExternalAgent
- ❌ CCBot, Bytespider, omgili, Diffbot (DISALLOW `/`)

⚠️ DOCTRINE 2026 : pour AEO/GEO maximal, NE PAS bloquer les bots
search-time (Claude.ai, ChatGPT Search, Perplexity, Bing Copilot,
Google SGE). Tout disallow ici = perte massive citations.

**2.4 — `llms.txt` + `llms-full.txt`** (25 pts)
- `GET /llms.txt` status 200, `text/markdown` ou `text/plain`
- Format Jeremy Howard 2024 : `# Axion-IA\n> tagline\n## sections\n- [Title](url): desc`
- `llms-full.txt` (optionnel) : sections complètes inline Markdown
- Vérifier que les URLs listées sont CANONIQUES FR (pas EN obsolètes)
- Vérifier section dédiée aux 3 services (interventions/audits/implementations)
- Vérifier section Knowledge Base + Blog + FAQ + Case studies

**2.5 — `ai.txt` (standard émergent opt-in/opt-out training)** (15 pts)
- `GET /ai.txt` status 200, `text/plain`
- Format `User-Agent: *\nAllow: search\nDisallow: training` ou variante
- Si absent → P2 (norme émergente, pas obligatoire 2026)

**2.6 — IndexNow key file** (20 pts)
- `INDEXNOW_KEY` env var Coolify renseignée ?
- Curl `https://axion-ia.com/<KEY>.txt` → status 200, body = clé brute
  (pas wrapped, pas trailing newline parasite)
- Format clé : 8-128 chars hex/alphanumeric
- Une seule clé exposée (pas plusieurs files clés rivales)

**2.7 — Robots.txt charset + encoding** (15 pts)
- UTF-8 BOM absent (Google n'aime pas le BOM)
- Line endings `\n` (pas `\r\n` Windows — vérifier qu'on n'a pas un
  rendu PowerShell parasite injecté)
- Pas de caractères non-ASCII (URLs IDN à encoder Punycode `xn--`)

**Gates AGENT 2** :
- Robots.txt 5xx = 🔴 BLOQUANT (Google bloque crawl total après 30j)
- Disallow bot IA search-time (ClaudeBot, OAI-SearchBot…) = 🔴 P0 GEO
- IndexNow key 404 = 🔴 P0 (tous les pings IndexNow échouent)
- llms.txt absent = 🟠 P1 (manque positionnement AEO)
- `Disallow: /en/` manquant en mode EN-OFF = 🟠 P1 (waste crawl 301)

═══ AGENT 3 — IndexNow auto-trigger + multi-moteurs ═════════════════ /200

**3.1 — Endpoint IndexNow utilisé** (20 pts)
Lire `src/lib/indexnow.ts` + worker :
- POST vers `https://api.indexnow.org/IndexNow` (universal redistribué
  Bing+Yandex+Naver+Seznam) — recommandé
- OU POST direct par moteur (Bing/Yandex/Naver/Seznam) — équivalent
- Payload JSON : `{ host, key, keyLocation, urlList }`
- ⚠️ Champ `urlList` officiel ET `urls` alias (bug fix commit b7cbfb4
  mémoire 2026-05-13) — vérifier que les deux sont supportés ou bien
  qu'on n'envoie que `urlList` strict

**3.2 — Trigger automatique à la publication Article** (40 pts)
Lire `content-indexnow-worker.ts` + workflow publish factory :
- Trigger sur `Article.status = published` (transition draft → published)
- Trigger sur `Article.updatedAt` bump significatif (body diff > 10 %)
- Trigger sur `Article.unpublish` AVEC ping pour notify removed
  (utiliser plutôt `noindex` puis re-ping que IndexNow "deletion")
- Trigger sur slug change : envoyer ancien URL (302/301 source) + nouveau
- Trigger sur KnowledgeEntry status change (published, deprecated, deleted)
- Trigger sur Page (CMS pages éditoriales) si applicable

**3.3 — Trigger sur publication non-factory** (20 pts)
- Nouvelle ville pSEO ajoutée → trigger ?
- Nouveau case study FS commité → trigger ?
- Nouveau comparison commité → trigger ?
- Si non : déclenchement manuel via admin > Indexation > Re-emit all ?

**3.4 — Batching + rate limiting** (25 pts)
- IndexNow accepte MAX 10 000 URLs/requête
- Rate limit recommandé : 1 req / 10 sec, 1000 URLs/jour idéal
- Vérifier worker `content-indexnow-worker.ts` debounce/batch
- BullMQ delayed jobs si > 1000/jour → étalement sur fenêtre
- Anti-burst (`anti-burst.ts` content-gen scheduler) appliqué ?

**3.5 — Retries + logging + alertes** (30 pts)
- Retry exponentiel sur 5xx (3 attempts max)
- Log Sentry sur échec persistant
- Alerte Telegram (mémoire CRM-Pro infra) si > 5 fails consécutifs
- Audit log immutable (KB V4 audit_log hash-chain) — toute soumission tracée
- Métriques BullMQ exposées admin > Observability

**3.6 — Validation reverse côté Bing Webmaster** (25 pts)
- Bing Webmaster `URL Submission` API → quota 10 000/jour
- IndexNow couvre Bing automatiquement (recommandé)
- Vérifier dans Bing Webmaster > URL Submission > History
  qu'on voit bien des soumissions IndexNow récentes
- Si 0 soumission depuis 7j alors que factory publie → 🔴 P0

**3.7 — Multi-moteurs (Yandex + Naver + Seznam)** (20 pts)
- Si `api.indexnow.org` universal → couvert auto
- Pertinence marché FR : Bing 5 % + Yandex ~0 % + Naver 0 % + Seznam 0 %
- Couvrir = zéro effort additionnel via universal → OK
- ⚠️ Si on appelle 4 endpoints séparément → 4× rate budget → P1

**3.8 — Auto-trigger sur nouveau sub-sitemap émis** (20 pts)
- Quand `generateSitemaps()` ajoute un nouveau `villes-<region>`
  (nouvelle ville indexable promue) → trigger ping IndexNow du sitemap
  PUIS de chaque URL nouvelle ?
- Le ping sitemap ne fait PAS l'indexation, juste signale changement
- Pour indexation effective : ping chaque URL nouvelle individuellement

**Gates AGENT 3** :
- Factory publish sans trigger IndexNow = 🔴 P0
- Article.update sans re-ping = 🟠 P1
- Bug récurrent `urls` vs `urlList` (mémoire b7cbfb4) = 🔴 P0
- 0 soumission IndexNow depuis 7j alors factory active = 🔴 P0
- Pas de retry sur 5xx = 🟠 P1
- Pas de log/alerte sur fail = 🟠 P1

═══ AGENT 4 — Google Indexing API + Search Console + URL Inspection ══ /275

**4.1 — Google Indexing API (officiel JobPosting + BroadcastEvent)** (40 pts)
Lire `src/server/content-gen/seo/indexing-client.ts` :
- JWT service account chargé via `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`
- Scope : `https://www.googleapis.com/auth/indexing`
- Endpoint : `POST https://indexing.googleapis.com/v3/urlNotifications:publish`
- Payload : `{ "url": "...", "type": "URL_UPDATED" | "URL_DELETED" }`
- Quota : 200 requêtes/jour par défaut (request quota increase pour 10K
  via Google Cloud Console > Quotas > Indexing API)
- Si factory publie 100 articles/jour + autres updates → quota saturé

**4.2 — Usage best-effort articles (hors-scope officiel)** (25 pts)
Google a confirmé l'usage strict JobPosting + BroadcastEvent. L'usage
sur articles génériques est toléré mais non garanti. Stratégie audit :
- Vérifier qu'on n'y COMPTE pas exclusivement (sitemap + IndexNow primaires)
- Logger les rejets API (400/403) pour détecter changement politique
- Pas d'alerte si rejet (normal) — juste log Sentry warning

**4.3 — Google Search Console — vérification site** (30 pts)
- Property `axion-ia.com` (Domain type, recommandé) vérifié ?
- Méthode vérification : DNS TXT (Domain) OU HTML file (URL prefix)
- ⚠️ Si Domain property absente, créer une Domain property prioritaire
  sur URL prefix pour couvrir tous sub-domains, www, http→https unifiés

**4.4 — Sitemaps soumis dans GSC** (40 pts)
GSC > Sitemaps :
- `https://axion-ia.com/sitemap-index.xml` soumis avec status
  « Succès » (vert), dernière lecture < 7j
- Vérifier que les sub-sitemaps découverts via l'index sont listés
- Compter « Discovered URLs » par sub-sitemap
- Si un sub-sitemap montre 0 URLs alors qu'attendu > 0 → 🔴 P0
- Si erreur « Sitemap could not be read » → 🔴 P0

**4.5 — Crawl Stats GSC (Settings > Crawl Stats)** (30 pts)
- Total crawl requests / jour (cible : 200-1000/j pour site Axion-IA)
- Avg response time Googlebot (cible : < 500 ms)
- Crawl budget utilisé vs disponible
- Top URLs crawlées (sitemap-index, sitemaps fréquents)
- 4xx/5xx errors rate (cible : < 2 %)
- Si factory publie 100/jour mais GSC indique crawl < 50/jour = signal P0

**4.6 — Pages indexées vs Non indexées (Coverage)** (40 pts)
GSC > Indexing > Pages :
- « Indexées » : nombre total (snapshot + tendance 28j)
- « Non indexées » : par raison
  - « Découverte ‑ actuellement non indexée » ← LE FAMEUX 284 → 147
  - « Explorée ‑ actuellement non indexée » (Google a crawlé mais
    décidé de pas indexer — souvent HCU/qualité)
  - « Page en double, sans URL canonique sélectionnée par l'utilisateur »
  - « Page en double, Google a choisi une URL canonique différente »
  - « Page avec redirection » (URLs EN→FR 301 ← EXPECTED 2026-05-16+)
  - « URL bloquée par robots.txt » (EN→FR 301 + Disallow /en/)
  - « Soft 404 » (HCU déclassement)
  - « Erreur du serveur (5xx) »

**4.7 — Analyse régression 284 → 147 (CŒUR AUDIT)** (45 pts)
**Hypothèses à tester avec données réelles** :

H1. **EN locale désactivé 2026-05-16** :
- Avant : URLs `/en/*` étaient dans sitemap → comptées dans découvertes
- Après : `filterEnIfDisabled()` strip toutes URLs `/en/*` → ~50 %
  des URLs disparaissent du sitemap → Google les sort de la file
- Tester : exporter Coverage CSV, filter par URL contenant `/en/` →
  combien sont en « Soft 404 » / « Page avec redirection » / « Découverte »
- Si > 100 URLs EN en redirection + chute discovery 137 ≈ 50 % de 284
  → H1 confirmée à ~50 %

H2. **HCU 2024 application massive** :
- Google déclasse pages thin / templated / doorway
- pSEO villes V1 = Paris uniquement, mais stubs structurels 13K routes
  qui pourraient avoir été indexées par erreur avant `getIndexableVilles()`
- Tester : Coverage > Explorée non indexée → présence URLs `/implantations/*`

H3. **stub.invalid build sans knowledge-N sub-sitemap** :
- Si `generateSitemaps()` exécuté au build et kbCount=0 stub → 0 chunks
- Au runtime `/sitemap/knowledge-1.xml` → 404 (pas dans generateSitemaps)
- KB articles publiés → invisibles au sitemap-index → Google sort de file
- Tester : Coverage > Découvertes → présence URLs `/connaissances/*` ?
  Si oui, ils ont été découverts AUTREMENT (lien interne, IndexNow)
  mais sortent de la file faute de sitemap

H4. **BUILD_TIME stale lastmod** :
- `buildTimeOrNow()` lit `process.env.BUILD_TIME` figé au build
- Si build récent < 7j → lastmod cohérent
- Si pas de redeploy depuis 14j → tous lastmod = vieux date → Google
  considère pages stables → pas de re-crawl → discovery rate baisse

H5. **Cloudflare cache TTL trop long sur sitemap** :
- Header `s-maxage=86400` → Cloudflare cache 24h
- Si nouveau sub-sitemap émis post-deploy, CF sert vieux pendant 24h
- Vérifier `cf-cache-status` sur curl répété

H6. **GSC validation re-soumission requise** :
- Si Google a vu erreur 5xx sur sitemap-index pendant fenêtre incident
  (mémoire incident 2026-05-15 503 origin), il peut avoir mis le
  sitemap en pause auto
- Vérifier GSC > Sitemaps > status historique 28j

**4.8 — Vérifier accès GSC API + tokens** (15 pts)
- Service account Google Cloud avec rôle « Search Console User » ?
- Token OAuth refresh stocké côté admin Axion-IA pour API GSC ?
- `gsc-client.ts` utilise quel scope ?
- Si pas d'accès GSC API → Will doit fournir export CSV manuel

**4.9 — GSC URL Inspection API (bulk automation)** (P1 — v2 Option B) (25 pts)
- Endpoint : `POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`
- Quota : 2 000 req/jour, 600 req/min (read-only, sans publish)
- Lire si `gsc-client.ts` expose `urlInspection.index.inspect()` ou pas
- Capacité audit : 2K URLs/jour vérifiables auto (canonicalUrl,
  coverageState, indexingState, lastCrawlTime, mobileUsability)
- Outil recommandé : `inspectUrl(url)` → JSON → enregistrer
  `Article.gscIndexState` ou table dédiée pour observabilité
- Si absent : flagger P1, c'est l'outil clé pour monitorer indexation
  individuelle sans CSV export manuel
- ⚠️ NE PAS appeler en audit (sample max 10 URLs si vraiment besoin
  d'illustrer un point — quota partagé avec prod)
- Vérifier que pas d'appel involontaire au build/runtime

**4.10 — Bing Webmaster Tools** (25 pts)
- Site `axion-ia.com` vérifié BWT ?
- Sitemap soumis BWT (séparé de GSC) ?
- API key BWT stockée ?
- « Crawl Information » dernière fenêtre : pages discovered, indexed
- « URL Inspection » sample 10 URLs pour vérifier indexation Bing

**Gates AGENT 4** :
- GSC sitemap status ≠ « Succès » = 🔴 P0
- Pages 5xx dans sitemap > 1 % = 🔴 P0
- Sitemap pas re-crawlé depuis > 14j = 🟠 P1
- BWT pas configuré = 🟠 P1
- Quota Indexing API saturé sans alerte = 🟠 P1

═══ AGENT 5 — Canonical + hreflang + redirects + cross-check + chains ═ /200

**5.1 — Canonical tag par page** (30 pts)
Sample stratifié 30 URLs (5 pages, 5 blog, 5 case-studies, 5 ville,
5 implementation, 5 admin login redirect, 5 random) :
- `<link rel="canonical" href="…">` présent, absolu HTTPS, sans trailing slash
- Cohérent avec `<meta property="og:url">` et URL réelle servie
- Pas de canonical cross-domain (vers axionia.eu obsolète, etc.)
- Pas de canonical loop (A→B→A)

**5.2 — Hreflang cohérence sitemap + HTML head** (35 pts)
- Si EN OFF : pas de hreflang="en" dans HTML head (sinon Google
  considère page bilingue mais EN renvoie 301 → confusion)
- `filterEnIfDisabled()` strip `alternates.languages.en` du sitemap : OK
- Mais le HTML head de chaque page FR émet-il encore `<link rel="alternate"
  hreflang="en" href="…">` ? Si oui → incohérence avec sitemap

**5.3 — x-default** (15 pts)
- FR = `x-default` (cabinet français primaire)
- Cohérent partout (sitemap + HTML head + JSON-LD si présent)

**5.4 — Redirects EN → FR (post 2026-05-16)** (30 pts)
- `src/proxy.ts` intercepte `/en/*` → 301 vers `/fr/<équivalent>`
  via `mapEnToFr()` (cf. `src/lib/i18n/en-to-fr-redirect.ts`)
- Vérifier curl `-I https://axion-ia.com/en/about` → 301 Location `/fr/a-propos`
- Vérifier qu'il n'y a PAS de boucle 307 self-redirect (bug next-intl v4.11)
- Vérifier que la chaîne est 1 hop (pas /en/about → /en/a-propos → /fr/a-propos)
- Vérifier que `Cache-Control` sur 301 = `public, max-age=31536000`
  (1 an, signal Google « permanent »)

**5.5 — Redirect non-www → apex (ou inverse)** (15 pts)
- Une seule version canonique : `https://axion-ia.com` (apex)
- `https://www.axion-ia.com` → 301 vers apex ?
- `http://axion-ia.com` → 301 vers HTTPS ?
- Cloudflare règle redirect appliquée ?

**5.6 — Trailing slash policy** (15 pts)
- `/blog/article` vs `/blog/article/` — UNE seule version canonique
- Vérifier Next 16 default : pas de trailing slash
- Vérifier middleware/proxy ne réintroduit pas trailing
- Si les deux servent 200 sans canonical réciproque = duplicate

**5.7 — Cross-check sitemap URL ↔ HTML canonical** (P0 — v2 Option B) (25 pts)
Bug fréquent : le sitemap émet `https://axion-ia.com/blog/article` mais
la page HTML émet `<link rel="canonical" href="https://axion-ia.com/blog/article/">`
(trailing slash mismatch). Google considère canonical comme autorité,
sort sitemap URL de la file de découverte → URL jamais indexée malgré
sitemap. **CECI EST UNE CAUSE PROBABLE de la chute 284 → 147**.

Tests :
- Sample 50 URLs sitemap aléatoires
- Pour chacune : curl → extract `<link rel="canonical">`
- Comparer string-exact avec URL sitemap (case-sensitive, trailing slash,
  query params, fragment, protocol)
- Mismatch rate :
  - 0 % : ✅
  - 1-5 % : 🟡 P2 (edge cases tolérés)
  - 5-15 % : 🟠 P1 (à corriger)
  - > 15 % : 🔴 P0 (cause majeure régression discovery)
- Identifier le PATTERN du mismatch (ville → trailing slash, blog →
  protocol, image-bank → fragment, etc.)

**5.8 — Redirect chains exhaustif (multi-hop + broken)** (P0 — v2 Option B) (25 pts)
Au-delà de EN→FR audité §5.4 :
- Crawl tous les 301/302 émis (sample 100 URLs anciennes mémoire git log
  changements slug, refonte URL routing 14.X, mémoire pivots)
- Pour chaque redirect : suivre la chaîne jusqu'au 200
- Chaîne > 1 hop = 🟠 P1 (Google passe au max 5 hops mais dégrade signal)
- Chaîne > 3 hops = 🔴 P0
- Boucle infinie = 🔴 P0 BLOQUANT
- 301 → 404 (broken chain) = 🔴 P0 (lien interne pointe vers redirect cassé)
- Mix 301/302 dans la chaîne = 🟠 P1 (302 = temporary, dilue signal)
- Sources de redirects à inventorier :
  - `next.config.ts` redirects array
  - `src/middleware.ts` + `src/proxy.ts`
  - Cloudflare Page Rules / Rules / Redirects
  - Caddy `Caddyfile` redirects (si configuré)
  - Historique migrations slug (Sprint 14.10 SSOT pricing, refonte URLs)

**5.9 — UTM params + paramètres de tracking** (10 pts)
- URLs avec `?utm_source=...` → canonical pointe vers URL sans paramètres
- Vérifier que les redirects EN→FR ne propagent pas UTM en query
  (sinon Google indexe variantes UTM = duplicate)

**Gates AGENT 5** :
- Canonical absent sur page indexable = 🔴 P0
- hreflang="en" présent en HTML alors EN OFF = 🟠 P1
- 301 EN→FR avec loop ou >1 hop = 🔴 P0
- Duplicate avec/sans trailing slash sans canonical = 🟠 P1

═══ AGENT 6 — JSON-LD structuré + AEO + GEO + Next 16 metadata ═══════ /220

**6.1 — JSON-LD Organization (graph racine)** (25 pts)
Page d'accueil `/fr/` :
- `<script type="application/ld+json">` Organization
- `@id` stable (URL-based fragment, ex: `https://axion-ia.com/#organization`)
- `name`, `legalName`, `url`, `logo`, `sameAs[]` (LinkedIn, X, GitHub)
- `address` (Estonia OÜ), `email`, `telephone`, `vatID`
- Pas de duplication Organization sur sub-pages (utiliser `@id` reference)

**6.2 — WebSite + SearchAction** (15 pts)
- WebSite `@id`, `name`, `url`, `inLanguage: "fr"`
- `potentialAction` SearchAction si `/recherche` existe + Pagefind branché
- `publisher` reference vers Organization

**6.3 — BreadcrumbList par page** (25 pts)
- Sample 30 pages : BreadcrumbList JSON-LD présent
- `itemListElement` avec `position`, `name`, `item` (URL absolu)
- Cohérent avec breadcrumb visuel HTML
- Auto-généré via helper SSOT (lib/seo.ts breadcrumb factory)

**6.4 — Article / NewsArticle / BlogPosting** (30 pts)
Pages blog + news :
- `@type: Article` ou `NewsArticle` selon `Article.isNews`
- `headline`, `description`, `datePublished`, `dateModified`,
  `author` (Person reference), `publisher` (Organization reference)
- `image` (absolu HTTPS, > 1200×630 idéal)
- `mainEntityOfPage` = URL canonique
- ⚠️ Pour AEO : `abstract`, `speakable.cssSelector`, `wordCount`

**6.5 — FAQPage + QAPage** (25 pts)
- FAQ générale (`/faq`) → FAQPage avec `mainEntity[]` Question/Answer
- Pages Q/R individuelles (`/faq/[slug]`) → QAPage
- `speakable` selector pour Google Assistant voice
- AEO 2026 : `acceptedAnswer.upvoteCount` (optionnel), `dateCreated`

**6.6 — Person (auteurs blog)** (15 pts)
- `/blog/auteur/[slug]` → Person `@type`
- `jobTitle`, `worksFor` reference Organization, `sameAs[]`, `image`
- Reference dans Article `author` field

**6.7 — Service + LocalBusiness (GEO villes)** (30 pts)
Pages services × villes (`/audit/par-ville/paris`, etc.) :
- `@type: Service` avec `provider` Organization + `areaServed` Place (ville)
- `name`, `description`, `serviceType`, `offers` (PriceSpecification)
- GEO : `LocalBusiness` ou `ProfessionalService` `@type` si applicable
  (mais ⚠️ pas de bureau physique Paris → utiliser Service avec areaServed)

**6.8 — Place + AdministrativeArea (régions/villes)** (20 pts)
Pages `/implantations/[region]/[ville]` :
- `Place` ou `AdministrativeArea` avec `name`, `containedInPlace` (région)
- `geo` (latitude/longitude INSEE)
- `containsPlace` pour ville → contient bureau ou zone d'intervention

**6.9 — HowTo + Course (KB long-form)** (15 pts)
- Articles tutoriels KB → `HowTo` `@type` si step-by-step
- Articles formation → `Course` `@type`
- Boost EAT + featured snippets

**6.10 — Next 16 metadata convention (opengraph-image + favicon + manifest)** (P1 — v2 Option B) (20 pts)
- `axionia/src/app/opengraph-image.tsx` : OG image générée dynamiquement
  - Vérifier qu'elle existe + retourne PNG 1200×630 valide
  - Sample 5 pages : `<meta property="og:image" content="...opengraph-image.png?id=...">`
  - Si page-level `opengraph-image.tsx` présent → override correct ?
  - Erreur génération SSG → fallback statique présent ?
- `axionia/src/app/icon.tsx` + `apple-icon.tsx` : générées dynamiquement
  - Curl `/icon.svg` ou `/icon.png` → 200
  - `/apple-icon.png` → 200, 180×180
  - `<link rel="apple-touch-icon">` dans HTML head ?
- `axionia/src/app/manifest.ts` : PWA manifest
  - Curl `/manifest.webmanifest` → JSON valide
  - `name`, `short_name`, `start_url`, `theme_color`, `icons[]`
  - `display: standalone` ou `minimal-ui`
  - Référencé via `<link rel="manifest" href="/manifest.webmanifest">`
- ⚠️ Important pour Google Discover (AGENT 9) : OG image ≥ 1200px exigée

**6.11 — Validateurs** (15 pts)
- `https://search.google.com/test/rich-results` sample 5 URLs
- `https://validator.schema.org/` sample 5 URLs
- Pas d'erreur critique (warnings tolérés)

**Gates AGENT 6** :
- Organization absent home = 🔴 P0
- BreadcrumbList absent pages profondes = 🟠 P1
- Article sans `datePublished` ou `dateModified` = 🔴 P0
- Service sans `provider` ou `areaServed` (page ville) = 🟠 P1
- Erreur Rich Results Test = 🔴 P0

═══ AGENT 7 — Factory content-gen + workers + scheduler ═════════════════ /200

**7.1 — État content-gen V1.0.3** (20 pts)
Lire `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` :
- `KB_AUTO_PUBLISH=true` ou `false` actuel prod ?
- Cadence réelle factory : combien d'Article publiés/jour 30 derniers j ?
- Taux échec génération (Sentry)
- Backlog draft non publié

**7.2 — Workflow publish → indexation auto** (40 pts)
Trace E2E flow :
1. Generator (Claude API) produit Article draft
2. Quality gate (score ≥ 70 + body ≥ 800 mots + faq ≥ 4)
3. Translation hub (FR canonique + EN miroir si EN ON)
4. Storage Prisma `Article.create({ status: 'draft' })`
5. Promotion `tier_1_indexable` si critères passés
6. `Article.update({ status: 'published', publishedAt: now })`
7. → Hook publish → enqueue `indexnow-batch` BullMQ
8. → Hook publish → enqueue `google-indexing` BullMQ
9. → Hook publish → trigger ISR revalidation sitemap-blog
10. → Hook publish → trigger ISR revalidation sitemap-index (lastmod)
11. → Hook publish → trigger ISR revalidation /blog/[slug] page
12. → Hook publish → trigger ISR revalidation /blog (listing)
13. → Workers exécutent IndexNow + Google Indexing API
14. → Cloudflare purge ciblé URL nouvelle ?

Vérifier chaque étape dans `content-publish-worker.ts` ou équivalent.

**7.3 — Workers BullMQ santé** (40 pts)
Queues à vérifier (lecture stats read-only) :
- `content-publish` : depth, processed last 24h, failed, delayed
- `indexnow-batch` : idem
- `google-indexing` : idem
- `sitemap-rebuild` (si existe)
- `cache-purge` (si existe)
- Worker concurrency cohérente avec Hetzner CPX42 8 cores
- BullMQ `removeOnComplete: { count: 1000 }` pour pas saturer Redis
- Dead letter queue surveillée

**7.4 — Scheduler anti-burst** (25 pts)
Lire `src/server/content-gen/scheduler/anti-burst.ts` :
- Étalement publications sur fenêtre 24h (pas 100 publish 03:00 UTC)
- Random jitter ± X minutes pour éviter pattern bot détectable
- Pause par seuil quota (Indexing API 200/j → throttle si > 180)
- Coordination avec IndexNow rate limit (1 req / 10 sec)

**7.5 — Cron jobs Coolify / GitHub Actions** (25 pts)
Lister tous les crons opérationnels :
- Daily sitemap re-emit (si pas ISR pur) — heure UTC
- Daily IndexNow re-ping URLs récentes
- Weekly GSC report generation
- Monthly Cloudflare cache full purge
- Audit log retention purge
- Backup database (mémoire CRM-Pro Storage Box 3h UTC)

**7.6 — Page admin /admin/content-gen + observability** (25 pts)
- Dashboard admin avec :
  - Articles publiés today / week / month
  - IndexNow soumissions today / week
  - Google Indexing API quota consumé / 200
  - GSC discovery URLs trend 28j
  - Sentry errors content-gen last 24h
- Alertes Telegram configurées

**7.7 — KB V4 audit_log immutable** (25 pts)
- Toute publication enregistrée dans `kb_audit_log`
- Hash-chain SHA-256 (chaque entry hash de la précédente + payload)
- Tamper-evident
- Retention : indéfini (audit trail)

**Gates AGENT 7** :
- Workflow publish sans étape indexation = 🔴 P0
- Worker BullMQ DLQ > 50 jobs = 🔴 P0
- Pas de anti-burst → 100 publish en burst = 🟠 P1
- Cron sitemap re-emit absent = 🟡 P2 si ISR couvre
- Dashboard admin manquant = 🟠 P1

═══ AGENT 8 — pSEO villes + cadence quotidienne discovery ═══════════════ /200

**8.1 — État réel `getIndexableVilles()`** (30 pts)
- Compter villes avec `copy` présent (non-stub)
- V1 estimé : Paris seul (mémoire 2026-05-08)
- Compter villes avec `copy.services.audit` / `interventions` / `implementation`
- Vérifier qu'aucune ville stub structurel n'est dans `getIndexableVilles()`

**8.2 — Cadence promotion ville stub → indexable** (40 pts)
Stratégie business « tous les jours de nouvelles URLs » :
- ⚠️ Génération copy ville (5000+ mots AxionIA-centric + INSEE) est
  COÛTEUSE (Claude API ~$0.20-0.50/ville) → 2 150 villes = $400-1000
- Plan industrialisation mémoire 2026-05-08 :
  Région par région en série, Auvergne-Rhône-Alpes premier (~280 villes)
- Cadence recommandée : 10-20 villes promues / jour
- Sub-process : génération copy → review humain (Will) → flag indexable
  → ISR sitemap re-emit → IndexNow ping
- ⚠️ EN ATTENTE validation Paris pilote par Will (mémoire)

**8.3 — Anti-doorway HCU 2024** (30 pts)
- Doctrine : ≥ 40 % contenu unique exigé par Google
- Cap 95 % AxionIA-centric + 5 % data INSEE = bouclier
- Vérifier que les copies générées dépassent vraiment 5000 mots utiles
- Variabilité lexicale entre villes (pas N-gram répétitif)
- Tester avec outils :
  - Copyscape sample 5 villes
  - SimilarityChecker comparaison Paris vs Lyon vs Marseille
- Si similarity > 60 % cross-villes → 🔴 P0 doorway risk

**8.4 — Services × villes cadence** (25 pts)
- 3 services × N villes × 2 locales = capacité
- V1 = Paris seul × 3 × 1 (EN OFF) = 3 URLs
- Plan : pour chaque ville indexable, copy.services.{audit,intervention,implementation}
  généré + posé → +3 URLs par ville
- Cadence cohérente avec promotion ville

**8.5 — Implementation × villes (par-fonction)** (20 pts)
- 32 sub-modules `AUTOMATISATION_SLUGS_FR` × villes = surface massive
- Vérifier qu'on n'a PAS de cross-product structurel doorway
- Si activé : génération unique par tuple (fonction, ville) ou template ?

**8.6 — Régions + Hub implantations** (20 pts)
- 12 régions métropole indexable + Corse noindex
- Page régions = lister villes principales + maillage interne
- Vérifier qu'on n'a pas de villes indexable HORS région indexable

**8.7 — Maillage interne mega-menu + footer** (35 pts)
- Mega-menu Header expose 5 régions vedettes + lien `/implantations`
- Footer expose toutes les villes pilotes (≤ 30 villes pour pas saturer)
- Crawl path : Home → Implantations → Région → Ville → Service × Ville
- Click depth max recommandé : 3 (Google priorise low click depth)
- Vérifier qu'aucune ville indexable n'est à click depth > 4

**Gates AGENT 8** :
- Ville indexable sans copy = 🔴 P0 (thin content)
- Similarity > 60 % cross-villes = 🔴 P0 (doorway HCU)
- Click depth ville > 4 = 🟠 P1
- Pas de cadence promotion documentée = 🟠 P1

═══ AGENT 9 — AEO/GEO 2026 (Claude.ai, Perplexity, ChatGPT Search) ════ /150

**9.1 — Citation actuelle dans LLMs** (30 pts)
Tests manuels (sans burner trop d'API budget — sample minimal) :
- ChatGPT Search : « cabinet IA opérationnel France » → Axion-IA cité ?
- Perplexity : même query → cité avec source URL ?
- Claude.ai : pareil
- Bing Copilot : pareil
- Si 0 citation sur 4 → 🔴 P0 AEO/GEO
- Documenter URLs citées (lesquelles ressortent en priorité)

**9.2 — Structure réponse pour LLMs** (30 pts)
Pages stratégiques : direct answer 40-80 mots en tête + dev sections.
Sample 10 pages :
- Première ligne ≤ 80 mots = synthèse réponse standalone
- Structure H2/H3 explicite (LLMs parsent hiérarchie)
- `<dfn>` ou `<strong>` sur termes clés
- Tableaux comparatifs (LLMs adorent)

**9.3 — JSON-LD `abstract` + `speakable`** (20 pts)
Vu AGENT 6 : `abstract` (Article AEO) + `speakable.cssSelector`
- Sample 10 pages : présence vérifiée
- `speakable.cssSelector` pointe vraiment vers paragraphes lisibles voice

**9.4 — `subjectOf` + `isBasedOn` + `mentions`** (15 pts)
- `subjectOf` pour relier articles à entités (Place, Service)
- `isBasedOn` pour sources externes citées (papers, data INSEE)
- `mentions` pour entités secondaires
- Boost EAT massif si bien fait

**9.5 — `llms.txt` complet et à jour** (15 pts)
Vu AGENT 2 : présence + format
- Vérifier que les URLs sont les plus pertinentes (services + KB pillar)
- Mise à jour automatique à chaque nouvelle ville promue / KB article ?

**9.6 — `ai.txt`** (10 pts)
Vu AGENT 2 — score consolidé ici.

**9.7 — Schema.org `acceptedAnswer` voice + `Question` SEO 2026** (15 pts)
- QAPage avec `acceptedAnswer.text` ≤ 300 chars (citation directe LLM)
- `Question.upvoteCount` (optionnel mais signal autorité)

**9.8 — GEO : positionnement région/ville dans JSON-LD** (15 pts)
- `Service.areaServed` = Ville (Place) + Région (AdministrativeArea)
- `Service.provider.address` = OÜ Estonia (transparence)
- ⚠️ NE PAS prétendre bureau Paris (faux) → mention « zone d'intervention » + remote

**Gates AGENT 9** :
- 0 citation dans 4 LLMs testés = 🔴 P0
- Pages stratégiques sans direct answer 40-80 mots = 🟠 P1
- llms.txt absent ou stale > 30j = 🟠 P1

═══ AGENT 10 — Crawl budget + perf + CDN + DDoS protection ═════════════ /200

**10.1 — Crawl rate Googlebot observé** (40 pts)
Lecture logs Coolify ou Cloudflare Analytics :
- Req/min Googlebot dernière fenêtre 7j
- Pic vs moyenne
- Pages crawlées le plus souvent (devrait être sitemap-index, blog listing, home)
- Pages crawlées trop souvent (waste)
- Pages JAMAIS crawlées alors qu'indexable (orphan)

**10.2 — Response time Googlebot p50/p75/p95** (30 pts)
- Cible : p75 < 500 ms
- p95 < 1500 ms
- Si > 1500 ms p75 → Google réduit crawl rate auto
- Identifier routes lentes (DB queries, ISR cold)

**10.3 — Caddy + Coolify + Cloudflare cache hit rate** (30 pts)
- CF Analytics > Caching > Cache Hit Ratio par catégorie
- Objectif : > 90 % sur HTML statiques, > 99 % assets
- Sitemap `s-maxage=86400` → CF cache 24h (OK)
- Sitemap-news `s-maxage=` court (< 1h) car fenêtre 48h
- Pages dynamiques admin : `Cache-Control: private, no-store`

**10.4 — Sentry / observability errors 5xx** (25 pts)
- Errors rate sur sitemaps endpoints last 7j
- Errors rate sur pages blog/villes/case-studies
- Stack trace common errors
- Si > 1 % errors sur routes indexable = 🔴 P0

**10.5 — Robots.txt Bingbot crawl-delay impact réel** (15 pts)
- Bing Webmaster > Crawl Information : req/min Bingbot
- Si crawl rate observé > 30 req/sec → directive ignorée
- Si < 1 req/sec → directive respectée (OK pour CPX42)

**10.6 — DDoS / scraper parasite** (20 pts)
- Cloudflare Bot Fight Mode ou Super Bot Fight Mode actif ?
- Vérifier que ClaudeBot/PerplexityBot/OAI-SearchBot ne sont pas
  blockés par Cloudflare WAF auto (mémoire incident CF Managed Challenge
  bloquait bots → résolu, à reconfirmer)
- Vérifier logs CF Firewall Events sample 24h

**10.7 — IPv6 + HTTP/3** (15 pts)
- `curl --http3 https://axion-ia.com` → fonctionnel ?
- IPv6 résolution OK
- TLS 1.3 only (TLS 1.2 toléré, < 1.2 disabled)

**10.8 — Compression + transfer size** (15 pts)
- Sitemap-index brotli/gzip compressed ?
- Vérifier `content-encoding: br` ou `gzip` dans headers
- Taille raw vs compressed (target ratio ≥ 5:1 pour XML)

**10.9 — Worker concurrency vs ressources** (10 pts)
- Sentry + observability : memory usage spike sur build sitemap
- Si OOM kills sur génération sitemap-index → 🔴 P0

**Gates AGENT 10** :
- Response time Googlebot p75 > 1500 ms = 🔴 P0 (Google réduit crawl)
- Cache hit ratio sitemap < 80 % = 🟠 P1
- Bot IA blocké par CF WAF = 🔴 P0 (perte AEO/GEO)
- Errors 5xx > 1 % sur routes indexable = 🔴 P0
- DDoS attack visible = 🟠 P1

═══ AGENT 11 — Discovery vectors étendus (RSS + HTML sitemap + ═════════ /200
                Image sitemap deep + Link graph + Discover)

**11.1 — RSS / Atom feeds** (P0 — v2 Option B) (35 pts)
Lire `axionia/src/server/exporters/knowledge-rss.ts` :
- Endpoint exposé (`/feed.xml` ? `/rss.xml` ? `/blog/feed.xml` ? KB feed ?)
- Curl → status 200, Content-Type `application/rss+xml` ou `application/atom+xml`
- Format valide (XML schema RSS 2.0 ou Atom 1.0)
- `<lastBuildDate>` à jour
- Items récents (50 derniers articles tier-1 indexable)
- Chaque item : `<title>`, `<link>`, `<description>`, `<pubDate>`,
  `<guid isPermaLink="true">`, `<author>`, `<category>`
- Feed découverte HTML : `<link rel="alternate" type="application/rss+xml"
  title="..." href="/feed.xml">` dans HTML head des pages blog ?
- Feed séparé par catégorie blog / par tag / global ?
- Couvre aussi KB (`/feed/connaissances.xml`) + actualités (`/feed/actualites.xml`) ?
- Mêmes considérations stub.invalid au build (cf. mention dans contexte)
- Pertinence 2026 : aggregateurs (Feedly, Inoreader), Apple News,
  Smart Speakers (Alexa flash briefings), certains LLMs ingèrent RSS
- Si absent : 🔴 P0 (vecteur discovery passif gratuit perdu)

**11.2 — HTML sitemap `/plan-du-site`** (P0 — v2 Option B) (25 pts)
- Page humainement navigable listant TOUTES les pages indexable
- Curl `/fr/plan-du-site` → status 200, HTML structuré (pas que XML)
- Sections : Pages principales, Blog, KB, Cas concrets, FAQ, Aide,
  Implantations (régions + villes pilotes), Comparaisons, Implémentation
- Liens internes en `<a href>` (pas JS-only, crawlable Googlebot baseline)
- Pagination si > 500 liens (sinon trop volumineux)
- Lien depuis Footer (anchor `Plan du site`) sur toutes les pages
- Pertinence : vecteur discovery secondaire (bots non-XML-parsers),
  UX accessibilité, fallback si XML sitemap KO
- Si absent : 🟠 P1 (bonne pratique mais pas critique 2026)

**11.3 — Image sitemap deep (Sitemap 1.1 spec)** (P0 — v2 Option B) (40 pts)
Lire `axionia/src/app/sitemaps/images-fr.xml/route.ts` + `images-en.xml/route.ts` :
- Curl `/sitemaps/images-fr.xml` → status 200, `application/xml`
- Namespace : `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`
- Format `<urlset>` (pas sitemapindex) avec `<url>` + `<image:image>` enfants :
  ```xml
  <url>
    <loc>https://axion-ia.com/galerie/photo-1</loc>
    <image:image>
      <image:loc>https://axion-ia.com/images/photo-1.webp</image:loc>
      <image:caption>Légende SEO descriptive</image:caption>
      <image:title>Titre image</image:title>
      <image:license>https://creativecommons.org/licenses/by/4.0/</image:license>
      <image:geo_location>Paris, France</image:geo_location>
    </image:image>
  </url>
  ```
- Vérifier que image-bank V1 (mémoire 2026-05-16 PR #14 mergée ?) émet
  bien les builders → si pas mergé, ces endpoints retournent 404
- Compter `<image:image>` total émis
- Compter URLs page hôtes émises (max 1000 images par URL parent)
- Vérifier liens vers Image Search Google : sample 5 images,
  reverse search Google Images → image trouvée et associée à URL Axion-IA ?
- `image:license` : Creative Commons URL ou license commerciale ?
- `image:geo_location` : opportunité GEO/pSEO villes

**11.4 — Internal link graph BFS + orphans + click depth** (P1 — v2 Option B) (50 pts)
Crawl BFS depth 6 depuis `/fr/` :
- Construire graphe orienté (page A → liens internes B, C, D)
- Compter URLs reachable depth 1, 2, 3, 4, 5, 6
- Identifier orphans : URLs indexable (dans sitemap) mais non reachable
  par BFS depth 6 = invisible crawl-time pour Googlebot
- Identifier dead-ends : URLs reachable mais sans aucun lien sortant
- Click depth distribution :
  - Depth ≤ 2 : pages stratégiques (services, KB pillar) — cible
  - Depth 3-4 : pages secondaires (articles, cas concrets)
  - Depth ≥ 5 : long tail (villes secondaires, articles vieux)
  - Depth = ∞ (orphan) : 🔴 P0
- PageRank flow approximatif :
  - Home reçoit ~80 % PageRank externe
  - Distribué via mega-menu, hero CTA, footer
  - Calculer combien de pages reçoivent < 0.01 PageRank (poids négligeable)
- Outils :
  - Playwright headless BFS custom (script audit)
  - OU export Screaming Frog si Will fournit licence
  - OU lire `linkChecker` si déjà présent
- Cross-référence avec sitemap : URLs dans sitemap ET orphan = waste ;
  URLs reachable ET pas dans sitemap = découverte HTML-only (sous-optimal)

**11.5 — Google Discover eligibility** (P1 — v2 Option B) (30 pts)
Google Discover = surface séparée Search, feed Android/iOS Chrome.
Pertinent pour Axion-IA (contenu news IA B2B France). Critères :
- E-E-A-T fort (Expertise, Experience, Authoritativeness, Trustworthiness)
- Fraîcheur : articles < 30 jours favorisés
- Image OG ≥ 1200×675px (Google's hard floor) — vérifier sample
- `max-image-preview:large` dans `<meta name="robots">`
- Schema.org `Article` ou `NewsArticle` avec `image[].url` ≥ 1200px
- Mobile-first compliance (vu §12.5)
- HTTPS obligatoire
- Pas de contenu sensationnaliste / clickbait (Google filtre)
- Conformité Google Discover Content Policies
- Vérifier `_AUDIT/` si déjà vérifié : couverture GSC > Discover ?
  (Si > 100 impressions Discover/jour → site éligible confirmé)
- Si éligibilité absente : 🟠 P1 (potentiel trafic majeur perdu)

**11.6 — Knowledge Graph + entity linking (Wikidata)** (20 pts)
- Vérifier si Axion-IA est référencé dans Knowledge Graph Google
  (test : « Axion-IA » dans Google.fr → panneau de droite affiché ?)
- Si non : créer entité Wikidata + Wikipedia draft (action humaine Will)
- JSON-LD Organization `sameAs[]` doit inclure Wikidata Q-ID + Wikipedia URL
  une fois créés
- LinkedIn Company Page reference vérifiée ?
- X / Mastodon profile reference ?

**Gates AGENT 11** :
- RSS feed absent ou 5xx = 🔴 P0
- HTML sitemap absent = 🟠 P1
- Image sitemap retourne 0 image alors qu'image-bank PR #14 mergée = 🔴 P0
- Orphan rate > 5 % du total indexable = 🔴 P0
- Click depth > 5 pour > 10 % des URLs indexable = 🟠 P1
- 0 impression Google Discover sur 30j = 🟠 P1

═══ AGENT 12 — Edge cases : 404/410/Soft 404 + cloaking + ═════════════ /200
                CMP + Vary/CSP + Mobile-first + server logs raw

**12.1 — 404 vs 410 vs Soft 404 policy** (P0 — v2 Option B) (35 pts)
- 404 (Not Found) : page n'existe pas → Google re-essaie pendant ~30j
- 410 (Gone) : page supprimée définitivement → Google désindexe ~24h
- Soft 404 : page retourne 200 mais contenu thin / message « pas trouvé »
  → Google détecte auto et désindexe (signal négatif site-wide)
Tests :
- Curl `/fr/page-inexistante-aleatoire-xyz123` → status 404 + page
  custom `axionia/src/app/[locale]/not-found.tsx` rendue
- Header `Cache-Control: no-store` ou `public, max-age=300` (court)
- Page 404 elle-même : `<meta name="robots" content="noindex, nofollow">`
- Pour URLs supprimées définitivement (slug change, article retiré) :
  - Stratégie actuelle : 404 ou 410 ou 301 vers nouvelle URL ?
  - Si Article.deletedAt set : middleware retourne 410 ?
  - Lire `axionia/src/middleware.ts` + `proxy.ts` pour logique
- Soft 404 detection :
  - Pages avec `<h1>` contenant « Pas trouvé », « Aucun résultat »,
    « Article inexistant » mais status 200
  - Sample 30 URLs avec contenu thin (villes stub, KB vide, blog filter
    zero result) → vérifier si Google flag GSC > Pages > Soft 404
- Recommandation : pour Article.unpublished → 410, pour slug change → 301

**12.2 — Cloaking / User-Agent sniffing detection** (P0 — v2 Option B) (35 pts)
Anti-pattern critique : servir contenu différent à Googlebot vs utilisateur.
Si détecté = pénalité manuelle Google (suppression index complet site).
Tests :
- Sample 20 URLs stratégiques
- Curl 1 : `-A "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120"`
- Curl 2 : `-A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"`
- Diff body byte-for-byte → mismatch = 🔴 BLOQUANT
- Acceptables : timestamps, A/B variants COOKIE-based (pas UA-based)
- Vérifier middleware/proxy ne fait pas branch sur `request.headers['user-agent']`
- Vérifier Cloudflare Workers / Page Rules ne servent pas variant Googlebot
- Vérifier Coolify proxy / Caddy ne fait pas redirect UA-based
- Header `Vary: User-Agent` : si présent → suggère branch UA → flagger
  pour investigation (peut être légitime mais à valider)

**12.3 — Cookie consent / CMP impact Googlebot** (P0 — v2 Option B) (30 pts)
Anti-pattern : bannière CMP (Cookiebot, Axeptio, Didomi…) bloque rendering
contenu avant consentement → Googlebot voit `<body>` vide ou overlay.
Tests :
- Curl URL stratégique en mode « no JS » (curl raw HTML)
- Vérifier que contenu principal est présent dans HTML SSR (pas client-side
  hydration uniquement)
- Tester avec Lighthouse `--throttling-method=devtools --emulated-form-factor=desktop`
  + bloquer CMP scripts → contenu toujours visible ?
- Si Axion-IA utilise CMP : vérifier que script CMP exclut Googlebot UA
  OU permet contenu pré-consentement
- Vérifier Search Console > URL Inspection > Live Test sample 5 URLs :
  - Screenshot rendu Googlebot affiche contenu ?
  - HTML rendered contient les `<p>` principaux ?
- Si CMP bloque : 🔴 P0 (Google indexe page vide → soft 404)

**12.4 — Vary header + CSP impact rendering** (P1 — v2 Option B) (25 pts)
**Vary header** :
- `Vary: User-Agent` problématique pour CDN cache (split par UA = miss rate haut)
- `Vary: Accept-Encoding` standard et OK
- `Vary: Accept-Language` problématique si > 2 locales (cache fragmenté)
- Sample 10 URLs : observer headers `Vary`
**CSP (Content-Security-Policy)** :
- Sample 5 URLs : extraire CSP header
- Vérifier que CSP n'interdit pas le rendu propres ressources :
  - `script-src 'self'` doit lister CDN propres si utilisés
  - `img-src` doit autoriser Unsplash / CDN images si page utilise
  - `connect-src` pour fetch DOM JS-hydrated
- CSP report-uri ou report-to configuré pour monitorer violations ?
- ⚠️ CSP trop strict → Googlebot Chrome render headless rate-limit
  → Google rapporte « page rendering issue » dans GSC Coverage

**12.5 — Mobile-first indexing** (P1 — v2 Option B) (35 pts)
Google indexe la version MOBILE depuis 2021. Vérifier :
- Pas de subdomain `m.axion-ia.com` (responsive design only) ✅
- `<meta name="viewport" content="width=device-width, initial-scale=1">`
  présent sur 100 % pages — sample 20 URLs
- Pas de bloquage mobile dans robots.txt (`User-agent: Googlebot-Mobile`)
- Lighthouse mobile sur 5 pages stratégiques :
  - Mobile-friendly score 100/100
  - Pas de horizontal scroll
  - Tap targets ≥ 48×48px
  - Texte ≥ 12px sans zoom requis
- Structured data identique mobile vs desktop (pas de variation conditionnelle)
- Contenu principal identique mobile vs desktop (pas hidden behind « voir plus »)
- Vérifier GSC > Settings > User-Agent crawler par défaut = Googlebot smartphone

**12.6 — Server logs raw analysis (reverse DNS + fake bots)** (P1 — v2 Option B) (25 pts)
- Accès logs raw Coolify / Caddy / Cloudflare logs (Will fournit)
- Filter UA contenant `Googlebot|Bingbot|ClaudeBot|PerplexityBot|OAI-SearchBot`
- Pour chaque IP source :
  - Reverse DNS lookup (`dig -x <IP>` ou `host <IP>`)
  - Forward verify : nom retourné doit résoudre vers `*.googlebot.com`,
    `*.search.msn.com`, etc.
  - Si UA Googlebot mais reverse DNS ≠ googlebot.com → 🚨 FAKE BOT
    (scraper qui se fait passer pour Googlebot)
- Compter req/min par bot légitime sur fenêtre 24h
- Identifier patterns suspects : 1 IP avec UA rotation, pic anormal,
  burst > 100 req/sec
- Vérifier que les fake bots ne consomment pas crawl budget origin
- Action si fake bot détecté : flagger pour blocage Cloudflare WAF
  custom rule (mais NE PAS bloquer dans cet audit)

**12.7 — Lighthouse SEO score lab** (15 pts)
- Lighthouse `--only-categories=seo` sample 10 URLs stratégiques
- Score cible ≥ 95/100 (parfait ≥ 100)
- Findings communs à vérifier :
  - `<title>` présent, unique, < 60 chars
  - `<meta name="description">` présent, unique, 120-160 chars
  - `<html lang="fr">` correct
  - `crawlable links` : pas de `<a href="javascript:..">`
  - `valid hreflang` (vu AGENT 5)
  - `valid rel=canonical` (vu AGENT 5)
  - `image alt attributes` exhaustif

**Gates AGENT 12** :
- Cloaking détecté (mismatch UA Googlebot vs Chrome) = 🔴 BLOQUANT
  (pénalité manuelle Google possible)
- CMP bloque rendu pré-consentement = 🔴 P0 (soft 404 massif)
- Fake bot détecté > 100 req/jour = 🟠 P1
- Lighthouse SEO score < 90 = 🟠 P1
- Mobile-friendly fail = 🔴 P0 (mobile-first indexing)
- Article.unpublished retourne 200 (soft 404) = 🔴 P0

╔═══════════════════════════════════════════════════════════════════════╗
║                  3 SYNTHÈSES + 1 VERDICT FINAL                        ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ SYNTHÈSE 1 — Diagnostic régression 284 → 147 ════════════════════════

Format dédié `_AUDIT/INDEXATION-DISCOVERY-2026-XX-XX/REGRESSION-DIAGNOSTIC.md` :

- État avant (date inconnue, 284 découvertes)
- État après (2026-05-17, 147 découvertes)
- Delta = 137 URLs
- 6 hypothèses testées (H1 EN OFF, H2 HCU, H3 stub kbCount, H4 BUILD_TIME stale,
  H5 CF cache long, H6 GSC validation pause)
- Pour chaque hypothèse : test, données réelles, verdict ✅ confirmé /
  ❌ infirmé / 🟡 partiellement contributif (X %)
- **Cause racine principale** : nommée + chiffrée
- **Causes secondaires** : listées ordre contributif décroissant
- **Effet** sur discovery quotidienne future si non patché

═══ SYNTHÈSE 2 — Top 30 patches priorisés P0/P1/P2 ═════════════════════

Format dédié `_AUDIT/INDEXATION-DISCOVERY-2026-XX-XX/TOP-30-PATCHES.md` :

Tableau avec colonnes :
| # | Priorité | Titre | Fichier | Effort | Impact discovery | Risque régression |

- P0 (≤ 10) : bloquants, à fixer immédiatement, < 4h chacun
- P1 (≤ 15) : importants, à fixer Sprint suivant, < 8h chacun
- P2 (≤ 5) : optimisations, V1.5+, < 16h chacun

Pour chaque patch :
- Description courte (≤ 200 mots)
- Pseudocode ou diff conceptuel (PAS de code prêt à coller — audit-only)
- Impact estimé : « +X URLs/jour discovery » ou « -Y % erreurs sitemap »
- Risque de régression : faible / moyen / fort (justifié)
- Dépendances avec autres patches

═══ SYNTHÈSE 3 — Plan cadence quotidienne new URLs ═════════════════════

Format dédié `_AUDIT/INDEXATION-DISCOVERY-2026-XX-XX/DAILY-CADENCE-PLAN.md` :

Objectif business : tous les jours de nouvelles URLs entrent en file
de découverte Google, échelonné pour crawl budget.

Sources de new URLs quotidiennes possibles :
- A. Factory content-gen : 10-100 articles/jour (réglable KB_AUTO_PUBLISH)
- B. Promotion ville pSEO : 10-20 villes/jour (industrialisation région
     par région — mémoire 2026-05-08)
- C. Services × villes : 3 par ville promue (audit + intervention + implementation)
- D. Case studies : ~1-2/semaine (production éditoriale)
- E. KB V4 questions répondues : 5-10/jour (factory Q/R)
- F. Comparaisons concurrentielles : ~1/semaine
- G. Image-bank V1 : ~10-50 images/jour si activé

Plan recommandé fenêtre 30 jours :
- Semaine 1 : factory 50/jour + 0 ville + image-bank OFF = 50/jour
- Semaine 2 : factory 50/jour + 10 villes/jour + image-bank 10/jour = 70/jour
- Semaine 3 : factory 100/jour + 20 villes/jour + image-bank 30/jour = 150/jour
- Semaine 4 : régime de croisière 100-150/jour

Cohérent avec :
- Quota Indexing API 200/jour (→ demander augmentation à 10K)
- IndexNow rate limit 1000/jour pratique
- Crawl budget Googlebot (CPX42 8 cores supporte ~5K req/jour)
- Anti-burst scheduler (étalement 24h fenêtre)

Métriques de succès quotidiennes à surveiller :
- GSC discovery URLs (cible : +50/jour minimum)
- GSC indexed URLs (cible : +30/jour, 60 % conversion discovery→indexed)
- Bing Webmaster discovered URLs
- Sentry errors content-gen rate
- BullMQ DLQ depth (cible 0)

═══ VERDICT FINAL ═══════════════════════════════════════════════════════

Format dédié `_AUDIT/INDEXATION-DISCOVERY-2026-XX-XX/VERDICT-FINAL.md` :

Score consolidé /2400 = somme des 12 agents.

| Agent | Score | Domaine |
|---|---|---|
| 1 | /220 | Sitemap-index racine + cohérence + lastmod gaming |
| 2 | /150 | Robots.txt + bots IA + llms.txt + ai.txt + IndexNow key |
| 3 | /200 | IndexNow auto-trigger + multi-moteurs |
| 4 | /275 | Google Indexing API + GSC + URL Inspection API |
| 5 | /200 | Canonical + hreflang + redirects + cross-check + chains |
| 6 | /220 | JSON-LD + AEO + GEO + Next 16 metadata (OG/icon/manifest) |
| 7 | /200 | Factory content-gen + workers + scheduler |
| 8 | /200 | pSEO villes + cadence quotidienne |
| 9 | /150 | AEO/GEO LLMs (Claude/Perplexity/ChatGPT/Bing) |
| 10 | /200 | Crawl budget + perf + CDN + DDoS |
| 11 | /200 | RSS + HTML sitemap + Image sitemap deep + link graph + Discover |
| 12 | /200 | Edge cases (404/410, cloaking, CMP, Vary/CSP, mobile, logs) |
| **Total** | **/2415** | |

Verdict :
- ≥ 2 174 (90 %) : 🟢 GO « indexation discovery prod-grade 2026 »
- ≥ 1 932 (80 %) : 🟡 CONDITIONAL GO (patches P0 obligatoires < 48h)
- ≥ 1 449 (60 %) : 🟠 SPRINT CORRECTIF (patches P0+P1 obligatoires < 2 semaines)
- < 1 449 : 🔴 NO-GO (régression critique, audit V2 après patches P0)

Inclure :
- Tableau récap 12 agents × score × verdict
- Top 5 P0 absolus bloquants (synthèse extrême)
- 3 décisions à prendre par Will (config policy, KB_AUTO_PUBLISH, pSEO industrialisation cadence)
- Effort total estimé pour atteindre 🟢 GO
- Risques résiduels acceptés (P2 reportés V1.5+)

╔═══════════════════════════════════════════════════════════════════════╗
║                  FORMAT LIVRABLES — STRICT                            ║
╚═══════════════════════════════════════════════════════════════════════╝

Dossier `_AUDIT/INDEXATION-DISCOVERY-2026-XX-XX/` (remplacer XX-XX
par date du jour `MM-DD`, ex `05-17`).

16 fichiers Markdown (v2 Option B) :
 1. `README.md` (manifest + comment naviguer le dossier)
 2. `AGENT-01-SITEMAP-INDEX.md` (/220)
 3. `AGENT-02-ROBOTS-LLMS-AI.md` (/150)
 4. `AGENT-03-INDEXNOW.md` (/200)
 5. `AGENT-04-GSC-INDEXING-URL-INSPECTION.md` (/275)
 6. `AGENT-05-CANONICAL-HREFLANG-CHAINS.md` (/200)
 7. `AGENT-06-JSON-LD-AEO-GEO-METADATA.md` (/220)
 8. `AGENT-07-CONTENT-GEN-WORKERS.md` (/200)
 9. `AGENT-08-PSEO-VILLES-CADENCE.md` (/200)
10. `AGENT-09-AEO-GEO-LLMS.md` (/150)
11. `AGENT-10-CRAWL-BUDGET-PERF.md` (/200)
12. `AGENT-11-DISCOVERY-VECTORS-EXTENDED.md` (/200) — RSS + HTML sitemap +
     Image deep + link graph + Discover
13. `AGENT-12-EDGE-CASES-ANTI-PATTERNS.md` (/200) — 404/410 + cloaking +
     CMP + Vary/CSP + mobile + server logs raw
14. `REGRESSION-DIAGNOSTIC.md` (synthèse 1)
15. `TOP-30-PATCHES.md` (synthèse 2)
16. `DAILY-CADENCE-PLAN.md` (synthèse 3)
17. `VERDICT-FINAL.md` (verdict consolidé)

(17 fichiers total au final si on compte le README séparé, 16 « pièces
analytiques » au sens audit.)

Conventions strictes :
- Chaque fichier AGENT-XX commence par : titre + score brut /MAX
- Sections numérotées `N.X` cohérent avec ce prompt
- Findings : ✅ OK / 🟠 P1 / 🔴 P0 / 🟡 P2 avec preuve (curl output,
  capture URL, code excerpt path:line)
- AUCUN code prêt à coller (audit-only) — uniquement diff conceptuel
  ou pseudo-code descriptif
- Citations exactes mémoire et fichiers code avec path:line
- Pas d'hallucination — si donnée inaccessible, le dire explicitement
  (« Will doit fournir export GSC CSV »)

╔═══════════════════════════════════════════════════════════════════════╗
║                  PROTOCOLE D'EXÉCUTION                                ║
╚═══════════════════════════════════════════════════════════════════════╝

1. **Phase 0 — Lecture obligatoire** (~30 min)
   Lire les 9 référentiels mémoire + 30 fichiers code + audit précédent
   `CONTENT-GEN-AUDIT-INDEXATION-FR-2026-05-15.md`. Si questionnement
   réel, STOP & ASK Will avant agents (anti-double-travail).

2. **Phase 1 — 12 agents en parallèle** (~4-6h)
   Lancer les 12 agents en parallèle via Task tool (subagent_type
   general-purpose ou Explore selon agent). Chaque agent produit son
   `AGENT-XX-*.md`. Pas de cross-contamination — chaque agent indépendant.

3. **Phase 2 — 3 synthèses séquentielles** (~1-2h)
   Une fois les 12 agents complets, produire les 3 synthèses dans
   l'ordre : REGRESSION-DIAGNOSTIC → TOP-30-PATCHES → DAILY-CADENCE-PLAN.
   Chaque synthèse cite explicitement les findings des agents.

4. **Phase 3 — Verdict final** (~30 min)
   Score consolidé /2415 + verdict + STOP & ASK Will sur les 3 décisions.

5. **Phase 4 — Manifest + README** (~15 min)
   `README.md` du dossier avec table of contents + comment naviguer +
   horodatage exécution + commit hash référence + état env vars.

Effort total estimé : **8-11 heures autopilot** (incluant lecture
référentiels + 12 agents + 3 synthèses + verdict + README).

╔═══════════════════════════════════════════════════════════════════════╗
║                  STOP & ASK WILL — POINTS BLOQUANTS                   ║
╚═══════════════════════════════════════════════════════════════════════╝

Si l'auditeur rencontre :
1. **GSC OAuth API inaccessible** : Will fournit export CSV manuel
   « Coverage > All known pages » 28j + « Sitemaps > Submitted »
2. **Bing Webmaster API inaccessible** : Will fournit screenshots
   « Crawl Information » + « URL Submission History » dernières 4 sem
3. **Cloudflare Analytics inaccessible** : Will fournit export CSV
   « Cache Analytics > sitemap*.xml » 7j
4. **Coolify logs inaccessibles** : Will fournit SSH ou pull manuel
5. **DB Prisma read-only token absent** : Will fournit `DATABASE_URL`
   read-replica ou stagiaire pour query SELECT

NE PAS deviner si donnée inaccessible. Documenter dans rapport
« donnée non disponible, Will doit fournir ».

╔═══════════════════════════════════════════════════════════════════════╗
║                  CONTRAINTES ANTI-RÉGRESSION                          ║
╚═══════════════════════════════════════════════════════════════════════╝

Cet audit ne doit RIEN casser. Vérifier en fin d'audit :

- ✅ `git status` : 0 fichier modifié hors `_AUDIT/INDEXATION-DISCOVERY-2026-XX-XX/`
- ✅ 0 commit créé (audit-only)
- ✅ 0 push effectué
- ✅ 0 prisma migrate exécuté
- ✅ 0 POST/PUT/PATCH/DELETE sur APIs externes mutantes
- ✅ 0 env var modifiée Coolify
- ✅ 0 Cloudflare règle modifiée
- ✅ 0 GSC sitemap submit/resubmit (read-only API uniquement)
- ✅ 0 Bing Webmaster URL submission
- ✅ 0 IndexNow ping émis manuellement
- ✅ 0 Google Indexing API publish manuel
- ✅ Pas de coût IA externe > $1 (sample tests AEO minimal)

Si une seule de ces lignes échoue → l'audit est INVALIDE, rollback
immédiat + STOP & ASK Will.

═══════════════════════════════════════════════════════════════════════
FIN DU PROMPT — DÉMARRER AVEC PHASE 0 LECTURE OBLIGATOIRE
═══════════════════════════════════════════════════════════════════════
```

---

## 📋 Phrase d'invocation canonique

Pour lancer l'audit, coller exactement :

```
Lance _AUDIT/PROMPT-INDEXATION-DISCOVERY-DEEP-AUDIT-2026.md v2 Option B
en mode AUDIT-ONLY strict. 12 agents parallèles + 3 synthèses + verdict
final. Livrable unique dans _AUDIT/INDEXATION-DISCOVERY-2026-05-17/
(16 fichiers .md). Effort 8-11h autopilot. STOP & ASK si données GSC/
Bing/CF inaccessibles. Zéro fix, zéro commit, zéro push, zéro submit
URL. Cible score ≥ 2174/2415 pour 🟢 GO.
```

---

## 🔗 Audits complémentaires de référence

- `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-INDEXATION-FR-2026.md` (8 agents /700 — focus FR)
- `_AUDIT/CONTENT-GEN-AUDIT-INDEXATION-FR-2026-05-15.md` (rapport prédécesseur)
- `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL.md` (crawl budget)
- `_AUDIT/E2E-ROUTES-2026-05-15/` (cartographie 320 routes)
- `_AUDIT/DEPLOY-RECOVERY-2026-05-17/` (contexte stub.invalid + ISR)

---

## ✅ Garanties de cet audit (v2 Option B)

| Garantie | Comment |
|---|---|
| **Zéro régression** | Mode AUDIT-ONLY strict + 12 checks anti-régression en fin |
| **Cause racine 284→147 identifiée** | 6 hypothèses testées avec données réelles |
| **Cadence quotidienne plan** | Plan 30j jour-par-jour, sources + cible discovery/jour |
| **AEO/GEO 2026 couvert** | AGENT 9 dédié + AGENT 6 JSON-LD AEO + AGENT 2 llms.txt/ai.txt + AGENT 11 Discover |
| **Crawl budget respecté** | AGENT 10 + Bingbot delay + anti-burst + rate limits |
| **Coût IA borné** | < $1 sample tests AEO (4 LLMs × ~5 queries) |
| **Future-proof 2026+** | Stack 2026 best practices : llms.txt, ai.txt, IndexNow, Indexing API, URL Inspection API |
| **Discovery vectors étendus** | AGENT 11 : RSS + HTML sitemap + Image deep + link graph + Discover + Knowledge Graph |
| **Edge cases anti-pattern** | AGENT 12 : 404/410, cloaking, CMP, Vary/CSP, mobile-first, fake bots reverse DNS |
| **Cross-check sitemap≠canonical** | AGENT 5 §5.7 — bug commun « 284→147 candidate primaire » |
| **Redirect chains exhaustif** | AGENT 5 §5.8 — multi-hop + broken + boucle + 301→404 |
| **Lastmod gaming detection** | AGENT 1 §1.6 — protection signal long-terme Google |
