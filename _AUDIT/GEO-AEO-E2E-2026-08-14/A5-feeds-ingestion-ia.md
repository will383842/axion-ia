# A5 — Feeds & canal d'ingestion IA

- **Date** : 2026-08-14, mesures live 17:50–18:09 UTC
- **Périmètre réellement couvert** : `llms.txt` + `llms-full.txt` (+ exporter KB `knowledge-llms-txt.ts`), les 7 feeds (`/fr/{blog,actualites,cas-concrets,faq,avis}/feed.xml`, `/fr/ressources/feed.{xml,json}`), `/api/markdown/[type]/[slug]` (couverture des 6 types, headers, cache), présence réelle des `<link rel="alternate" type="text/markdown">` sur les pages HTML live, validité XML/JSON, fraîcheur.
- **Contexte deploy** : un déploiement était en vol (parti 17:33 UTC). Toutes les routes auditées sont `force-dynamic`/edge (pas de fenêtre ISR) — les mesures ne sont pas polluées par la fenêtre stub/ISR.

## Résumé exécutif

Le canal d'ingestion IA est **structurellement excellent** (llms.txt riche et exact, 7 feeds tous 200, markdown API 200 sur blog/actualites/faq/cas-concrets/guides, robots `Allow: /api/markdown/` intact) **mais il ment sur deux points critiques** : (1) `llms-full.txt` — le fichier phare servi aux crawlers IA — contient **26 placeholders `{{price:…}}` bruts** dans sa section FAQ (les prix, l'info n°1 demandée aux assistants, sont illisibles) ; (2) **66 pages publiques (60 glossaire + 6 centre-aide) annoncent un alternate markdown qui répond 404** — la même classe de bug que celle corrigée pour la FAQ le 2026-08-10, non propagée. S'y ajoutent le feed FAQ qui sert 70 tokens bruts sur 1 550 items (1,1 Mo), et une fraîcheur morte : **dernier item blog ET actualités = 20 juillet** (25 jours) pour une « veille hebdomadaire » — le signal « site mort » que les fix du 2026-07-31 voulaient précisément éviter.

## Findings

### [P0] llms-full.txt sert 26 tokens `{{price:…}}` bruts aux moteurs IA

