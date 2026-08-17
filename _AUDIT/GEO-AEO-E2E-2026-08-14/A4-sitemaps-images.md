# A4 — Sitemaps images

- **Date/heure** : 2026-08-14, mesures live 17:49–18:08 UTC (avant atterrissage du deploy parti à 17:33 UTC → la prod mesurée = deploy stable atterri ~14:57 UTC).
- **Périmètre couvert** : les 5 routes `sitemap-images-*.xml` (`services`, `blog`, `villes-t1`, `villes-t2`, `villes-t3-t4`), les 2 routes `sitemaps/images-{fr,en}.xml`, les helpers `src/server/image-bank/utils/{villes-sitemap,xml,paths}.ts`, le référencement dans `src/app/sitemap-index.xml/route.ts`, la console `image-bank/sitemap-status`. Échantillonnage live : 18 `<image:loc>` + 16 `<loc>` + headers + escaping XML.

## Résumé exécutif

La surface est **saine dans l'ensemble** : les 7 routes répondent 200, l'index prod liste les 6 sitemaps FR et exclut correctement `images-en.xml` (EN désactivé — normal), les 18 `<image:loc>` échantillonnées sont toutes en 200, zéro `&` non échappé, les volumes villes (40+83+357 = 480) collent exactement à la décision actée « cap ≈480 villes premium », et les 2 bannières génériques villes existent sur disque. Deux vrais problèmes : (1) le `lastmod` de `images-fr.xml` est **pollué par les compteurs de vues** — chaque view/download bumpe `updatedAt` via `@updatedAt`, résultat 288/288 URLs « modifiées » dans les 7 derniers jours → signal de fraîcheur détruit + re-crawl d'inchangé ; (2) `sitemap-images-services.xml` déclare **`<image:license>` CC BY 4.0 sur des photos Unsplash** (secteurs, FAQ, ROI, méthodologie, cas-concrets) qu'Axion-IA n'a pas le droit de sous-licencier — métadonnée mensongère envoyée à Google Images (badge « Licensable »). Le reste est du polish (P2). La console `sitemap-status` est un stub assumé.

## Findings

### [P1] `lastmod` d'`images-fr.xml` pollué par les compteurs de vues — signal de fraîcheur détruit sur 288 URLs

- **Symptôme** : toutes les 288 entrées du sitemap galerie portent un `lastmod` ≤ 7 jours (104 datées du jour même), alors que le contenu éditorial des images n'a pas changé. Google apprend à ignorer le `lastmod` (uniformément « frais » = suspect) et re-crawle de l'inchangé — exactement l'anti-pattern combattu ailleurs (cf. commentaires date-gaming dans `sitemap-index.xml/route.ts:141-152`).
- **Preuve code** :
  - `src/app/sitemaps/images-fr.xml/route.ts:149` — `lastmod = (image.updatedAt ?? image.publishedAt ?? image.createdAt)` ;
  - `src/server/image-bank/services/image-bank.service.ts:373-376` — `trackUsage()` fait `prisma.imageAsset.update({ data: { [counterField]: { increment: 1 } } })` à chaque view/download/embed ;
  - `prisma/schema.prisma:4103` + champ `updatedAt DateTime @updatedAt` du modèle `ImageAsset` (~l. 4246) — tout `update`, y compris un simple incrément de compteur, bumpe `updatedAt`.
- **Preuve live (2026-08-14 18:06 UTC)** : distribution des `lastmod` de `https://axion-ia.com/sitemaps/images-fr.xml` : 104× 2026-08-14, 82× 08-08, 53× 08-07, 32× 08-11, 8× 08-13, 4× 08-09, 3× 08-12, 2× 08-10 — **0 date antérieure au 2026-08-07** sur une galerie de 288 images seedées depuis des mois.
- **Root-cause** : les compteurs analytics dénormalisés (`viewCount`/`downloadCount`/`embedCount`) vivent sur la même ligne que les métadonnées éditoriales ; `@updatedAt` ne distingue pas un incrément de compteur d'une vraie édition. Même une visite de crawler (la route détail appelle le tracking) rafraîchit le `lastmod`.
- **Patch prescrit** (au choix, du moins invasif au plus propre) :
  1. **S** — dans `images-fr.xml/route.ts:149` (et `images-en.xml:130`), baser `lastmod` sur `publishedAt ?? createdAt` (les images seedées ne sont quasi jamais rééditées) ;
  2. **M** — ajouter un champ `contentUpdatedAt` mis à jour uniquement par les actions admin d'édition, et l'utiliser comme `lastmod` ; ou déplacer l'incrément compteur en SQL brut (`UPDATE ... SET view_count = view_count + 1`) qui ne passe pas par `@updatedAt`.
