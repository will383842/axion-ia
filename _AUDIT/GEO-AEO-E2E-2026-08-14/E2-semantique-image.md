# E2 — Sémantique image (image-seo.service, alt-texts, captions, manifeste page-images, ImageObject graph)

- **Date** : 2026-08-14, mesures live 18:25–18:31 UTC (build prod stable atterri ~14:57 UTC ; nouveau deploy en vol parti 17:33 UTC — toutes les surfaces mesurées ici sont statiques ou non-DB, donc insensibles à la fenêtre ISR).
- **Périmètre réellement couvert** : `src/lib/seo/page-images.ts` (1 676 l., manifeste SSOT), `buildImageGraphJsonLd`/`buildPageImageGraphJsonLd`/`buildPrimaryImageOfPage` (`src/lib/seo.ts:2033-2171`), `sitemap-images-services.xml`, `image-seo.service.ts`, `image-seo-enrichment.service.ts`, `image-jsonld-graph.service.ts`, `alt-text-validation.ts` (KB-10), alts des cartes formations (`catalog-v2-photos.ts` / `catalog-v2-facts.ts`), pages live : home, /roi, /formations, /formations/entreprise, /methodologie, /centre-aide, /guide-ia, /stack-ia, /comparaisons, /secteurs/juridique, /faq, /cas-concrets, /visibilite-entreprise, /galerie (hub + 1 détail).
- **Hors périmètre (autres agents)** : pipeline import/variants/EXIF (E1), qualité visuelle & hero villes & compliance Unsplash (E3), les 5 routes sitemap-images-\* en tant que sitemaps (A4).

## Résumé exécutif

L'architecture SSOT (manifeste → rendu → JSON-LD → sitemap) est réelle et globalement saine : 51 fichiers statiques tous présents sur disque et servis en 200, alts FR denses, graphs ImageObject émis sur les pages de services, galerie DB avec @graph 6 nœuds propre. Mais **le triptyque a dérivé sur 3 points** : (P0) chaque ImageObject des pages marketing pointe son `acquireLicensePage` vers `/fr/cgu` qui répond **404** — métadonnée licence mensongère sur les 141 images des 54 pages du sitemap ; (P1) 9 images déclarées (JSON-LD + sitemap) ne sont **plus affichées** sur /roi (4) et /formations/entreprise (5, dont l'image « representative » remplacée par le logo Qualiopi) ; (P1) 5 pages éditoriales sont au sitemap mais n'émettent **aucun** graph ImageObject ; (P1) les 288 pages galerie ré-émettent une Organization divergente (`foundingDate: "2024"` vs `"2026"` canonique) sous le même `@id`.

## Findings

### [P0] `acquireLicensePage` → `/fr/cgu` = 404 sur les 141 ImageObject des pages marketing

- **Symptôme** : chaque `ImageObject` émis par `buildImageGraphJsonLd` (home, tous les services, secteurs, FAQ, /roi…) déclare `license` (CC BY 4.0) + `acquireLicensePage: https://axion-ia.com/fr/cgu` — or cette URL n'existe pas. Google exige un `acquireLicensePage` valide pour le badge « Licensable » dans Google Images ; un 404 rend la métadonnée mensongère et peut la faire ignorer ou signaler en GSC (« Métadonnées d'image »).
- **Preuve code** : `src/lib/seo.ts:2089` — `acquireLicensePage: \`${SITE_URL}/${locale}/cgu\`` (seule occurrence de « cgu » dans tout `src/`). La route réelle est `/conditions-generales` (`src/app/[locale]/conditions-generales/`).
- **Preuve live** (2026-08-14 18:28 UTC) : `curl https://axion-ia.com/fr/cgu` → **404** ; `https://axion-ia.com/fr/conditions-generales` → 200. Le graph de la home (18:29 UTC) contient 14 ImageObject portant ce champ.
- **Root-cause** : URL d'ancienne architecture jamais mise à jour lors du renommage de la page CGV/CGU en `/conditions-generales`.
- **Patch prescrit** : dans `seo.ts:2089`, remplacer par le path réel (`/fr/conditions-generales` via le pathname localisé) — ou par la page hôte de l'image comme le fait déjà la galerie (`acquireLicensePage: pageUrl`, `image-seo.service.ts:101`).
- **Effort** : S (1 ligne). **Impact GEO/AEO** : fort (métadonnée licence de 100 % des images marketing, éligibilité badge Licensable + confiance des rapports GSC).
- **Risque de régression** : quasi nul (métadonnée pure, aucun rendu). **Do-not-touch** : ne pas modifier `image-seo.service.ts` (galerie déjà correcte), ne pas toucher `robots.ts`.

