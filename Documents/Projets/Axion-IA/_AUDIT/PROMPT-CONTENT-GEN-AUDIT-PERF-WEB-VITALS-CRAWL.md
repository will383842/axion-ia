# ⚡ PROMPT AUDIT PERF EXTRÊME 2026 — Web Vitals + Crawl bots + AEO/GEO IA

> Audit dédié extreme perfection 2026 : vérifier vitesse perçue (humains),
> vitesse crawl (15+ bots moteurs + IA), AEO/GEO (être cité par ChatGPT /
> Claude / Perplexity / Gemini), standards émergents (llms.txt, ai.txt),
> Next.js 16 perf-spec (PPR, RSC streaming), edge 2026 (Early Hints 103,
> Speculation Rules, fetchpriority), RUM CrUX réels — sur TOUTES les routes
> Content-Gen V1+V2 + pSEO villes 12 942 routes SSG + KB V4 publique.
>
> Mode AUDIT-ONLY strict. Production : 1 rapport `.md` unique.
>
> Successeur de `axionia/_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md`
> (2026-05-08) qui ne couvrait pas Content-Gen V2 ni pSEO villes massif
> ni l'IA crawl 2026.
>
> Score cible : ≥ 810 / 900 (90 %) pour 🟢 GO PROD extrême perfection.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT PERF EXTRÊME 2026)

Tu es l'auditeur perf + crawl-readiness + AEO/GEO extrême perfection 2026.
V1 (Sprints 1-6 tag v1.0.1) + V2 (Sprints 7-12) + pSEO villes 2 157 villes
× 6 templates ≈ 12 942 routes SSG + KB V4 publique + factory 100 articles/
jour (si KB_AUTO_PUBLISH=true) sont livrés sur main.

Ton job : vérifier que CHAQUE route — humaine ET bot moteur ET bot IA —
est servie EXTRÊMEMENT vite, que les contenus sont OPTIMISÉS pour être
CITÉS par ChatGPT / Claude / Perplexity / Gemini, et que la stack tient
sous charge crawl Googlebot quand la factory publie 100/jour avec auto
IndexNow + Google Indexing API + Bing IndexNow.

PHILOSOPHIE 2026 :
- Web Vitals ≠ optimisation isolée. C'est un signal RUM 28j p75 qui
  conditionne le ranking SEO ET la confiance LLM (cf. études Perplexity
  citations = corrélation forte avec perf + structured data).
- Les IA crawlers (15+) ont des comportements différents des moteurs
  classiques : moins patient sur TTFB, gourmands en structured data,
  préfèrent contenu "canonical answers" extractibles.
- L'AEO/GEO = nouveau combat 2026. Être #1 Google ≠ être cité par
  ChatGPT. Les deux objectifs nécessitent des optimisations distinctes
  mais complémentaires.

⛔ MODE AUDIT-ONLY STRICT — RÈGLES ABSOLUES :
- Aucune édition code, aucun commit, aucun push, aucun migrate
- Aucun appel API IA externe (OpenAI / Anthropic / Voyage / Perplexity)
- Lighthouse / WebPageTest / curl / PageSpeed Insights API / CrUX API
  autorisés en LECTURE-SEULE (zéro POST mutant, zéro write)
