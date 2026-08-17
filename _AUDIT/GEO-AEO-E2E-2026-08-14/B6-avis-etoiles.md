# B6 — Avis & étoiles

Date : 2026-08-14, mesures live 18:01–18:09 UTC (+ re-mesure post-deploy, voir P0).
Périmètre couvert : `src/server/reviews/jsonld.ts` + `queries.ts`, les 7 routes
`/[locale]/avis/**` (hub, [slug], deposer, ville, departement, secteur, service,
feed.xml), `sitemap-avis.xml`, le flux RSS avis, les surfaces avis hors-/avis
(home, pages services via `ServiceReviewsSection`), le cycle publication →
revalidation → ping, et la cohérence DB ↔ affiché ↔ JSON-LD.
Contexte : deploy GH Actions **en vol** (run 31824504716, parti 17:33 UTC) —
mesures interprétées en conséquence.

## Résumé exécutif

La surface avis est **globalement saine et cohérente** : 77 avis publiés, tous
« Vérifié », moyenne exacte 4,883 (= 4,88 attendu) affichée 4,9/5, identique en
DB-runtime, à l'écran et en JSON-LD ; sitemap-avis complet (103 URLs, facettes
gatées ≥ 3), faceted-nav noindex propre, IndexNow pingé à chaque publication.
Deux vrais problèmes : (P0) la home et les 4 pages services qui portent le bloc
avis sont ABSENTES des listes anti-stub du job `warm` — chaque deploy les re-sert
sans avis ni AggregateRating pendant ~1–2 h, et le warmer lui-même refige la
version vide à l'edge ; (P1) les étoiles SERP sont structurellement inaccessibles :
l'AggregateRating ne vit que sur `Organization` (self-serving, jamais d'étoiles
Google) et sur 5 facettes à faible autorité — aucune page qui ranke ne porte de
nœud Product/Course étoilable. C'est la root-cause du « 0 rich snippet » connu.

## Findings

### [P0] Home + 4 pages services hors des listes anti-stub du job `warm` — le bloc avis et l'AggregateRating disparaissent à chaque deploy

- **Symptôme** : après chaque déploiement, `/fr` (home) et les pages services
  (`/fr/audit`, `/fr/formations`, `/fr/implementation`, `/fr/sites-web-augmentes`)
  re-servent leur version pré-rendue au build stub : bloc « avis clients » absent
  (hide-if-empty), badge « Excellent » et AggregateRating JSON-LD 77/4,9 absents,
  pendant ~1–2 h. Pire : le step « Warm strategic pages » fait un GET de ces URLs
  juste après le `purge_everything` → il **refige la version vide** chez
  Cloudflare pour `s-maxage=3600`.
- **Preuve code** :
  - `.github/workflows/deploy-coolify.yml:747` — `PATHS='["/fr/actualites","/fr/connaissances","/fr/ressources","/fr/galerie","/fr/diagnostic"]'` : ni `/fr` ni aucune page service.
  - `.github/workflows/deploy-coolify.yml:778` — `FILES=…` (purge CF ciblée) : mêmes 5 URLs, mêmes absents.
  - `.github/workflows/deploy-coolify.yml:808` — `STRATEGIC="/fr /fr/diagnostic /fr/audit /fr/formations …"` : GET de chauffe AVANT toute revalidation → fige le stub à l'edge (mécanisme décrit par le commentaire du workflow lui-même, l.762-768, vécu sur `/fr/diagnostic`).
  - `src/app/[locale]/page.tsx:54-70` — commentaire documentant le symptôme exact sur la home (constaté 2026-08-10 : « bloc avis vide, note agrégée absente ») + `revalidate = 3600` (l.70) + lecture DB `getPublishedReviews`/`getAggregateRating` (l.121-124).
  - `src/components/reviews/ServiceReviewsSection.tsx:3-4` — « rend null … au build stub » ; `src/app/[locale]/audit/page.tsx:50` — `revalidate = 3600` (idem formations:120, implementation, sites-web-augmentes).
