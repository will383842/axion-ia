# 🌍 PROMPT + PLAN — AUDIT GEO/AEO END-TO-END 50 AGENTS — 2026-08-14

> Audit **AUDIT-ONLY STRICT** de TOUTE la visibilité GEO (Generative Engine
> Optimization) / AEO (Answer Engine Optimization) / SEO de la plateforme
> `https://axion-ia.com`, de bout en bout : robots + llms.txt + ai.txt +
> ai-policy.json, ~20 sitemaps (index, DB-driven, images, news, carrières,
> avis), 7 feeds RSS/JSON, canal d'ingestion IA `/api/markdown/*`, ~30
> builders JSON-LD, metadata/canonical/hreflang/OG, content-gen complet
> (orchestrateur, générateurs, gates qualité, pSEO villes, KB, fraîcheur),
> banque d'images, redirections/404/410/soft-404, maillage interne,
> IndexNow + Google Indexing API + GSC/Bing, entité vérifiable (Knowledge
> Graph, annuaires, homonymes), mesures LIVE des moteurs classiques ET des
> moteurs IA (Perplexity, ChatGPT, Gemini, Claude), perf/rendu crawler,
> logs serveur.
>
> **Équipe : 50 agents spécialisés** (7 squads d'audit A→G = 40 agents,
> + 1 squad de contre-vérification adversariale = 6, + 1 squad de
> synthèse = 4), orchestrés en workflows.
>
> Mode **🔒 AUDIT-ONLY STRICT — ZÉRO RISQUE DE RÉGRESSION** : zéro
> modification de code, zéro commit, zéro push, zéro mutation prod, zéro
> soumission d'URL. Seule écriture autorisée : les rapports dans
> `_AUDIT/GEO-AEO-E2E-2026-08-14/`.
>
> Production : **1 dossier** `_AUDIT/GEO-AEO-E2E-2026-08-14/` avec
> **54 fichiers** (50 agents + 4 synthèses).
>
> Score cible : **≥ 2 250 / 2 500** (90 %) pour 🟢 GO « visibilité
> GEO/AEO prod-grade 2026 ».
>
> Prédécesseurs à relire AVANT (ne pas re-découvrir ce qui est déjà su) :
> `_AUDIT/STRATEGIE-AEO-GEO-2026.md`, `_AUDIT/AUDIT-INDEXATION-GSC-2026-07-31.md`,
> mémoire audit GEO/AEO 2026-07-20 (verdict : « déficit d'existence
> vérifiable », PAS déficit de contenu), `_AUDIT/AUDIT-WEB-VITALS-2026-SYNTHESE.md`,
> `docs/content-gen/seo-aeo-60-items-checklist.md`.

---

## ⚡ PLAN D'EXÉCUTION (pour Will — 5 minutes de lecture)

### Pré-vol (2 min)

1. Ouvrir une session Claude Code dans **`C:\Users\willi\Documents\Projets\Axion-IA\axionia`**
   (⚠️ le repo Next.js, PAS la racine `Axion-IA` qui est un dossier bureautique).
2. Vérifier qu'aucun build/deploy n'est en vol (`gh run list -L 3`) — l'audit lit
   la prod ; un déploiement en cours fausserait les mesures « sitemap vide post-deploy ».
3. Machine : fermer les gros consommateurs CPU/RAM (piège connu : les timeouts
   marginaux de tests = machine saturée, pas une régression).
4. Coller **l'intégralité du bloc PROMPT ci-dessous** (de `═══ DÉBUT DU PROMPT ═══`
   à `═══ FIN DU PROMPT ═══`) comme premier message de la session.

### Déroulé attendu (l'agent principal orchestre, tu n'interviens pas)

| Phase | Agents | Durée estimée | Contenu |
|---|---|---|---|
| 0 — Recon | agent principal seul | ~15 min | lecture prédécesseurs, worktrees SEO non mergés, inventaire live |
| 1 — Fan-out audit | 40 agents (squads A→G) | ~1 h 30 – 2 h 30 | code + live en parallèle |
| 2 — Contre-vérification | 6 agents (squad H) | ~45 min | réfutation adversariale de chaque finding P0/P1 |
| 3 — Synthèse | 4 agents (squad S) | ~30 min | consolidation, scoring, plan de patches, reste-Will |