- **Effort** : S (option 1) / M (option 2). **Impact GEO/AEO** : moyen-fort (crawl-budget domaine jeune + crédibilité du signal lastmod sur tout le domaine). **Risque de régression** : faible (option 1 : aucune écriture DB ; ne touche que le calcul du lastmod). **Do-not-touch** : early-exit `stub.invalid` (route l. 84), gating index↔route, `SITEMAP_CACHE_HEADER`.

### [P1] `<image:license>` CC BY 4.0 déclarée sur des photos Unsplash dans `sitemap-images-services.xml` — métadonnée de licence mensongère

- **Symptôme** : les 141 images du sitemap services sont toutes estampillées `<image:license>https://creativecommons.org/licenses/by/4.0/</image:license>`, y compris les photos **Unsplash** (héros secteurs, FAQ, cas-concrets, ROI, méthodologie). La licence Unsplash n'autorise pas la sous-licence en CC BY : Axion-IA déclare à Google Images (badge « Licensable ») un droit de réutilisation qu'elle ne peut pas accorder. Risque juridique (photographes/Unsplash) + signal mensonger dans une surface d'indexation.
- **Preuve code** :
  - `src/app/sitemap-images-services.xml/route.ts:31` (`LICENSE_URL` CC BY) et `:42-47` (émis inconditionnellement pour CHAQUE image du manifeste) ;
  - provenance Unsplash documentée dans le manifeste SSOT `src/lib/seo/page-images.ts:74` (« Photo héro sectorielle Unsplash locale »), `:108` (FAQ), `:142` (cas-concrets « Photos Unsplash curées en AVIF »), `:1442-1445` (ROI, « L'attribution photographe est rendue sur la page (CGU Unsplash §9) »), `:1532` (méthodologie).
- **Preuve live (2026-08-14 18:06 UTC)** : `https://axion-ia.com/sitemap-images-services.xml` → 141 `<image:license>` pour 141 `<image:loc>` ; ex. `/fr/roi` → `illustrations/roi/hero.avif` (« Horloge murale… », photo Unsplash d'après le code) avec `<image:license>…creativecommons.org/licenses/by/4.0/…`.
- **Root-cause** : la constante de licence est globale à la route au lieu d'être une propriété par image dans `PAGE_IMAGES_MANIFEST` ; le manifeste mélange images propriétaires/IA (portrait fondateur, illustrations générées) et photos Unsplash re-hébergées.
- **Patch prescrit** : ajouter `license?: string | null` à l'interface `PageImage` (`page-images.ts:40-62`) ; défaut = CC BY pour les visuels propriétaires/IA, `null` (→ **omettre** la balise) ou `https://unsplash.com/license` pour les photos Unsplash ; adapter `sitemap-images-services.xml/route.ts:42-47` pour n'émettre `<image:license>` que si définie. Vérifier au passage le JSON-LD `ImageObject` du même manifeste (`buildPageImageGraphJsonLd`) — hors périmètre A4, à croiser avec B-squad.
- **Effort** : S. **Impact GEO/AEO** : moyen (badge Licensable mensonger ; risque légal > risque ranking). **Risque de régression** : faible — la balise est optionnelle dans la spec Google ; aucun test ne verrouille cette route (grep `sitemap-images|image:license` dans `*.spec.ts`/`*.test.ts` : 0 résultat). **Do-not-touch** : le rendu `<Image>` des pages et les crédits photographes affichés (CGU Unsplash §9), le reste du manifeste SSOT.

### [P2] URL d'index galerie avec slash final → 308 dans `images-fr.xml`

- **Symptôme** : la 1re `<loc>` du sitemap galerie est `https://axion-ia.com/fr/galerie/` qui redirige 308 vers `/fr/galerie` — un sitemap doit déclarer des URLs finales (GSC classe « Page avec redirection »).
- **Preuve code** : `src/app/sitemaps/images-fr.xml/route.ts:122` (`.../${GALLERY_SEGMENT[LANG]}/`) + `src/server/image-bank/utils/paths.ts:58` (`galleryIndexUrlFor` ajoute `/`). Les alternates hreflang de l'entrée (l. 124-133) portent le même slash.
- **Preuve live (2026-08-14 18:05 UTC)** : `HEAD /fr/galerie/` → **308** → `https://axion-ia.com/fr/galerie` ; `HEAD /fr/galerie` → 200.
- **Root-cause** : slash final codé en dur, `trailingSlash` Next par défaut (false).
- **Patch prescrit** : retirer le `/` final dans `route.ts:122-123` et `paths.ts:58` (+ le miroir `images-en.xml:111-112`). **Effort** : S. **Impact** : faible (1 URL). **Risque** : nul. **Do-not-touch** : `pageUrlFor` (déjà sans slash).

### [P2] `sitemap-images-blog.xml` non gaté anti-vide dans le sitemap-index

- **Symptôme** : l'index gate `/sitemap-blog.xml` sur ≥ 1 URL émise (anti « Balise XML manquante : url » GSC) mais liste `/sitemap-images-blog.xml` **inconditionnellement**. Si la DB rend 0 article (hoquet DB, purge), Google lirait un `<urlset>` vide référencé par l'index — la classe de bug corrigée en 2026-07-06 pour blog/KB/presse/news.
- **Preuve code** : `src/app/sitemap-index.xml/route.ts:297-307` — le filtre traite `knowledge`, `blog`, `presse`, `news`, `news-evergreen`, `images-en` mais pas `images-blog` (listé l. 96) ; `src/app/sitemap-images-blog.xml/route.ts:54-56` — `catch { return [] }` → urlset vide en 200.
- **Preuve live (2026-08-14 17:50 UTC)** : non reproduit (129 URLs émises actuellement) — risque latent, pas un symptôme actif. `[À CONFIRMER]` en condition de panne uniquement.
- **Patch prescrit** : réutiliser `blogEmittableCount` (déjà calculé l. 259-264) : `if (path === "/sitemap-images-blog.xml") return blogEmittableCount > 0;` (approximation saine : mêmes articles source). **Effort** : S. **Impact** : faible. **Risque** : nul. **Do-not-touch** : le fail-soft « jamais 500 l'index ».

### [P2] Console `image-bank/sitemap-status` = stub sans aucune donnée

- **Symptôme** : la page admin promet « Suivi de la déclaration des images aux moteurs de recherche » mais rend `AdminStubPageV2` (écran « n'existe pas encore ») — aucun état réel des 7 sitemaps, volumes, dernier ping.
- **Preuve code** : `src/app/[locale]/(admin)/[adminPrefix]/image-bank/sitemap-status/page.tsx:23-28` ; `src/components/admin/image-bank/AdminStubPageV2.tsx` (stub partagé de 9 sous-pages, documenté comme tel).
- **Preuve live** : non vérifiable en GET anonyme (redirect login) — cohérent avec le code, marqué vérifié côté code seulement.
- **Root-cause** : sous-page Sprint 2.x jamais livrée (connu, ADR 0028 PR 8).
- **Patch prescrit** : soit livrer un écran minimal (fetch des 7 routes + comptes `<loc>`/`<image:loc>` — 1 Server Component), soit retirer l'entrée de nav pour ne pas promettre. **Effort** : M (écran) / S (retrait). **Impact** : faible (outillage interne). **Risque** : nul.

### [P2] Hygiène & dette documentaire (groupé)

1. **`SITE_BASE` codé en dur** : `src/server/image-bank/utils/villes-sitemap.ts:14` (`"https://axion-ia.com"`) au lieu du SSOT `@/lib/site-url` — divergence silencieuse si le domaine change. Patch S : importer `SITE_URL`. (Valeurs identiques en prod aujourd'hui.)
2. **`<image:loc>` non échappé** dans `images-fr.xml/route.ts:180` et `images-en.xml:157` (contrairement à `sitemap-images-blog.xml:84` qui échappe). Les `filePath` sont des slugs contrôlés → 0 `&` non échappé mesuré live (18:06 UTC) sur les 6 fichiers, mais un upload futur avec `&` casserait le XML. Patch S : `escapeXml(imageUrl)`.
3. **Commentaires d'en-tête périmés** : `sitemap-images-villes-t3-t4.xml/route.ts:3-5` annonce « 2034 URLs » alors que le filtre `isVilleIndexable` (cap premium ≈480, décision Will 2026-07-03, `src/content/villes/index.ts:266-288`) en émet 357 — l'écart est VOULU, seul le commentaire ment. Rafraîchir la doc, ne pas toucher au filtre.

## Mesures brutes

Toutes les mesures : GET/HEAD anonymes depuis le poste local, horodatées UTC. Prod mesurée = deploy stable ~14:57 UTC (le run parti 17:33 UTC n'avait pas atterri).

### Sitemap-index (17:49:51 UTC)

`/sitemap-index.xml` → 200, 5 293 B, 0,098 s. Sitemaps images listés : `sitemaps/images-fr.xml`, `sitemap-images-services.xml`, `sitemap-images-blog.xml`, `sitemap-images-villes-t1.xml`, `-t2.xml`, `-t3-t4.xml`. **`images-en.xml` absent = conforme** (EN désactivé, gate `route.ts:305`).

### Les 7 routes (17:50:01 UTC)

| Route | HTTP | `<loc>` | `<image:loc>` | Taille | Attendu |
|---|---|---|---|---|---|
| /sitemaps/images-fr.xml | 200 | 289 | 288 | 310 501 B | 288 images galerie + 1 index ✔ |
| /sitemaps/images-en.xml | 200 | 0 | 0 | 222 B | vide volontaire (`x-sitemap-disabled-reason: en-locale-disabled` confirmé 18:08 UTC) ✔ |
| /sitemap-images-services.xml | 200 | 54 | 141 | 81 295 B | manifeste : 54 pages non vides / 103 entrées (le « 73 images » du commentaire l. 90 de l'index est périmé) |
| /sitemap-images-blog.xml | 200 | 129 | 129 | 87 328 B | articles tier-1 avec featuredImage (dont 3 `/fr/guides/…`) |
| /sitemap-images-villes-t1.xml | 200 | 40 | 40 | 28 033 B | 40 ✔ |
| /sitemap-images-villes-t2.xml | 200 | 83 | 83 | 58 124 B | 83 ✔ |
| /sitemap-images-villes-t3-t4.xml | 200 | 357 | 357 | 250 069 B | 357 (cap premium : 40+83+357 = **480** = décision actée) ✔ |

### Échantillon `<image:loc>` (18 URLs, HEAD, 17:52:35 UTC)

**18/18 → 200.** Dont : 8 images galerie (`/images/*.webp`), 4 services (`/illustrations/*.avif` + Unsplash CDN ×4 → 200), 4 blog (héros Unsplash externes), 2 bannières génériques villes (`axion-ia-formation-acculturation-…` et `…-humaine-augmentee-banniere.webp` → 200 ; fichiers présents dans `public/images/`, vérifié sur disque).

### Échantillon `<loc>` pages (16 URLs, HEAD, 18:04:33 UTC)

15/16 → 200 (galerie détail ×3, blog ×4, services ×4 dont `/fr` et `/fr/un-a-un`, villes ×4 dont `grande-synthe` sans `X-Robots-Tag noindex`). 1/16 → **308** : `https://axion-ia.com/fr/galerie/` → `/fr/galerie` (finding P2, contre-vérifié 18:05:02 UTC).

### Qualité XML / signaux (18:05–18:08 UTC)

- `&` non échappés : 0 sur les 6 fichiers non vides.
- Fuite hreflang EN dans `images-fr.xml` : 0 (`hreflang="en` absent) ✔ gate A-04 opérant.
- Page galerie détail : `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"/>` ✔.
- Headers : `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` + `x-sitemap-tag: image-bank-sitemap` (fr et en), `cf-cache-status: HIT` (fr).
- Distribution `lastmod` images-fr (18:06:49 UTC) : 104× 08-14 / 82× 08-08 / 53× 08-07 / 32× 08-11 / 8× 08-13 / 4× 08-09 / 3× 08-12 / 2× 08-10 → preuve du P1 compteurs.
- `lastmod` images-blog : dates éditoriales plausibles (2026-07-20…) ✔.
- Illustrations secteurs : 10 slugs `CLIENT_SECTORS` = 10 fichiers `public/illustrations/secteurs/*.avif` ✔ ; 51 src uniques du manifeste tous présents sur disque (script node, 0 manquant).

## Limites

- **Console `sitemap-status`** : non vérifiée connecté (admin auth requise, audit-only) — verdict « stub » fondé sur le code seul.
- **Échantillonnage** : 18/1 038 `<image:loc>` et 16/952 `<loc>` testés (GET/HEAD only, machine partagée) — un 404 résiduel hors échantillon reste possible, mais les familles d'URLs sont génériques (2 bannières partagées pour 480 villes, manifeste vérifié à 100 % sur disque).
- **Provenance des 288 images galerie** : la licence CC BY par image vient de la DB (`licenseUrl ?? DEFAULT_LICENSE_URL`) ; je n'ai pas d'accès DB (A4 non autorisé SELECT) pour vérifier si certaines images seedées sont d'origine Unsplash — le P1 licence est scopé au sitemap services où la provenance Unsplash est documentée dans le code. À croiser avec l'agent banque d'images / B-squad (JSON-LD ImageObject du même manifeste).
- **GSC** : impossible de vérifier l'état « Page avec redirection » / « Balise XML manquante » côté Search Console (pas d'accès, pas de soumission autorisée).
- Le deploy en vol (17:33 UTC) n'a pas atterri pendant mes mesures ; les volumes DB-driven (`images-fr`, `images-blog`) pourraient être transitoirement vides ≤ 1 h après ~18:30 UTC — c'est le comportement documenté (routes `force-dynamic`, non affectées par le bake stub), pas un bug.