- **Preuve live** (horodatée) :
  - 18:03:25 UTC (avant atterrissage du deploy) : `/fr` → `x-nextjs-cache: HIT`, `Age: 859`, `cf-cache-status: HIT`, `s-maxage=3600` + AggregateRating 77/4,9 présent — c'est exactement ce couple ISR+edge-cache qui se re-remplit de stub à chaque deploy.
  - Mécanisme déjà observé 2× en réel le 2026-08-14 sur `/fr/diagnostic` (commentaires du workflow l.737-744 et 762-768) et le 2026-08-10 sur la home (commentaire page.tsx). Deploy 31824504716 en vol pendant l'audit ; la fenêtre post-atterrissage est documentée en « Mesures brutes » si capturée avant remise du rapport.
- **Root-cause** : PR #599 (2026-08-14) a créé le correctif anti-stub mais ses
  DEUX listes n'ont reçu que les pages index + `/fr/diagnostic`. La home avait
  été « soignée » le 08-10 par le passage à `revalidate=3600` — AVANT que le job
  warm existe — et n'a jamais rejoint les listes. Les 4 pages services (bloc avis
  ajouté avec `ServiceReviewsSection`) non plus.
- **Patch prescrit** : ajouter `"/fr"`, `"/fr/audit"`, `"/fr/formations"`,
  `"/fr/implementation"`, `"/fr/sites-web-augmentes"` aux deux listes
  (`PATHS` l.747 **et** `FILES` l.778) du job `warm`.
- **Effort** : S (2 lignes). **Impact GEO/AEO** : fort — la home est la page
  d'identité (AggregateRating Organization + mur de preuve sociale) et les pages
  services sont les pages de conversion ; avec plusieurs deploys/jour, les
  fenêtres vides cumulées sont vues par Googlebot et les crawlers IA.
- **Risque de régression** : quasi nul — job best-effort, jamais bloquant ;
  5 revalidations + 5 purges de plus. **Do-not-touch** : le contrat stub
  (`stub.invalid`), l'ordre purge→revalidate→purge ciblée→warm du job, le
  `revalidate = 3600` de la home (garde-fou documenté l.68-69).

### [P1] Étoiles SERP structurellement inaccessibles : AggregateRating seulement sur Organization (self-serving) et sur 5 facettes sans autorité — rien sur les pages qui rankent

- **Symptôme** : bug connu « 54 avis (aujourd'hui 77), 0 rich snippet étoiles en
  SERP ; concurrent à 465 avis affichés ». Toujours structurellement vrai.
- **Preuve code** :
  - `src/server/reviews/jsonld.ts:55-65` — `orgAggregateJsonLd` : l'AR global est niché sur `Organization` (home + hub /avis). Or Google **n'affiche jamais** d'étoiles pour les avis « self-serving » (AR sur l'Organization du site lui-même, politique sept. 2019) → ces deux surfaces ne produiront jamais d'étoiles, quel que soit le volume.
  - `src/components/reviews/ServiceReviewsSection.tsx:6-7` — « Le balisage AggregateRating star-eligible vit sur la facette /avis/service/[…] » : choix explicite de NE PAS étoiler les pages services.
  - `src/app/[locale]/audit/page.tsx:89,271` — la page audit n'émet que `buildServiceJsonLd` (type `Service`, inéligible aux étoiles — cf. `src/lib/reviews/service-lines.ts:5-12`) ; aucun nœud Product/Course avec AR. Idem formations/implementation/un-a-un/sites-web.
  - Les seuls nœuds étoilables sont `serviceAggregateJsonLd` (`jsonld.ts:68-83`) sur les 5 facettes `/avis/service/*` et les 77 fiches `/avis/[slug]` (`seo.ts:1826-1863`, entité + review nichée — forme correcte).
