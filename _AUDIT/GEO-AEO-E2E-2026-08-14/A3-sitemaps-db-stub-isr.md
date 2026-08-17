# A3 — Sitemaps DB-driven & contrat stub/ISR

- **Date** : 2026-08-14, mesures live 17:51–17:58 UTC
- **Contexte deploy** : run GH Actions #31824504716 (17:33 UTC) **encore en job build** au moment des mesures → la prod mesurée reflète le dernier deploy stable atterri ~14:57 UTC (~3 h avant les mesures : toutes les fenêtres ISR 3600 s sont donc passées, les mesures représentent l'état « guéri », pas la fenêtre post-deploy).
- **Périmètre réellement couvert** : les 8 sub-sitemaps DB-driven/custom (`sitemap-blog`, `-presse`, `-knowledge`, `-news`, `-news-evergreen`, `-carrieres`, `-recrutement`, `-avis`), leur gating dans `sitemap-index.xml`, les early-exits `stub.invalid` (prisma/redis/exporters/Dockerfile/workflow), le job `warm` (PR #599) et la couverture de ses **deux listes** (revalidation ISR + purge CF) vs l'inventaire des pages ISR lisant la DB. Hors périmètre : sitemaps images (A4), sitemaps statiques/pSEO (A2), feeds (A5), pings (A6).

## Résumé exécutif

La tuyauterie sitemaps DB-driven est **saine et cohérente** : les 8 routes répondent 200 en < 160 ms, le gating anti-vide de l'index fonctionne exactement comme conçu (sitemap-news vide → absent de l'index ; images-en gaté EN off), les volumes collent à l'état connu (77 avis, 507 KB, 134 blog, 54 offres), et le contrat `stub.invalid` est propagé dans les 6 emplacements requis. **Le trou est ailleurs** : les deux listes du job `warm` (#599) ne couvrent pas **la home `/fr`** (bakée stub à 0 avis, AggregateRating absent ~1–2 h après CHAQUE deploy, et re-figée à l'edge par le warmer lui-même), ni `/fr/blog` ni `/fr/memo-isere`. Deux P1 : `/fr/ressources` n'est déclaré dans AUCUN sitemap, et le flux Google News est éteint depuis ~25 jours (0 actu dans la fenêtre 48 h, dernière actu 2026-07-20).

## Findings

### [P0] La home `/fr` manque aux deux listes du job `warm` — AggregateRating et bloc avis disparaissent ~1–2 h après chaque deploy, et le warmer re-fige la version vide à l'edge

