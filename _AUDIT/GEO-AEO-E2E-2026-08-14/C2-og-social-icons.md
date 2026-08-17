# C2 — OG / social / icons

- **Date** : 2026-08-14, mesures live 18:03–18:08 UTC (deploy stable de référence : atterri ~14:57 UTC ; le run parti 17:33 UTC n'avait pas encore atterri pendant mes mesures — aucune surface C2 n'est DB-driven, pas d'ambiguïté ISR).
- **Périmètre couvert** : `/api/og` (génération + robots Allow), `opengraph-image.tsx` (racine + ville), câblage `openGraph.images`/`twitter` dans `buildProductMetadata`, og:image des 15 pages stratégiques + 404, articles blog/presse/connaissances (sources d'og:image distinctes), favicon/icon/apple-icon/manifest (code + binaire + live), filet anti-localhost.

## Résumé exécutif

La surface OG/social est **saine sur l'essentiel** : og:image + twitter:image absolues en `https://axion-ia.com` sur 14/15 pages stratégiques (la 15ᵉ, `/fr/interventions`, est un 308 → `/fr/formations`, hors surface C2), 404 incluse ; **zéro localhost** (bug historique : toujours résolu, filet `site-url.ts` en place) ; `Allow: /api/og` présent en prod dans tous les blocs autorisés et verrouillé par un spec ; icônes/manifest tous 200 avec dimensions binaires conformes aux déclarations. Deux vraies pertes : **aucune OG image générée n'est cachée par Cloudflare** (CF `DYNAMIC`, ~2 s de rendu Satori à CHAQUE fetch, y compris la règle `next.config` de `/opengraph-image` neutralisée par un double header contradictoire), et les **og:image des articles blog sont des Unsplash `w=1080`**, sous le plancher Discover 1200 px, avec dimensions déclarées mensongères (1200×630 déclaré partout alors que `/api/og` rend 1200×675). Aucun P0.

## Findings

### [P1] Aucune OG image générée n'est cachée par le CDN — ~2 s de rendu Satori origin à chaque fetch

- **Symptôme** : chaque fetch d'une og:image (`/api/og?title=…`, `/opengraph-image`, OG ville) déclenche un rendu Satori complet sur l'origin (~2 s mesurés, reproductibles au 2ᵉ fetch de la même URL). Avec ~17 500 routes émettant chacune une og:image à titre unique, tout passage de Googlebot-Image, d'un scraper social (LinkedIn/WhatsApp/Slack) ou d'un preview LLM paie 2 s et brûle du CPU origin — sans jamais alimenter le cache CF.
- **Preuve code** :
  - `src/app/api/og/route.tsx:104-376` — la `ImageResponse` est construite sans `ResponseInit`/`headers` : Next émet le défaut `Cache-Control: public, max-age=0, must-revalidate`.
  - `next.config.ts:721-728` — des règles Cache-Control existent pour `/opengraph-image` et `/twitter-image` (86400/604800)… mais **aucune pour `/api/og`**, qui est pourtant l'émetteur de ~100 % des og:image de pages (défaut `buildProductMetadata`, `src/lib/seo.ts:259-261`). Note : la règle `/twitter-image` est morte (aucun fichier `twitter-image.*` dans `src/app`).
  - `next.config.ts:722-724` vs comportement edge : la règle AJOUTE un 2ᵉ header au lieu de remplacer celui de la route.
- **Preuve live** (18:05:59 → 18:07:21 UTC) :
  - `/api/og?title=Test%20cache` : `Cache-Control: public, max-age=0, must-revalidate`, `cf-cache-status: DYNAMIC`, 2ᵉ fetch même URL = 1,96 s (aucun cache).
  - `/opengraph-image` : **deux** `Cache-Control` contradictoires (`public, max-age=86400, s-maxage=604800` PUIS `public, max-age=0, must-revalidate`) → `cf-cache-status: DYNAMIC` — l'intention de cache du next.config est neutralisée.
  - OG ville (`…/grenoble/opengraph-image`) : `max-age=0, must-revalidate`, `cf-cache-status: EXPIRED`.
  - 6 og:image de pages stratégiques testées : toutes 200 image/png en 1,96–2,03 s chacune.
- **Root-cause** : les routes `ImageResponse` (edge) émettent leur propre `Cache-Control` par défaut ; personne ne passe de `headers` au constructeur, et la règle `headers()` de next.config ne REMPLACE pas un header déjà émis par la route — elle s'empile, et CF prend le plus restrictif.
- **Patch prescrit** : passer un `ResponseInit` à `ImageResponse` dans `src/app/api/og/route.tsx` (2ᵉ argument accepte `headers`) : `headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" }` — l'image est déterministe par query string, cacheable sans risque. Idem pour `src/app/opengraph-image.tsx` et l'OG ville (même mécanisme), puis SUPPRIMER les règles next.config `/opengraph-image` + `/twitter-image` devenues redondantes/mortes (source de double header).
- **Effort** : S (3 fichiers, ~10 lignes).
- **Impact GEO/AEO** : moyen-fort — latence de fetch d'image divisée par ~20 pour tous les scrapers sociaux + Googlebot-Image, décharge l'origin CPX42 (17 500 titres uniques), améliore la fiabilité des previews (les scrapers sociaux timeout court).
- **Risque de régression** : faible — un changement de maquette OG mettrait jusqu'à 24 h/7 j à se propager (accepté : la maquette est stable, validée Will 2026-08-13). Do-not-touch : `src/app/robots.ts` (Allow /api/og), `robots.spec.ts`, la maquette elle-même (validée Will).

### [P1] og:image des articles blog = Unsplash `w=1080` — sous le plancher Discover 1200 px, dimensions déclarées fausses

- **Symptôme** : les articles blog avec `featuredImage` émettent en og:image l'URL Unsplash brute de la hero, requêtée en `w=1080`, tout en déclarant `og:image:width=1200`/`og:image:height=630`. 1080 px < plancher Google Discover (1200 px) → articles inéligibles à la grande carte Discover ; les dims déclarées mentent aux scrapers.
- **Preuve code** :
  - `src/app/[locale]/blog/[slug]/page.tsx:126-132` — `featuredImage` passé tel quel comme `ogImage` (aucune réécriture des params Unsplash).
  - `src/lib/seo.ts:329-336` — `width: 1200, height: 630` codés en dur quelle que soit l'image réellement passée.
- **Preuve live** (18:05:03–18:05:27 UTC) : `/fr/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble` → `og:image=https://images.unsplash.com/photo-1582127358359…&w=1080` + `og:image:width=1200` `og:image:height=630` ; l'URL Unsplash répond 200 image/jpeg (146 946 B).
- **Root-cause** : la hero est optimisée pour l'affichage in-page (1080 suffit) et réutilisée telle quelle pour l'OG sans adaptation ; `buildProductMetadata` fige des dims génériques.
- **Patch prescrit** : dans `blog/[slug]/page.tsx`, quand `featuredImage` est une URL Unsplash, réécrire les params pour l'usage OG (`w=1200&h=675&fit=crop`) — le hotlinking reste conforme aux guidelines Unsplash — et faire porter à `buildProductMetadata` un paramètre optionnel `ogImageSize` (défaut 1200×675, cf. P2 ci-dessous) au lieu des valeurs figées.
- **Effort** : S-M (réécriture URL + param optionnel seo.ts + snapshot tests éventuels).
- **Impact GEO/AEO** : moyen — éligibilité Discover des articles (surface de trafic gratuite), previews sociaux plus nets.
- **Risque de régression** : faible — ne toucher que la branche `featuredImage` ; do-not-touch : le fallback `/api/og` (ligne 261 seo.ts), les pages non-blog.

### [P2] `og:image:height` déclaré 630 partout alors que `/api/og` rend 675

- **Symptôme** : toutes les pages passant par `buildProductMetadata` déclarent `og:image 1200×630` alors que l'image servie fait 1200×675 (plancher Discover, choisi explicitement en 2026-05-18). La 404 racine, elle, déclare 675 correctement — le commentaire de `not-found.tsx` documente précisément ce défaut… sans qu'il ait été corrigé dans `seo.ts`.
- **Preuve code** : `src/lib/seo.ts:332-333` (`width: 1200, height: 630`) vs `src/app/api/og/route.tsx:365-368` (« 1200×675 = plancher Google Discover ») et `src/app/opengraph-image.tsx:37-40` ; contraste : `src/app/not-found.tsx:29-39` (aligné 675 avec commentaire explicatif).
- **Preuve live** : 18:03:30 UTC `/fr/formations` → `og:image:height=630` ; 18:07:43 UTC IHDR PNG de `/api/og?title=Test…` = **1200x675** (idem `/opengraph-image`).
- **Root-cause** : le fix « cohérence dimensions » de l'audit GSC 2026-05-18 n'a été appliqué qu'à `not-found.tsx`, pas au SSOT `buildProductMetadata`.
- **Patch prescrit** : `height: 675` dans `seo.ts:333` (et idem `twitter` si des dims y sont un jour ajoutées). Trivial, mais à faire dans la même PR que le patch blog ci-dessus (même bloc).
- **Effort** : S. **Impact GEO/AEO** : faible (les scrapers re-mesurent l'image, mais Facebook/LinkedIn utilisent les dims déclarées pour le premier rendu de partage).
- **Risque de régression** : quasi nul ; do-not-touch : `not-found.tsx` (déjà correct).

### [P2] `opengraph-image.tsx` par-ville : rendu jamais référencé (asset orphelin)

- **Symptôme** : le fichier convention `implantations/[region]/[ville]/opengraph-image.tsx` (carte OG dédiée par ville, audit Will 2026-05-27, ancien design gradient terracotta) génère bien une image en prod… mais AUCUNE page ville ne la référence : le HTML émet l'og:image `/api/og?title=<ville+seoHook>` issue de `buildProductMetadata`. Deux moteurs OG coexistent pour la même route ; l'un est mort.
- **Preuve code** : `src/app/[locale]/implantations/[region]/[ville]/opengraph-image.tsx:1-21` (convention fichier, edge) vs `src/app/[locale]/implantations/[region]/[ville]/page.tsx:184-193` (`buildProductMetadata` sans `ogImage` → défaut `/api/og`, `seo.ts:259-261`).
- **Preuve live** (18:04:06–18:04:42 UTC) : `/fr/implantations/auvergne-rhone-alpes/grenoble` → **1 seul** `og:image` = `/api/og?title=Grenoble%20(38)…` ; pourtant `…/grenoble/opengraph-image` répond 200 image/png 145 366 B (route générée, jamais liée).
- **Root-cause** : en Next 16, l'`openGraph.images` retourné par `generateMetadata` prend le pas ici sur la convention fichier (comportement live constaté) ; la carte `/api/og` refondue 2026-08-13 (maquette validée Will) est devenue la signature unique, laissant la carte ville pré-refonte orpheline.
- **Patch prescrit** : supprimer `implantations/[region]/[ville]/opengraph-image.tsx` (design obsolète pré-maquette 2026-08-13 ; l'og:image `/api/og` par ville porte déjà nom + département + seoHook). Alternative si Will préfère la carte dédiée : passer `ogImage` explicite dans `generateMetadata` — mais c'est l'ancien design, à re-valider. À arbitrer par Will avant patch.
- **Effort** : S (suppression) / M (re-câblage + redesign carte ville sur la maquette 2026-08-13).
- **Impact GEO/AEO** : faible (l'og:image actuelle est correcte et spécifique ; le gain est hygiène + suppression d'une surface edge inutile).
- **Risque de régression** : faible — vérifier qu'aucun sitemap/JSON-LD ne pointe `…/opengraph-image` ville (grep fait : seul `page.tsx:398` pointe `/opengraph-image` RACINE, pas la version ville). Do-not-touch : `src/app/opengraph-image.tsx` (racine, utilisé par la 404 et le JSON-LD Place).

### [P2] Manifest PWA : pas d'icône 512×512, maskable improvisée, apple-touch-icon transparente

- **Symptôme** : (a) aucune icône 512×512 → critères d'installabilité Chrome incomplets, splash screen Android dégradé ; (b) `purpose: "maskable"` recycle `apple-icon.png` qui a déjà une marge autour du cercle terracotta → une fois masquée (cercle 80 % central), le logo apparaît petit ; (c) les deux PNG sont RGBA (color type 6) : sur iOS, l'apple-touch-icon transparente reçoit un fond noir.
- **Preuve code** : `src/app/manifest.ts:29-59` (icônes 192/180/ico, aucune 512, maskable = apple-icon) ; binaires vérifiés localement : `icon.png` IHDR 192×192, `apple-icon.png` 180×180 (marge visible, inspection visuelle faite), color type 6 (alpha) pour les deux ; `favicon.ico` = 3 bitmaps 16/32/48 — conformes aux déclarations manifest (aucun mensonge de sizes, bon point).
- **Preuve live** (18:03:41 + 18:05:27 UTC) : `/manifest.webmanifest` 200 `application/manifest+json` 1 094 B, contenu identique au code ; `/icon.png`, `/apple-icon.png`, `/favicon.ico` tous 200 avec bons content-types ; `<link>` icons présents sur `/fr` (18:05:46 UTC).
- **Root-cause** : jeu d'icônes créé en 2026-05-20 au minimum viable, jamais complété.
- **Patch prescrit** : générer `icon-512.png` (512×512, fond plein ivoire ou terracotta) + une vraie maskable 512×512 avec safe-zone 80 %, les déclarer dans `manifest.ts` ; aplatir le fond de `apple-icon.png` (fond ivoire plein).
- **Effort** : S (2 exports graphiques + 6 lignes manifest).
- **Impact GEO/AEO** : faible (l'installabilité PWA n'est pas un signal de ranking ; hygiène de marque sur mobile).
- **Risque de régression** : quasi nul ; do-not-touch : `favicon.ico` (3 bitmaps corrects), les URLs `/icon.png`/`/apple-icon.png` existantes (réutilisées par ailleurs).

## Vérifications POSITIVES (pas de finding)

| Invariant | Preuve code | Preuve live (UTC) |
|---|---|---|
| `Allow: /api/og` dans tous les blocs autorisés | `src/app/robots.ts:105-112` ; verrou test `robots.spec.ts:88-89` | 18:03:56 — `robots.txt` prod : `Allow: /api/og` ×≥3 |
| Zéro localhost dans les og:image (bug historique 2026-05-15) | filet `src/lib/site-url.ts:42-45` ; hardcode 404 `not-found.tsx:23-26` | 18:05:27 — grep `localhost` = 0 sur `/fr`, `/fr/tarifs`, 404 |
| og:image absolue + twitter:image + `summary_large_image` sur les pages stratégiques | `seo.ts:322-344` ; layout `[locale]/layout.tsx:164` | 18:03:09 — 14/14 pages 200 avec og+twitter absolues (15ᵉ = 308, voir C3) |
| 404 : og:image correcte, noindex, image 200 | `not-found.tsx:25-46` (blog/catchall : noindex explicite `blog/[slug]/page.tsx:100-107`) | 18:03:56 — 404 = `og:image=https://axion-ia.com/opengraph-image?…`, 1200×675 déclaré, `noindex` ; `/opengraph-image` 200 png |
| `/api/og` robuste (edge cases) | `route.tsx:98-102` (fallbacks + slice 140) | 18:05:59 — sans param, titre 500 car, emoji : tous 200 image/png |
| Dimensions réelles 1200×675 (plancher Discover) | `route.tsx:365-368`, `opengraph-image.tsx:33-40` | 18:07:43 — IHDR live : 1200×675 (les deux) |
| Icônes : dims binaires = dims déclarées | `manifest.ts:29-59` | 18:03:41 — 4 assets 200, content-types corrects |

## Mesures brutes

**Pages stratégiques (18:03:09–18:03:30 UTC)** — og:image/twitter:image extraites du HTML prod :

| Page | og:image | Constat |
|---|---|---|
| `/fr` | `/api/og?title=Cabinet IA France…` | OK absolue |
| `/fr/interventions` | — | **308 → /fr/formations** (surface C3) ; la cible porte og complète |
| `/fr/audit`, `/fr/formations`, `/fr/tarifs`, `/fr/methodologie`, `/fr/faq`, `/fr/contact`, `/fr/a-propos`, `/fr/blog`, `/fr/implantations`, `/fr/appel`, `/fr/stack-ia`, `/fr/certification-qualiopi`, `/fr/avis` | `/api/og?title=<titre page>` | OK absolues, twitter:image identiques |
| `/fr/implantations/auvergne-rhone-alpes/grenoble` | `/api/og?title=Grenoble (38)…seoHook` | OK ; convention fichier ville orpheline (P2) |
| `/fr/blog/mentor-ia-dirigeant…` | Unsplash `w=1080` | **P1** sous plancher Discover |
| `/fr/presse/15-millions…`, `/fr/connaissances/kb-fact-roi-ia-050-fr`, `/fr/actualites` | `/api/og?title=…` | OK |
| 404 `/fr/page-inexistante-audit-c2-xyz` | `/opengraph-image` (absolue prod) | OK, noindex |

**Fetch des assets (18:03:41–18:07:43 UTC)** :

| URL | Status | Content-Type | Taille | Temps |
|---|---|---|---|---|
| `/api/og?title=…` (8 titres distincts testés) | 200 | image/png | 199–215 KB | **1,96–2,03 s chacun** |
| `/opengraph-image` | 200 | image/png | 126 873 B | 0,46 s |
| `…/grenoble/opengraph-image` | 200 | image/png | 145 366 B | — |
| `/icon.png` | 200 | image/png | 5 243 B | 0,19 s |
| `/apple-icon.png` | 200 | image/png | 13 642 B | 0,20 s |
| `/favicon.ico` | 200 | image/x-icon | 4 361 B | 0,20 s |
| `/manifest.webmanifest` | 200 | application/manifest+json | 1 094 B | 0,10 s |
| og:image Unsplash blog | 200 | image/jpeg | 146 946 B | — |

**Cache (18:05:59–18:06:27 UTC)** : `/api/og` → `max-age=0, must-revalidate`, CF `DYNAMIC` (2ᵉ hit même URL : 1,96 s) ; `/opengraph-image` → double Cache-Control contradictoire, CF `DYNAMIC` ; OG ville → CF `EXPIRED`.

## Limites

- **Scrapers sociaux réels non testés** (Facebook Sharing Debugger, LinkedIn Post Inspector, Twitter Card Validator exigent login/POST — interdits en audit-only). Les constats se limitent aux meta tags + fetchabilité des images.
- **Échantillon** : 8 URLs `/api/og` sur ~17 500 possibles ; le générateur étant déterministe par query string, l'extrapolation est raisonnable mais pas exhaustive.
- **Rendu visuel** de l'og:image emoji (`🚀`) non inspecté pixel par pixel (200 image/png constaté, mais possible glyphe manquant — le commentaire code interdit les emoji côté maquette, pas côté param `title`).
- **Priorité Next 16 convention-fichier vs `generateMetadata`** : comportement constaté en live (config gagne sur la route ville) mais non tracé dans `node_modules/next/dist/docs` (la doc n'explicite que la précédence entre segments) — le root-cause exact du P2 « ville orpheline » repose sur l'observation, pas sur une spec.
- Déploiement en vol (parti 17:33 UTC) : mes mesures 18:03–18:08 UTC précèdent son atterrissage estimé (18:30–19:00) et reflètent le deploy stable de ~14:57 UTC ; aucune surface C2 n'est DB/ISR-dépendante, donc pas d'impact attendu.