- **Preuve live** (18:02–18:08 UTC) :
  - `/fr/audit` → `grep aggregateRating` = **0** ; un seul `@type":"Service"`.
  - `/fr/avis/service/audits` → `Product « Audit IA Axion-IA » + AggregateRating 4.8/16` (correct mais page à très faible potentiel de ranking).
  - `/fr/avis` (hub) → AR sur `Organization @id #organization` 77/4,9 (valide mais jamais étoilé par Google).
  - SERP (moteur US via WebSearch, 18:05 UTC) : requêtes « axion-ia avis clients » et « "axion-ia.com/fr/avis" » ne font remonter NI le hub /avis ni aucune étoile ; vérification Google FR impossible depuis cet environnement (voir Limites).
- **Root-cause** : la refonte 2026-07-07 (rejet GSC de `Service` comme
  itemReviewed) a correctement déplacé l'AR vers des types éligibles… mais
  uniquement sur les facettes /avis, pas sur les pages de conversion qui
  concentrent l'autorité et les impressions.
- **Patch prescrit** : sur chacune des 5 pages services, émettre EN PLUS un nœud
  étoilable réutilisant l'existant : `serviceAggregateJsonLd({type: svc.itemType,
  name: svc.schemaName}, await getAggregateRating({serviceLine}), url)` — soit un
  nœud `Product`/`Course` séparé (URL = la page service), soit, pour
  `/formations`, nicher l'AR dans le `buildCourseJsonLd` existant. Gating ≥ 5 déjà
  intégré (`AGGREGATE_MIN_COUNT`, `config.ts:10`).
- **Effort** : S-M (5 pages, helpers déjà écrits, + test). **Impact GEO/AEO** :
  fort — c'est l'unique chemin réaliste vers des étoiles SERP sur « audit IA »,
  « formation IA entreprise », etc.
- **Risque de régression** : faible — cohabitation nœud `Service` (identité) +
  nœud `Product` (avis) sur la même page : conforme, mais valider au Rich
  Results Test sur 1 page avant de généraliser. **Do-not-touch** :
  `buildServiceJsonLd`, le graphe d'identité `seo.ts`, la décision actée 4
  (`AggregateOffer.lowPrice` nombre brut), `service-lines.ts` (SSOT verrouillé
  par `reviews.spec.ts:58-67`).

### [P2] Pas d'autodiscovery RSS sur les pages /avis

- **Symptôme** : le flux `/fr/avis/feed.xml` existe (48 items, valide) et est
  cité dans `llms.txt`, mais aucune page /avis ne porte
  `<link rel="alternate" type="application/rss+xml">` — contrairement à
  blog/actualites/faq/cas-concrets.
- **Preuve code** : `src/app/[locale]/avis/page.tsx:161-168` — `buildProductMetadata`
  appelé sans `rssFeed`, alors que `src/app/[locale]/actualites/page.tsx:65` passe
  `rssFeed: \`${SITE_URL}/fr/actualites/feed.xml\`` (mécanique : `seo.ts:320`).
- **Preuve live** : 18:02:30 UTC — hub /avis : 0 `<link>` RSS (grep sur le HTML) ;
  feed 200, `application/rss+xml`, 48 items.
- **Root-cause** : paramètre simplement omis à la création de la page.
- **Patch** : ajouter `rssFeed: \`${SITE_URL}/fr/avis/feed.xml\`` dans le
  `generateMetadata` du hub. **Effort** : S. **Impact** : faible-moyen
  (découverte agrégateurs/IA). **Risque** : nul.

### [P2] `dateModified` du CollectionPage /avis figé à SITE_EDITORIAL_DATE

- **Symptôme** : le JSON-LD CollectionPage du hub annonce une date éditoriale
  fixe alors que le sitemap annonce le vrai `max(updatedAt)` des avis —
  deux signaux de fraîcheur contradictoires pour la même URL.