### [P1] 9 images déclarées (JSON-LD + sitemap) ne sont plus affichées : /roi (4) et /formations/entreprise (5)

- **Symptôme** : le contrat du manifeste (« une image déclarée = une image RÉELLEMENT affichée », en-tête `page-images.ts:5-27` et commentaire `roi/page.tsx:127-129`) est violé. Google Images dévalue/ignore les images d'un sitemap absentes de leur page hôte ; `primaryImageOfPage` de /formations/entreprise pointe une image absente du DOM.
- **Preuve code** :
  - `/roi` : la refonte tunnel (#594, 2026-08-14) n'affiche que les slots `hero` et `banner` (`src/app/[locale]/roi/page.tsx:124-126`, rendus l.528-535 et 635-642) ; le commentaire l.1522-1528 de `page-images.ts` retire le **portrait** pour cette raison exacte… mais les 4 entrées `grid` (`redaction/recherche/synthese/reporting.avif`, `page-images.ts:1474-1521`) ont été oubliées.
  - `/formations/entreprise` : le manifeste déclare 7 images (`page-images.ts:313-403`) mais la page ne rend que les slots `hero` et le **premier** `inline` (`formations/entreprise/page.tsx:127-129`) — et depuis la Phase B Qualiopi, `ofPublic` remplace même le héro par le logo Qualiopi (`page.tsx:532-559`). Résultat : `home-hero-equipe.avif` (representative), le quadriptyque (banner), 2 photos atelier (grid) et le portrait (portrait) sont déclarés sans être rendus.
- **Preuve live** (18:25–18:31 UTC) :
  - `/fr/roi` : seuls 2 `<img>` d'illustration (`hero.avif`, `banner.avif`) ; les 4 grid n'apparaissent que dans le JSON-LD (6 ImageObject + logo) et dans `sitemap-images-services.xml` (qui liste bien `roi/redaction|recherche|synthese|reporting.avif`).
  - `/fr/formations/entreprise` : 36 `<img>` rendus (cartes fiches + secteurs + logo Qualiopi + 2 infographies), **aucun** des 5 fichiers ci-dessus ; ils sont pourtant dans le JSON-LD (8 ImageObject) et `primaryImageOfPage` cite `home-hero-equipe.avif#image`.
- **Root-cause** : refontes de pages (tunnel /roi, Phase B Qualiopi) sans repasse sur le manifeste — le SSOT synchronise les 3 consommateurs entre eux, mais rien ne le synchronise avec le rendu réel (aucune garde).
- **Patch prescrit** : (1) retirer du manifeste les 4 entrées grid `/roi` et les 4 entrées banner/grid/portrait `/formations/entreprise` ; (2) pour le héro de `/formations/entreprise`, soit basculer `representativeOfPage` sur l'infographie « comment réserver » réellement affichée, soit déclarer le logo Qualiopi ; (3) idéalement, ajouter un test Playwright léger « chaque `src` du manifeste apparaît dans le HTML de sa page » pour rendre la dérive impossible (une garde ne vaut que si elle rougit).
- **Effort** : S (retraits) + M (garde). **Impact GEO/AEO** : moyen-fort (fiabilité du sitemap images + `primaryImageOfPage` cohérent sur 2 pages stratégiques).
- **Risque de régression** : faible — retirer une entrée retire aussi son ImageObject (voulu). **Do-not-touch** : ne pas re-render les images sur /roi (la coupe tunnel est une décision produit #594) ; ne pas toucher au bloc `ofPublic` Qualiopi.

### [P1] 5 pages éditoriales au sitemap images mais sans graph ImageObject ni `primaryImageOfPage`

- **Symptôme** : `/methodologie`, `/centre-aide`, `/comparaisons`, `/stack-ia`, `/guide-ia` ont une entrée manifeste (donc figurent dans `sitemap-images-services.xml`) et rendent bien leurs images, mais n'émettent pas le consommateur n°2 : aucun `ImageObject` de page, aucun `primaryImageOfPage` — le triptyque promis par l'en-tête du manifeste n'est qu'un diptyque sur ces 5 pages.
- **Preuve code** : aucune de ces 5 pages n'importe `buildPageImageGraphJsonLd`/`buildPrimaryImageOfPage`/`getPageImages` (grep exhaustif : seuls consommateurs = 30 pages de services + sitemap ; ex. `src/app/[locale]/methodologie/page.tsx:39-41` importe HowTo/Article/WebPage mais pas le graph image). Entrées manifeste : `page-images.ts:1533-1644`.
- **Preuve live** (18:26 UTC) : les 5 pages répondent 200 avec `ImageObject=1` — uniquement le logo de l'Organization (`#logo`) — alors que `/fr/formations` en émet 7 et la home 14. `/fr/methodologie` rend pourtant `methodologie-demarche.avif` + `methodologie-terrain.avif` en `<img>`.
- **Root-cause** : les entrées manifeste de ces pages ont été ajoutées pour le sitemap (curation Unsplash éditoriale) sans câbler le composant JSON-LD côté page.
- **Patch prescrit** : ajouter sur chaque page `const g = buildPageImageGraphJsonLd({ locale, path }); {g && <JsonLd data={g} />}` + `buildPrimaryImageOfPage(path)` dans le WebPage — motif identique aux 30 pages déjà câblées (copier `/fr/comparaisons` sur `/fr/audit`).
- **Effort** : S (5 × ~6 lignes, motif existant). **Impact GEO/AEO** : moyen (3 de ces pages sont dans la liste des 15 pages stratégiques Web Vitals : /methodologie, /comparaisons, /stack-ia).
- **Risque de régression** : quasi nul (ajout de balisage ; +~1 KB HTML/page). **Do-not-touch** : ne pas dupliquer l'alt court du DOM — voir P2 divergence alt ci-dessous (aligner d'abord le manifeste).

### [P1] Organization divergente ré-émise sous le même `@id` sur les 288 pages galerie (`foundingDate` 2024 vs 2026)

- **Symptôme** : les pages `/fr/galerie/**` ré-déclarent une `Organization` complète `@id: /#organization` avec `foundingDate: "2024"`, description « audits, interventions, implémentations Claude pour PME et ETI » (3 services au lieu de 5) et `knowsAbout: ["Automatisation no-code", …]`, alors que l'Organization canonique (home) déclare `foundingDate: "2026"`. Deux versions contradictoires de la même entité = signaux entité brouillés pour le Knowledge Graph et les moteurs génératifs.
- **Preuve code** : `src/server/image-bank/services/image-jsonld-graph.service.ts:58-112` (fichier marqué « Template ») — `foundingDate: "2024"` l.88 ; l'Organization canonique dans `src/lib/seo.ts:917` dit `foundingDate: "2026"`.
- **Preuve live** (18:30 UTC) : `/fr/galerie/axion-ia-hero-ville-nimes-consultant-ia-formation-pme` contient `"foundingDate":"2024"` ; la home (18:29 UTC) contient `"foundingDate":"2026"`. Hub galerie : 288 images publiées, graph CollectionPage+ItemList sain par ailleurs.
- **Root-cause** : template hérité (SOS-Expat/portable) jamais aligné sur le SSOT entité d'axionia.
- **Patch prescrit** : dans `buildImageDetailGraph`/`buildGalleryHubGraph`, remplacer le nœud Organization complet par une simple référence `{ "@id": ORG_ID }` (l'entité pleine est déjà émise ailleurs) — ou, si le nœud autonome est voulu, importer les mêmes valeurs que `seo.ts` (foundingDate, description 5 services) depuis un SSOT commun.
- **Effort** : S-M. **Impact GEO/AEO** : moyen (cohérence entité sur 288 URLs indexables ; la galerie sert de réservoir Google Images).
- **Risque de régression** : faible ; vérifier que chaque page galerie référence au moins une fois l'entité (sinon graph orphelin). **Do-not-touch** : `sameAs` LinkedIn/X (graphies documentées, STOP & ASK avant tout changement de handle), `image-seo.service.ts` (ImageObject lui-même est correct).

### [P2] Divergence alt DOM vs manifeste sur les 5 pages éditoriales

- **Symptôme** : le DOM rend l'alt court (« Une équipe travaille devant un tableau blanc couvert de notes de cadrage. ») alors que le manifeste — donc `<image:caption>` du sitemap — porte une version enrichie (« …, illustrant les quatre temps de la méthodologie Axion-IA. »). La règle du manifeste (`page-images.ts:26-27`) dit : les alts DOIVENT rester identiques au rendu, la page est la référence.
- **Preuve code** : `page-images.ts:1540-1543` vs alt rendu par la page (source de l'alt court dans le composant de `/methodologie`). **Preuve live** (18:26 UTC) : alts DOM extraits sur les 5 pages = versions courtes ; sitemap (18:25 UTC) = versions longues.
- **Patch** : au moment de câbler le P1 précédent, choisir UNE version (recommandé : la version enrichie, portée aussi dans le DOM). Effort S. Impact faible. Risque nul.

### [P2] Alts mi-FR mi-EN des 46 cartes formations + backslash littéral, cartes hors sitemap images

- **Symptôme** : sur `/fr/formations` et `/fr/formations/entreprise`, l'alt des cartes = `Formation « X » — Axion-IA, intra-entreprise (man smiling while sitting and using MacBook)` — le fragment parenthésé est l'alt Unsplash brut en anglais, parfois sans rapport avec le sujet (santé → « white wooden desk on hallway inside building ») et une fois avec un backslash littéral (« red hard hat on pavement\ »). Par ailleurs les 46 `fiches/*/card.avif` ne figurent dans aucun sitemap images (couverture uniquement via `Course.image` des fiches détail — `FormationDetailPage.tsx:264-278` — et le crawl du DOM).
- **Preuve code** : `src/content/formations/catalog-v2-photos.ts:22,37,82,87` (alts EN bruts ; l.87 : `alt: "red hard hat on pavement\\"`) ; composition `src/content/formations/catalog-v2-facts.ts:136`. **Preuve live** (18:26 UTC) : alts rendus sur `/fr/formations` contiennent les fragments EN.
- **Patch** : remplacer le fragment Unsplash par une courte description FR (46 lignes, peut être générée par le service d'enrichment vision déjà en place), corriger le `\\` ; optionnel : ajouter les cartes au sitemap images via une section formations du manifeste. Effort M. Impact faible-moyen (pertinence mots-clés Google Images des 22 fiches). Risque nul. **Do-not-touch** : garder l'attribution photographe rendue (CGU Unsplash §9).

### [P2] Consigne naming dégénérée dans le prompt d'enrichment vision

- **Symptôme** : `« Naming : "Axion-IA" toujours, "Axion-IA" pour l'entité juridique »` — la seconde moitié devait porter la raison sociale (cf. `BRAND.legalName`) ; telle quelle la consigne est vide de sens pour le modèle.
- **Preuve code** : `src/server/image-bank/services/image-seo-enrichment.service.ts:47`. Pas de preuve live possible (prompt interne). `[À CONFIRMER]` pour l'intention seulement — le texte, lui, est constaté.
- **Patch** : injecter `BRAND.legalName` dans le prompt. Effort S. Impact faible. Risque nul.

### [P2] Balises `<image:title>/<image:caption>/<image:license>` dépréciées dans le sitemap images

- **Symptôme** : `sitemap-images-services.xml` émet title/caption/license par image ; Google a déprécié ces extensions en 2022 (seul `<image:loc>` compte). Inoffensif (ignoré), mais du poids mort (81 KB) et une fausse impression de couverture licence (la vraie voie = métadonnées structurées de la page, cf. P0).
- **Preuve code** : `src/app/sitemap-images-services.xml/route.ts:42-47`. **Preuve live** (18:25 UTC) : flux 200, 54 pages / 141 images, balises présentes.
- **Patch** : optionnel — ne retirer qu'à l'occasion d'un autre chantier sur ce fichier. Effort S. Impact quasi nul. Risque nul.

## Points sains vérifiés (anti-faux-positifs pour la synthèse)

- Les 51 `src` statiques du manifeste existent tous sous `public/` (scan disque) ; 6 spot-checks prod → 200 `image/avif` (18:27 UTC), y compris les 10 héros secteurs et les images FAQ/home générées depuis leurs SSOT (`faq-images.ts`, `home-images.ts` — 0 slot manquant vs `FAQ_CATEGORIES` et vs slots consommés).
- Graphs ImageObject conformes et complets sur : home (14, 1 representative), /formations (7), /secteurs/juridique (3), /faq (2), /cas-concrets (4), /visibilite-entreprise (11) — tous avec exactement 1 `representativeOfPage:true` (18:27-18:29 UTC).
- `/fr/formations` et `/fr/visibilite-entreprise` rendent bien 100 % de leurs images manifeste (pas de dérive type /roi).
- KB-10 `validateAltText` est réellement câblé et bloquant (`server/actions/knowledge/publish.ts:44`, `ingest.ts:133`) avec tests unitaires.
- Galerie : ImageObject détail riche (caption, creditText, license, speakable, `acquireLicensePage=pageUrl` correct), `contentUrl` et thumb servis en 200 (18:30 UTC) ; fix P0 2026-06-14 des contentUrl mortes toujours effectif.
- `datePublished` n'est plus défaulté à BUILD_DATE (audit fraîcheur 2026-06-08 respecté, `seo.ts:2111-2115`).
- `/diagnostic` (VSL #597) est noindex par design → son absence du manifeste n'est PAS un trou.

## Mesures brutes

| URL (https://axion-ia.com) | Heure UTC | Status | Mesure |
|---|---|---|---|
| /sitemap-images-services.xml | 18:25:17 | 200 | 81 295 B, 54 `<url>`, 141 `<image:image>` ; contient les 6 images /roi et les 5 pages éditoriales |
| /fr/roi | 18:25:26 | 200 | 1 254 673 B ; `<img>` illustratives : hero.avif + banner.avif uniquement ; 7 ImageObject |
| /fr/methodologie | 18:26:03 | 200 | ImageObject=1 (logo seul) ; 2 `<img>` éditoriales rendues |
| /fr/centre-aide, /guide-ia, /stack-ia, /comparaisons | 18:26 | 200 | ImageObject=1 chacun (logo seul) |
| /fr/formations | 18:26 | 200 | ImageObject=7 ; 6/6 images manifeste rendues + 20+ cartes fiches |
| /fr (home) | 18:29 | 200 | ImageObject=14, representative=1, foundingDate=2026 |
| /fr/secteurs/juridique · /fr/faq · /fr/cas-concrets · /fr/visibilite-entreprise | 18:27 | 200 | ImageObject=3 · 2 · 4 · 11 ; representative=1 partout |
| /fr/formations/entreprise | 18:31 | 200 | ImageObject=8 ; 2/7 images manifeste rendues ; primaryImageOfPage → image non affichée |
| /fr/cgu | 18:28:18 | **404** | cible `acquireLicensePage` de tous les ImageObject marketing |
| /fr/conditions-generales | 18:28 | 200 | route réelle |
| /fr/galerie | 18:30:07 | 200 | 288 images (numberOfItems), 26 ImageObject |
| /fr/galerie/axion-ia-hero-ville-nimes-… | 18:30:20 | 200 | graph 6 nœuds ; foundingDate=**2024** (≠ home) ; contentUrl + thumb → 200 |
| 6 fichiers images (roi/redaction, secteurs/juridique, faq/hub, home/why-01, home-bandeau-team, fiches/ia-pour-la-sante/card) | 18:27:37 | 200 ×6 | `image/avif` |
| /sitemap-index.xml | 18:29:20 | 200 | référence bien sitemap-images-{blog,services,villes-t1,t2,t3-t4} + sitemaps/images-fr.xml |

Volumes statiques : manifeste = 54 pages / 141 déclarations d'images (51 fichiers uniques) ; 10 héros secteurs ; 10 slots FAQ ; 10 slots home ; 46 dossiers `fiches/*/card.avif`.

## Limites

- **GSC non consultée** (aucun accès outillé) : impossible de confirmer si le rapport « Métadonnées d'image » remonte déjà le 404 `acquireLicensePage` ou des warnings creditText.
- **Pas d'inspection visuelle** des images (pertinence sujet/photo) — c'est la mission E3.
- **DB prod non interrogée** (E2 non autorisé SELECT) : le chiffre 288 images galerie vient du JSON-LD live, pas d'un `SELECT count`.
- **Déploiement en vol** (parti 17:33 UTC) : mesures faites avant atterrissage estimé (18:30-19:00) sur le build stable de 14:57 ; les surfaces mesurées étant statiques/SSG, le risque de mesure transitoire est nul, mais un re-check post-deploy de `/fr/roi` (JSON-LD) est prudent si un patch du manifeste part dans la foulée.
- **Enrichment Claude Vision non exécuté** (aucun appel API en audit-only) : la qualité effective des metadata produites (alt 30-125, pléonasmes) n'est vérifiée que sur le code et un échantillon galerie live.
- Les worktrees SEO non mergés (`axionia-wt-seo2`, `-indexnow`) n'ont pas été audités (règle Phase 0).