- **Symptôme** : la section FAQ de `llms-full.txt` (fichier explicitement destiné à « Perplexity, ChatGPT, Claude, Bing Copilot, Google AIO ») contient des placeholders non résolus : `{{price:intervention-membre-equipe|flat}}`, `{{price:audit-flash|from}}`, etc. Un LLM qui ingère ce fichier ne peut restituer AUCUN prix des passages concernés — ou pire, restitue le placeholder tel quel.
- **Preuve code** : `src/app/llms-full.txt/route.ts:71-73` — `faqBlock` concatène `f.fr.answer` / `f.en.answer` **bruts**, sans passer par `resolvePriceTokens` ; or `src/content/transversal.ts` (source `FAQ_GLOBAL`) contient 22 lignes porteuses de `{{price:` (comptage `grep -c`). Les pages HTML, elles, résolvent (`src/app/[locale]/faq/page.tsx:90` via `resolvePriceTokensDeep`), tout comme `/api/markdown` (`src/app/api/markdown/[type]/[slug]/route.ts:221`).
- **Preuve live** (2026-08-14 18:07 UTC) : `curl https://axion-ia.com/llms-full.txt` → 200, 136 905 o, **26 occurrences** de `{{price:…}}` (13 tokens distincts, dont `intervention-essentielle|flat` ×4, `intervention-dirigeants|flat` ×5). Comparatif : `/api/markdown/faq/cout-projet-ia-pme` (18:08 UTC) sert la même réponse **résolue** (« 990 € HT… 1 390 € HT… »).
- **Root-cause** : le fix « prix dérivés du SSOT, zéro hardcode » (en-tête du fichier, Sprint 14.10.5) a traité les prix des 5 modules mais jamais le bloc FAQ, injecté brut depuis `FAQ_GLOBAL`.
- **Patch prescrit** : dans `route.ts` (llms-full), envelopper question/réponse du `faqBlock` (et par sûreté `caseBlock`) dans `collapsePriceProseDuplicates(resolvePriceTokens(s, "fr"))` (même motif que `api/markdown` route.ts:221). Vérifier que `@/content/pricing-tokens` est edge-safe (pur TS/données — a priori oui ; sinon basculer la route en `runtime="nodejs"`).
- **Effort** : S. **Impact GEO/AEO** : fort (fichier d'ingestion phare ; les prix sont la requête n°1 aux assistants).
- **Risque de régression** : faible (~5 %) — attention décision actée n°4 : ne PAS transformer les `|flat` en `|from` (la prose porte déjà « à partir de » quand il faut) ; do-not-touch : `src/content/pricing.ts`, `src/content/transversal.ts`, le test `no-hardcoded-prices.spec.ts`.

### [P0] 66 pages (60 glossaire + 6 centre-aide) annoncent un alternate markdown qui 404

- **Symptôme** : chaque page `/fr/glossaire/[slug]` et `/fr/centre-aide/[slug]` émet `<link rel="alternate" type="text/markdown" href="/api/markdown/{glossaire|centre-aide}/…">` ; **toutes ces URLs répondent 404**. On publie une invitation à ingérer un canal cassé — exactement la classe de bug corrigée pour la FAQ le 2026-08-10 (cf. commentaire `route.ts:177-191`), non propagée aux deux autres types.
- **Preuve code** — deux root-causes distinctes :
  1. **Glossaire** : `src/app/[locale]/glossaire/[slug]/page.tsx:192` émet le link, mais `"glossaire"` est **absent** de `ALLOWED_TYPES` (`src/app/api/markdown/[type]/[slug]/route.ts:48-55`) → 404 « Unknown content type » systématique. 60 termes concernés (`ALL_GLOSSARY_TERMS_EXTENDED`, hub live affiche « 60 termes »).
  2. **Centre-aide** : le type est autorisé, mais la branche (`route.ts:157-174`) lit **uniquement** la DB `prisma.helpArticleTranslation`, alors que la page publique sert le hardcode `HELP_ARTICLES` (`src/lib/help-articles/reader.ts:46` — flag `HELP_BACKEND_UNIFIED` OFF par défaut + fallback hardcode si DB vide ; `src/content/transversal.ts:5046`, 6 articles). Même divergence de source que l'ancien bug FAQ.
- **Preuve live** (2026-08-14 18:05–18:06 UTC) :
  - `/fr/glossaire/llm` → 200 avec `href="/api/markdown/glossaire/llm"` ; `GET /api/markdown/glossaire/llm` → **404**.
  - `/fr/centre-aide/preparer-une-intervention` → 200 avec le link alternate ; `/api/markdown/centre-aide/{preparer-une-intervention, facturation-tva, perimetre-audit-ia, phases-implementation, securite-donnees, support-post-livraison}` → **404 ×6** (6/6 articles du hub).
- **Root-cause** : couverture incomplète de la route markdown vs les pages qui l'annoncent (glossaire jamais implémenté ; centre-aide implémenté sur la mauvaise source).
- **Patch prescrit** : dans `api/markdown/[type]/[slug]/route.ts` — (a) ajouter `"glossaire"` à `ALLOWED_TYPES` + une branche lisant la **même source que la page** (`getGlossaryTermBySlug`/readers de `src/lib/knowledge/readers.ts`) ; (b) réécrire la branche `centre-aide` sur `getHelpArticleBySlug(slug, "fr")` (reader unifié fail-soft), en gardant la DB en second pour l'`updatedAt` réel (même motif que le fix FAQ du 2026-08-10, route.ts:176-201).
- **Effort** : M (2 branches + tests). **Impact GEO/AEO** : fort (66 URLs d'ingestion cassées, annoncées dans le `<head>` de pages tier-1).
- **Risque de régression** : faible (~5 %) — route additive ; do-not-touch : les branches blog/actualites/faq existantes, `robots.ts` (l'`Allow: /api/markdown/` couvre déjà), `src/lib/help-articles/reader.ts` (ne pas activer le flag `HELP_BACKEND_UNIFIED` au passage).

### [P1] Feed FAQ : 70 tokens prix bruts, 1 550 items / 1,1 Mo, zéro pubDate

- **Symptôme** : `/fr/faq/feed.xml` sert des `<description>` contenant des `{{price:…}}` non résolus, pèse 1,1 Mo pour 1 550 items (dont les Q/R tier-2 **noindex**), et aucun item n'a de `<pubDate>` (aucun signal de fraîcheur exploitable par les pollers).
- **Preuve code** : `src/app/[locale]/faq/feed.xml/route.ts:25-36` — `listFaqs()` consommé brut (pas de `resolvePriceTokensDeep`, contrairement aux pages : `faq/page.tsx:90`, `faq/[slug]/page.tsx:122`) ; aucun `take`/cap (`listFaqs` renvoie l'intégralité legacy + DB, `src/lib/knowledge/readers.ts:240-301`, tier-2 inclus) ; le template item (lignes 31-36) n'émet pas de `<pubDate>`.
- **Preuve live** (2026-08-14 17:52 UTC) : `curl /fr/faq/feed.xml` → 200, **1 154 175 o**, 1 550 `<item>`, **70 occurrences** `{{price:…}}` (top : `audit-strategique-pme|range` ×15, `intervention-essentielle|flat` ×11), 0 `<pubDate>`.
- **Root-cause** : le feed a été branché sur le reader unifié (KB-6.3) sans hériter ni de la résolution de tokens des pages, ni d'une sémantique RSS (cap, dates).
- **Patch prescrit** : (1) `resolvePriceTokensDeep(await listFaqs(), loc)` ; (2) cap raisonnable (p. ex. 200 items, tier-1 d'abord) ; (3) `<pubDate>` depuis `updatedAt`/`reviewedAt` quand disponible. Le point (1) est le cœur ; (2)-(3) opportunistes.
- **Effort** : S. **Impact GEO/AEO** : moyen-fort (canal AEO secondaire mais pollé — Bing Copilot/Perplexity/agrégateurs).
- **Risque de régression** : faible (~10 % sur le cap — un agrégateur qui aurait indexé des items au-delà du cap les perdrait du flux ; les `<guid>` permalink limitent l'effet). Do-not-touch : `listFaqs()` lui-même (partagé avec pages + sitemap), décision n°4 sur les variantes de tokens.

### [P1] Fraîcheur morte sur les 2 feeds vitrines : dernier item = 20 juillet (25 jours)

- **Symptôme** : le blog ET les actualités — présentées partout (llms.txt, llms-full.txt, hub) comme « veille **hebdomadaire** » — n'ont rien publié depuis le 2026-07-20. Pour les crawlers AEO qui pollent ces flux, c'est le signal « site mort » que les réécritures du 2026-07-31 (suppression de la fenêtre 48 h) visaient explicitement à éviter.
- **Preuve code** : les routes sont saines — `blog/feed.xml/route.ts:50-57` et `actualites/feed.xml/route.ts:60-67` lisent bien la DB au runtime (`force-dynamic`), tri `publishedAt desc`. Le problème est un état de données, pas un bug de rendu.
- **Preuve live** (2026-08-14 17:52 UTC) : `/fr/blog/feed.xml` → 30 items, `lastBuildDate` **Mon, 20 Jul 2026 15:01:41 GMT** ; `/fr/actualites/feed.xml` → 32 items, plus récent **Mon, 20 Jul 2026 06:01:06 GMT**.
- **Root-cause** (hors périmètre code A5) : pipeline content-gen à l'arrêt — cohérent avec l'état connu « kill switch OpenAI à zéro / crédit à recharger » (mémoire 2026-08-03/04). Déjà acté comme reste-Will → **non répété** dans 03-RESTE-WILL.
- **Patch prescrit** : aucun patch code côté feeds. Signalement transverse : tant que la production éditoriale est gelée, envisager de retirer/adoucir le mot « hebdomadaire » dans `llms.txt`/`llms-full.txt` si le gel doit durer (1 ligne, S) — sinon l'affirmation devient mensongère pour les moteurs IA.
- **Effort** : S (le libellé) / N-A (la reprise du pipeline). **Impact GEO/AEO** : fort (fraîcheur = critère n°1 de citation des moteurs de réponse).
- **Risque de régression** : nul (libellé). Do-not-touch : la sémantique « N derniers items sans fenêtre » des deux feeds (fix 2026-07-31, ne pas réintroduire de fenêtre 48 h).

### [P2] `/api/markdown/guides/*` accepte n'importe quel slug blog et publie un « Source » qui 404

- **Symptôme** : la branche `guides` ne filtre pas le préfixe `guide-` : tout article blog est servi sous `type=guides` avec `Source: …/fr/guides/<slug>` — URL canonique inexistante (404). Contenu dupliqué + canonique mensongère pour un LLM qui suivrait la source.
- **Preuve code** : `api/markdown/[type]/[slug]/route.ts:115-132` — même requête que `blog` (`isNews:false`), aucun test `slug.startsWith("guide-")`, alors que le commentaire (l.113) et le feed blog (`blog/feed.xml/route.ts:92`) posent le préfixe comme discriminant.
- **Preuve live** (18:05–18:06 UTC) : `/api/markdown/guides/formation-ia-champigny-sur-marne-2` → **200** avec `Source: https://axion-ia.com/fr/guides/formation-ia-champigny-sur-marne-2` → cette URL répond **404**. Le vrai guide `/api/markdown/guides/guide-integration-ia-grenoble` → 200 (nominal OK).
- **Root-cause** : branche copiée de `blog` sans le discriminant.
- **Patch** : `if (!slug.startsWith("guide-") && !slug.startsWith("guide_")) return null;` en tête de branche (miroir `resolveArticleRoute`). Symétriquement, la branche `blog` pourrait rejeter les slugs `guide-*` (leur canonique est /guides). Effort S. Impact faible-moyen (URL non annoncée, mais crawlable). Risque ~2 % ; do-not-touch : branche `actualites`.

### [P2] Exporter `buildLlmsTxt` (enrichissement KB de llms.txt) : code mort, jamais branché

- **Symptôme** : l'enrichissement du llms.txt par les entrées KB publiques (KB-8) n'existe pas en prod — `llms.txt` est 100 % statique (très bon au demeurant), et les ~50 fiches `/fr/connaissances/kb-fact-*` n'apparaissent dans aucun canal llms.txt.
- **Preuve code** : `src/server/exporters/knowledge-llms-txt.ts:14` définit `buildLlmsTxt` ; `grep -rln "buildLlmsTxt|knowledge-llms-txt" src scripts` → **zéro consommateur** (2026-08-14 ~17:55 UTC). Nota : contrairement à ses voisins `knowledge-rss.ts:42` / `knowledge-sitemap.ts`, il n'a PAS d'early-exit `stub.invalid` — sans conséquence tant qu'il est mort, mais piège si on le branche un jour sur une route SSG.
- **Preuve live** (17:50 UTC) : `llms.txt` servi = version statique de `src/app/llms.txt/route.ts` (aucune entrée KB).
- **Patch** : décision produit — soit supprimer l'exporter (dette), soit le brancher en section « Connaissances (fiches) » de llms.txt via une route nodejs revalidée (dans ce cas AJOUTER l'early-exit stub, contrat ADR 0026). Effort S (suppression) / M (branchement). Impact faible-moyen. Risque : si branchement, ~15 % (edge→nodejs du llms.txt, contrat stub) ; do-not-touch : `src/app/llms.txt/route.ts` structure actuelle validée.

### [P2] Feed `/fr/ressources/*` : « cross-type » en théorie, mono-type en pratique

- **Symptôme** : le canal promet « Articles, FAQ, cas concrets, glossaire IA, guides » ; il sert 50/50 items du seul type `industry_use_case` (fiches kb-fact).
- **Preuve code** : `src/server/exporters/knowledge-rss.ts:47-64` — `take: 50` trié `publishedAt desc` sur `knowledgeEntry` uniquement (blog/FAQ/cas concrets vivent dans d'autres tables et n'y entreront jamais) ; les facts récents saturent le cap.
- **Preuve live** (18:04 UTC) : `feed.json` → JSON Feed 1.1 **valide**, 50 items, `tags` = `{"industry_use_case":50}`, dates 2026-05-25 → 2026-08-11 ; 3 URLs échantillonnées `/fr/connaissances/kb-fact-*` → 200 (18:05 UTC).
- **Patch** : soit assumer (renommer description « Fiches connaissances »), soit fédérer réellement (union multi-sources avec quota par type). Effort S (libellé) / L (fédération). Impact faible. Risque libellé nul.

### [P2] Feed avis : plafonné à 48/77, sans lastBuildDate ni lien de découverte sur les pages /avis

- **Symptôme** : le flux (le seul annoncé nommément dans llms.txt avec blog/actualités) n'expose que 48 des 77 avis réels, n'a ni `lastBuildDate` ni `atom:link self`, et AUCUNE page `/fr/avis*` n'émet de `<link rel="alternate" type="application/rss+xml">` (les hubs blog/faq/cas-concrets/ressources/actualités le font tous).
- **Preuve code** : `src/app/[locale]/avis/feed.xml/route.ts:34` (`pageSize: 48`), :56-65 (channel minimal) ; `src/app/[locale]/avis/page.tsx:167` (alternates sans `types`) — `grep feed.xml|rssFeed` dans `src/app/[locale]/avis/**` → 0 hors route.
- **Preuve live** (17:52 UTC) : 48 `<item>`, avis le plus récent 2026-07-06, pas de `lastBuildDate`.
- **Patch** : `pageSize: 100` (couvre les 77), ajouter `lastBuildDate` + `atom:link self` (xmlns:atom), et `alternates.types` sur `avis/page.tsx`. Effort S. Impact faible-moyen (les 77 avis 4,88/5 sont un actif AEO majeur). Risque ~2 % ; do-not-touch : `getPublishedReviews` (partagé).

### [P2] Incohérences factuelles entre llms.txt et llms-full.txt servies aux IA

- **Symptôme** : `llms.txt` dit « Hetzner (**Nuremberg**, UE) » (route.ts:75), `llms-full.txt` dit « Hetzner **CPX32 Frankfurt** » (route.ts:86) — l'infra réelle est un CPX42 (AGENTS.md). Par ailleurs `llms-full.txt` affirme « Langues : FR canonique, EN miroir » sans la précision « désactivé / 301 » que `llms.txt` porte correctement (route llms.txt:74), et duplique 88 réponses `(EN)` dans un canal désormais 100 % FR. Deux fichiers censés décrire la même entité donnent des versions différentes → risque de restitution contradictoire par les assistants.
- **Preuve live** (17:50/18:07 UTC) : les deux fichiers servis contiennent respectivement ces mentions ; 88 lignes `(EN)` comptées dans llms-full.
- **Patch** : aligner les 2 mentions hébergement sur une seule formulation (sans détail de gamme serveur, qui périme), harmoniser la ligne Langues sur celle de llms.txt. Les `(EN)` : simple allègement optionnel (≈68 Ko), PAS un chantier EN (décision n°1 respectée). Effort S. Impact faible. Risque nul.

### [P2] [À CONFIRMER] Réponse FAQ « journée collective en intra : 2 450 € » vs offre formations à 1 900 €/jour

- **Symptôme** : la réponse `cout-projet-ia-pme` (servie résolue sur /fr/faq, /api/markdown et — brute — dans llms-full/feed FAQ) chiffre « une journée collective en intra, 2-15 participants : 2 450 € HT » via `{{price:intervention-essentielle|flat}}`, alors que l'harmonisation 2026-08-13 a posé la génération actuelle à 1 200 € (4 h) / 1 900 € (journée) — c'est le tier legacy explicitement identifié comme « génération PRÉCÉDENTE » dans `llms-full.txt/route.ts:26-34`.
- **Preuve code** : `src/content/pricing.ts:401-405` (`intervention-essentielle`, 2 450 €) ; preuve live : `/api/markdown/faq/cout-projet-ia-pme` (18:08 UTC) sert « 2 450 € HT ».
- **Statut** : chevauche la surface pricing/contenu (squad C/H) — à trancher là-bas : soit le tier Essentielle est toujours vendu tel quel (pas de bug), soit la réponse FAQ doit re-pointer la matrice formations. **Ne pas patcher depuis A5.**

## Mesures brutes

| URL | Heure UTC | Status | Content-Type | Taille | Items | Observations |
|---|---|---|---|---|---|---|
| /llms.txt | 17:50 | 200 | text/plain | 10 499 o | — | 0 token brut ; bloc Qualiopi présent ; CC 1h+SWR 24h |
| /llms-full.txt | 17:50→18:07 | 200 | text/plain | 136 905 o | — | **26 `{{price:}}` bruts** ; 88 lignes `(EN)` |
| /fr/blog/feed.xml | 17:52 | 200 | rss+xml | 12 941 o | 30 | dernier item **2026-07-20** ; 0 token ; XML équilibré, 0 `&` brut |
| /fr/actualites/feed.xml | 17:52 | 200 | rss+xml | 17 022 o | 32 | dernier item **2026-07-20** ; cf-cache HIT |
| /fr/cas-concrets/feed.xml | 17:52 | 200 | rss+xml | 2 468 o | 5 | statique, sans pubDate |
| /fr/faq/feed.xml | 17:52 | 200 | rss+xml | **1 154 175 o** | **1 550** | **70 `{{price:}}` bruts**, 0 pubDate |
| /fr/avis/feed.xml | 17:52 | 200 | rss+xml | 34 478 o | 48 | cap 48 < 77 avis ; plus récent 2026-07-06 |
| /fr/ressources/feed.xml | 18:04 | 200 | rss+xml | — | 50 | 100 % kb-fact ; 0 `&` brut |
| /fr/ressources/feed.json | 18:04 | 200 | feed+json | 45 936 o | 50 | JSON Feed 1.1 valide (parse node) ; dates 05-25→08-11 |
| /api/markdown/blog/formation-ia-champigny-sur-marne-2 | 18:05 | 200 | text/markdown | — | — | tokens résolus (0 `{{`) |
| /api/markdown/actualites/souverainete-…-assemblee-nationale | 18:05 | 200 | text/markdown | — | — | OK |
| /api/markdown/faq/geo-france · /faq/cout-projet-ia-pme | 18:05/18:08 | 200 | text/markdown | — | — | fix 2026-08-10 opérant, tokens résolus |
| /api/markdown/cas-concrets/industrie-comptabilite | 18:05 | 200 | text/markdown | — | — | OK |
| /api/markdown/guides/guide-integration-ia-grenoble | 18:06 | 200 | text/markdown | — | — | OK |
| /api/markdown/guides/formation-ia-champigny-sur-marne-2 | 18:05 | **200** | text/markdown | — | — | fuite cross-type ; `Source:` → /fr/guides/… = **404** |
| /api/markdown/glossaire/llm | 18:05 | **404** | text/plain | — | — | annoncé par /fr/glossaire/llm (200, link présent) |
| /api/markdown/centre-aide/{6 slugs du hub} | 18:06 | **404 ×6** | text/plain | — | — | annoncés par les pages (link présent, vérifié) |
| Alternate `text/markdown` dans HTML live (blog, actualites, faq, cas-concrets) | 18:07 | présent ×4 | — | — | — | href relatifs corrects |
| /api/observatoire/export-csv + 6 URLs annoncées par llms.txt | 18:09 | 200 ×7 | — | — | — | toutes les promesses de llms.txt tiennent (hors 404 ci-dessus) |
| robots.txt `Allow: /api/markdown/` | 18:07 | présent ×5 groupes | — | — | — | invariant décision n°2 intact |
| 3 URLs /fr/connaissances/kb-fact-* (échantillon feed ressources) | 18:05 | 200 ×3 | — | — | — | liens du feed valides |

Vérifs statiques : `buildLlmsTxt` → 0 consommateur dans `src/` + `scripts/` ; `FAQ_GLOBAL` → 22 lignes `{{price:` ; `HELP_ARTICLES` → 6 articles ; glossaire → 60 termes (hub live).

## Limites

- **Pas d'accès DB** (A5 non autorisé) : les volumes DB (nb réel de FAQ tier-1 vs tier-2 dans les 1 550 items, nb d'entrées KB publiques hors top-50) n'ont pas pu être recoupés à la source.
- **Validation XML** : bien-formance vérifiée par heuristiques (équilibre `<item>`, zéro `&` non échappé) — pas de passage au validateur W3C (pas de soumission d'URL externe, règle audit-only) ni de xmllint local.
- **Échantillonnage** : 1 slug testé par type markdown (pas les 1 550 FAQ ni les 60 termes un à un) ; le 404 glossaire/centre-aide est cependant structurel (type absent / mauvaise source), pas probabiliste.
- **Fenêtre deploy** : un deploy est parti à 17:33 UTC ; toutes les routes mesurées sont dynamic/edge donc insensibles à la fenêtre ISR, mais les mesures d'après ~18:30 UTC pourraient différer marginalement (cache CF purgé).
- Les feeds EN (`/en/*/feed.xml`) n'ont pas été testés : EN 301 runtime, décision actée n°1 — hors périmètre.
- La contradiction prix FAQ 2 450 € vs 1 900 € est laissée `[À CONFIRMER]` au squad pricing/contenu (chevauchement de surface).