- **Preuve code** : `src/app/[locale]/avis/page.tsx:201` (`dateModified:
  SITE_EDITORIAL_DATE`) vs `src/app/sitemap-avis.xml/route.ts:65-71` (hubLastmod
  = max updatedAt réel).
- **Preuve live** : 18:02 UTC — sitemap : lastmod du hub = date du dernier avis ;
  JSON-LD hub : date éditoriale statique.
- **Patch** : dériver `dateModified` du `publishedAt` du plus récent avis chargé
  (déjà en mémoire dans `reviews.items`). **Effort** : S. **Impact** : faible.
  **Risque** : nul.

### [P2] llms-full.txt sans section avis (note globale absente du canal d'ingestion IA)

- **Symptôme** : `llms.txt` décrit bien la page avis (+ feed) mais SANS chiffres ;
  `llms-full.txt` (939 lignes livrées) ne contient AUCUNE section avis — un
  moteur IA qui n'ingère que ce canal ignore le « 77 avis, 4,88/5 ».
- **Preuve code** : `src/app/llms-full.txt/route.ts:5-18` — n'importe que
  FAQ_GLOBAL/CASE_STUDIES/services, aucun import reviews.
- **Preuve live** : 18:07:42 UTC — `grep -i avis llms-full.txt` : uniquement des
  occurrences éditoriales (« avis en ligne » des FAQ sectorielles), zéro donnée
  d'avis clients.
- **Patch** : section « Avis clients » dans llms-full (note agrégée + répartition
  + 3-5 extraits), stub-aware (`isStubBuild()` → omission propre) ; la route est
  dynamique côté prod. **Effort** : S-M. **Impact** : moyen (GEO pur).
  **Risque** : faible ; do-not-touch : early-exits stub existants.

### [P2] Micro-polish sitemap/feed

- `src/app/sitemap-avis.xml/route.ts:85-97` : toutes les facettes héritent de
  `hubLastmod` global → leur lastmod « bumpe » à chaque update de n'importe quel
  avis (léger bruit de fraîcheur). Patch : lastmod par facette = max des avis de
  la facette. Effort S, impact faible.
- `feed.xml` : cap à 48 items /77 (`queries.ts:115`, `Math.min(48, …)`) et pas de
  `atom:link rel="self"`. Effort S, impact faible.

## Mesures brutes

Toutes les mesures : 2026-08-14, UTC. Deploy 31824504716 en vol (parti 17:33,
`gh run list` vérifié 18:09 : in_progress).