- **Symptôme** : après chaque `git push main` (plusieurs par jour actuellement), la home est resservie dans sa version bakée au build stub : bloc « Nos premiers avis clients arrivent », badge avis vide, **JSON-LD `AggregateRating` absent** (gaté ≥ 5 avis). Fenêtre ~1 h (ISR 3600) côté origin, prolongeable ~1 h de plus côté edge : le step « Warm strategic pages » chauffe `/fr` en premier, AVANT que la home ait été revalidée (elle n'est pas dans la liste), donc il **met en cache Cloudflare la version stub** pour `s-maxage=3600` juste après le `purge_everything`.
- **Preuve code** :
  - `.github/workflows/deploy-coolify.yml:747` — liste revalidation `PATHS='["/fr/actualites","/fr/connaissances","/fr/ressources","/fr/galerie","/fr/diagnostic"]'` : **pas de `/fr`**.
  - `.github/workflows/deploy-coolify.yml:778` — liste purge CF `FILES=[...]` : mêmes 5 URLs, **pas de `/fr`**.
  - `.github/workflows/deploy-coolify.yml:808` — `STRATEGIC="/fr /fr/diagnostic ..."` : `/fr` **est chauffée** (donc re-cachée à l'edge) sans avoir été revalidée.
  - `src/app/[locale]/page.tsx:56-62` — commentaire du 2026-08-10 documentant le constat prod exact (« bloc avis vide, note agrégée absente », `Age: 73960`) ; `page.tsx:70` (`revalidate = 3600`), `page.tsx:120-125` (`getPublishedReviews` + `getAggregateRating`, AggregateRating gaté ≥ 5 avis).
  - Le mécanisme « origin frais, edge vide pendant une heure » est décrit par le patch #599 lui-même pour `/fr/diagnostic` (`deploy-coolify.yml:759-767`) — il s'applique identiquement à `/fr`.
- **Preuve live** (2026-08-14 17:56:24 UTC, ~3 h après le deploy stable de 14:57) : `GET /fr` → `cf-cache-status: HIT`, `Age: 438`, `s-maxage=3600`, JSON-LD `"ratingValue":4.9`, `"reviewCount":77` → état **guéri** hors fenêtre. La fenêtre vide elle-même n'était pas observable pendant ma tranche horaire (prochain atterrissage ~18:30–19:00 UTC), mais elle est attestée par le constat prod horodaté du 2026-08-10 gravé dans le code (`page.tsx:61-62`) et le mécanisme est identique à celui vécu 2 fois le 2026-08-14 sur `/fr/diagnostic` (raison d'être de #599).
- **Root-cause** : #599 a listé `/fr/diagnostic` + 4 hubs, mais l'inventaire « pages ISR lisant la DB » n'a jamais inclus la home (le fix du 2026-08-10 s'était limité à ramener son ISR de 24 h à 1 h au lieu de la revalider post-deploy).
- **Patch prescrit** : ajouter `"/fr"` à `PATHS` (l.747) et `"https://axion-ia.com/fr"` à `FILES` (l.778). L'ordre des steps est déjà correct (revalidate → purge ciblée → warm stratégique) : aucune autre modification.
- **Effort** : S (2 lignes YAML). **Impact GEO/AEO** : fort — c'est la page la plus crawlée du site ; chaque deploy ouvre une fenêtre où Google/les crawlers IA peuvent snapshotter une home sans preuve sociale ni AggregateRating.
- **Risque de régression** : quasi nul (1 POST revalidate + 1 URL de purge en plus, job best-effort jamais bloquant). **Do-not-touch** : le `purge_everything` du job deploy, la magic string `stub.invalid` et ses 6 points de propagation, l'ordre des steps du job `warm`.

### [P1] `/fr/memo-isere` et `/fr/blog` manquent aussi aux deux listes du warm (pages ISR bakées stub/FS-only)

- **Symptôme** : même mécanique que la home, sévérité moindre.
  - `/fr/memo-isere` (landing presse recrutement, priorité 0.9 dans `sitemap-recrutement.xml`) lit les avis en base → bakée à 0 avis au build, resservie vide ≤ 1 h (+ edge) après chaque deploy.
  - `/fr/blog` (hub) : au build stub, listing FS-only — les articles DB tier-1/2 (la quasi-totalité depuis le vidage de `BLOG_POSTS` 2026-07-03) disparaissent du hub ≤ 1 h post-deploy.
- **Preuve code** : `src/app/[locale]/memo-isere/page.tsx:62` (`revalidate = 3600`, pas de `searchParams` → prérendue au build) + `:244,265` (`getPublishedReviews`) ; `src/app/[locale]/blog/page.tsx:7` (« Au build stub.invalid → FS-only, l'ISR repeuple sous 1h ») + `:10-16` (retrait volontaire de `searchParams` → la page est bien BAKÉE, contrairement à `/fr/avis`, `/fr/carrieres`, `/fr/presse` qui restent dynamiques via `await searchParams` — vérifié `avis/page.tsx:63`, `carrieres/page.tsx:83`, `presse/page.tsx:88` : **ces trois-là n'ont PAS besoin d'être listées, ne pas les ajouter**). Listes : `deploy-coolify.yml:747,778`.
- **Preuve live** (17:52–17:56 UTC) : hors fenêtre (3 h post-deploy), pages peuplées — mécanisme prouvé par code + précédents documentés (même classe que le P0).
- **Root-cause** : même inventaire incomplet que le P0 ; `memo-isere` (2026-08-12) et le passage du hub blog en baked (retrait searchParams) sont postérieurs ou contemporains à #599 sans mise à jour des listes.
- **Patch prescrit** : ajouter `"/fr/memo-isere"` et `"/fr/blog"` aux deux listes (mêmes lignes que le P0). Adopter la règle mémoire déjà actée : « toute NOUVELLE page ISR lisant la DB rejoint les DEUX listes ».
- **Effort** : S. **Impact GEO/AEO** : moyen (memo-isere = landing campagne presse ; blog hub = fraîcheur perçue). **Risque de régression** : quasi nul. **Do-not-touch** : idem P0 ; ne pas ajouter `/fr/avis`, `/fr/carrieres`, `/fr/presse` (dynamiques — les ajouter serait du bruit inutile mais pas dangereux).

### [P1] `/fr/ressources` n'est déclaré dans AUCUN sitemap alors qu'il est indexable (et revalidé par le warm)

- **Symptôme** : le hub `/fr/ressources` (hub KB cross-type, avec feeds RSS/JSON déclarés dans son `<head>`) est indexable (metadata standard, pas de noindex) mais absent de `sitemap/pages.xml` et de tous les autres sitemaps → découverte uniquement par maillage interne.
- **Preuve code** : `src/app/[locale]/ressources/page.tsx:24` (`revalidate = 3600`), `:29-47` (`buildProductMetadata` sans noindex, alternates RSS) ; `grep -n "ressources" src/app/sitemap.ts` → **0 occurrence** (aucune trace d'exclusion volontaire ni d'inclusion).
- **Preuve live** (17:57:47 UTC) : `sitemap/pages.xml` contient `/fr/presse`, `/fr/avis`, `/fr/carrieres`, `/fr/blog`, `/fr/actualites`, `/fr/connaissances`, `/fr/galerie`… mais `grep "<loc>…/fr/ressources</loc>"` → 0 ; `grep "fr/ressources"` sur les 9 sitemaps fetchés + pages.xml → 0 partout.
- **Root-cause** : le hub KB-8 n'a jamais été ajouté à la liste statique du builder `pages` de `sitemap.ts` ; incohérent avec le traitement de ses pairs (connaissances, galerie y sont) et avec le fait que le job warm juge cette page assez importante pour la revalider à chaque deploy.
- **Patch prescrit** : ajouter `/ressources` au builder `pages` de `src/app/sitemap.ts` (même famille de lastmod éditorial que les autres hubs). **Cross-ref A2** (propriétaire de `sitemap.ts`) — à dédupliquer avec son rapport.
- **Effort** : S. **Impact GEO/AEO** : moyen (hub d'agrégation KB — point d'entrée de crawl vers 507 entrées). **Risque de régression** : faible ; vérifier seulement que la page n'a pas été omise volontairement (aucune trace de décision trouvée). **Do-not-touch** : le gating anti-vide de l'index, `buildExcludeSlugsByType`.

### [P1] Flux Google News éteint depuis ~25 jours — `sitemap-news.xml` vide (gating OK), dernière actu publiée 2026-07-20

- **Symptôme** : `sitemap-news.xml` émet 0 URL (fenêtre 48 h vide) et est donc — correctement — retiré de l'index. Mais ce n'est pas un creux ponctuel : la plus récente entrée de `sitemap-news-evergreen.xml` (trié par `publishedAt` desc, fenêtre 90 j) porte `lastmod 2026-07-20T06:01:06Z` → **aucun Article `isNews=true` tier-1 publié depuis ~25 jours**. Le canal Google News/Top Stories ne reçoit plus rien ; dans ~65 jours, le sitemap evergreen se videra à son tour.
- **Preuve code** : `src/app/sitemap-news.xml/route.ts:43` (fenêtre 48 h), `:141-166` (`listRecentNewsEntries`, source DB + PRESS_RELEASES) ; `src/app/sitemap-news-evergreen.xml/route.ts:41` (fenêtre 90 j), `:69` (tri `publishedAt desc`).
- **Preuve live** (17:52:37 UTC) : `sitemap-news.xml` → 200, 0 `<loc>` ; absent de `sitemap-index.xml` (cohérence gating ✓) ; `sitemap-news-evergreen.xml` → 32 URLs, top-3 lastmod = 2026-07-20.
- **Root-cause** : hors périmètre A3 — le pipeline de publication d'actualités (content-gen/RSS, cf. fiche mémoire « content-gen orchestrateur+retry » et « crédit Anthropic épuisé → content-gen 100 % OpenAI ») semble arrêté depuis ~2026-07-20. Côté A3, la tuyauterie fait exactement son travail.
- **Patch prescrit** : aucun côté sitemaps. **Escalade au squad content-gen / synthèse** : diagnostiquer pourquoi plus aucune actu n'est publiée depuis le 2026-07-20 (worker BullMQ, crédit API, kill switch OpenAI ?).
- **Effort** : n/a (diagnostic ailleurs). **Impact GEO/AEO** : moyen-fort (fraîcheur = signal majeur AEO ; canal News mort). **Risque de régression** : n/a.

### [P2] `sitemap-avis.xml` : 0 `<image:loc>` sur 77 avis — la capacité image du sitemap est inutilisée

- **Symptôme** : la route émet `<image:image>` quand `photoUrl` est renseigné (`src/app/sitemap-avis.xml/route.ts:34-39,77-80`) ; live (17:52 UTC) : 103 URLs, **0** `<image:loc>` → aucun des 77 avis publiés n'a de photo en base. Pas un bug (code correct), mais un signal Google Images/E-E-A-T non exploité. À rapprocher du squad avis (photos d'avis = chantier contenu, pas code).

### [P2] `export const revalidate` mort sous `force-dynamic` sur 4 routes sitemap

- `sitemap-blog.xml/route.ts:38-39`, `sitemap-knowledge.xml/route.ts:48-49`, `sitemap-presse.xml/route.ts:29-30`, `sitemap-index.xml/route.ts:124-125` : `dynamic = "force-dynamic"` rend `revalidate = 600` inopérant (le cache est en réalité porté par les headers `s-maxage`). Purement cosmétique/trompeur pour le prochain lecteur ; retirer les `revalidate` ou commenter. Effort S, impact faible.

### [P2] Hoquet DB → sub-sitemaps DB-gatés disparaissent transitoirement de l'index

- `sitemap-index.xml/route.ts:248-295` : tous les gates sont fail-soft → sur un restart Postgres (fenêtre migrate deploy), l'index se sert SANS blog/knowledge/news-evergreen/presse pendant ≤ 10 min (s-maxage 600). Comportement volontaire (« ne JAMAIS 500 l'index ») et auto-guérissant — documenté ici pour mémoire, aucun patch prescrit.

## Mesures brutes

Toutes les mesures : 2026-08-14, 17:51–17:58 UTC, prod https://axion-ia.com, deploy stable de référence atterri ~14:57 UTC (run 17:33 UTC encore en build pendant toute la fenêtre de mesure).

| URL | HTTP | Temps | `<loc>` | Détail |
|---|---|---|---|---|
| /sitemap-index.xml | 200 | 0,10 s | 38 sitemaps | news ABSENT (0 entrée ✓), images-en ABSENT (EN off ✓) |
| /sitemap-blog.xml | 200 | 0,08 s | 134 | lastmod max 2026-08-11 (= lastmod index blog 2026-08-11T09:36 ✓), min 2026-06-08 |
| /sitemap-news.xml | 200 | 0,08 s | **0** | urlset vide valide ; cohérent gating index |
| /sitemap-news-evergreen.xml | 200 | 0,08 s | 32 | top lastmod 2026-07-20T06:01 → 0 actu depuis ~25 j |
| /sitemap-knowledge.xml | 200 | 0,13 s | 507 | URLs `/fr/connaissances/kb-*`, top lastmod 2026-08-11 |
| /sitemap-presse.xml | 200 | 0,10 s | 1 | 1 communiqué ; hub /fr/presse couvert par pages.xml ✓ |
| /sitemap-carrieres.xml | 200 | 0,09 s | 55 | 1 hub + 54 offres, images présentes |
| /sitemap-recrutement.xml | 200 | 0,16 s | 3 | lastmod 2026-08-12 (= COMMERCIAL_OFFER_DATE_POSTED ✓, `dates.ts:14`) |
| /sitemap-avis.xml | 200 | 0,12 s | 103 | hub + deposer + **77 avis** (= état connu ✓) + 24 facettes ; 0 `<image:loc>` |
| /sitemap/pages.xml | 200 | — | — | hubs presse/avis/carrieres/blog/actualites/connaissances/galerie ✓ ; **ressources ✗** |
| /sitemap/blog.xml, /sitemap/presse.xml, /sitemap/knowledge-1.xml | 404 | — | — | anciennes routes metadata bien retirées (17:57 UTC) |
| /fr (home) | 200 | — | — | 17:56:24 UTC : cf-cache-status HIT, Age 438, s-maxage=3600, JSON-LD ratingValue 4.9 / reviewCount 77 (état guéri hors fenêtre post-deploy) |

Contrat stub — propagation vérifiée dans les 6 emplacements : `src/lib/prisma.ts:79` (+ Proxy l.22-77), `src/lib/redis.ts:66`, `src/server/exporters/knowledge-rss.ts:42`, `src/server/exporters/knowledge-sitemap.ts:56,245`, `Dockerfile:106-107`, `.github/workflows/deploy-coolify.yml:271-272`. ✓ Intact.

Job warm (`deploy-coolify.yml:714-863`) — liste 1 (revalidate, l.747) = liste 2 (purge CF, l.778) = `{/fr/actualites, /fr/connaissances, /fr/ressources, /fr/galerie, /fr/diagnostic}` : synchrones entre elles ✓, mais incomplètes (cf. P0/P1). Inventaire des pages publiques ISR lisant la DB : couvertes = actualites, connaissances, ressources, galerie (revalidate 60), diagnostic ; **manquantes et bakées** = `/fr`, `/fr/blog`, `/fr/memo-isere` ; non concernées (dynamiques via `await searchParams`) = `/fr/avis`, `/fr/carrieres`, `/fr/presse` ; non concernées (params on-demand, rendu runtime DB réelle) = toutes les pages `[slug]` (actualites, connaissances, galerie, presse, avis, equipe).

## Limites

- **DB prod inaccessible pendant l'audit** : `docker exec … psql` via `ssh axion-prod` a été bloqué par le classifieur de permissions (3 tentatives, y compris SELECT count read-only). Les cohérences sitemap↔DB sont donc établies indirectement : 77 avis = état connu vérifié 2026-08-14 (✓ exact), 507 KB / 134 blog / 54 offres / 1 communiqué non recomptés en SQL. Le P1 « news éteint » s'appuie sur l'inférence evergreen (tri publishedAt desc) — un `SELECT MAX(publishedAt) FROM "Article" WHERE "isNews"` confirmerait en 5 s.
- **La fenêtre post-deploy vide n'a pas été observée en direct** : mes mesures tombent ~3 h après le dernier deploy stable (ISR guéri) et avant l'atterrissage du run en vol (~18:30–19:00 UTC). Le P0 s'appuie sur le mécanisme prouvé au code + le constat prod horodaté du 2026-08-10 documenté dans `page.tsx:61-62` + le double incident /fr/diagnostic du 2026-08-14 documenté dans le YAML. Re-mesurer `/fr` entre l'atterrissage et l'atterrissage+1 h (grep `reviewCount` absent) apporterait la preuve live directe.
- Pré-rendu effectif au build : l'affirmation « bakée » vs « dynamique » repose sur l'analyse statique (`await searchParams` ⇒ dynamique, confirmée par les commentaires internes du repo) — pas de `pnpm build` local (interdit par les règles d'audit) pour lire le route manifest.
- Worktrees `../axionia-wt-*` non audités (règle Phase 0, hors mandat A3).