Total : **~3 à 4 h**, consommation forte en tokens (50 agents — c'est voulu).
Les phases 2 et 3 ne démarrent que quand la précédente est finie.

### Après l'audit

1. Lire `00-VERDICT-FINAL.md` puis `01-PLAN-PATCHES.md` du dossier produit.
2. Les patches sont **prescrits, pas appliqués** — décider lesquels lancer,
   par lots (règle maison : fusionner les PR en lot, un seul build).
3. `03-RESTE-WILL.md` = tes actions humaines (GBP, annuaires, presse…) —
   uniquement les NOUVELLES, les « reste Will » déjà actés n'y figurent pas.

### Pourquoi c'est sans risque

Le prompt verrouille : aucune écriture hors `_AUDIT/GEO-AEO-E2E-2026-08-14/`,
DB en SELECT-only, prod en GET/HEAD-only, aucune soumission GSC/Bing/IndexNow,
aucun commit. Un audit ne peut par construction rien casser ; les régressions
éventuelles ne pourraient venir que des patches — qui sont un chantier séparé,
chacun livré avec son risque chiffré et sa liste do-not-touch.

---

═══════════════════════════ DÉBUT DU PROMPT ═══════════════════════════

Tu es l'auditeur en chef GEO/AEO/SEO end-to-end 2026 d'Axion-IA. Utilise
des workflows multi-agents : tu orchestres **50 agents spécialisés** décrits
ci-dessous. Tu n'as PAS le droit de coder, fixer, commiter, pousser, migrer,
ni de soumettre la moindre URL où que ce soit (GSC, Bing, IndexNow, Google
Indexing API : tout est read-only). Seule écriture autorisée : le dossier de
rapports `_AUDIT/GEO-AEO-E2E-2026-08-14/`.

Tu OBSERVES (lecture du code avec citations `fichier:ligne`, curl GET/HEAD
sur la prod, APIs GSC/Bing read-only, DB Prisma SELECT-only, logs serveur en
lecture via `ssh axion-prod`).
Tu CARTOGRAPHIES (chaque surface émettrice de signaux vers moteurs classiques
ET moteurs IA).
Tu MESURES (volumes réels vs attendus, positions SERP, citations par les IA,
exactitude des réponses IA sur Axion-IA, couverture entité).
Tu DIAGNOSTIQUES (root-cause, jamais de conclusion sans double preuve
code + live).
Tu PRESCRIS (patches priorisés P0/P1/P2 avec effort + impact + **risque de
régression chiffré** et liste do-not-touch par patch). Tu n'appliques RIEN.

═══════════════════════════════════════════════════════════════════
CONTEXTE OPÉRATIONNEL CRITIQUE — LIRE AVANT TOUT
═══════════════════════════════════════════════════════════════════

- Repo : tu es dans `axionia/` (Next 16 App Router + next-intl + Prisma +
  BullMQ). ⚠️ Next 16 a des breaking changes vs ta connaissance — lis
  `node_modules/next/dist/docs/` au moindre doute d'API.
- Prod : `https://axion-ia.com` (apex), Cloudflare Free, origin Hetzner
  CPX42, Coolify, Caddy. SSH lecture : `ssh axion-prod`. `jq` ABSENT sur
  le VPS — parser autrement.
- Build externalisé GH Actions (ADR 0026) avec `DATABASE_URL` stub
  `stub.invalid` : **tout builder DB-aware rend VIDE au build**, l'ISR
  `revalidate=3600` repopule sous 1 h en prod. Un sitemap DB-driven vide
  juste après un deploy peut être NORMAL — vérifier l'âge du dernier
  deploy avant de conclure. Un job `warm` post-déploiement existe
  (PR #599, 2026-08-14) : le localiser, vérifier que ses DEUX listes
  couvrent bien toutes les pages ISR lisant la DB.
- EN locale DÉSACTIVÉ runtime (`EN_LOCALE_ENABLED != true`) : proxy 301
  `/en/*` → `/fr/*`, sub-sitemaps filtrés, `images-en.xml` gaté hors index.
- DB locale : ⚠️ le port 5433 local = postgres BOOKFORGE (autre projet).
  La DB prod s'appelle `axionia`. Ne SELECT que ce dont tu as besoin.
- Avis clients : **77 avis réels vérifiés, moyenne 4,88/5** (état
  2026-08-14) — vérifier la BASE avant de croire un chiffre affiché sur
  une page ou en JSON-LD.
- Des worktrees `../axionia-wt-seo2` et `../axionia-wt-indexnow` peuvent
  contenir du travail SEO non mergé : en Phase 0, vérifie s'ils portent
  des branches non fusionnées et signale-le (ne les audite pas, audite
  `main` + la prod).
- Dossier de sortie : crée `_AUDIT/GEO-AEO-E2E-2026-08-14/` et écris-y
  1 fichier par agent (`A1-robots-llms.md`, `B3-articles-dates.md`, …)
  + 4 synthèses (`00-VERDICT-FINAL.md`, `01-PLAN-PATCHES.md`,
  `02-SCORING.md`, `03-RESTE-WILL.md`).

═══════════════════════════════════════════════════════════════════
DÉCISIONS ACTÉES PAR WILL — NE PAS ROUVRIR, NE PAS « CORRIGER »
═══════════════════════════════════════════════════════════════════

Toute recommandation qui contredit un point ci-dessous est un FAUX POSITIF
à éliminer en squad H. Ces décisions sont définitives sauf demande
explicite de Will :

1. **Site FRANÇAIS UNIQUEMENT** (décision définitive 2026-08-12). Ne
   jamais proposer, chiffrer ou lister comme « dette » du travail EN,
   de traduction, ou de hreflang EN enrichi. L'EN désactivé n'est PAS un
   trou à combler.
2. **Robots.txt, doctrine « bloquer training / garder citation »**
   (2026-06-22) : GPTBot, ClaudeBot, anthropic-ai, Google-Extended,
   CCBot, Bytespider… BLOQUÉS ; OAI-SearchBot, ChatGPT-User,
   Claude-SearchBot, PerplexityBot, Mistral-User… AUTORISÉS. Ne pas
   proposer de débloquer Google-Extended (déjà tranché « non », même en
   sachant que ça conditionne le grounding Gemini). Invariants à
   VÉRIFIER sans les remettre en cause : `Allow: /api/og` (toutes les
   og:image en dépendent), `Allow: /api/markdown/`.
3. **Plausible est DÉFINITIF** — ne jamais proposer Google Analytics.
4. **Prix audits toujours « à partir de »** via `isFromPrice` +
   `formatTierPrice` — et son piège inverse : les ~6 849 tokens
   `{{price:audit-flash|flat}}` dans la prose villes sont VOLONTAIREMENT
   nus (la phrase autour porte déjà « à partir de ») ; les basculer en
   `|from` produirait « à partir de à partir de ». `AggregateOffer.lowPrice`
   reste un nombre brut. Un test verrouille tout ça : ne pas le « corriger ».
5. **JobPosting** : jamais de bump automatique de `datePosted` (fraîcheur
   Google for Jobs = refresh légitime uniquement). `validThrough` et
   `baseSalary` absents sur certaines offres = DÉCISIONS de Will, ne pas
   re-signaler. Le lieu est INTERDIT dans le `title` des offres.
6. **« N°1 en France »** dans le positionnement : CONSERVÉ (décision
   2026-07-28), ne pas le signaler comme risque.
7. **Jamais de logo OPCO / France Travail / CPF** sur le site.
8. **CGV = obligation de MOYENS** — les garanties de résultat ont été
   purgées ; ne pas proposer de « social proof » qui les réintroduirait.
9. **L'assureur ne se nomme jamais côté client.**
10. Ne pas répéter un « reste Will » déjà acté en mémoire/rapports
    précédents (ex. vidéo VSL, relecture avocat CGV, tri candidatures,
    réponse Bing UCM000007450870, adhésion médiateur). `03-RESTE-WILL.md`
    ne liste que du NOUVEAU.
11. **IndexNow** : la clé est en place et irréprochable (audit 2026-08-11)
    — ne pas re-diagnostiquer la clé ; auditer seulement l'usage (pings,
    couverture, fallback).

═══════════════════════════════════════════════════════════════════
PHASE 0 — RECON (agent principal, séquentiel, ~15 min)
═══════════════════════════════════════════════════════════════════

1. Lire : `AGENTS.md`, `_AUDIT/STRATEGIE-AEO-GEO-2026.md`,
   `_AUDIT/AUDIT-INDEXATION-GSC-2026-07-31.md`,
   `_AUDIT/AUDIT-WEB-VITALS-2026-SYNTHESE.md`,
   `docs/content-gen/seo-aeo-60-items-checklist.md`,
   `src/server/content-gen/README.md`. Extraire ce qui est DÉJÀ su pour
   le passer aux agents (chaque agent reçoit ce digest — personne ne
   re-découvre un fait connu).
2. `git log --oneline -15` + date du dernier deploy (pour interpréter
   les sitemaps DB-driven vides).
3. Créer le dossier de sortie. Préparer le digest de contexte commun
   (contexte critique + décisions actées ci-dessus, à injecter dans
   CHAQUE prompt d'agent).
4. Lancer la Phase 1 en workflows parallèles.

═══════════════════════════════════════════════════════════════════
PHASE 1 — FAN-OUT : 40 AGENTS D'AUDIT (squads A→G, parallèle)
═══════════════════════════════════════════════════════════════════

Règles communes à chaque agent :
- Double preuve : chaque finding cite le code (`fichier:ligne`) ET une
  observation live (curl, DB, SERP…) quand la surface est en prod.
- Classement P0 (visibilité cassée/mensongère) / P1 (opportunité forte
  perdue) / P2 (polish). Chaque finding : symptôme, preuve, root-cause,
  patch prescrit, effort (S/M/L), impact GEO/AEO (fort/moyen/faible),
  risque de régression du patch + fichiers do-not-touch.
- Écrire son rapport dans le dossier de sortie, format homogène.
- Interdiction de conclure « manquant » sans avoir cherché dans
  `src/lib/seo.ts` (2 242 l.), `src/lib/seo/**` et le code appelant —
  beaucoup de choses existent déjà.

### SQUAD A — Fondations crawl & découverte (6 agents)

- **A1 — robots & politiques IA** : `src/app/robots.ts` (+ spec),
  `ai.txt`, `.well-known/ai-policy.json`, `security.txt`. Cohérence
  doctrine (cf. décision 2), exceptions `/api/og` + `/api/markdown/`
  intactes, cohérence entre les 4 fichiers de politique, disallow
  `/logos/clients/` (anti-pollution Google Images), `Disallow: /en/`.
  Live : curl des 4 fichiers, diff code vs prod.
- **A2 — sitemap-index & sitemaps statiques** :
  `src/app/sitemap-index.xml/route.ts`, `src/app/sitemap.ts` (ids pages,
  faq, help, cas-concrets, comparaisons, guides, glossaire,
  implementation, implantations, stack-ia-tools, secteurs). Volumes émis
  vs attendus, gating anti-vide, `lastmod` réel ou figé (piège BUILD_TIME),
  `guides.xml`/`glossaire.xml` déclarent-ils enfin leurs ENFANTS (bug
  connu 2026-07-20 : 1 URL chacun) ; `buildExcludeSlugsByType` trop
  agressif ?
- **A3 — sitemaps DB-driven & contrat stub/ISR** : sitemap-blog, -presse,
  -knowledge, -news (+evergreen), -carrieres, -recrutement, -avis.
  Early-exits `stub.invalid`, repopulation ISR, job `warm` (PR #599) :
  ses deux listes couvrent-elles toutes ces routes ? Live : volumes réels
  de chaque sub-sitemap, cohérence avec la DB (SELECT count).
- **A4 — sitemaps images** : les 5 routes `sitemap-images-*.xml` + les 2
  `sitemaps/images-{fr,en}.xml` (EN gaté hors index — normal), helpers
  `src/server/image-bank/utils/{villes-sitemap,xml}.ts`, console
  `image-bank/sitemap-status`. Live : chaque sitemap image répond, porte
  des `<image:loc>` valides (échantillonner 20 URLs → 200 ?).
- **A5 — feeds & canal d'ingestion IA** : llms.txt + llms-full.txt (+
  enrichissement KB `knowledge-llms-txt.ts`), les 7 feeds RSS/JSON
  (blog, actualites, cas-concrets, faq, avis, ressources xml+json),
  `/api/markdown/[type]/[slug]` (couverture des types, headers cache,
  `<link rel="alternate" type="text/markdown">` réellement présent sur
  les pages HTML ?). Live : curl de tout, validité XML/JSON, fraîcheur.
- **A6 — pings & soumissions** : `src/lib/indexnow.ts`, worker
  content-indexnow, `content-google-indexing-worker`, `daily-indexnow-resubmit`,
  `postbuild` ping, `indexing/enqueue.ts` + `url-builder.ts`, clients
  GSC/Bing. Quelles publications déclenchent quels pings ? Trous (avis ?
  villes ? images ? carrières ?). Read-only strict.

### SQUAD B — Données structurées JSON-LD (6 agents)

- **B1 — graphe d'identité** : Organization + WebSite + LocalBusiness +
  Person (Williams, Manon) dans `src/lib/seo.ts` + `wikidata-sameas.ts`
  (env `WIKIDATA_QNUMBER_AXIONIA` posée ?) + `local-citations.ts`
  (couverture réelle `getLocalCitationsCoverage()`) + credential Qualiopi
  + `identite-legale-registre.spec.ts`. Live : extraire le @graph de la
  home rendue, valider (schema.org validator via fetch), cohérence
  SIREN/adresse/NAP partout (mentions légales incluses).
- **B2 — offre commerciale** : Course, Product, Service, Offer,
  AggregateOffer, HowTo implementation. Cohérence prix affiché vs JSON-LD
  vs `@/content/pricing` (décision 4 : lowPrice nombre brut = voulu).
  Live : pages formations, audit (4 niveaux), tarifs, un-a-un.
- **B3 — contenus éditoriaux & dates** : Article/BlogPosting/NewsArticle/
  TechArticle/QAPage (`seo-content-gen-factories.ts`), speakable universel,
  `dateModified` vs `datePublished` (piège connu : identiques partout ?),
  descriptions vides, `foundingDate` année seule, cohérence avec lastmod
  sitemap. Live : échantillon de 15 articles récents + 5 anciens.
- **B4 — schémas d'autorité AEO** : FAQPage + QAPage (87 fiches FAQ
  enrichies 08-12), DefinedTerm glossaire (`extended-schemas.ts`),
  Dataset observatoire (+ exports JSON/CSV), ImageObject graph,
  BreadcrumbList, SiteNavigationElement, `buildPageImageGraphJsonLd` /
  `primaryImageOfPage`. Live : valider sur glossaire/[slug], faq/[slug],
  observatoire-ia.
- **B5 — JobPosting & fraîcheur carrières** : `seo/job-posting.ts`,
  `careers/freshness.ts` (x2 + specs), sitemap-carrieres live (55 URLs ?),
  contraintes de la décision 5. Live : Rich Results Test-like sur 3
  offres, présence Google for Jobs (recherche live).
- **B6 — avis & étoiles** : `src/server/reviews/jsonld.ts`, facettes
  `/avis/**` (ville/departement/secteur/service), sitemap-avis, feed avis.
  DB : count réel des avis publiés + moyenne (attendu ~77 / 4,88) vs
  affiché vs JSON-LD. Live : rich snippet étoiles présent en SERP ?
  (bug connu : 54 avis sans aucun rich snippet, concurrent à 465 avis
  affichés — re-mesurer).

### SQUAD C — Metadata & indexabilité on-page (5 agents)

- **C1 — canonical/hreflang/titles** : `buildProductMetadata()`,
  `metadataBase`, canonicals absolus, hreflang policy avec EN désactivé
  (le hreflang en pointe-t-il vers des 301 ? → incohérence à documenter
  SANS proposer de réactiver EN : la sortie propre est de ne plus émettre
  le hreflang en, cf. procédure AGENTS.md), longueurs title/description
  (`meta-length.ts`, `truncateMetaDescription`), A/B meta
  (`ab-test-meta.ts` : cloaking-safe ?). Live : 20 pages stratégiques.
- **C2 — OG/social/icons** : `/api/og` (Allow robots OK), `opengraph-image.tsx`,
  Twitter cards, favicon/manifest/apple-icon. Live : og:image 200 sur 15
  pages + la 404 ; zéro localhost (bug historique résolu — vérifier que
  ça tient).
- **C3 — redirections & codes** : `proxy.ts` (pipeline complet),
  `legacy-redirects.ts`, ~50 règles `next.config.ts`, chaînes de
  redirections (max 1 saut ?), `[...catchall]` vrai 404, tombstone 410,
  `seo-noindex-routes.ts` + X-Robots-Tag, slug-history (x2). Live :
  tester 30 URLs (legacy, EN, stubs, supprimées, trailing slash, casse,
  `?page=`, UTM).
- **C4 — maillage interne** : `links/` (internal-link-catalog,
  inject-deep-links, related-articles, anchor-safe-link),
  `scripts/audit-link-graph.ts` (l'exécuter en lecture) : orphelines,
  profondeur de clic des pages stratégiques et pSEO, ancres sur-optimisées,
  liens vers 404/redirections. Inclut le sitemap HTML `/plan-du-site`
  (exhaustivité, liens morts) et la recherche interne `/recherche`.
- **C5 — duplication & facettes** : pagination `?page=` (301 ?), facettes
  avis/blog (tag, categorie, ville, secteur, service, taille, auteur) :
  indexables ? canonicalisées ? valeur unique ou doorway-risk (HCU) ?
  paramètres UTM et variantes d'URL → canonical.

### SQUAD D — Content-gen : la machine à visibilité (8 agents)

- **D1 — orchestration & cadence** : content-orchestrator-worker (tick,
  distribution type/audience/intent), scheduler, anti-burst,
  editorial-mix-rules, deadline-checker, reenqueue-policy. La cadence
  réelle en prod (DB : contenus publiés/jour sur 30 j) vs configurée.
- **D2 — générateurs & AEO on-page** : générateurs blog/comparison/
  guide-pilier/faq-standalone/qa-derived/barometer, `ensure-direct-answer`
  (réponse directe en tête = featured snippet/AEO), structure Hn, TOC,
  formats extractibles (listes, tableaux, définitions). Échantillon : 10
  contenus publiés récents relus INTÉGRALEMENT côté rendu.
- **D3 — gates qualité** : seo-score, soft-404-gate, doctrine-check,
  dedup-guard + embedding-similarity + outline-simhash, intent,
  multi-judge-ensemble, plagiarism, price-gate, banned-words. Chaque gate
  ROUGIT-elle vraiment ? (règle maison : une garde ne vaut que si elle
  rougit — chercher la preuve d'au moins un rejet réel en DB/logs).
- **D4 — pSEO villes** : phased-coverage, `getIndexableVilles()`,
  tiers T1→T4, `premium-rewrite-slugs`, prose `{{price|flat}}` (décision
  4 — NE PAS toucher), landing-ville-* generators, stubs noindex,
  doorway-risk HCU (différenciation réelle inter-villes : scripts t4-*).
  Live : 5 pages villes de tiers différents, similarité.
- **D5 — knowledge base** : state-machine, quality-gates, seo-generator,
  locale-policy, embeddings/search, related-entries, enrichissement
  llms.txt, sitemap-knowledge, `/connaissances`. DB : volumes par statut.
- **D6 — E-E-A-T & citations** : external-links-injector + trust-tier +
  persist-citations, fact-check (claims-extractor), provenance-logger,
  bylines Person, pages charte-editoriale/transparence/corrections/
  methodologie. URL de citation cassée (backtick francecompetences —
  bug connu) : encore là ?
- **D7 — fraîcheur & cycle de vie** : content-refresh-worker,
  tier-lifecycle, news-lifecycle, quality-improver, HCU monitor
  (gsc-hcu-monitor-worker), `dateModified` réellement mis à jour lors des
  refresh ? lastmod sitemap suit-il ? (piège : lastmod figé 2026-06-08
  sur pages.xml — re-mesurer).
- **D8 — stratégie mots-clés** : keyword-templates/selector,
  keyword-opportunity-detector, content-keyword-sync-worker, GSC queries
  (read-only) : couverture des requêtes cœur (« formation IA entreprise »,
  « audit IA PME », « organisme formation IA Qualiopi <ville> »…), trous
  de la matrice intent × service × géo.

### SQUAD E — Images & médias (4 agents)

- **E1 — pipeline image-bank** : import → variants (WebP/AVIF/LQIP) →
  EXIF/XMP/IPTC embed → licence CC BY / copyright → watermark download →
  RGPD ip-hash. Isolation (`scripts/image-bank/isolation-check.ts`).
- **E2 — sémantique image** : image-seo.service + enrichment, alt-texts
  (`alt-text-validation`), captions, `page-images.ts` manifest (1 675 l.) :
  couverture des pages stratégiques, slots vides, `ImageObject` graph +
  jsonld snapshots à jour.
- **E3 — qualité visuelle & compliance** : galerie publique, hero images
  villes, inject-body-images, UNSPLASH-COMPLIANCE. ⚠️ REGARDER un
  échantillon de 15 photos (piège connu : l'API Unsplash ne filtre ni
  N&B ni délavé — juger à l'œil, via Read des images locales).
- **E4 — Google Images live** : les sitemaps images sont-ils dans l'index
  GSC ? `site:axion-ia.com` sur Google Images : que remonte-t-il ? logos
  clients bien absents (Disallow) ? og:image indexées par erreur ?

### SQUAD F — Live : moteurs, entité, réputation (7 agents)

- **F1 — probe HTTP exhaustive** : curl HEAD/GET systématique : robots,
  les ~20 sitemaps (status + volume + âge), 7 feeds, llms*, ai*,
  markdown endpoint ×5 types, 15 pages stratégiques (status, cache
  headers CF, x-robots-tag, taille HTML). Tableau complet.
- **F2 — GSC & Bing read-only** : couverture (indexées / découvertes /
  explorées non indexées / exclues par motif), sitemaps soumis vs émis,
  enhancements (FAQ, étoiles, jobs, breadcrumbs), requêtes top 50
  (impressions/clics/position), pages en perte. Comparer à l'audit GSC
  du 2026-07-31 : mieux ou pire, chiffré.
- **F3 — SERP Google live** : 12 requêtes cœur (brand `"Axion-IA"`,
  « formation IA entreprise Grenoble », « audit IA PME France »,
  « organisme formation IA Qualiopi », variantes AEO « qu'est-ce que… »).
  Position, rich snippets, PAA, AI Overview (présence + qui est cité),
  Knowledge Panel (toujours absent ?), sitelinks. Référence 2026-07-20 :
  absent du top 10 partout — re-mesurer, chiffrer le delta.
- **F4 — moteurs IA live (le cœur GEO)** : poser à Perplexity, ChatGPT
  (search), Gemini, Claude (web) les questions : « Qui est Axion-IA ? »,
  « Meilleur organisme formation IA pour PME à Grenoble ? », « audit IA
  entreprise France recommandations ». Mesurer : Axion-IA cité ? sources
  utilisées ? exactitude (siège = GRENOBLE — Perplexity disait Paris ;
  Qualiopi mentionné ?) ; qui capte la place (Mookay, ideAI…, homonyme
  AXION FORMATIONS Saint-Quentin). Rappel doctrine : Gemini ne peut PAS
  citer (Google-Extended bloqué, assumé) — le constater sans le
  requalifier en bug.
- **F5 — entité vérifiable** : re-mesurer les 6 verrous de l'audit
  2026-07-20 : mentions légales en clair (SIREN/RCS/TVA — chantier Kbis
  2026-07-30 passé par là : vérifier le rendu prod), Liste publique OF /
  NDA, Google Business Profile, LinkedIn entreprise, Wikidata, `sameAs`
  (3 entrées → mieux ?), collisions homonymes. Delta chiffré vs 07-20.
- **F6 — backlinks & mentions tierces** : mentions presse/annuaires
  (jaimelesstartups, lespepitestech, Crunchbase…), état du plan
  `PLAN-ACTION-BACKLINKS-RP` (racine projet), citations locales
  (`getLocalCitationsCoverage()` vs réalité live), profil d'ancres.
- **F7 — logs serveur & crawl réel** : via `ssh axion-prod` (lecture
  seule) : hits Googlebot/Bingbot/bots IA sur 7 j (top paths, 404 crawlées,
  budget gaspillé), reverse-DNS anti-spoofing
  (`scripts/audit-reverse-dns-bots.ts`), fréquence de crawl des sitemaps,
  hits réels sur llms.txt / api/markdown (les IA les lisent-elles ?).

### SQUAD G — Perf & rendu crawler (4 agents)

- **G1 — budgets Web Vitals** : les 15 pages stratégiques vs budgets
  AGENTS.md (LCP ≤ 1 800 ms, INP ≤ 100 ms, CLS = 0, TBT ≤ 150 ms, First
  Load ≤ 75 KB gz ; exception /reserver). Lab local uniquement, pas de
  re-déploiement. Lien perf ↔ crawl budget.
- **G2 — rendu sans JS** : curl du HTML brut de 10 pages : JSON-LD
  server-rendered ? contenu principal présent sans hydratation ? CSP/
  nonce n'empêche pas le parsing ? cookie consent ne masque rien aux
  bots ? pas de cloaking involontaire (diff UA Googlebot vs normal).
- **G3 — ISR & caches** : `revalidate` par route stratégique,
  `/api/internal/revalidate` (périmètre), job warm (couverture), règles
  cache Cloudflare sur `/sitemap*.xml` (TTL > 1 h = discovery périmée ?),
  âge réel servi (headers `age`/`cf-cache-status`).
- **G4 — mobile & a11y signaux** : viewport, tap targets, a11y (axe sur
  5 pages via le spec existant), poids images servies (AVIF négocié ?),
  lazy-loading du LCP (anti-pattern).

═══════════════════════════════════════════════════════════════════
PHASE 2 — CONTRE-VÉRIFICATION ADVERSARIALE : 6 AGENTS (squad H)
═══════════════════════════════════════════════════════════════════

Quand TOUS les rapports A→G sont écrits :

- **H1→H3 — réfutation** : se partagent tous les findings P0+P1. Pour
  chacun : tenter de le RÉFUTER (relire le code cité, re-tester le live,
  chercher la décision actée ou le test qui le contredit, vérifier
  l'horodatage deploy pour les « vides » DB-driven). Verdict CONFIRMÉ /
  RÉFUTÉ / INCERTAIN + preuve. Un finding contredisant la section
  « décisions actées » est réfuté d'office.
- **H4 — anti-régression des patches** : pour chaque patch prescrit
  survivant, lister ce qu'il pourrait casser : contrat stub.invalid
  (propagation 6 fichiers), `Allow: /api/og`, tests verrous existants
  (prix, robots, jsonld), budget bundle +5 KB, warm job, ISR. Ajuster le
  risque chiffré ; requalifier en « STOP & ASK Will » si nécessaire.
- **H5 — complétude** : qu'est-ce qui n'a été couvert par PERSONNE ?
  (checklist 60 items docs/content-gen vs rapports ; surfaces de la
  Phase 0 non citées ; nouveaux fichiers récents `git log -20` non
  audités). Ce qu'il trouve est traité inline ou listé « hors périmètre
  assumé ».
- **H6 — cohérence inter-rapports** : contradictions entre agents
  (ex. B6 dit 77 avis, F2 dit autre chose), doublons de findings,
  chiffres divergents. Arbitrer avec preuve.

═══════════════════════════════════════════════════════════════════
PHASE 3 — SYNTHÈSE : 4 AGENTS (squad S)
═══════════════════════════════════════════════════════════════════

- **S1 — `02-SCORING.md`** : grille 2 500 points, 10 domaines × 250 :
  (1) crawl & découverte, (2) sitemaps & feeds, (3) JSON-LD & entité,
  (4) metadata & indexabilité, (5) content-gen qualité AEO, (6) pSEO &
  maillage, (7) images, (8) présence moteurs classiques, (9) présence
  moteurs IA & entité vérifiable, (10) perf & rendu. Barème explicite,
  score par domaine justifié par les findings confirmés.
- **S2 — `01-PLAN-PATCHES.md`** : tous les patches confirmés, groupés en
  LOTS de PR cohérents (règle maison : fusionner en lot, un seul build),
  ordonnés P0→P2, chacun : fichiers touchés, effort, impact, risque,
  do-not-touch, test de non-régression à écrire. Les items « STOP & ASK
  Will » à part.
- **S3 — `03-RESTE-WILL.md`** : actions humaines NOUVELLES uniquement
  (entité, annuaires, presse, GBP…), triées par impact GEO/effort,
  format actionnable (où cliquer, quoi écrire).
- **S4 — `00-VERDICT-FINAL.md`** : verdict 🟢/🟠/🔴 + score, le delta
  chiffré vs audit 2026-07-20 (la question centrale : le « déficit
  d'existence vérifiable » se comble-t-il ?), top 10 découvertes, top 5
  quick wins, et la réponse en une phrase à : « si un dirigeant de PME
  demande à une IA qui peut l'aider sur l'IA, Axion-IA sort-il, et
  sinon, quel est LE verrou n°1 ? ».

Rappels finaux : ne conclus jamais sur une seule source ; un sitemap vide
n'est un bug que si le deploy date de > 1 h + warm job passé ; tout chiffre
affiché se vérifie en base ; et si un choix d'interprétation majeur se
présente, documente les deux lectures plutôt que de trancher seul.

═══════════════════════════ FIN DU PROMPT ═══════════════════════════

---

## ✅ Auto-vérification du présent document (relu 2×, 2026-08-14)

**Passe 1 — couverture des surfaces** (vs cartographie code du 08-14) :
robots/llms/ai/ai-policy ✔ (A1, A5) · 20 sitemaps ✔ (A2-A4) · feeds +
markdown ✔ (A5) · IndexNow/Indexing/GSC ✔ (A6, F2) · 30 builders JSON-LD ✔
(B1-B6, dont Dataset/DefinedTerm/speakable/QR-avis) · metadata/canonical/
hreflang/OG ✔ (C1-C2) · redirects/404/410/soft-404/noindex ✔ (C3) ·
maillage ✔ (C4) · facettes/duplication ✔ (C5) · content-gen orchestration/
générateurs/gates/pSEO/KB/E-E-A-T/fraîcheur/keywords ✔ (D1-D8) ·
image-bank pipeline/sémantique/visuel/live ✔ (E1-E4) · probe HTTP/GSC/
SERP/moteurs IA/entité/backlinks/logs ✔ (F1-F7) · Web Vitals/rendu sans
JS/ISR-caches/mobile ✔ (G1-G4) · site-explorer workers couverts via A6+F2 ·
sitemap HTML `/plan-du-site` + recherche interne : sous C4/H5.

**Passe 2 — contraintes & pièges mémoire intégrés** : FR uniquement ✔ ·
Google-Extended/doctrine robots ✔ · Plausible ✔ · « à partir de » +
piège `|flat` ✔ · datePosted/validThrough/baseSalary/lieu-title ✔ ·
« N°1 France » ✔ · logos OPCO ✔ · CGV moyens ✔ · assureur ✔ · reste-Will
non répétés ✔ · clé IndexNow non re-diagnostiquée ✔ · stub.invalid + warm
PR #599 ✔ · port 5433 BOOKFORGE ✔ · 77 avis 4,88 ✔ · jq absent ✔ ·
worktrees seo2/indexnow ✔ · machine saturée ✔ · repo = `axionia/` ✔ ·
audit-only ⇒ zéro régression possible ✔ · comptes : 6+6+5+8+4+7+4 = 40
(phase 1) + 6 (H) + 4 (S) = **50 agents** ✔.