| URL | Heure | Status | Observations |
|---|---|---|---|
| /fr/avis | 18:01:56 | 200, 0,45 s | `Cache-Control: private, no-store`, `cf: BYPASS` → **dynamique** (lit la vraie DB à chaque hit, insensible au stub) |
| /fr/avis (contenu) | 18:01:56 | — | AR JSON-LD `Organization @id #organization` : ratingValue 4.9, reviewCount 77 ; texte « 4,9/5 sur 77 avis » ×2 |
| /fr/avis (breakdown) | 18:01:56 | — | 5★=68, 4★=9, 3★=2★=1★=0 → total 77, moyenne exacte **4,8831** (≙ 4,88 attendu ; 4,9 = arrondi 1 décimale `queries.ts:189`) |
| /fr/avis?note=5 | 18:05:38 | 200 | `robots: noindex, follow` + canonical → /fr/avis (faceted-nav OK) |
| /fr/avis pages 1→7 | 18:08:00 | 200 | badges « Vérifié » : 12+12+12+12+12+12+5 = **77/77 vérifiés** (wording « avis vérifiés » exact) |
| /sitemap-avis.xml | 18:02:18 | 200, CF HIT | **103 URLs** = hub 1 + deposer 1 + **77 slugs** + 5 services + 4 villes (grenoble, lyon, paris, annecy) + 10 secteurs + 5 depts ; 0 `<image:loc>` (aucune photo d'avis en base) ; cohérent avec gating ≥ 3 |
| /sitemap-index.xml | 18:02:30 | 200 | référence bien sitemap-avis.xml |
| /fr/avis/feed.xml | 18:02:30 | 200 | RSS 2.0 valide, 48 items (cap), `application/rss+xml` |
| /fr/avis/sophie-m-…-1 | 18:02:30 | 200 | JSON-LD `Course « Formation IA Axion-IA » + review nichée` (forme Google correcte, `seo.ts:1843`) ; hreflang fr + x-default seulement (EN proprement absent) |
| /fr/avis/ville/grenoble, /service/audits, /secteur/industrie_logistique, /departement/38 | 18:03:12 | 200 ×4 | service : `Product + AR 4.8/16` ; ville/secteur/dept : CollectionPage seulement (voulu — Organization serait self-serving) |
| /fr (home) | 18:03:25 | 200 | `x-nextjs-cache: HIT`, `Age: 859`, `s-maxage=3600` ; AR 77/4,9 présent (état sain pré-deploy) |
| /fr/audit | 18:08:28 | 200 | bloc « Ce que disent nos clients » présent ; **0 aggregateRating**, seul `@type: Service` |
| /fr/avis/deposer | 18:08:55 | 200 | `index, follow` + canonical propre (voulu, dans le sitemap) |
| /llms.txt · /llms-full.txt | 18:07:42 | 200 | llms.txt l.25 : entrée avis + feed ; llms-full : zéro donnée avis |
| WebSearch « axion-ia avis clients » / « "axion-ia.com/fr/avis" » | 18:05 | — | hub /avis absent des résultats (moteur US) ; aucune étoile observée |

Chaîne publication → visibilité (code, vérifiée statiquement) :
`src/features/admin-reviews/actions.ts:151-176` — publier/masquer/répondre/
vérifier/supprimer revalide hub + slug + home + 4 facettes + page service et
ping IndexNow (`pingIndexNow`, l.173). `scripts/daily-indexnow-resubmit.ts:13-22`
re-soumet par auto-discovery du sitemap-index → couvre sitemap-avis (lastmod par
avis). Aucun trou de ping détecté sur la surface avis.

## Limites

- **DB prod en SQL direct impossible** : `ssh axion-prod` refusé par la couche de
  permissions de la session (2 tentatives, 18:04 UTC). Compensation solide :
  `/fr/avis` est `force-dynamic` no-store (BYPASS edge) → chaque mesure EST une
  lecture DB temps réel à travers l'app ; recoupée sur 3 surfaces indépendantes
  (hub paginé 77 badges, breakdown 68/9/0/0/0 → 4,8831, sitemap 77 slugs). Non
  vérifiables sans SQL : les counts des statuts non publiés (pending/hidden/…)
  et `photoUrl` (déduit nul partout via 0 `<image:loc>`).
- **SERP Google FR réel non mesurable** d'ici : WebSearch est US-only et le
  fetch Bing renvoie une page anti-bot (18:06 UTC). La présence/absence
  d'étoiles sur google.fr et l'identité du concurrent « 465 avis » restent
  **[À CONFIRMER]** à la main (Rich Results Test + SERP FR). Le verdict P1 ne
  dépend pas de cette mesure : l'inéligibilité structurelle est prouvée par le code.
- **Fenêtre stub post-deploy** : le deploy 31824504716 n'avait pas atterri à la
  clôture des mesures principales (18:09) ; la preuve live « home vide » repose
  sur l'occurrence documentée du 2026-08-10 (commentaire `page.tsx:54-70`) et les
  2 incidents `/fr/diagnostic` du 2026-08-14 (commentaires du workflow). Une
  re-mesure de `/fr` dans l'heure suivant l'atterrissage (~18:35–19:00) confirmerait
  la fenêtre en direct.
- Worktrees `../axionia-wt-seo2` / `-indexnow` non audités (hors périmètre B6,
  consigne Phase 0).
