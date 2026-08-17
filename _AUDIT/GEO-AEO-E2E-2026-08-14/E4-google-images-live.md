# E4 — Google Images live

- **Date / heure** : mesures live du **2026-08-14 22:39 UTC** au **2026-08-15 00:43 UTC**.
- **Fenêtre de déploiement** : dernier deploy atterri ~19:50 UTC, **aucun deploy en vol** depuis ~20:00 UTC. Toutes mes mesures sont donc **hors fenêtre post-deploy** : un volume vide aurait été une anomalie réelle (aucun n'a été constaté — les 6 sitemaps images sont pleins).
- **Périmètre réellement couvert** : (1) état de soumission des sitemaps images côté GSC et **instrumentation** de la performance en recherche d'images ; (2) probes live d'index-images (`site:axion-ia.com` sur Google Images, Bing Images, DuckDuckGo, Brave Images) ; (3) confrontation **URL déclarées (`<image:loc>`, JSON-LD `contentUrl`, `og:image`) vs URL réellement indexées** ; (4) étanchéité du `Disallow: /logos/clients/` (y compris tentative de contournement par l'optimiseur `next/image`) ; (5) risque d'indexation parasite des `og:image` ; (6) prérequis techniques d'indexation image (robots meta, accès Googlebot-Image, négociation de format, en-têtes).
- **Hors périmètre** (couvert ailleurs, recoupé en § Recoupements) : contenu/validité XML des sitemaps images (A4), alt-texts & `ImageObject` (E2), qualité visuelle & conformité Unsplash (E3), dimensions/cache `og:image` (C2), chaîne OAuth GSC (F2).

## Résumé exécutif

Aucun P0 : les images **sont** crawlables et **sont** indexées — la preuve live la plus forte de cet audit est un index-images tiers (Brave) qui renvoie 44 résultats, tous rattachés à `axion-ia.com`, sans le moindre challenge anti-bot sur `Googlebot-Image`. Les correctifs robots de juin (`Allow: /_next/image`, `Allow: /api/og`) ont bien tenu, et le `Disallow: /logos/clients/` est **hermétique** (l'optimiseur refuse le SVG en 400 : aucun contournement possible) — zéro logo client, zéro `og:image` dans l'index-images échantillonné. Trois pertes réelles. **(1)** Personne ne mesure Google Images : aucune requête GSC du dépôt ne pose `type: "image"` (défaut = `web`), donc la question « que remonte `site:axion-ia.com` en images ? » est **structurellement** sans réponse côté Axion — et le seul canal restant (SERP) est fermé par l'anti-bot. **(2)** Les 129 entrées du sitemap images blog pointent **toutes** vers `images.unsplash.com` : la valeur d'indexation image du plus gros corpus éditorial est cédée à un hôte tiers, alors que les mêmes visuels sont déjà servis depuis `axion-ia.com` par l'optimiseur. **(3)** L'URL réellement indexée n'est **jamais** celle déclarée : 40/40 originaux hébergés axion-ia dans l'index live sont des `/_next/image?url=…`, **0** correspond à un `<image:loc>` — les sitemaps images déclarent des URLs que les index ne retiennent pas.

## Findings

### [P1] Zéro instrument ne mesure la recherche d'images : `type: "image"` n'est demandé nulle part, tout le pilotage GSC est aveugle aux images

- **Symptôme** : la mission « que remonte Google Images ? » n'est pas répondable avec les instruments existants. L'API GSC `searchAnalytics` segmente par `type` (`web` | `image` | `video` | `news` | `discover` | `googleNews`) ; **aucun** appel du dépôt ne pose ce champ, donc **tous** les exports et workers retombent sur le défaut `type: "web"`. Résultat : les 480 pages villes, les 288 pages galerie et les 129 articles à visuel sont pilotés sur des métriques qui **excluent par construction** les impressions et clics Google Images. Les 14 lignes « galerie » du dernier export hebdo (W33, 36 impressions, 0 clic) sont des impressions **web**, pas image — elles ne disent rien de la surface image.
- **Preuve code** :
  - `scripts/perf/export-gsc-crawl-stats.mjs:104-113` — corps de requête complet : `{ startDate, endDate, dimensions: ["page"], rowLimit: 1000, dataState: "all" }`. Pas de `type` → `web` par défaut.
  - `src/server/content-gen/seo/gsc-client.ts:139` (`dimensions: ["query"]`), `:232-238` (agrégat page-level, `rowLimit: 1`) — mêmes requêtes, **aucun** `type`.
  - Grep dépôt : `grep -rn "searchType\|type: \"image\"" scripts/ src/server/content-gen/seo/ src/server/queue/workers/` → **0 occurrence** liée à la recherche (les 2 hits, `scripts/enrich-images.cjs:115` et `scripts/enrich-seeded-images.mts:153`, sont des blocs `type: "image"` de l'API vision Anthropic, sans rapport).
  - Conséquence en aval : `src/server/queue/workers/site-route-gsc-worker.ts:75` (400 URLs/nuit) alimente les décisions de tier avec des métriques web uniquement.
- **Preuve live (horodatée)** : toutes les voies externes de substitution sont fermées le 2026-08-15 :
  - `www.google.com/search?q=site:axion-ia.com&tbm=isch` → **302** vers `…&udm=2` (00:42:16 UTC) ; suivi de la redirection → **200 / 91 917 B mais 0 balise `<img>`, 0 vignette `encrypted-tbn`, 1 seule occurrence de « axion-ia.com » (l'écho de la requête)** — coquille JS, aucun résultat exploitable (00:42:26 UTC). Idem via WebFetch (00:36 et 00:37 UTC) : page « Si vous avez des difficultés à accéder à la recherche Google… ».
  - `bing.com/images/search?q=site:axion-ia.com` (00:36 UTC) → résultats **hors-sujet** (miniatures YouTube sans rapport) = anti-bot, cohérent avec F2.
  - `html.duckduckgo.com` (00:36 UTC) → CAPTCHA « Select all squares containing a duck ».
- **Root-cause** : l'export hebdo a été écrit pour répondre à une question web (dilution/position), et le paramètre `type` n'a jamais été considéré ; s'y ajoute le fait que la seule surface d'observation GSC restante (UI Search Console, filtre « Type de recherche : Image ») n'est consultable que manuellement et n'a jamais été relevée dans un rapport.
- **Patch prescrit** : dans `scripts/perf/export-gsc-crawl-stats.mjs`, **dupliquer** l'appel `fetchTopPages()` avec `type: "image"` et écrire un second CSV (`search-perf-image-YYYY-WW.csv`, mêmes colonnes). Le token actuel suffit : le scope `webmasters.readonly` déjà en place couvre `searchAnalytics.query` — **ce patch n'est PAS bloqué par la panne OAuth write de F2**, c'est le seul levier images actionnable immédiatement. Ajouter les 3 lignes d'agrégat au rituel hebdo (impressions image, position moyenne image, top 10 pages image).
- **Effort** : S (≈ 30 lignes, même script, même secret).
- **Impact GEO/AEO** : moyen-fort — sans cette mesure, aucune des recommandations images de cet audit (E1→E4) ne pourra jamais être **vérifiée** ; Google Images et Lens sont par ailleurs des surfaces d'entrée AEO en croissance.
- **Risque de régression** : quasi nul (nouvel appel read-only, fail-soft à copier du bloc existant). Attention : le workflow `gsc-crawl-stats-weekly.yml` committe le résultat — ajouter le nouveau fichier au `git add` sinon le job réussit sans rien produire (piège « garde qui ne garde rien »). **Do-not-touch** : la requête `web` existante et le nom des CSV historiques W21→W33 (continuité de l'historique, cf. F2-P2), `src/server/content-gen/seo/gsc-client.ts` (flux OAuth runtime distinct).

### [P1] Les 129 `<image:loc>` du sitemap blog pointent tous vers `images.unsplash.com` — la valeur d'indexation image du corpus éditorial est cédée à un hôte tiers

- **Symptôme** : `sitemap-images-blog.xml` déclare 129 images pour 129 articles ; **129/129 sont hébergées sur `images.unsplash.com`** (102 fichiers distincts). Or ces mêmes visuels sont **déjà servis depuis `axion-ia.com`** dans le DOM des articles, via l'optimiseur (`/_next/image?url=https%3A%2F%2Fimages.unsplash.com%2F…`). Le sitemap déclare donc systématiquement la copie **non attribuable au domaine** et tait celle qui l'est. Pour un index-images, l'image reste une photo de stock Unsplash mutualisée par des milliers de sites : dédoublonnage quasi certain au profit de l'original, différenciation nulle, et le domaine ne capitalise rien.
- **Preuve code** :
  - `src/app/sitemap-images-blog.xml/route.ts:59-62` — `absoluteImage()` : `return src.startsWith("http") ? src : SITE_URL + src` → **toute URL externe est recopiée telle quelle** ; comportement documenté et assumé l. 12-13 (« Image absolue : URL externe (héros Unsplash) telle quelle »).
  - `src/app/sitemap-images-blog.xml/route.ts:73` (`const imageUrl = absoluteImage(a.featuredImage)`) et `:84` (`<image:loc>${escapeXml(imageUrl)}</image:loc>`).
  - Côté rendu, la même image passe par l'optimiseur du domaine : `next.config` `images.remotePatterns` autorise `images.unsplash.com` (bloc `images:` l. 142-155), donc `next/image` réécrit en `/_next/image?url=https%3A%2F%2Fimages.unsplash.com%2F…`.
- **Preuve live (horodatée)** :
  - 2026-08-15 00:39:52 UTC — `GET /sitemap-images-blog.xml` → 200, 87 328 B ; comptage : **129 `<image:loc>`, 102 distincts, 102/102 sur `images.unsplash.com`**, 0 sur `axion-ia.com`.
  - 2026-08-15 00:40:49 UTC — `GET /fr/blog/formation-ia-clermont-ferrand-guide-complet` → 200 : le DOM sert 6 visuels en `/_next/image?url=https://images.unsplash.com/photo-…` (**hôte axion-ia.com**) ; l'`og:image`, lui, pointe en direct sur `https://images.unsplash.com/photo-1486312338219…&w=1080`.
  - 2026-08-15 00:37 UTC — index-images live (Brave, `site:axion-ia.com`, page 1) : sur 44 résultats, **4 ont `original` = `images.unsplash.com/photo-…`** avec `source: "axion-ia.com"` comme page d'atterrissage (ex. `photo-1740818576358-7596eb883cf3`, `page_fetched: 2026-07-30T09:21:22Z`). Autrement dit le sitemap **a bien fonctionné** — il a fait indexer la copie tierce.
- **Root-cause** : la fonction `absoluteImage()` a été pensée pour la robustesse d'URL (absolutiser un chemin relatif), pas pour la stratégie d'indexation ; la production de contenu (arrêtée depuis le 2026-07-20) hotlinke Unsplash pour les héros au lieu de re-héberger comme le fait le manifeste services (`/illustrations/**`, 0 URL externe sur 80 images distinctes — voir Mesures brutes).
- **Patch prescrit**, du moins invasif au plus durable :
  1. **S** — dans `route.ts:59-62`, quand `src` est externe et que l'hôte est autorisé par `remotePatterns`, émettre l'URL **servie par le domaine** : `${SITE_URL}/_next/image?url=${encodeURIComponent(src)}&w=1200&q=75`. Crawlable (`Allow: /_next/image` en place, `robots.ts:110`), sur le domaine, et **identique à ce que le DOM affiche** (règle le finding suivant du même coup pour le blog).
  2. **M / durable** — re-héberger les héros d'articles sous `public/images/blog/**` (aligne blog sur le pattern services, supprime la dépendance CDN tierce, et permet un vrai nommage SEO — croiser avec E3-P1 « héros Unsplash hors-sujet + alt anglais » : la même PR devrait traiter le fond).
- **Effort** : S (option 1) / L (option 2, ré-hébergement de 102 fichiers + migration DB `featuredImage`).
- **Impact GEO/AEO** : moyen-fort sur la surface image (129 URLs = 100 % du corpus blog déclaré), faible sur le web.
- **Risque de régression** : option 1 = faible, mais **vérifier** que la route optimiseur répond bien sur des URLs Unsplash avec query-string encodée (mesuré OK en DOM, 200) et **ne pas** émettre `w=3840` (poids). Option 2 : touche à la DB `Article.featuredImage` → coordination avec D-squad. **Do-not-touch** : `escapeXml()` (`src/server/image-bank/utils/xml.ts`), l'early-exit `stub.invalid` (`route.ts:35`), le `catch { return [] }` fail-soft (`:54-56`), la doctrine crédits photographe affichés en page (CGU Unsplash §9).

### [P2] L'URL indexée n'est jamais l'URL déclarée : 40/40 originaux `axion-ia.com` de l'index-images sont des `/_next/image?url=…`, aucun `<image:loc>`

- **Symptôme** : pour une même image, le site publie **trois** URL différentes — `<image:loc>` et `ImageObject.contentUrl` et `og:image` en chemin brut (`/images/x.webp`), mais le `<img>` du DOM en `/_next/image?url=%2Fimages%2Fx.webp&w=3840&q=75` (+ 8 variantes `srcset`). Les index-images retiennent **l'URL du DOM**. Les 1 038 déclarations `<image:loc>` ne sont donc pas les URLs qui rankent, et les métadonnées qui y sont accrochées (`image:title`, `image:caption`, `image:license`, `image:geo_location`) portent sur une URL que l'index ne retient pas — indépendamment du fait que Google ait de toute façon déprécié ces balises (cf. E2-P2).
- **Preuve code** : le comportement est **connu et documenté** dans le dépôt : `src/app/robots.ts:59-66` — « CAUSE RACINE "0 image dans Google Images" […] Google Images indexe en priorité l'`<img>` du DOM hôte, pas seulement le `<image:loc>` du sitemap ». C'est ce constat qui a motivé `Allow: /_next/image` (`robots.ts:110`). Le correctif a rétabli la crawlabilité mais **personne n'a réaligné les sitemaps** sur l'URL réellement rendue. Côté émission : `src/app/sitemaps/images-fr.xml/route.ts:180`, `src/app/sitemap-images-blog.xml/route.ts:84`, `src/server/image-bank/utils/villes-sitemap.ts:46` — tous en chemin brut.
- **Preuve live (2026-08-15 00:37 UTC)** : index-images Brave, `site:axion-ia.com`, page 1 → 44 résultats, `source` = `axion-ia.com` pour 44/44. Répartition des `original` : **40 sur `axion-ia.com` — 100 % en `/_next/image?url=…`, 0 en chemin brut** ; 4 sur `images.unsplash.com`. Sous-dossiers des 40 : `/images/` ×32, `/illustrations/` ×5, `/villes-hero/` ×2, `/logos/` ×1. Croisement automatisé : 29 des 40 chemins sous-jacents figurent bien dans un `<image:loc>` — mais **aucun n'est indexé sous la forme déclarée**.
  Confirmation côté page (00:38:20 UTC, `/fr/galerie/axion-ia-equipe-ia-service-humain-12-personnes-photo-groupe`) : `og:image` = `…/images/…-photo-groupe.webp`, JSON-LD `contentUrl` = même chemin brut (+ un `-thumb.webp`), mais le `<img>` = `/_next/image?url=%2Fimages%2F…-photo-groupe.webp&w=3840&q=75` avec 8 largeurs en `srcset` (640→3840).
- **Root-cause** : deux producteurs d'URL indépendants (le manifeste/sitemap d'un côté, `next/image` de l'autre) sans SSOT commun.
- **Patch prescrit** : faire émettre aux sitemaps images l'URL **telle que rendue**. Le plus propre : un helper unique `renderedImageUrl(path, width = 1200)` dans `src/lib/image-utils.ts` (déjà le foyer d'`OG_VARIANT`, l. 35), utilisé par les 3 routes émettrices **et** par le `contentUrl` du JSON-LD. Variante minimale (recommandée en premier) : n'appliquer le changement qu'au sitemap blog (patch précédent) et **mesurer** l'effet via le nouveau CSV image avant de généraliser aux 909 autres déclarations.
- **Effort** : S (blog seul) / M (généralisation + snapshots JSON-LD à régénérer).
- **Impact GEO/AEO** : faible-moyen — les images sont déjà indexées via le DOM ; le gain est la consolidation des signaux et l'arrêt du gaspillage de crawl sur des URLs jamais retenues.
- **Risque de régression** : **réel** si généralisé d'un bloc — les snapshots JSON-LD (`__snapshots__` de la squad B) et le spec galerie casseraient, et l'on créerait transitoirement des doublons d'index (ancienne + nouvelle URL). D'où la recommandation « blog d'abord, mesure ensuite ». **Do-not-touch** : `robots.ts` (les 3 `Allow` `/api/og`, `/_next/image`, `/_next/static` sont verrouillés par `robots.spec.ts:88-91` et conditionnent toute la surface), `src/lib/site-url.ts`.

### [P2] 480 pages villes déclarent **2** images génériques (478 doublons) pendant que les 58 vraies photos hero ne sont déclarées nulle part — confirmation index-side de E3-P1

> **Ne pas compter deux fois** : le défaut appartient à **E3-P1** (« l'image déclarée n'est PAS celle rendue »). Je n'ajoute ici que la quantification et la **preuve par l'index**, qui tranche le débat sur la priorité.

- **Symptôme / quantification (live 2026-08-15 00:39:52 UTC)** : `sitemap-images-villes-t1.xml` (40 URLs), `-t2.xml` (83), `-t3-t4.xml` (357) = **480 déclarations pour 2 images distinctes** — `axion-ia-formation-acculturation-ia-tpe-pme-eti-2026-photo-banniere.webp` (478 URLs, t1+t2+t3) et `…-humaine-augmentee-banniere.webp` (t4). Aucune ne contient de `/villes-hero/` (grep sur les 6 fichiers : 0 hit), alors que `public/villes-hero/` contient **177 fichiers** (58 villes × AVIF/WebP/JPG) réellement rendus par `src/app/[locale]/implantations/[region]/[ville]/page.tsx:524-528`.
- **Preuve code** : `src/server/image-bank/utils/villes-sitemap.ts:17-20` (les 2 slugs génériques) et `:46` (`const imgUrl = SITE_BASE + "/images/" + imageSlug + ".webp"`, jamais la photo de la ville).
- **Preuve live (index)** : Brave Images a indexé `/_next/image?url=/villes-hero/perpignan.avif` et `…/montelimar.avif` — **les vraies photos, trouvées dans le DOM** — et **aucune** des 2 bannières génériques déclarées 480 fois. L'index confirme donc que la déclaration générique n'apporte rien et que le crawl DOM fait déjà le travail sur les 58 villes équipées.
- **Patch prescrit** : celui d'E3-P1 (déclarer `/villes-hero/{slug}` quand `hero-images-map.ts` le connaît, garder la bannière générique en repli pour les autres). Ajout E4 : les 422 villes sans photo dédiée gagneraient plus à **ne rien déclarer** qu'à déclarer 422× la même image (une image dupliquée sur 422 pages n'a aucune chance en recherche d'images et dilue le crawl).
- **Effort** : S. **Impact** : faible-moyen. **Risque** : faible ; **do-not-touch** : le cap premium ≈480 villes (`src/content/villes/index.ts:266-288`, décision actée), `isVilleIndexable`.

### [P2] 27 articles partagent leur visuel avec un autre article (129 déclarations pour 102 images distinctes)

- **Symptôme** : dans `sitemap-images-blog.xml`, 129 `<image:loc>` pour **102 fichiers distincts** → 27 articles réutilisent une photo déjà attribuée à un autre article. Même phénomène, plus marqué, sur le sitemap services : **141 déclarations pour 80 images distinctes** (61 réutilisations inter-pages, normal pour un manifeste de gabarits, mais qui plafonne pareillement la valeur image). En recherche d'images, une même photo ne peut pas être « l'image » de deux pages concurrentes : Google en choisit une.
- **Preuve code** : `src/app/sitemap-images-blog.xml/route.ts:37-53` — la requête ne déduplique ni ne contrôle l'unicité de `featuredImage` ; le pool d'héros est un pool Unsplash partagé par la génération de contenu.
- **Preuve live (2026-08-15 00:39:52 UTC)** : comptage automatisé sur les fichiers prod — blog 129 occurrences / 102 distincts ; services 141 / 80 ; galerie 288 / 288 (**parfait**, aucune duplication) ; villes 480 / 2.
- **Root-cause** : sélection de héros par mot-clé sur l'API Unsplash sans registre d'unicité (production arrêtée depuis le 2026-07-20 — le stock actuel est figé).
- **Patch prescrit** : au moment où la génération de contenu redémarrera, tenir un registre des `featuredImage` déjà utilisées et refuser un doublon (gate côté générateur, pas côté sitemap). Dans l'immédiat, aucun correctif d'urgence : le sitemap **doit** refléter la page.
- **Effort** : S (gate) — mais dépend du redémarrage de la génération. **Impact** : faible. **Risque** : nul. **Do-not-touch** : ne surtout pas « dédoublonner » côté sitemap en masquant des URLs : le sitemap doit décrire la réalité de la page.

## Points vérifiés SAINS (anti-faux-positifs pour la synthèse)

| Vérification | Verdict | Preuve |
|---|---|---|
| **Logos clients hors index images** (doctrine brand-fix 2026-06-20) | ✅ **hermétique** | `robots.ts:36-43` (`Disallow: /logos/clients/`) + prod (22:39:34 UTC). Les 17 logos sont des **SVG** (`src/content/home-data.ts:50-111`, 17/17 `.svg`, 17 fichiers sur disque) rendus **hors optimiseur** : DOM home = `src="/logos/clients/jardiland.svg"` (22:40:07 UTC). Tentative de contournement testée : `GET /_next/image?url=%2Flogos%2Fclients%2Fjardiland.svg&w=256` → **400 « image type is not allowed »** (00:36:14 UTC) → l'`Allow: /_next/image` **ne peut pas** servir de porte dérobée. Index live : **0 occurrence** de `logos/clients` dans les 44 résultats Brave. |
| **`og:image` indexées par erreur ?** | ✅ **non constaté** | `/api/og` : **0 occurrence** dans les 44 résultats de l'index-images (00:37 UTC) ; **0 occurrence** de `api/og` et d'`opengraph-image` dans les 6 sitemaps images (00:39 UTC) → aucune og:image n'est *déclarée* pour indexation. L'`Allow: /api/og` (`robots.ts:107`) reste requis (décision actée n°2) et n'a produit aucune pollution mesurable. |
| **`max-image-preview:large`** (obligatoire UE pour les grandes vignettes) | ✅ présent partout | `<meta name="googlebot" content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1">` sur `/fr`, `/fr/implantations/guadeloupe`, `/fr/blog/…` (22:40 / 00:40 UTC) — émis par `src/lib/seo.ts:347-358` et `src/app/[locale]/layout.tsx:166-177` ; les pages galerie le portent directement dans `name="robots"` (`galerie/page.tsx:107`, `galerie/[slug]/page.tsx:128`). Le `<meta name="robots">` générique sans la directive n'est **pas** un défaut : Googlebot applique la balise la plus spécifique. |
| **Accès `Googlebot-Image` non challengé par Cloudflare** | ✅ | `GET /images/axion-ia-hero-ville-nantes-….webp` avec UA `Googlebot-Image/1.0` → **200 image/webp**, `cf-cache-status: REVALIDATED` (22:41:07 UTC) ; `GET /fr/galerie` avec UA `Googlebot/2.1` → 200 (idem). Aucun challenge, aucun 403. |
| **Négociation de format par l'optimiseur** | ✅ | `/_next/image?…&w=1200&q=75` avec `Accept: image/avif,image/webp` → **200 image/avif, 100 714 B** (22:41 UTC). Sans en-tête `Accept`, repli **image/jpeg 202 819 B** — comportement normal, sans impact bot (Googlebot-Image envoie `Accept` AVIF/WebP). |
| **Les 6 sitemaps images répondent et sont pleins** hors fenêtre post-deploy | ✅ | 00:39:52 UTC : `images-fr` 310 501 B, `services` 81 295 B, `blog` 87 328 B, `villes-t1/t2/t3-t4` 28 033 / 58 124 / 250 069 B — tous 200, volumes identiques à ceux mesurés par A4 à 17:50 UTC (aucune régression liée aux deploys de 18:26 et 19:50 UTC). |
| **Galerie : 288 images, 288 URLs uniques** | ✅ | aucune duplication d'image dans `images-fr.xml` (00:39 UTC) — le corpus le mieux formé du site pour la recherche d'images. |
| **Images indexables sans en-tête bloquant** | ✅ | aucun `X-Robots-Tag` sur les 6 assets testés (webp/avif/svg/png/optimiseur/`/api/og`), `x-content-type-options: nosniff` partout, `Content-Type` correct (22:40:48 UTC). |

## Recoupements (déjà couvert ailleurs — ne pas recompter dans le scoring)

- **F2-P1 / F2-P2** : les sitemaps images n'ont **jamais** été soumis en GSC (3 échecs le 2026-05-20, aucun cron, token OAuth `readonly`), et la liste de soumission ne couvre que 4 des 6 sitemaps images. Mon apport : ce n'est **pas** le facteur bloquant de la visibilité images — les 6 sitemaps sont référencés dans `sitemap-index.xml` (donc découvrables) et l'index-images live prouve que le crawl a lieu. La soumission reste utile pour **la vérification** (rapport « Sitemaps » GSC), pas pour la découverte. Priorité : après le P1 mesure.
- **A4-P1** : `lastmod` d'`images-fr.xml` pollué par les compteurs de vues ; `<image:license>` CC BY sur des visuels d'origine Unsplash. Précision E4 : les 80 images distinctes du sitemap services sont **toutes hébergées sur `axion-ia.com`** (`/illustrations/**`, 0 URL externe) — le problème y est juridique (licence déclarée), pas d'attribution d'hôte ; c'est le **blog** qui hotlinke (129/129).
- **E2** : `image:title` / `caption` / `license` dépréciés par Google ; `acquireLicensePage` → `/fr/cgu` en 404 sur 141 `ImageObject`. Renforce mon P2 « URL déclarée ≠ URL indexée » : les métadonnées accrochées à ces URLs valent doublement peu.
- **E3-P1** : image déclarée ≠ image rendue sur les pages villes → **confirmé par l'index** (voir mon P2 ci-dessus).
- **C2-P1 / C2-P2** : `og:image` blog en Unsplash `w=1080` (< plancher Discover 1200) et dimensions déclarées 1200×630 alors que `/api/og` rend 1200×675 — **je confirme sans re-compter** : PNG live `/api/og?title=Cabinet IA France` = **1200×675, 201 690 B** (00:39:11 UTC) ; og:image blog live = `images.unsplash.com…w=1080`, JPEG réel **1080×719** contre 1200×630 déclarés (00:41:30 UTC). Les deux valeurs déclarées sont fausses (largeur **et** hauteur), pas seulement la hauteur.
- **F2-P0** : drainage de visibilité web (position 22,2 → 25,5). Non lié à la surface image, mais explique pourquoi les pages galerie captent 36 impressions web pour 0 clic en W33.

## Mesures brutes

Toutes les mesures : GET/HEAD anonymes depuis le poste local (sauf mention d'UA), horodatage UTC. Aucun POST, aucune soumission.

### Composition des 6 sitemaps images (2026-08-15 00:39:52 UTC)

| Sitemap | HTTP | Octets | `<image:loc>` | Images distinctes | Hôte tiers | Doublons |
|---|---|---:|---:|---:|---:|---:|
| `/sitemaps/images-fr.xml` | 200 | 310 501 | 288 | **288** | 0 | 0 |
| `/sitemap-images-services.xml` | 200 | 81 295 | 141 | 80 | 0 | 61 |
| `/sitemap-images-blog.xml` | 200 | 87 328 | 129 | 102 | **102 (100 %)** | 27 |
| `/sitemap-images-villes-t1.xml` | 200 | 28 033 | 40 | **1** | 0 | 39 |
| `/sitemap-images-villes-t2.xml` | 200 | 58 124 | 83 | **1** | 0 | 82 |
| `/sitemap-images-villes-t3-t4.xml` | 200 | 250 069 | 357 | **2** | 0 | 355 |
| **Total** | — | 815 350 | **1 038** | **470** | 102 | 568 |

Occurrences par hôte (toutes déclarations confondues) : `axion-ia.com` 909, `images.unsplash.com` 237 (129 blog + 108 réutilisations comptées sur occurrences multi-fichiers).

### Probes index-images live

| Moteur | Heure UTC | Résultat |
|---|---|---|
| Google Images `tbm=isch` (curl, UA Chrome) | 00:42:16 | **302** → `…&udm=2` |
| Google Images `udm=2` (curl, UA Chrome, suivi) | 00:42:26 | 200 / 91 917 B mais **0 `<img>`, 0 `encrypted-tbn`, 0 résultat exploitable** |
| Google Images (WebFetch, `tbm=isch` puis `udm=2`) | 00:36 / 00:37 | page « difficultés à accéder à la recherche Google » (blocage) |
| Bing Images `site:` | 00:36 | anti-bot — résultats hors-sujet (miniatures YouTube) |
| DuckDuckGo HTML | 00:36 | CAPTCHA « select all squares containing a duck » |
| **Brave Images `site:axion-ia.com`** (curl, UA Chrome) | **00:37:27** | **200 / 296 779 B — 44 résultats exploitables** |

### Décomposition des 44 résultats Brave Images (00:37 UTC)

| Champ | Valeur |
|---|---|
| Pages d'atterrissage (`source`) | `axion-ia.com` : **44/44** |
| `original` sur `axion-ia.com` | **40** — dont `/_next/image?url=…` : **40 (100 %)**, chemin brut : **0** |
| `original` sur `images.unsplash.com` | 4 (héros blog) |
| Dossiers sous-jacents des 40 | `/images/` 32 · `/illustrations/` 5 · `/villes-hero/` 2 · `/logos/` 1 |
| Chemins sous-jacents déclarés dans un `<image:loc>` | 29 / 40 (mais **0** indexé sous la forme déclarée) |
| Non déclarés du tout | 11 — dont `/villes-hero/montelimar.avif`, `/villes-hero/perpignan.avif`, `/images/axion-ia-fondateur-williams-jullin-portrait-professionnel.jpg`, `/logos/qualiopi-axion-ia.png`, 4 bannières home |
| `logos/clients/**` | **0** ✅ |
| `/api/og` | **0** ✅ |
| Pages blog vues comme atterrissage | `coaching-ia-dirigeant-grenoble`, `coaching-ia-dirigeant-mantes-la-ville-roi`, `formation-ia-maurepas-definition` |

### En-têtes des assets image (2026-08-14 22:40:48 UTC)

| URL | HTTP | Content-Type | Taille | Cache-Control | CF | X-Robots-Tag |
|---|---|---|---:|---|---|---|
| `/_next/image?url=/images/…nantes….webp&w=3840&q=75` | 200 | image/jpeg | 202 819 | `public, max-age=31536000, must-revalidate` | DYNAMIC | — |
| `/images/…nantes….webp` | 200 | image/webp | — | `public, max-age=14400` | MISS | — |
| `/api/og?title=Test` | 200 | image/png | 201 690 (mesuré 00:39) | `public, max-age=0, must-revalidate` | DYNAMIC | — |
| `/logos/clients/jardiland.svg` | 200 | image/svg+xml | — | `public, max-age=14400` | MISS | — |
| `/og/image-bank-hub.webp` | 200 | image/webp | — | `public, max-age=14400` | MISS | — |
| `/illustrations/home-hero-equipe.avif` | 200 | image/avif | — | `public, max-age=14400` | MISS | — |

### Rendu des images dans le DOM (22:40:07 → 00:40:49 UTC)

| Page | `<img>` bruts `/images/` | via `/_next/image` | Remarque |
|---|---:|---:|---|
| `/fr` (1 750 762 B) | 0 | 17 sources distinctes | 17 logos clients en SVG direct (hors optimiseur) |
| `/fr/galerie` (1 246 996 B) | **0** | 24 | pagination 24/288 |
| `/fr/galerie/…photo-groupe` (1 183 395 B) | 0 | ≥ 10 | `og:image` + `contentUrl` en chemin brut ; `srcset` 8 largeurs 640→3840 |
| `/fr/implantations/guadeloupe` (1 199 625 B) | 0 | 2 | page région |
| `/fr/blog/formation-ia-clermont-ferrand-guide-complet` (1 283 696 B) | 0 | 6 (dont 5 Unsplash proxifiées) | 1 `<img>` Unsplash **en direct** (hors optimiseur) en fin de corps |

### Recherche d'images côté GSC — instrumentation

| Élément | État |
|---|---|
| `type: "image"` dans une requête `searchAnalytics` du dépôt | **0 occurrence** |
| Exports hebdo `_AUDIT/crawl-stats-2026-W*.csv` | `type` non posé → `web` ; en-tête `page,impressions,clicks,ctr,position` |
| Lignes « galerie » (web) | W31 22 · W32 16 · W33 **14** (36 impressions, **0 clic**, position 19,1) |
| Sitemaps images soumis en GSC | **jamais** (3 échecs le 2026-05-20, cf. F2) — découverte assurée par `sitemap-index.xml` |

## Limites

1. **Google Images n'est pas mesurable dans cette session** — c'est le cœur de ma mission et je dois le déclarer sans détour : les 4 voies tentées (Google `tbm=isch`, Google `udm=2`, Bing Images, DuckDuckGo) sont fermées par anti-bot ou rendu JS ; l'API GSC exige des credentials qui n'existent qu'en secrets GH/Coolify et le mode audit-only interdit toute soumission. **Aucun chiffre de cet audit ne dit combien d'images d'`axion-ia.com` sont dans Google Images.** Tous mes constats d'index proviennent de **Brave Images** (index indépendant, ni Google ni Bing) : c'est une **preuve de crawlabilité et de forme d'URL indexée**, pas une mesure de la position Google. L'unique remède durable est le patch P1 (export GSC `type: "image"`), qui n'est bloqué par aucun secret manquant.
2. **Échantillon Brave = page 1 (44 résultats)** : la taille réelle de l'index Brave sur le domaine n'est pas connue (pas de pagination interrogée, pour ne pas déclencher l'anti-bot constaté par F3 après 8 requêtes). Les ratios (100 % `/_next/image`, 0 logo client, 0 `/api/og`) portent donc sur 44 items, pas sur l'exhaustivité.
3. **Comportement de Googlebot-Image non observable** : je n'ai pas eu accès aux logs d'accès prod (surface F7) ; je n'ai donc pas pu vérifier si Googlebot-Image fetche effectivement les `<image:loc>` bruts, les `/_next/image`, ou les deux. Le finding P2 « URL déclarée ≠ URL indexée » est fondé sur un index tiers + le commentaire de `robots.ts:59-66` ; il est marqué en P2 et non P1 pour cette raison.
4. **Test d'UA bot** : les 200 obtenus avec les UA `Googlebot`/`Googlebot-Image` viennent d'une IP résidentielle française et ne prouvent pas que Cloudflare traite de la même façon les IP Google vérifiées (elles sont en principe traitées plus favorablement — le risque va dans le bon sens).
5. **Aucune mesure de performance en lab** (contrainte machine de nuit respectée : zéro build, zéro `pnpm dev`, zéro Lighthouse local). Le poids des variantes d'image (202 KB en JPEG de repli, 100 KB en AVIF) est un simple relevé `Content-Length`, pas une mesure LCP ; l'impact Web Vitals des images est hors de ma surface (voir `_AUDIT/AUDIT-WEB-VITALS-2026-*.md` et la squad G).
6. **DB non consultée** (E4 n'est pas dans la liste des agents autorisés au SELECT prod) : le décompte « 129 articles à visuel » vient du sitemap live, pas d'un `SELECT count(*)` sur `Article.featuredImage`.