- Si bug détecté → noter, NE PAS fix
- Seul livrable : `_AUDIT/CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL-2026-XX-XX.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

Référentiels :
1. axionia/_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md (référentiel V1)
2. axionia/_AUDIT/AUDIT-WEB-VITALS-2026-BASELINE-A.md (baseline pré-V2)
3. axionia/_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md (budgets engagés)
4. axionia/_AUDIT/AUDIT-WEB-VITALS-2026-PATCHES.md (V1+V2 livrés)
5. axionia/_AUDIT/AUDIT-WEB-VITALS-2026-DIAGNOSTIC.md
6. axionia/_AUDIT/AUDIT-WEB-VITALS-2026-ROADMAP.md
7. axionia/_AUDIT/AUDIT-WEB-VITALS-2026-SYNTHESE.md

Code stack :
8. axionia/next.config.* (headers, ISR, output, PPR, experimental.ppr)
9. axionia/middleware.ts (si présent)
10. axionia/src/app/layout.tsx (Speculation Rules, Resource Hints, next/font)
11. axionia/src/app/**/route.ts (sitemaps + robots + llms.txt + IndexNow)
12. axionia/src/app/**/page.tsx :
    - Routes Content-Gen V2 : /actualites, /actualites/[slug], /faq,
      /faq/[slug], /aide, /aide/[slug], /etudes-de-cas, /etudes-de-cas/[slug]
    - Routes KB V4 publique : /connaissances/*
    - Routes pSEO villes : /fr/implantations/[region]/[ville],
      /audit/par-ville/[ville], /interventions/par-ville/[ville],
      /implementation/par-ville/[ville]
13. axionia/src/app/sitemap.xml/route.ts + sitemap-index split
    (news, faq, articles, pages, villes, connaissances)
14. axionia/src/app/robots.txt/route.ts
15. axionia/src/app/llms.txt/route.ts (si existant — sinon flagger)
16. axionia/src/app/ai.txt/route.ts (si existant — sinon flagger)
17. axionia/src/lib/indexnow.ts + helper centralisé (commit b7cbfb4)
18. axionia/src/lib/google-indexing.ts + JWT service account
19. axionia/src/lib/bing-indexnow.ts (si présent)
20. axionia/Dockerfile + Coolify proxy config (Caddy headers cache)
21. axionia/scripts/_perf-firstload-gz.cjs + _perf-chunk-inspect.cjs
22. Cloudflare Cache Rules (5 rules livrées Phase 5 2026-05-09)
23. axionia/src/components/SpeculationRules.tsx (si présent)
24. axionia/src/lib/web-vitals-monitor.ts + WebVitalSample modèle Prisma

Stratégie AEO/GEO :
25. axionia/src/lib/jsonld/* (factories JSON-LD : Article, FAQPage,
    HowTo, Speakable, Organization, LocalBusiness, Service, Offer,
    Product, ImageObject, BreadcrumbList, WebSite, SearchAction)
26. axionia/src/lib/seo/* (helpers metadata, canonical, hreflang)
27. axionia/src/components/AnswerCard.tsx ou TLDR.tsx (si présent)

╔═══════════════════════════════════════════════════════════════════════╗
║                  8 AGENTS PARALLÈLES (perfection extrême 2026)        ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 1 — Web Vitals 2026 complets (RUM-grade) ═══════════════════ /150

Mesure sur prod live (axion-ia.com) en mode mobile 4G throttled + desktop
cable, avec Lighthouse 12.x + WebPageTest + PageSpeed Insights API + CrUX
API directe (read-only).

Métriques exhaustives 2026 :
- **LCP** (Largest Contentful Paint) — target < 2.5s bon, < 1.8s excellent
- **INP** (Interaction to Next Paint, remplace FID depuis mars 2024) —
  target < 200ms bon, < 100ms excellent
- **CLS** (Cumulative Layout Shift) — target < 0.1 bon, < 0.05 excellent
- **TTFB** (Time to First Byte) — target < 800ms bon, < 400ms excellent
- **FCP** (First Contentful Paint) — target < 1.8s
- **TBT** (Total Blocking Time) — target < 200ms
- **Speed Index** — target < 3.4s mobile
- **Soft Navigation INP** — INP sur route changes Next.js App Router
  client-side (critique car SPA-like). À mesurer via `PerformanceObserver`
  type `soft-navigation` ou WebPageTest scénarios scriptés
- **LoAF (Long Animation Frames API)** — successeur Long Tasks 2024+,
  identifie frames > 50ms avec script attribution + render time
- **Long Tasks > 50ms** — count + total durée main thread blocking
- **View Transitions API** perf — si utilisée par Next 16, mesurer
  duration + visibility gap

20 URLs à auditer (sample représentatif) :
1. / (homepage)
2. /interventions (hub familles)
3. /interventions/collectives
4. /audit-conformite-ia
5. /implementation-ia
6. /tarifs
7. /reserver (flow booking — INP critique sur form)
8. /contact
9. /actualites (liste articles factory)
10. /actualites/[slug] (1 article récent factory)
11. /faq (hub FAQ V2)
12. /faq/[slug] (1 FAQ)
13. /aide
14. /aide/[slug] (1 help article)
15. /etudes-de-cas
16. /etudes-de-cas/[slug] (1 case study)
17. /connaissances/[slug] (1 article KB V4 publique)
18. /fr/implantations/ile-de-france/paris (pSEO ville pilote)
19. /audit/par-ville/lyon (template ville)
20. /interventions/par-ville/marseille (template ville)

Pour chaque URL × 2 devices (mobile + desktop) :
- Lighthouse 12.x : 4 scores Perf/A11y/BP/SEO
- 10 Core/secondary Web Vitals mesurés ci-dessus
- Bundle JS first-load (gzip + brotli)
- TTFB cold (CF MISS) vs warm (CF HIT)
- Headers cache (Cache-Control, ETag, Vary, CF-Cache-Status, Age)
- Soft Nav INP simulé : naviguer / → /interventions → /tarifs
- Long Tasks count + LoAF top 3 attribution

Livrable : tableau 20 URLs × 24 colonnes + scoring /150.
Gate : tout LCP > 2.5s mobile = ROUGE.
Gate : tout INP > 200ms (regular OU soft nav) = ROUGE.
Gate : tout CLS > 0.1 = ROUGE.
Gate : tout LoAF > 100ms script attribution external = ROUGE.

═══ AGENT 2 — Crawl bots 2026 (16 user-agents) ═══════════════════════ /120

Simule CHAQUE user-agent et mesure TTFB + status + headers + payload +
HTML render-ability.

**Bots moteurs classiques :**
- `Googlebot/2.1 (+http://www.google.com/bot.html)` (desktop + Smartphone)
- `bingbot/2.0 (+http://www.bing.com/bingbot.htm)`
- `DuckDuckBot/1.1 (+http://duckduckgo.com/duckduckbot.html)`
- `YandexBot/3.0 (+http://yandex.com/bots)`
- `Applebot/0.1 (+http://www.apple.com/go/applebot)` (Spotlight/Siri)
- `MojeekBot/0.2 (+https://www.mojeek.com/bot.html)`

**Bots IA training (opt-out via robots.txt possible) :**
- `Google-Extended` (Gemini training, distinct de Googlebot)
- `Applebot-Extended` (Apple Intelligence training)
- `GPTBot/1.0 (+https://openai.com/gptbot)` (OpenAI training)
- `Bytespider` (TikTok/Doubao training)
- `Amazonbot/0.1 (+https://developer.amazon.com/amazonbot)` (Alexa)
- `Meta-ExternalAgent/1.1` (Llama training)
- `CCBot/2.0 (+https://commoncrawl.org/faq)` (Common Crawl, training)

**Bots IA search-time (citation real-time, CRITIQUE pour GEO 2026) :**
- `ClaudeBot/1.0 (+claudebot@anthropic.com)` (Anthropic search + train)
- `Claude-Web` (Claude direct fetch in-conversation)
- `OAI-SearchBot` (ChatGPT Search results)
- `ChatGPT-User/1.0` (ChatGPT plugins/browsing in-conversation)
- `PerplexityBot/1.0 (+https://www.perplexity.ai/perplexitybot)`
- `Perplexity-User` (user-initiated fetches Perplexity)
- `cohere-ai` (Cohere search/training)
- `DiffBot` (knowledge graph + AI)

15 URLs à tester par bot (sample stratégique) :
- /sitemap.xml + /sitemap-news.xml + /sitemap-faq.xml + /sitemap-villes.xml
  + /sitemap-connaissances.xml
- /robots.txt
- /llms.txt (si présent — sinon flagger AGENT 3)
- /ai.txt (si présent — sinon flagger AGENT 3)
- /actualites + /actualites/[slug-récent]
- /faq/[slug] (Speakable JSON-LD critique pour AEO Google Assistant)
- /connaissances/[slug] (KB V4 — cœur GEO)
- /fr/implantations/ile-de-france/paris
- 5 autres villes pSEO random
- /api/indexnow/ping (GET seul, vérifier 200 + clé exposée)

Pour CHAQUE combinaison bot × URL (≈ 360 mesures) :
- HTTP status (200 / 304 / 403 / 5xx)
- TTFB (curl -w "%{time_starttransfer}")
- Content-Type, Cache-Control, CF-Cache-Status, Vary, Age
- Taille payload (Content-Length gzip / brotli)
- Présence JSON-LD attendu (Article, FAQPage, Speakable, etc.) dans body
- Présence canonical / hreflang / robots meta
- Vérifier que Bot Fight Mode Cloudflare ne bloque PAS les IA search-time
  (cf. mémoire CF Phase 5 : AI Scrapers OFF = OK pour citation)
- Pour bots IA training : vérifier directive robots.txt cohérente avec
  stratégie Will (opt-in souhaité pour visibilité GEO ? opt-out CCBot ?)

Gate : tout bot search-time (ClaudeBot, OAI-SearchBot, PerplexityBot)
       bloqué accidentellement = 🔴 ROUGE (perte massive citations 2026)
Gate : TTFB bot > 600ms = ROUGE (Googlebot abandonne crawl budget)
Gate : TTFB bot > 1500ms = CRITIQUE (IA timeout silencieux)
Gate : Bot Fight challenge envoyé à GPTBot/ClaudeBot = ROUGE

═══ AGENT 3 — AEO + GEO IA optimisation (CŒUR STRATÉGIQUE 2026) ══════ /140

Objectif : maximiser les chances qu'Axion-IA soit CITÉ comme source par
ChatGPT, Claude, Perplexity, Gemini quand un dirigeant cherche "audit IA",
"consultant IA Paris", "ROI implémentation IA PME", etc.

**3.1 — Standards émergents 2024-2026**
- `/llms.txt` — standard proposé par Jeremy Howard (Answer.AI) 2024 :
  fichier markdown structuré listant les pages clés du site + leur résumé,
  optimisé pour ingestion LLM. Vérifier présence + qualité du contenu.
  Format attendu :
  ```
  # Axion-IA
  > Cabinet IA opérationnel B2B pour PME/ETI françaises.
  
  ## Services
  - [Audit conformité IA](https://axion-ia.com/audit-conformite-ia) : ...
  - [Implémentation IA](https://axion-ia.com/implementation-ia) : ...
  
  ## Documentation
  - [FAQ](https://axion-ia.com/faq) : ...
  ```
- `/llms-full.txt` — version exhaustive (chaque page inline en MD)
- `/ai.txt` — opt-in/opt-out training IA (standard émergent)
- Si absent : flagger comme P0 IA-readiness

**3.2 — Structured data optimisée LLM** (lecture `src/lib/jsonld/*`)
- `Article` avec author + publisher + datePublished + dateModified
- `FAQPage` avec questions ET réponses complètes (pas tronquées)
- `Speakable` (CSS XPath + selectors) sur FAQ + résumés — critique pour
  Google Assistant + Alexa + Siri readout
- `HowTo` sur procédures (audit en 6 étapes, etc.)
- `Organization` + `LocalBusiness` cohérents (sameAs réseaux sociaux)
- `Service` + `Offer` avec priceSpecification (alignés `pricing.ts` SSOT)
- `BreadcrumbList` sur 100 % des pages
- `WebSite` avec `SearchAction` (sitelinks searchbox)
- `Person` (Manon persona disclosed via `agent` ou `creator`)
- `ImageObject` factory avec `contentUrl` + `license` + `acquireLicensePage`
- `Dataset` ou `LearningResource` sur KB V4 articles (boost LLM ingest)
- `Event` sur formations interventions (calendrier dates)

Pour chaque type : vérifier validation **Rich Results Test API** (read-only
endpoint Google) sur 20 URLs sample.

**3.3 — Canonical Answers Pattern** (lecture pages V2 + KB V4)
Critique pour extraction LLM. Chaque article doit comporter :
- TL;DR en TOP (50-80 mots, réponse autonome à la question titre)
- Premier paragraphe = answer self-contained (Perplexity prend les 200
  premiers mots souvent)
- H2 = questions explicites style "Qu'est-ce que ...", "Pourquoi ...",
  "Combien coûte ..."
- Listes numérotées et bullet points (LLM extraction rate 3× supérieure
  vs prose dense)
- Tables structurées (LLM parse mieux les tables que paragraphes denses)
- Citations sourcées avec `<cite>` ou markdown footnotes
- Last updated visible en haut + en JSON-LD dateModified

**3.4 — Author + E-E-A-T signaux IA**
- Page `/equipe` ou `/manon` (persona IA disclosed AI Act EU)
- `Person` JSON-LD avec credentials + sameAs LinkedIn
- Bio author dans chaque article + JSON-LD author
- Mentions externes (sameAs press, awards) si présentes
- Year-fresh content : dateModified < 90 jours sur articles tier-1
- Disclaimer IA persona Manon clairement visible (AI Act 2026 obligation)

**3.5 — Citations + facts-checkable**
- Liens sortants vers sources autoritaires (gouvernement, INSEE, études)
- Données chiffrées présentes avec source visible
- Pas de "selon une étude" sans lien (LLM penalize unverifiable claims)

**3.6 — Multi-format pour LLM ingestion**
- Vérifier endpoint `/actualites/[slug].md` ou `/api/articles/[slug]/raw`
  qui sert le markdown brut (Cursor / Claude can fetch directement)
- Si absent : noter comme P1 GEO-readiness

Livrable : matrice 20 URLs × 18 critères AEO/GEO + scoring /140.
Gate : llms.txt absent = ORANGE (P1, fix < 1 semaine)
Gate : Speakable absent sur /faq = ROUGE (perte assistants vocaux)
Gate : Pas de TL;DR sur articles factory = ROUGE (perte Perplexity)
Gate : dateModified absent ou stale sur 50%+ articles = ROUGE
Gate : Rich Results Test API échoue sur > 10 % URLs = ROUGE

═══ AGENT 4 — Sitemap + IndexNow + Indexing API (multi-moteurs) ══════ /90

**4.1 — Sitemap index split**
Vérifier /sitemap.xml renvoie un sitemap index avec sous-sitemaps :
- sitemap-pages.xml (pages statiques < 500)
- sitemap-news.xml (articles factory, **MAX 1000 URLs < 48h** quota
  Google News strict, sinon ignoré)
- sitemap-articles.xml (articles factory > 48h)
- sitemap-faq.xml (FAQ)
- sitemap-villes.xml (12 942 routes pSEO — split en plusieurs fichiers
  si > 50 000 ou > 50 MB)
- sitemap-connaissances.xml (KB V4 publique)

Chaque sous-sitemap :
- < 50 000 URLs (limite Google/Bing stricte)
- < 50 MB non-compressé
- lastmod ISO 8601 valide (pas tous identiques — Google ignore si suspect)
- changefreq + priority cohérents (mais Google ignore officiellement)
- xhtml:link hreflang pour FR/EN si bilingue
- Image sitemap inline si image:image présent (boost Image Search)

**4.2 — robots.txt audit complet**
- Directive Sitemap: pointe vers /sitemap.xml ✓
- User-agent: * cohérent
- User-agent par bot IA training (cf. AGENT 2 liste) :
  - GPTBot, Google-Extended, Applebot-Extended, Bytespider, Amazonbot,
    Meta-ExternalAgent, CCBot, cohere-ai : décision Will (Allow ou Disallow)
  - ClaudeBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-Web,
    Perplexity-User : **Allow OBLIGATOIRE** (sinon perte citations 2026)
- Crawl-delay si pertinent (Bingbot supporte, Googlebot ignore)
- Pas de blocage accidentel /actualites/, /connaissances/, /faq/

**4.3 — IndexNow (Bing + Yandex + Naver + Seznam)**
- Lecture `src/lib/indexnow.ts` (helper centralisé commit b7cbfb4)
- Clé `INDEXNOW_KEY` exposée à `/<key>.txt` racine
- Auto-ping à la publication d'un article factory tier-1
- Support `urls` (pluriel) ET `urlList` (bug fix b7cbfb4)
- Batch < 10 000 URLs par requête
- Logs Telegram en cas d'erreur ?

**4.4 — Google Indexing API**
- Lecture `src/lib/google-indexing.ts`
- JWT service account chargé via env (`GOOGLE_INDEXING_CREDENTIALS_JSON`)
- Quota 200/jour suffisant pour factory 100/jour ? (oui mais marge faible)
- Retry exponentiel + backoff
- Note officielle Google : Indexing API supportée pour JobPosting +
  BroadcastEvent uniquement. Hors-scope ? Utiliser uniquement pour
  signaler updates rapides (best-effort).

**4.5 — Bing IndexNow + Bing Webmaster Tools**
- Vérifier si site soumis dans Bing Webmaster Tools (action humaine)
- IndexNow couvre Bing automatiquement si clé OK

**4.6 — Yandex/Naver/Seznam**
- IndexNow couvre Yandex automatiquement. Pour FR market : Yandex
  marginal mais Naver impacte ASEAN expat (faible volume pour AxionIA).

Gate : sitemap > 50 000 URLs / fichier = ROUGE
Gate : sitemap-news > 1000 URLs < 48h = ROUGE (Google News drop)
Gate : IndexNow non câblé à factory publish = ROUGE
Gate : lastmod tous identiques = ORANGE (signal spam)
Gate : Bot IA search-time bloqué dans robots.txt = ROUGE

═══ AGENT 5 — Edge optimization 2026 (Early Hints, Speculation, etc.) ═ /110

**5.1 — 103 Early Hints**
- Cloudflare supporte Early Hints depuis 2022 (config Cache Rules)
- Vérifier headers réponse : `Link: <...>; rel=preload`
- Gain LCP attendu 20-30 % sur pages avec hero image
- Si absent : noter P1 perf

**5.2 — Speculation Rules API** (mémoire indique présence)
- Lecture `src/components/SpeculationRules.tsx` ou layout.tsx
- Mode : `prerender` (full preload + JS exec) ou `prefetch` (HTML only)
- Eagerness : `eager` (immediate, coûteux) / `moderate` (hover 200ms) /
  `conservative` (hover 1s) — recommandé moderate
- Routes incluses : nav primaire + CTA principaux
- Routes EXCLUSES : /reserver (form), /admin/*, /api/*
- Vérifier que pas de prerender sur /admin (fuite données)
- Mémoire signale "Speculation Rules eager" comme cause possible lenteur
  → vérifier passé à `moderate` ou `conservative`

**5.3 — fetchpriority hints** (HTML standard 2023+)
- `<img fetchpriority="high">` sur LCP image
- `<link rel="preload" fetchpriority="high">` sur LCP resource
- Vérifier 20 pages sample
- Si absent sur LCP element = P1 perf (gain LCP 100-300 ms)

**5.4 — Resource Hints** (legacy mais essentiel)
- `<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>`
- `<link rel="dns-prefetch" href="https://...">` pour third-party
- `<link rel="preload" as="font" type="font/woff2" crossorigin>` pour
  fonts critiques (sauf si next/font self-hosted)
- Vérifier next/font : si utilisé correctement, preconnect Google Fonts
  ne devrait PAS être présent (font self-hostée)

**5.5 — Cloudflare Cache Rules + cf-cache-status matrix**
Pour 20 URLs × 6 combinaisons (cold/warm × bot/human × FR/EN) :
- `CF-Cache-Status` valeurs attendues :
  - HIT : edge cache OK ✓
  - MISS : premier hit, OK si suivi de HIT après
  - EXPIRED : cache expiré, revalidé — OK
  - REVALIDATED : ETag/If-Modified-Since OK ✓
  - UPDATING : SWR background, OK
  - STALE : origin down, stale served — OK temporaire
  - BYPASS : Cache Rule no-cache — vérifier intentionnel
  - DYNAMIC : pas de règle cache, fallback — flagger /api/*
- Cache Reserve (CF Pro+, non disponible Free) : N/A
- Tiered Cache : N/A Free
- Smart Tiered Cache : N/A Free

**5.6 — Stale-While-Revalidate (SWR) + Stale-If-Error**
- `Cache-Control: public, max-age=300, stale-while-revalidate=86400,
   stale-if-error=604800`
- Critique pour résilience prod (origin down → CF sert stale)
- Vérifier headers sur 20 URLs

**5.7 — Compression**
- Brotli (br) > gzip (gz). CF auto-compress en br si supporté.
- Vérifier `Accept-Encoding: br, gzip` côté origin (Caddy)
- Ratio compression attendu : HTML ~75 %, JS ~70 %, CSS ~80 %

**5.8 — HTTP/3 + 0-RTT**
- CF Free supporte HTTP/3 (QUIC) — vérifier ON
- 0-RTT resumption pour returning visitors
- ALPN : h3, h2 négociés

Gate : LCP image sans fetchpriority="high" = ORANGE
Gate : Early Hints absent = ORANGE (gain perdu)
Gate : Speculation Rules eager sur nav primaire = ROUGE (régression connue)
Gate : /api/admin/* avec CF-Cache-Status: HIT = 🚨 CRITIQUE (fuite admin)
Gate : Pas de SWR sur pages factory = ORANGE
Gate : HTTP/3 OFF = ROUGE

═══ AGENT 6 — Next.js 16 perf-spec (PPR, RSC, Streaming, next/font) ══ /100

**6.1 — PPR (Partial Prerendering) Next 16**
- `experimental.ppr: true` dans `next.config.*` ?
- Routes statiques shell + dynamic holes (auth user, panier, etc.)
- TTFB sur PPR routes vs SSR pure ? (gain attendu 30-50 %)
- Vérifier `<Suspense fallback>` correctement placé

**6.2 — RSC (React Server Components) payload**
- Mesurer payload RFC `__next_f` size par route
- Comparer first-load JS vs RSC payload
- Si RSC > 80 KB sur route simple = trop de client components ?

**6.3 — Streaming SSR TTFB**
- Vérifier `Content-Type: text/html; charset=utf-8` + Transfer-Encoding
  chunked sur SSR routes
- TTFB jusqu'au premier byte HTML (head + shell)
- vs Full TTLB (Time to Last Byte, fin streaming)

**6.4 — ISR + revalidate**
- `revalidate` par type contenu :
  - pSEO villes : ≥ 86400s (24h) — stable, peu d'updates
  - Articles factory : 3600s (1h) — fréquent
  - Pages produit : 600s (10 min)
  - FAQ : 21600s (6h)
- On-demand revalidation via `revalidatePath` / `revalidateTag` ?
- Vérifier que factory publish déclenche revalidatePath('/actualites')

**6.5 — Edge runtime vs Node runtime**
- Routes critiques perf : `export const runtime = 'edge'` ?
- Mais Edge runtime ≠ compat Prisma (Edge Functions Hetzner Coolify = N/A
  car self-hosted, pas Vercel Edge)
- Donc Edge runtime probablement non utilisé (Coolify Node only)
- Flagger ambiguïtés

**6.6 — next/font self-hosted**
- Lecture `src/app/layout.tsx` : import next/font/google ou next/font/local
- Doit utiliser `display: 'swap'` (anti CLS)
- `preload: true` pour fonts critiques uniquement
- `subsets: ['latin']` minimal
- Vérifier que <link rel="preconnect" Google Fonts> ABSENT (sinon double)

**6.7 — Image optimization next/image**
- Tous les images via next/image (pas <img> raw)
- `priority` sur LCP image uniquement
- `sizes` correct pour responsive
- `quality` 75-85 (default 75)
- AVIF format dans `next.config.images.formats: ['image/avif', 'image/webp']`
- Domain whitelist ne fuit pas (CSP-aligned)

**6.8 — Bundle split**
- `next-bundle-analyzer` lu (si dispo `.next/analyze/*`)
- Top 10 dépendances lourdes par chunk
- Sentry chunk size (mémoire signale 150 KB gz = 53 % shell)
- Plausible / Clarity / Turnstile : async + small ?
- Dynamic imports (`next/dynamic`) sur lourds composants admin

Gate : PPR non activé sur routes éligibles = ORANGE (gain manqué)
Gate : RSC payload > 150 KB sur page article = ORANGE
Gate : ISR revalidate < 60s sur pSEO villes = ROUGE
Gate : next/font absent (Google Fonts CDN) = ROUGE (CLS + privacy)
Gate : <img> raw sur LCP = ROUGE

═══ AGENT 7 — Charge serveur + CDN cache hit ratio ═══════════════════ /90

**7.1 — Infrastructure**
Hetzner CPX42 (8c/16GB/320GB Nuremberg, rescale 2026-05-14) + Coolify
4.0.0 + Caddy 2 + Next 16 standalone + Postgres + Redis + Cloudflare Free
(5 Cache Rules livrées 2026-05-09 Phase 5).

**7.2 — Lecture config Cloudflare Cache Rules**
- Quelles routes sont edge-cached agressivement ? (pSEO villes = oui)
- TTL par route type :
  - Static assets (_next/static/*) : 1 an immutable
  - Images : 30 jours
  - HTML pages : 5 min edge + SWR 24h
  - /api/* : Bypass (jamais cached)
  - /admin/* : Bypass (sécurité)
- Vérifier Cache Rule order (premier match wins)

**7.3 — Lecture config Caddy**
- `encode br gzip` activé ?
- `header Cache-Control` aligné avec CF Cache Rules ?
- HTTP/2 + HTTP/3 ON ?
- Reverse proxy → Next standalone container OK ?
- Healthcheck path `/api/health` ou `/`

**7.4 — Lecture next.config.\***
- `output: 'standalone'` ✓ (Docker minimal image)
- ISR revalidate cohérent par type
- `images.formats: ['avif', 'webp']`
- `compress: true` (gzip Next, mais Caddy fait brotli ensuite)
- `experimental.optimizeCss: true` (extract critical CSS)
- `experimental.optimizePackageImports: ['lucide-react', ...]` (tree-shake)
- `experimental.serverActions.bodySizeLimit` raisonnable

**7.5 — Charge mesurée** (read-only, pas de POST mutant)
Si possible (lecture logs Coolify partagés par Will) :
- CPU % moyen 24h
- RAM utilisée 24h
- Disk I/O
- Network in/out
- Postgres connections actives
- Redis memory + keys count

**7.6 — Concurrence** (lecture only)
- 10 endpoints GET en parallèle (sample) via curl --parallel
- Mesurer TTFB sous concurrence vs unitaire
- Si dégradation > 50 % = bottleneck (probablement DB connection pool)

**7.7 — Crawl budget Googlebot**
- Lecture du dossier `_AUDIT/` pour data Search Console (si Will partage
  Crawl Stats GSC export)
- Pages crawled/jour vs publié/jour
- Si 100/jour publié mais 30/jour crawled = problème volume ou perf

Gate : RAM > 14 GB sur 16 GB = ROUGE (OOM imminent)
Gate : Postgres connections > 80 % pool = ROUGE
Gate : /api/admin/* edge-cachable = 🚨 CRITIQUE
Gate : Concurrence x10 dégrade TTFB > 200 % = ROUGE
Gate : Crawl budget < 30 % factory output = ROUGE

═══ AGENT 8 — RUM CrUX + Plausible + Clarity Web Vitals ══════════════ /100

**8.1 — CrUX API** (Chrome User Experience Report, gratuit)
Query directe l'API CrUX pour les 28 derniers jours :
- Endpoint : `chromeuxreport.googleapis.com/v1/records:queryRecord`
- Origin : `https://axion-ia.com`
- Per-URL pour les 20 URLs sample
- Metrics : LCP / INP / CLS / TTFB / FCP p75
- Per-device (PHONE / TABLET / DESKTOP)
- Per-effective-connection (4G / 3G / etc.)

Pages sans data CrUX = trafic insuffisant = ORANGE (à monitorer post-launch).

**8.2 — CrUX BigQuery dataset** (gratuit avec compte GCP)
- Si Will partage projet GCP, query historique 28j rolling
- Détecter régressions vs baseline 2026-05-08

**8.3 — PageSpeed Insights API**
- Endpoint : `pagespeedonline.googleapis.com/v5/runPagespeed`
- 20 URLs sample mobile + desktop
- Lab data (Lighthouse) + Field data (CrUX) si dispo
- Comparer avec AGENT 1 mesures locales

**8.4 — Plausible Web Vitals plugin** (si installé)
- Lecture `src/lib/web-vitals-monitor.ts`
- Vérifier sendBeacon vers Plausible avec event "Web Vital"
- Property `metric` (LCP/INP/CLS) + `value` (ms) + `page`
- Dashboard Plausible filtre custom events

**8.5 — Microsoft Clarity Web Vitals**
- Si Clarity installé (commit b7cbfb4 mentionné), vérifier dashboard
- Heatmap + session recording sur pages lentes
- Rage clicks = signal INP catastrophique

**8.6 — Sentry Performance Monitoring** (si activé)
- `tracesSampleRate` configuré ?
- Transactions par route mesurées ?
- N+1 queries détectées ?
- Coût Sentry quotient (mémoire : 150 KB shell — à équilibrer)

**8.7 — WebVitalSample modèle Prisma**
- Lecture `prisma/schema.prisma` pour modèle WebVitalSample
- Données stockées : metric, value, rating (good/ni/poor), navigationType,
  url, userAgent (anonymisé), sessionId hashed, timestamp
- API route POST côté serveur pour ingestion
- Dashboard admin `/admin/web-vitals` (si Sprint 16 livré)
- Alertes Telegram si p75 rouge sur route stratégique

**8.8 — Comparaison synthétique vs réel**
- Pages qui passent Lighthouse mais échouent CrUX = ROUGE prioritaire
- Pages qui échouent Lighthouse mais OK CrUX = à investiguer (false negative)

Gate : Tout p75 CrUX rouge sur route stratégique = ROUGE
Gate : Pas de RUM sampling actif (WebVitalSample vide) = ROUGE
Gate : Pas d'alertes Telegram p75 rouge = ORANGE
Gate : Sentry tracesSampleRate > 0.2 sur prod = ORANGE (coût)

╔═══════════════════════════════════════════════════════════════════════╗
║                  LIVRABLE UNIQUE                                      ║
╚═══════════════════════════════════════════════════════════════════════╝

Fichier : `_AUDIT/CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL-2026-XX-XX.md`

Structure obligatoire :
1. **Résumé exécutif** (score global /900, verdict, top 5 P0)
2. **AGENT 1** — Web Vitals 2026 (tableau 20 URLs × 24 colonnes) — /150
3. **AGENT 2** — Crawl bots 2026 (matrice 16 bots × 15 URLs ≈ 240 cells) — /120
4. **AGENT 3** — AEO + GEO IA (matrice 20 URLs × 18 critères) — /140
5. **AGENT 4** — Sitemap + IndexNow multi-moteurs — /90
6. **AGENT 5** — Edge optimization 2026 — /110
7. **AGENT 6** — Next.js 16 perf-spec — /100
8. **AGENT 7** — Charge serveur + CDN — /90
9. **AGENT 8** — RUM CrUX + monitoring — /100
10. **TOP 30 patches recommandés** (ordre P0 → P3, gain estimé chiffré)
11. **Régression check** vs baseline `AUDIT-WEB-VITALS-2026-BASELINE-A.md`
12. **Verdict final** : prêt pour activer `KB_AUTO_PUBLISH=true` + factory
    100/jour OUI/NON + conditions

**Scoring /900 :**
- AGENT 1 Web Vitals 2026 : /150
- AGENT 2 Crawl bots 2026 : /120
- AGENT 3 AEO + GEO IA : /140 ← **POIDS LE PLUS FORT (stratégique 2026)**
- AGENT 4 Sitemap + IndexNow : /90
- AGENT 5 Edge optimization : /110
- AGENT 6 Next.js 16 spec : /100
- AGENT 7 Charge + CDN : /90
- AGENT 8 RUM CrUX : /100

**Seuils verdict :**
- ≥ 810 (90 %) : 🟢 **GO PROD extrême perfection** — activer factory
- 720-809 (80-89 %) : 🟡 GO CONDITIONAL — P0 à fixer < 1 semaine
- 540-719 (60-79 %) : 🟠 CONDITIONAL — sprint correctif obligatoire
- < 540 (60 %) : 🔴 NO-GO — refactor perf bloquant

⛔ RAPPEL : aucun fix code. Si bug trouvé → ligne dans "TOP 30 patches".

╔═══════════════════════════════════════════════════════════════════════╗
║                  CONTRAINTES INTOUCHABLES                             ║
╚═══════════════════════════════════════════════════════════════════════╝

- Stack Hetzner CPX42 + Coolify + CF Free (budget zéro additionnel)
- Tailwind + Next 16 + standalone output (pas de framework swap)
- Sentry conservé (mais peut être trimé si > 150 KB gz)
- Cloudflare Free uniquement (pas d'Argo / Workers payants / Cache Reserve)
- Pas de SSR streaming refactor massif (in-place tuning only)
- Direction visuelle commitée HEAD 941a8e1+ intouchable (terracotta header)
- Naming "Axion-IA" partout (FR + EN)
- AI Act EU 2026 : persona Manon disclosed obligatoire

╔═══════════════════════════════════════════════════════════════════════╗
║                  HEURISTIQUES 2026 (rappel pour l'auditeur)           ║
╚═══════════════════════════════════════════════════════════════════════╝

- INP > LCP > CLS en priorité 2026 (INP devenu Core Web Vital mars 2024)
- AEO/GEO ≠ SEO classique : optimiser pour extraction LLM, pas just
  ranking Google. Citations Perplexity = nouveau "rang #1".
- Bot IA search-time (ClaudeBot, OAI-SearchBot, PerplexityBot) = priorité
  absolue 2026. Bloquer = perdre la visibilité émergente.
- llms.txt = nouveau robots.txt pour IA. Standard émergent à adopter tôt.
- Speakable JSON-LD = passeport Google Assistant / Alexa / Siri.
- Canonical Answers Pattern (TL;DR + H2 questions + bullets) = format
  préféré des LLM extraction.
- Crawl budget Googlebot : Hetzner self-hosted = pas de "discovery limit"
  Vercel, mais TTFB plus critique.
- RUM CrUX p75 28j = vérité Google. Lab Lighthouse = simulation, peut
  diverger massivement.
```

---

## Phrase d'invocation (à coller dans nouvelle session fraîche)

> Lance l'audit `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL.md` en mode AUDIT-ONLY strict extrême perfection 2026. 8 agents parallèles, scoring /900. Mesure Web Vitals 2026 complets (LCP+INP+CLS+TTFB+FCP+TBT+Speed Index+Soft Nav INP+LoAF+Long Tasks+View Transitions) sur 20 URLs × mobile/desktop + crawl 16 bots (moteurs + IA training + IA search-time) × 15 URLs + AEO/GEO IA (llms.txt + ai.txt + Speakable + Canonical Answers + structured data 13 types) + sitemap multi-moteurs (Google News quota + IndexNow + Bing) + edge optimization (Early Hints 103 + Speculation Rules + fetchpriority + Resource Hints + cf-cache-status matrix + SWR + HTTP/3) + Next 16 perf-spec (PPR + RSC payload + Streaming + next/font + ISR revalidate + Edge vs Node) + charge serveur Hetzner CPX42 + RUM CrUX API + BigQuery + Plausible + Clarity + Sentry + WebVitalSample. Produis le rapport `_AUDIT/CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL-2026-05-15.md`. Aucun fix, aucun commit, aucune mutation prod. Verdict /900 avec top 30 patches P0-P3 chiffrés.
